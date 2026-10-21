// The Groq client — the part that writes.
//
// The model is told to be strict about JSON and to describe what the lesson
// needs. It is never asked whether the lesson is teachable: that judgement
// belongs to server/validate.js.

import Groq from 'groq-sdk'

export const DEFAULT_MODEL = 'openai/gpt-oss-120b'

export function modelId() {
  return process.env.GROQ_MODEL || DEFAULT_MODEL
}

let client = null

function getClient() {
  if (!client) {
    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) {
      const error = new Error(
        'No Groq API key found. Put GROQ_API_KEY in your .env file.',
      )
      error.code = 'missing_api_key'
      throw error
    }
    client = new Groq({ apiKey })
  }
  return client
}

/* ------------------------------------------------------------- schema */

// Strict mode: every field required, no extra properties, so the lesson
// comes back in a shape the checker can rely on.
export const LESSON_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    intro: { type: 'string' },
    activities: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          durationMinutes: { type: 'number' },
          instructions: { type: 'string' },
          materials: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                quantityNeeded: { type: 'string' },
              },
              required: ['name', 'quantityNeeded'],
              additionalProperties: false,
            },
          },
          understandingCheck: { type: 'string' },
          servesObjective: { type: 'string' },
        },
        required: [
          'name',
          'durationMinutes',
          'instructions',
          'materials',
          'understandingCheck',
          'servesObjective',
        ],
        additionalProperties: false,
      },
    },
    adaptations: { type: 'string' },
    assessment: {
      type: 'object',
      properties: {
        instructions: { type: 'string' },
        servesObjective: { type: 'string' },
      },
      required: ['instructions', 'servesObjective'],
      additionalProperties: false,
    },
    curriculumConfidence: { type: 'string', enum: ['aligned', 'unverified'] },
    curriculumNote: { type: 'string' },
  },
  required: [
    'title',
    'intro',
    'activities',
    'adaptations',
    'assessment',
    'curriculumConfidence',
    'curriculumNote',
  ],
  additionalProperties: false,
}

/* -------------------------------------------------------------- shape */

function isText(value) {
  return typeof value === 'string' && value.trim() !== ''
}

// The safety net under strict mode. If something is missing, the caller
// gets a message it can hand to the repair prompt.
export function validateLessonShape(lesson) {
  const problems = []

  if (!lesson || typeof lesson !== 'object') {
    throw new Error('The reply was not a lesson object.')
  }

  for (const field of ['title', 'intro', 'adaptations', 'curriculumNote']) {
    if (!isText(lesson[field])) problems.push(`${field} is missing`)
  }

  if (!['aligned', 'unverified'].includes(lesson.curriculumConfidence)) {
    problems.push('curriculumConfidence must be "aligned" or "unverified"')
  }

  if (!Array.isArray(lesson.activities) || lesson.activities.length < 3) {
    problems.push('the lesson needs at least three activities')
  } else {
    lesson.activities.forEach((activity, index) => {
      if (!activity || typeof activity !== 'object') {
        problems.push(`activity ${index + 1} is not an object`)
        return
      }
      if (!isText(activity.name)) problems.push(`activity ${index + 1} has no name`)
      if (!Number.isFinite(activity.durationMinutes)) {
        problems.push(`activity ${index + 1} has no duration`)
      }
      if (!isText(activity.instructions)) {
        problems.push(`activity ${index + 1} has no instructions`)
      }
      if (!isText(activity.understandingCheck)) {
        problems.push(`activity ${index + 1} has no understanding check`)
      }
      if (!isText(activity.servesObjective)) {
        problems.push(`activity ${index + 1} does not say which objective it serves`)
      }
      if (!Array.isArray(activity.materials)) {
        problems.push(`activity ${index + 1} has no materials list`)
      } else {
        activity.materials.forEach((material, materialIndex) => {
          if (!material || !isText(material.name)) {
            problems.push(
              `activity ${index + 1}, material ${materialIndex + 1} has no name`,
            )
          }
          if (!material || !isText(material.quantityNeeded)) {
            problems.push(
              `activity ${index + 1}, material ${materialIndex + 1} has no quantity`,
            )
          }
        })
      }
    })
  }

  const assessment = lesson.assessment
  if (!assessment || typeof assessment !== 'object') {
    problems.push('the lesson has no assessment')
  } else {
    if (!isText(assessment.instructions)) {
      problems.push('the assessment has no instructions')
    }
    if (!isText(assessment.servesObjective)) {
      problems.push('the assessment does not say which objective it tests')
    }
  }

  if (problems.length > 0) {
    throw new Error(`The reply was not a usable lesson: ${problems.join('; ')}.`)
  }

  return lesson
}

/* ------------------------------------------------------------- prompts */

function describeMaterials(materials) {
  if (!materials || materials.length === 0) return '(none listed)'
  return materials
    .map((material) => {
      const quantity = material.quantity ? material.quantity : 'an unknown amount'
      return `- ${material.name}: ${quantity}`
    })
    .join('\n')
}

export function buildGenerationPrompt(form) {
  const duration =
    form.durationMinutes === null || form.durationMinutes === undefined
      ? 'not stated'
      : `${form.durationMinutes} minutes`
  const target =
    form.durationMinutes === null || form.durationMinutes === undefined
      ? 40
      : form.durationMinutes
  const classSize =
    form.classSize === null || form.classSize === undefined
      ? 'not stated'
      : `${form.classSize} pupils`

  return `Plan one lesson for a real classroom.

THE REQUEST
Grade: ${form.grade || 'not stated'}
Subject: ${form.subject || 'not stated'}
Topic and learning objective: ${form.topic || form.learningObjective || 'not stated'}
Curriculum objective (pasted by the teacher): ${
    form.curriculumObjective || 'not stated'
  }

THE CLASSROOM REALITY
Class size: ${classSize}
Lesson length: ${duration}
Constraints (the teacher's own words): ${form.constraints || 'none stated'}

MATERIALS THE TEACHER HAS CONFIRMED
${describeMaterials(form.materials)}

HOW TO PLAN
1. Build four to six activities. Write them for this class, this time, these
   constraints — no projector, no printing and no internet unless the
   constraints allow it.
2. Use ONLY the materials listed above. Never require anything else, not even
   something ordinary like a pen. If an activity would need something you were
   not given, plan the activity differently.
3. The activity timings must add up to EXACTLY ${target} minutes — no more, no
   less. Choose how many activities there are and how long each one lasts so
   the total is exactly ${target}. Village adds up your timings and tells you
   if they do not fit, so check the total yourself before you reply.
4. For each activity, list the materials it uses and how many are needed AT
   ONCE. Quantities are written as plain numbers when you can count them
   ("40"), otherwise as words ("a handful").
5. Give every activity a short instruction a teacher could read out, and a
   short understanding check — how the teacher knows the pupils got it.
6. Every activity says which objective it serves, in the teacher's words.
7. The assessment is one short task pupils do alone. It must genuinely test
   the learning objective. In servesObjective, copy the objective text itself
   — the teacher's own words, not a description of what the pupils will do.
8. adaptations: two or three sentences on how to stretch or support pupils
   who are finding it hard.
9. curriculumConfidence is "aligned" only if this lesson genuinely addresses
   the curriculum objective above; use "unverified" if it cannot be sure.
   curriculumNote is one plain sentence saying what it is confident about.

Write like a competent colleague helping a teacher plan: plain, practical,
no ceremony.`
}

// The rebuild prompt: the shortfall spelled out, the inventory restated, and
// a plain statement of what has to change.
export function buildRebuildPrompt(lesson, form, gaps) {
  const target =
    form.durationMinutes === null || form.durationMinutes === undefined
      ? 40
      : form.durationMinutes

  const gapsText = gaps
    .map((gap) => {
      if (gap.status === 'missing') {
        return `- ${gap.name}: the lesson needs it and you do not have it.`
      }
      return `- ${gap.name}: the lesson needs ${gap.shortBy} more than you have.`
    })
    .join('\n')

  const previous = (lesson.activities || [])
    .map(
      (activity) =>
        `- ${activity.name} (${activity.durationMinutes} min): ${(
          activity.materials || []
        )
          .map((material) => `${material.name} (${material.quantityNeeded})`)
          .join(', ')}`,
    )
    .join('\n')

  return `This lesson cannot be taught as it stands, because it asks for things the teacher does not have.

WHAT IS MISSING
${gapsText}

WHAT THE TEACHER ACTUALLY HAS
${describeMaterials(form.materials)}

THE LESSON YOU WROTE BEFORE
${previous}

WHAT TO DO
1. Write a new lesson for the same topic and the same learning objective, built
   only from the materials the teacher actually has. If an activity needed
   something they do not have, plan a different activity that does not.
2. Never ask for more of a material than the list above allows. If the teacher
   has 40 bottle tops, the lesson may use 40 bottle tops at once, not 41.
3. The activity timings must add up to EXACTLY ${target} minutes.
4. Keep the teaching quality: the same objective, the same understanding
   checks, the same honesty about what the assessment tests. In servesObjective,
   copy the objective text itself — the teacher's own words, not a description
   of what the pupils will do.
5. Return the whole lesson again, in the same format, not just the changed
   parts.`
}

function buildRepairPrompt(content, problem) {  return `The lesson you returned could not be used: ${problem}

Here is what you returned:
${content}

Return the same lesson as JSON, corrected. Keep it to the same format:
title, intro, activities (each with name, durationMinutes, instructions,
materials (name and quantityNeeded), understandingCheck, servesObjective),
adaptations, assessment (instructions and servesObjective),
curriculumConfidence and curriculumNote.`
}

/* --------------------------------------------------------------- calls */

export function parseLesson(content) {
  let parsed
  try {
    parsed = JSON.parse(content)
  } catch {
    throw new Error('The reply was not valid JSON.')
  }
  return validateLessonShape(parsed)
}

async function askGroq(messages, schema) {
  const groq = getClient()
  const response = await groq.chat.completions.create({
    model: modelId(),
    messages,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'village_lesson',
        description: 'A classroom lesson plan grounded in the teacher’s inventory.',
        strict: true,
        schema,
      },
    },
    reasoning_effort: 'low',
    max_tokens: 6000,
  })

  const message = response.choices && response.choices[0] && response.choices[0].message
  const content = message && message.content
  if (!content) {
    throw new Error('The AI service returned an empty reply.')
  }
  return content
}

// One automatic repair attempt when the reply is not a usable lesson.
export async function generateLesson(form) {
  const prompt = buildGenerationPrompt(form)
  const messages = [
    {
      role: 'system',
      content:
        'You write classroom lessons that use only the materials a teacher has confirmed they own. You reply with JSON only.',
    },
    { role: 'user', content: prompt },
  ]

  const content = await askGroq(messages, LESSON_SCHEMA)

  try {
    return parseLesson(content)
  } catch (firstProblem) {
    const repaired = await askGroq(
      [
        messages[0],
        { role: 'user', content: buildRepairPrompt(content, firstProblem.message) },
      ],
      LESSON_SCHEMA,
    )
    return parseLesson(repaired)
  }
}

// Rebuild the lesson around what the teacher actually has. The checker has
// already said what is missing, so the model does not have to guess.
export async function rebuildLesson(lesson, form, gaps) {
  const messages = [
    {
      role: 'system',
      content:
        'You write classroom lessons that use only the materials a teacher has confirmed they own. You reply with JSON only.',
    },
    { role: 'user', content: buildRebuildPrompt(lesson, form, gaps) },
  ]

  const content = await askGroq(messages, LESSON_SCHEMA)

  try {
    return parseLesson(content)
  } catch (firstProblem) {
    const repaired = await askGroq(
      [
        messages[0],
        { role: 'user', content: buildRepairPrompt(content, firstProblem.message) },
      ],
      LESSON_SCHEMA,
    )
    return parseLesson(repaired)
  }
}
