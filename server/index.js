import 'dotenv/config'
import express from 'express'
import { generateLesson, rebuildLesson } from './grok.js'
import { buildLessonWithRebuilds } from './rebuild.js'
import { runCheck } from './check.js'
import { stubLesson, stubRebuild } from './stub.js'
import { normalizeForm } from '../src/lib/formRules.js'

const app = express()
app.use(express.json({ limit: '1mb' }))

// The automated browser check runs against a stub so it never depends on the
// network. A teacher never sees it: it is off unless it is asked for.
const STUB = process.env.VILLAGE_STUB === '1'

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'village' })
})

// Plain language for the teacher. The form they filled in stays on screen
// either way — nothing they typed is lost when this fails.
function friendlyError(error) {
  if (error && error.code === 'missing_api_key') {
    return "Village has no Groq API key. Put GROQ_API_KEY in your .env file and restart the server."
  }

  const status = error && (error.status || error.statusCode)
  if (status === 429) {
    return 'Groq is rate limiting us right now. Wait a few seconds and try again.'
  }
  if (status === 401) {
    return 'Groq rejected the API key. Check GROQ_API_KEY in your .env file.'
  }

  return "Couldn't build the lesson — the AI service didn't respond. Try again in a moment."
}

app.post('/api/generate', async (req, res) => {
  const form = normalizeForm(req.body || {})

  try {
    const { lesson, feasibility } = await buildLessonWithRebuilds(form, {
      generate: STUB ? (f) => stubLesson(f) : (f) => generateLesson(f),
      rebuild: STUB
        ? (current, f, gaps) => stubRebuild(current, f, gaps)
        : (current, f, gaps) => rebuildLesson(current, f, gaps),
    })
    res.json({ lesson, feasibility })
  } catch (error) {
    console.error('generate failed:', error && error.message)
    res.status(502).json({ error: friendlyError(error) })
  }
})

// The teacher edited the lesson. Check it again — do not write a new one.
app.post('/api/check', (req, res) => {
  try {
    res.json(runCheck(req.body || {}))
  } catch (error) {
    console.error('check failed:', error && error.message)
    res.status(400).json({
      error: "Village could not check that lesson. Try again in a moment.",
    })
  }
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`Village server listening on http://localhost:${PORT}`)
})
