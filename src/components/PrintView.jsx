import React from 'react'
import LessonPlan from './LessonPlan.jsx'
import FeasibilityPanel from './FeasibilityPanel.jsx'

// The page the teacher carries into the classroom: the lesson and the
// feasibility panel, and nothing else. No form, no buttons, no app chrome.
export default function PrintView({ lesson, feasibility, onBack }) {
  if (!lesson) return null

  return (
    <div className="print-view">
      <div className="print-actions">
        <button
          type="button"
          className="button-primary"
          onClick={() => window.print()}
        >
          Print this page
        </button>
        <button type="button" className="button-quiet" onClick={onBack}>
          Back to editing
        </button>
      </div>

      <section className="result print-result" aria-label="Printable lesson">
        <div className="result-lesson">
          <LessonPlan lesson={lesson} />
        </div>
        <div className="result-panel">
          <FeasibilityPanel feasibility={feasibility} />
        </div>
      </section>
    </div>
  )
}
