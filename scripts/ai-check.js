// A live run against the real Groq API: generate a lesson, check it, print
// what the teacher would see. It is the only script that costs money, so it
// is not part of `npm run verify`.
//
//   npm run ai-check

import 'dotenv/config'
import { generateLesson } from '../server/grok.js'
import { checkLesson } from '../server/validate.js'
import { normalizeForm } from '../src/lib/formRules.js'
import { exampleForm } from './fixtures/exampleLesson.js'

const form = normalizeForm({
  ...exampleForm,
  constraints:
    'No projector, no printing, no internet during the lesson. Pupils sit in groups of five.',
})

console.log('Village — live AI check\n')
console.log(`request: ${form.grade} ${form.subject}, ${form.durationMinutes} minutes`)
console.log(`materials: ${form.materials.map((m) => `${m.name} (${m.quantity})`).join(', ')}\n`)

const started = Date.now()
const lesson = await generateLesson(form)
const seconds = ((Date.now() - started) / 1000).toFixed(1)

const total = lesson.activities.reduce((sum, a) => sum + (a.durationMinutes || 0), 0)

console.log(`generated in ${seconds}s\n`)
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

const feasibility = checkLesson(lesson, form)
console.log(`verdict: ${feasibility.verdict}\n`)
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
