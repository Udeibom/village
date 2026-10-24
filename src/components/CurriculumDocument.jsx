import React, { useRef } from 'react'

// The teacher's own curriculum document. With it, the curriculum check stops
// being the model's opinion and starts being a quote.
export default function CurriculumDocument({ value, onChange }) {
  const fileInput = useRef(null)

  const readFile = async (event) => {
    const file = event.target.files && event.target.files[0]
    if (!file) return
    try {
      const text = await file.text()
      onChange(text)
    } catch {
      onChange('')
    }
    event.target.value = ''
  }

  return (
    <section className="card" aria-labelledby="curriculum-document-heading">
      <h2 id="curriculum-document-heading">Your curriculum document</h2>
      <p className="card-hint">
        Paste the part of your scheme of work that covers this lesson, or
        upload the file. Village looks for the exact wording of your objective
        in that document and quotes the line it found — it will not guess at
        alignment. If it cannot find it, paste the specific line from your
        curriculum that covers this lesson.
      </p>

      <label className="field">
        <span className="field-label">Curriculum extract</span>
        <textarea
          name="curriculumDocument"
          rows={4}
          placeholder={'e.g. Mathematics — Number — Ratios\nRepresent and compare ratios using equivalent forms, including word problems.'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>

      <label className="field">
        <span className="field-label">Or upload a .txt or .md file</span>
        <input
          ref={fileInput}
          type="file"
          name="curriculumFile"
          accept=".txt,.md,text/plain,text/markdown"
          onChange={readFile}
        />
      </label>

      <p className="card-hint">
        Kept on this device with the rest of your classroom. Nothing is sent
        anywhere.
      </p>
    </section>
  )
}
