# leventaksakal.dev — v2

Personal site whose intro is the name **Levent Aksakal** written in yellow paint paste from a tube.
The build follows milestones: strokes → physics → look → transition/content → hardening.

**Status: first full preview of the site.** `npm run dev`, then open `/` (the site), `/lab/paste/`
(physics + look, every parameter in the panel) or `/lab/strokes/` (lettering and timing).

URL switches: `?quality=high|medium|low`, `?final` (skip straight to the settled page),
`?webgl` (force the WebGL2 backend), `?font=damion` (labs only).

### How the home page runs

1. The charcoal paper fades up from black while the tube comes in from the upper right.
2. The tube writes the name (Tier-1 simulation in real time in a Web Worker, ~12.5 s), leaves, the paste settles.
3. Camera and name glide so the name lands top-centre at nav size; the paper dims; the content fades in.
4. From then on the scene renders only on demand (resize, hover) and the frame loop sleeps. Scrolling
   never touches WebGL: a CSS overlay (`#dim`, opacity only) recedes the paper under the content.
   Hovering or focusing the name slides the reflected studio lights, so a highlight glides along the letters.

The hero is four short lines; the rest of the page text is taken verbatim from the v1 site
(`content/v1-content.json`). University marks in the hero are links; drop the official SVGs in
`public/logos/` (`ozu.svg`, `boun.svg`) and swap the `.org-mark` text for `<img>` (styled by `.org img`).

**Skip intro** is focusable from the first frame; any key, click, scroll or touch also skips. Skipping,
repeat visits (`localStorage`) and `prefers-reduced-motion` all jump to the settled state by loading
`src/assets/bake/nycd.bin.gz` — the height field from an offline run of the same deterministic
simulation. Re-bake after changing `src/physics/preset.ts` or the strokes: `npx tsx tools/sim/bake.ts`.
Clicking the name while at home replays the intro.

## Layout

| Path | What |
|---|---|
| `content/v1-content.json` | Everything the v1 Vue site said (EN/TR bio, projects, positions, blog posts), plus draft v2 projects. Photos in `content/media/`. |
| `lettering/<Font>.waypoints.json` | Hand-authored stroke plan: order, direction and rough waypoints per pen stroke. |
| `src/lettering/<Font>.strokes.{json,svg}` | Generated centerlines in millimetres (name = 400 mm wide). |
| `src/physics/kinematics.ts` | Arc-length resampling, curvature, two-thirds power law speed, pen lifts, timing, A = Q/U. |
| `src/physics/params.ts`, `rheology.ts` | Named physical constants (SI, units in comments); Herschel–Bulkley, Papanastasiou, Bingham thin-layer flux. |
| `src/physics/heightfield.ts` | Everything on the paper: deposition sweeps and viscoplastic relaxation of wet tiles. |
| `src/physics/thread.ts` | Airborne thread as an XPBD viscous rod: feed, sag, necking, snap. |
| `src/physics/simulation.ts` | Tier-1 orchestration at a fixed 240 Hz: extrusion, touchdown, coiling, pen lifts, tail peaks. |
| `src/physics/sim.worker.ts` | Runs the simulation off the main thread; the page renders a mirror fed with changed tiles only. |
| `src/scene/` | three.js WebGPURenderer + TSL: baked charcoal paper, paste surface, thread mesh, paint tube, studio lights, post. |
| `src/site/` | Home page orchestration (GSAP) and styles; content is plain HTML in `index.html`. |
| `src/physics/preset.ts`, `bake.ts` | The shipped parameter set; baked final state codec. |
| `src/lab/` | Debug pages (`?debug`-style tuning with lil-gui). |
| `tools/` | Python/Node tooling for lettering, screenshots and benchmarks (below). |

## The paste model (Tier 1)

Deterministic, fixed-step, CPU; rendering never feeds back into physics, so a run can be baked.

1. **Kinematics** — each stroke's speed follows the two-thirds power law; the plan gives nozzle
   position, speed U and the deposited cross-section A = Q/U with Q = Q₀(U/U₀)^φ.
2. **Extrusion and regime** — the thread leaves the nozzle at v_e = Q/(π r_e²), r_e including die swell.
   V* = U/v_e picks the sewing-machine regime: V* ≳ 1 gives a dragged catenary whose touchdown lags the
   nozzle by a fraction of its height; V* < 1 (first touch, stroke starts) buckles the thread into a coil.
3. **Deposition** — touchdown sweeps a rounded half-ellipse cross-section of area A along the path,
   max-composited within a pass (smooth on any curve) and added across passes (crossings, retraces, coils).
4. **Settling** — shallow-layer Bingham flux q = −ρgY²(3h−Y)/(6μ)∇h, Y = max(0, h − τ_y/(ρg|∇h|)),
   plus a short-lived surface-tension rounding term. Where Y = 0 the paste is locked: it stops by itself.
   Only recently wetted 4 mm tiles are updated; CFL substeps are capped (excess time is dropped, which
   locally slows the flow rather than destabilising it).
5. **Pen lifts** — the thread lays the rest of the stroke, then stretches as the tube rises; radius follows
   volume conservation, a neck forms, and it snaps below a radius or stretch threshold. The lower part falls
   back as a standing tail peak; the upper part retracts into the nozzle.
6. **Thread shape** — an XPBD chain pinned at nozzle and touchdown; rest length is viscous state (fed at
   the nozzle, taken up at the paper, relaxing toward the span), so it sags and swings like honey.

`npx tsx tools/sim/run.ts` runs the whole simulation headless and prints timing and volume balance.

Deviation from the brief, for now: the height field runs on the CPU (it is deterministic and bake-friendly,
and the wet region is small), in a Web Worker. Moving it to a GPU ping-pong pass remains an option.

## Performance

Budget per intro frame on the main thread: sync the worker's changed tiles into the paste texture, then one
render call. What keeps it there:

- **Simulation in a worker** (`?noworker` runs it inline). `relax()` tests the yield condition on |∇h|²
  (most wet paste is locked, so no square root) and skips tiles whose faces were all locked with nothing
  changed around them since. Both are exact: the settled field is bit-identical to the previous version.
- **Change tracking per 16×16 tile.** Only changed tiles are converted to float16; only their texture
  layers upload (one `DataArrayTexture`, `addLayerUpdate`); the paper's contact occlusion updates
  incrementally.
- **One paste material** for every chunk (per-object layer uniform), and `world.warmUp()` compiles every
  pipeline, shadow and post variant behind the black first frame, so nothing compiles mid-intro.
- **Post**: one quarter-resolution blur feeds both the tilt-shift and the highlight glow (2 small passes,
  instead of a 12-pass bloom plus a separate blur). Detail noise for the paste normals is baked once.
- **Final state**: static; zero WebGL work while scrolling (`node tools/check-idle.mjs <url>` asserts 0 renders).

### Startup (cold load)

- **Paper**: baked from a 256² tileable noise texture generated on the CPU (`src/scene/noise.ts`, the
  MaterialX Perlin gradient set and hash) instead of ~34 inlined `mx_noise_float` calls per texel. The
  old bake was one huge GPU job (a GPU watchdog can reset the device on it: black screen) with a slow
  cold shader compile. It renders in 4 strips, one submission each. Same look: channel mean/std match
  within 0.01 (`node tools/paper-stats.mjs <url> <out.png>` prints them and writes crops).
- **Shaders**: lit materials compile in parallel off the main thread against the post pass's target
  (`PassNode.compileAsync`), then one black warm-up frame builds the rest.
- **Never black**: if 3D isn't ready after 6 s the static page shows (name image + content), and the
  rendered name replaces it without the intro (`?slowboot=<ms>`, `0` disables). A lost GPU device
  (`renderer.onDeviceLost`, WebGL context loss) also falls back to the static page.
- **Chrome compatibility**: three r186 sets `swizzle: 'rgba'` on every texture view, which Chrome
  builds with the older form of that field reject (WebGPU rendering then fails); `stage.ts` drops it
  (identity, so a no-op).
- **Fast-forward**: the worker steps toward a target in ≈8 ms slices and replies after each, so a
  machine that can't sustain ×5 gets a slower fast-forward, not 200 ms jumps.

Diagnosis tools: `?profile` marks each boot stage (`boot:*`, GPU-synced) in the Performance panel;
`node tools/record.mjs <url> <dir> [--ff=3] [--webgpu]` records video + Chrome trace + timeline;
`python3 tools/trace-summary.py <dir>/trace.json` lists per-thread busy time and the longest tasks;
`node tools/cpu-profile.mjs <url>` prints the hottest JS during boot; `node tools/cold-load.mjs <url> <prefix>`
screenshots a cold first visit every 2 s.

Benchmarks (headless Chromium, SwiftShader: CPU numbers are meaningful, GPU numbers are not):
`npx tsx tools/sim/bench.ts` (simulation time + field checksum), `node tools/bench-main.mjs <url>`
(main-thread ms per intro frame), `node tools/bench-render.mjs <url>` (per-stage costs in capture mode).
Tier 2 (MPM near the nozzle) is not started; it only goes in if it clearly beats Tier 1.

## Re-tracing the strokes

Fonts can't be traced directly: TTFs store outlines, a tube needs one open centerline per stroke.

1. `node tools/render-specimens.mjs` renders the candidates with Chromium's shaper to `tools/out/specimen-*.png`.
2. `python tools/zoom.py Damion 1.0 /tmp/z "120:470,440:760"` draws the medial axis with a labelled pixel grid.
3. Edit `lettering/Damion.waypoints.json`. Each stroke is a list of `[x, y]` pixel waypoints in writing order;
   they snap to the skeleton and are routed along it, so retraces and loops follow the waypoints.
   `[x, y, "free"]` skips snapping (used for the crossbars and where the font's shape differs from how you'd write it).
4. `python tools/trace.py lettering/Damion.waypoints.json --debug` writes the strokes and `tools/out/trace-Damion.png`
   (colour per stroke, number = order, ticks = direction).

Python deps: `pip install -r tools/requirements.txt`.

## Fonts

The site is set in Instrument Serif (headings, lead) and Instrument Sans (text), both SIL OFL 1.1
(`src/assets/fonts/OFL-*.txt`), self-hosted as Latin and Latin Extended subsets split by `unicode-range`.

Lab specimens use subsets of Nothing You Could Do, Damion, Sacramento, Mr Dafoe (SIL OFL 1.1), Yellowtail and Homemade Apple
(Apache 2.0) from Google Fonts. The final site ships no script font: the name is the paint.

## Deploy (Cloudflare Pages)

Pages project `levent-website` (direct upload, not Git-connected; production branch `main`). Build locally, then upload:

```sh
npm ci && npm run build
WRANGLER_SEND_METRICS=false npx wrangler@latest pages deploy dist --project-name levent-website --branch dev   # preview
```

- Preview: `https://dev.levent-website.pages.dev` and `https://dev.leventaksakal.com` (CNAME to the `dev` branch alias).
  Both, and every `*.levent-website.pages.dev` deployment URL, sit behind the Cloudflare Access app
  "levent-website dev preview" (Google login, owner only).
- Production: `--branch main` deploys to `leventaksakal.com`. Roll back from the project's Deployments tab
  ("Rollback to this deployment" on the previous production build).
