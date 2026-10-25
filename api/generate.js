import 'dotenv/config'
import { generateLesson, rebuildLesson } from '../server/grok.js'
import { buildLessonWithRebuilds } from '../server/rebuild.js'
import { stubLesson, stubRebuild } from '../server/stub.js'
import { normalizeForm } from '../src/lib/formRules.js'

const STUB = process.env.VILLAGE_STUB === '1'

function isConnectionFailure(error) {
  if (!error) return false
  const code = String(error.code || '')
  if (
    ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'EAI_AGAIN', 'ECONNRESET'].includes(
      code,
    )
  ) {
    return true
  }
  if (error.name === 'APIConnectionError') return true
  const message = String(error.message || '').toLowerCase()
  return (
    message.includes('connection error') ||
    message.includes('fetch failed') ||
    message.includes('network error')
  )
}

function friendlyError(error) {
  if (error && error.code === 'missing_api_key') {
    return "Village has no Groq API key. Put GROQ_API_KEY in your .env file and restart the server."
  }

  if (isConnectionFailure(error)) {
    return 'Village could not reach the AI service, which usually means this machine has no internet right now. Everything else still works — your classroom, your record and your checks.'
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }
  
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

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
}
