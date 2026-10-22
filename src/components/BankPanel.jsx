import React from 'react'
import { formatDate, outcomeLabel } from '../lib/bank.js'

// This classroom's record: the lessons the teacher has actually taught, and
// how each one went. Never seeded — an empty record is the truth about a
// classroom where nothing has been taught yet.
export default function BankPanel({ bank, onForget }) {
  const list = Array.isArray(bank) ? bank : []

  return (
    <section className="card bank-panel" aria-labelledby="bank-heading">
      <h2 id="bank-heading">Your classroom&rsquo;s record</h2>

      {list.length === 0 ? (
        <p className="empty-note">
          Nothing from this classroom yet. When you tell Village how a lesson
          went, it is kept here — on this device, and nowhere else.
        </p>
      ) : (
        <ul className="bank-list">
          {list.map((record) => (
            <li key={record.id} className="bank-entry">
              <div className="bank-entry-head">
                <span className="bank-title">{record.title}</span>
                <span className={`bank-outcome outcome-${record.outcome}`}>
                  {outcomeLabel(record.outcome)}
                </span>
              </div>
              <p className="bank-meta">
                {formatDate(record.date)}
                {record.classSize ? ` · ${record.classSize} pupils` : ''}
                {record.source === 'colleague' ? ' · from a colleague' : ''}
                {record.source === 'colleague' && !record.verified
                  ? ' · not yet proved here'
                  : ''}
              </p>
              {record.note && <p className="bank-note">&ldquo;{record.note}&rdquo;</p>}
              {onForget && (
                <button
                  type="button"
                  className="button-quiet button-forget button-forget-record"
                  onClick={() => onForget(record.id)}
                >
                  Forget this lesson
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
