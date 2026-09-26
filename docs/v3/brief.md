# v3: one line of paint (scroll journey)

Status: **draft for discussion**. v2 (live WebGPU intro) is frozen on `claude/wizardly-archimedes-3xochp` and
the dev preview; production stays on v1 until we say go.

## Why v3

v2 renders the intro live. Every first visit has an empty GPU shader cache, so the browser compiles the
paint, tube and paper shaders before the first frame: seconds of "Loading", never instant, and a GPU risk
on weak devices. v3 keeps the look and turns it into **pre-rendered video driven by scroll**:

- First paint shows the opening frame (a small AVIF poster in the HTML): instant.
- The text is plain HTML over the video: readable and indexable immediately, with the logos from v2.
- Video segments stream in behind it; scroll moves the playhead (scrubbing), so the visitor drives the camera.
- No three.js on the page, no GPU compilation, works on every browser and phone.

## The story: one line of paint

A single bead of cadmium paint is the thread through the whole page. It writes the name, then leaves
the name and keeps going, and scrolling follows it. Each section is a place the line passes through; the
section's text sits beside it. Same world as v2: dark paper, studio softbox light, macro lens, wet glossy
paint.

| # | Section (existing content) | Frame / motion | Where the text sits |
|---|---|---|---|
| 0 | **Hero**: name + four lines, uni logos | Opening: the name already written in paint on dark paper (poster = this frame). On the first visit only, a short autoplayed clip of the tube writing it (our renderer, offline). | Name top, hero lines bottom-left (as v2) |
| 1 | transition | The tube lifts off; the last stroke of "Aksakal" doesn't stop: the bead runs on, off the name and down the paper. Camera tilts down and follows it. | none, a scroll cue |
| 2 | **Featured Projects: MOQtail** (Media over QUIC, live streaming) | The line thins and speeds up into a stream: it splits into many fine parallel paint threads moving in sync, pulses travel along them like packets. | Left column, video on the right |
| 3 | **Featured Projects: Kind cluster + K6** (Kubernetes, load testing) | The threads converge on a grid of small paint dots (pods/nodes). A wave of light pulses hits them (load test), they hold. | Right column, video on the left |
| 4 | **Previous Positions** (Constructor Technology, TÜBİTAK SAGE) | The line becomes a path with two waypoints: a small paint knot at each, the company mark in the HTML next to it. | Beside each waypoint |
| 5 | **About** (guitar, cooking, calisthenics, mountaineering, climbing, skiing, cycling) | Camera pulls back and lowers to paper level: the line rises into a mountain ridge silhouette, raking light like dawn. | Over the lower sky area |
| 6 | **Footer / contact** | At the summit the bead stops as a small glossy dot. Scroll end = still frame. | Centered |

Scroll back up and the video plays backwards: the line retracts to the name.

## Pipeline

1. **Story and flow** (this doc): agree on sections, beats, pacing (how many screen heights each takes).
2. **Sketches / design frames**: one key frame per section (start and end of each shot), composed for
   landscape 16:9 and portrait 9:16, with the text areas marked. First as quick sketches, then as
   polished stills.
3. **Shots**:
   - Name shots (0, and the start of 1): rendered offline by our own renderer (`tools/capture.mjs`,
     deterministic), because AI video cannot write the name legibly or consistently.
   - Journey shots (1 to 6): generated (Higgsfield or similar) **image-to-video with fixed first and last
     frames**, so each shot ends exactly where the next begins: one continuous camera move. I write the
     exact prompt, duration, camera move, and the two key frames for each shot.
4. **Encode**: per segment, H.264 MP4 (universal) with short keyframe spacing so scrubbing is smooth, plus
   AV1/WebM where smaller. Landscape and portrait sets. Target: poster ≤ 80 KB, first segment ≤ 600 KB,
   whole journey a few MB, loaded section by section.
5. **Build**: plain HTML + a small scroll-to-playhead script (no framework, no three.js). Reduced motion: the
   stills only. Fallback for anything that fails: the stills.

## Open questions

- Tone: is "one line of paint" right, or should the journey be more literal (e.g. the work shown as screens)?
- Keep the first-visit writing clip at all, or open straight on the written name (instant, and the
  motion starts only when the visitor scrolls)?
- Generation tool: Higgsfield (you run it with my prompts and frames) or the ElevenLabs creative
  connector available in these sessions (I can generate the sketch frames directly).
