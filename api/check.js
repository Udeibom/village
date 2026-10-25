import 'dotenv/config'
import { runCheck } from '../server/check.js'

export default function handler(req, res) {
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

  try {
    res.json(runCheck(req.body || {}))
  } catch (error) {
    console.error('check failed:', error && error.message)
    res.status(400).json({
      error: "Village could not check that lesson. Try again in a moment.",
    })
  }
}
