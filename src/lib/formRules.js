// Rules that decide what the teacher can do, kept as plain functions so they
// can be tested without a browser.

export function emptyForm() {
  return {
    grade: '',
    subject: '',
    topic: '',
    learningObjective: '',
    curriculumObjective: '',
    classSize: '',
    durationMinutes: '',
    constraints: '',
    materials: [],
  }
}

function text(value) {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

// Generate stays disabled until the curriculum objective and at least one
// material exist. Nothing else is required.
export function canGenerate(form) {
  if (!form) return false
  if (!text(form.curriculumObjective)) return false
  const materials = Array.isArray(form.materials) ? form.materials : []
  return materials.some((material) => text(material && material.name) !== '')
}

export function toNumberOrNull(value) {
  const trimmed = text(value)
  if (trimmed === '') return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

// The payload the server receives: no client-only row ids, numbers where a
// number makes sense, and blank material rows dropped.
export function normalizeForm(form) {
  const source = form || emptyForm()
  const topic = text(source.topic)
  const learningObjective = text(source.learningObjective) || topic
  const materials = Array.isArray(source.materials) ? source.materials : []

  return {
    grade: text(source.grade),
    subject: text(source.subject),
    topic,
    learningObjective,
    curriculumObjective: text(source.curriculumObjective),
    classSize: toNumberOrNull(source.classSize),
    durationMinutes: toNumberOrNull(source.durationMinutes),
    constraints: text(source.constraints),
    materials: materials
      .filter((material) => text(material && material.name) !== '')
      .map((material) => ({
        name: text(material.name),
        quantity: text(material.quantity),
      })),
  }
}
