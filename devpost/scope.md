---
doc: scope
status: approved
---

# Village

A curriculum-aware lesson planner that builds practical classroom activities around the physical materials a teacher confirms are available — and refuses to call a lesson "ready to teach" until it has checked that promise.

## The Unique Kernel

If a lesson requires a resource the teacher doesn't have, the app must detect the problem and fix the lesson — or flag the limitation — before presenting it as ready to teach. Every activity declares which confirmed materials it uses, in what quantity, and the feasibility report explains what the teacher needs to prepare. Delete this check and Village becomes another AI lesson generator; the whole point is that resource constraints *shape the output and are verified*, not merely mentioned in a prompt.

## Who It's For

Any teacher — primary or secondary — with a real room full of pupils and a shelf of whatever is actually on hand, planning tomorrow's lesson, possibly with no projector, no printer, and no internet during class. They already improvise; what they don't have is a tool that plans *around their actual inventory* and tells them honestly when a plan won't fit. (Primary 6 mathematics, 40 pupils, 35 minutes is the *village.md* demo example, not a product limit.)

## The Core Loop

1. Declare the lesson request: grade, subject, topic/learning objective, plus the curriculum objective pasted or typed from the teacher's own materials.
2. Declare the reality: class size, duration, constraints (no electricity, no printing, no internet), and available materials with quantities.
3. Generate a resource-grounded lesson: introduction, hands-on activity, guided practice, independent assessment, adaptations — each activity naming the materials it uses, how much, and how to check understanding.
4. Validate before teaching: material requirements satisfied, timing plausible, assessment traces to the stated objective, uncertainty flagged — then the teacher reviews, edits, and exports.

Why they come back: the plan is usable tomorrow, and it's honest about what's missing.

## Inspiration & Identity

- Practical, low-tech, improvisational — "low-cost tools, high impact," making do with what's in the room.
- The sample lesson's structure (Engage / Explore / Explain / Practise / Evaluate) and its honesty line: *"Illustrative draft — a teacher should review it against the applicable curriculum and pupils' prior knowledge."*
- Tone: a competent colleague helping you plan, not a system issuing a certificate of compliance.

## Why This Matters to the Learner

The problem isn't that teachers lack ideas — it's that generic plans assume equipment, printing, electricity, or internet that may not exist. The learner wants a tool that respects that reality, and is explicit that the app must never label a lesson ready simply because a model generated a plausible document.

## What "Working" Looks Like

The one-minute demo:

1. Teacher enters the objective (Primary 6 — understand and represent ratios), class size, duration, and constraints (no printing, no internet during class).
2. Declares resources — 40 bottle tops, beans, two measuring cups, chalk, blackboard.
3. Generates the lesson — five timed activities (Engage, Explore, Explain, Practise, Evaluate), each showing which confirmed materials it uses.
4. **The money shot:** she deletes the measuring cups from the inventory (or raises group size beyond what the bottle tops cover) and re-checks — the lesson visibly adapts or the feasibility report flags the shortage instead of quietly passing.
5. Edits the plan and exports/prints the final version.

## The POC Boundary

In:
- Demo/example path for the hackathon (Primary 6 mathematics — ratios); the app itself is not limited to primary or to that subject
- Class size, duration, and teaching constraints as inputs
- Materials with quantities as a typed list (editable during the session — needed for the money shot)
- One free-text field where the teacher pastes/types their curriculum objective or standard
- Generated lesson with activities, timings, and assessment
- Per-activity display of which confirmed materials it uses
- Feasibility validation: materials available in sufficient quantity, timing estimate, assessment-objective alignment, explicit uncertainty flags on curriculum claims ("aligned to the objective you provided" vs. "curriculum match unverified")
- Edit and export/print the final lesson plan

## Later

- Curriculum document upload and parsing
- Curriculum web search
- Reusable saved resource inventory across sessions
- Photographing materials as input
- Teacher feedback loop (did it work, what was missing, what to change next time)
- Objective-to-assessment trace as its own visualization
- Broader grade/subject/curriculum coverage

*(All named in `village.md`, which remains the full vision — "later" means not built this weekend, not deleted.)*

## Explicitly Cut

Nothing is cut from `village.md`'s vision — the learner was explicit that nothing gets removed. Items listed under **Later** are deferred implementations, not discarded requirements.
