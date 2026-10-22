// The rebuild loop — Village's promise made real.
//
// A shortage does not just get flagged: the lesson is rebuilt around what the
// teacher actually has, and the rebuild is checked again. The AI is never
// asked whether its own lesson is teachable — `server/validate.js` decides
// that, every time.
//
// The loop is written so it can be tested without an AI: `generate` and
// `rebuild` are passed in.

import { checkLesson, shortfalls } from './validate.js'
import { fitLessonToBudget } from './timing.js'

export const MAX_REBUILDS = 2

export async function buildLessonWithRebuilds(
  form,
  { generate, rebuild, maxRebuilds = MAX_REBUILDS } = {},
) {
  // The minutes are fitted in code before anything is checked, so the model
  // never gets to be wrong about arithmetic.
  let timing = fitLessonToBudget(await generate(form), form.durationMinutes)
  let lesson = timing.lesson
  let feasibility = checkLesson(lesson, form)
  let rebuildsAttempted = 0
  // If the timings were fitted at any point in the build, the panel says so.
  let timingFitted = {
    fitted: timing.fitted,
    before: timing.before,
    after: timing.after,
  }

  while (rebuildsAttempted < maxRebuilds) {
    const gaps = shortfalls(feasibility)

    // Nothing to rebuild around: either everything lines up, or the only
    // problem is a quantity the teacher could not count. That is information
    // for the teacher, not a mistake to repair.
    if (gaps.length === 0) break

    rebuildsAttempted += 1

    try {
      timing = fitLessonToBudget(
        await rebuild(lesson, form, gaps),
        form.durationMinutes,
      )
      lesson = timing.lesson
      if (timing.fitted) {
        timingFitted = { fitted: true, before: timing.before, after: timing.after }
      }
    } catch (error) {
      // A failed rebuild must not take the lesson down with it. We keep the
      // lesson we have and let the panel name the gaps that are left.
      console.error('rebuild failed:', error && error.message)
      break
    }

    feasibility = checkLesson(lesson, form)
  }

  feasibility.rebuildsAttempted = rebuildsAttempted
  feasibility.timingFitted = timingFitted
  return { lesson, feasibility }
}
