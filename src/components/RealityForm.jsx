import React from 'react'

export default function RealityForm({ form, onChange }) {
  return (
    <section className="card" aria-labelledby="reality-heading">
      <h2 id="reality-heading">Your classroom reality</h2>
      <p className="card-hint">
        This is the part most lesson plans skip. Write it in your own words —
        Village plans around what you actually have.
      </p>

      <div className="field-grid">
        <label className="field">
          <span className="field-label">Class size</span>
          <input
            type="number"
            name="classSize"
            min="1"
            placeholder="e.g. 40"
            value={form.classSize}
            onChange={(event) => onChange('classSize', event.target.value)}
          />
        </label>

        <label className="field">
          <span className="field-label">Duration (minutes)</span>
          <input
            type="number"
            name="durationMinutes"
            min="1"
            placeholder="e.g. 35"
            value={form.durationMinutes}
            onChange={(event) => onChange('durationMinutes', event.target.value)}
          />
        </label>
      </div>

      <label className="field">
        <span className="field-label">Constraints</span>
        <textarea
          name="constraints"
          rows={3}
          placeholder="e.g. No projector, no printing, no internet during the lesson. Pupils sit in groups of five."
          value={form.constraints}
          onChange={(event) => onChange('constraints', event.target.value)}
        />
      </label>
    </section>
  )
}
