// Drives the running app in headless Chrome over the DevTools protocol and
// asserts on what a teacher would actually see — the button's enabled state,
// the rendered lesson, the verdict text. No dependencies beyond Node's own
// WebSocket and fetch.
//
//   npm run browser-check
//
// Starts the dev server itself if one is not already running, then stops it.

import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

const APP_URL = process.env.APP_URL || 'http://localhost:5173'
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

  async click(selector) {
    const found = await this.evaluate((sel) => {
      const element = document.querySelector(sel)
      if (!element) return false
      element.click()
      return true
    }, selector)
    if (!found) throw new Error(`nothing matches ${selector} to click`)
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
  const server = spawn(process.execPath, ['server/index.js'], { stdio: 'ignore' })
  const web = spawn(
    process.execPath,
    ['node_modules/vite/bin/vite.js', '--port', '5173', '--strictPort'],
    { stdio: 'ignore' },
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
  if (!(await responds(APP_URL))) {
    console.log('starting the dev server…')
    devServer = await startDevServer()
  }

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
