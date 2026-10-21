// An internal fixture: a realistic Primary 6 ratios lesson. It never reaches
// the product — it exists so the checker can be tested against something
// shaped like a real lesson, with known right and wrong answers.

export const exampleLesson = {
  title: 'Understanding and comparing ratios',
  intro:
    'Pupils work out how to share objects in fixed ratios, then show that two different-looking pairs of amounts can describe the same ratio.',
  activities: [
    {
      name: 'Sharing in equal groups',
      durationMinutes: 6,
      instructions:
        'Give each group of five pupils forty bottle tops. Ask them to share the tops equally between the pupils and record how many each one gets.',
      materials: [{ name: 'bottle tops', quantityNeeded: '40' }],
      understandingCheck:
        'Ask two groups to say how many tops each pupil received and check they agree.',
      servesObjective: 'Represent and compare ratios using equivalent forms',
    },
    {
      name: 'Building equivalent ratios',
      durationMinutes: 12,
      instructions:
        'Each group uses two measuring cups and a handful of beans to make a ratio of two to one, then writes it in words and in numbers.',
      materials: [
        { name: 'measuring cups', quantityNeeded: '2' },
        { name: 'beans', quantityNeeded: 'a handful' },
      ],
      understandingCheck:
        'Walk round and check each group can say what its ratio means without reading it off the board.',
      servesObjective: 'Represent and compare ratios using equivalent forms',
    },
    {
      name: 'Writing ratios down',
      durationMinutes: 9,
      instructions:
        'Pupils write their ratio in the form a to b, then double both numbers and check the ratio has not changed.',
      materials: [{ name: 'chalk', quantityNeeded: '1' }],
      understandingCheck:
        'Ask three pupils to show a ratio that is the same as 1 to 3 and see whether they can explain why.',
      servesObjective: 'Represent and compare ratios using equivalent forms',
    },
    {
      name: 'Comparing two ratios',
      durationMinutes: 8,
      instructions:
        'On the blackboard, pupils compare 2 to 3 with 4 to 6 and decide whether they describe the same sharing.',
      materials: [{ name: 'blackboard', quantityNeeded: '1' }],
      understandingCheck:
        'Listen for pupils explaining that both are two groups of three, rather than only giving the right answer.',
      servesObjective: 'Represent and compare ratios using equivalent forms',
    },
  ],
  adaptations:
    'Pupils who find it hard can work with the concrete amounts only — sharing the tops and saying the ratio out loud before writing anything. Pupils who finish early can invent a ratio that is equivalent to 3 to 4 and set a challenge for the group beside them.',
  assessment: {
    instructions:
      'On their own, each pupil writes one ratio that is equivalent to 2 to 5, and one sentence saying why it is the same ratio.',
    servesObjective: 'Represent and compare ratios using equivalent forms',
  },
  curriculumConfidence: 'aligned',
  curriculumNote:
    'The activities and the assessment both ask pupils to represent and compare equivalent ratios.',
}

export const exampleInventory = [
  { name: 'bottle tops', quantity: '40' },
  { name: 'beans', quantity: 'a bag' },
  { name: 'measuring cups', quantity: '2' },
  { name: 'chalk', quantity: '1' },
  { name: 'blackboard', quantity: '1' },
]

export const exampleForm = {
  grade: 'Primary 6',
  subject: 'Mathematics',
  topic: 'Understand and represent ratios',
  learningObjective: 'Understand and represent ratios',
  curriculumObjective:
    'By the end of the lesson, learners should be able to represent and compare ratios using equivalent forms.',
  classSize: 40,
  durationMinutes: 35,
  constraints: 'No projector, no printing, no internet during the lesson.',
  materials: exampleInventory,
}
