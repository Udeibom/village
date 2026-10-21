import React, { useEffect, useState } from 'react'

// Text the teacher can change in place. Click it, type, press Enter (or click
// away) and the lesson is re-checked. Escape throws the change away.
function EditableText({ value, onCommit, label, className, multiline = false }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    if (!editing) setDraft(value)
  }, [value, editing])

  // Without a commit handler there is nothing to edit — the print view
  // shows the lesson, not a form.
  if (!onCommit) {
    return <span className={`editable-readonly ${className || ''}`}>{value}</span>
  }

  const commit = () => {
    setEditing(false)
    const next = draft.trim()
    if (next !== value) onCommit(next)
  }

  const cancel = () => {
    setDraft(value)
    setEditing(false)
  }

  if (editing) {
    const shared = {
      className: `editable-input ${className || ''}`,
      value: draft,
      autoFocus: true,
      onChange: (event) => setDraft(event.target.value),
      onBlur: commit,
      onKeyDown: (event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          cancel()
        }
        if (event.key === 'Enter' && !multiline) {
          event.preventDefault()
          commit()
        }
      },
    }

    return multiline ? <textarea {...shared} rows={3} /> : <input {...shared} />
  }

  return (
    <span
      className={`editable ${className || ''}`}
      role="button"
      tabIndex={0}
      aria-label={label}
      title="Click to change this"
      onClick={() => setEditing(true)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          setEditing(true)
        }
      }}
    >
      {value}
    </span>
  )
}

// The materials one activity needs — the teacher can add to the list, take
// something out of it, or correct a quantity. Any change re-checks the
// lesson, so a lesson cannot quietly keep asking for something the teacher
// has taken out of the room.
function ActivityMaterials({ activity, onChange }) {
  const materials = activity.materials || []

  const update = (index, changes) => {
    onChange(
      materials.map((material, i) =>
        i === index ? { ...material, ...changes } : material,
      ),
    )
  }

  const remove = (index) => {
    onChange(materials.filter((_, i) => i !== index))
  }

  const add = () => {
    onChange([...materials, { name: '', quantityNeeded: '' }])
  }

  return (
    <div className="activity-materials-edit">
      {materials.length === 0 ? (
        <p className="activity-materials-empty">No materials needed.</p>
      ) : (
        <ul className="activity-materials">
          {materials.map((material, index) => (
            <li key={`${material.name}-${index}`}>
              <EditableText
                className="activity-material-name"
                label={`Material name in ${activity.name}`}
                value={material.name}
                onCommit={onChange ? (name) => update(index, { name }) : undefined}
              />
              <span className="activity-material-quantity">
                <EditableText
                  className="activity-material-quantity-text"
                  label={`Quantity for ${material.name || 'this material'}`}
                  value={material.quantityNeeded}
                  onCommit={
                    onChange ? (quantityNeeded) => update(index, { quantityNeeded }) : undefined
                  }
                />
              </span>
              {onChange && (
                <button
                  type="button"
                  className="button-quiet button-remove"
                  aria-label={`Remove ${material.name || 'material'} from ${activity.name}`}
                  onClick={() => remove(index)}
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {onChange && (
        <button
          type="button"
          className="button-quiet button-add-material"
          onClick={add}
        >
          Add material to this activity
        </button>
      )}
    </div>
  )
}

export default function LessonPlan({ lesson, onEdit }) {
  if (!lesson) return null

  const updateActivity = (index, changes) => {
    onEdit({
      ...lesson,
      activities: lesson.activities.map((activity, i) =>
        i === index ? { ...activity, ...changes } : activity,
      ),
    })
  }

  return (
    <article className="lesson">
      <h2 className="lesson-title">{lesson.title}</h2>
      <p className="lesson-intro">{lesson.intro}</p>

      <ol className="activities">
        {(lesson.activities || []).map((activity, index) => (
          <li key={`${activity.name}-${index}`} className="activity">
            <div className="activity-head">
              <h3 className="activity-name">
                <EditableText
                  label={`Name of activity ${index + 1}`}
                  value={activity.name}
                  onCommit={onEdit ? (name) => updateActivity(index, { name }) : undefined}
                />
              </h3>
              <span className="activity-duration">
                {activity.durationMinutes} min
              </span>
            </div>

            <p className="activity-instructions">
              <EditableText
                className="activity-instructions-text"
                label={`Instructions for ${activity.name}`}
                value={activity.instructions}
                multiline
                onCommit={
                  onEdit ? (instructions) => updateActivity(index, { instructions }) : undefined
                }
              />
            </p>

            <div className="activity-meta">
              <div className="activity-block">
                <h4>Materials</h4>
                <ActivityMaterials
                  activity={activity}
                  onChange={
                    onEdit
                      ? (materials) => updateActivity(index, { materials })
                      : undefined
                  }
                />
              </div>

              <div className="activity-block">
                <h4>How you'll know they got it</h4>
                <p>
                  <EditableText
                    className="activity-check-text"
                    label={`Understanding check for ${activity.name}`}
                    value={activity.understandingCheck}
                    multiline
                    onCommit={
                      onEdit
                        ? (understandingCheck) =>
                            updateActivity(index, { understandingCheck })
                        : undefined
                    }
                  />
                </p>
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
