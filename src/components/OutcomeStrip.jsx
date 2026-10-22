import React, { useState } from 'react'
import { OUTCOMES } from '../lib/bank.js'

// The one question Village asks after a lesson: how did it go?
export default function OutcomeStrip({ onBank, banked }) {
  const [note, setNote] = useState('')
  const [picked, setPicked] = useState('')

  if (banked) {
    return (
      <div className="outcome outcome-banked">
        <p className="outcome-note">
          Banked in your classroom&rsquo;s record as &ldquo;
          {banked.outcome === 'worked' ? 'Worked' : banked.outcome === 'changes' ? 'Needed changes' : 'Did not work'}
          &rdquo;.
        </p>
        <button
          type="button"
          className="button-quiet button-answer-change"
          onClick={() => {
            setPicked('')
            setNote('')
            onBank(null, '')
          }}
        >
          Change my answer
        </button>
      </div>
    )
  }

  const choose = (outcome) => {
    setPicked(outcome)
    onBank(outcome, note)
  }

  return (
    <div className="outcome">
      <p className="outcome-question">How did it go?</p>
      <div className="outcome-choices">
        {OUTCOMES.map((outcome) => (
          <button
            key={outcome.id}
            type="button"
            className={`button-outcome outcome-${outcome.id}${
              picked === outcome.id ? ' picked' : ''
            }`}
            title={outcome.hint}
            onClick={() => choose(outcome.id)}
          >
            {outcome.label}
          </button>
        ))}
      </div>
      <label className="field outcome-note-field">
        <span className="field-label">What actually happened? (optional)</span>
        <input
          type="text"
          name="outcomeNote"
          placeholder="e.g. the bean jars were the hit, but the last task ran long"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      <p className="card-hint">
        Only what you teach is remembered. A lesson you mark as worked is the
        one Village will offer you again.
      </p>
    </div>
  )
}
