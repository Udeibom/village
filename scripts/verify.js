// Mechanical checks on the pure logic — the parts with no AI and no browser in
// them. Plain node assertions, no test framework.
//
//   npm run verify

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { canGenerate, emptyForm, normalizeForm, toNumberOrNull } from '../src/lib/formRules.js'
import { checkLesson, shortfalls, parseQuantity, objectivesMatch } from '../shared/validate.js'
import { findInDocument, documentLines } from '../shared/curriculum.js'
import { validateLessonShape } from '../server/grok.js'
import { buildLessonWithRebuilds, MAX_REBUILDS } from '../server/rebuild.js'
import {
  fitActivitiesToBudget,
  fitLessonToBudget,
  totalMinutes,
} from '../server/timing.js'
import { runCheck } from '../server/check.js'
import {
  addRecord,
  findRecord,
  isReusable,
  makeRecord,
  outcomeLabel,
  removeRecord,
  updateRecord,
} from '../src/lib/bank.js'
import {
  describeOffer,
  findReusableActivity,
  lessonUsesActivity,
  objectiveOverlap,
  shelfCovers,
  withinBand,
} from '../src/lib/reuse.js'
import {
  CARD_KIND,
  cardFileName,
  makeCard,
  parseCard,
} from '../src/lib/lessonCard.js'
import {
  browserStorage,
  clearStore,
  formFromShelf,
  isEmptyShelf,
  readStore,
  shelfFromForm,
  STORE_KEYS,
  writeStore,
} from '../src/lib/store.js'
import {
  exampleLesson,
  exampleInventory,
  exampleForm,
} from '../server/fixtures/exampleLesson.js'
import { checkLocally } from '../src/lib/localCheck.js'

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

// A stand-in for the browser's local storage, so the store's rules can be
// checked without a browser.
function fakeStorage(initial = {}) {
  const data = { ...initial }
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = String(value)
    },
    removeItem: (key) => {
      delete data[key]
    },
  }
}

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

section('The shelf on the teacher\'s own machine')
check('a shelf that is written comes back the same', () => {
  const storage = fakeStorage()
  const shelf = shelfFromForm({
    ...emptyForm(),
    grade: 'Primary 6',
    subject: 'Mathematics',
    topic: 'Ratios',
    curriculumObjective: 'Represent ratios',
    classSize: '40',
    durationMinutes: '35',
    constraints: 'No internet',
    materials: [{ id: 'material-1', name: 'bottle tops', quantity: '40' }],
  })
  assert.equal(writeStore(storage, STORE_KEYS.shelf, shelf), true)
  assert.deepEqual(readStore(storage, STORE_KEYS.shelf), shelf)
})
check('the classroom comes back the way the teacher left it', () => {
  const storage = fakeStorage()
  writeStore(
    storage,
    STORE_KEYS.shelf,
    shelfFromForm({
      ...emptyForm(),
      grade: 'Primary 6',
      topic: 'Understand and represent ratios',
      curriculumObjective: 'Represent and compare ratios',
      classSize: '40',
      durationMinutes: '35',
      materials: [{ id: 'material-1', name: 'bottle tops', quantity: '40' }],
    }),
  )
  const form = formFromShelf(readStore(storage, STORE_KEYS.shelf))
  assert.equal(form.grade, 'Primary 6')
  assert.equal(form.topic, 'Understand and represent ratios')
  assert.equal(form.curriculumObjective, 'Represent and compare ratios')
  assert.equal(form.classSize, '40')
  assert.equal(form.durationMinutes, '35')
  assert.equal(form.materials.length, 1)
  assert.equal(form.materials[0].name, 'bottle tops')
  assert.equal(form.materials[0].quantity, '40')
})
check('material rows come back with ids, because the page needs them', () => {
  const form = formFromShelf({
    materials: [{ name: 'beans', quantity: 'a bag' }],
  })
  assert.ok(form.materials[0].id)
  assert.ok(form.materials[0].id !== form.materials[1]?.id)
})
check('a row the teacher started and abandoned is not remembered', () => {
  const shelf = shelfFromForm({
    ...emptyForm(),
    topic: 'Ratios',
    materials: [
      { id: 'material-1', name: 'bottle tops', quantity: '40' },
      { id: 'material-2', name: '   ', quantity: '3' },
    ],
  })
  assert.equal(shelf.materials.length, 1)
  const form = formFromShelf(shelf)
  assert.equal(form.materials.length, 1)
})
check('a shelf that is broken falls back to empty instead of breaking the page', () => {
  const storage = fakeStorage({ [STORE_KEYS.shelf]: 'not json at all' })
  assert.equal(readStore(storage, STORE_KEYS.shelf, null), null)
  const form = formFromShelf(readStore(storage, STORE_KEYS.shelf))
  assert.deepEqual(form, emptyForm())
})
check('a shelf written by another version of Village is ignored', () => {
  const storage = fakeStorage({
    [STORE_KEYS.shelf]: JSON.stringify({ version: 99, value: { grade: 'Old' } }),
  })
  assert.equal(readStore(storage, STORE_KEYS.shelf, null), null)
})
check('no storage at all is not a crash', () => {
  assert.equal(writeStore(null, STORE_KEYS.shelf, { grade: 'Primary 6' }), false)
  assert.equal(readStore(null, STORE_KEYS.shelf, 'fallback'), 'fallback')
  assert.equal(clearStore(null, STORE_KEYS.shelf), false)
})
check('forgetting the classroom clears it', () => {
  const storage = fakeStorage()
  writeStore(storage, STORE_KEYS.shelf, shelfFromForm({ ...emptyForm(), topic: 'Ratios' }))
  assert.equal(clearStore(storage, STORE_KEYS.shelf), true)
  assert.equal(readStore(storage, STORE_KEYS.shelf, null), null)
})
check('an empty classroom is recognised as empty', () => {
  assert.equal(isEmptyShelf(null), true)
  assert.equal(isEmptyShelf({ materials: [] }), true)
  assert.equal(isEmptyShelf({ materials: [{ name: '', quantity: '' }] }), true)
  assert.equal(isEmptyShelf({ materials: [{ name: 'beans', quantity: 'a bag' }] }), false)
  assert.equal(isEmptyShelf({ topic: 'Ratios' }), false)
})
check('the store has no browser outside a browser', () => {
  assert.equal(browserStorage(), null)
})

section('The classroom\'s record')
check('a banked lesson keeps the classroom it was taught in', () => {
  const record = makeRecord({
    lesson: exampleLesson,
    form: exampleForm,
    outcome: 'worked',
    note: 'the bean jars were the hit',
    id: 'record-1',
    date: '2026-10-20T09:00:00.000Z',
  })
  assert.equal(record.title, exampleLesson.title)
  assert.equal(record.classSize, exampleForm.classSize)
  assert.equal(record.durationMinutes, exampleForm.durationMinutes)
  assert.equal(record.materials.length, exampleForm.materials.length)
  assert.equal(record.materials[0].name, 'bottle tops')
  assert.equal(record.note, 'the bean jars were the hit')
  assert.equal(outcomeLabel(record.outcome), 'Worked')
})
check('a lesson the teacher taught and says worked is proved', () => {
  const record = makeRecord({
    lesson: exampleLesson,
    form: exampleForm,
    outcome: 'worked',
  })
  assert.equal(isReusable(record), true)
})
check('a lesson that needed changes is never reused', () => {
  const record = makeRecord({
    lesson: exampleLesson,
    form: exampleForm,
    outcome: 'changes',
  })
  assert.equal(isReusable(record), false)
})
check('a lesson that did not work is never reused', () => {
  const record = makeRecord({
    lesson: exampleLesson,
    form: exampleForm,
    outcome: 'failed',
  })
  assert.equal(isReusable(record), false)
})
check('a lesson from a colleague is a candidate, not a claim', () => {
  const record = makeRecord({
    lesson: exampleLesson,
    form: exampleForm,
    outcome: '',
    source: 'colleague',
  })
  assert.equal(record.verified, false)
  assert.equal(isReusable(record), false)

  // It becomes reusable only once this teacher has taught it and said so.
  const proved = updateRecord([record], record.id, {
    outcome: 'worked',
    verified: true,
  })
  assert.equal(isReusable(findRecord(proved, record.id)), true)
})
check('the record keeps the newest lesson first', () => {
  const first = makeRecord({ lesson: exampleLesson, form: exampleForm, outcome: 'worked' })
  const second = makeRecord({ lesson: exampleLesson, form: exampleForm, outcome: 'worked' })
  const bank = addRecord(addRecord([], first), second)
  assert.equal(bank.length, 2)
  assert.equal(bank[0].id, second.id)
  assert.equal(findRecord(bank, first.id).id, first.id)
})
check('a record can be changed or taken out', () => {
  const record = makeRecord({ lesson: exampleLesson, form: exampleForm, outcome: 'failed' })
  const bank = addRecord([], record)
  const changed = updateRecord(bank, record.id, { outcome: 'worked', verified: true })
  assert.equal(isReusable(findRecord(changed, record.id)), true)
  assert.equal(removeRecord(changed, record.id).length, 0)
})
check('the record is kept on the device like everything else', () => {
  const storage = fakeStorage()
  const record = makeRecord({ lesson: exampleLesson, form: exampleForm, outcome: 'worked' })
  writeStore(storage, STORE_KEYS.bank, [record])
  const bank = readStore(storage, STORE_KEYS.bank, [])
  assert.equal(bank.length, 1)
  assert.equal(bank[0].outcome, 'worked')
})

section('Planning the next lesson around what worked')
check('an activity that worked in this classroom is offered again', () => {
  const record = makeRecord({
    lesson: exampleLesson,
    form: exampleForm,
    outcome: 'worked',
    id: 'record-1',
    date: '2026-10-20T09:00:00.000Z',
  })
  const offer = findReusableActivity([record], exampleForm)
  assert.ok(offer, 'nothing was offered')
  assert.equal(offer.record.id, 'record-1')
  assert.equal(offer.activity.name, 'Sharing in equal groups')
})
check('a lesson that did not work is never offered again', () => {
  const record = makeRecord({
    lesson: exampleLesson,
    form: exampleForm,
    outcome: 'failed',
  })
  assert.equal(findReusableActivity([record], exampleForm), null)
})
check('a lesson that was never judged is never offered again', () => {
  const record = makeRecord({
    lesson: exampleLesson,
    form: exampleForm,
    outcome: 'changes',
  })
  assert.equal(findReusableActivity([record], exampleForm), null)
})
check('an activity whose materials are not on the shelf now is not offered', () => {
  const record = makeRecord({
    lesson: exampleLesson,
    form: exampleForm,
    outcome: 'worked',
  })
  const emptyShelf = { ...exampleForm, materials: [] }
  assert.equal(findReusableActivity([record], emptyShelf), null)
})
check('an activity that needs something the shelf no longer has is skipped', () => {
  const record = makeRecord({
    lesson: exampleLesson,
    form: exampleForm,
    outcome: 'worked',
  })
  // The shelf has chalk and the blackboard, but no bottle tops and no cups.
  const shelf = {
    ...exampleForm,
    materials: [
      { name: 'chalk', quantity: '1' },
      { name: 'blackboard', quantity: '1' },
    ],
  }
  const offer = findReusableActivity([record], shelf)
  assert.ok(offer, 'nothing was offered')
  assert.equal(offer.activity.name, 'Writing ratios down')
})
check('an activity from a much bigger class is not offered', () => {
  const record = makeRecord({
    lesson: exampleLesson,
    form: { ...exampleForm, classSize: 90 },
    outcome: 'worked',
  })
  assert.equal(findReusableActivity([record], exampleForm), null)
})
check('an activity from a different subject is not offered', () => {
  const record = makeRecord({
    lesson: exampleLesson,
    form: { ...exampleForm, subject: 'Science' },
    outcome: 'worked',
  })
  assert.equal(findReusableActivity([record], exampleForm), null)
})
check('an activity that would leave no room in the lesson is not offered', () => {
  const record = makeRecord({
    lesson: exampleLesson,
    form: { ...exampleForm, durationMinutes: 10 },
    outcome: 'worked',
  })
  const shortLesson = { ...exampleForm, durationMinutes: 8 }
  assert.equal(findReusableActivity([record], shortLesson), null)
})
check('a new objective does not rule the activity out — it only ranks it', () => {
  const record = makeRecord({
    lesson: exampleLesson,
    form: exampleForm,
    outcome: 'worked',
  })
  const nextLesson = {
    ...exampleForm,
    topic: 'Understand and compare fractions',
    learningObjective: 'Understand and compare fractions',
    curriculumObjective:
      'By the end of the lesson, learners should be able to compare and order fractions with the same denominator.',
  }
  const offer = findReusableActivity([record], nextLesson)
  assert.ok(offer, 'nothing was offered for the new topic')
})
check('the newest proved lesson wins when two are equally good', () => {
  const older = makeRecord({
    lesson: exampleLesson,
    form: exampleForm,
    outcome: 'worked',
    id: 'older',
    date: '2026-10-01T09:00:00.000Z',
  })
  const newer = makeRecord({
    lesson: exampleLesson,
    form: exampleForm,
    outcome: 'worked',
    id: 'newer',
    date: '2026-10-20T09:00:00.000Z',
  })
  const offer = findReusableActivity([older, newer], exampleForm)
  assert.equal(offer.record.id, 'newer')
})
check('the offer says what to aim at, and where it came from', () => {
  const record = makeRecord({
    lesson: exampleLesson,
    form: exampleForm,
    outcome: 'worked',
    id: 'record-1',
    date: '2026-10-20T09:00:00.000Z',
  })
  const offer = findReusableActivity([record], exampleForm)
  const described = describeOffer(offer)
  assert.equal(described.name, 'Sharing in equal groups')
  assert.equal(described.durationMinutes, 6)
  assert.equal(described.materials[0].name, 'bottle tops')
  assert.equal(described.from.title, exampleLesson.title)
  assert.equal(described.from.classSize, 40)
})
check('Village checks whether the lesson really used the activity', () => {
  const record = makeRecord({
    lesson: exampleLesson,
    form: exampleForm,
    outcome: 'worked',
  })
  const offer = findReusableActivity([record], exampleForm)
  assert.equal(lessonUsesActivity(exampleLesson, offer), true)
  const otherLesson = {
    ...exampleLesson,
    activities: [
      { ...exampleLesson.activities[0], name: 'Something else entirely' },
      ...exampleLesson.activities.slice(1),
    ],
  }
  assert.equal(lessonUsesActivity(otherLesson, offer), false)
})
check('the shelf has to cover what the activity needs', () => {
  assert.equal(
    shelfCovers([{ name: 'bottle tops' }], ['bottle tops']),
    true,
  )
  assert.equal(
    shelfCovers([{ name: 'Bottle Tops' }], ['bottle tops']),
    true,
  )
  assert.equal(shelfCovers([{ name: 'beans' }], ['bottle tops']), false)
})
check('a band is about the same, and an unknown number rules nothing out', () => {
  assert.equal(withinBand(40, 40, 0.25), true)
  assert.equal(withinBand(40, 45, 0.25), true)
  assert.equal(withinBand(40, 90, 0.25), false)
  assert.equal(withinBand(null, 40, 0.25), true)
})
check('two objectives can be about the same thing', () => {
  assert.ok(
    objectiveOverlap(
      'Represent and compare ratios using equivalent forms',
      'By the end of the lesson, learners should be able to represent and compare ratios.',
    ) > 0.4,
  )
  assert.equal(
    objectiveOverlap('Represent and compare ratios', 'Convert fractions into decimals'),
    0,
  )
})

section('A lesson card that travels')
check('a lesson card carries the lesson and the classroom it was taught in', () => {
  const record = makeRecord({
    lesson: exampleLesson,
    form: exampleForm,
    outcome: 'worked',
    note: 'the bean jars were the hit',
    id: 'record-1',
    date: '2026-10-20T09:00:00.000Z',
  })
  const card = makeCard(record)
  assert.equal(card.kind, CARD_KIND)
  assert.equal(card.title, exampleLesson.title)
  assert.equal(card.classSize, 40)
  assert.equal(card.durationMinutes, 35)
  assert.equal(card.materials.length, exampleInventory.length)
  assert.equal(card.lesson.activities.length, exampleLesson.activities.length)
})
check('a lesson card survives the trip unchanged', () => {
  const record = makeRecord({
    lesson: exampleLesson,
    form: exampleForm,
    outcome: 'worked',
  })
  const card = makeCard(record)
  const parsed = parseCard(JSON.stringify(card))
  assert.equal(parsed.ok, true)
  assert.equal(parsed.card.title, card.title)
  assert.deepEqual(parsed.card.lesson, card.lesson)
  assert.equal(parsed.card.materials.length, card.materials.length)
})
check('a file that is not a lesson card is refused', () => {
  const parsed = parseCard(JSON.stringify({ hello: 'world' }))
  assert.equal(parsed.ok, false)
  assert.match(parsed.error, /not a Village lesson card/)
})
check('a file that is not JSON at all is refused', () => {
  const parsed = parseCard('this is not json')
  assert.equal(parsed.ok, false)
  assert.match(parsed.error, /could not be read/)
})
check('a lesson card with no activities is refused', () => {
  const card = makeCard(
    makeRecord({ lesson: exampleLesson, form: exampleForm, outcome: 'worked' }),
  )
  const broken = { ...card, lesson: { ...card.lesson, activities: [] } }
  const parsed = parseCard(JSON.stringify(broken))
  assert.equal(parsed.ok, false)
  assert.match(parsed.error, /no activities/)
})
check('a lesson card from another version is refused', () => {
  const card = makeCard(
    makeRecord({ lesson: exampleLesson, form: exampleForm, outcome: 'worked' }),
  )
  const parsed = parseCard(JSON.stringify({ ...card, version: 99 }))
  assert.equal(parsed.ok, false)
  assert.match(parsed.error, /different version/)
})
check('an imported lesson is a candidate until this classroom proves it', () => {
  const card = makeCard(
    makeRecord({ lesson: exampleLesson, form: exampleForm, outcome: 'worked' }),
  )
  const imported = makeRecord({
    lesson: card.lesson,
    form: { ...exampleForm, curriculumObjective: '' },
    outcome: '',
    source: 'colleague',
    verified: false,
  })
  assert.equal(isReusable(imported), false)
  assert.equal(findReusableActivity([imported], exampleForm), null)

  // Once this teacher has taught it and says so, it belongs to this room.
  const proved = updateRecord([imported], imported.id, {
    outcome: 'worked',
    verified: true,
  })
  assert.equal(isReusable(findRecord(proved, imported.id)), true)
})
check('the file name is one a teacher would recognise', () => {
  assert.equal(cardFileName('Understanding and comparing ratios'), 'understanding-and-comparing-ratios.village.json')
  assert.equal(cardFileName(''), 'lesson.village.json')
})

section('The curriculum check, grounded in the teacher\'s own document')
const CURRICULUM_DOCUMENT = `Mathematics — Number — Ratios
Represent and compare ratios using equivalent forms, including word problems.
Fractions: compare and order fractions with the same denominator.
Measurement: convert between millimetres and centimetres.`

check('the objective is found in the document, and the line is quoted back', () => {
  const found = findInDocument(
    'By the end of the lesson, learners should be able to represent and compare ratios using equivalent forms.',
    CURRICULUM_DOCUMENT,
  )
  assert.equal(found.found, true)
  assert.match(found.line, /Represent and compare ratios/)
  assert.equal(found.lineNumber, 2)
})
check('a document that does not cover the objective is not matched', () => {
  const found = findInDocument(
    'Explain how sound is produced by vibrating objects',
    CURRICULUM_DOCUMENT,
  )
  assert.equal(found.found, false)
  assert.equal(found.reason, 'not-found')
})
check('an empty document says so rather than pretending', () => {
  assert.equal(findInDocument('Represent ratios', '').found, false)
  assert.equal(findInDocument('Represent ratios', '   \n  ').reason, 'no-document')
})
check('the document lines are read one line at a time', () => {
  const lines = documentLines(CURRICULUM_DOCUMENT)
  assert.equal(lines.length, 4)
  assert.equal(lines[0], 'Mathematics — Number — Ratios')
})
check('with a document, the curriculum row quotes it', () => {
  const result = checkLesson(exampleLesson, {
    ...exampleForm,
    curriculumDocument: CURRICULUM_DOCUMENT,
  })
  assert.equal(result.checks.curriculum.status, 'ok')
  assert.match(result.checks.curriculum.detail, /Your curriculum document says/)
  assert.match(result.checks.curriculum.detail, /Represent and compare ratios/)
})
check('with a document, the document decides — not the model\'s own claim', () => {
  // The model says it could not verify the match; the document settles it.
  const lesson = { ...exampleLesson, curriculumConfidence: 'unverified' }
  const result = checkLesson(lesson, {
    ...exampleForm,
    curriculumDocument: CURRICULUM_DOCUMENT,
  })
  assert.equal(result.checks.curriculum.status, 'ok')
  assert.match(result.checks.curriculum.detail, /Represent and compare ratios/)
})
check('a document that does not cover the objective is reported, not passed', () => {
  const result = checkLesson(exampleLesson, {
    ...exampleForm,
    curriculumDocument: 'Music — Performance — Rhythm and pulse.',
  })
  assert.equal(result.checks.curriculum.status, 'fail')
  assert.match(result.checks.curriculum.detail, /could not find that objective/)
})
check('without a document the row still says it is unverified', () => {
  const result = checkLesson(exampleLesson, exampleForm)
  assert.match(result.checks.curriculum.detail, /has not checked it against your curriculum document/)
})
check('no objective and no document is still a failure', () => {
  const result = checkLesson(exampleLesson, {
    ...exampleForm,
    curriculumObjective: '',
    curriculumDocument: CURRICULUM_DOCUMENT,
  })
  assert.equal(result.checks.curriculum.status, 'fail')
  assert.match(result.checks.curriculum.detail, /No curriculum objective/)
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
check('a material the model called singular is the material the teacher owns', () => {
  // The model writes "measuring cup", the teacher's list says "measuring
  // cups". That is the same cup, not a missing one — and it must not send
  // the rebuild loop after a lesson that was already right.
  const lesson = {
    ...exampleLesson,
    activities: [
      {
        ...exampleLesson.activities[0],
        materials: [{ name: 'measuring cup', quantityNeeded: '2' }],
      },
    ],
  }
  const result = checkLesson(lesson, exampleForm)
  const row = result.checks.materials.find((r) => r.name === 'measuring cup')
  assert.equal(row.status, 'ok')
  assert.equal(row.detail.includes('not on your list'), false)
})
check('a material named the way a teacher would say it is still that material', () => {
  const lesson = {
    ...exampleLesson,
    activities: [
      {
        ...exampleLesson.activities[0],
        materials: [{ name: 'a handful of beans', quantityNeeded: 'a handful' }],
      },
    ],
  }
  const result = checkLesson(lesson, exampleForm)
  const row = result.checks.materials.find((r) => r.name === 'a handful of beans')
  assert.equal(row.status, 'quantity-unverified')
})
check('a material the teacher really does not have is still flagged', () => {
  // The matching must not get so generous that a missing material passes.
  const lesson = {
    ...exampleLesson,
    activities: [
      {
        ...exampleLesson.activities[0],
        materials: [{ name: 'marker pens', quantityNeeded: '8' }],
      },
    ],
  }
  const result = checkLesson(lesson, exampleForm)
  const row = result.checks.materials.find((r) => r.name === 'marker pens')
  assert.equal(row.status, 'missing')
})
check('a shortage is still a shortage when the wording differs', () => {
  const lesson = {
    ...exampleLesson,
    activities: [
      {
        ...exampleLesson.activities[0],
        materials: [{ name: 'measuring cup', quantityNeeded: '8' }],
      },
    ],
  }
  const form = {
    ...exampleForm,
    materials: exampleInventory.map((m) =>
      m.name === 'measuring cups' ? { ...m, quantity: '2' } : m,
    ),
  }
  const result = checkLesson(lesson, form)
  const row = result.checks.materials.find((r) => r.name === 'measuring cup')
  assert.equal(row.status, 'short')
  assert.equal(row.shortBy, 6)
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
check('an assessment that uses its own verbs still counts', () => {
  // "representing" is not "represent", and "comparing" is not "compare" —
  // without the four-letter rule this assessment would be called a mismatch.
  const lesson = {
    ...exampleLesson,
    assessment: {
      ...exampleLesson.assessment,
      servesObjective:
        'Comparing and representing ratios in a short written task.',
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

section('Fitting the timings in code')
check('forty minutes of activity are fitted onto a thirty-five minute lesson', () => {
  const activities = [10, 10, 10, 10].map((minutes) => ({ durationMinutes: minutes }))
  const result = fitActivitiesToBudget(activities, 35)
  assert.equal(result.fitted, true)
  assert.equal(result.before, 40)
  assert.equal(result.after, 35)
  assert.equal(totalMinutes(result.activities), 35)
})
check('the activities keep their order and their number', () => {
  const activities = [
    { name: 'Warm-up', durationMinutes: 10 },
    { name: 'Main activity', durationMinutes: 12 },
    { name: 'Practice', durationMinutes: 10 },
    { name: 'Consolidation', durationMinutes: 8 },
  ]
  const result = fitActivitiesToBudget(activities, 35)
  assert.equal(result.activities.length, 4)
  assert.deepEqual(
    result.activities.map((activity) => activity.name),
    ['Warm-up', 'Main activity', 'Practice', 'Consolidation'],
  )
})
check('a lesson that already fits is left exactly as it is', () => {
  const activities = [{ durationMinutes: 10 }, { durationMinutes: 15 }, { durationMinutes: 10 }]
  const result = fitActivitiesToBudget(activities, 35)
  assert.equal(result.fitted, false)
  assert.equal(result.reason, 'already-fits')
  assert.equal(result.activities[1].durationMinutes, 15)
})
check('a lesson within the tolerance is left alone too', () => {
  const activities = [{ durationMinutes: 17 }, { durationMinutes: 16 }]
  const result = fitActivitiesToBudget(activities, 35)
  assert.equal(result.fitted, false)
  assert.equal(result.after, 33)
})
check('one activity gets the whole lesson', () => {
  const result = fitActivitiesToBudget([{ durationMinutes: 40 }], 35)
  assert.equal(result.fitted, true)
  assert.equal(result.activities[0].durationMinutes, 35)
})
check('no activity is squeezed out to nothing', () => {
  const activities = [
    { durationMinutes: 30 },
    { durationMinutes: 1 },
    { durationMinutes: 1 },
    { durationMinutes: 1 },
  ]
  const result = fitActivitiesToBudget(activities, 20)
  assert.equal(result.fitted, true)
  assert.equal(totalMinutes(result.activities), 20)
  for (const activity of result.activities) {
    assert.ok(activity.durationMinutes >= 1)
  }
})
check('a lesson too short to fit is left alone, not mangled', () => {
  const activities = [{ durationMinutes: 10 }, { durationMinutes: 10 }, { durationMinutes: 10 }]
  const result = fitActivitiesToBudget(activities, 2)
  assert.equal(result.fitted, false)
  assert.equal(result.reason, 'too-short')
})
check('a lesson with no length given is left alone', () => {
  const activities = [{ durationMinutes: 10 }]
  const result = fitActivitiesToBudget(activities, null)
  assert.equal(result.fitted, false)
  assert.equal(result.reason, 'no-budget')
})
check('the whole lesson is fitted, and the change is reported', () => {
  const result = fitLessonToBudget(
    {
      title: 'A lesson',
      activities: [
        { name: 'One', durationMinutes: 10 },
        { name: 'Two', durationMinutes: 10 },
        { name: 'Three', durationMinutes: 10 },
        { name: 'Four', durationMinutes: 10 },
      ],
    },
    35,
  )
  assert.equal(result.fitted, true)
  assert.equal(result.before, 40)
  assert.equal(result.after, 35)
  assert.equal(totalMinutes(result.lesson.activities), 35)
  assert.equal(result.lesson.title, 'A lesson')
})
await acheck('the lesson that comes back fits the lesson, without the model knowing', async () => {
  const { lesson, feasibility } = await buildLessonWithRebuilds(countableForm, {
    generate: async () => ({
      ...countableLesson,
      activities: countableLesson.activities.map((activity) => ({
        ...activity,
        durationMinutes: activity.durationMinutes + 5,
      })),
    }),
    rebuild: async (current) => current,
  })
  assert.equal(totalMinutes(lesson.activities), 35)
  assert.equal(feasibility.checks.timing.status, 'ok')
  assert.equal(feasibility.timingFitted.fitted, true)
  assert.equal(feasibility.timingFitted.before, 55)
  assert.equal(feasibility.timingFitted.after, 35)
})

section('One kernel, two sides')
check('the checker the browser runs is the checker the server runs', () => {
  const fromServer = checkLesson(exampleLesson, exampleForm)
  const fromBrowser = checkLocally(exampleLesson, exampleForm).feasibility
  assert.deepEqual(fromBrowser, fromServer)
})
check('the server endpoint agrees with the kernel', () => {
  const fromEndpoint = runCheck({ lesson: exampleLesson, form: exampleForm })
    .feasibility
  assert.deepEqual(fromEndpoint, checkLesson(exampleLesson, exampleForm))
})
check('the kernel needs no network, no model and no server-only code', () => {
  // The file the browser imports is the file the server imports. Nothing in
  // it may reach for Node, so a teacher with no internet still gets a check.
  const source = readFileSync(new URL('../shared/validate.js', import.meta.url), 'utf8')
  assert.equal(/from ['"]node:/.test(source), false)
  assert.equal(/require\(/.test(source), false)
  assert.equal(/process\./.test(source), false)
})

section('Re-checking an edited lesson')
check('an edited lesson is checked, not written again', () => {
  const result = runCheck({ lesson: countableLesson, form: countableForm })
  assert.equal(result.feasibility.verdict, 'ready')
  assert.deepEqual(Object.keys(result), ['feasibility'])
})
check('an edit that asks for something the teacher does not have is caught', () => {
  const edited = {
    ...countableLesson,
    activities: countableLesson.activities.map((activity, index) =>
      index === 0
        ? {
            ...activity,
            materials: [
              ...activity.materials,
              { name: 'marker pens', quantityNeeded: '2' },
            ],
          }
        : activity,
    ),
  }
  const result = runCheck({ lesson: edited, form: countableForm })
  assert.equal(result.feasibility.verdict, 'attention')
  const row = result.feasibility.checks.materials.find(
    (r) => r.name === 'marker pens',
  )
  assert.equal(row.status, 'missing')
  assert.match(row.detail, /not on your list/)
})
check('an edit that asks for more than the teacher has is caught', () => {
  const edited = {
    ...countableLesson,
    activities: countableLesson.activities.map((activity, index) =>
      index === 0
        ? {
            ...activity,
            materials: activity.materials.map((material) =>
              material.name === 'bottle tops'
                ? { ...material, quantityNeeded: '400' }
                : material,
            ),
          }
        : activity,
    ),
  }
  const result = runCheck({ lesson: edited, form: countableForm })
  assert.equal(result.feasibility.verdict, 'attention')
  const row = result.feasibility.checks.materials.find((r) => r.name === 'bottle tops')
  assert.equal(row.status, 'short')
  assert.equal(row.shortBy, 360)
})
check('a request with no lesson at all is refused', () => {
  assert.throws(() => runCheck({ form: countableForm }), /no lesson to check/)
})

console.log(`\n${passed} passed, ${failures.length} failed`)
if (failures.length > 0) {
  process.exitCode = 1
}