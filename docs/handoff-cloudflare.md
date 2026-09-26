# Handoff: deploy the v2 site to Cloudflare (leventaksakal.com)

Paste everything below the line into a new Claude Code session on `LeventAksakal/leventaksakal`.

---

You are continuing work on Levent Aksakal's personal site (repo `LeventAksakal/leventaksakal`, work on branch
`claude/wizardly-archimedes-3xochp`). The v2 site is built and previewed; your job now is Cloudflare: take stock of
what's on the account and the `leventaksakal.com` zone, deploy v2 as a protected dev preview, and only then, with my
explicit OK, point production at it.

## The project (read `README.md` first)

- Vite 8 + TypeScript 7, three.js WebGPU (WebGL2 fallback), GSAP. `npm ci && npm run build` → static site in `dist/`
  (no server). Node 22 (`.node-version`).
- Pages: `/` (the site), `/lab/paste/`, `/lab/strokes/` (dev labs; fine to ship, not linked).
- `src/assets/bake/nycd.bin.gz` is the baked final paint state; regenerate with `npx tsx tools/sim/bake.ts` only if
  physics or strokes change.
- Headless checks: `node tools/shoot-design.mjs <url> <out> 1440x900 0` and `node tools/test-intro.mjs <url>` (Playwright with the
  preinstalled Chromium).

## Credentials

- `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are in the environment. Never print, echo or commit them.
- Set `WRANGLER_SEND_METRICS=false`. Use `npx wrangler@latest` (no global install).
- Verify first: `curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" https://api.cloudflare.com/client/v4/user/tokens/verify`.
  If a call fails with a permission error, tell me the exact permission missing; don't work around it.

## Steps

1. **Inventory, read-only.** List and report back before changing anything:
   Pages projects (git source, production branch, build settings, custom domains, recent deployments),
   Workers scripts and Worker routes/custom domains on `leventaksakal.com`, the zone's DNS records,
   and Zero Trust Access applications and policies. The v1 site was a Pages project built from this repo's
   `website/` workspace; v2 has replaced that layout, so the old build settings will fail.
2. **Dev preview.** Deploy the current branch as a preview that does not touch production:
   - If the existing Pages project is Git-connected, update its build settings to build command `npm run build`,
     output directory `dist`, root `/`, env `NODE_VERSION=22`, and let the branch build as a preview; otherwise
     `npm run build && npx wrangler pages deploy dist --project-name <project> --branch dev`.
   - Give it a stable hostname: the branch alias (`dev.<project>.pages.dev`) and, if I agree, `dev.leventaksakal.com`
     as a custom domain.
3. **Protect the preview with Cloudflare Access.** Self-hosted Access application on the preview hostname(s)
   (`dev.leventaksakal.com` and `*.<project>.pages.dev` previews, not the production domain), policy "Allow" for
   the emails I give you (ask me), one-time PIN login unless an identity provider already exists. If Zero Trust
   isn't set up on the account yet, stop and tell me: I'll enable it in the dashboard.
4. **Verify** with Playwright against the preview (through Access if needed, or check the Access redirect):
   the intro runs, `?final` shows the page, fonts load, favicon present, no console errors.
5. **Production** (only after I say go): attach `leventaksakal.com` (and `www` redirect) to the v2 project, keep
   the previous deployment one click away for rollback, and confirm DNS/SSL are healthy.

Report each step's outcome plainly, with URLs. Keep commits on the branch above; don't open a PR unless I ask.
