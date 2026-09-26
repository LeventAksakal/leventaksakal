# v3 scroll journey: "One line of paint" (director's treatment)

Status: draft 1, for review. Companion to `brief.md`. Everything here is a contract between three
things that must agree: the **page** (HTML text, fixed), the **graybox** (Blender: layout, camera, timing)
and the **generated video** (Higgsfield or other image-to-video, with first/last frames + prompt).

Conventions: 24 fps; frames counted from 0 on the master timeline; `f96` = frame 96 = 4.0 s.
Landscape master 1920×1080 (16:9), portrait master 1080×1920 (9:16). Blender units = cm, paper on the
XY plane (Z = 0), +Y = "north" (away from the viewer at the start), +Z = up.

---

## 1. Intent

One continuous bead of cadmium paint is the only character. It signs the name, then keeps going; the
visitor's scroll is the hand that pulls it along. Every section is a place the line passes through and
changes shape to say what the section says (a stream, a cluster, a path, a ridge), then moves on.
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

The copy is final for v3 (from v2 `index.html`). Order and grouping below define the sections.

| Section | Content |
|---|---|
| **Nav** (fixed, appears in S1) | Name (painted, image) · GitHub · LinkedIn |
| **H0 Hero** | "Computer guy." / [Özyeğin logo] graduate. / MSc @ [Boğaziçi logo], working on harness engineering. / ♥ building software that serves people. |
| **P0 Featured Projects** (kicker + focus) | "I work on system design and fullstack applications using Vue, TypeScript, and Rust …" |
| **P1 MOQtail** | Title, "TypeScript · Rust · QUIC · WebCodecs · Media Streaming", description, moqtail.dev · GitHub |
| **P2 Kind Cluster K6 Testing** | Title, "Kubernetes · Kind · K6 · Prometheus · Grafana · Docker", description, GitHub |
| **W1 Constructor Technology** | [logo] title, "Software Engineering Intern (Remote) · Apr 2024 – Jul 2024", description |
| **W2 TÜBİTAK SAGE** | [logo] title, "Software Engineering Intern (Onsite) · Aug 2024 – Sep 2024", description |
| **A About** | 4 paragraphs: (1) versatile programmer, (2) approach, (3) guitar, kitchen, calisthenics, gaming, film, (4) mountaineering, climbing, skiing, water skiing, hiking, cycling |
| **F Footer** | GitHub · LinkedIn · © 2026 Zafer Levent Aksakal |

Layout rule for v3: in landscape, text lives in a **40 %-wide column that alternates sides** (left for
P0/P1, right for P2, left for W1/W2 and A, centred for F). In portrait, text lives in the **lower 45 %**
over a gradient scrim; the visual subject lives in the upper 55 %.

---

## 3. Style bible (every generated frame)

- **World**: one very large sheet of matte charcoal paper (#131417 to #1d1f24), fine tooth, soft
  crumple relief. No table edge, no horizon until S5.
- **Paint**: a single wet, glossy bead of cadmium yellow-orange, gradient from `oklch(0.86 0.16 85)` on
  top to `oklch(0.66 0.16 62)` in the shadow side, bead thickness ~4 mm, rounded cross-section,
  specular highlight running along the crest. Wet, never dry or cracked.
- **Light**: product-photography studio. Warm large softbox key from upper-left (casts soft shadows to
  the lower-right), cool thin strip rim light behind, dim fill. In S5–S6 the key lowers into a raking
  warm "dawn" light.
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
   (0,0)  [ Levent Aksakal ]  A: the name, 41 cm wide, centred at origin
                         \
                          B: run-off  (20,-1) -> (22,-15) -> (12,-35) -> (0,-50)
                          |
                    C: split point (0,-50); 5 threads, 1.2 cm apart,
                       bend east and run straight along y = -52..-57 from x = 5 to x = 90
                                              \
                                               D: cluster centred (110,-80): 3 node outlines
                                                  (8 x 22 cm, 4 cm gaps), 4 domes each (r 1.2 cm)
                                              /
                    E: path from (110,-100) -> knot K1 (80,-150) -> knot K2 (30,-200) -> (0,-240)
                       |
                    F: ridge: paper rises from y = -250 to the summit S (0,-320, z 35);
                       two side peaks (-25,-300, z 22) and (20,-290, z 18); the line runs on the crest
                       |
                    G: summit S: the bead stops, a glossy dome r 1.5 cm
```

Graybox materials: paper = mid-grey clay; paint = flat orange (emissive 0.2 so it reads in playblasts);
node outlines = thin orange curves at 30 % opacity. Paint = Bézier curve with a 2 mm round bevel.
Coordinates are a starting point; the **frame compositions in section 5 are the contract**.

---

## 5. Shot list

Each shot gives: frames, camera (Blender position → target, focal length), action, composition and
text-safe zone (landscape; portrait in brackets), join, and the generation prompt.

### S0 · Signature (hero, loop, not scrubbed)

- **Asset**: `hero-loop`, 96 frames (4 s), seamless loop; its frame 0 = master `f0`. Autoplays at
  scroll 0 only; the **poster** (AVIF, ≤ 80 KB) is this same frame, so first paint = final look.
- **Made by**: our renderer (offline capture), not generated.
- **Camera**: static. Pos (0, −55, 75) → target (0, −6, 0), 50 mm.
- **Action**: the name, fully written and wet. The studio highlight glides slowly along the letters left
  to right (the v2 hover gloss) and back; nothing else moves.
- **Composition**: name centred in the upper third, ~60 % of frame width. Text-safe: lower-left 50 % ×
  45 % (hero lines). [Portrait: name upper third at 85 % width; text lower 45 %.]
- **Optional first-visit only**: `hero-write`, the tube writing the name (our renderer, 6–8 s, skip on
  click), ending on `f0`. Decision pending; default is no writing clip (instant, calm).

### S1 · Run-off (hero → projects) · f0–f96 · scrubbed

- **Made by**: generated, start frame = `f0` (our render), end frame = graybox-guided still at the split.
- **Camera**: crane down and tilt. Pos (0, −55, 75) → (5, −95, 45); target (0, −6, 0) → (5, −50, 0); 50 mm.
- **Action**: the bead at the end of the final "l" swells and keeps flowing, running down and to the
  right, then curving back to the centre of the paper (path B). The camera follows the bead's head.
  The name exits the top of frame by **f36**.
- **UI operation**: at f30–f42 the nav name image fades in at the top, at the position where the painted
  name leaves frame (visual hand-off from video to UI).
- **End frame (f96)**: bead head at frame centre-left, just before the split point; empty dark paper
  ahead. Text-safe from f60: left 40 % (P0 enters).
- **Join**: match-frame into S2.
- **Prompt**: "Macro studio shot on dark charcoal paper. A single glossy wet bead of cadmium
  yellow-orange paint flows on from the end of a handwritten signature at the top of the frame, running
  down and curving across the paper. The camera cranes down and tilts to follow the head of the bead;
  the signature leaves the top of the frame in the first second. Warm softbox light from the upper left,
  cool rim light, shallow depth of field, slow smooth dolly motion, 4 seconds."

### S2 · Streams (Featured Projects + MOQtail) · f96–f240

- **Travel f96–f144**: at the split point the bead divides into **five** parallel fine threads
  (1.2 cm apart) that bend east and run in sync; the camera trucks right with them.
- **Dwell f144–f240**: the threads are formed and flowing; **light pulses** (brief highlights, like
  packets) travel along the threads left to right at staggered intervals; camera trucks right slowly
  (15 cm over 96 frames). Pos (15, −100, 40) → (45, −100, 40), target (20, −55, 0) → (50, −55, 0), 50 mm.
- **Composition**: threads enter from the lower-left edge and run diagonally to the right edge,
  occupying the right 60 % and lower half. Text-safe: left 40 % full height (P0, P1).
  [Portrait: threads cross the upper 55 % diagonally; text lower 45 %.]
- **Join**: match-frame into S3.
- **Prompt (two generations: travel, dwell)**: "Macro studio shot on dark charcoal paper. A glossy
  cadmium yellow-orange paint bead splits into five thin parallel wet threads that curve and run side by
  side toward the right of the frame. Small bright highlights travel along the threads like pulses of
  light. The camera trucks slowly to the right, following the threads. Left side of the frame stays
  empty dark paper. Warm softbox key light, cool rim light, shallow depth of field."

### S3 · Cluster (Kind Cluster K6) · f240–f384

- **Travel f240–f300**: the five threads bend down-right and converge onto a grid: three faint
  rectangular paint outlines (nodes), each holding four glossy domes (pods). The threads end at the domes.
- **Dwell f300–f384**: a **wave of pulses** arrives along the threads (the load test) and the domes light
  up one after another, column by column, then all hold steady (the cluster holds the load). Camera:
  slow push-in, 50 → 60 mm. Pos (80, −115, 45) → target (110, −80, 0).
- **Composition**: cluster in the left 55 %, slightly below centre. Text-safe: right 40 % (P2).
  [Portrait: cluster upper 55 %; text lower 45 %.]
- **Join**: match-frame into S4.
- **Prompt**: "Macro studio shot on dark charcoal paper. Five thin glossy threads of cadmium
  yellow-orange paint converge onto a neat grid of small glossy paint domes, arranged in three columns of
  four, each column inside a faint thin painted rectangle. A wave of bright highlights runs along the
  threads and lights up the domes one after another. Slow push-in. Right side of the frame stays empty
  dark paper. Studio softbox light, shallow depth of field."

### S4 · Waypoints (Previous Positions) · f384–f588

- **Travel f384–f444**: the camera cranes up to a near top-down "map" view (pitch 10° from vertical);
  a single line leaves the bottom of the cluster and draws a path south-west to the first **knot**
  (a small tight coil of paint, K1).
- **Dwell f444–f492 (W1 Constructor)**: K1 holds centre-right; the highlight circles the coil once.
- **Travel f492–f540**: the path continues to the second knot K2; the camera tracks along it, top-down.
- **Dwell f540–f588 (W2 TÜBİTAK SAGE)**: K2 holds centre-right; highlight circles once.
- **Camera**: pos (95, −150, 90) → (40, −205, 90), target directly below, 50 mm.
- **Composition**: path runs top-right to bottom-centre; the current knot at 62 % width, 45 % height.
  Text-safe: left 40 % (W1 then W2). [Portrait: knot at 50 % width, 30 % height; text lower 45 %.]
- **Sync**: each knot's dwell is anchored to its entry's scroll position (section 6), so the knot is
  "on" exactly while its entry is read.
- **Prompt**: "Top-down macro view of dark charcoal paper. A single glossy line of cadmium yellow-orange
  paint draws a path across the paper and forms a small tight coil, then continues to a second coil.
  The camera glides overhead along the path. Left third of the frame stays empty. Soft studio light,
  subtle paper texture."

### S5 · Ridge (About) · f588–f828

- **Travel f588–f684**: the camera descends from top-down to a grazing angle (pitch 80° from vertical,
  lens at 6 cm height), looking south along the path. As it lowers, the paper ahead rises into creased,
  folded terrain: the line turns out to run along a **ridge crest**. The key light lowers and warms into
  a raking dawn light; long shadows.
- **Dwell f684–f828 (About paragraphs 1–4)**: slow push along the ridge toward the summit, 85 mm.
  Pos (−10, −230, 6) → (−4, −275, 14), target (0, −320, 30). Paragraphs 1–3 read over the low slopes;
  paragraph 4 (mountains) arrives as the full ridge and the summit are revealed (f780).
- **Composition**: ridge from lower-right rising to the upper-right third; the sky/background above is
  dark with a warm glow near the horizon. Text-safe: left 40 %. [Portrait: ridge in the upper 55 %.]
- **Prompt**: "Low grazing macro shot across dark charcoal paper that rises into folded paper mountains,
  a glossy line of cadmium yellow-orange paint running along the crest of the ridge toward a peak. Warm
  low raking dawn light, long soft shadows, slow push forward along the ridge, shallow depth of field.
  Left side of the frame stays dark and empty."

### S6 · Summit (Footer) · f828–f900, hold

- **Action**: the paint climbs the last slope and stops at the summit as a small glossy dome; the camera
  settles, eases to a stop at **f900** and holds (the final frame is the resting state; it is also the
  still for reduced motion).
- **Camera**: pos (−4, −275, 14) → (−2, −282, 20), target (0, −320, 36), 85 mm.
- **Composition**: summit dot at 50 % width, 38 % height; footer text centred below.
  [Portrait: summit 50 % × 30 %.]
- **Prompt**: "Macro shot of a small paper mountain peak at dawn. A glossy line of cadmium yellow-orange
  paint climbs the last slope and stops at the summit as a small shining dome. The camera eases to a
  stop. Warm low light, dark background, calm, still."

### Cut list (joins)

| Join | Frame | Operation |
|---|---|---|
| poster / S0 → S1 | f0 | same frame; loop crossfades to scrub video over 150 ms on first scroll |
| S1 → S2 | f96 | match-frame (S1 last frame = S2 start image) |
| S2 travel → dwell | f144 | match-frame |
| S2 → S3 | f240 | match-frame |
| S3 travel → dwell | f300 | match-frame |
| S3 → S4 | f384 | match-frame |
| S4 segments | f444, f492, f540 | match-frame |
| S4 → S5 | f588 | match-frame |
| S5 travel → dwell | f684 | match-frame |
| S5 → S6 | f828 | match-frame |
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
| a1 | P0 kicker | f96 |
| a2 | P1 MOQtail title | f144 |
| a3 | P1 end | f240 |
| a4 | P2 Kind title | f300 |
| a5 | P2 end | f384 |
| a6 | W1 Constructor | f444 |
| a7 | W1 end | f492 |
| a8 | W2 SAGE | f540 |
| a9 | W2 end | f588 |
| a10 | About kicker | f684 |
| a11 | About paragraph 4 | f780 |
| a12 | footer | f900 |

Spacing: travel gaps get ~60–80 vh of empty scroll between text blocks, so a full camera move takes
about one screen of scrolling. Reduced motion: no video; each section shows its dwell still (the frame
at its anchor). Delivery: segmented per shot, short keyframe interval for smooth scrubbing,
landscape and portrait sets; S1 and the poster load first, the rest as the visitor approaches.

---

## 7. Production steps

1. **Review this treatment** (story, beats, compositions); lock it.
2. **Style references**: render the reference stills from v2 (name, paint close-up, paper).
3. **Graybox** (Blender): build the map in section 4, animate the camera per section 5 at 24 fps,
   export per shot: first frame, last frame, and a playblast (motion reference). MS Paint/quick sketches
   are fine for a first pass of the key frames.
4. **Key frames**: turn each graybox start/end frame into a styled still (image model with the style
   reference), check the text-safe zones and the match-frames.
5. **Generate** each shot image-to-video with its first and last frames and prompt; iterate per shot.
6. **Assemble and encode**, then build the page (HTML + scroll-to-playhead script) and tune the anchors.
