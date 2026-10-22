// The checker, running in the browser.
//
// Village's kernel is arithmetic over plain data: no network, no model, no
// server-only code. That is what lets the teacher edit a lesson and have it
// checked again with no internet at all — and it is the same file the server
// runs, so the two can never disagree.

import { checkLesson } from '../../shared/validate.js'

export function checkLocally(lesson, form) {
  return { feasibility: checkLesson(lesson, form) }
}
