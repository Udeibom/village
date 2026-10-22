// Fitting activity timings to the lesson, in code.
//
// The model is good at writing a lesson and bad at adding up. The first real
// lesson this app wrote ran 40 minutes against a 35-minute lesson, and the
// model had no idea. Asking it again is a model hoping harder; scaling the
// minutes is arithmetic.
//
// The teacher's content is never changed here — only the minutes, and the
// panel says so when it happens.

export const TIMING_TOLERANCE_MINUTES = 2

export function totalMinutes(activities) {
  if (!Array.isArray(activities)) return 0
  return activities.reduce((sum, activity) => {
    const minutes = activity && Number(activity.durationMinutes)
    return sum + (Number.isFinite(minutes) ? minutes : 0)
  }, 0)
}

// Scales the activity timings onto the lesson's budget. The order and the
// number of activities are untouched; the total lands exactly on the budget.
export function fitActivitiesToBudget(activities, budget) {
  const list = Array.isArray(activities) ? activities : []
  const minutes = Number(budget)
  const before = totalMinutes(list)

  if (!Number.isFinite(minutes) || minutes <= 0 || list.length === 0) {
    return { activities: list, fitted: false, before, after: before, reason: 'no-budget' }
  }

  if (before <= 0) {
    return { activities: list, fitted: false, before, after: before, reason: 'no-minutes' }
  }

  // A lesson that already fits — or is within the tolerance the check uses —
  // is left exactly as it is.
  if (Math.abs(before - minutes) <= TIMING_TOLERANCE_MINUTES) {
    return { activities: list, fitted: false, before, after: before, reason: 'already-fits' }
  }

  // Too short to give every activity a minute.
  if (minutes < list.length) {
    return { activities: list, fitted: false, before, after: before, reason: 'too-short' }
  }

  const factor = minutes / before
  const exact = list.map((activity) => {
    const value = activity && Number(activity.durationMinutes)
    return Number.isFinite(value) ? value * factor : 0
  })

  // Every activity keeps at least a minute, so none of them is squeezed out.
  const fitted = exact.map((value) => Math.max(1, Math.floor(value)))
  let total = fitted.reduce((sum, value) => sum + value, 0)

  // Hand out the rounding remainder to the activities that lost the most.
  const order = list
    .map((_, index) => index)
    .sort((a, b) => (exact[b] - fitted[b]) - (exact[a] - fitted[a]))

  let guard = 0
  while (total < minutes && guard < 1000) {
    const index = order[guard % order.length]
    fitted[index] += 1
    total += 1
    guard += 1
  }

  // If the minute floor pushed the total over, take the minutes back from the
  // longest activities.
  guard = 0
  while (total > minutes && guard < 1000) {
    const index = order
      .slice()
      .reverse()
      .find((candidate) => fitted[candidate] > 1)
    if (index === undefined) break
    fitted[index] -= 1
    total -= 1
    guard += 1
  }

  return {
    activities: list.map((activity, index) => ({
      ...activity,
      durationMinutes: fitted[index],
    })),
    fitted: true,
    before,
    after: total,
    reason: 'fitted',
  }
}

// The same, for a whole lesson.
export function fitLessonToBudget(lesson, budget) {
  if (!lesson || typeof lesson !== 'object') {
    return { lesson, fitted: false, before: 0, after: 0, reason: 'no-lesson' }
  }
  const result = fitActivitiesToBudget(lesson.activities, budget)
  if (!result.fitted) {
    return { lesson, fitted: false, before: result.before, after: result.after, reason: result.reason }
  }
  return {
    lesson: { ...lesson, activities: result.activities },
    fitted: true,
    before: result.before,
    after: result.after,
    reason: result.reason,
  }
}
