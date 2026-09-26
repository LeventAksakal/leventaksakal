# leventaksakal.dev — v2

Personal site whose intro is the name **Levent Aksakal** written in yellow paint paste from a tube.
The build follows milestones: strokes → physics → look → transition/content → hardening.

**Status: first full preview of the site.** `npm run dev`, then open `/` (the site), `/lab/paste/`
(physics + look, every parameter in the panel) or `/lab/strokes/` (lettering and timing).

URL switches: `?quality=high|medium|low`, `?final` (skip straight to the settled page),
`?webgl` (force the WebGL2 backend), `?font=damion` (labs only).

### How the home page runs

1. The charcoal paper fades up from black while the tube comes in from the upper right.
2. The tube writes the name (Tier-1 simulation in real time, ~12.5 s), leaves, the paste settles.
3. Camera and name glide so the name lands top-centre at nav size; the paper dims; the content fades in.
4. From then on the scene renders only on demand (resize, hover). Hovering or focusing the name slides
   the reflected studio lights, so a highlight glides along the letters.

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
| `src/scene/` | three.js WebGPURenderer + TSL: baked charcoal paper, paste surface, thread mesh, paint tube, studio lights, post. |
| `src/site/` | Home page orchestration (GSAP) and styles; content is plain HTML in `index.html`. |
| `src/physics/preset.ts`, `bake.ts` | The shipped parameter set; baked final state codec. |
| `src/lab/` | Debug pages (`?debug`-style tuning with lil-gui). |
| `tools/` | Python/Node tooling for lettering and screenshots. |

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
and the wet region is small). Moving it to a GPU ping-pong pass is a performance option for milestone 5.
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
