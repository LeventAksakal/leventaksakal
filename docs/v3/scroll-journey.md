# v3 scroll journey: "One line of paint" (director's treatment)

Status: draft 2 (content revised: four production projects, About cut), for review. Companion to `brief.md`. Everything here is a contract between three
things that must agree: the **page** (HTML text, fixed), the **graybox** (Blender: layout, camera, timing)
and the **generated video** (Higgsfield or other image-to-video, with first/last frames + prompt).

Conventions: 24 fps; frames counted from 0 on the master timeline; `f96` = frame 96 = 4.0 s.
Landscape master 1920×1080 (16:9), portrait master 1080×1920 (9:16). Blender units = cm, paper on the
XY plane (Z = 0), +Y = "north" (away from the viewer at the start), +Z = up.

---

## 1. Intent

One continuous bead of cadmium paint is the only character. It signs the name, then keeps going; the
visitor's scroll is the hand that pulls it along. Every section is a place the line passes through and
changes shape to say what the section says (a plan, a stream, a path, a full stop), then moves on.
The camera never cuts visibly: it is one take, drawn by the paint.

Director's rules:

1. **Motion between sections, stillness during reading.** Camera travel happens in the scroll gaps
   between text blocks. While a text block is readable the frame is near-still (slow drift, ≤ 2 % of the
   frame width per second of scroll), so the text never sits on moving detail.
2. **Text-safe zones are sacred.** Every shot names where the text sits; that area is dark, even paper
   (luminance ≤ 12 %, no highlights, no paint). The subject stays out of it.
3. **The paint is the only saturated colour.** Everything else is charcoal paper and white/cool light.
4. **Legible lettering exists only where our own renderer made it** (the name, shot S0 and the first
   second of S1). Generated shots must never show letters, words or logos.
5. **Every join is a match-frame.** The last frame of shot N is, pixel for pixel, the first frame of
   shot N+1 (it is used as the next shot's start image). No crossfades except the declared ones.
6. **Reversible.** Scrolling up plays the video backwards, so nothing may look wrong in reverse (no
   splashes, drips or falling objects; paint moves along its own path only).

---

## 2. Locked content (the page)

v3 content (revised 2026-09-26): the About section is cut; the hero carries the personal note; the
featured work is four production projects. Items marked **TBD** come from Levent.

| Section | Content |
|---|---|
| **Nav** (fixed, appears in S1) | Name (painted, image) · GitHub · LinkedIn |
| **H0 Hero** | "Computer guy." / [Özyeğin logo] graduate. / Currently MSc @ [Boğaziçi logo], / working on harness engineering. / ♥ building software. |
| **P0 Work** (kicker only) | "Work" |
| **P1 APS** | Özyeğin University Academic Planning System · one-liner, role, stack, link: **TBD** |
| **P2 BabyTell** | one-liner, role, stack, link: **TBD** |
| **P3 Temizelisg** | name spelling, one-liner, role, stack, link: **TBD** |
| **P4 MOQtail** | "TypeScript · Rust · QUIC · WebCodecs · Media Streaming", Media-over-QUIC library, moqtail.dev · GitHub |
| **W1 Constructor Technology** | [logo] title, "Software Engineering Intern (Remote) · Apr 2024 – Jul 2024", description |
| **W2 TÜBİTAK SAGE** | [logo] title, "Software Engineering Intern (Onsite) · Aug 2024 – Sep 2024", description |
| **F Footer** | GitHub · LinkedIn · © 2026 Zafer Levent Aksakal |

Layout rule for v3: in landscape, text lives in a **40 %-wide column that alternates sides** (left for
P1, right for P2, left for P3, right for P4, left for W1/W2, centred for F). In portrait, text lives in
the **lower 45 %** over a gradient scrim; the visual subject lives in the upper 55 %.

---

## 3. Style bible (every generated frame)

- **World**: one very large sheet of matte charcoal paper (#131417 to #1d1f24), fine tooth, soft
  crumple relief. No table edge, no horizon until S5.
- **Paint**: a single wet, glossy bead of cadmium yellow-orange, gradient from `oklch(0.86 0.16 85)` on
  top to `oklch(0.66 0.16 62)` in the shadow side, bead thickness ~4 mm, rounded cross-section,
  specular highlight running along the crest. Wet, never dry or cracked.
- **Light**: product-photography studio. Warm large softbox key from upper-left (casts soft shadows to
  the lower-right), cool thin strip rim light behind, dim fill. Identical in every shot: the lights
  are fixed to the world, never to the camera, and never change.
- **Lens**: macro still-life look, 50–85 mm equivalent, shallow depth of field with tilt-shift falloff
  at the top and bottom of frame; slight vignette. No lens flares, no bokeh balls.
- **Motion**: slow, weighted, dolly/crane moves; no handheld shake; no speed ramps inside a shot.
- **Negative prompt (all generated shots)**: text, letters, words, numbers, logos, watermark, hands,
  people, brushes, extra objects, splashes, drips, colour shift, blue or purple paint, cuts, flicker,
  camera shake, zoom pulsing.

Reference stills: rendered from v2 by our renderer (to be produced next: the finished name, a paint
close-up, the paper texture), used as the style reference image for every generation.

---

## 4. World layout (top-down map for the graybox)

```
            +Y (north)
               ^
   (0,0)  [ Levent Aksakal ]   A: the name, 41 cm wide, centred at origin
                         \
                          B: run-off (20,-1) -> (22,-15) -> (12,-35) -> (0,-50)
                          |
                    S2 station APS        centred (30,-80)    grid 5 rows x 4 cols of blocks
                          |
                    S3 station BabyTell   centred (-20,-140)  shape TBD
                          |
                    S4 station Temizelisg centred (30,-200)   shape TBD
                          |
                    S5 station MOQtail    centred (-10,-260)  5 threads along y = -255..-262
                          |
                    S6 path: knot K1 (30,-320) -> knot K2 (-10,-370)
                          |
                    S7 rest: the full stop, dome r 1.5 cm at (0,-400)
```

The line zig-zags south so that each station sits on the side opposite its text column. Graybox
materials: paper = mid-grey clay; paint = flat orange (emissive 0.2); paint = Bézier curve with a 2 mm
round bevel. Coordinates are a starting point; the **frame compositions in section 5 are the contract**.

---

## 5. Shot list

Each shot gives frames, camera (Blender position → target, focal length), action, composition with the
text-safe zone (landscape; portrait in brackets), and the join. Prompts live in `recipe.md` (shot sheets).
A **station** is travel (48 f: the line arrives and starts forming the shape) + dwell (96 f: the shape
completes and holds, near-still, while the entry is read).

### S0 · Signature (hero, loop, not scrubbed)

- **Asset**: `hero-loop`, 96 f seamless loop; its frame 0 = master `f0` = the **poster** (AVIF ≤ 80 KB).
- **Made by**: our renderer (offline capture), not generated.
- **Camera**: static. Pos (0, −55, 75) → target (0, −6, 0), 50 mm.
- **Action**: the name, fully written and wet; the studio highlight glides along the letters and back.
- **Composition**: name centred in the upper third, ~60 % of frame width. Text-safe: lower-left 50 % ×
  50 % (five hero lines). [Portrait: name upper third at 85 % width; text lower 45 %.]
- **Optional first-visit only**: `hero-write` (tube writing the name, our renderer, skip on click),
  ending on `f0`. Default: not used.

### S1 · Run-off · f0–f96

- **Made by**: generated; start = `f0` (our render), end = styled key frame K1-end.
- **Camera**: crane down and tilt. Pos (0, −55, 75) → (15, −105, 45); target (0, −6, 0) → (22, −72, 0); 50 mm.
- **Action**: the end of the final "l" keeps flowing; the bead runs down and right along path B. The name
  exits the top of frame by **f36**. Nav name image fades in at f30–f42 where the painted name leaves.
- **End (f96)**: bead head entering the APS area from the upper-left; right 60 % dark and empty.

### S2 · APS (Academic Planning System) · f96–f240 · text left

- **Travel f96–f144**: the bead lays down five faint horizontal rows (semesters).
- **Dwell f144–f240**: short paint blocks (courses) slide along the rows into place, a few joined by thin
  lines (prerequisites); the last block settles at f228; camera slow push-in, 50 → 55 mm.
  Pos (30, −115, 45) → target (30, −80, 0).
- **Composition**: grid in the right 55 %, centred vertically. Text-safe: left 40 %. [Portrait: grid upper 55 %.]

### S3 · BabyTell · f240–f384 · text right

- **Travel f240–f288 / dwell f288–f384**: shape **TBD** from the one-liner.
- **Composition**: subject in the left 55 %. Text-safe: right 40 %.

### S4 · Temizelisg · f384–f528 · text left

- **Travel f384–f432 / dwell f432–f528**: shape **TBD** from the one-liner.
- **Composition**: subject in the right 55 %. Text-safe: left 40 %.

### S5 · MOQtail · f528–f672 · text right

- **Travel f528–f576**: the bead splits into **five** parallel fine threads (1.2 cm apart) running in sync.
- **Dwell f576–f672**: brief highlights (packets) travel along the threads at staggered intervals; camera
  trucks slowly with them (15 cm over 96 f). Pos (−25, −290, 40) → (−10, −290, 40), target (−20, −258, 0) → (−5, −258, 0).
- **Composition**: threads cross the left 60 % diagonally. Text-safe: right 40 %.

### S6 · Waypoints (Previous Positions) · f672–f864 · text left

- **Travel f672–f720**: camera cranes up to near top-down (10° from vertical); one line draws a path to
  knot K1 (a tight coil).
- **Dwell f720–f768 (W1 Constructor)**: K1 holds at 62 % width, 45 % height; the highlight circles once.
- **Travel f768–f816**: path continues to K2. **Dwell f816–f864 (W2 TÜBİTAK SAGE)**: same framing.
- **Camera**: pos (45, −320, 90) → (5, −370, 90), target directly below, 50 mm. Text-safe: left 40 %.

### S7 · Full stop (Footer) · f864–f936, hold

- **Action**: the line runs a short way and ends in a single glossy dome: the full stop. The camera eases
  down to 45° and stops at **f936**; the final frame holds (also the reduced-motion still).
- **Camera**: pos (0, −430, 40) → (0, −425, 28), target (0, −400, 0), 85 mm.
- **Composition**: the dot at 50 % width, 38 % height; footer text centred below. [Portrait: 50 % × 30 %.]

### Cut list (joins)

| Join | Frame | Operation |
|---|---|---|
| poster / S0 → S1 | f0 | same frame; the loop crossfades to the scrub video over 150 ms on first scroll |
| S1 → S2 → … → S7 | f96, f240, f384, f528, f672, f864 | match-frame (last frame of N = start image of N+1) |
| travel → dwell inside a station | f144, f288, f432, f576, f720, f768, f816 | match-frame |
| any generation mismatch | at join | fallback: 6-frame dissolve, logged here |

---

## 6. Scroll mapping

The page scrolls normally; the video is a fixed background whose playhead follows scroll through
**anchors**: each anchor ties a DOM position (an element's top reaching 35 % of the viewport height) to a
master frame; between anchors the playhead interpolates linearly. Anchors are data attributes on the
sections, so the mapping survives different text lengths and aspect ratios.

| Anchor | Element | Frame |
|---|---|---|
| a0 | page top | f0 |
| a1 | Work kicker | f96 |
| a2, a3 | APS entry top, end | f144, f240 |
| a4, a5 | BabyTell entry top, end | f288, f384 |
| a6, a7 | Temizelisg entry top, end | f432, f528 |
| a8, a9 | MOQtail entry top, end | f576, f672 |
| a10, a11 | Constructor top, end | f720, f768 |
| a12, a13 | TÜBİTAK SAGE top, end | f816, f864 |
| a14 | footer | f936 |

Travel gaps get ~60–80 vh of empty scroll between entries, so a camera move takes about one screen of
scrolling. Reduced motion: no video; each section shows its dwell still. Delivery: segmented per shot,
short keyframe interval for smooth scrubbing, landscape and portrait sets; the poster and S1 load
first, the rest as the visitor approaches.

---

## 7. Production steps

1. **Review this treatment** (story, beats, compositions); lock it.
2. **Style references**: render the reference stills from v2 (name, paint close-up, paper).
3. **Graybox** (Blender): build the map in section 4, animate the camera per section 5 at 24 fps,
   export the passes listed in `recipe.md`.
4. **Key frames, generation, QA, assembly**: see `recipe.md`.
