# Site ledger

Purpose of the site, in the owner's words (16 Nov 2026): "to have a webpresence so recruiters or
potential people can reach out to me and get to know me better".

Status values: open, in progress, shipped not measured, done.

| # | Owner's words (date) | Target | Status | How to check |
|---|---|---|---|---|
| 1 | "the overall page content is garbage" (16 Nov 2026) | Every sentence on the site is a fact from the CV source (`C:\Code\cv`) or text the owner wrote or approved. No invented filler, no self-promotion. | shipped, not reviewed: all copy is in `site/src/data/site.ts`, facts from the CV and the owner's answers | Owner reads each page before deploy |
| 2 | "the typography and the overall DESIGN of the page could be improved"; earlier versions "look generic or AI-made" (16 Nov 2026) | Owner picks one of three rendered landing-page variants built with real content and real photos; only then are other pages built. | shipped, not reviewed: owner could not choose (row 13), final build merges the three | Owner looks at the `site` preview |
| 3 | "the images I took are great. And they are really important as they give character" (16 Nov 2026) | The owner's photographs are shown sharp, at their natural ratio, with place captions. Never as a blurred background behind a card. | shipped, not reviewed: hero carousel at 2.11:1 on desktop, 5:4 crop on phones | Look at the landing page on a phone and on a desktop |
| 4 | "landing page should be neutral and point to academic work and industry work" (16 Nov 2026) | The first screen names both strands with equal weight; each is one click away. | shipped, not reviewed: Industry and Research side by side, both in the top bar | Landing page review |
| 5 | "movie music game suggestions (slick cards that use the artwork of the actual book music game etc) ... while being static and give a bit personality hints"; "no need for full game movie music integration" (16 Nov 2026) | A static shelf of films, music, games and books with their real cover art. No live feeds, no backend. | shipped, not reviewed: 21 films, 14 games, 13 albums chosen by me from his lists; books wait on his list | Shelf renders from a data file; the build makes no network call at runtime |
| 6 | "I also would like to start writing blogs occasionally on topics or problems or ideas I come up with" (16 Nov 2026) | Publishing a post is adding one Markdown file. RSS feed exists. A first post is live. | in progress: collection, pages and RSS work; one draft post waits for his two TODO paragraphs; nothing published | Add a file, build, the post and the feed entry appear |
| 7 | "recruiters or potential people can reach out to me" (16 Nov 2026) | Email, GitHub, LinkedIn and the CV PDF are one click from every page. No phone number on the site. | in progress: email, GitHub, LinkedIn on the home page and one click away elsewhere; no CV link until a CV without the phone number exists | Click through from each page |
| 8 | Language: "English only" (16 Nov 2026) | One language, no i18n layer. | decided | No translation files in the build |
| 9 | "can you check that I dont leak any crucial info with the photo metadata or anything to DoX or harm me" (16 Nov 2026) | No published image carries EXIF, XMP or GPS; no phone number or home address anywhere on the site or in the public repo. | in progress: all 181 built images checked, none carries EXIF or XMP; the live site and the public repo history still carry the original files (phone model, firmware, capture time; no GPS) | `python exif_audit.py` style check on every built image; the build fails on any EXIF block |
| 10 | "move to astro if it earns its use" (16 Nov 2026) | Astro is used only if it removes work (Markdown posts, RSS, image pipeline). | done: `site/` is Astro 7, static | The first post and the feed build with no hand-written glue |
| 11 | "built rough html variants show here before shipping the actual thing with polish" (16 Nov 2026) | Three rough landing variants shown; one is chosen before the real build. | done: `prototypes/landing/` (A Plates, B Widescreen, C Index), superseded by `site/` | n/a |
| 12 | "skip paint simulation" (16 Nov 2026) | No paint intro and no post about it. | decided | Not on the site |
| 13 | "I cannot choose a winner"; "build the final thing. suprise me. WOW me" (16 Nov 2026) | One finished site that merges the variants, shown to the owner before any deploy. | shipped, not reviewed: `site/` on branch `v4`, uncommitted | `site` preview (port 4321) |
| 14 | "rather than boğaziçi university as text, an inline tailored stamp or arma or logo of the uni is much better" (16 Nov 2026) | The hero statement ends in the Boğaziçi seal, not the name. | shipped, not reviewed | First screen |
| 15 | "you did awesome with the music movies using their cover art. apply the same for everything universities companies projects I did etc whenever available"; "use the real typography and logos for the deployed projects" (16 Nov 2026) | Every employer, university and project shows its real logo or wordmark; type only where none exists. | shipped, not reviewed: 8 real logos; BabyTell in its own face (Fredoka); the research project and two repositories are set in type | Work section |
| 16 | "images on a carousel is better"; "hide vertical and horizontal scroll bars"; "use custom made half transparent chevrons or glow effect to indicate" (16 Nov 2026) | Photographs are a carousel with no scrollbar and round half-transparent arrows. | shipped, not reviewed; the shelf rows were dropped in round 2 (row 27) | Hero and shelf on desktop and phone |
| 17 | "scroll wheel on mouse over a horizontal scroll should scroll horizontally not the page" (16 Nov 2026) | A wheel over a shelf row moves the row; at its end the wheel returns to the page; the hero never takes the wheel. | superseded by row 27: the shelf is no longer horizontal; the hero never takes the wheel | n/a |
| 18 | "alignment is off with long text its broken" (16 Nov 2026) | Covers in a row share one size and top edge whatever the caption length. | shipped, not reviewed: in the list (row 27) every cover has one size and titles wrap beside it | Films list: "Eternal Sunshine of the Spotless Mind" |
| 19 | "for MOQtail I'm no longer a maintainer I just contributed and designed authored at that time ACK that or phrase it properly" (16 Nov 2026) | MOQtail reads as a past contribution. | shipped, not reviewed: "Contributor · Open source · 2025 ... I am no longer a maintainer." | Research section |
| 20 | "temizellogo.png is old and dead, text "Temizel" is the logo. you can also link my linkedin and github accounts; (use their svg icons too)" (16 Nov 2026) | The Temizel card shows the yellow wordmark; GitHub and LinkedIn are linked with their icons. | shipped, not reviewed | Work and Contact sections |
| 21 | "the bold titles like my name or INDUSTRY, RESAERCh felt off to me"; "the text body reads fine" (16 Nov 2026, round 2) | Headings and the name are no longer condensed heavy upper case; body text unchanged. | shipped, not reviewed: Archivo at width 108%, weight 620, sentence case | Top bar and section headings |
| 22 | "the favcion is gargabe just use a Text "L" with nice colorplay" (16 Nov 2026) | Favicon is a letter L with a colour gradient. | superseded by row 33 (the gradient was rejected): `site/public/favicon.svg`, `.ico`, `apple-touch-icon.png` | Browser tab |
| 23 | "text in carousel is stupid. have that SWE in Istanbul, MSc at Boun next to my name at the top nav bar in a slick way" (16 Nov 2026) | No text on the photographs; role and school sit beside the name in the top bar. | shipped, not reviewed: "Software engineer in Istanbul / MSc at [seal] Boğaziçi" | Top bar on desktop and phone |
| 24 | "my photo cropped is stupid it should be the original raito with the mountain behind thats the whole point" (16 Nov 2026) | The portrait is shown whole. | shipped, not reviewed | Contact section |
| 25 | "horizantal scroll chevrons doesnt work on click. they should move to end on click" (16 Nov 2026) | A click on an arrow always moves the carousel. | shipped, measured: six clicks move six photographs in a headless run and in the app's browser pane; cause was reliance on the browser's smooth scrolling. "Move to end" applied to the shelf rows, which are gone (row 27) | Click the hero arrows |
| 26 | "you have clipped the moqtail logo poorly me2exp placeholder text is garbage and construtor group icon is off" (16 Nov 2026) | MOQtail glass shown whole; no proverb placeholder; the Constructor mark is the right one. | shipped, not reviewed: glass cropped to its own bounds and sized inside the card; me2exp card is the project name; Constructor card is the blue C, chevron, red O mark from his own Constructor repo | Work section |
| 27 | "for the shelf lets scratch horizantal list but make it a 3 column list (uneven rows that looks neat as well)" (16 Nov 2026) | Shelf is three lists side by side. | shipped, not reviewed: `ShelfList.astro`; phone shows 7 rows per list and "Show all" | Shelf section |
| 28 | "For temizelisg and APS I'm the sole engineering designer product manager etc. ... what do you call taht product owner & developer?" (16 Nov 2026) | Both entries name the full role. | shipped, not reviewed: "Product owner and sole engineer" plus one sentence on what that covers; alternatives offered in chat (founding engineer, product engineer) | Industry section |
| 29 | "the showcased projects could be increased. like clerance is an original and neat idea" (16 Nov 2026) | More projects, Clearance among them. | shipped, not reviewed: six projects (Clearance, Talk Tracks, WebTransport stall, Notification system, Quinn congestion control, Time Analytics); Veil and other private repos left out | Projects section |
| 30 | "maybe add redirects to companies, movies games etc" (16 Nov 2026) | Everything with a public address links to it. | shipped, measured: 48 of 48 shelf rows link (Wikipedia, Steam, YouTube Music search), 12 title cards link; APS and BabyTell have no public address | Click through |
| 31 | "Away from the keyboard: playing the guitar, climbing, mountaineering and cooking." (16 Nov 2026) | That exact sentence. | done | Contact section |
| 32 | "on shelf film and series desc. text spans 2 lines so layout shifts bcuz of that. I dont want to see layout breaks and mishaps like that" (16 Nov 2026, round 3) | The three shelf lists start on one line at every width; nothing shifts a neighbour out of line. | done, measured on the built site at 1920, 1440, 1180, 1000, 861 and 390px: the three headers are 60.6px tall, the lists start at the same height, no text is cut, no horizontal overflow. Project rows now share their rows (subgrid): 0 misaligned rows | Shelf and Projects sections at any width |
| 33 | "favicon radient and color is straight up AI slop dont fall into that hole" (16 Nov 2026) | A flat favicon, no gradient. | shipped, not reviewed: letter L, cream stem and blue foot on the dark ground (`site/public/favicon.svg`, `.ico`, touch icon, 192 and 512px icons) | Browser tab |
| 34 | "Çay, June 2024 is Köprülü Kanyon, Denizli June 2024 is Pamukkale antik kenti" (16 Nov 2026) | Captions name the right places. | done: "Köprülü Kanyon, June 2024" and "Pamukkale ancient city, June 2024", alt texts too | Hero captions, photographs 3 and 6 |
| 35 | "use white BG for temizel its what the official site uses" (16 Nov 2026) | Temizel card on white. | done | Industry section |
| 36 | "makesure to idiomatically setup robots.txt llms.txt and other stuff" (16 Nov 2026) | Crawler and host files exist, are correct and cannot drift from the pages. | done, measured on leventaksakal.com: `robots.txt`, `llms.txt`, `site.webmanifest`, `sitemap-index.xml`, `rss.xml` return 200 with the right content type and are generated from `site/src/data/site.ts`; `_headers` sets a content security policy, frame and referrer rules, and a one-year immutable cache for `/_astro/`; unknown paths return 404 | `curl -I https://leventaksakal.com/robots.txt` and the others |
| 37 | "Then ship it" (16 Nov 2026) | The new site is what leventaksakal.com serves. | done, measured 16 Nov 2026: production deploy of `main`; in a headless browser 72 of 72 images load, no console error, no failed request. Lighthouse on a phone profile: accessibility 100, SEO 100, layout shift 0 | Open leventaksakal.com |
| 38 | "prune every other branch; stale reworks experiments etc" (16 Nov 2026) | Only `main` remains; no stale code in the tree. | done except `admin/`: local and remote branches `v3`, `v4`, `redesign`, `pinboard-prototype`, `claude/wizardly-archimedes-3xochp` and one stash deleted; the paint-intro app, `website/`, `docs/v3/`, `prototypes/`, old `node_modules` and `.wrangler` removed. All of it is kept in one file, `.git/pre-v4-2026-11-16.bundle`. The untracked folder `admin/` (build output and a `.dev.vars`) is still on disk: deleting it was blocked by the permission check | `git branch -a`; `git bundle list-heads .git/pre-v4-2026-11-16.bundle` |
| 39 | "babytell I'm a partner its not my own product. idea belongs to a friend of mine and you can find the actual logo from the kotlin build assets" (16 Nov 2026) | BabyTell says partner and shows its real logo. | done: meta "Partner", text "A friend's idea that I joined as a partner", card is the crescent mark and wordmark converted from the Android app's vector drawables | Industry section |
| 40 | "Also SWE in Istanbul read more slick no? since flipside is MSc?" (16 Nov 2026) | Top bar reads "SWE in Istanbul / MSc at Boğaziçi". | done; page title, description and the screen-reader heading still spell out "Software engineer" | Top bar |
| 41 | Mine, not the owner's (16 Nov 2026): the first deploy scored 69 for performance on Lighthouse's phone profile | Phone profile: performance 90 or more, largest contentful paint 2.5 s or less. | open. Measured twice on a loaded machine (benchmark index 856, so the numbers are pessimistic): 69 then 70; LCP 4.1 s then 3.9 s; page weight 1002 KiB then 667 KiB after inlining the stylesheets, loading only neighbouring photographs and shrinking three logos. What is left is main-thread time: about 0.5 s is Cloudflare's own bot-detection script (`/cdn-cgi/challenge-platform/.../jsd/main.js`, a zone setting, also the cause of best practices 79), about 0.8 s is one unattributed task around first paint (suspect: the 70px blur of the light behind the hero) | Run Lighthouse or PageSpeed Insights on leventaksakal.com, phone profile |

## Content decisions (16 Nov 2026, owner's words paraphrased closely)

- Research: the Turkish meaning-to-expression search is ongoing research he aims to publish. MOQtail
  is a real contribution and counts under research. Thesis direction is LLM backdoors, sleeper agents
  and mechanistic interpretability; not started, list as interests. Harness engineering is not the
  thesis direction ("a crowded area"; his sub-projects there "wouldn't make a dissertation").
- QUIC congestion control was a project, not research.
- APS is an internal app: "best not shared". Describe it, show no screens.
- BabyTell: "a real app under development", shown as in progress though it is not in the CV.
- Shelf sources: `content/shelf/games.txt` (120 titles from the Steam and PlayStation dumps),
  `content/shelf/musics.txt` (146 tracks from the YouTube Music export), his `Movies.txt` on the
  Desktop (not copied into the repo yet). He lets me pick a sample that reflects his taste. Books: he
  will list from memory.

## Where work stopped (16 Nov 2026, shipped)

The site is live at leventaksakal.com from branch `main` (the only branch). Source is `site/` (Astro 7,
static); the repo root holds the README, `DESIGN.md`, `PRODUCT.md` and these ledgers.

- Run it: `.claude/launch.json` config `site` (port 4321), or `npm --prefix site run dev`. Drafts show
  in dev only. Build: about 15 s, 3 pages, 25 MB of `dist`, 254 files.
- Deploy: `npm run deploy` in `site/` (build, then direct upload to the Pages project `levent-website`,
  branch `main`). Pushing to GitHub deploys nothing. Upload takes about 25 s.
- A build cannot be previewed on `*.pages.dev`: a Cloudflare rule redirects those addresses to the live
  domain, and `dev.leventaksakal.com` sits behind Cloudflare Access. Preview locally with
  `npx wrangler pages dev dist`, which applies `_headers`.
- `www.leventaksakal.com` does not resolve (no DNS record). Not asked for; noted.
- Not checked: Safari and Firefox, a real phone.
- Cover art: `npm --prefix site run covers` (Wikipedia page images for films, Steam for games, Apple's
  search API for albums). Film posters are only 220 to 280px wide because Apple's film search now
  returns nothing; a sharper source needs a decision (TMDB needs an API key). Arcane has no poster on
  Wikipedia and was left out of the films.
- `content/shelf/games.txt` and `musics.txt` (the full lists the shelf was picked from, with dates) are
  kept on disk and ignored by git, so they are not in the public repository.
- Old work: everything deleted on 16 Nov 2026 (row 38) is in `.git/pre-v4-2026-11-16.bundle` (56 MB,
  local only). Restore a branch with `git fetch .git/pre-v4-2026-11-16.bundle v3:v3`. The admin's
  `.dev.vars` is copied to `.git/pre-v4-admin.dev.vars`.

## Waiting on the owner

- Delete the leftover folder `admin/` (row 38), or say to keep it.
- Whether to turn off Cloudflare's JavaScript detections for the zone (row 41): his security setting,
  not changed by me.
- The two TODO paragraphs in the draft post (`site/src/content/writing/`, `draft: true`, so it is not
  on the site, but the file is in the public repository), or a different first post.
- A CV without the phone number, if the site should link one.
- Whether to scrub the 2025 photographs from the public repository's history. They carry EXIF (camera
  model and date; no GPS in any of them). It needs a history rewrite and a force push, which his rules
  forbid without his say. The new site's images carry no metadata.
- The book list, and ratings for games (the dumps carry no playtime or rating).
- The folder with more original photographs (the repo has six plus a portrait).
- The role wording "Product owner and sole engineer" for APS and Temizel İSG (row 28): kept, not
  objected to in round 3.
