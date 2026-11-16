# Design record: leventaksakal.com (v4, "widescreen index")

Built 16 Nov 2026 in `site/` (Astro, static). Merges three rough variants (plates, widescreen,
index; since deleted) after the owner could not pick one. Mode: Experience for the opening frame,
Read for everything under it.

## The idea

A cinema screen showing the owner's own panoramas. The page is lit by the photograph on screen:
the ground and the accent colour are taken from it and cross-fade when the photograph changes.
Everything else is type, real logos and real cover art. Nothing is illustrated or invented.

## Rules

- One family: Archivo Variable (self-hosted, width axis). Display voice is width 108%, weight 620,
  sentence case, tight tracking, at most 3rem for section headings. The condensed heavy upper case
  of round 1 "felt off" to the owner (16 Nov 2026): do not bring it back. Body is width 100%,
  1.0625rem. No second text family. Fredoka appears only inside the BabyTell title card because it
  is that product's own wordmark face.
- No text on the photographs. Who this is sits in the top bar beside the name: role, city, and
  "MSc at" with the Boğaziçi seal.
- Colour: `--bg` and `--accent` come from `photos` in `src/data/site.ts` (one pair per photograph).
  Text is `#ece8de`; `--soft`, `--dim`, `--rule`, `--raise` are mixes of text and ground. The
  yellow `#f6dc6b` is fixed and used only for draft marks and the owner's quoted
  notes. Body text contrast stays above 4.5:1 on every ground.
- Photographs: shown sharp at 2.11:1, never as a blurred background behind content. The only blur
  is the ambient light around the frame, which is a 64px copy of the same photograph.
- Names of universities, companies and projects come with their real logo or wordmark on a 16:9
  title card with the brand's own ground. No logo exists: the card is set in type (BabyTell in its
  brand face; the research project by its name, me2exp; repositories as their GitHub path). A logo
  inside a card is positioned absolutely so its percentages are of the card: a tall mark sized by
  width alone outgrows a 16:9 card and gets cut (the MOQtail glass in round 1).
- Everything that has a public address is a link: employers, universities, projects, and every
  film (Wikipedia), game (Steam) and album (YouTube Music search) on the shelf.
- The hero is the only horizontal scroller. Its scrollbar is hidden; round, half-transparent
  arrows move one photograph. The arrows animate by the clock with a timer that lands the slide,
  not with the browser's smooth scrolling, which stalled in the owner's browser. The hero never
  takes the wheel.
- The shelf is three plain lists side by side (films, games, music), cover on the left, rows as
  tall as their content, columns of unequal length. The horizontal rows of round 1 were dropped at
  the owner's request. On a phone each list shows seven rows and a "Show all". Each list is headed
  by two lines that never wrap (title, then count and where the rows lead), so the three lists
  start on one line at every width.
- Nothing may shift a neighbour out of line. Columns that sit side by side share their rows
  (subgrid for the projects), and text that could wrap differently per column is kept to a fixed
  number of lines. The owner, 16 Nov 2026: "I dont want to see layout breaks and mishaps like that".
- The favicon is a letter L in two flat tones (cream stem, blue foot) on the dark ground. No
  gradient: the owner called the gradient version "AI slop".
- The portrait is shown whole, at its own ratio: the peak behind is the point of the picture.
- Motion: the hero tick that fills and turns the page (7s), the palette cross-fade (1.1s), small
  lifts on hover. All off under `prefers-reduced-motion`; the slideshow also stops for good on any
  manual control and pauses while the frame is off screen or hovered.
- Copy: facts only, from the CV or the owner's own words. No em dashes, no label lines above
  headings, no tag pills, no claims.

## Not allowed back

Glass cards over a blurred photo (2025 site), serif display with a sans body, eyebrow labels, card
grids with pills, a paint or scroll-video intro, live feeds, a second language.
