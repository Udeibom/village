import React from 'react'
import { formatDate, outcomeLabel } from '../lib/bank.js'

// This classroom's record: the lessons the teacher has actually taught, and
// how each one went. Never seeded — an empty record is the truth about a
// classroom where nothing has been taught yet.
export default function BankPanel({
  bank,
  onForget,
  onExport,
  onImport,
  onVerify,
  importError = '',
  importNotice = '',
}) {
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
                  {record.outcome ? outcomeLabel(record.outcome) : 'Not judged'}
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
              <div className="bank-entry-actions">
                {onVerify && record.source === 'colleague' && !record.verified && (
                  <button
                    type="button"
                    className="button-quiet button-verify"
                    onClick={() => onVerify(record.id)}
                  >
                    It worked here too
                  </button>
                )}
                {onExport && (
                  <button
                    type="button"
                    className="button-quiet button-export"
                    onClick={() => onExport(record)}
                  >
                    Export for a colleague
                  </button>
                )}
                {onForget && (
                  <button
                    type="button"
                    className="button-quiet button-forget button-forget-record"
                    onClick={() => onForget(record.id)}
                  >
                    Forget this lesson
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {onImport && (
        <div className="bank-import">
          <label className="field">
            <span className="field-label">
              Import a lesson from a colleague
            </span>
            <input
              type="file"
              name="lessonCard"
              accept="application/json,.json"
              onChange={onImport}
            />
          </label>
          <p className="card-hint">
            A lesson card is one small file. An imported lesson is a candidate,
            not a claim — it is not proved in your classroom until you teach it
            and mark it as worked.
          </p>
          {importError && (
            <p className="notice notice-error" role="alert">
              {importError}
            </p>
          )}
          {importNotice && <p className="import-note">{importNotice}</p>}
        </div>
      )}
    </section>
  )
}
