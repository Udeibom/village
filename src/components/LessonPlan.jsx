import React from 'react'

function MaterialList({ materials }) {
  if (!materials || materials.length === 0) {
    return <p className="activity-materials-empty">No materials needed.</p>
  }
  return (
    <ul className="activity-materials">
      {materials.map((material, index) => (
        <li key={`${material.name}-${index}`}>
          <span className="activity-material-name">{material.name}</span>
          <span className="activity-material-quantity">
            {material.quantityNeeded}
          </span>
        </li>
      ))}
    </ul>
  )
}

export default function LessonPlan({ lesson }) {
  if (!lesson) return null

  return (
    <article className="lesson">
      <h2 className="lesson-title">{lesson.title}</h2>
      <p className="lesson-intro">{lesson.intro}</p>

      <ol className="activities">
        {(lesson.activities || []).map((activity, index) => (
          <li key={`${activity.name}-${index}`} className="activity">
            <div className="activity-head">
              <h3 className="activity-name">{activity.name}</h3>
              <span className="activity-duration">
                {activity.durationMinutes} min
              </span>
            </div>

            <p className="activity-instructions">{activity.instructions}</p>

            <div className="activity-meta">
              <div className="activity-block">
                <h4>Materials</h4>
                <MaterialList materials={activity.materials} />
              </div>

              <div className="activity-block">
                <h4>How you'll know they got it</h4>
                <p>{activity.understandingCheck}</p>
              </div>

              <div className="activity-block">
                <h4>Objective it serves</h4>
                <p>{activity.servesObjective}</p>
              </div>
            </div>
          </li>
        ))}
      </ol>

      {lesson.adaptations && (
        <section className="lesson-section">
          <h3>If pupils need more, or less</h3>
          <p>{lesson.adaptations}</p>
        </section>
      )}

      {lesson.assessment && (
        <section className="lesson-section lesson-assessment">
          <h3>Assessment</h3>
          <p>{lesson.assessment.instructions}</p>
          <p className="lesson-trace">
            Tests: <strong>{lesson.assessment.servesObjective}</strong>
          </p>
        </section>
      )}

      <p className="honesty-line">
        Illustrative draft — review against your curriculum and your pupils'
        prior knowledge.
      </p>
    </article>
  )
}
