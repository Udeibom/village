---
doc: checklist
status: approved
---

# Build Checklist

Build mode: fast

## Slices

- [x] **1. The teacher can declare their classroom reality**
  Becomes usable: A running Village app on one screen where the teacher fills in grade, subject, topic, curriculum objective, class size, duration, constraints and material rows. "Generate lesson" stays disabled until the curriculum field and at least one material exist.
  Why now: Everything else in the product lands on this page, and it settles the spec's open question (two dev processes vs. one) before any AI code depends on it.
  PRD ref: `prd.md > The Core Journey` (steps 1-2), `prd.md > Screens and Layout`, `prd.md > States and Boundaries` (empty state)
  Spec ref: `spec.md > Components`, `spec.md > File Structure`, `spec.md > Look and Feel`, `spec.md > Where It Runs and How Someone Tries It`
  Build: Scaffold the file structure from the spec (Vite + React page, Express server on :3001, Vite proxying /api, `npm run dev` starting both via concurrently), install dependencies, build the one-screen layout, the lesson-request and classroom-reality forms, the materials list with add/remove row buttons, the Generate enable/disable rule, and the paper-and-chalk stylesheet (earth tones, serif headings, humanist body, plain CSS, no component library). Add `.env.example`, `README.md` start instructions, and keep `.env` ignored.
  Verify (mechanical): `npm install` completes and `npm run dev` starts both processes with no errors; `curl` the Vite root and the Express health route; `npm run verify` asserts the Generate gating rule against empty and filled form states; `npm run browser-check` loads the page in headless Chrome and confirms the button is disabled with an empty form and enabled once a curriculum objective and one material row exist.
  Learner check: Open http://localhost:5173 and fill the form the way you would for tomorrow's lesson — Primary 6, ratios, 40 pupils, 35 minutes, constraints in your own words, then bottle tops 40, beans a bag, 2 measuring cups, chalk, blackboard. Tell me how the page feels: warm paper-and-chalk, like a colleague's notebook, not a SaaS dashboard.
  Commit: `Scaffold Village with the one-screen teacher form`

- [ ] **2. The app generates a lesson and checks it against the inventory**
  Becomes usable: The teacher clicks Generate and gets a real AI-generated lesson — introduction, activities with instructions, timings, per-activity materials and quantities, setup, understanding checks, plus assessment and adaptations — and beside it a feasibility panel giving a verdict ("Ready to teach" or "Needs attention") with a plain-language line per check: materials, timing, assessment-objective alignment, and curriculum honesty.
  Why now: The checker is the unique kernel and Groq is the only unfamiliar dependency, so this slice puts both in place on a single real path — no demo shortcut. The checker is plain code and is verified offline against fixtures before any API call is made, so a wrong assumption surfaces in seconds rather than after rate-limited calls.
  PRD ref: `prd.md > The Core Journey` (steps 3-4), `prd.md > Generating the lesson`, `prd.md > The feasibility check`
  Spec ref: `spec.md > Groq client`, `spec.md > Deterministic checker`, `spec.md > External Services and Dependencies`, `spec.md > Important Failure Modes`
  Build: Write `server/validate.js` as pure functions — case-insensitive material matching, numeric quantity comparison ("short by X"), presence-only matching with "quantity unverified" for counts like "a bag", timing sum against the stated duration with a 2-minute tolerance, declared assessment-to-objective trace, and the curriculum honesty line — plus a realistic Primary 6 ratios lesson as an internal test fixture. Write `server/grok.js` — prompts for strict JSON, a JSON schema for the lesson object, a client that parses and shape-validates the reply, one repair-prompt retry for malformed output, and the model id read from `GROQ_MODEL` with a working default. Add `POST /api/generate` returning `{ lesson, feasibility }`. Render the lesson and the panel side by side, show "Building your lesson…" while it runs, and on failure show a plain-language error with a Try again button while preserving every field the teacher typed.
  Verify (mechanical): `npm run verify` asserts the checker's rules directly against fixtures — enough / short / missing / quantity-unverified materials, a timing overrun, a timing underfill, a declared assessment link that does and does not match the objective, and both verdicts — and asserts the lesson-shape validator rejects a malformed reply; a live `curl` of `POST /api/generate` returns a valid lesson with per-activity materials and a feasibility verdict; `npm run browser-check` fills the Primary 6 ratios form in a real headless browser, clicks Generate, and confirms the lesson and verdict render and that the panel names real materials.
  Learner check: Fill in the ratios lesson with the real inventory and click Generate. Read the generated activities — do they use the materials you actually have, in the quantities you declared, and do the timings add up to your 35 minutes? Does the verdict match what you can see?
  Commit: `Generate lessons with Groq and check them against the inventory`

- [ ] **3. A shortage makes the lesson rebuild, not just get flagged**
  Becomes usable: When the checker finds a shortage, the server asks Groq to rebuild the lesson around what is actually available and checks the rebuild again — so deleting the measuring cups changes the lesson itself, not just the verdict. If the rebuild still cannot satisfy the checks after the allowed attempts, the lesson returns with "Needs attention" and the exact shortfall named.
  Why now: This is the money shot of the demo and the literal promise of the unique kernel. It only means anything once generation and checking both work.
  PRD ref: `prd.md > Rebuilding around what's available`, `prd.md > States and Boundaries` (shortage detected)
  Spec ref: `spec.md > The Core Journey Through the System` (step 6), `spec.md > How This Works, In Plain Language`, `spec.md > Important Failure Modes`
  Build: Add the rebuild prompt to `server/grok.js` — the shortfall spelled out, the available inventory restated — and the orchestration loop in `server/index.js`: generate, check, rebuild with the shortfall, re-check, at most two rebuilds, then return with the verdict. Record `rebuildsAttempted` in the feasibility object and surface it in the panel.
  Verify (mechanical): `npm run verify` asserts the loop stops at two rebuilds and that a still-failing result returns "Needs attention" with the shortfall named rather than a silent pass; `npm run browser-check` runs the money shot — generate with the full inventory, then remove the measuring cups and re-check — and confirms either the lesson no longer requires measuring cups or the panel names the shortage explicitly.
  Learner check: Generate the ratios lesson with both measuring cups in the inventory, then delete that row and re-check. Watch whether the lesson itself adapts to what you still have — and whether the panel tells you what it changed and why.
  Commit: `Rebuild the lesson around available materials when short`

- [ ] **4. Editing the lesson re-checks it**
  Becomes usable: The teacher can edit any activity's text in place, and the feasibility panel re-runs against the edited text immediately — so a teacher cannot quietly drop a material requirement and leave a lesson that silently needs it. Changing the materials list, class size or duration also re-checks the lesson.
  Why now: The PRD's rule that edits are never blindly trusted is a promise only the checker can keep, and it reuses the same code path as slice 3 — no new machinery, just a second entry point into it.
  PRD ref: `prd.md > Editing and re-checking`, `prd.md > States and Boundaries` (manual edit)
  Spec ref: `spec.md > Lesson display + in-place editing`, `spec.md > Express server`
  Build: Make activity fields editable in place in `src/components/LessonPlan.jsx`, send the edited lesson plus the original inputs to `POST /api/check`, and update the panel in place from the response. Trigger the same re-check when the teacher changes the materials list, class size, or duration.
  Verify (mechanical): `npm run browser-check` edits an activity to require a material that is not in the inventory, confirms the panel flips to "Needs attention" naming that material, then restores the text and confirms the verdict returns to "Ready to teach"; `npm run verify` asserts `POST /api/check` returns a feasibility verdict without regenerating the lesson.
  Learner check: Change an activity's instruction to mention something you don't own (a marker pen, say) and watch the panel react — then change it back and watch it clear.
  Commit: `Re-check the lesson after teacher edits`

- [ ] **5. The teacher can print or export the lesson**
  Becomes usable: A clean printable page — lesson and feasibility panel together, no app chrome — for the teacher to carry into the classroom, plus a README another person can follow to run it.
  Why now: It is the last step of the core journey (hand the plan to the class), it needs the finished lesson shape to look right, and it is what the demo recording will show.
  PRD ref: `prd.md > Export`, `prd.md > The Core Journey` (step 8)
  Spec ref: `spec.md > Print / Export view`, `spec.md > Look and Feel`
  Build: Add the print view and print stylesheet (`src/components/PrintView.jsx` plus `@media print` rules) so the printed page carries the lesson and the feasibility panel, including the honesty line; add the Print / Export button; finish the README with run instructions, the `.env` setup, and what the app does and does not do.
  Verify (mechanical): `npm run browser-check` clicks Print / Export, asserts the print stylesheet is present and that the print media query hides the form and app chrome while keeping the lesson and panel visible; `npm run verify` still passes end to end.
  Learner check: Print or save the page as PDF and look at it as a sheet of paper you would hand to a colleague — is the lesson and its feasibility panel everything you need on one page?
  Commit: `Add the print view and finish the README`

## Hands-on Checkpoints

- [ ] Early usable behavior explored — after slice 1: the teacher fills the real form and gives feedback on the paper-and-chalk look and the wording of the inputs, which shapes everything built on top of it (slice 1 built; awaiting the teacher's report)
- [ ] Core-journey checkpoint — after slice 3: the teacher runs the money shot in the browser (generate, then remove a material and re-check) and reports what they see
- [ ] Final kick-the-tires exploration and feedback completed

## Final Review

- [ ] Final review complete — feedback resolved and learner confirms ready to ship

## Code Tour and App Map

- [ ] Learning activity complete — guided route, focused alternative, prior practice connected, or brief recap
- [ ] Optional edit and transfer reflection addressed — offered/declined/already covered/not applicable as appropriate
- [ ] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence:
Route and stops:
Edit outcome:
Reflection:
Activity mode:

## Revisions

- The example-lesson button proposed in the first draft of the plan was removed — the learner asked for a real working app rather than a demo, so the product keeps a single path (Generate lesson → AI → checker) and the example lesson survives only as an internal test fixture for the checker.
- The Groq model named in the spec (`llama-3.3-70b-versatile`) was retired by Groq on 2026-08-16 for free and developer tiers and is no longer returned by the models API — the spec's own fallback clause applies, so the default model is `openai/gpt-oss-120b` (verified working with Groq's strict JSON schema mode) and the model id is read from `GROQ_MODEL` rather than hardcoded.
- The stack versions moved forward with what npm now ships (React 19, Vite 8, Express 5, groq-sdk 1.6) instead of the versions the spec named (React 18, Express 4) — same libraries, same architecture, but the spec's pins were already a year out of date and would have needed overriding immediately.
- `src/lib/formRules.js` was added to the spec's file structure so the rule that decides when Generate is enabled lives in one plain function, testable from `npm run verify` without a browser.
- `scripts/browser-check.js` drives the running app in headless Chrome over the DevTools protocol (Node's built-in `WebSocket` and `fetch` only, no new dependencies) because "it looks right" is not verification — the build needs to assert on what a teacher would actually see.
