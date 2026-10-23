#!/usr/bin/env bash
# Assembles the demo video from the frames the recorder captured.
#
#   node demo/record-demo.mjs   # writes demo/build/frames
#   bash demo/assemble.sh       # writes demo/build/village-demo.mp4
#
# It makes the title card and the end card, paces the captured frames, and
# joins the three into one video. Everything is at 30 frames a second, so the
# video plays at the speed the frames were captured at.

set -euo pipefail

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
FRAMES=${FRAMES:-$HERE/build/frames}
WORK=${WORK:-$HERE/build/assemble}
OUT=${OUT:-$HERE/build/village-demo.mp4}
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
  -c:v libx264 -pix_fmt yuv420p -r $FPS -video_track_timescale 15360 "$WORK/title.mp4"

# --- the end card ---------------------------------------------------------

ffmpeg -y -loglevel error \
  -f lavfi -i "color=c=${PAPER}:s=${WIDTH}x${HEIGHT}:d=3:r=${FPS}" \
  -vf "drawtext=fontfile=${HEAD_FONT}:text='github.com/Udeibom/village':fontcolor=${INK}:fontsize=68:x=(w-text_w)/2:y=330,\
drawtext=fontfile=${BODY_FONT}:text='The AI writes the lesson. The code checks it.':fontcolor=${INK_SOFT}:fontsize=34:x=(w-text_w)/2:y=460" \
  -c:v libx264 -pix_fmt yuv420p -r $FPS -video_track_timescale 15360 "$WORK/end.mp4"

# --- the captured frames --------------------------------------------------
#
# Each captured still becomes a short clip, held for the time it was on
# screen. A frame that was on screen for a moment is held long enough to read,
# and a frame that was on screen for a long time is not held longer than ten
# seconds.
#
# Clips, not a concat list of images with `duration` lines: the concat demuxer
# does not apply the last image's duration, which silently shortens the final
# beat.

mkdir -p "$WORK/frames"
rm -f "$WORK/frames"/part-*.mp4

python3 - "$FRAMES" "$WORK/frames" "$FPS" <<'PY'
import os
import subprocess
import sys

frames_dir, parts_dir, fps = sys.argv[1], sys.argv[2], int(sys.argv[3])
lines = [line.strip() for line in open(f'{frames_dir}/frames.txt') if line.strip()]

entries = []
for index, line in enumerate(lines):
    if line.startswith("file '"):
        path = line.split("'")[1]
        seconds = float(lines[index + 1].split()[1])
        entries.append((path, min(10.0, max(2.2, seconds))))

parts = []
for index, (path, seconds) in enumerate(entries):
    frames = max(1, round(seconds * fps))
    part = os.path.join(parts_dir, f'part-{index:05d}.mp4')
    subprocess.run(
        [
            'ffmpeg', '-y', '-loglevel', 'error',
            '-loop', '1', '-i', path,
            '-frames:v', str(frames), '-r', str(fps),
            '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
            '-video_track_timescale', '15360',
            part,
        ],
        check=True,
    )
    parts.append(part)

with open(os.path.join(parts_dir, 'parts.txt'), 'w') as handle:
    for part in parts:
        handle.write(f"file '{part}'\n")

print(f'{len(entries)} frames, {sum(max(1, round(seconds * fps)) for _, seconds in entries) / fps:.1f} seconds')
PY

ffmpeg -y -loglevel error -f concat -safe 0 -i "$WORK/frames/parts.txt" \
  -c copy -movflags +faststart "$WORK/main.mp4"

# --- join them ------------------------------------------------------------

printf "file '%s'\nfile '%s'\nfile '%s'\n" \
  "$WORK/title.mp4" "$WORK/main.mp4" "$WORK/end.mp4" > "$WORK/parts.txt"

ffmpeg -y -loglevel error -f concat -safe 0 -i "$WORK/parts.txt" -c copy "$OUT"

echo "written: $OUT"
ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$OUT"
