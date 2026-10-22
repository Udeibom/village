---
doc: prd
status: approved
---

# Village — Product Requirements

A one-screen, curriculum-aware lesson planner for any teacher — primary or secondary — that builds activities around the materials they confirm they have, and never labels a lesson ready until the resource promise is verified.
Source: `scope.md > The Core Loop`, `scope.md > The Unique Kernel`, `scope.md > The POC Boundary`.

## The Core Journey

1. The teacher opens Village and sees a single page: the lesson request form at the top, the reality form below it, and an empty result area waiting for a lesson.
2. They fill in grade, subject, topic/learning objective, and paste or type their curriculum objective (required). They enter class size, duration, and write constraints in their own words. They add materials as name + quantity rows.
3. They click **Generate lesson** (enabled only once the curriculum field and at least one material exist).
4. A structured lesson appears below — introduction, hands-on activity, guided practice, assessment — with each activity showing which confirmed materials it uses, how much, and its share of the time. A feasibility panel appears beside it.
5. The feasibility panel gives a top-line verdict — **Ready to teach** or **Needs attention** — with a status per check: materials, timing, assessment-objective alignment, and curriculum honesty.
6. If any check fails, the AI **rebuilds the lesson around what is actually available** — it does not merely flag the problem and stop.
7. The teacher edits the lesson text directly if they wish. Every edit triggers a re-check; the teacher's edits are never blindly trusted.
8. They hit **Print / Export** and get a clean printable version of the lesson with the feasibility panel attached.
9. They answer one question — **"How did it go?"** — with *worked*, *needed changes*, or *didn't work*, optionally adding what was missing. The lesson and that answer are banked on their own machine.
10. Next time they plan a lesson, Village looks through what this classroom has actually proved, and the generated lesson is built around an activity that worked before, with a line saying where it came from.
11. A banked lesson can be exported as one small file and given to a colleague, who imports it into their own bank as a candidate they have not yet verified.
12. If the teacher pastes their own curriculum document, the curriculum check stops being "unverified" and becomes a grounded claim: the document's own words, quoted back, or an honest "I could not find that in the document you gave me".
13. Everything except generating a new lesson works with no internet: the shelf, the bank, the checks, the edits and the printable page are all on the teacher's own machine.

## Screens and Layout

One screen, no wizard. Sections top to bottom:

- **Header** — name "Village", one-line tagline.
- **Lesson request** — grade, subject, topic/learning objective (text inputs), curriculum objective (larger text area, required).
- **Your classroom reality** — class size, duration (minutes), constraints (free-text box, teacher's own words), materials list (name + quantity rows, add/remove row buttons).
- **Generate lesson** button.
- **Result area** (appears after generation, same page, below): lesson plan on one side, feasibility panel on the other; Print / Export button.

## Look and Feel

Warm and practical — paper-and-chalk character, not SaaS dashboard. Readable serif or humanist fonts; muted earth tones (clay, charcoal, warm paper backgrounds) rather than blue-purple gradients. Feasibility panel reads like a checklist a colleague marked up: plain language, clear pass/fail. The tone of all copy is a competent colleague helping you plan — including the honesty line: *"Illustrative draft — review against your curriculum and your pupils' prior knowledge."*

## Features and Behavior

### Declaring the classroom reality
Materials are free-form name + quantity rows ("bottle tops — 40", "beans — a bag"), because counting by eye is honest. Constraints are free text — the teacher writes them in their own words; the app does not pre-chalk checkboxes. Class size and duration are numbers. Removing a row is one click (this powers the money-shot re-check).

### Generating the lesson
AI generates a structured lesson — short introduction, hands-on activity, guided practice, independent assessment, and adaptations for different levels of understanding. Activity structure is AI-free-form, not a fixed five-part template, but every activity must name the materials it uses, how much is required, how to set it up, and how the teacher checks understanding. Timings must add up to the stated duration (or the check says so).

### The feasibility check
A panel beside the lesson with a top-line verdict — **Ready to teach** or **Needs attention** — and a status per check:
- **Materials:** every required item matched against the teacher's list — enough, short by X, or not listed.
- **Timing:** do the activity timings fit the stated duration?
- **Assessment:** does an activity actually test the stated learning objective? Shown with the reason.
- **Curriculum:** honesty line — "aligned to the objective you provided" or "curriculum match unverified."

### Rebuilding around what's available
When any check fails, the AI rebuilds the lesson around the materials, quantities, time, and constraints that are actually available. The central promise: a lesson never ships requiring something the teacher doesn't have. This is the money shot of the demo — delete a material, re-check, and watch the lesson change.

### Editing and re-checking
Every activity's text is editable in place. After any edit, the re-check runs again against the edited text — a teacher cannot delete a material and leave a lesson silently requiring it.

### Export
Print / Export produces a clean printable version of the lesson with the feasibility panel included.

### The shelf and the classroom's history live on the teacher's machine
The teacher's own inputs — grade, subject, objective, class size, duration, constraints, and every material row with its quantity — are saved on their own machine and restored the next time they open Village. Nothing is sent anywhere but the local server, and nothing is stored on a service the teacher did not choose.

### "How did it go?" — the classroom's playbook
After a lesson, the teacher is asked one question: *worked*, *needed changes*, or *didn't work*, optionally adding what was actually missing. The lesson, its inventory, the class size it was built for, and that answer are banked locally. The bank is the app's memory of this classroom, and it is the teacher's own data on their own machine.

### Planning the next lesson around what worked before
When a new lesson is generated, Village looks through the bank and looks for activities that fit the current shelf, class size, duration and objective — and that the teacher marked as working. The selection is done in code, not by the model: same shelf, similar class, similar objective, and a lesson that worked. The generated lesson is built around the proven activity, and the panel says where it came from: which lesson, when, and with what class. A lesson the teacher marked as *didn't work* is never reused, and neither is one from a different shelf or a much larger class.

### A proven lesson can travel
A banked lesson can be exported as one small file and given to another teacher, who imports it into their own bank. An imported lesson is marked as coming from a colleague and as not yet verified in that classroom — it is a candidate, not a claim.

### The curriculum check uses the teacher's own document
If the teacher pastes or uploads their curriculum extract, Village searches that document for the objective and quotes the line it found. The curriculum row then reports a grounded claim — the document's own words — or an honest "I could not find that in the document you gave me". When a document is present, the model's own claim about curriculum alignment no longer decides that row. With no document, the row keeps saying "curriculum match unverified", because Village still cannot confirm it.

### The timings are fitted by code
When the activities do not fit the lesson, Village fits them to the stated duration in code — scaling the activity timings to the budget and saying so plainly — rather than leaving it to a model's arithmetic. The teacher's content is not changed; the minutes are, and the change is visible.

### Works with no internet
Village runs on the teacher's own machine. With no connection, the shelf, the bank, every check, every edit and the printable page all keep working. Only generating a new lesson needs the connection, and Village says so plainly instead of failing silently.

## States and Boundaries

- **First use / empty state** — blank forms; Generate disabled until curriculum objective and at least one material are filled in.
- **Generating** — a visible loading state ("Building your lesson…"); the form stays visible and editable.
- **Generation failure** — plain-language error plus a Try again button; **all entered form data is preserved, never lost**.
- **Shortage detected** — verdict shows Needs attention, the shortfall is named ("short by 8 bottle tops"), and the AI rebuilds automatically.
- **Manual edit** — triggers re-check; results update in place; no blind trust in edits.
- **First run** — the shelf and the bank are empty, and the app says so plainly ("nothing from this classroom yet"). No demonstration data is ever seeded: the history is whatever the teacher actually did.
- **Empty bank** — generating a first lesson works exactly as before. Reuse only appears once there is something worth reusing.
- **No internet** — the app still opens, restores the shelf and the bank, checks and edits lessons, and prints. The Generate button explains that a new lesson needs a connection.
- **Local data only** — the shelf, the bank and the curriculum document stay on the teacher's machine. Clearing the browser's data clears them, and the app says where they are kept.

## Product Decisions

- One screen, not a wizard — the teacher sees everything at once and the money-shot re-check is visible in one place (learner chose this over steps).
- Materials: free-form name + quantity text rows — counts like "a bag" stay honest (learner adopted the suggestion).
- Constraints: free text in the teacher's own words, no pre-set checkbox list — "the teacher to be the one to put the constraints."
- Curriculum field: never blank; Generate disabled without it.
- Lesson structure: AI-free-form, not a fixed Engage/Explore/Explain/Practise/Evaluate template.
- Shortage response: AI rebuilds the lesson around available resources — "the whole point is making use of what's available" — rather than only flagging.
- Manual edits are re-checked, not trusted.
- Generation failure preserves the form.
- Look and feel: warm paper-and-chalk, earth tones, humanist/serif type (learner adopted the suggestion).
- Audience: any teacher, primary or secondary; Primary 6 ratios is only the demo example.

## What We're Building

- One screen with lesson request, reality inputs, and result area.
- Required curriculum objective field; free-text constraints; material rows with add/remove.
- AI lesson generation grounded in the declared inventory, with per-activity materials, setup, timing, and understanding checks.
- Feasibility panel with four checks and a Ready to teach / Needs attention verdict.
- Automatic rebuild on failed checks.
- In-place editing with automatic re-check.
- Print / Export including the feasibility panel.
- Warm paper-and-chalk visual style.
- The shelf and the classroom's bank, saved on the teacher's own machine and restored next time.
- "How did it go?" — the teacher's verdict on a lesson, banked locally.
- Reuse of proven activities in the next lesson, chosen in code, with visible provenance.
- Export and import of a proven lesson as one small file.
- The curriculum check grounded in the teacher's own document, quoted back, or honestly "not found".
- Activity timings fitted to the lesson's duration by code.
- The whole app usable with no internet; only generation needs the connection.

## Deferred From the POC

Each named in `scope.md > Later`; not built this weekend, not deleted from the vision: curriculum web search, photographing materials, objective-to-assessment trace as its own visualization, broader grade/subject/curriculum coverage.

**Now built (moved out of "Later"):** curriculum document upload and parsing (the teacher pastes or uploads their extract and the curriculum row becomes a grounded, quoted claim), saved resource inventory across sessions, the teacher feedback loop ("how did it go?") and the multi-lesson history it produces, and a portable lesson file that carries a proven lesson to a colleague.

## Possible Later Enhancements

Photo of the shelf as input (with the teacher correcting the suggestion); curriculum web search; a visual map from objective to assessment activity; syncing the shelf across a teacher's machines; the bank shared between colleagues on a school's own server.

## Non-Goals

- Not an AI lesson generator that hopes for the best — feasibility must be verified, never assumed (`scope.md > The Unique Kernel`).
- No accounts, login, or multi-user features. Sharing is a file the teacher hands over, not a network.
- No seeded demonstration data anywhere in the product. The history is real history.
- No deployment/hosting requirements for the demo — running locally is fine. (Offline means the machine has no connection to the internet, not that the app is hosted.)
- No attempt to be an authority on curriculum compliance; the app only reports what it can verify and flags what it can't.
- No fixed five-part lesson template.

## Open Questions

- None blocking `4-spec`. (Implementation-level questions — model access, how the check is performed reliably — belong to spec and build.)
