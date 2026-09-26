# leventaksakal.dev — v2

Personal site whose intro is the name **Levent Aksakal** written in yellow paint paste from a tube.
The build follows milestones: strokes → physics → look → transition/content → hardening.

**Status: milestone 1 (stroke prototype).** `npm run dev`, then open `/lab/strokes/`.

## Layout

| Path | What |
|---|---|
| `content/v1-content.json` | Everything the v1 Vue site said (EN/TR bio, projects, positions, blog posts), plus draft v2 projects. Photos in `content/media/`. |
| `lettering/<Font>.waypoints.json` | Hand-authored stroke plan: order, direction and rough waypoints per pen stroke. |
| `src/lettering/<Font>.strokes.{json,svg}` | Generated centerlines in millimetres (name = 400 mm wide). |
| `src/physics/kinematics.ts` | Arc-length resampling, curvature, two-thirds power law speed, pen lifts, timing, A = Q/U. |
| `src/lab/` | Debug pages (`?debug`-style tuning with lil-gui). |
| `tools/` | Python/Node tooling for lettering and screenshots. |

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

Lab specimens use subsets of Damion, Sacramento, Mr Dafoe (SIL OFL 1.1), Yellowtail and Homemade Apple
(Apache 2.0) from Google Fonts. The final site ships no script font: the name is the paint.
