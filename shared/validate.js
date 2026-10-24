// The feasibility checker — Village's kernel.
//
// Plain functions, no AI, no network. The model describes what a lesson
// needs; this file decides whether the teacher can actually teach it. The
// AI never grades its own homework.
//
// A lesson is "ready to teach" only when all four checks pass:
//   materials · timing · assessment · curriculum honesty

const TIMING_TOLERANCE_MINUTES = 2
const TIMING_UNDERFILL_RATIO = 0.6

/* ------------------------------------------------------------- helpers */

import {
  clean,
  matchingKey,
  normaliseText,
  significantWords,
} from './text.js'
import { findInDocument } from './curriculum.js'

function normaliseName(name) {
  return clean(name).toLowerCase().replace(/\s+/g, ' ').trim()
}

// "a bag", "two measuring cups", "40" — anything that is not a plain number
// is treated as a count Village cannot do arithmetic on.
function parseQuantity(value) {
  const text = clean(value).toLowerCase()
  if (text === '') return null
  const match = text.match(/^\s*(\d+(?:\.\d+)?)\s*/)
  if (!match) return null
  const number = Number(match[1])
  return Number.isFinite(number) ? number : null
}

// "bottle tops" is already plural, so we never just add an "s". We reduce to
// a singular first, then add the ending back — that way the teacher's own
// wording survives and we never say "bottle topses".
function singularise(name) {
  const words = clean(name).split(/\s+/).filter(Boolean)
  if (!words.length) return ''
  const last = words[words.length - 1]
  if (/(ses|xes|zes|ches|shes)$/i.test(last)) {
    words[words.length - 1] = last.slice(0, -2)
  } else if (/s$/i.test(last) && !/ss$/i.test(last)) {
    words[words.length - 1] = last.slice(0, -1)
  }
  return words.join(' ')
}

function plural(name) {
  const base = singularise(name)
  if (!base) return ''
  if (/(s|x|z|ch|sh)$/i.test(base)) return `${base}es`
  if (/[^aeiou]y$/i.test(base)) return `${base.slice(0, -1)}ies`
  return `${base}s`
}

// How the count reads next to the name: "40 bottle tops", "1 chalk".
function countLabel(name, quantity) {
  return quantity === 1 ? singularise(name) : plural(name)
}

/* ---------------------------------------------------------- materials */

// The name a material is compared under. "measuring cups" on the teacher's
// list and "measuring cup" in the lesson are the same thing, and "a handful
// of beans" and "beans" are too. Without this the checker tells a teacher
// their lesson needs a material they own, and then rebuilds a lesson that
// was already right — the exact failure the checker exists to prevent.
function materialKey(name) {
  return singularise(normaliseName(name))
    .replace(/\s*\b(pieces?)\b\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Two names are the same material when one is a run of words inside the
// other: "bean" inside "a handful of bean", "marker" inside "marker pens".
// The comparison is on whole words, so "pen" is not inside "pencil".
function sharesWords(a, b) {
  if (!a || !b) return false
  const aWords = a.split(' ')
  const bWords = b.split(' ')
  const [shorter, longer] = aWords.length <= bWords.length ? [aWords, bWords] : [bWords, aWords]
  for (let start = 0; start + shorter.length <= longer.length; start += 1) {
    const window = longer.slice(start, start + shorter.length).join(' ')
    if (window === shorter.join(' ')) return true
  }
  return false
}

// Every material the lesson needs, with the largest amount needed at one
// time. Activities happen one after another, so the same bottle tops are
// used again in the next activity — the peak is what has to exist, not the
// sum.
function requiredMaterials(lesson) {
  const peak = new Map()

  for (const activity of lesson.activities || []) {
    for (const material of activity.materials || []) {
      const key = materialKey(material.name)
      if (!key) continue
      const quantity = parseQuantity(material.quantityNeeded)
      const existing = peak.get(key)
      if (!existing) {
        peak.set(key, {
          name: clean(material.name),
          quantity,
          quantityText: clean(material.quantityNeeded),
        })
        continue
      }
      if (quantity !== null && (existing.quantity === null || quantity > existing.quantity)) {
        existing.quantity = quantity
        existing.quantityText = clean(material.quantityNeeded)
      }
    }
  }

  return [...peak.values()]
}

function checkMaterials(lesson, inventory) {
  const available = new Map()
  for (const item of inventory || []) {
    const key = materialKey(item.name)
    if (!key) continue
    available.set(key, {
      name: clean(item.name),
      quantity: parseQuantity(item.quantity),
      quantityText: clean(item.quantity),
    })
  }

  // The teacher's own name wins. Only when there is no exact match does the
  // checker look for the same material under a different wording.
  const findMaterial = (key) => {
    if (available.has(key)) return available.get(key)
    for (const [haveKey, item] of available) {
      if (sharesWords(key, haveKey)) return item
    }
    return undefined
  }

  const rows = []
  for (const need of requiredMaterials(lesson)) {
    const have = findMaterial(materialKey(need.name))

    if (!have) {
      rows.push({
        name: need.name,
        status: 'missing',
        detail: `The lesson needs ${plural(need.name)}, which is not on your list.`,
      })
      continue
    }

    if (need.quantity === null || have.quantity === null) {
      rows.push({
        name: need.name,
        status: 'quantity-unverified',
        detail: `You listed ${have.name}${
          have.quantityText ? ` (${have.quantityText})` : ''
        }, so Village can see you have it — but not that you have enough of it.`,
      })
      continue
    }

    if (have.quantity < need.quantity) {
      rows.push({
        name: need.name,
        status: 'short',
        shortBy: need.quantity - have.quantity,
        detail: `Short by ${need.quantity - have.quantity} ${plural(
          need.name,
        )} — the lesson needs ${need.quantity} at once, you have ${have.quantity}.`,
      })
      continue
    }

    rows.push({
      name: need.name,
      status: 'ok',
      detail: `You have ${have.quantity} ${countLabel(
        need.name,
        have.quantity,
      )}; the lesson needs ${need.quantity} at once.`,
    })
  }

  return rows
}

/* ------------------------------------------------------------- timing */

function checkTiming(lesson, durationMinutes) {
  const total = (lesson.activities || []).reduce(
    (sum, activity) => sum + (Number(activity.durationMinutes) || 0),
    0,
  )

  if (durationMinutes === null || durationMinutes === undefined) {
    return {
      status: 'fail',
      detail: `The activities add up to ${total} minutes, but no lesson length was given, so Village cannot check they fit.`,
      totalMinutes: total,
    }
  }

  if (total > durationMinutes + TIMING_TOLERANCE_MINUTES) {
    const over = total - durationMinutes
    return {
      status: 'fail',
      detail: `The activities add up to ${total} minutes — ${over} ${
        over === 1 ? 'minute' : 'minutes'
      } more than the ${durationMinutes} you have.`,
      totalMinutes: total,
    }
  }

  if (total < durationMinutes * TIMING_UNDERFILL_RATIO) {
    return {
      status: 'fail',
      detail: `The activities add up to only ${total} minutes of the ${durationMinutes} you have. There is room for more, or something is missing from the plan.`,
      totalMinutes: total,
    }
  }

  return {
    status: 'ok',
    detail: `The activities add up to ${total} minutes, within the ${durationMinutes} you have.`,
    totalMinutes: total,
  }
}

/* --------------------------------------------------------- assessment */

// Does the assessment actually test the objective the teacher gave?
function objectivesMatch(declared, stated) {
  const a = normaliseText(declared)
  const b = normaliseText(stated)
  if (!a || !b) return false
  if (a === b) return true
  if (a.includes(b) || b.includes(a)) return true

  const wordsA = [...new Set(significantWords(a))]
  const wordsB = [...new Set(significantWords(b))]
  if (!wordsA.length || !wordsB.length) return false

  const shared = wordsA.filter((word) => wordsB.includes(word)).length
  const smaller = Math.min(wordsA.length, wordsB.length)
  return shared / smaller >= 0.6
}

function checkAssessment(lesson, statedObjectives) {
  const targets = (statedObjectives || []).filter(Boolean)

  const assessment = lesson.assessment || {}
  const declared = clean(assessment.servesObjective)
  const trace = clean(assessment.understandingCheck)

  if (!declared) {
    return {
      status: 'fail',
      detail:
        'The lesson does not say which objective its assessment tests, so Village cannot tell whether the lesson would show what it was meant to show.',
    }
  }

  const matched = targets.find((target) => objectivesMatch(declared, target))
  if (!matched) {
    return {
      status: 'fail',
      detail: `The assessment declares that it tests "${declared}", which is not the objective you gave ("${targets.join(
        '", "',
      )}").`,
    }
  }

  return {
    status: 'ok',
    detail: `The assessment tests your objective ("${matched}")${
      trace ? ` — it asks pupils to ${trace}` : ''
    }.`,
  }
}

/* --------------------------------------------------------- curriculum */

function checkCurriculum(lesson, curriculumObjective, curriculumDocument) {
  if (!clean(curriculumObjective)) {
    return {
      status: 'fail',
      detail:
        'No curriculum objective was given, so Village cannot say what this lesson is aligned to.',
    }
  }

  const note = clean(lesson.curriculumNote)

  // With the teacher's own document in hand, the document decides the row.
  // The model's own claim about alignment no longer settles it — the teacher
  // gets their own words back, quoted, or an honest "not found".
  if (clean(curriculumDocument)) {
    const found = findInDocument(curriculumObjective, curriculumDocument)

    if (found.found) {
      return {
        status: 'ok',
        detail: `Your curriculum document says: "${found.line}" (line ${found.lineNumber}). That is the standard this lesson is planned against.`,
      }
    }

    return {
      status: 'fail',
      detail:
        'Village looks for the exact wording from the document you gave it. Village will not guess at alignment — paste the performance objective or the specific line from your curriculum that covers this lesson, and it will quote it back.',
    }
  }

  const confidence = clean(lesson.curriculumConfidence).toLowerCase()

  if (confidence === 'aligned') {
    return {
      status: 'ok',
      detail: `Aligned to the objective you provided.${
        note ? ` ${note}` : ''
      } Village has not checked it against your curriculum document.`,
    }
  }

  return {
    status: 'fail',
    detail: `Curriculum match unverified.${
      note ? ` ${note}` : ''
    } Village has not confirmed this lesson matches your curriculum document.`,
  }
}

/* ------------------------------------------------------------ verdict */

export function checkLesson(lesson, form) {
  const inventory = (form && form.materials) || []
  const statedObjective =
    clean(form && form.learningObjective) || clean(form && form.topic)

  const materials = checkMaterials(lesson, inventory)
  const timing = checkTiming(lesson, form && form.durationMinutes)
  const assessment = checkAssessment(lesson, [
    statedObjective,
    clean(form && form.curriculumObjective),
  ])
  const curriculum = checkCurriculum(
    lesson,
    form && form.curriculumObjective,
    form && form.curriculumDocument,
  )

  const materialsPassed = materials.every((row) => row.status === 'ok')
  const allPassed =
    materialsPassed &&
    timing.status === 'ok' &&
    assessment.status === 'ok' &&
    curriculum.status === 'ok'

  return {
    verdict: allPassed ? 'ready' : 'attention',
    checks: { materials, timing, assessment, curriculum },
    rebuildsAttempted: 0,
  }
}

// Which shortfalls the loop should try to fix. A shortage or a missing item
// can be rebuilt around. An unverified quantity cannot — that is information
// the teacher has, not a mistake to repair.
export function shortfalls(feasibility) {
  const rows = (feasibility.checks.materials || []).filter(
    (row) => row.status === 'short' || row.status === 'missing',
  )
  return rows
}

export { checkMaterials, checkTiming, checkAssessment, checkCurriculum, requiredMaterials, parseQuantity, objectivesMatch }
