// The re-check path: a lesson the teacher has edited comes back from the
// browser and is checked again.
//
// No AI runs here. The teacher edited the lesson, so the lesson is taken as
// it now reads and the checker has the final word on it — that is the whole
// point of "edits are never blindly trusted".

import { checkLesson } from './validate.js'
import { normalizeForm } from '../src/lib/formRules.js'

export function runCheck(body) {
  const lesson = body && body.lesson

  if (!lesson || typeof lesson !== 'object' || Array.isArray(lesson)) {
    throw new Error('There is no lesson to check.')
  }

  const form = normalizeForm((body && body.form) || {})

  return { feasibility: checkLesson(lesson, form) }
}
