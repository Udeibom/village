# Village

Lesson plans that fit the room you actually have.

Village takes a lesson request (grade, subject, objective, your curriculum
standard) and your classroom reality (class size, duration, constraints,
materials with quantities), then builds a lesson around what you have — and
checks its own work before it calls the lesson ready.

The point is the check. An AI will happily write a lesson that needs a
projector you do not have. Village does not: the lesson is written, then a
plain-JavaScript checker compares every material the lesson asks for against
the list you typed, adds up the timings, and confirms that an assessment
activity actually tests your objective. If something does not add up, the
lesson is rebuilt around what you do have.

## Running it

You need Node 18 or newer and a free Groq API key.

```bash
npm install
cp .env.example .env      # then paste your key into .env
npm run dev
```

Open <http://localhost:5173>. `npm run dev` starts two processes: the React
page on 5173 and the local server on 3001, which holds the API key so the
browser never sees it. The page talks to the server through Vite's `/api`
proxy.

Nothing is saved between sessions — refresh and you start clean.

## Checks

```bash
npm run verify         # assertions on the rules (no browser, no API calls)
npm run browser-check  # drives the real app in headless Chrome
```

`npm run browser-check` starts the dev server if it is not already running,
opens the app in headless Chrome, and asserts on what a teacher would see —
whether the Generate button is enabled, that a lesson renders, and what the
feasibility panel says.

## How it is put together

```
server/
  index.js      Express: /api/generate, /api/check, the generate-check-rebuild loop
  groq.js       Groq client: prompts, strict JSON, parsing and shape checks
  validate.js   the deterministic feasibility checker — plain functions, no AI
src/
  App.jsx       page state
  components/   the form, the lesson, the feasibility panel, the print view
  lib/          rules that decide when Generate is enabled
scripts/
  verify.js         assertions on the pure logic
  browser-check.js  headless-Chrome checks against the running app
```

The division of labour matters: **the AI describes, the code checks.** The
model is never asked to grade its own homework.

## What Village does not do

It is not an authority on curriculum compliance. It reports what it can
verify from what you gave it and flags the rest. The last line of every
lesson stays with you:

> Illustrative draft — review against your curriculum and your pupils' prior
> knowledge.
