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

function normalise(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

export function stubLesson(form) {
  const duration = form.durationMinutes || 40
  const minutes = splitEvenly(duration, 4)
  const inventory = form.materials || []
  const objective = form.learningObjective || form.topic || 'the learning objective'
  const preferred = form.preferredActivity || null

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
    // When the classroom's own record offers an activity that worked before,
    // the stub does what the real model is asked to do: it starts from that
    // activity, pointed at today's topic.
    const reusing = preferred && index === 0
    const preferredMaterials = reusing
      ? (preferred.materials || []).filter((material) =>
          inventory.some(
            (owned) => normalise(owned.name) === normalise(material.name),
          ),
        )
      : []

    const source = reusing && preferredMaterials.length > 0
      ? preferredMaterials
      : byActivity[index]

    const materials = source.map((material, materialIndex) => {
      const quantity = material.quantity
        ? material.quantity
        : material.quantityNeeded
          ? material.quantityNeeded
          : 'a handful'

      // The stub deliberately asks for one more of the first material than
      // the teacher has, so the rebuild loop always has real work to do
      // during the browser check. The real AI is not like this.
      if (index === 0 && materialIndex === 0) {
        const count = Number(quantity)
        if (Number.isFinite(count)) {
          return { name: material.name, quantityNeeded: String(count + 1) }
        }
      }

      return { name: material.name, quantityNeeded: quantity }
    })

    return {
      name: reusing
        ? preferred.name
        : `${ACTIVITY_NAMES[index]}: ${form.topic || 'the topic'}`,
      durationMinutes: length,
      instructions: reusing
        ? `${preferred.instructions} (pointed at today's objective)`
        : `Do the ${ACTIVITY_NAMES[index].toLowerCase()} as a class, using only what is in the room.`,
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

// The stub's rebuild: bring every material requirement back inside what the
// teacher has, and drop the ones they do not have at all.
export function stubRebuild(lesson, form, gaps) {
  const inventory = new Map(
    (form.materials || []).map((material) => [normalise(material.name), material]),
  )
  const gapNames = new Set(gaps.map((gap) => normalise(gap.name)))

  const activities = (lesson.activities || []).map((activity) => ({
    ...activity,
    materials: (activity.materials || [])
      .filter((material) => {
        if (!gapNames.has(normalise(material.name))) return true
        return inventory.has(normalise(material.name))
      })
      .map((material) => {
        const have = inventory.get(normalise(material.name))
        const needed = Number(material.quantityNeeded)
        const haveCount = Number(have && have.quantity)
        if (
          Number.isFinite(needed) &&
          Number.isFinite(haveCount) &&
          needed > haveCount
        ) {
          return { ...material, quantityNeeded: String(haveCount) }
        }
        return material
      }),
  }))

  return { ...lesson, activities }
}
