// The words a teacher writes, made comparable.
//
// Shared by the checker and by the curriculum search, so that "compare" and
// "comparing" are the same word in both places. Plain functions, no imports,
// no AI.

export const STOP_WORDS = new Set([
  'and', 'the', 'for', 'with', 'that', 'this', 'from', 'their', 'they',
  'are', 'was', 'were', 'will', 'can', 'should', 'able', 'learners',
  'learner', 'pupils', 'pupil', 'lesson', 'using', 'into', 'about',
])

export function clean(value) {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

export function normaliseText(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Words are compared on their first four letters, so "comparing" and
// "compare" are the same word and "understanding" and "understand" are too.
// Without this, a teacher gets told their lesson needs attention because
// the AI described the objective instead of quoting it.
export function matchingKey(word) {
  return word.length > 4 ? word.slice(0, 4) : word
}

export function significantWords(value) {
  return normaliseText(value)
    .split(' ')
    .filter((word) => word.length > 3 && !STOP_WORDS.has(word))
    .map(matchingKey)
}
