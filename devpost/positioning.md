# Positioning — why this is not "just ask ChatGPT"

Use this for the Devpost submission, the demo narration, and any judge who asks
"so what's different from ChatGPT?" Everything here is backed by something that
actually happened in this build.

---

## The one line

> ChatGPT writes from your message. Village writes from your shelf and then **proves**
> it — with code. Ask a chat model "are you sure you used 40 bottle tops?" and it answers
> from the same guess that made the lesson. Village re-runs the arithmetic, the inventory
> and the objective trace every time, and it tells you what it *couldn't* check.

## The 60-second pitch

> A teacher in a low-resource classroom has a shelf, not a wish list. Village is a lesson
> planner that takes the shelf as the hard constraint, writes the lesson around it, and
> then refuses to call the lesson ready until it has **checked** it — with plain code, not
> with the model's opinion of itself. If the lesson needs a resource the teacher doesn't
> have, Village rewrites the lesson around what they do have.

## Why a chat window can't do this

| | Chat window | Village |
| --- | --- | --- |
| Where the lesson comes from | your message | your shelf, as a hard constraint |
| "Are you sure?" | re-asserts the same guess | re-runs the check, with code |
| Who checks the work | the model, about itself | `shared/validate.js`, no AI in the file |
| When it's wrong | you find out in the classroom | the panel names it before you teach |
| A shortage | you have to notice and re-prompt | the lesson is rewritten and re-checked |
| What it can't verify | hidden | shown: "quantity unverified", "curriculum unverified" |
| Your classroom | forgotten between chats | remembered (shelf, verified lessons) |

## The evidence from this build

Three things that happened here, in the real app, that a chat window cannot do:

1. **The model's own arithmetic was wrong.** The first live lesson generated 40 minutes of
   activities against a 35-minute lesson. The model had no idea. Village's timing check
   caught it, named the overrun, and the lesson was rebuilt to fit. Ask a chat model for a
   35-minute lesson and it will hand you 40 minutes and call it done.
2. **The checker caught the model — and then the checker was caught.** A live rebuild
   produced an assessment that described the objective instead of quoting it, and the
   checker called it a mismatch. The lesson was fine; the *checker* was comparing too
   literally. That is only findable because something independent was checking, and
   Village's own fix (compare on the first four letters of each word) is in
   `shared/text.js` → `matchingKey`, held in place by a test.
3. **Village refuses to guess.** Declared as "beans — a bag", the panel says: *"You listed
   beans (a bag), so Village can see you have it — but not that you have enough of it."*
   A chat model will happily say a bag is plenty for 40 pupils. Village marks it
   **quantity-unverified** — not a pass, not a fail, an honest "I can't check this".

## Phrases to use, and phrases to avoid

**Use:**

- "checked with code, not asserted by a model"
- "the shelf is the constraint, not a suggestion in a prompt"
- "it tells you what it could not verify"
- "the lesson is rewritten around what you actually have"
- "the AI writes; the code checks"

**Avoid:**

- "AI lesson generator" — it is the description of every competitor, and it is the one
  thing Village is not
- "we use the materials you list" — a chat model does this too, and mostly well
- anything claiming the curriculum is aligned — Village can only claim what it can cite

## The demo beats, in order

The demo should never start with the generator. Start with the refusal.

1. **The refusal** (0:00) — "beans — a bag" in the inventory. The panel says it can see the
   beans but not that there are enough. *"This is the line that separates us from a chat
   window: we won't guess for you."*
2. **The money shot** (0:20) — generate the ratios lesson, then delete the measuring cups
   and generate again. The lesson visibly changes; the panel says what it changed and why.
3. **The check that catches the model** (0:45) — the timing line. The lesson adds up to
   exactly 35 minutes because the code made it, not because the model felt like it did.
4. **The bit a chat window cannot do** (1:00) — the classroom's own memory: the shelf
   persists, the lessons that worked are banked and re-used, and the app works with no
   internet at all.

## If a judge asks "isn't this just ChatGPT with extra steps?"

> The generation is the commodity — you're right that a chat model can write a lesson, and
> ours does too. The product is the part after generation: a deterministic checker that is
> allowed to disagree with the writer, a loop that rewrites the lesson when the writer is
> wrong, and a classroom memory that a stateless chat window has no way of holding. Take the
> checker away and yes, it becomes another AI lesson planner. The checker is the product.
