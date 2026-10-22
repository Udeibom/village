// Choosing what to reuse, in code, out of this classroom's own record.
//
// The claim Village makes — "this worked in your room" — is only worth
// anything if it is true, so the rules here are deliberately strict. An
// activity is offered only when:
//
//   - the teacher taught it here and said it worked
//   - every material it needs is on the shelf right now
//   - the class is about the same size as it was then
//   - the lesson is about the same length as it was then
//   - the activity leaves room in the lesson for the rest of the teaching
//   - it is the same subject and the same year group
//
// The objective is used to rank the candidates, not to rule them out: an
// activity that worked once is worth pointing at a new objective. Nothing
// here asks the model anything — the choice is made by arithmetic, and the
// model is only told what to aim at.

import { isReusable } from './bank.js'

const CLASS_SIZE_BAND = 0.25
const DURATION_BAND = 0.25
const ACTIVITY_SHARE = 0.6

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

function words(value) {
  return text(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 3)
}

export function materialNames(materials) {
  if (!Array.isArray(materials)) return []
  return materials
    .map((material) => text(material && material.name).toLowerCase())
    .filter((name) => name !== '')
}

// Whether everything the activity needs is on the shelf as it stands now.
export function shelfCovers(shelf, needed) {
  const have = new Set(materialNames(shelf))
  return needed.every((name) => have.has(name))
}

// Two numbers are in the same band if they are close enough. A number that is
// not known does not rule anything out — Village only refuses what it knows.
export function withinBand(a, b, band) {
  const left = numberOrNull(a)
  const right = numberOrNull(b)
  if (left === null || right === null) return true
  const bigger = Math.max(left, right)
  if (bigger === 0) return true
  return Math.abs(left - right) / bigger <= band
}

// How much two objectives talk about the same thing, from 0 to 1. Used to
// rank candidates, never to rule them out.
export function objectiveOverlap(a, b) {
  const left = new Set(words(a))
  const right = new Set(words(b))
  if (left.size === 0 || right.size === 0) return 0
  let shared = 0
  for (const word of left) {
    if (right.has(word)) shared += 1
  }
  return shared / Math.min(left.size, right.size)
}

function sameLabel(a, b) {
  const left = text(a).toLowerCase()
  const right = text(b).toLowerCase()
  if (left === '' || right === '') return true
  return left === right
}

// Every activity in the bank that could be offered for this lesson, best
// first. Null when there is nothing worth offering.
export function findReusableActivity(bank, form) {
  const list = Array.isArray(bank) ? bank : []
  const request = form || {}
  const budget = numberOrNull(request.durationMinutes)
  const candidates = []

  for (const record of list) {
    if (!isReusable(record)) continue
    if (!sameLabel(record.subject, request.subject)) continue
    if (!sameLabel(record.grade, request.grade)) continue
    if (!withinBand(record.classSize, request.classSize, CLASS_SIZE_BAND)) continue
    if (!withinBand(record.durationMinutes, request.durationMinutes, DURATION_BAND)) {
      continue
    }

    const activities =
      record.lesson && Array.isArray(record.lesson.activities)
        ? record.lesson.activities
        : []

    for (const activity of activities) {
      if (!activity) continue
      const needed = materialNames(activity.materials)
      if (!shelfCovers(request.materials, needed)) continue

      const minutes = numberOrNull(activity.durationMinutes)
      if (budget !== null && minutes !== null && minutes > budget * ACTIVITY_SHARE) {
        continue
      }

      candidates.push({
        record,
        activity,
        score: objectiveOverlap(
          record.objective,
          request.curriculumObjective || request.learningObjective,
        ),
      })
    }
  }

  if (candidates.length === 0) return null

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return String(b.record.date || '').localeCompare(String(a.record.date || ''))
  })

  return candidates[0]
}

// Whether the lesson that came back actually uses the activity that was
// offered. The model is asked to reuse it; this is how Village checks that
// it did, instead of taking the model's word for it.
export function lessonUsesActivity(lesson, offer) {
  if (!offer || !offer.activity) return false
  const name = text(offer.activity.name).toLowerCase()
  if (name === '') return false
  const activities =
    lesson && Array.isArray(lesson.activities) ? lesson.activities : []
  return activities.some((activity) => {
    if (!activity) return false
    const other = text(activity.name).toLowerCase()
    if (other === name) return true
    const shared = words(other).filter((word) => words(name).includes(word)).length
    const total = new Set([...words(other), ...words(name)]).size
    return total > 0 && shared / total >= 0.6
  })
}

// What to tell the model, and what to tell the teacher about it.
export function describeOffer(offer) {
  if (!offer || !offer.activity) return null
  return {
    name: text(offer.activity.name),
    durationMinutes: numberOrNull(offer.activity.durationMinutes),
    instructions: text(offer.activity.instructions),
    materials: (offer.activity.materials || []).map((material) => ({
      name: text(material && material.name),
      quantityNeeded: text(material && material.quantityNeeded),
    })),
    from: {
      title: text(offer.record.title),
      date: offer.record.date,
      classSize: offer.record.classSize,
      outcome: text(offer.record.outcome),
    },
  }
}
