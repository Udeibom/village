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

- [x] **2. The app generates a lesson and checks it against the inventory**
  Becomes usable: The teacher clicks Generate and gets a real AI-generated lesson — introduction, activities with instructions, timings, per-activity materials and quantities, setup, understanding checks, plus assessment and adaptations — and beside it a feasibility panel giving a verdict ("Ready to teach" or "Needs attention") with a plain-language line per check: materials, timing, assessment-objective alignment, and curriculum honesty.
  Why now: The checker is the unique kernel and Groq is the only unfamiliar dependency, so this slice puts both in place on a single real path — no demo shortcut. The checker is plain code and is verified offline against fixtures before any API call is made, so a wrong assumption surfaces in seconds rather than after rate-limited calls.
  PRD ref: `prd.md > The Core Journey` (steps 3-4), `prd.md > Generating the lesson`, `prd.md > The feasibility check`
  Spec ref: `spec.md > Groq client`, `spec.md > Deterministic checker`, `spec.md > External Services and Dependencies`, `spec.md > Important Failure Modes`
  Build: Write `server/validate.js` as pure functions — case-insensitive material matching, numeric quantity comparison ("short by X"), presence-only matching with "quantity unverified" for counts like "a bag", timing sum against the stated duration with a 2-minute tolerance, declared assessment-to-objective trace, and the curriculum honesty line — plus a realistic Primary 6 ratios lesson as an internal test fixture. Write `server/grok.js` — prompts for strict JSON, a JSON schema for the lesson object, a client that parses and shape-validates the reply, one repair-prompt retry for malformed output, and the model id read from `GROQ_MODEL` with a working default. Add `POST /api/generate` returning `{ lesson, feasibility }`. Render the lesson and the panel side by side, show "Building your lesson…" while it runs, and on failure show a plain-language error with a Try again button while preserving every field the teacher typed.
  Verify (mechanical): `npm run verify` asserts the checker's rules directly against fixtures — enough / short / missing / quantity-unverified materials, a timing overrun, a timing underfill, a declared assessment link that does and does not match the objective, and both verdicts — and asserts the lesson-shape validator rejects a malformed reply; a live `curl` of `POST /api/generate` returns a valid lesson with per-activity materials and a feasibility verdict; `npm run browser-check` fills the Primary 6 ratios form in a real headless browser, clicks Generate, and confirms the lesson and verdict render and that the panel names real materials.
  Learner check: Fill in the ratios lesson with the real inventory and click Generate. Read the generated activities — do they use the materials you actually have, in the quantities you declared, and do the timings add up to your 35 minutes? Does the verdict match what you can see?
  Commit: `Generate lessons with Groq and check them against the inventory`

- [x] **3. A shortage makes the lesson rebuild, not just get flagged**
  Becomes usable: When the checker finds a shortage, the server asks Groq to rebuild the lesson around what is actually available and checks the rebuild again — so deleting the measuring cups changes the lesson itself, not just the verdict. If the rebuild still cannot satisfy the checks after the allowed attempts, the lesson returns with "Needs attention" and the exact shortfall named.
  Why now: This is the money shot of the demo and the literal promise of the unique kernel. It only means anything once generation and checking both work.
  PRD ref: `prd.md > Rebuilding around what's available`, `prd.md > States and Boundaries` (shortage detected)
  Spec ref: `spec.md > The Core Journey Through the System` (step 6), `spec.md > How This Works, In Plain Language`, `spec.md > Important Failure Modes`
  Build: Add the rebuild prompt to `server/grok.js` — the shortfall spelled out, the available inventory restated — and the orchestration loop in `server/index.js`: generate, check, rebuild with the shortfall, re-check, at most two rebuilds, then return with the verdict. Record `rebuildsAttempted` in the feasibility object and surface it in the panel.
  Verify (mechanical): `npm run verify` asserts the loop stops at two rebuilds and that a still-failing result returns "Needs attention" with the shortfall named rather than a silent pass; `npm run browser-check` runs the money shot — generate with the full inventory, then remove the measuring cups and re-check — and confirms either the lesson no longer requires measuring cups or the panel names the shortage explicitly.
  Learner check: Generate the ratios lesson with both measuring cups in the inventory, then delete that row and re-check. Watch whether the lesson itself adapts to what you still have — and whether the panel tells you what it changed and why.
  Commit: `Rebuild the lesson around available materials when short`

- [x] **4. Editing the lesson re-checks it**
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

- [x] Early usable behavior explored — after slice 1: the teacher filled the real form and gave feedback on the paper-and-chalk look and the wording of the inputs. Outcome: field names confirmed as good for a teacher; the exercise-book styling was tried and rejected and reverted to the warm card layout, so the panel — not the page furniture — carries the paper-and-chalk character from here on
- [x] Core-journey checkpoint — after slice 3: the teacher ran the money shot in the browser (generate, then remove a material and re-check) and reported what they see. Outcome: the lesson used the declared materials in the declared quantities, the timings added up to 35, and deleting the measuring cups genuinely adapted the lesson. The panel explained itself well. The teacher saw no need for the panel to compare the lesson before and after a material is deleted, and asked for no other changes
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
- The exercise-book treatment for the page (ruled lines, margin rule, desk surface, underline fields, serif italic labels) was tried and reverted — the learner judged the notebook metaphor as costume rather than meaning, and preferred the warm card-based form. The page keeps the card layout, earth tones, serif headings and humanist body text. The "chalk" half of the paper-and-chalk character is now expected to come from the feasibility panel, not from the page furniture.
- The live Groq call in slice 2 caught two real bugs in Village's own code, which is the strongest possible evidence that the checker earns its keep: the first generated lesson ran 40 minutes against a 35-minute lesson (the timing check caught it, as designed), and the material counts read "40 bottle topses" because the code pluralised a word the teacher had already written in the plural. Both are fixed, and both now have a case in `npm run verify`.
- `server/stub.js` and the `VILLAGE_STUB=1` switch were added so `npm run browser-check` can drive the real app end to end without calling Groq: the check now starts its own server and web server on their own ports (3011 and 5174), with the AI stubbed, so a check is fast, free, deterministic and never disturbs a dev server the learner already has open. The real AI is exercised separately by `npm run ai-check`, which prints the lesson and the verdict for the Primary 6 ratios request.
- The Vite proxy target is now read from `VILLAGE_API_TARGET` instead of being hardcoded to port 3001, so the browser check can point its own web server at its own API server.
- `scripts/ai-check.js` was added because "a live `curl` of `POST /api/generate`" is a one-off instruction that nobody can repeat later; a named script can. It prints the generated lesson, the timing total and the full feasibility report, and it is the cheapest way to see whether a prompt change helped.
- The rebuild loop lives in its own file, `server/rebuild.js`, and takes the generator and the rebuilder as arguments. The loop is the part most worth testing and the part most expensive to test — with the AI inside it, every test costs a call and waits on the network. Passing the two calls in means `npm run verify` can drive the whole loop with fakes: a lesson that already fits, a shortage that one rebuild fixes, a shortage that survives every rebuild, a count the teacher could not give (which is deliberately not worth a rebuild), and a rebuild that throws. The live path is still exercised, once, by `npm run ai-check`.
- The stub now deliberately asks for one more of the first material than the teacher has, so every browser-check generation goes through a real rebuild. Without that, the stub would fit the inventory perfectly, the rebuild would never fire, and the money shot would be testing nothing.
- A live rebuild against Groq found a false negative in the assessment check: the rebuilt lesson said its assessment tested "students will demonstrate understanding by correctly forming and comparing ratios in a short written task" rather than quoting the objective, and the checker called that a mismatch and told the teacher the lesson needed attention when it was fine. Words are now compared on their first four letters, so "comparing" matches "compare" and "understanding" matches "understand", and the model is told to copy the objective text rather than describe it. A live run that a teacher would never have seen had turned into a wrong answer about their own lesson.
- The model turned out to be obedient about the inventory: asked for ten bottle tops, it used ten, and asked for forty, it used forty, so the rebuild rarely has to fire against the real AI. The loop still matters — the teacher's list is a description, and the model reads "a bag" as an amount it can spend freely — but the honest finding is that the first prompt already keeps it honest most of the time, and the checker is the thing that catches it when it does not.
- At the core-journey checkpoint the teacher asked for no changes, and specifically ruled out one thing: the panel should not compare the lesson before and after a material is deleted. The PRD's "watch the lesson change" is satisfied by the lesson changing, and a before/after diff would be a second interface to explain and would go stale the moment the teacher edits anything. The panel's job stays single: say whether this lesson, as it stands, can be taught with what is on the table.
- The re-check in slice 4 is one mechanism rather than two: a single effect watches the lesson and the inputs the checks are made against, and re-checks shortly after the last change. Editing an activity's text, adding a material to an activity, and changing the inventory or the class size or the length all go through it, so there is a single place where "the teacher's edits are never trusted" is actually enforced.
- Re-checking deliberately does not rewrite the lesson. Changing the inventory re-checks — a local, instant check that names the gap — and writing a new lesson stays behind the Generate button. The PRD's money shot still works, but the teacher is never surprised by a slow API call they did not ask for, and the "delete a material, re-check, watch the lesson change" line is satisfied by the teacher pressing Generate, which is the same button that always wrote the lesson.
- Activity duration is not editable in place. The slice is about the activity's text, and a number field that quietly changes the timing check is a different kind of control from a sentence the teacher rewrites.
- The feasibility panel is sticky, so it follows the teacher down the page instead of scrolling away. The browser check therefore asserts that the panel sits *beside* the lesson on a wide screen and *below* it on a narrow one, and not that the two are level with each other — a sticky panel cannot promise that, and a check that did would fail for the right behaviour.
