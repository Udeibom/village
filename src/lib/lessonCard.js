// A lesson card: one small file a teacher can hand to a colleague.
//
// The card carries the lesson and the classroom it was taught in. It does not
// carry the colleague's name, their school or anything else — and an imported
// card is a candidate, not a claim: it is not proved in the new classroom
// until the teacher there has taught it and said so.

export const CARD_KIND = 'village-lesson-card'
export const CARD_VERSION = 1

function text(value) {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

export function makeCard(record) {
  const source = record || {}
  const lesson = source.lesson || {}
  return {
    kind: CARD_KIND,
    version: CARD_VERSION,
    title: text(source.title) || text(lesson.title) || 'Untitled lesson',
    date: source.date || null,
    outcome: text(source.outcome),
    note: text(source.note),
    classSize: source.classSize === undefined ? null : source.classSize,
    durationMinutes:
      source.durationMinutes === undefined ? null : source.durationMinutes,
    materials: Array.isArray(source.materials) ? source.materials : [],
    lesson,
  }
}

// Reads a card strictly. Anything that is not a Village lesson card is
// refused with a plain reason — never half-loaded.
export function parseCard(raw) {
  let data = null
  try {
    data = JSON.parse(typeof raw === 'string' ? raw : String(raw))
  } catch {
    return { ok: false, error: 'That file could not be read. Give Village a .json lesson card.' }
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, error: 'That file is not a Village lesson card.' }
  }
  if (data.kind !== CARD_KIND) {
    return { ok: false, error: 'That file is not a Village lesson card.' }
  }
  if (data.version !== CARD_VERSION) {
    return { ok: false, error: 'That lesson card is from a different version of Village.' }
  }

  const lesson = data.lesson
  if (!lesson || typeof lesson !== 'object') {
    return { ok: false, error: 'That lesson card has no lesson in it.' }
  }
  if (text(lesson.title) === '') {
    return { ok: false, error: 'That lesson card has no lesson title.' }
  }
  if (!Array.isArray(lesson.activities) || lesson.activities.length === 0) {
    return { ok: false, error: 'That lesson card has no activities in it.' }
  }
  const nameless = lesson.activities.some(
    (activity) => !activity || typeof activity !== 'object' || text(activity.name) === '',
  )
  if (nameless) {
    return { ok: false, error: 'That lesson card has an activity with no name.' }
  }

  return { ok: true, card: data }
}

// A file name a teacher can recognise in their downloads folder.
export function cardFileName(title) {
  const words = text(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${words || 'lesson'}.village.json`
}

// Hands the card to the browser as a download. Only ever called in a browser.
export function downloadCard(card, filename) {
  if (typeof document === 'undefined') return false
  try {
    const blob = new Blob([JSON.stringify(card, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setTimeout(() => URL.revokeObjectURL(url), 2000)
    return true
  } catch {
    return false
  }
}
