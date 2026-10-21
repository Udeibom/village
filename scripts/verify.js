// Mechanical checks on the pure logic — the parts with no AI and no browser in
// them. Plain node assertions, no test framework.
//
//   npm run verify

import assert from 'node:assert/strict'
import { canGenerate, emptyForm, normalizeForm, toNumberOrNull } from '../src/lib/formRules.js'

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

function section(title) {
  console.log(`\n${title}`)
}

console.log('Village — verify\n')

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

console.log(`\n${passed} passed, ${failures.length} failed`)
if (failures.length > 0) {
  process.exitCode = 1
}
