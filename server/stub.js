// A stand-in for the AI, used only by the automated browser check.
//
// The browser check needs the app to answer `/api/generate` so it can assert
// on the rendered lesson and the verdict. Calling Groq for that would make
// every check slow, flaky and paid for. So the server can be started with
// VILLAGE_STUB=1 and this builds a lesson from the teacher's request instead.
//
// The stub follows the same rules the model is given: only the materials on
// the teacher's list, timings that add up to the lesson length.

function splitEvenly(total, parts) {
  const base = Math.floor(total / parts)
  const remainder = total - base * parts
  return Array.from({ length: parts }, (_, index) => base + (index < remainder ? 1 : 0))
}

const ACTIVITY_NAMES = [
  'Warm-up',
  'Main activity',
  'Guided practice',
  'Consolidation',
]

export function stubLesson(form) {
  const duration = form.durationMinutes || 40
  const minutes = splitEvenly(duration, 4)
  const inventory = form.materials || []
  const objective = form.learningObjective || form.topic || 'the learning objective'

  // Every material the teacher listed has to turn up in the lesson, so the
  // panel has something to check for each one.
  const byActivity = ACTIVITY_NAMES.map((_, index) =>
    inventory[index] ? [inventory[index]] : [],
  )
  if (inventory.length > ACTIVITY_NAMES.length) {
    byActivity[ACTIVITY_NAMES.length - 1].push(
      ...inventory.slice(ACTIVITY_NAMES.length),
    )
  }

  const activities = minutes.map((length, index) => {
    const materials = byActivity[index].map((material) => ({
      name: material.name,
      quantityNeeded: material.quantity ? material.quantity : 'a handful',
    }))

    return {
      name: `${ACTIVITY_NAMES[index]}: ${form.topic || 'the topic'}`,
      durationMinutes: length,
      instructions: `Do the ${ACTIVITY_NAMES[index].toLowerCase()} as a class, using only what is in the room.`,
      materials,
      understandingCheck:
        'Ask two pupils to say what they did in their own words, and listen for the idea.',
      servesObjective: objective,
    }
  })

  return {
    title: `A lesson on ${form.topic || 'your topic'}`,
    intro:
      'This is the stub lesson the automated check uses. A real lesson is written for your class, your constraints and your materials.',
    activities,
    adaptations:
      'Pupils who finish early can set a harder version of the task for the group beside them. Pupils who are stuck can work through it with a partner.',
    assessment: {
      instructions:
        'On your own, write one thing you can now do that you could not do at the start of the lesson.',
      servesObjective: objective,
    },
    curriculumConfidence: 'aligned',
    curriculumNote:
      'The activities work on the objective the teacher gave, using the materials they listed.',
  }
}
