# v3 production recipe: from treatment to scrubbed video

Companion to `scroll-journey.md` (what we shoot) and `brief.md` (why). This file is **how**, with every
input pinned so a generated shot is reproducible and reviewable. If a step's output fails its check, it
does not go downstream.

## 0. The principle: the model only paints

A video model is deterministic enough only when it has nothing left to decide. Everything that matters
is fixed before generation, and the model only renders material and light:

| Decided by | What |
|---|---|
| **Content** (locked copy) | which sections exist, their order, what each station shape means |
| **Graybox** (Blender) | world layout, subject shapes, camera path, lens, timing to the frame, light directions |
| **Key frames** (styled stills) | the exact first and last image of every shot; joins are the same file |
| **Reference pack** | look: paper, paint, gloss, palette, light quality |
| **Shot sheet** | model + version, seed, duration, resolution, prompt, negative prompt, strength settings |
| **QA gates** | measurable pass/fail per take, before anything is assembled |

Three rules follow: (1) never generate a frame without a start and an end key frame; (2) never change
two inputs between takes (so a fix is attributable); (3) every take is logged, including the rejects.

## 1. Inputs needed from Levent (blocking the station designs)

Per project (APS, BabyTell, Temizelisg, MOQtail):

- exact name and spelling as it should appear;
- one line, ≤ 20 words: what it does and for whom;
- your role (e.g. lead, backend, full stack) and period;
- stack, ≤ 6 items;
- links (live site, store page, repo) or "private";
- optional: 2–3 screenshots or a 10 s screen recording, if the page should show the product next to the
  paint (shown in HTML, never generated), and confirmation it may be shown publicly (APS is an internal
  university system).

Plus: the order of the four projects (draft order: APS, BabyTell, Temizelisg, MOQtail), and whether
Previous Positions stays (draft: yes).

From the one-liners I design one **station shape** per project (drafts: APS = semester rows with course
blocks sliding into place; MOQtail = five synced threads carrying pulses). Shapes must be buildable from
one paint line: rows, blocks, dots, threads, coils, outlines; no objects, no symbols, no letters.

## 2. Reference pack (R-series): made once, used by every generation

| Id | What | How | Spec |
|---|---|---|---|
| R1 | Finished name on the paper (the signature look) | v2 renderer, final state | 3840×2160 PNG |
| R2 | Paint macro: bead crest, highlight, wet edge | v2 renderer, capture follow mode | 2048² PNG ×3 (straight, curve, junction) |
| R3 | Paper macro under the key light | v2 renderer, paint hidden | 2048² PNG |
| R4 | Palette card | generated from the tokens below | PNG swatches with hex labels (for humans only; never fed as an image to a video model, it has text) |
| R5 | Light sheet | graybox: grey sphere + bead segment under the fixed rig | 1920×1080 PNG |
| R6 | Rejects board | collected during generation | examples of what not to accept |

Palette tokens: paper `#131417` → `#1d1f24`; paint top `#ffc73a` (oklch 0.86 0.16 85), paint shadow
side `#d57700` (oklch 0.66 0.16 62); highlight near-white warm `#fffbe9`; rim light cool `#cfdcff`.

## 3. Graybox (Blender): the layout, camera and clock

Built by a script (`tools/v3/graybox.py`, bpy), so it is versioned and rebuilt identically:

- **Scene**: units cm; 24 fps; one continuous master timeline f0–f936 (`scroll-journey.md` §5).
- **World**: paper plane 400 × 520 cm with a mild crumple displacement (fixed noise seed); the paint line
  = one Bézier curve, 2 mm round bevel, animated growth (bevel factor end) along the path; station shapes
  as further curves/domes with their own growth keys.
- **Lights, fixed to the world**: key = area light 120 × 80 cm, 4500 K, from upper-left
  (direction −0.6, 0.74, 0.3); rim = area strip 200 × 10 cm, 7500 K, behind; fill = area 100 cm, 5500 K,
  5 % of key. Never animated.
- **Cameras**: `CAM_L` (16:9) and `CAM_P` (9:16): one path each, keyed at every shot boundary with the
  positions, targets and focal lengths of §5; sensor 36 mm; ease in/out only at dwell starts/ends.
- **Output per shot and per aspect** (folder `v3/shots/<shot>/<aspect>/graybox/`):
  - `pb.mp4`: playblast, clay shading, paint flat orange, exact frame range (motion reference);
  - `depth_start.png`, `depth_end.png`: normalised Z (near/far fixed per shot);
  - `mask_paint_start.png`, `mask_paint_end.png`: paint only (structure reference);
  - `safe.png`: the text-safe zone for this shot (white = must stay dark);
  - `camera.json`: per-frame camera matrix + focal length (for compositing and QA).

## 4. Key frames: the frozen start and end of every shot

For each shot boundary (f0, f96, f144, …, f936) and aspect, one canonical still:

1. **Input**: graybox `depth_*.png` (+ `mask_paint_*.png`) as the structure control, R1–R3 as style
   references, prompt from the shot sheet (§6), fixed seed.
2. **Generate** 4 candidates with an image model that accepts a structure control and a style reference.
   Pick one; if none passes, change one input and regenerate.
3. **Check** (§7 image gates): paint stays on the graybox paint mask (IoU ≥ 0.85), text-safe zone dark,
   no letters, palette in range.
4. **Freeze**: save as `v3/keys/<aspect>/k<frame>.png` (e.g. `k0240.png`). This file is the **end frame of
   the shot before and the start frame of the shot after**. It is never regenerated once a neighbouring
   shot has been generated from it.

Exceptions: `k0000` is not generated; it is the v2 renderer's final-state frame at the S0 camera.

## 5. Video generation: one shot at a time

Requirements for the model (Higgsfield: pick a model there that has all three; otherwise Runway, Luma,
Kling, or, for full control, Wan 2.x VACE in ComfyUI with a depth video):

1. start frame **and** end frame;
2. a motion reference (the graybox playblast or its depth video) or explicit camera control;
3. fixed seed, duration and resolution.

Procedure per shot:

1. Fill the shot sheet (§6): model and version, seed, duration, resolution, key frames, motion reference,
   prompt, negative prompt, motion/guidance strength. Commit it.
2. Generate. Save as `v3/shots/<shot>/<aspect>/takes/t<nn>.mp4` with the sheet values in `t<nn>.json`.
3. Run the QA gates (§7). Pass → `final.mp4`. Fail → change **one** input, next take, log why.
4. Cap: 6 takes per shot; then simplify the shot (shorter move, fewer shape changes) rather than
   rolling dice.

## 6. Shot sheets (prompts)

Shared suffix for every prompt, verbatim:
> "Macro still-life studio photograph in motion, on a vast sheet of matte charcoal paper with fine tooth
> and soft creases. The only colour is a single glossy wet bead of cadmium yellow-orange paint with a
> bright highlight along its crest. Warm large softbox from the upper left, thin cool rim light behind,
> soft shadows to the lower right. Shallow depth of field, gentle tilt-shift falloff, slight vignette.
> Smooth, slow, weighted camera motion."

Shared negative prompt, verbatim:
> "text, letters, words, numbers, logos, watermark, hands, people, brushes, tubes, extra objects,
> splashes, drips, spray, liquid spill, colour shift, blue paint, purple, green, cuts, flicker, camera
> shake, zoom pulsing, morphing background."

| Shot | Frames | Prompt (before the suffix) |
|---|---|---|
| S1 Run-off | f0–f96 (4.0 s) | "The end of a painted signature at the top of the frame keeps flowing: the bead runs down and to the right across the paper. The camera cranes down and tilts to follow the head of the bead; the signature leaves the top of the frame within the first second. The right side of the frame ahead of the bead stays empty dark paper." |
| S2 APS travel | f96–f144 (2.0 s) | "The paint bead lays down five faint parallel horizontal lines across the right half of the frame, one after another. The camera drifts slowly. The left side of the frame stays empty dark paper." |
| S2 APS dwell | f144–f240 (4.0 s) | "Short rounded bars of glossy paint slide along the five lines and settle into place like blocks in a timetable; a few thin paint lines connect blocks between rows. Slow push-in. The left side of the frame stays empty dark paper." |
| S3 BabyTell | f240–f384 | TBD (after the one-liner): subject in the left 55 %, "the right side of the frame stays empty dark paper". |
| S4 Temizelisg | f384–f528 | TBD: subject in the right 55 %, "the left side … stays empty". |
| S5 MOQtail travel | f528–f576 (2.0 s) | "The paint bead splits into five thin parallel threads that curve and run side by side across the left of the frame. The camera trucks slowly with them. The right side of the frame stays empty dark paper." |
| S5 MOQtail dwell | f576–f672 (4.0 s) | "Small bright highlights travel along the five parallel paint threads at staggered intervals, like pulses of light. The camera trucks slowly to the right. The right side of the frame stays empty dark paper." |
| S6 Waypoints | f672–f864 (4 segments of 2.0 s) | "Top-down view. A single paint line draws a path across the paper and winds into a small tight coil; the highlight circles the coil once." (segment 3: "the path continues from the coil to a second coil"). "The left third of the frame stays empty." |
| S7 Full stop | f864–f936 (3.0 s) | "A short paint line ends in a single round glossy dome, like a full stop. The camera eases down and comes to rest. Calm, still." |

Travel and dwell are separate generations (short shots are far more controllable), joined at the frozen
key frame between them.

## 7. QA gates (measured by script, `tools/v3/qa.py`, plus one human pass)

Per key frame:
- paint IoU with the graybox paint mask ≥ 0.85;
- text-safe zone: mean luminance ≤ 12 %, max ≤ 25 %;
- no text: OCR finds nothing;
- paint hue within ΔE ≤ 6 of the palette tokens.

Per take:
- exact frame count and 24 fps after conform;
- first/last frame vs. key frames: SSIM ≥ 0.97 (else trim/hold, else reject);
- text-safe zone on every frame, as above;
- no text on every 6th frame;
- flicker: frame-to-frame mean luminance change in static paper ≤ 2 %;
- human: plays well forwards **and backwards**, no morphing, bead continuity.

Per join (after assembly): SSIM across the cut ≥ 0.97; otherwise the declared 6-frame dissolve.

## 8. Assembly and delivery

1. Conform every take to 24 fps and its exact frame range; one grade (LUT) for all shots.
2. S0 loop and the first second of S1 come from our renderer (the only legible lettering).
3. Encode per shot and aspect: H.264 High, CRF ≈ 20, keyframe every 12 frames (smooth scrubbing),
   `+faststart`; AV1 alternates where smaller. Poster `k0000` as AVIF ≤ 80 KB; dwell stills as AVIF
   for reduced motion.
4. Budgets (landscape 1920×1080): poster ≤ 80 KB; S1 ≤ 600 KB; each station ≤ 900 KB; whole journey
   ≤ 8 MB, loaded one shot ahead of the reader.
5. Page: plain HTML + a scroll-to-playhead script over the anchors of `scroll-journey.md` §6.

## 9. Order of work

| Step | Who | Output |
|---|---|---|
| 1 | Levent | §1 inputs (project one-liners etc.) |
| 2 | Claude | station shapes for BabyTell and Temizelisg; treatment locked |
| 3 | Claude | R1–R5 reference pack; `graybox.py`; graybox outputs for all shots (landscape first) |
| 4 | Levent + Claude | key frames: Levent runs the image model, Claude checks with `qa.py` |
| 5 | Levent + Claude | shots: Levent runs the video model with the shot sheets, Claude QA and logs |
| 6 | Claude | assembly, encode, the page, the scrub prototype on the dev preview |
| 7 | both | portrait set (same steps, `CAM_P`) |

Portrait is its own set of key frames and generations, never a crop of landscape (a crop breaks the
text-safe zones and the compositions).
