# Where we are

**Status: all twelve build slices are built, verified and committed. The next thing is
`6-ship` — the demo video, the public GitHub repository and your own Devpost submission.**

If you are reading this in a new chat, you do not need the old chat. Everything below is
enough to continue.

## How to come back to this

Your chat is stored on disk, so the quickest route is to resume it:

```bash
cd village
opencode --continue                              # pick up the last session in this folder
```

If that does not work, start a fresh chat in this folder and say:

> Read `devpost/where-we-are.md` and tell me what to do.

Either way, the work itself is committed in git — nothing is only in the chat.

## What is done

The first five slices built the core: the teacher form, Generate with Groq, the
deterministic checker, the rebuild loop, in-place editing and the print page. The final
review was done and confirmed by the learner.

Then the scope was widened with the learner's yes, and seven more slices were built on top
of it — the things a chat window structurally cannot follow:

6. **The classroom is remembered on the teacher's own machine** — the shelf, the materials
   and the record live in `localStorage`, with a "Forget this classroom" button.
7. **"How did it go?"** — the teacher marks a lesson as worked, changed or failed, with an
   optional note, and it is banked in the classroom's record.
8. **The next lesson is planned around what worked before** — the reuse rules are code, not
   the model: proved here, materials on the shelf, class size and lesson length within a
   quarter, the activity no more than 60% of the budget, same subject and year group.
9. **A proven lesson travels** — one small file a colleague can import, labelled as a
   candidate until it is proved in the receiving classroom.
10. **The curriculum check uses the teacher's own document** — the objective is searched for
    in their pasted or uploaded extract, and the row quotes the line it found. With a
    document present, the document decides; the model's own confidence claim does not.
11. **The timings are fitted in code** — `server/timing.js` scales the activity minutes onto
    the lesson's budget, keeps the order, and the panel says it did.
12. **The app works with no internet** — the kernel moved to `shared/validate.js` so the
    browser runs the same checker as the server. Checking, editing, the classroom's record
    and the print-out all work offline; only writing a new lesson needs a connection, and
    it says so plainly.

Verification at the last commit:

| Check | Result |
| --- | --- |
| `npm run verify` | 114 passed, 0 failed |
| `npm run browser-check` | 50 passed, 0 failed |
| `npm run ai-check` (live Groq) | last run: two lessons, both at exactly 35 minutes, both verdicts honest |

## What is left

**`6-ship`** — the demo video, the public GitHub repository, and your own Devpost
submission. That skill picks up from `devpost/` and needs no help from this file. Three
things it will want from you, all of them yours to write:

- the demo video (the beats are in `devpost/positioning.md`; lead with the refusal, not the
  generator)
- the Devpost submission text in your own words
- the public repository (the repo is currently local only)

Two smaller pieces of housekeeping that `6-ship` may want:

- `devpost/app-map.html` still cites `server/validate.js`; the kernel moved to
  `shared/validate.js` when slice 12 landed, and the map does not yet mention
  `shared/text.js`, `shared/curriculum.js`, `server/timing.js`, the bank, the reuse rules or
  the lesson card.
- the learner profile stays ignored, per the existing `.gitignore`.

## Running it again

```bash
cd village
npm install
cp .env.example .env     # then paste your GROQ_API_KEY into .env
npm run dev             # page on http://localhost:5173, API on :3001
```

| Command | What it does | Costs money? |
| --- | --- | --- |
| `npm run verify` | 114 assertions on the rules, no browser, no API calls | no |
| `npm run browser-check` | 50 checks driving the real app in headless Chrome | no — the AI is stubbed |
| `npm run ai-check` | a live run against Groq | yes, a little |

## Things that will bite you

- **Do not use `pkill -f` to stop the servers.** The pattern matches the command you are
  running, so it kills your own shell. Use `fuser -k 3001/tcp` instead, or start the server
  with `(nohup npm run dev > /tmp/opencode/dev.log 2>&1 &)`.
- **The model id is `openai/gpt-oss-120b`**, set by `GROQ_MODEL`. `llama-3.3-70b-versatile` was
  retired by Groq; the spec's fallback clause applies.
- **The browser check starts its own servers** on 5174 and 3011 with the AI stubbed
  (`VILLAGE_STUB=1`), so it never disturbs a dev server you already have open. It also
  emulates a dead internet part-way through, to prove the offline claims.
- **`.env` is ignored and holds the API key.** The key never reaches the browser; the server
  holds it and the page talks to the server through Vite's `/api` proxy.
- **The stub deliberately over-runs the lesson** (it plans five minutes longer than asked),
  so the timing fitter is exercised on every browser-check generation.

## Where things live

```
devpost/
  checklist.md      the build plan and the progress state — the ticked boxes are the truth
  prd.md            what the product does
  scope.md          the one promise the product has to keep
  spec.md           the technical blueprint the build followed
  positioning.md    why not ChatGPT, the pitch, the demo beats
  app-map.html      the take-home map of the finished code
  where-we-are.md   this file
shared/
  validate.js       the kernel — plain functions, no AI; run by the server AND the browser
  text.js           word normalisation and the four-letter matching keys
  curriculum.js     finding the teacher's objective in the teacher's own document
server/
  index.js          Express: /api/generate, /api/check
  grok.js           the AI: prompts, strict JSON, shape checks
  rebuild.js        write, fit timings, check, rebuild, check again (max 2 rebuilds)
  check.js          re-check an edited lesson without writing a new one
  timing.js         fitting the activity minutes onto the lesson's budget
  stub.js           a fixed lesson so the browser check is free and deterministic
src/
  App.jsx           page state, the generate flow, the debounced local re-check
  api.js            fetch wrappers to /api/*
  components/       the form, the curriculum document, the lesson, the panel, the bank,
                    the outcome strip, the print view
  lib/              formRules, store (localStorage), bank, reuse, lessonCard, localCheck
scripts/
  verify.js         assertions on the pure logic
  browser-check.js  headless-Chrome checks against the running app
  ai-check.js       a live run against Groq
```

## The one sentence to keep

The AI writes the lesson; the code checks it. The model is never asked to grade its own
homework, and a lesson that says "ready to teach" has been through
`shared/validate.js` — not through the model's opinion of itself.
