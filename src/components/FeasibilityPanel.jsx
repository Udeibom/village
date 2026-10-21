import React from 'react'

const MATERIAL_LABELS = {
  ok: 'Enough',
  short: 'Short',
  missing: 'Not listed',
  'quantity-unverified': 'Quantity unverified',
}

function MaterialRow({ row }) {
  return (
    <li className={`material-check material-check-${row.status}`}>
      <span className="check-mark" aria-hidden="true">
        {row.status === 'ok' ? '✓' : '✗'}
      </span>
      <span className="check-text">
        <strong className="check-label">
          {row.name} — {MATERIAL_LABELS[row.status]}
        </strong>
        <span className="check-detail">{row.detail}</span>
      </span>
    </li>
  )
}

function Check({ title, status, children }) {
  return (
    <section className="check">
      <h4 className="check-title">
        <span className="check-mark" aria-hidden="true">
          {status === 'ok' ? '✓' : '✗'}
        </span>
        {title}
      </h4>
      {children}
    </section>
  )
}

export default function FeasibilityPanel({ feasibility }) {
  if (!feasibility) return null

  const { verdict, checks } = feasibility
  const ready = verdict === 'ready'
  const materials = checks.materials || []
  const rebuilds = feasibility.rebuildsAttempted || 0

  return (
    <aside className="feasibility" aria-labelledby="feasibility-heading">
      <div className={`verdict verdict-${verdict}`}>
        <span className="verdict-mark" aria-hidden="true">
          {ready ? '✓' : '✗'}
        </span>
        <div>
          <h2 id="feasibility-heading" className="verdict-title">
            {ready ? 'Ready to teach' : 'Needs attention'}
          </h2>
          <p className="verdict-text">
            {ready
              ? "Village checked this lesson against what you said you have, and everything lines up."
              : 'Village found something to sort out before you teach this. The details are below.'}
          </p>
        </div>
      </div>

      {rebuilds > 0 && (
        <p className="rebuild-note">
          {rebuilds === 1
            ? 'Village rebuilt this lesson once, around the materials you actually have.'
            : `Village rebuilt this lesson ${rebuilds} times, around the materials you actually have.`}
          {ready
            ? ''
            : ' It still could not sort everything out — the gaps below are the ones left.'}
        </p>
      )}

      <Check title="Materials" status={materials.every((row) => row.status === 'ok') ? 'ok' : 'fail'}>
        {materials.length === 0 ? (
          <p className="check-detail">
            This lesson does not ask for any materials.
          </p>
        ) : (
          <ul className="material-checks">
            {materials.map((row, index) => (
              <MaterialRow key={`${row.name}-${index}`} row={row} />
            ))}
          </ul>
        )}
      </Check>

      <Check title="Timing" status={checks.timing.status}>
        <p className="check-detail">{checks.timing.detail}</p>
      </Check>

      <Check title="Assessment" status={checks.assessment.status}>
        <p className="check-detail">{checks.assessment.detail}</p>
      </Check>

      <Check title="Curriculum" status={checks.curriculum.status}>
        <p className="check-detail">{checks.curriculum.detail}</p>
      </Check>
    </aside>
  )
}
