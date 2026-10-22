// Finding the teacher's objective inside the teacher's own curriculum
// document.
//
// Plain functions, no AI, no network. The document is a set of lines; each
// line is compared with the objective on the same word keys the checker
// already uses, so "compare" and "comparing" are the same word here too.
//
// When it finds a line, Village quotes the teacher's own words back to them.
// When it cannot, it says so — the point of the check is to be the thing
// that is right, not the thing that is reassuring.

import { significantWords } from './text.js'

// How much of the objective a line has to cover before Village will call it
// a match, and how many significant words they have to share.
export const MIN_DOCUMENT_COVERAGE = 0.34
export const MIN_DOCUMENT_SHARED = 2

export function documentLines(document) {
  return String(document === undefined || document === null ? '' : document)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '')
}

// Looks for the objective in the document. Returns the line it found, where
// it found it, and how much of the objective it covers.
export function findInDocument(objective, document) {
  const lines = documentLines(document)
  if (lines.length === 0) return { found: false, reason: 'no-document' }

  const keys = new Set(significantWords(objective))
  if (keys.size === 0) return { found: false, reason: 'no-objective' }

  let best = null

  lines.forEach((line, index) => {
    const lineKeys = new Set(significantWords(line))
    const shared = [...keys].filter((key) => lineKeys.has(key))
    const coverage = shared.length / keys.size

    const better =
      !best ||
      coverage > best.coverage ||
      (coverage === best.coverage && shared.length > best.shared.length)

    if (better) {
      best = {
        line,
        lineNumber: index + 1,
        coverage,
        shared: shared.length,
      }
    }
  })

  if (!best || best.shared < MIN_DOCUMENT_SHARED || best.coverage < MIN_DOCUMENT_COVERAGE) {
    return { found: false, reason: 'not-found', lines: lines.length }
  }

  return { found: true, ...best }
}
