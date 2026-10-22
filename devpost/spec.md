---
doc: spec
status: approved
---

# Village — Technical Spec

## How This Works, In Plain Language

Village has three parts:

1. **The page (React).** One screen in the browser: the form at the top, the lesson and feasibility panel below it after generation. All the teacher types lives in the page itself — nothing is saved to a database, and refreshing starts clean, which is what the PRD asked for.
2. **A tiny middleman server (Express).** The page can't call the AI directly without exposing the API key, so a small local server holds the key and passes requests to Groq. It has one job: receive the form data, orchestrate the generate-and-check loop, send back the finished lesson plus the verdict.
3. **The checker (plain JavaScript, no AI).** This is the trustworthy heart of Village. The AI returns the lesson as structured data — each activity lists the materials it needs and how much. The checker is ordinary code that compares that list against the teacher's inventory and does arithmetic on the timings. It produces the verdict. The AI never grades its own homework; it describes, and the code checks.

The loop when something's short: checker finds the shortfall (e.g. "lesson needs 10 measuring cups, inventory has 2") → the middleman asks Groq to rebuild the lesson with that exact shortfall spelled out → the new lesson goes through the checker again → repeat at most twice. If it still fails, the teacher sees the lesson with a **Needs attention** verdict and the specific shortfalls named — never a quiet pass.

## The Core Journey Through the System

1. Teacher opens `localhost` in the browser → React renders the empty form; Generate is disabled.
2. They fill the request and reality sections, add material rows → Generate enables once the curriculum field and at least one material exist.
3. They click Generate → the page shows "Building your lesson…" and sends the form data to `POST /api/generate` on the local Express server.
4. Express sends a prompt to Groq asking for strict JSON: lesson object + declared material requirements per activity + assessment-objective declarations.
5. Groq replies with JSON → Express runs the deterministic checker against the teacher's materials, timings, and inputs.
6. If the checker fails → Express rebuilds via Groq with the shortfall details (max 2 rebuilds) → re-checks.
7. Express returns `{ lesson, feasibility }` → the page renders the lesson beside the feasibility panel with the verdict.
8. Teacher edits activity text in place → page re-sends the edited lesson + original inputs to `POST /api/check` → checker runs again → panel updates. Edits are never trusted.
9. Teacher clicks Print / Export → browser print dialog on a print-styled view including the feasibility panel.

PRD ref: `prd.md > The Core Journey`.

## Stack

- **React 18 + Vite** — page and components. Rationale: the learner has used React before; Vite is the standard zero-config dev setup. Tradeoff: a build tool exists, but `npm run dev` hides it.
- **Express 4** — local middleman server holding the API key and running the checker. Rationale: the key must never sit in browser code; one small server is the simplest shape that achieves that.
- **Groq JavaScript SDK (`groq-sdk`)** — AI calls. Rationale: learner already has a Groq key; free tier, fast, OpenAI-compatible. Tradeoff: free-tier rate limits and a model list that changes; model name verified at the start of the build.
- **No database.** PRD requires nothing persist between sessions.
- **Axios or fetch** — plain `fetch` from the browser to the local server; no extra HTTP library.
- Docs: [Groq docs](https://console.groq.com/docs), [React](https://react.dev), [Vite](https://vitejs.dev), [Express](https://expressjs.com).

## Where It Runs and How Someone Tries It

Runs locally on the learner's machine; browser UI + local Node server. Requirements: Node 18+, a Groq API key in a `.env` file (`GROQ_API_KEY=...`).

Start:

```
npm install
npm run dev     # starts Express on :3001 and Vite on :5173 (proxies /api)
```

Open `http://localhost:5173`. This is also the demo-recording setup — deployment is optional and not planned; `6-ship` can revisit if desired. Submission needs the short demo video + public GitHub repo; a local app recorded on screen satisfies both.

**Public repository:** <https://github.com/Udeibom/village> — created and pushed on 2026-10-22 with the learner's explicit authorisation. Public, default branch `main`, full build history. What was checked before publishing: no API key and no `.env` in the history, `devpost/learner-profile.md` ignored and never committed, and the local machine path trimmed out of the handoff note.

**Demo video:** <https://github.com/Udeibom/village/releases/download/demo-1/village-demo.mp4> — 1:58, 1440×900, silent (the on-screen text carries the story, so a voice-over can be added on upload). Recorded 2026-10-22 from the running local app on a private headless Chrome, so no part of the learner's own desktop is in it. Also committed at `demo/village-demo.mp4`; `demo/record-demo.mjs` is the script that recorded it, `demo/screenshot.mjs` takes the picture the README shows. Shows, in order: the classroom (40 pupils, 35 minutes, no projector), the refusal on "beans — a bag", the teacher editing the lesson to ask for "marker pens" and the checker naming it as not on the list without asking a model anything, the lesson changing when the measuring cups are deleted from the inventory, the timings added up in code to exactly 35 minutes, the curriculum extract quoted back, the lesson banked as "Worked", and the app working with the connection cut.

## Look and Feel

Carried from `prd.md > Look and Feel`: warm paper-and-chalk character, readable serif/humanist fonts (e.g. a serif like "Source Serif" or system Georgia for headings, humanist sans for body), muted earth tones — clay, charcoal, warm paper background — no blue-purple gradients. Feasibility panel styled like a marked-up checklist; plain-language pass/fail lines. Interface copy in a competent-colleague tone, including the fixed honesty line: *"Illustrative draft — review against your curriculum and your pupils' prior knowledge."* Plain CSS (a single stylesheet), no component library — keeps the warm look under the learner's control instead of fighting a framework's defaults.

## Components

### Page (`App.jsx`)
Holds all form state and the current lesson/feasibility result in React state. Nothing persisted. Enables Generate per `prd.md > States and Boundaries` (curriculum + ≥1 material).

### Lesson request + reality forms
Grade, subject, topic/learning objective, curriculum objective (required textarea); class size, duration, constraints free text; materials as name+quantity rows with add/remove. Implements `prd.md > Declaring the classroom reality`.

### Materials list subcomponent
Row state `{ name, quantity }`, both free text; remove-row button powers the money-shot re-check. Implements `prd.md > Declaring the classroom reality`.

### Lesson display + in-place editing
Renders the returned lesson: intro, activities (name, duration, instructions, materials used with quantity, understanding check, adaptations), assessment. Activity text editable in place; on edit, calls re-check with edited lesson. Implements `prd.md > Editing and re-checking`.

### Feasibility panel
Top-line **Ready to teach** / **Needs attention**; per-check rows: materials (enough / short by X / not listed), timing, assessment-objective (with reason), curriculum honesty line. Implements `prd.md > The feasibility check`.

### Print / Export view
Print-styled rendering of lesson + feasibility panel via `window.print()` and a print stylesheet. Implements `prd.md > Export`.

### Express server (`server/index.js`)
`POST /api/generate` — receives form data, runs the generate→check→rebuild loop (max 2 rebuilds), returns `{ lesson, feasibility }`. `POST /api/check` — receives an edited lesson + original inputs, runs the checker only, returns `{ feasibility }`. Serves nothing else; in dev, Vite proxies to it.

### Groq client (`server/grok.js`)
Builds prompts, calls Groq with strict JSON response format, parses and validates shape. Two prompt jobs: initial generation, and rebuild-with-shortfall. Returns parsed lesson object or throws.

### Deterministic checker (`shared/validate.js`)
The kernel. Pure functions, no AI, no network, no Node-only code — the browser runs this exact file, which is what makes the app work with no internet:
- **Materials:** for each material the lesson requires, match against inventory by case-insensitive name. If both quantities parse as numbers → compare (enough / short by X). If either is non-numeric ("a bag") → presence-only match, and the row shows "quantity unverified" honestly.
- **Timing:** sum activity durations; pass if the total fits within the stated duration (2-minute tolerance); flag overruns and large underfills (< 60% of duration).
- **Assessment:** the AI must declare which objective each assessment activity serves; checker verifies at least one declared link matches the stated objective, and surfaces the AI's reason. (It verifies the declared trace — pedagogical truth stays with the teacher, per the honesty line.)
- **Curriculum:** when the teacher has pasted their own curriculum document, the document decides the row — the objective is searched for in the document's lines, and the row quotes the line it found ("Your curriculum document says: …"), or reports plainly that the objective could not be found there. The model's own confidence claim is not consulted when a document is present. With no document the row says the match is unverified.
- Verdict: **Ready to teach** only when all four pass; otherwise **Needs attention** with specifics.
Implements `prd.md > The feasibility check` and `prd.md > Rebuilding around what's available`.

### Timing fitter (`server/timing.js`)
`fitActivitiesToBudget(activities, minutes)` scales the activity durations proportionally onto the lesson's budget, keeps their order and their number, gives every activity at least a minute, and lands the total exactly on the budget. A lesson already within the check's 2-minute tolerance is left untouched. The generate→check→rebuild loop fits before it checks, so the model is never asked to be good at arithmetic, and the panel says when it happened.

## Data Model

All state is in-memory on the server (React state + request payloads). Nothing is stored server-side between requests.

On the teacher's own device, `localStorage` holds the shelf (their classroom: the form and its materials), the classroom's record of what was taught, and the curriculum document — under versioned keys, with corrupt or outdated data falling back safely rather than throwing. Nothing is sent to any service.

**Form state (page):** `{ grade, subject, topic, learningObjective, curriculumObjective, curriculumDocument, classSize, durationMinutes, constraints, materials: [{ name, quantity }] }`

**Lesson object (returned by Groq, round-tripped for checks):**
```
{
  title, intro,
  activities: [{
    name, durationMinutes, instructions,
    materials: [{ name, quantityNeeded }],
    understandingCheck,
    servesObjective  // declared link, used by the assessment check
  }],
  adaptations, assessment: { instructions, servesObjective },
  curriculumConfidence: "aligned" | "unverified",
  curriculumNote
}
```

**Feasibility object (produced by checker):**
```
{
  verdict: "ready" | "attention",
  checks: {
    materials: [{ name, status: "ok"|"short"|"missing"|"quantity-unverified", detail }],
    timing: { status, detail },
    assessment: { status, detail },
    curriculum: { status, detail }
  },
  rebuildsAttempted,
  timingFitted: { fitted, before, after }   // only when the timings were fitted
}
```

## File Structure

```
village/
├── shared/
│   └── validate.js     # the kernel — pure, no imports; run by the server AND the browser
├── server/
│   ├── index.js        # Express: /api/generate, /api/check, loop orchestration
│   ├── groq.js         # Groq client, prompts, JSON parsing
│   ├── rebuild.js      # write → check → rebuild → check again
│   ├── check.js        # re-check an edited lesson without writing a new one
│   ├── curriculum.js   # find the teacher's objective in the teacher's own document
│   ├── timing.js       # fit activity timings to the lesson's budget in code
│   └── stub.js         # a fixed lesson, so the browser check is free and deterministic
├── src/
│   ├── main.jsx
│   ├── App.jsx         # page state, generate/check calls
│   ├── api.js          # fetch wrappers to /api/*
│   ├── styles.css      # paper-and-chalk styling + print styles
│   ├── lib/
│   │   ├── formRules.js  # when Generate is enabled
│   │   ├── store.js      # localStorage: shelf, bank, curriculum document
│   │   ├── bank.js       # the classroom's record of what was taught
│   │   ├── reuse.js      # which banked activity fits this lesson
│   │   ├── lessonCard.js # the portable lesson file a colleague can import
│   │   ├── localCheck.js # the kernel, run in the browser (no internet needed)
│   │   └── materialRows.js
│   └── components/
│       ├── LessonRequestForm.jsx
│       ├── RealityForm.jsx
│       ├── MaterialsList.jsx
│       ├── LessonPlan.jsx      # render + in-place edit
│       ├── FeasibilityPanel.jsx
│       ├── OutcomeStrip.jsx    # "how did it go?"
│       ├── BankPanel.jsx       # this classroom's record
│       ├── CurriculumDocument.jsx
│       └── PrintView.jsx
├── scripts/
│   ├── verify.js       # assertions on the checker's pure logic (npm run verify)
│   ├── browser-check.js # drives the real UI in headless Chrome (npm run browser-check)
│   └── ai-check.js     # a live run against Groq (npm run ai-check)
├── index.html
├── package.json
├── .env.example        # GROQ_API_KEY=your_key_here
├── .gitignore          # existing rules + .env (never commit the key)
├── vite.config.js      # dev proxy /api → :3001
└── README.md           # start instructions for 6-ship
```

(`devpost/` and `village.md` sit alongside; learner-profile stays ignored per the existing `.gitignore`.)

`scripts/` holds the mechanical verification the build needs, with no test framework and no new dependencies: `verify.js` asserts the checker's pure functions against fixtures (plain `assert`, run by `node`), and `browser-check.js` drives the running app in headless Chrome over the DevTools protocol (Node's built-in `WebSocket` and `fetch` only) to assert what a teacher would actually see — the Generate button's enabled state, the rendered lesson, the verdict text, and the money shot. The example lesson lives inside `verify.js` as a fixture, not as a product surface.

## External Services and Dependencies

- **Groq API** — endpoint `https://api.groq.com/openai/v1/chat/completions` (via `groq-sdk`); auth: bearer key from `GROQ_API_KEY`; request uses strict JSON schema mode (`response_format: { type: "json_schema", json_schema: { strict: true } }`). Model: **`openai/gpt-oss-120b`** — *verified on day one of the build*. The spec originally intended `llama-3.3-70b-versatile`, but Groq retired that model on 2026-08-16 for free and developer tiers and it no longer appears in the models API. `openai/gpt-oss-120b` is Groq's current production replacement and supports strict JSON schema mode, so the lesson object cannot come back malformed. The model id is read from `GROQ_MODEL` (default `openai/gpt-oss-120b`) rather than hardcoded, because Groq's catalog changes and a pinned id has to be swappable in one place. Free tier has per-minute rate limits, no cost expected for demo volume. Docs: https://console.groq.com/docs
  - `openai/gpt-oss-120b` is a reasoning model: Groq returns the reasoning trace in a separate `message.reasoning` field and the JSON payload in `message.content`. Only `content` is parsed. `reasoning_effort` is set to `low` to keep generation fast.
- **npm packages** — react, react-dom, vite, express, groq-sdk, dotenv, concurrently (dev). No paid packages.

## Important Failure Modes

- **Groq call fails or times out** → plain-language error under the form ("Couldn't build the lesson — the AI service didn't respond. Try again in a moment.") with a Try again button; **all form data preserved** (PRD requirement).
- **Groq returns malformed JSON** → one automatic repair-prompt retry; if it fails again, same error state as above.
- **Rate limit hit** → error message says to wait a few seconds and try again; form preserved.
- **No internet** → the browser says so plainly ("No internet connection. Village still opens, still checks your lessons and still prints them"), and only writing a *new* lesson is refused, with a message saying what still works. Everything else — the shelf, the classroom's record, the checks, the edits and the print-out — runs in the browser against the shared kernel.
- **Rebuilds exhausted (2) with checks still failing** → return the lesson anyway with **Needs attention** and the exact shortfalls listed — never a silent pass.

## What Was Simplified and Why

- **Checker verifies declared assessment-objective links rather than judging pedagogy** — true pedagogical judgment isn't reliably automatable; the honesty line keeps the teacher as the final authority (kernel preserved: the check still can't be skipped or gamed into a pass).
- **Non-numeric quantities get presence-only matching with "quantity unverified"** instead of unit parsing — honest partial checking beats a fake precise one.
- **No server-side persistence / no database** — the server keeps nothing between requests; what the teacher keeps lives on their own device, which is the point of the classroom record.
- **Local run only, no deployment** — recording the local app satisfies submission; hosting would add setup without proving the kernel.

## Decisions and Open Issues

Learner decisions:
- **Groq for AI** — already has a key; free. Tradeoff accepted: rate limits, changing model catalog.
- **React + Vite + small Express server** — familiar to the learner; key stays off the client. Accepted tradeoff: two processes in dev (one `npm run dev` command runs both).
- **No database, nothing persists** — matches PRD; refresh starts clean.

Derived from PRD (not separately decided): strict-JSON lesson shape, deterministic checker, max-2 rebuild loop, re-check endpoint for edits, print stylesheet.

Useful unknown: the learner didn't name an uncertainty; the AI-call and checking pieces were explained in plain language during this conversation ("the AI describes, the code checks").

Open issues:
- ~~**Verify the current Groq model name and JSON-mode support** on day one of the build~~ — **resolved 2026-10-21**: `llama-3.3-70b-versatile` was retired on 2026-08-16 and is gone from the models API; `openai/gpt-oss-120b` was confirmed live with strict JSON schema mode (the JSON arrives in `message.content`, the reasoning trace in `message.reasoning`). The model id is read from `GROQ_MODEL`.
- Whether Vite's proxy or a single production-style Express static serve is smoother for the demo — resolve during the first build step; either satisfies the run instructions.
