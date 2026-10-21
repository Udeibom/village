import React from 'react'

export default function LessonRequestForm({ form, onChange }) {
  return (
    <section className="card" aria-labelledby="lesson-request-heading">
      <h2 id="lesson-request-heading">Lesson request</h2>
      <p className="card-hint">
        What are you teaching, and to which standard? Paste the curriculum
        objective from your own scheme of work.
      </p>

      <div className="field-grid">
        <label className="field">
          <span className="field-label">Grade</span>
          <input
            type="text"
            name="grade"
            placeholder="e.g. Primary 6"
            value={form.grade}
            onChange={(event) => onChange('grade', event.target.value)}
          />
        </label>

        <label className="field">
          <span className="field-label">Subject</span>
          <input
            type="text"
            name="subject"
            placeholder="e.g. Mathematics"
            value={form.subject}
            onChange={(event) => onChange('subject', event.target.value)}
          />
        </label>
      </div>

      <label className="field">
        <span className="field-label">Topic / learning objective</span>
        <input
          type="text"
          name="topic"
          placeholder="e.g. Understand and represent ratios"
          value={form.topic}
          onChange={(event) => onChange('topic', event.target.value)}
        />
      </label>

      <label className="field">
        <span className="field-label">
          Curriculum objective <span className="required">required</span>
        </span>
        <textarea
          name="curriculumObjective"
          rows={3}
          placeholder="e.g. By the end of the lesson, learners should be able to represent and compare ratios using equivalent forms."
          value={form.curriculumObjective}
          onChange={(event) => onChange('curriculumObjective', event.target.value)}
        />
      </label>
    </section>
  )
}
