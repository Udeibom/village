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

## States and Boundaries

- **First use / empty state** — blank forms; Generate disabled until curriculum objective and at least one material are filled in.
- **Generating** — a visible loading state ("Building your lesson…"); the form stays visible and editable.
- **Generation failure** — plain-language error plus a Try again button; **all entered form data is preserved, never lost**.
- **Shortage detected** — verdict shows Needs attention, the shortfall is named ("short by 8 bottle tops"), and the AI rebuilds automatically.
- **Manual edit** — triggers re-check; results update in place; no blind trust in edits.
- **Nothing persisted between sessions** (deferred: saved inventory, history). Refresh starts clean.

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

## Deferred From the POC

Each named in `scope.md > Later`; not built this weekend, not deleted from the vision: curriculum document upload/parsing, curriculum web search, saved resource inventory across sessions, photographing materials, teacher feedback loop, objective-to-assessment trace as its own visualization, multi-lesson history.

## Possible Later Enhancements

Reusable material inventory the teacher maintains across lessons; photo of the shelf as input; "how did it go?" feedback that learns which activities work in which rooms; a visual map from objective to assessment activity.

## Non-Goals

- Not an AI lesson generator that hopes for the best — feasibility must be verified, never assumed (`scope.md > The Unique Kernel`).
- No accounts, login, or multi-user features.
- No deployment/hosting requirements for the demo — running locally is fine.
- No attempt to be an authority on curriculum compliance; the app only reports what it can verify and flags what it can't.
- No fixed five-part lesson template.

## Open Questions

- None blocking `4-spec`. (Implementation-level questions — model access, how the check is performed reliably — belong to spec and build.)
