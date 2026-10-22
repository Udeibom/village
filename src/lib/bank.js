// The classroom's own record.
//
// A bank entry is a lesson the teacher has actually taught, the classroom it
// was taught in, and what happened. It is the only memory Village has, and it
// lives on the teacher's own device.
//
// Nothing is ever seeded. A bank with nothing in it is the honest state of a
// classroom where no lesson has been taught yet.

export const OUTCOMES = [
  {
    id: 'worked',
    label: 'Worked',
    hint: 'It ran as planned.',
  },
  {
    id: 'changes',
    label: 'Needed changes',
    hint: 'It nearly ran. Say what was missing.',
  },
  {
    id: 'failed',
    label: "Didn't work",
    hint: 'It did not run. Village will not reuse this.',
  },
]

export function outcomeLabel(id) {
  const found = OUTCOMES.find((outcome) => outcome.id === id)
  return found ? found.label : 'Unknown'
}

function text(value) {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function numberOrNull(value) {
  const trimmed = text(value)
  if (trimmed === '') return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

function materialsOf(form) {
  const materials = Array.isArray(form?.materials) ? form.materials : []
  return materials
    .filter((material) => material && text(material.name) !== '')
    .map((material) => ({
      name: text(material.name),
      quantity: text(material.quantity),
    }))
}

// The record of one lesson, as it is kept.
export function makeRecord({
  lesson,
  form,
  outcome,
  note = '',
  source = 'own',
  verified = null,
  id = null,
  date = null,
} = {}) {
  const objective = text(form?.curriculumObjective) || text(form?.learningObjective)
  // A lesson counts as proved once the teacher has taught it and said it
  // worked. A lesson from a colleague starts as a candidate, not a claim.
  const proven =
    verified === null
      ? text(outcome) === 'worked' && source === 'own'
      : Boolean(verified)

  return {
    id: id || `record-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    date: date || new Date().toISOString(),
    outcome: text(outcome),
    note: text(note),
    source,
    verified: proven,
    title: text(lesson?.title) || 'Untitled lesson',
    topic: text(form?.topic),
    objective,
    grade: text(form?.grade),
    subject: text(form?.subject),
    classSize: numberOrNull(form?.classSize),
    durationMinutes: numberOrNull(form?.durationMinutes),
    materials: materialsOf(form),
    lesson: lesson || null,
  }
}

// The bank, newest first.
export function addRecord(bank, record) {
  const list = Array.isArray(bank) ? bank : []
  return [record, ...list]
}

export function findRecord(bank, id) {
  const list = Array.isArray(bank) ? bank : []
  return list.find((record) => record && record.id === id) || null
}

export function updateRecord(bank, id, changes) {
  const list = Array.isArray(bank) ? bank : []
  return list.map((record) =>
    record && record.id === id ? { ...record, ...changes } : record,
  )
}

export function removeRecord(bank, id) {
  const list = Array.isArray(bank) ? bank : []
  return list.filter((record) => !record || record.id !== id)
}

// The only entries that may be reused in a new lesson: the teacher taught it,
// it worked, and it was proved in this classroom.
export function isReusable(record) {
  if (!record) return false
  if (record.outcome !== 'worked') return false
  return record.verified === true
}

export function formatDate(iso) {
  if (!iso) return ''
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
