// Records the Village demo on a private headless Chrome and writes the frames.
//
//   node demo/record-demo.mjs
//
// It never touches the learner's own desktop: a separate Chrome profile, a
// separate debug port, and only the app page is captured. assemble.sh turns
// the frames into the video.

import { spawn } from 'node:child_process'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const APP_URL = 'http://localhost:5173'
const DEBUG_PORT = 9333
const HERE = path.dirname(fileURLToPath(import.meta.url))
const BUILD = path.join(HERE, 'build')
const PROFILE = process.env.DEMO_PROFILE || path.join(BUILD, 'profile')
const SHOTS = process.env.DEMO_FRAMES || path.join(BUILD, 'frames')
const WIDTH = 1440
const HEIGHT = 900

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/* ------------------------------------------------------------------ cdp */

let id = 0
const pending = new Map()
const listeners = []
let socket

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const current = ++id
    pending.set(current, { resolve, reject })
    socket.send(JSON.stringify({ id: current, method, params }))
  })
}

function on(method, handler) {
  listeners.push({ method, handler })
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

async function waitFor(expression, label, timeout = 120000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (await evaluate(`(function () { return (${expression}); })()`)) return true
    await sleep(200)
  }
  throw new Error(`timed out waiting for: ${label}`)
}

/* --------------------------------------------------------------- helpers */

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

const clickWith = (selector, index) => `
(() => {
  const elements = document.querySelectorAll(${JSON.stringify(selector)});
  if (!elements[${index}]) return 'missing';
  elements[${index}].click();
  return 'ok';
})()`

const text = (selector) => `
(() => {
  const element = document.querySelector(${JSON.stringify(selector)});
  return element ? element.textContent.trim() : null;
})()`

const scrollTo = (selector) => `
(() => {
  const element = document.querySelector(${JSON.stringify(selector)});
  if (!element) return 'missing';
  element.scrollIntoView({ block: 'center' });
  return 'ok';
})()`

const pressEnter = (selector) => `
(() => {
  const element = document.querySelector(${JSON.stringify(selector)});
  if (!element) return 'missing';
  element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  return 'ok';
})()`

/* ----------------------------------------------------------------- steps */

const MATERIALS = [
  ['bottle tops', '40'],
  ['beans', 'a bag'],
  ['measuring cups', '2'],
  ['chalk', '1'],
  ['blackboard', '1'],
]

const CURRICULUM_LINE =
  'Represent and compare ratios using equivalent forms, including word problems.'

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
  await rm(SHOTS, { recursive: true, force: true })
  await mkdir(SHOTS, { recursive: true })

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

  // Wait for the browser to answer.
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
      return
    }
    for (const listener of listeners) {
      if (listener.method === message.method) listener.handler(message.params)
    }
  })
  await new Promise((resolve) => socket.addEventListener('open', resolve))

  // Capture every frame the page paints, with its timestamp.
  const frames = []
  on('Page.screencastFrame', async (params) => {
    frames.push({ data: params.data, timestamp: params.metadata.timestamp })
    try {
      await send('Page.screencastFrameAck', { sessionId: params.sessionId })
    } catch {
      /* the page moved on */
    }
  })

  await send('Page.enable')
  await send('Runtime.enable')
  await send('Network.enable')
  await send('Emulation.setDeviceMetricsOverride', {
    width: WIDTH,
    height: HEIGHT,
    deviceScaleFactor: 1,
    mobile: false,
  })
  await send('Page.startScreencast', {
    format: 'jpeg',
    quality: 92,
    maxWidth: WIDTH,
    maxHeight: HEIGHT,
    everyNthFrame: 1,
  })

  await send('Page.navigate', { url: APP_URL })
  await waitFor(`!!document.querySelector('button.button-primary')`, 'the app to load')
  await sleep(1500)

  const beat = async (name, fn) => {
    console.log(`beat — ${name}`)
    try {
      await fn()
    } catch (failure) {
      console.log(`   (skipped: ${failure.message})`)
    }
  }

  await beat('the teacher fills in the classroom', async () => {
    await evaluate(scrollTo('input[name="topic"]'))
    await sleep(600)
    await fillTheForm()
    await sleep(800)
    await evaluate(scrollTo('.materials'))
    await sleep(1200)
  })

  await beat('generate', async () => {
    await evaluate(click('.actions .button-primary'))
    await sleep(1200)
    await waitFor(`!!document.querySelector('.lesson-title')`, 'the lesson', 180000)
    await sleep(1500)
    await evaluate(scrollTo('.feasibility'))
    await sleep(3500)
  })

  await beat('the teacher changes the lesson, and the code says no', async () => {
    // The teacher writes "marker pens" into the lesson. There are no marker
    // pens in this classroom, and the checker knows that — no model, no
    // network, no waiting.
    await evaluate(scrollTo('.activity-material-name'))
    await sleep(1000)
    await evaluate(click('.activity-material-name'))
    await sleep(600)
    await evaluate(setField('.editable-input', 'marker pens'))
    await sleep(300)
    await evaluate(pressEnter('.editable-input'))
    await waitFor(
      `document.querySelector('.feasibility') && document.querySelector('.feasibility').textContent.includes('marker pens')`,
      'the panel to name the new material',
      30000,
    )
    await waitFor(
      `document.querySelector('.feasibility') && document.querySelector('.feasibility').textContent.includes('re-checked this after your change')`,
      'the panel to say it re-checked',
      30000,
    )
    await sleep(1500)
    await evaluate(scrollTo('.feasibility'))
    await sleep(4000)
  })

  await beat('the money shot: the measuring cups go', async () => {
    await evaluate(scrollTo('.materials'))
    await sleep(1200)
    await evaluate(click('button[aria-label^="Remove measuring cups"]'))
    await sleep(2500)
    await evaluate(click('.actions .button-primary'))
    await sleep(1000)
    await waitFor(
      `document.querySelector('.lesson-title') && !document.body.textContent.includes('measuring cup')`,
      'the lesson to change',
      180000,
    )
    await sleep(2000)
    await evaluate(scrollTo('.feasibility'))
    await sleep(4000)
  })

  await beat('the curriculum document decides', async () => {
    await evaluate(scrollTo('textarea[name="curriculumDocument"]'))
    await sleep(800)
    await evaluate(setField('textarea[name="curriculumDocument"]', CURRICULUM_LINE))
    await sleep(3000)
    await evaluate(scrollTo('.check-curriculum'))
    await sleep(4000)
  })

  await beat('how did it go?', async () => {
    await evaluate(scrollTo('.outcome'))
    await sleep(1200)
    await evaluate(click('.button-outcome.outcome-worked'))
    await sleep(2500)
    await evaluate(scrollTo('.bank-panel'))
    await sleep(3500)
  })

  await beat('no internet, and it still works', async () => {
    await send('Network.emulateNetworkConditions', {
      offline: true,
      latency: 0,
      downloadThroughput: 0,
      uploadThroughput: 0,
    })
    // Wait for the app to notice, then put the top of the page in shot, so
    // the note about the connection is actually on screen.
    await waitFor(`!!document.querySelector('.offline-note')`, 'the offline note', 30000)
    await sleep(1200)
    await evaluate(`(() => { window.scrollTo(0, 0); return window.scrollY; })()`)
    await sleep(2500)
    await evaluate(scrollTo('.feasibility'))
    await sleep(3000)
  })

  await send('Page.stopScreencast')
  await sleep(800)

  // Write the frames out, holding each one for the time it was on screen.
  const listing = []
  let previous = frames.length ? frames[0].timestamp : 0
  for (let index = 0; index < frames.length; index += 1) {
    const frame = frames[index]
    const next = frames[index + 1]
    let duration = next ? next.timestamp - frame.timestamp : 1
    if (duration > 4) duration = 4
    if (duration < 0.04) duration = 0.04
    const file = path.join(SHOTS, `frame-${String(index).padStart(5, '0')}.jpg`)
    await writeFile(file, Buffer.from(frame.data, 'base64'))
    listing.push({ file, duration })
    previous = frame.timestamp
  }

  const concat = listing
    .map((entry) => `file '${entry.file}'\nduration ${entry.duration.toFixed(3)}`)
    .join('\n')
  await writeFile(path.join(SHOTS, 'frames.txt'), `${concat}\n`)

  console.log(`frames: ${frames.length}`)

  chrome.kill()
  socket.close()
}

await run()
console.log('captured. now assembling with ffmpeg')
