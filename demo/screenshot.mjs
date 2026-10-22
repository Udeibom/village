// Takes the screenshot the README shows: the lesson and the panel that
// checked it, side by side.
//
//   node demo/screenshot.mjs
//
// It drives a private headless Chrome and never touches the learner's own
// desktop. The app must already be running (npm run dev).

import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const APP_URL = process.env.VILLAGE_APP_URL || 'http://localhost:5173'
const DEBUG_PORT = 9334
const PROFILE = '/tmp/opencode/shot-profile'
const OUT = path.resolve('docs/screenshot.png')
const WIDTH = 1440
const HEIGHT = 900

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let id = 0
const pending = new Map()
let socket

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const current = ++id
    pending.set(current, { resolve, reject })
    socket.send(JSON.stringify({ id: current, method, params }))
  })
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  })
  if (result.exceptionDetails) {
    const detail =
      result.exceptionDetails.exception?.description ||
      result.exceptionDetails.text ||
      'unknown page error'
    throw new Error(`page error: ${detail}`)
  }
  return result.result.value
}

async function waitFor(expression, label, timeout = 180000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (await evaluate(`(function () { return (${expression}); })()`)) return true
    await sleep(250)
  }
  throw new Error(`timed out waiting for: ${label}`)
}

const setField = (selector, value) => `
(() => {
  const element = document.querySelector(${JSON.stringify(selector)});
  if (!element) return 'missing';
  const proto = element.tagName === 'TEXTAREA'
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(element, ${JSON.stringify(value)});
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  return 'ok';
})()`

const click = (selector) => `
(() => {
  const element = document.querySelector(${JSON.stringify(selector)});
  if (!element) return 'missing';
  element.click();
  return 'ok';
})()`

const scrollTo = (selector) => `
(() => {
  const element = document.querySelector(${JSON.stringify(selector)});
  if (!element) return 'missing';
  element.scrollIntoView({ block: 'center' });
  return 'ok';
})()`

const MATERIALS = [
  ['bottle tops', '40'],
  ['beans', 'a bag'],
  ['measuring cups', '2'],
  ['chalk', '1'],
  ['blackboard', '1'],
]

async function fillTheForm() {
  await evaluate(setField('input[name="grade"]', 'Primary 6'))
  await evaluate(setField('input[name="subject"]', 'Mathematics'))
  await evaluate(setField('input[name="topic"]', 'Understand and represent ratios'))
  await evaluate(
    setField(
      'textarea[name="curriculumObjective"]',
      'By the end of the lesson, learners should be able to represent and compare ratios using equivalent forms.',
    ),
  )
  await evaluate(setField('input[name="classSize"]', '40'))
  await evaluate(setField('input[name="durationMinutes"]', '35'))
  await evaluate(
    setField(
      'textarea[name="constraints"]',
      'No projector, no printing, no internet during the lesson. Pupils sit in groups of five.',
    ),
  )
  for (const [index, [name, quantity]] of MATERIALS.entries()) {
    await evaluate(click('.materials-header .button-quiet'))
    await sleep(120)
    await evaluate(
      `(() => {
        const rows = document.querySelectorAll('.material-row');
        const row = rows[${index}];
        if (!row) return 'missing';
        const nameInput = row.querySelector('input[aria-label="Material name"]');
        const quantityInput = row.querySelector('input[aria-label="Quantity"]');
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(nameInput, ${JSON.stringify(name)});
        nameInput.dispatchEvent(new Event('input', { bubbles: true }));
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(quantityInput, ${JSON.stringify(quantity)});
        quantityInput.dispatchEvent(new Event('input', { bubbles: true }));
        return 'ok';
      })()`,
    )
    await sleep(120)
  }
}

async function run() {
  await mkdir(path.dirname(OUT), { recursive: true })

  const chrome = spawn(
    'google-chrome',
    [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--hide-scrollbars',
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${PROFILE}`,
      `--window-size=${WIDTH},${HEIGHT}`,
      '--force-device-scale-factor=1',
      'about:blank',
    ],
    { stdio: 'ignore' },
  )

  let target
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json()
      target = list.find((t) => t.type === 'page')
      if (target) break
    } catch {
      /* not up yet */
    }
    await sleep(300)
  }
  if (!target) throw new Error('the browser never came up')

  socket = new WebSocket(target.webSocketDebuggerUrl)
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id)
      pending.delete(message.id)
      if (message.error) reject(new Error(message.error.message))
      else resolve(message.result)
    }
  })
  await new Promise((resolve) => socket.addEventListener('open', resolve))

  await send('Page.enable')
  await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', {
    width: WIDTH,
    height: HEIGHT,
    deviceScaleFactor: 2,
    mobile: false,
  })

  await send('Page.navigate', { url: APP_URL })
  await waitFor(`!!document.querySelector('button.button-primary')`, 'the app to load')
  await sleep(1200)

  await fillTheForm()
  await sleep(600)
  await evaluate(click('.actions .button-primary'))
  await waitFor(`!!document.querySelector('.lesson-title')`, 'the lesson')
  await waitFor(`!!document.querySelector('.verdict-title')`, 'the verdict')
  await sleep(2500)

  // Put the lesson and the panel in the same shot.
  await evaluate(
    `(() => {
      const panel = document.querySelector('.feasibility');
      const lesson = document.querySelector('.result-lesson');
      if (panel) panel.scrollIntoView({ block: 'center' });
      if (lesson) lesson.scrollIntoView({ block: 'center' });
      return 'ok';
    })()`,
  )
  await sleep(1200)

  const shot = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  })
  const { writeFile } = await import('node:fs/promises')
  const raw = path.join('/tmp/opencode', 'screenshot-raw.png')
  await writeFile(raw, Buffer.from(shot.data, 'base64'))

  // Captured at twice the size, then scaled down, so the text stays sharp in
  // the file the README shows.
  await new Promise((resolve, reject) => {
    const ffmpeg = spawn(
      'ffmpeg',
      ['-y', '-loglevel', 'error', '-i', raw, '-vf', 'scale=1440:-1', OUT],
      { stdio: 'ignore' },
    )
    ffmpeg.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg failed with ${code}`)),
    )
  })

  const verdict = await evaluate(
    `document.querySelector('.verdict-title') ? document.querySelector('.verdict-title').textContent.trim() : ''`,
  )
  console.log(`written: ${OUT}`)
  console.log(`verdict in the shot: ${verdict}`)

  chrome.kill()
  socket.close()
}

await run()
