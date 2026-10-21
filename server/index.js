import 'dotenv/config'
import express from 'express'

const app = express()
app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'village' })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`Village server listening on http://localhost:${PORT}`)
})
