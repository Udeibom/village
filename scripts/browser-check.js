// Drives the running app in headless Chrome over the DevTools protocol and
// asserts on what a teacher would actually see — the button's enabled state,
// the rendered lesson, the verdict text. No dependencies beyond Node's own
// WebSocket and fetch.
//
//   npm run browser-check
//
// It starts its own server and web server on their own ports, with the AI
// stubbed out, so a check never depends on the network, on the Groq key or on
// a dev server you already have open. The real AI is exercised separately by
// `npm run ai-check`.

import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

const WEB_PORT = Number(process.env.CHECK_WEB_PORT || 5174)
const API_PORT = Number(process.env.CHECK_API_PORT || 3011)
const APP_URL = process.env.APP_URL || `http://localhost:${WEB_PORT}`
const CHROME = process.env.CHROME_PATH || 'google-chrome'
const DEBUG_PORT = Number(process.env.CHROME_DEBUG_PORT || 9222)
const TIMEOUT = Number(process.env.BROWSER_CHECK_TIMEOUT || 45000)

/* ------------------------------------------------------------------ chrome */

class CdpClient {
  constructor(socket) {
    this.socket = socket
    this.nextId = 1
    this.pending = new Map()
    this.handlers = new Map()

    this.ready = new Promise((resolve, reject) => {
      socket.addEventListener('open', () => resolve())
      socket.addEventListener('error', () =>
        reject(new Error('could not open a DevTools connection')),
      )
    })

    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data)
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id)
        this.pending.delete(message.id)
        if (message.error) {
          reject(new Error(message.error.message || 'DevTools error'))
        } else {
          resolve(message.result)
        }
        return
      }
      const listeners = this.handlers.get(message.method)
      if (listeners) {
        for (const listener of listeners) listener(message.params)
      }
    })
  }

  on(method, handler) {
    if (!this.handlers.has(method)) this.handlers.set(method, [])
    this.handlers.get(method).push(handler)
  }

  async send(method, params = {}, sessionId) {
    await this.ready
    const id = this.nextId++
    const payload = { id, method, params }
    if (sessionId) payload.sessionId = sessionId
    const promise = new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
    })
    this.socket.send(JSON.stringify(payload))
    return promise
  }
}

class Page {
  constructor(cdp, sessionId) {
    this.cdp = cdp
    this.sessionId = sessionId
  }

  send(method, params) {
    return this.cdp.send(method, params, this.sessionId)
  }

  async evaluate(fn, ...args) {
    const expression = `(${fn.toString()})(${args
      .map((arg) => JSON.stringify(arg))
      .join(', ')})`
    return this.evaluateExpression(expression)
  }

  async evaluateExpression(expression) {
    const result = await this.send('Runtime.evaluate', {
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

  async waitFor(expression, timeout = TIMEOUT, label = expression) {
    const deadline = Date.now() + timeout
    while (Date.now() < deadline) {
      if (await this.evaluateExpression(`(function () { return (${expression}); })()`)) {
        return true
      }
      await sleep(120)
    }
    throw new Error(`timed out waiting for: ${label}`)
  }

  waitForSelector(selector, timeout = TIMEOUT) {
    return this.waitFor(
      `!!document.querySelector(${JSON.stringify(selector)})`,
      timeout,
      `selector ${selector}`,
    )
  }

  waitForGone(selector, timeout = TIMEOUT) {
    return this.waitFor(
      `!document.querySelector(${JSON.stringify(selector)})`,
      timeout,
      `selector ${selector} to disappear`,
    )
  }

  async goto(url) {
    await this.send('Page.navigate', { url })
    await this.waitFor(
      `document.readyState === 'complete'`,
      TIMEOUT,
      'page load',
    )
  }

  async screenshot(path) {
    const { data } = await this.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: true,
    })
    await writeFile(path, Buffer.from(data, 'base64'))
    return path
  }

  async setViewport(width, height) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 500,
    })
    await sleep(150)
  }

  async fill(selector, value) {
    const found = await this.evaluate(
      (sel, val) => {
        const element = document.querySelector(sel)
        if (!element) return false
        const proto =
          element.tagName === 'TEXTAREA'
            ? HTMLTextAreaElement.prototype
            : HTMLInputElement.prototype
        const setter = Object.getOwnPropertyDescriptor(proto, 'value').set
        setter.call(element, val)
        element.dispatchEvent(new Event('input', { bubbles: true }))
        element.dispatchEvent(new Event('change', { bubbles: true }))
        return true
      },
      selector,
      value,
    )
    if (!found) throw new Error(`nothing matches ${selector} to fill`)
  }

  // Fills the last element that matches — used for the last row of a list
  // that grows as the teacher adds to it.
  async fillLast(selector, value) {
    const found = await this.evaluate(
      (sel, val) => {
        const elements = document.querySelectorAll(sel)
        if (!elements.length) return false
        const element = elements[elements.length - 1]
        const proto =
          element.tagName === 'TEXTAREA'
            ? HTMLTextAreaElement.prototype
            : HTMLInputElement.prototype
        const setter = Object.getOwnPropertyDescriptor(proto, 'value').set
        setter.call(element, val)
        element.dispatchEvent(new Event('input', { bubbles: true }))
        element.dispatchEvent(new Event('change', { bubbles: true }))
        return true
      },
      selector,
      value,
    )
    if (!found) throw new Error(`nothing matches ${selector} to fill`)
  }

  async click(selector) {
    const found = await this.evaluate((sel) => {
      const element = document.querySelector(sel)
      if (!element) return false
      element.click()
      return true
    }, selector)
    if (!found) throw new Error(`nothing matches ${selector} to click`)
  }

  // Clicks the last element that matches — used for the last row of a list
  // that grows as the teacher adds to it.
  async clickLast(selector) {
    const found = await this.evaluate((sel) => {
      const elements = document.querySelectorAll(sel)
      if (!elements.length) return false
      elements[elements.length - 1].click()
      return true
    }, selector)
    if (!found) throw new Error(`nothing matches ${selector} to click`)
  }

  // Presses Enter in a field, which is how an in-place edit is committed.
  async pressEnter(selector) {
    const found = await this.evaluate((sel) => {
      const element = document.querySelector(sel)
      if (!element) return false
      element.focus()
      element.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          bubbles: true,
          cancelable: true,
        }),
      )
      return true
    }, selector)
    if (!found) throw new Error(`nothing matches ${selector} to press enter on`)
  }

  text(selector) {
    return this.evaluate((sel) => {
      const element = document.querySelector(sel)
      return element ? element.textContent.trim() : null
    }, selector)
  }

  bodyText() {
    return this.evaluate(() => document.body.innerText)
  }

  isDisabled(selector) {
    return this.evaluate((sel) => {
      const element = document.querySelector(sel)
      return element ? Boolean(element.disabled) : null
    }, selector)
  }

  count(selector) {
    return this.evaluate(
      (sel) => document.querySelectorAll(sel).length,
      selector,
    )
  }
}

/* ------------------------------------------------------------- dev server */

async function responds(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2000) })
    return response.ok
  } catch {
    return false
  }
}

async function startDevServer() {
  // Spawn the two processes directly rather than through `npm run dev`, so
  // that stopping them is a matter of killing two known pids instead of
  // signalling a whole process tree and hoping.
  const server = spawn(process.execPath, ['server/index.js'], {
    stdio: 'ignore',
    env: { ...process.env, PORT: String(API_PORT), VILLAGE_STUB: '1' },
  })
  const web = spawn(
    process.execPath,
    ['node_modules/vite/bin/vite.js', '--port', String(WEB_PORT), '--strictPort'],
    {
      stdio: 'ignore',
      env: {
        ...process.env,
        VILLAGE_API_TARGET: `http://localhost:${API_PORT}`,
      },
    },
  )
  const children = [server, web]

  const deadline = Date.now() + TIMEOUT
  while (Date.now() < deadline) {
    if (await responds(APP_URL)) return children
    await sleep(300)
  }
  throw new Error(`the dev server did not come up at ${APP_URL}`)
}

function stopDevServer(children) {
  for (const child of children || []) {
    try {
      child.kill('SIGKILL')
    } catch {
      /* already gone */
    }
  }
}

/* ------------------------------------------------------------------ checks */

const checks = []
const pageErrors = []

function check(name, fn) {
  checks.push({ name, fn })
}

const FORM = {
  grade: 'Primary 6',
  subject: 'Mathematics',
  topic: 'Understand and represent ratios',
  curriculumObjective:
    'By the end of the lesson, learners should be able to represent and compare ratios using equivalent forms.',
  classSize: '40',
  durationMinutes: '35',
  constraints:
    'No projector, no printing, no internet during the lesson. Pupils sit in groups of five.',
}

async function fillTheForm() {
  await page.fill('input[name="grade"]', FORM.grade)
  await page.fill('input[name="subject"]', FORM.subject)
  await page.fill('input[name="topic"]', FORM.topic)
  await page.fill('textarea[name="curriculumObjective"]', FORM.curriculumObjective)
  await page.fill('input[name="classSize"]', FORM.classSize)
  await page.fill('input[name="durationMinutes"]', FORM.durationMinutes)
  await page.fill('textarea[name="constraints"]', FORM.constraints)
}

check('the page renders the app and both form sections', async () => {
  const body = await page.bodyText()
  if (!body.includes('Village')) throw new Error('no Village heading')
  if (!body.includes('Lesson request')) throw new Error('no lesson request section')
  if (!body.includes('Your classroom reality')) {
    throw new Error('no classroom reality section')
  }
})

check('Generate is disabled on an empty form', async () => {
  const disabled = await page.isDisabled('button.button-primary')
  if (disabled !== true) throw new Error(`expected disabled, got ${disabled}`)
})

check('a curriculum objective alone still leaves Generate disabled', async () => {
  await page.fill('textarea[name="curriculumObjective"]', FORM.curriculumObjective)
  await page.waitFor(`!!document.querySelector('button.button-primary')`)
  const disabled = await page.isDisabled('button.button-primary')
  if (disabled !== true) throw new Error(`expected disabled, got ${disabled}`)
})

check('adding a material row adds an input', async () => {
  await page.click('.materials-header button')
  const rows = await page.count('input[aria-label="Material name"]')
  if (rows !== 1) throw new Error(`expected 1 material row, got ${rows}`)
})

check('a named material enables Generate', async () => {
  await page.fill('input[aria-label="Material name"]', 'bottle tops')
  await page.fill('input[aria-label="Quantity"]', '40')
  await sleep(150)
  const disabled = await page.isDisabled('button.button-primary')
  if (disabled !== false) throw new Error(`expected enabled, got disabled=${disabled}`)
})

check('the material the teacher typed is still there', async () => {
  const value = await page.evaluate(() =>
    document.querySelector('input[aria-label="Material name"]').value,
  )
  if (value !== 'bottle tops') throw new Error(`material name is "${value}"`)
})

check('removing the material disables Generate again', async () => {
  await page.click('button.button-remove')
  await sleep(150)
  const rows = await page.count('input[aria-label="Material name"]')
  if (rows !== 0) throw new Error(`expected no material rows, got ${rows}`)
  const disabled = await page.isDisabled('button.button-primary')
  if (disabled !== true) throw new Error(`expected disabled, got ${disabled}`)
})

/* ------------------------------------------------------------ generating */

const INVENTORY = [
  ['bottle tops', '40'],
  ['string', '5'],
  ['measuring cups', '2'],
  ['chalk', '1'],
  ['blackboard', '1'],
]

async function addMaterial(name, quantity) {
  await page.click('.materials-header button')
  await page.fillLast('input[aria-label="Material name"]', name)
  await page.fillLast('input[aria-label="Quantity"]', quantity)
  await sleep(60)
}

check('a filled-in request can be generated', async () => {
  await fillTheForm()
  for (const [name, quantity] of INVENTORY) {
    await addMaterial(name, quantity)
  }
  const disabled = await page.isDisabled('button.button-primary')
  if (disabled !== false) throw new Error(`expected enabled, got disabled=${disabled}`)
})

check('the lesson appears after generating', async () => {
  await page.click('button.button-primary')
  await page.waitForSelector('.result-lesson .lesson-title', 20000)
  const title = await page.text('.lesson-title')
  if (!title) throw new Error('the lesson has no title')
  if (!title.includes('ratios')) {
    throw new Error(`the title does not mention the topic: "${title}"`)
  }
})

check('the lesson shows its activities', async () => {
  const activities = await page.count('.activity')
  if (activities < 3) throw new Error(`expected at least 3 activities, got ${activities}`)
  const durations = await page.evaluate(() =>
    [...document.querySelectorAll('.activity-duration')].map((node) =>
      Number(node.textContent.replace(/[^0-9]/g, '')),
    ),
  )
  const total = durations.reduce((sum, minutes) => sum + minutes, 0)
  if (total !== 35) throw new Error(`the activities add up to ${total} minutes, not 35`)
})

check('the feasibility panel gives a verdict', async () => {
  const verdict = await page.text('.verdict-title')
  if (!verdict) throw new Error('no verdict')
  if (verdict !== 'Ready to teach') {
    throw new Error(`expected "Ready to teach", got "${verdict}"`)
  }
})

check('every material is checked against the inventory', async () => {
  const rows = await page.count('.material-check')
  if (rows !== INVENTORY.length) {
    throw new Error(`expected ${INVENTORY.length} material rows, got ${rows}`)
  }
})

check('a material with no count is not quietly called enough', async () => {
  await page.fillLast('input[aria-label="Quantity"]', '')
  await sleep(150)
  await page.click('button.button-primary')
  await page.waitForSelector('.verdict-title', 20000)
  const verdict = await page.text('.verdict-title')
  if (verdict !== 'Needs attention') {
    throw new Error(`expected "Needs attention", got "${verdict}"`)
  }
  const unverified = await page.evaluate(() => {
    const row = document.querySelector('.material-check-quantity-unverified')
    return row ? row.innerText : null
  })
  if (!unverified) throw new Error('no unverified material row')
  if (!unverified.includes('Quantity unverified')) {
    throw new Error(`the row does not say the quantity is unverified: "${unverified}"`)
  }
})

check('the panel says the lesson was rebuilt around the materials', async () => {
  const note = await page.text('.rebuild-note')
  if (!note) throw new Error('the panel does not say the lesson was rebuilt')
  if (!note.includes('rebuilt')) {
    throw new Error(`the rebuild note does not read right: "${note}"`)
  }
})

check('removing a material changes the lesson, not just the verdict', async () => {
  // Put back the quantity cleared by the check above, so this is the money
  // shot on its own: a complete inventory, then one material gone.
  await page.fillLast('input[aria-label="Quantity"]', '1')
  await sleep(150)
  await page.click('button[aria-label="Remove measuring cups"]')
  await sleep(200)

  const rows = await page.count('input[aria-label="Material name"]')
  if (rows !== INVENTORY.length - 1) {
    throw new Error(`expected ${INVENTORY.length - 1} material rows, got ${rows}`)
  }

  await page.click('button.button-primary')
  await page.waitFor(
    `document.querySelectorAll('.material-check').length === ${INVENTORY.length - 1}`,
    20000,
    'the panel to show the new inventory',
  )

  const lessonText = await page.text('.result-lesson')
  if (lessonText.includes('measuring cups')) {
    throw new Error('the lesson still asks for measuring cups')
  }

  const panelText = await page.text('.feasibility')
  if (panelText.includes('measuring cups')) {
    throw new Error('the panel still names the removed material')
  }

  const verdict = await page.text('.verdict-title')
  if (verdict !== 'Ready to teach') {
    throw new Error(`expected "Ready to teach", got "${verdict}"`)
  }
})

check('editing an activity re-checks the lesson', async () => {
  // Ask the first activity for something the teacher does not have.
  await page.click('.activities > .activity:first-child .button-add-material')
  await sleep(150)

  await page.clickLast('.activities > .activity:first-child .activity-material-name')
  await sleep(120)
  await page.fill('.activities > .activity:first-child .editable-input', 'marker pens')
  await page.pressEnter('.activities > .activity:first-child .editable-input')
  await sleep(150)

  await page.clickLast(
    '.activities > .activity:first-child .activity-material-quantity-text',
  )
  await sleep(120)
  await page.fill('.activities > .activity:first-child .editable-input', '2')
  await page.pressEnter('.activities > .activity:first-child .editable-input')

  await page.waitFor(
    `document.querySelector('.verdict-title') && document.querySelector('.verdict-title').textContent.trim() === 'Needs attention'`,
    20000,
    'the panel to flag the edited material',
  )

  const panelText = await page.text('.feasibility')
  if (!panelText.includes('marker pens')) {
    throw new Error('the panel does not name the material the teacher just added')
  }
  if (!panelText.includes('not on your list')) {
    throw new Error('the panel does not say the material is not on the list')
  }
})

check('the edit shows up in the lesson itself', async () => {
  const lessonText = await page.text('.result-lesson')
  if (!lessonText.includes('marker pens')) {
    throw new Error('the lesson does not show the material the teacher added')
  }
})

check('taking the material back out puts the lesson back', async () => {
  await page.click('button[aria-label^="Remove marker pens"]')
  await sleep(150)
  await page.waitFor(
    `document.querySelector('.verdict-title') && document.querySelector('.verdict-title').textContent.trim() === 'Ready to teach'`,
    20000,
    'the panel to clear',
  )
  const lessonText = await page.text('.result-lesson')
  if (lessonText.includes('marker pens')) {
    throw new Error('the lesson still asks for the material the teacher removed')
  }
})

check('the teacher keeps everything they typed after a result', async () => {
  const topic = await page.evaluate(
    () => document.querySelector('input[name="topic"]').value,
  )
  if (topic !== FORM.topic) throw new Error(`the topic is now "${topic}"`)
  // One row was removed by the money shot above, on purpose.
  const rows = await page.count('input[aria-label="Material name"]')
  if (rows !== INVENTORY.length - 1) {
    throw new Error(`expected ${INVENTORY.length - 1} material rows, got ${rows}`)
  }
  const name = await page.evaluate(() => {
    const first = document.querySelector('input[aria-label="Material name"]')
    return first ? first.value : null
  })
  if (name !== INVENTORY[0][0]) throw new Error(`the first material is now "${name}"`)
})

check('on a wide screen the panel sits beside the lesson', async () => {
  await page.setViewport(1280, 900)
  const layout = await page.evaluate(() => {
    const lesson = document.querySelector('.result-lesson').getBoundingClientRect()
    const panel = document.querySelector('.result-panel').getBoundingClientRect()
    return {
      lessonRight: lesson.right,
      lessonBottom: lesson.bottom,
      panelLeft: panel.left,
      panelTop: panel.top,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    }
  })
  if (layout.overflow > 1) {
    throw new Error(`the page overflows sideways by ${layout.overflow}px`)
  }
  if (layout.panelLeft < layout.lessonRight) {
    throw new Error('the panel overlaps the lesson')
  }
  if (layout.panelTop > layout.lessonBottom) {
    throw new Error('the panel has dropped below the lesson')
  }
})

check('on a narrow screen the panel drops below the lesson', async () => {
  await page.setViewport(380, 800)
  const layout = await page.evaluate(() => {
    const lesson = document.querySelector('.result-lesson').getBoundingClientRect()
    const panel = document.querySelector('.result-panel').getBoundingClientRect()
    return {
      panelTop: panel.top,
      lessonBottom: lesson.bottom,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    }
  })
  if (layout.overflow > 1) {
    throw new Error(`the page overflows sideways by ${layout.overflow}px`)
  }
  if (layout.panelTop < layout.lessonBottom) {
    throw new Error('the panel overlaps the lesson on a narrow screen')
  }
  await page.setViewport(1280, 900)
})

check('the page raised no uncaught errors', () => {
  if (pageErrors.length > 0) {
    throw new Error(pageErrors.join(' | '))
  }
})

/* -------------------------------------------------------------------- run */

let page
let devServer = null
let chrome = null
let profile = null
try {
  console.log('starting the dev server…')
  devServer = await startDevServer()

  profile = await mkdtemp(path.join(tmpdir(), 'village-chrome-'))
  chrome = spawn(
    CHROME,
    [
      '--headless',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--no-default-browser-check',
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${profile}`,
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'ignore'] },
  )

  let version = null
  const deadline = Date.now() + TIMEOUT
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`)
      version = await response.json()
      break
    } catch {
      await sleep(200)
    }
  }
  if (!version) throw new Error('Chrome never exposed a DevTools endpoint')

  const cdp = new CdpClient(new WebSocket(version.webSocketDebuggerUrl))
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await cdp.send('Target.attachToTarget', {
    targetId,
    flatten: true,
  })

  page = new Page(cdp, sessionId)
  await page.send('Page.enable')
  await page.send('Runtime.enable')
  cdp.on('Runtime.exceptionThrown', (params) => {
    pageErrors.push(
      params.exceptionDetails?.exception?.description ||
        params.exceptionDetails?.text ||
        'unknown page exception',
    )
  })

  await page.goto(APP_URL)
  await page.waitForSelector('button.button-primary')

  console.log(`\nVillage — browser check (${APP_URL})\n`)
  let failed = 0
  for (const { name, fn } of checks) {
    try {
      await fn()
      console.log(`  ok  ${name}`)
    } catch (error) {
      failed += 1
      console.log(`FAIL  ${name}`)
      console.log(`      ${error.message.split('\n')[0]}`)
    }
  }

  console.log(`\n${checks.length - failed} passed, ${failed} failed`)
  if (failed > 0) process.exitCode = 1

  if (process.env.CHECK_SCREENSHOT) {
    await page.screenshot(process.env.CHECK_SCREENSHOT)
    console.log(`screenshot: ${process.env.CHECK_SCREENSHOT}`)
  }
} catch (error) {
  console.error(`\nbrowser check could not run: ${error.message}`)
  process.exitCode = 1
} finally {
  if (chrome) {
    chrome.kill('SIGKILL')
    await sleep(300)
  }
  if (profile) {
    await rm(profile, { recursive: true, force: true, maxRetries: 5 }).catch(() => {})
  }
  stopDevServer(devServer)
}
