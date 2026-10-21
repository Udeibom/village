// A live run against the real Groq API: generate a lesson, check it, print
// what the teacher would see. It is the only script that costs money, so it
// is not part of `npm run verify`.
//
//   npm run ai-check

import 'dotenv/config'
import { generateLesson, rebuildLesson } from '../server/grok.js'
import { buildLessonWithRebuilds } from '../server/rebuild.js'
import { normalizeForm } from '../src/lib/formRules.js'
import { exampleForm } from '../server/fixtures/exampleLesson.js'

const form = normalizeForm({
  ...exampleForm,
  constraints:
    'No projector, no printing, no internet during the lesson. Pupils sit in groups of five.',
})

function report(feasibility) {
  console.log(`verdict: ${feasibility.verdict}`)
  for (const row of feasibility.checks.materials) {
    console.log(`  [${row.status}] ${row.name} — ${row.detail}`)
  }
  console.log(`  [${feasibility.checks.timing.status}] timing — ${feasibility.checks.timing.detail}`)
  console.log(
    `  [${feasibility.checks.assessment.status}] assessment — ${feasibility.checks.assessment.detail}`,
  )
  console.log(
    `  [${feasibility.checks.curriculum.status}] curriculum — ${feasibility.checks.curriculum.detail}`,
  )
  console.log(`  rebuilds attempted: ${feasibility.rebuildsAttempted}`)
}

async function run(label, request) {
  console.log(`\n${'='.repeat(64)}\n${label}\n${'='.repeat(64)}`)
  console.log(
    `materials: ${request.materials.map((m) => `${m.name} (${m.quantity})`).join(', ')}`,
  )

  const started = Date.now()
  const { lesson, feasibility } = await buildLessonWithRebuilds(request, {
    generate: (f) => generateLesson(f),
    rebuild: (current, f, gaps) => rebuildLesson(current, f, gaps),
  })
  const seconds = ((Date.now() - started) / 1000).toFixed(1)

  const total = lesson.activities.reduce((sum, a) => sum + (a.durationMinutes || 0), 0)

  console.log(`\ngenerated in ${seconds}s`)
  console.log(`title: ${lesson.title}`)
  for (const activity of lesson.activities) {
    const materials = activity.materials
      .map((m) => `${m.name} (${m.quantityNeeded})`)
      .join(', ')
    console.log(
      `  - ${activity.name} [${activity.durationMinutes}m]${materials ? ` :: ${materials}` : ''}`,
    )
  }
  console.log(`  timings add up to ${total} minutes\n`)
  report(feasibility)
  return { lesson, feasibility }
}

console.log('Village — live AI check\n')
console.log(`request: ${form.grade} ${form.subject}, ${form.durationMinutes} minutes`)

const first = await run('1. The full inventory', form)

// The money shot: the measuring cups are gone and the bottle tops have run
// down. The lesson should change, not just the verdict.
const reduced = normalizeForm({
  ...form,
  materials: form.materials
    .filter((material) => material.name !== 'measuring cups')
    .map((material) =>
      material.name === 'bottle tops' ? { ...material, quantity: '10' } : material,
    ),
})

const second = await run('2. The measuring cups are gone and the tops are down to 10', reduced)

const askedForCups = second.lesson.activities.some((activity) =>
  (activity.materials || []).some((material) =>
    material.name.toLowerCase().includes('measuring cup'),
  ),
)
const askedForTooManyTops = second.lesson.activities.some((activity) =>
  (activity.materials || []).some((material) => {
    if (!material.name.toLowerCase().includes('bottle top')) return false
    const count = Number(material.quantityNeeded)
    return Number.isFinite(count) && count > 10
  }),
)

console.log(`\n${'='.repeat(64)}`)
console.log('the money shot')
console.log(`${'='.repeat(64)}`)
console.log(`first verdict:  ${first.feasibility.verdict} (rebuilds ${first.feasibility.rebuildsAttempted})`)
console.log(`second verdict: ${second.feasibility.verdict} (rebuilds ${second.feasibility.rebuildsAttempted})`)
console.log(`the lesson still asks for measuring cups: ${askedForCups}`)
console.log(`the lesson still asks for more than 10 bottle tops: ${askedForTooManyTops}`)
