# Handoff: v3 scroll journey

Paste everything below the line into a new Claude Code session on `LeventAksakal/leventaksakal`.

---

You are continuing work on Levent Aksakal's personal site, **v3**: a scroll-driven video journey replacing
v2's live WebGPU intro. Work on branch `v3` (commit and push there; no PR unless asked). Read, in order:
`docs/v3/brief.md` (why), `docs/v3/scroll-journey.md` (the director's treatment: locked content, style
bible, world map, shot list S0–S7 with frames, cut list, scroll anchors), `docs/v3/recipe.md` (how:
reference pack, Blender graybox, key frames, generation, QA gates, assembly, order of work).

State:
- v2 is frozen on `claude/wizardly-archimedes-3xochp` and deployed only to the protected dev preview
  (Cloudflare Pages `levent-website`, branch `dev`; see `README.md`). Production `leventaksakal.com`
  stays on v1 until Levent says go. `v3` branched from v2, so the v2 renderer is still in the repo: it
  renders the name shots and the reference stills offline (`tools/capture.mjs`, `?capture`).
- v3 content: hero = "Computer guy." / [Özyeğin logo] graduate. / Currently MSc @ [Boğaziçi logo], /
  working on harness engineering. / ♥ building software. Work = APS (Özyeğin University Academic
  Planning System), BabyTell, Temizelisg, MOQtail (production projects). Previous Positions stays
  (Constructor Technology, TÜBİTAK SAGE; logos in `public/logos/`). The About section is cut.
- Waiting on Levent (recipe §1): per project a ≤ 20-word one-liner, role and dates, stack (≤ 6), links,
  optional screenshots and permission to show APS publicly, the project order, and the spelling of
  "Temizelisg".

Next (recipe §9, step 2 onwards):
1. With Levent's inputs, design the BabyTell and Temizelisg station shapes (buildable from one paint
   line; no symbols or letters), update the shot list and the shot-sheet prompts, lock the treatment.
2. Render the reference pack R1–R5 from the v2 renderer (headless Chromium + SwiftShader works for
   offline capture; slow but deterministic).
3. Write `tools/v3/graybox.py` (bpy) that builds the world, lights and cameras of the treatment and
   exports the per-shot graybox outputs (recipe §3). Check whether Blender/bpy can be installed here.
4. Write `tools/v3/qa.py` for the gates in recipe §7.

Levent runs the image and video generation (Higgsfield or similar) with the shot sheets; you prepare
inputs, check outputs with the QA script, log takes, and assemble.
