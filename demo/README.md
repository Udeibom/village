# The demo video

`village-demo.mp4` is the short recording of Village working: 1 minute 29
seconds, 1440×900, no narration.

Public download (no sign-in):
<https://github.com/Udeibom/village/releases/download/demo-1/village-demo.mp4>

## What it shows, in order

1. **The refusal** — the teacher lists "beans — a bag". The panel says it can
   see the beans but cannot see that there are enough of them. A chat model
   would guess; Village says it cannot verify.
2. **The money shot** — the measuring cups are deleted from the inventory and
   the lesson is generated again. The lesson comes back without them, and the
   panel says what changed and why.
3. **The timing line** — the activities add up to exactly 35 minutes, because
   the code made them add up, not because the model felt like it did.
4. **The curriculum document decides** — the teacher's own extract is pasted
   in, and the panel quotes the line the lesson is planned against.
5. **The classroom's record** — the lesson is marked as "Worked" and appears in
   the classroom's bank.
6. **No internet** — the connection is cut. Village still opens, still checks
   the lesson, and still prints it.

## Recording it again

`record-demo.mjs` produced the video. It drives a private headless Chrome
against a running `npm run dev`, captures the frames the page paints, and
writes them to a folder that ffmpeg then assembles.

```bash
npm run dev                 # in one terminal, with your key in .env
node demo/record-demo.mjs   # writes /tmp/opencode/demo-frames
```

The frames and the ffmpeg commands are not in this file; the recording script
prints where it put them. The video itself has no narration — the on-screen
text carries the story, so a voice-over can be added when it is uploaded.
