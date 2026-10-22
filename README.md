# Village

Lesson plans that fit the room you actually have.

![Watch the demo](demo/village-demo.mp4)

**Watch it work (1:29):** <https://github.com/Udeibom/village/releases/download/demo-1/village-demo.mp4>

The planning documents this was built from, kept in the repository:

- [scope.md](devpost/scope.md) — the idea, narrowed to one thing
- [prd.md](devpost/prd.md) — what it does, for whom
- [spec.md](devpost/spec.md) — how it is built
- [checklist.md](devpost/checklist.md) — the build, slice by slice
- [app-map.html](devpost/app-map.html) — the app on one page

MIT licensed.

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

Your classroom is kept on your own device, not on a server: the materials you
listed, the lessons you taught and how they went, and your curriculum
extract. Nothing is sent anywhere, and "Forget this classroom" clears it.

`.env` holds two things:

```
GROQ_API_KEY=your-key-here
GROQ_MODEL=openai/gpt-oss-120b
```

The key stays on the server. The model name is yours to change if you want a
different one; the app checks the lesson either way, so a different model
changes the wording, not the guarantee.

## What you can do with it

1. **Ask for a lesson.** Grade, subject, topic, and the curriculum objective
   you are covering. The Generate button stays disabled until there is
   something to generate from.
2. **Say what you have.** Class size, how long you have, anything that limits
   the lesson, and your materials with quantities. A material with no count is
   treated as "not verified", not as "plenty".
3. **Paste your curriculum.** If you have the scheme-of-work line this lesson
   covers, Village searches *your* document for it and quotes the line it
   found. With a document in front of it, the document decides — not the
   model's opinion of itself.
4. **Read the verdict.** The panel on the right says whether the lesson can be
   taught with what is on the table, names every material that does not line
   up, adds up the timings, and checks that the assessment tests your
   objective.
5. **Change your mind.** Edit any line of the lesson, add a material to an
   activity, or change your inventory. The lesson is checked again straight
   away, and the verdict follows your edit.
6. **Say how it went.** Mark the lesson as worked, changed or failed. That
   goes into your classroom's record, with the date and the class size.
7. **Plan the next one around what worked.** The next lesson offers the
   activity you proved, if the rules allow it: proved here, materials on the
   shelf, class size and lesson length close enough, same subject and year
   group. The rules are code, not the model's judgement.
8. **Hand it to a colleague.** A proven lesson exports as one small file. The
   file is a candidate, not a claim — it says "not yet proved here" until
   somebody teaches it and marks it as worked.
9. **Take it to the room.** Print / Export gives you a page with the lesson
   and the verdict and nothing else on it.

Village also works with no internet. The checker is a plain file that the
browser runs, so editing a lesson, re-checking it, reading your record and
printing all keep working when the connection does not. Only writing a *new*
lesson needs it, and it says so plainly.

## Checks

```bash
npm run verify         # 114 assertions on the rules (no browser, no API calls)
npm run browser-check  # 50 checks driving the real app in headless Chrome
npm run ai-check       # a live run against Groq (costs a little money)
```

`npm run browser-check` starts the dev server if it is not already running,
opens the app in headless Chrome, and asserts on what a teacher would see —
whether the Generate button is enabled, that a lesson renders, and what the
feasibility panel says. It runs the app in stub mode, so it never calls
Groq and never costs anything.

`npm run ai-check` is the other way around: it makes real calls and tells
you what the model actually produced, for a full inventory and a reduced one.

## How it is put together

```
shared/
  validate.js   the deterministic feasibility checker — plain functions, no AI.
                Lives here so the browser and the server run the same file.
  text.js       word normalisation and the four-letter matching keys
  curriculum.js finding the teacher's objective in the teacher's own document
server/
  index.js      Express: /api/generate, /api/check, the generate-check-rebuild loop
  grok.js       Groq client: prompts, strict JSON, parsing and shape checks
  rebuild.js    the loop: write, fit the timings, check, rebuild around what is missing
  check.js      re-check an edited lesson, without writing a new one
  timing.js     fitting the activity minutes onto the lesson's budget
  stub.js       a fixed lesson for the browser checks, so they cost nothing
src/
  App.jsx       page state
  components/   the form, the curriculum document, the lesson, the feasibility
                panel, the outcome strip, the classroom record, the print view
  lib/          form rules, the device store, the classroom record, the reuse
                rules, the lesson card, the in-browser checker
scripts/
  verify.js         assertions on the pure logic
  browser-check.js  headless-Chrome checks against the running app
  ai-check.js       a live run against Groq
```

The division of labour matters: **the AI describes, the code checks.** The
model is never asked to grade its own homework.

## What Village does not do

It is not an authority on curriculum compliance. It reports what it can
verify from what you gave it and flags the rest. The last line of every
lesson stays with you:

> Illustrative draft — review against your curriculum and your pupils' prior
> knowledge.
