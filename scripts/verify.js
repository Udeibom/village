// Mechanical checks on the pure logic — the parts with no AI and no browser in
// them. Plain node assertions, no test framework.
//
//   npm run verify

import assert from 'node:assert/strict'
import { canGenerate, emptyForm, normalizeForm, toNumberOrNull } from '../src/lib/formRules.js'
import { checkLesson, shortfalls, parseQuantity, objectivesMatch } from '../server/validate.js'
import { validateLessonShape } from '../server/grok.js'
import { buildLessonWithRebuilds, MAX_REBUILDS } from '../server/rebuild.js'
import {
  exampleLesson,
  exampleInventory,
  exampleForm,
} from '../server/fixtures/exampleLesson.js'

let passed = 0
const failures = []

function check(name, fn) {
  try {
    fn()
    passed += 1
    console.log(`  ok  ${name}`)
  } catch (error) {
    failures.push({ name, error })
    console.log(`FAIL  ${name}`)
    console.log(`      ${error.message.split('\n')[0]}`)
  }
}

async function acheck(name, fn) {
  try {
    await fn()
    passed += 1
    console.log(`  ok  ${name}`)
  } catch (error) {
    failures.push({ name, error })
    console.log(`FAIL  ${name}`)
    console.log(`      ${error.message.split('\n')[0]}`)
  }
}

function section(title) {
  console.log(`\n${title}`)
}

console.log('Village — verify\n')

// A lesson and an inventory where every count is a number, so the whole
// check can pass and the green light is reachable.
const countableLesson = {
  ...exampleLesson,
  activities: exampleLesson.activities.map((activity) => ({
    ...activity,
    materials: activity.materials.map((material) =>
      material.name === 'beans' ? { ...material, quantityNeeded: '20' } : material,
    ),
  })),
}

const countableForm = {
  ...exampleForm,
  materials: exampleInventory.map((material) =>
    material.name === 'beans' ? { ...material, quantity: '30' } : material,
  ),
}

// The same, but with eight bottle tops short.
const shortForm = {
  ...countableForm,
  materials: countableForm.materials.map((material) =>
    material.name === 'bottle tops' ? { ...material, quantity: '32' } : material,
  ),
}

section('Generate gating')
check('empty form cannot generate', () => {
  assert.equal(canGenerate(emptyForm()), false)
})
check('curriculum alone is not enough', () => {
  const form = { ...emptyForm(), curriculumObjective: 'Represent ratios' }
  assert.equal(canGenerate(form), false)
})
check('material without a name is not enough', () => {
  const form = {
    ...emptyForm(),
    curriculumObjective: 'Represent ratios',
    materials: [{ name: '   ', quantity: '40' }],
  }
  assert.equal(canGenerate(form), false)
})
check('curriculum plus one named material can generate', () => {
  const form = {
    ...emptyForm(),
    curriculumObjective: 'Represent ratios',
    materials: [{ name: 'bottle tops', quantity: '40' }],
  }
  assert.equal(canGenerate(form), true)
})
check('a blank curriculum is not a curriculum', () => {
  const form = {
    ...emptyForm(),
    curriculumObjective: '   ',
    materials: [{ name: 'bottle tops', quantity: '40' }],
  }
  assert.equal(canGenerate(form), false)
})
check('class size and duration are not required to generate', () => {
  const form = {
    ...emptyForm(),
    curriculumObjective: 'Represent ratios',
    materials: [{ name: 'bottle tops', quantity: '40' }],
  }
  assert.equal(canGenerate(form), true)
})

section('Form normalisation')
check('numbers become numbers, blanks become null', () => {
  assert.equal(toNumberOrNull('40'), 40)
  assert.equal(toNumberOrNull(''), null)
  assert.equal(toNumberOrNull('  '), null)
  assert.equal(toNumberOrNull('a bag'), null)
})
check('blank material rows are dropped and ids stripped', () => {
  const form = {
    ...emptyForm(),
    curriculumObjective: 'Represent ratios',
    materials: [
      { id: 'material-1', name: 'bottle tops', quantity: ' 40 ' },
      { id: 'material-2', name: '', quantity: '3' },
      { id: 'material-3', name: 'beans', quantity: 'a bag' },
    ],
  }
  const payload = normalizeForm(form)
  assert.deepEqual(payload.materials, [
    { name: 'bottle tops', quantity: '40' },
    { name: 'beans', quantity: 'a bag' },
  ])
})
check('the topic doubles as the learning objective', () => {
  const form = { ...emptyForm(), topic: 'Understand and represent ratios' }
  const payload = normalizeForm(form)
  assert.equal(payload.topic, 'Understand and represent ratios')
  assert.equal(payload.learningObjective, 'Understand and represent ratios')
})
check('class size and duration survive normalisation as numbers', () => {
  const form = { ...emptyForm(), classSize: '40', durationMinutes: '35' }
  const payload = normalizeForm(form)
  assert.equal(payload.classSize, 40)
  assert.equal(payload.durationMinutes, 35)
})
check('numbers that are already numbers stay numbers', () => {
  const form = { ...emptyForm(), classSize: 40, durationMinutes: 35 }
  const payload = normalizeForm(form)
  assert.equal(payload.classSize, 40)
  assert.equal(payload.durationMinutes, 35)
})

section('The feasibility checker — materials')
check('a material you have in full is enough', () => {
  const result = checkLesson(exampleLesson, exampleForm)
  const row = result.checks.materials.find((r) => r.name === 'bottle tops')
  assert.equal(row.status, 'ok')
})
check('a material you do not have is flagged as not listed', () => {
  const form = { ...exampleForm, materials: [] }
  const result = checkLesson(exampleLesson, form)
  const row = result.checks.materials.find((r) => r.name === 'bottle tops')
  assert.equal(row.status, 'missing')
  assert.match(row.detail, /not on your list/)
})
check('not enough of a material is a shortage, and the shortfall is named', () => {
  const form = {
    ...exampleForm,
    materials: exampleInventory.map((m) =>
      m.name === 'bottle tops' ? { ...m, quantity: '32' } : m,
    ),
  }
  const result = checkLesson(exampleLesson, form)
  const row = result.checks.materials.find((r) => r.name === 'bottle tops')
  assert.equal(row.status, 'short')
  assert.equal(row.shortBy, 8)
  assert.match(row.detail, /Short by 8/)
})
check('a count you cannot measure is unverified, not quietly passed', () => {
  const result = checkLesson(exampleLesson, exampleForm)
  const row = result.checks.materials.find((r) => r.name === 'beans')
  assert.equal(row.status, 'quantity-unverified')
})
check('the same material used twice needs the peak, not the sum', () => {
  const lesson = {
    ...exampleLesson,
    activities: [
      {
        ...exampleLesson.activities[0],
        materials: [{ name: 'bottle tops', quantityNeeded: '40' }],
      },
      {
        ...exampleLesson.activities[1],
        materials: [{ name: 'bottle tops', quantityNeeded: '40' }],
      },
    ],
  }
  const result = checkLesson(lesson, exampleForm)
  const row = result.checks.materials.find((r) => r.name === 'bottle tops')
  assert.equal(row.status, 'ok')
  assert.match(row.detail, /needs 40 at once/)
})
check('materials are matched without regard to case or spacing', () => {
  const form = {
    ...exampleForm,
    materials: exampleInventory.map((m) =>
      m.name === 'bottle tops' ? { name: '  Bottle   Tops ', quantity: '40' } : m,
    ),
  }
  const result = checkLesson(exampleLesson, form)
  const row = result.checks.materials.find((r) => r.name === 'bottle tops')
  assert.equal(row.status, 'ok')
})
check('counts read the way a teacher would say them', () => {
  const result = checkLesson(exampleLesson, exampleForm)
  const tops = result.checks.materials.find((r) => r.name === 'bottle tops')
  const cups = result.checks.materials.find((r) => r.name === 'measuring cups')
  const chalk = result.checks.materials.find((r) => r.name === 'chalk')
  assert.match(tops.detail, /You have 40 bottle tops/)
  assert.match(cups.detail, /You have 2 measuring cups/)
  assert.match(chalk.detail, /You have 1 chalk/)
  assert.doesNotMatch(tops.detail, /topses/)
})

section('The feasibility checker — timing')
check('activities that fit the lesson pass', () => {
  const result = checkLesson(exampleLesson, exampleForm)
  assert.equal(result.checks.timing.status, 'ok')
  assert.match(result.checks.timing.detail, /35 minutes/)
})
check('an overrun is flagged', () => {
  const lesson = {
    ...exampleLesson,
    activities: exampleLesson.activities.map((a) => ({
      ...a,
      durationMinutes: a.durationMinutes + 5,
    })),
  }
  const result = checkLesson(lesson, exampleForm)
  assert.equal(result.checks.timing.status, 'fail')
  assert.match(result.checks.timing.detail, /more than the 35 you have/)
})
check('a large underfill is flagged', () => {
  const lesson = {
    ...exampleLesson,
    activities: exampleLesson.activities.map((a) => ({
      ...a,
      durationMinutes: 1,
    })),
  }
  const result = checkLesson(lesson, exampleForm)
  assert.equal(result.checks.timing.status, 'fail')
  assert.match(result.checks.timing.detail, /room for more/)
})
check('no lesson length means timing cannot be checked', () => {
  const result = checkLesson(exampleLesson, { ...exampleForm, durationMinutes: null })
  assert.equal(result.checks.timing.status, 'fail')
  assert.match(result.checks.timing.detail, /no lesson length/)
})

section('The feasibility checker — assessment and curriculum')
check('an assessment that tests your objective passes', () => {
  const result = checkLesson(exampleLesson, exampleForm)
  assert.equal(result.checks.assessment.status, 'ok')
})
check('an assessment that tests something else is flagged', () => {
  const lesson = {
    ...exampleLesson,
    assessment: {
      ...exampleLesson.assessment,
      servesObjective: 'Convert fractions into decimals',
    },
  }
  const result = checkLesson(lesson, exampleForm)
  assert.equal(result.checks.assessment.status, 'fail')
  assert.match(result.checks.assessment.detail, /not the objective you gave/)
})
check('an assessment that describes the objective in its own words still counts', () => {
  const lesson = {
    ...exampleLesson,
    assessment: {
      ...exampleLesson.assessment,
      servesObjective:
        'Students will demonstrate understanding by correctly forming and comparing ratios in a short written task.',
    },
  }
  const result = checkLesson(lesson, exampleForm)
  assert.equal(result.checks.assessment.status, 'ok')
})
check('an assessment that declares no objective is flagged', () => {
  const lesson = {
    ...exampleLesson,
    assessment: { ...exampleLesson.assessment, servesObjective: '' },
  }
  const result = checkLesson(lesson, exampleForm)
  assert.equal(result.checks.assessment.status, 'fail')
})
check('objectives are matched on meaning, not on identical wording', () => {
  assert.equal(
    objectivesMatch(
      'Represent and compare ratios using equivalent forms',
      'By the end of the lesson, learners should be able to represent and compare ratios using equivalent forms.',
    ),
    true,
  )
  assert.equal(
    objectivesMatch('Convert fractions into decimals', 'Represent and compare ratios'),
    false,
  )
})
check('a curriculum the AI could not verify is not called aligned', () => {
  const lesson = { ...exampleLesson, curriculumConfidence: 'unverified' }
  const result = checkLesson(lesson, exampleForm)
  assert.equal(result.checks.curriculum.status, 'fail')
  assert.match(result.checks.curriculum.detail, /unverified/)
})
check('a missing curriculum objective is flagged', () => {
  const result = checkLesson(exampleLesson, {
    ...exampleForm,
    curriculumObjective: '',
  })
  assert.equal(result.checks.curriculum.status, 'fail')
})

section('The feasibility checker — the verdict')
check('everything passing means ready to teach', () => {
  // The fixture counts beans as "a handful", which cannot be verified. For
  // the green light, both sides have to be countable.
  const lesson = {
    ...exampleLesson,
    activities: exampleLesson.activities.map((activity) => ({
      ...activity,
      materials: activity.materials.map((material) =>
        material.name === 'beans' ? { ...material, quantityNeeded: '20' } : material,
      ),
    })),
  }
  const form = {
    ...exampleForm,
    materials: exampleInventory.map((material) =>
      material.name === 'beans' ? { ...material, quantity: '30' } : material,
    ),
  }
  const result = checkLesson(lesson, form)
  assert.equal(result.verdict, 'ready')
})
check('a count you cannot measure alone keeps the lesson off the green light', () => {
  const result = checkLesson(exampleLesson, exampleForm)
  assert.equal(result.verdict, 'attention')
})
check('one failing check means needs attention', () => {
  const form = {
    ...exampleForm,
    materials: exampleInventory.map((m) =>
      m.name === 'bottle tops' ? { ...m, quantity: '10' } : m,
    ),
  }
  const result = checkLesson(exampleLesson, form)
  assert.equal(result.verdict, 'attention')
})
check('an unverified quantity is enough on its own to stop the green light', () => {
  const lesson = {
    ...exampleLesson,
    activities: exampleLesson.activities.map((a) =>
      a.name === 'Sharing in equal groups'
        ? { ...a, materials: [{ name: 'beans', quantityNeeded: '20' }] }
        : a,
    ),
  }
  const form = {
    ...exampleForm,
    materials: [{ name: 'beans', quantity: 'a bag' }],
  }
  const result = checkLesson(lesson, form)
  assert.equal(result.checks.materials[0].status, 'quantity-unverified')
  assert.equal(result.verdict, 'attention')
})
check('only shortages and missing items are worth rebuilding for', () => {
  const form = {
    ...exampleForm,
    materials: exampleInventory.map((m) =>
      m.name === 'bottle tops' ? { ...m, quantity: '10' } : m,
    ),
  }
  const result = checkLesson(exampleLesson, form)
  const names = shortfalls(result).map((row) => row.name)
  assert.ok(names.includes('bottle tops'))
  assert.ok(!names.includes('beans'))
})

section('The lesson shape validator')
check('a good lesson passes', () => {
  assert.doesNotThrow(() => validateLessonShape(exampleLesson))
})
check('a reply that is not a lesson is rejected', () => {
  assert.throws(() => validateLessonShape({ hello: 'world' }), /not a usable lesson/)
})
check('a lesson missing activities is rejected', () => {
  assert.throws(
    () => validateLessonShape({ ...exampleLesson, activities: [] }),
    /at least three activities/,
  )
})
check('an activity without an understanding check is rejected', () => {
  const lesson = {
    ...exampleLesson,
    activities: [
      { ...exampleLesson.activities[0], understandingCheck: '' },
      ...exampleLesson.activities.slice(1),
    ],
  }
  assert.throws(() => validateLessonShape(lesson), /understanding check/)
})
check('an assessment without a declared objective is rejected', () => {
  const lesson = {
    ...exampleLesson,
    assessment: { instructions: 'do the thing', servesObjective: '' },
  }
  assert.throws(() => validateLessonShape(lesson), /which objective it tests/)
})
check('quantities are only numbers when they can be counted', () => {
  assert.equal(parseQuantity('40'), 40)
  assert.equal(parseQuantity('a bag'), null)
  assert.equal(parseQuantity(''), null)
})

section('The rebuild loop')
await acheck('a lesson that already fits is left alone', async () => {
  let rebuilds = 0
  const { feasibility } = await buildLessonWithRebuilds(countableForm, {
    generate: async () => countableLesson,
    rebuild: async () => {
      rebuilds += 1
      return countableLesson
    },
  })
  assert.equal(rebuilds, 0)
  assert.equal(feasibility.rebuildsAttempted, 0)
  assert.equal(feasibility.verdict, 'ready')
})

await acheck('a shortage makes the lesson rebuild, not just get flagged', async () => {
  let rebuilds = 0
  const { feasibility } = await buildLessonWithRebuilds(shortForm, {
    generate: async () => countableLesson,
    rebuild: async (current) => {
      rebuilds += 1
      return {
        ...current,
        activities: current.activities.map((activity) => ({
          ...activity,
          materials: activity.materials.map((material) =>
            material.name === 'bottle tops'
              ? { ...material, quantityNeeded: '32' }
              : material,
          ),
        })),
      }
    },
  })
  assert.equal(rebuilds, 1)
  assert.equal(feasibility.rebuildsAttempted, 1)
  assert.equal(feasibility.verdict, 'ready')
})

await acheck('the loop stops after two rebuilds', async () => {
  let rebuilds = 0
  const { feasibility } = await buildLessonWithRebuilds(shortForm, {
    generate: async () => countableLesson,
    rebuild: async (current) => {
      rebuilds += 1
      return current
    },
  })
  assert.equal(rebuilds, MAX_REBUILDS)
  assert.equal(rebuilds, 2)
  assert.equal(feasibility.rebuildsAttempted, 2)
})

await acheck('a shortage that survives the rebuilds comes back named, not passed', async () => {
  const { feasibility } = await buildLessonWithRebuilds(shortForm, {
    generate: async () => countableLesson,
    rebuild: async (current) => current,
  })
  assert.equal(feasibility.verdict, 'attention')
  const row = feasibility.checks.materials.find((r) => r.name === 'bottle tops')
  assert.equal(row.status, 'short')
  assert.equal(row.shortBy, 8)
  assert.match(row.detail, /Short by 8 bottle tops/)
})

await acheck('a count the teacher could not give is not worth rebuilding', async () => {
  let rebuilds = 0
  const { feasibility } = await buildLessonWithRebuilds(exampleForm, {
    generate: async () => exampleLesson,
    rebuild: async () => {
      rebuilds += 1
      return exampleLesson
    },
  })
  assert.equal(rebuilds, 0)
  assert.equal(feasibility.rebuildsAttempted, 0)
  assert.equal(feasibility.verdict, 'attention')
})

await acheck('a rebuild that fails does not take the lesson down', async () => {
  const { lesson, feasibility } = await buildLessonWithRebuilds(shortForm, {
    generate: async () => countableLesson,
    rebuild: async () => {
      throw new Error('the AI is down')
    },
  })
  assert.equal(feasibility.rebuildsAttempted, 1)
  assert.equal(feasibility.verdict, 'attention')
  assert.equal(lesson.title, countableLesson.title)
})

console.log(`\n${passed} passed, ${failures.length} failed`)
if (failures.length > 0) {
  process.exitCode = 1
}