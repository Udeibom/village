import React, { useEffect, useRef, useState } from 'react'
import LessonRequestForm from './components/LessonRequestForm.jsx'
import RealityForm from './components/RealityForm.jsx'
import MaterialsList from './components/MaterialsList.jsx'
import LessonPlan from './components/LessonPlan.jsx'
import FeasibilityPanel from './components/FeasibilityPanel.jsx'
import PrintView from './components/PrintView.jsx'
import OutcomeStrip from './components/OutcomeStrip.jsx'
import BankPanel from './components/BankPanel.jsx'
import { canGenerate, emptyForm, normalizeForm } from './lib/formRules.js'
import { addRecord, makeRecord, removeRecord, updateRecord } from './lib/bank.js'
import { cardFileName, downloadCard, makeCard, parseCard } from './lib/lessonCard.js'
import {
  describeOffer,
  findReusableActivity,
  lessonUsesActivity,
} from './lib/reuse.js'
import {
  browserStorage,
  clearStore,
  formFromShelf,
  isEmptyShelf,
  readStore,
  shelfFromForm,
  STORE_KEYS,
  writeStore,
} from './lib/store.js'
import { generateLesson, checkLesson } from './api.js'

export default function App() {
  // The shelf comes back before the first paint, so the teacher's own
  // classroom is already here when they open the app.
  const [form, setForm] = useState(() =>
    formFromShelf(readStore(browserStorage(), STORE_KEYS.shelf)),
  )
  const [remembered, setRemembered] = useState(() => {
    const stored = readStore(browserStorage(), STORE_KEYS.shelf)
    return !isEmptyShelf(stored)
  })
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [lesson, setLesson] = useState(null)
  const [feasibility, setFeasibility] = useState(null)
  const [checking, setChecking] = useState(false)
  const [rechecked, setRechecked] = useState(false)
  const [printing, setPrinting] = useState(false)
  // The classroom's record of what was actually taught.
  const [bank, setBank] = useState(() =>
    readStore(browserStorage(), STORE_KEYS.bank, []),
  )
  const [banked, setBanked] = useState(null)
  const [lessonNumber, setLessonNumber] = useState(0)
  // What the classroom's record offered this lesson, and whether the lesson
  // actually used it.
  const [reuse, setReuse] = useState(null)
  const [importError, setImportError] = useState('')
  const [importNotice, setImportNotice] = useState('')
  const checkNumber = useRef(0)
  // Nothing is written to the shelf until the teacher changes something, so
  // an empty first visit does not overwrite what they had.
  const touched = useRef(false)

  const handleChange = (field, value) => {
    touched.current = true
    setForm((current) => {
      const next = { ...current, [field]: value }
      if (field === 'topic') next.learningObjective = value
      return next
    })
  }

  const handleMaterialsChange = (materials) => {
    touched.current = true
    setForm((current) => ({ ...current, materials }))
  }

  // The shelf is saved on the teacher's own device, and nowhere else.
  useEffect(() => {
    if (!touched.current) return
    writeStore(browserStorage(), STORE_KEYS.shelf, shelfFromForm(form))
    setRemembered(true)
  }, [form])

  const forgetShelf = () => {
    clearStore(browserStorage(), STORE_KEYS.shelf)
    touched.current = false
    setForm(emptyForm())
    setRemembered(false)
  }

  const handleGenerate = async () => {
    setStatus('building')
    setError('')
    setRechecked(false)
    setBanked(null)
    setReuse(null)

    // The choice of what to reuse is made here, in code, out of the teacher's
    // own record — not by the model.
    const offer = findReusableActivity(bank, form)
    const preferred = describeOffer(offer)

    try {
      const result = await generateLesson({
        ...normalizeForm(form),
        preferredActivity: preferred
          ? {
              name: preferred.name,
              durationMinutes: preferred.durationMinutes,
              instructions: preferred.instructions,
              materials: preferred.materials,
            }
          : null,
      })
      setLesson(result.lesson)
      setFeasibility(result.feasibility)
      setLessonNumber((number) => number + 1)
      if (offer) {
        setReuse({
          offer: preferred,
          used: lessonUsesActivity(result.lesson, offer),
        })
      }
      setStatus('idle')
    } catch (failure) {
      setError(failure.message)
      setStatus('error')
    }
  }

  // "How did it go?" — the answer is kept with the lesson, on this device.
  const handleOutcome = (outcome, note) => {
    if (!outcome) {
      setBanked(null)
      return
    }
    const record = makeRecord({ lesson, form, outcome, note })
    const next = addRecord(bank, record)
    setBank(next)
    writeStore(browserStorage(), STORE_KEYS.bank, next)
    setBanked(record)
  }

  const forgetRecord = (id) => {
    const next = removeRecord(bank, id)
    setBank(next)
    writeStore(browserStorage(), STORE_KEYS.bank, next)
    if (banked && banked.id === id) setBanked(null)
  }

  // The teacher taught a lesson that came from a colleague, and it worked
  // here too. Now it is proved in this classroom.
  const verifyRecord = (id) => {
    const next = updateRecord(bank, id, { outcome: 'worked', verified: true })
    setBank(next)
    writeStore(browserStorage(), STORE_KEYS.bank, next)
  }

  // A proven lesson, handed to a colleague as one small file.
  const exportRecord = (record) => {
    const card = makeCard(record)
    const sent = downloadCard(card, cardFileName(card.title))
    if (!sent) {
      setImportError('Village could not make that file. Try again in a moment.')
    }
  }

  // A lesson card from a colleague. It is a candidate, not a claim.
  const importRecord = async (event) => {
    const file = event.target.files && event.target.files[0]
    if (!file) return
    let raw = ''
    try {
      raw = await file.text()
    } catch {
      setImportError('Village could not read that file.')
      event.target.value = ''
      return
    }

    const parsed = parseCard(raw)
    if (!parsed.ok) {
      setImportError(parsed.error)
      setImportNotice('')
      event.target.value = ''
      return
    }

    const card = parsed.card
    const record = makeRecord({
      lesson: card.lesson,
      form: {
        topic: card.title,
        curriculumObjective: '',
        classSize: card.classSize,
        durationMinutes: card.durationMinutes,
        materials: card.materials,
        grade: '',
        subject: '',
      },
      outcome: '',
      note: card.note,
      source: 'colleague',
      verified: false,
    })

    const next = addRecord(bank, record)
    setBank(next)
    writeStore(browserStorage(), STORE_KEYS.bank, next)
    setImportError('')
    setImportNotice(
      `Imported "${card.title}". It is a candidate — not proved in your classroom until you teach it and mark it as worked.`,
    )
    event.target.value = ''
  }

  // The teacher edited the lesson, or changed something the lesson is checked
  // against. The checker looks again — the lesson is never taken on trust.
  const runCheck = async (nextLesson, nextForm) => {
    const number = ++checkNumber.current
    setChecking(true)
    try {
      const result = await checkLesson({ lesson: nextLesson, form: nextForm })
      if (number === checkNumber.current) {
        setFeasibility(result.feasibility)
        setRechecked(true)
      }
    } catch (failure) {
      if (number === checkNumber.current) setError(failure.message)
    } finally {
      if (number === checkNumber.current) setChecking(false)
    }
  }

  useEffect(() => {
    if (!lesson) return undefined

    const timer = setTimeout(() => {
      runCheck(lesson, form)
    }, 350)

    return () => clearTimeout(timer)
    // The lesson itself, and the inputs the checks are made against.
  }, [lesson, form.materials, form.classSize, form.durationMinutes, form.learningObjective, form.curriculumObjective])

  const ready = canGenerate(form)

  if (printing) {
    return (
      <div className="page page-print">
        <main className="sheet">
          <PrintView
            lesson={lesson}
            feasibility={feasibility}
            onBack={() => setPrinting(false)}
          />
        </main>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="masthead">
        <h1>Village</h1>
        <p className="tagline">
          Lesson plans that fit the room you actually have.
        </p>
      </header>

      <main className="sheet">
        <LessonRequestForm form={form} onChange={handleChange} />
        <RealityForm form={form} onChange={handleChange} />

        <section className="card">
          <MaterialsList
            materials={form.materials}
            onChange={handleMaterialsChange}
          />
          <p className="card-hint storage-note">
            {remembered
              ? 'Your classroom is kept on this device — it is not sent to any service, and it will be here next time you open Village.'
              : 'Village keeps your classroom on this device, so it is still here next time. It is not sent to any service.'}
          </p>
          {remembered && (
            <button
              type="button"
              className="button-quiet button-forget button-forget-shelf"
              onClick={forgetShelf}
            >
              Forget this classroom
            </button>
          )}
        </section>

        <div className="actions">
          <button
            type="button"
            className="button-primary"
            onClick={handleGenerate}
            disabled={!ready || status === 'building'}
          >
            {status === 'building' ? 'Building your lesson…' : 'Generate lesson'}
          </button>
          <button
            type="button"
            className="button-quiet button-print"
            onClick={() => setPrinting(true)}
            disabled={!lesson}
          >
            Print / Export
          </button>
          {!ready && (
            <p className="action-hint">
              Add a curriculum objective and at least one material to enable this.
            </p>
          )}
        </div>

        {status === 'error' && (
          <div className="notice notice-error" role="alert">
            <p className="notice-text">{error}</p>
            <button
              type="button"
              className="button-quiet"
              onClick={handleGenerate}
            >
              Try again
            </button>
          </div>
        )}

        {lesson && (
          <section className="result" aria-label="Lesson and feasibility">
            <div className="result-lesson">
              <LessonPlan lesson={lesson} onEdit={setLesson} />
              <OutcomeStrip
                key={lessonNumber}
                onBank={handleOutcome}
                banked={banked}
              />
            </div>
            <div className="result-panel">
              <FeasibilityPanel
                feasibility={feasibility}
                checking={checking}
                rechecked={rechecked}
                reuse={reuse}
              />
            </div>
          </section>
        )}

        <BankPanel
          bank={bank}
          onForget={forgetRecord}
          onExport={exportRecord}
          onImport={importRecord}
          onVerify={verifyRecord}
          importError={importError}
          importNotice={importNotice}
        />
      </main>
    </div>
  )
}
