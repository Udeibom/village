#!/usr/bin/env bash
# Assembles the demo video from the frames the recorder captured.
#
#   node demo/record-demo.mjs          # writes /tmp/opencode/demo-frames
#   bash demo/assemble.sh               # writes /tmp/opencode/village-demo.mp4
#
# It makes the title card and the end card, paces the captured frames, and
# joins the three into one video. Everything is at 30 frames a second, so the
# video plays at the speed the frames were captured at.

set -euo pipefail

FRAMES=${FRAMES:-/tmp/opencode/demo-frames}
WORK=${WORK:-/tmp/opencode/assemble}
OUT=${OUT:-/tmp/opencode/village-demo.mp4}
WIDTH=1440
HEIGHT=900
FPS=30

PAPER='#f3ece0'
INK='#2f2a23'
INK_SOFT='#6d6355'
HEAD_FONT=/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf
BODY_FONT=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf

mkdir -p "$WORK"

# --- the title card -------------------------------------------------------

ffmpeg -y -loglevel error \
  -f lavfi -i "color=c=${PAPER}:s=${WIDTH}x${HEIGHT}:d=3:r=${FPS}" \
  -vf "drawtext=fontfile=${HEAD_FONT}:text='Village':fontcolor=${INK}:fontsize=104:x=(w-text_w)/2:y=250,\
drawtext=fontfile=${BODY_FONT}:text='Lesson plans that fit the room you actually have.':fontcolor=${INK_SOFT}:fontsize=40:x=(w-text_w)/2:y=400,\
drawtext=fontfile=${BODY_FONT}:text='The AI writes the lesson. The code checks it.':fontcolor=${INK}:fontsize=34:x=(w-text_w)/2:y=520" \
  -c:v libx264 -pix_fmt yuv420p -r $FPS "$WORK/title.mp4"

# --- the end card ---------------------------------------------------------

ffmpeg -y -loglevel error \
  -f lavfi -i "color=c=${PAPER}:s=${WIDTH}x${HEIGHT}:d=3:r=${FPS}" \
  -vf "drawtext=fontfile=${HEAD_FONT}:text='github.com/Udeibom/village':fontcolor=${INK}:fontsize=68:x=(w-text_w)/2:y=330,\
drawtext=fontfile=${BODY_FONT}:text='The AI writes the lesson. The code checks it.':fontcolor=${INK_SOFT}:fontsize=34:x=(w-text_w)/2:y=460" \
  -c:v libx264 -pix_fmt yuv420p -r $FPS "$WORK/end.mp4"

# --- pace the frames ------------------------------------------------------
#
# A frame that was on screen for a moment is held long enough to read, and a
# frame that was on screen for a long time is not held longer than ten
# seconds.

python3 - "$FRAMES" "$FRAMES/paced.txt" <<'PY'
import sys

frames_dir, out_path = sys.argv[1], sys.argv[2]
lines = [line.strip() for line in open(f'{frames_dir}/frames.txt') if line.strip()]

entries = []
for index, line in enumerate(lines):
    if line.startswith("file '"):
        path = line.split("'")[1]
        seconds = float(lines[index + 1].split()[1])
        entries.append((path, min(10.0, max(2.2, seconds))))

with open(out_path, 'w') as handle:
    for path, seconds in entries:
        handle.write(f"file '{path}'\nduration {seconds:.3f}\n")

print(f'{len(entries)} frames, {sum(s for _, s in entries):.1f} seconds')
PY

ffmpeg -y -loglevel error -f concat -safe 0 -i "$FRAMES/paced.txt" \
  -c:v libx264 -pix_fmt yuv420p -r $FPS -movflags +faststart "$WORK/main.mp4"

# --- join them ------------------------------------------------------------

printf "file '%s'\nfile '%s'\nfile '%s'\n" \
  "$WORK/title.mp4" "$WORK/main.mp4" "$WORK/end.mp4" > "$WORK/parts.txt"

ffmpeg -y -loglevel error -f concat -safe 0 -i "$WORK/parts.txt" -c copy "$OUT"

echo "written: $OUT"
ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$OUT"
