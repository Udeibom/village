# Where we are

**Status: the proof of concept is built, verified, reviewed and ready to ship. The only
unfinished thing is a two-minute learning exercise, and then `6-ship`.**

If you are reading this in a new chat, you do not need the old chat. Everything below is
enough to continue.

## How to come back to this

Your chat is stored on disk, so the quickest route is to resume it:

```bash
cd /home/caleb/village
opencode --continue                              # pick up the last session in this folder
opencode --session ses_ea1e9621affeajt79gUX6zNt62   # or this exact one
```

If that does not work, start a fresh chat in this folder and say:

> Read `devpost/where-we-are.md` and tell me what to do.

Either way, the work itself is committed in git — nothing is only in the chat.

## What is done

All five build slices, each verified, committed and ticked in `devpost/checklist.md`:

1. The teacher form, and a Generate button that stays disabled until there is something to
   generate from.
2. Generate a lesson with Groq, and check it against the teacher's inventory with plain
   JavaScript.
3. When something is short, rebuild the lesson around what is actually available.
4. Edit the lesson in place; the check runs again straight away.
5. A print / export page, and a finished README.

The final review is done. You walked the whole journey, found one gap (the in-place editing
was not discoverable), that was fixed and re-tested, and you confirmed it.

Verification at the last commit:

| Check | Result |
| --- | --- |
| `npm run verify` | 50 passed, 0 failed |
| `npm run browser-check` | 27 passed, 0 failed |
| `npm run ai-check` (live Groq) | two lessons, both at exactly 35 minutes, both verdicts honest |

## What is left

**1. The learning exercise (about two minutes).** It is the one thing the teacher has not
done yet, and it is the most transferable thing in the project.

The story: a live Groq run produced an assessment that said it tested *"students will
demonstrate understanding by correctly forming and comparing ratios"* while the teacher's
objective was *"understand and represent ratios"*. The checker called that a mismatch and
told the teacher the lesson needed attention. **It was wrong.** The fix was in
`server/validate.js` → `matchingKey`: words are compared on their first four letters, so
"comparing" and "compare" are the same word. The lesson: when a check fails on real output,
decide which side is wrong before changing either — and make sure the check is capable of
failing at all.

Do it like this:

1. Open `scripts/verify.js` and find the case *"an assessment that describes the objective in
   its own words still counts"* (around line 286). That is the live failure, frozen into a test.
2. Add one case of your own underneath it with a different word pair, and run
   `npm run verify`. It should pass.
3. Now break it on purpose: in `server/validate.js` line 43, change
   `return word.length > 4 ? word.slice(0, 4) : word` to `return word`. Run `npm run verify`
   and watch the suite fail — and read which case failed and why. Then put it back.

**2. The app map** — `devpost/app-map.html` is generated and checked. Open it in a browser
(`open devpost/app-map.html`).

**3. `6-ship`** — the demo video, the public GitHub repository, and your own Devpost
submission. That skill picks up from `devpost/` and needs no help from this file.

## Running it again

```bash
cd /home/caleb/village
npm install
cp .env.example .env     # then paste your GROQ_API_KEY into .env
npm run dev             # page on http://localhost:5173, API on :3001
```

| Command | What it does | Costs money? |
| --- | --- | --- |
| `npm run verify` | 50 assertions on the rules, no browser, no API calls | no |
| `npm run browser-check` | 27 checks driving the real app in headless Chrome | no — the AI is stubbed |
| `npm run ai-check` | a live run against Groq | yes, a little |

## Things that will bite you

- **Do not use `pkill -f` to stop the servers.** The pattern matches the command you are
  running, so it kills your own shell. Use `fuser -k 3001/tcp` instead, or start the server
  with `(nohup npm run dev > /tmp/opencode/dev.log 2>&1 &)`.
- **The model id is `openai/gpt-oss-120b`**, set by `GROQ_MODEL`. `llama-3.3-70b-versatile` was
  retired by Groq; the spec's fallback clause applies.
- **The browser check starts its own servers** on 5174 and 3011 with the AI stubbed
  (`VILLAGE_STUB=1`), so it never disturbs a dev server you already have open.
- **`.env` is ignored and holds the API key.** The key never reaches the browser; the server
  holds it and the page talks to the server through Vite's `/api` proxy.

## Where things live

```
devpost/
  checklist.md      the build plan and the progress state — the ticked boxes are the truth
  prd.md            what the product does
  scope.md          the one promise the product has to keep
  spec.md           the technical blueprint the build followed
  app-map.html      the take-home map of the finished code
  where-we-are.md   this file
server/
  index.js          Express: /api/generate, /api/check
  groq.js           the AI: prompts, strict JSON, shape checks
  validate.js       the checker — plain functions, no AI
  rebuild.js        write, check, rebuild, check again (max 2 rebuilds)
  check.js          re-check an edited lesson without writing a new one
  stub.js           a fixed lesson so the browser check is free and deterministic
src/
  App.jsx           page state, the generate flow, the debounced re-check
  components/       the form, the lesson, the feasibility panel, the print view
  lib/formRules.js  the rule that decides when Generate is enabled
scripts/
  verify.js         assertions on the pure logic
  browser-check.js  headless-Chrome checks against the running app
  ai-check.js       a live run against Groq
```

## The one sentence to keep

The AI writes the lesson; the code checks it. The model is never asked to grade its own
homework, and a lesson that says "ready to teach" has been through
`server/validate.js` — not through the model's opinion of itself.
