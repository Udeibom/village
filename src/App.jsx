import React, { useEffect, useRef, useState } from 'react'
import LessonRequestForm from './components/LessonRequestForm.jsx'
import RealityForm from './components/RealityForm.jsx'
import MaterialsList from './components/MaterialsList.jsx'
import LessonPlan from './components/LessonPlan.jsx'
import FeasibilityPanel from './components/FeasibilityPanel.jsx'
import PrintView from './components/PrintView.jsx'
import { canGenerate, emptyForm, normalizeForm } from './lib/formRules.js'
import { generateLesson, checkLesson } from './api.js'

export default function App() {
  const [form, setForm] = useState(emptyForm)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [lesson, setLesson] = useState(null)
  const [feasibility, setFeasibility] = useState(null)
  const [checking, setChecking] = useState(false)
  const [printing, setPrinting] = useState(false)
  const checkNumber = useRef(0)

  const handleChange = (field, value) => {
    setForm((current) => {
      const next = { ...current, [field]: value }
      if (field === 'topic') next.learningObjective = value
      return next
    })
  }

  const handleMaterialsChange = (materials) => {
    setForm((current) => ({ ...current, materials }))
  }

  const handleGenerate = async () => {
    setStatus('building')
    setError('')
    try {
      const result = await generateLesson(normalizeForm(form))
      setLesson(result.lesson)
      setFeasibility(result.feasibility)
      setStatus('idle')
    } catch (failure) {
      setError(failure.message)
      setStatus('error')
    }
  }

  // The teacher edited the lesson, or changed something the lesson is checked
  // against. The checker looks again — the lesson is never taken on trust.
  const runCheck = async (nextLesson, nextForm) => {
    const number = ++checkNumber.current
    setChecking(true)
    try {
      const result = await checkLesson({ lesson: nextLesson, form: nextForm })
      if (number === checkNumber.current) setFeasibility(result.feasibility)
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
            </div>
            <div className="result-panel">
              <FeasibilityPanel feasibility={feasibility} checking={checking} />
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
