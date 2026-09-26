# Handoff: cold-start intro + official institution logos (leventaksakal.com v2)

Paste everything below the line into a new Claude Code session on `LeventAksakal/leventaksakal`.

---

You are continuing work on Levent Aksakal's personal site (repo `LeventAksakal/leventaksakal`, branch
`claude/wizardly-archimedes-3xochp`; commit and push there, no PR unless I ask). Read `README.md` first: it
documents the architecture, the performance work, and the diagnosis tools. Two things are open, in this order.

## Where things stand

- Vite 8 + TS 7, three.js r186 `three/webgpu` (WebGL2 fallback), GSAP. `npm ci && npm run build` → `dist/`.
- The paint simulation runs in a Web Worker (`src/physics/sim.worker.ts`); the page renders a mirror.
- Deployed only as a **protected dev preview**: Cloudflare Pages project `levent-website` (direct upload, not
  Git-connected), `npx wrangler@latest pages deploy dist --project-name levent-website --branch dev` →
  https://dev.leventaksakal.com and https://dev.levent-website.pages.dev, behind the Access app
  "levent-website dev preview" (Google login, `leventaksakal56@gmail.com`). Production (`leventaksakal.com`)
  still serves v1 (deployment `ba87ffd5`). Do not deploy to production (`--branch main`) until I say go.
  `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` are in the environment; never print them; set
  `WRANGLER_SEND_METRICS=false`.

## 1. Cold start still does not play the intro ("it just loads the page")

On a first visit (no `localStorage` key `site.intro-seen.v1`, e.g. a private window) I expect: dark paper fades
up, the tube writes the name in real time, the name glides to the top, the content fades in. Instead the page
content appears without the animation.

Suspects, check in this order:

1. **The slow-boot fallback in `src/site/main.ts`** (`slowBootMs`, default 6000 ms). If 3D boot takes longer
   than 6 s it shows the static page and, once 3D is ready, jumps to the final state *without the intro*. That is
   exactly "it loads the page". Decide with me, but my preference: never skip the intro because boot was slow.
   Show a calm loading state (e.g. the paper fading up as soon as the paper pipeline is ready, or a minimal
   indicator) and start the intro when ready; keep the static page only for real failures (no WebGL/WebGPU,
   device or context lost, boot error).
2. **GPU device / context loss** → the `renderer.onDeviceLost` handler in `main.ts` also shows the static page
   (console warning "GPU device lost, showing the static page"). If that fires on real hardware, find why.
3. Anything else that ends in `goFinal()` early (`seen`, `?final`, `prefers-reduced-motion`, the skip link).

How to diagnose: this container has no real GPU. Headless Chromium uses SwiftShader, so frames take ~1 s, and
it cannot present a WebGPU canvas at all (Chromium logs `Could not find SharedImageBackingFactory …
WebgpuSwapChainTex`, then "device lost"). So:

- Add temporary, clearly labelled console logging of the boot stages and of *why* the page went final (which
  branch: slow boot, device lost, seen, reduced motion), deploy to the dev preview, and ask me to open it in a
  private window and paste the console output. `?profile` already adds GPU-synced `boot:*` performance marks
  (visible in DevTools → Performance); ask me for a Performance recording if needed.
- Locally use `?webgl&slowboot=0` for headless tests. Tools: `node tools/record.mjs <url> <dir> --ff=3`
  (video + Chrome trace + timeline), `python3 tools/trace-summary.py <dir>/trace.json`,
  `node tools/cold-load.mjs <url> <prefix> webgl`, `node tools/cpu-profile.mjs <url>`,
  `node tools/test-intro.mjs <url>`, `node tools/check-idle.mjs <url>`; Lighthouse via
  `CHROME_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome npx lighthouse …`.
- Done means: on a cold first visit the intro plays from the first frame to the final page, with no black
  screen and no jump; fast-forward (click) and skip (second click, Escape) still work; repeat visits go straight
  to the final page; the fallback still covers real failures. Verify what you can headless and have me confirm
  on real hardware.

## 2. Official logos for every institution

Always show institutions by their **official logo / emblem / favicon artwork in original colours**, never by a
made-up text badge. The current hero uses placeholder text chips (`.org-mark` "ÖzÜ", "BOUN" in `index.html`);
I rejected that look. Replace them, and add marks to the Previous Positions entries.

| Institution | Where on the page | Link | Sources to try |
|---|---|---|---|
| Özyeğin University | hero line "[logo] graduate." (logo replaces the name) | https://www.ozyegin.edu.tr/en | https://upload.wikimedia.org/wikipedia/commons/e/e7/%C3%96zye%C4%9Fin_University_logo.svg (Commons file page: https://commons.wikimedia.org/wiki/File:%C3%96zye%C4%9Fin_University_logo.svg), ozyegin.edu.tr favicon / brand assets |
| Boğaziçi University | hero line "MSc @ [logo], working on harness engineering." | https://bogazici.edu.tr/en | https://upload.wikimedia.org/wikipedia/en/7/76/Bo%C4%9Fazi%C3%A7i_University_logo.svg (file page https://en.wikipedia.org/wiki/File:Bo%C4%9Fazi%C3%A7i_University_logo.svg), official page https://bogazici.edu.tr/en/pages/bogazici-university-corporate-logos/776 |
| Constructor Technology | Previous Positions entry | https://constructor.tech/ | favicon from v1: https://constructor.tech/sites/default/files/favicon_1.ico; site logo / brand assets on constructor.tech |
| TÜBİTAK SAGE | Previous Positions entry | https://www.sage.tubitak.gov.tr/ | favicon from v1: https://www.sage.tubitak.gov.tr/favicon.ico; site logo on sage.tubitak.gov.tr / tubitak.gov.tr |

Rules:
- Download once and **self-host** under `public/logos/` (no hotlinking). Prefer SVG; otherwise the largest
  PNG/ICO frame, converted to a crisp PNG or WebP at 2× display size. Keep original colours. If a mark has a
  dark-on-transparent colourway that disappears on the charcoal background, use the institution's official
  light/reversed variant, or put it on a small white rounded tile as the institutions do themselves. Don't
  recolour or redraw it.
- Record each file's source URL, date and licence/trademark note in `public/logos/SOURCES.md`.
- The hero: the logo sits inline in the serif line like a word (about cap height to 1.3 em), links to the
  institution, `alt`/`aria-label` with the full name. Keep the hero's four lines and the red heart. Previous
  Positions: a small mark next to each company title. Check that the layout holds at 390 px wide.
- Keep page weight low (a few KB each, ideally), and run the checks from part 1 afterwards.

If a download is blocked, name the exact host so I can allow it. Hosts I'm allowing for this:
`upload.wikimedia.org`, `commons.wikimedia.org`, `en.wikipedia.org`, `www.ozyegin.edu.tr`, `ozyegin.edu.tr`,
`bogazici.edu.tr`, `www.boun.edu.tr`, `boun.edu.tr`, `constructor.tech`, `www.sage.tubitak.gov.tr`,
`sage.tubitak.gov.tr`, `tubitak.gov.tr`, `www.tubitak.gov.tr`.

## Finish

Commit on the branch, deploy the dev preview, and report plainly what you verified (and how), what only I can
verify on real hardware, and the preview URL. Production stays on v1 until I say go.
