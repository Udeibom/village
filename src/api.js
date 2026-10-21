// Thin fetch wrappers around the local middleman server. The API key stays on
// the server; the browser only ever talks to /api.

async function postJson(path, body) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  let payload = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (!response.ok) {
    const message =
      (payload && payload.error) || `The server replied with ${response.status}.`
    const error = new Error(message)
    error.status = response.status
    throw error
  }

  return payload
}

export function generateLesson(form) {
  return postJson('/api/generate', form)
}

export function checkLesson(payload) {
  return postJson('/api/check', payload)
}
