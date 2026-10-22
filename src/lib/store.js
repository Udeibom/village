// The teacher's own classroom, kept on their own machine.
//
// Nothing in here goes to a service. The browser's local storage is the whole
// of Village's memory:
//
//   shelf     — what the teacher has, how big the class is, how long they teach
//   bank      — the lessons they have actually taught, and how they went
//   curriculum — the teacher's own curriculum document
//
// The read and write helpers take a storage object so they can be checked
// without a browser, and they never throw. A corrupt or unreadable store must
// not be able to break the page.

import { emptyForm, normalizeForm } from './formRules.js'
import { newMaterialRow } from './materialRows.js'

const VERSION = 1

export const STORE_KEYS = {
  shelf: 'village.shelf',
  bank: 'village.bank',
  curriculum: 'village.curriculum',
}

export function browserStorage() {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

// Reads a value, or the fallback when there is nothing usable there: no
// storage at all, nothing written, something that is not JSON, or a value
// written by an older version of Village.
export function readStore(storage, key, fallback = null) {
  if (!storage) return fallback
  let raw = null
  try {
    raw = storage.getItem(key)
  } catch {
    return fallback
  }
  if (!raw) return fallback
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return fallback
    if (parsed.version !== VERSION) return fallback
    if (parsed.value === undefined || parsed.value === null) return fallback
    return parsed.value
  } catch {
    return fallback
  }
}

// Writes a value, and says whether it stuck.
export function writeStore(storage, key, value) {
  if (!storage) return false
  try {
    storage.setItem(key, JSON.stringify({ version: VERSION, value }))
    return true
  } catch {
    return false
  }
}

export function clearStore(storage, key) {
  if (!storage) return false
  try {
    storage.removeItem(key)
    return true
  } catch {
    return false
  }
}

function text(value) {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

// The shelf is the form, minus the bits that only exist while the page is
// open: the row ids, and any blank row the teacher started and abandoned.
export function shelfFromForm(form) {
  const normalized = normalizeForm(form)
  return {
    ...normalized,
    materials: normalized.materials.map((material) => ({
      name: material.name,
      quantity: material.quantity,
    })),
  }
}

// The shelf, back as a form the page can edit. Blank rows are dropped and
// every material gets a fresh id, because ids belong to this page only.
export function formFromShelf(shelf) {
  const base = emptyForm()
  if (!shelf || typeof shelf !== 'object') return base

  const topic = text(shelf.topic)
  const materials = Array.isArray(shelf.materials) ? shelf.materials : []

  return {
    ...base,
    grade: text(shelf.grade),
    subject: text(shelf.subject),
    topic,
    learningObjective: text(shelf.learningObjective) || topic,
    curriculumObjective: text(shelf.curriculumObjective),
    classSize: text(shelf.classSize),
    durationMinutes: text(shelf.durationMinutes),
    constraints: text(shelf.constraints),
    materials: materials
      .filter((material) => material && text(material.name) !== '')
      .map((material) => ({
        ...newMaterialRow(),
        name: text(material.name),
        quantity: text(material.quantity),
      })),
  }
}

// Whether the shelf holds anything worth remembering.
export function isEmptyShelf(shelf) {
  if (!shelf || typeof shelf !== 'object') return true
  const fields = [
    'grade',
    'subject',
    'topic',
    'learningObjective',
    'curriculumObjective',
    'classSize',
    'durationMinutes',
    'constraints',
  ]
  if (fields.some((field) => text(shelf[field]) !== '')) return false
  const materials = Array.isArray(shelf.materials) ? shelf.materials : []
  return !materials.some((material) => material && text(material.name) !== '')
}
