# leventaksakal.com

Personal site of Levent Aksakal: industry work, research, projects, a shelf of films, games and
music, and occasional writing. Static pages built with Astro, served by Cloudflare Pages.

All commands run from `site/` (Node 22.23 or newer; `npm install` once).

This file was the repository's README until 19 Nov 2026. `README.md` is now the page that
github.com/LeventAksakal shows; see "Refresh the profile README" below.

## Day to day

### Write a post

A post is one Markdown file. There is no separate app and no admin: write, look, push.

1. Create `site/src/content/writing/<slug>.md`. The file name is the address
   (`my-first-post.md` becomes `/writing/my-first-post/`).

   ```md
   ---
   title: A worktree removal that emptied a data folder
   description: One or two sentences. Shown under the title, in the list and in the RSS feed.
   date: 2026-11-20
   draft: true
   ---

   Text in Markdown. `## Headings`, lists, links, quotes and fenced code blocks
   (name the language after the fence to get highlighting).
   ```

2. `npm run dev` and open `localhost:4321/writing/`. Drafts show here, marked as drafts, and
   nowhere else. The page reloads as you type.
3. Pictures go in `site/src/content/writing/img/`. Prepare each one first:
   `npm run strip -- --max 1600 src/content/writing/img/name.jpg` removes its metadata and shrinks
   it to 1600px wide (the build compresses a post's pictures but does not resize them). Then write
   `![What the picture shows](./img/name.jpg)`.
4. To publish, delete the `draft: true` line, commit and push to `main`. The post is live about
   a minute later: on the home page (the four newest), on `/writing/`, in `/rss.xml` and in
   the sitemap. A post can also be written in GitHub's web editor, from any machine.
5. When you change a published post later, add `updated: 2026-12-01` under `date`.

`draft: true` keeps a post off the site, but the file is still in the public repository once pushed.

### Change what the pages say

Every fact on the home page is in `site/src/data/site.ts`: the top bar, work, research, education,
projects, contact. Edit the text there; the pages and the page descriptions follow.
A logo is a file in `site/public/logos/` named by the entry's `card.src`.

### Add or change a photograph in the opening carousel

1. Put the picture in `site/src/assets/photos/` as a `.jpg`. The frame is 2.11:1 on a desktop and
   5:4 on a phone, so a wide panorama works best.
2. `npm run strip -- src/assets/photos/<name>.jpg`
3. Add a line to `photos` in `site/src/data/site.ts`: `id` (the file name), `place`, `when`, `alt`
   (what is in the picture, for people who cannot see it), `bg` and `accent` (the page takes its
   ground and accent colour from the photograph on screen) and `focus` (which part stays in view
   when a phone crops the sides, for example `62% 50%`).

### Add to the shelf

Add an entry to `site/src/data/shelf.json`, then `npm run covers` to fetch the cover art it names.

### Look at it, then put it live

```
npm run dev        # while editing: localhost:4321, reloads on save, shows drafts
npm run build      # the real build into site/dist, about 15 seconds
npm run preview    # serves site/dist on localhost:8788 with the production headers
git push           # on main: checked, then live (see Deploy)
```

A push to `main` is the only way to deploy. Anything you want to look at first stays on a branch
or uncommitted until you have looked.

### Refresh the profile README

`README.md` is generated: the photographs and the entries come from `site/src/data/site.ts`, the
numbers from `profile/stats.json`. Do not edit it by hand. From the repository root:

```
node profile/collect.mjs   # only when the numbers should move: scans the git repositories in C:/Code, about 5 minutes
node profile/render.mjs    # draws profile/*.svg and writes README.md, about 10 seconds
node profile/preview.mjs   # localhost:8790 shows the README as GitHub will, light or dark as the browser is set
```

Run `render` alone after changing an entry in `site.ts` or a photograph. Then commit and push;
nothing under `site/` changes, so nothing is deployed. `collect.mjs` writes counts only (per day,
per hour, per language, per tool) and names no project that the site does not already name; what
it counts is written at its top and under "How the numbers are counted" in the README.

## Commands

| Command | Does |
| --- | --- |
| `npm run dev` | Dev server on `localhost:4321`. Drafts are visible. |
| `npm run build` | Static build into `site/dist/`. |
| `npm run preview` | Serves the last build on `localhost:8788` under the Pages runtime, which applies `_headers` the way production does. |
| `npm run check` | Type check of the pages, components and data (about 30 seconds). |
| `npm run links` | Every internal link, image and `#anchor` in the last build leads somewhere. |
| `npm run budget` | Lighthouse against a running `npm run preview`: fails when the build misses the targets under "Speed and accessibility" (about 3 minutes). |
| `npm run covers` | Fetch missing shelf covers into `src/assets/covers/`. |
| `npm run strip -- <files>` | Remove EXIF, XMP and IPTC from images, in place. `--max 1600` also shrinks anything wider. `--check` only reports. |
| `npm run font` | Rebuild the cut-down Archivo files in `src/assets/fonts/`. Only after changing `scripts/font.mjs` or upgrading the font package. |

## Layout

| Path | What it is |
| --- | --- |
| `README.md` | The GitHub profile page. Generated, see "Refresh the profile README". |
| `profile/` | What draws it: `collect.mjs` (numbers), `render.mjs` (pictures and text), `preview.mjs`, and their output. |
| `site/` | The Astro project. Everything that ships is built from here. |
| `site/src/content/writing/` | Posts, one Markdown file each. |
| `site/src/data/site.ts` | Every fact on the pages, and the list of photographs. |
| `site/src/data/shelf.json` | The shelf. |
| `site/src/components/`, `site/src/pages/`, `site/src/styles/` | How it looks. Read `DESIGN.md` and `PRODUCT.md` before changing it. |
| `site/public/_headers` | Response headers: cache rules and the content security policy. |
| `.github/workflows/site.yml` | The checks and the deploy that a push starts. |
| `.githooks/pre-commit` | Refuses a commit that adds a picture with metadata. `npm install` turns it on. |
| `docs/LEDGERS.md` | Index of the ledgers: what was asked, what shipped, what is still open. |
| `tickets/` | Decisions that wait for an answer, one file each. |

## Deploy

A push to `main` that touches `site/` starts the workflow `site` on GitHub. It checks the change,
builds once, and uploads that same build to the Cloudflare Pages project `levent-website`, which
serves leventaksakal.com. If a check fails, nothing is uploaded and the live site stays as it was.

What is checked depends on what changed:

| The push changes | Checks | Live after about (target) |
| --- | --- | --- |
| Only files no job reads: everything outside `site/` (README, `SITE.md`, `profile/`, `docs/`, `tickets/`), and in `site/` its Markdown, `.gitignore`, `scripts/covers.mjs` and `scripts/font.mjs` | none, the workflow does not start | |
| Only content: posts and their pictures, `shelf.json`, covers, photographs, logos | build, image metadata, internal links, then deploy | 1 minute (3) |
| Other files that ship: pages, components, styles, `site.ts`, `public/`, headers, the build's settings, dependencies, and any file under `site/` not named in this table | the same, plus type check and Lighthouse budget, then deploy | 2.5 minutes (4) |
| Only a check's own script: `scripts/links.mjs`, `scripts/strip.mjs`, `scripts/budget.mjs` | the job that runs it, no deploy | |
| Only `.github/workflows/site.yml` | every check, no deploy | |

A job runs only when a file it reads changed, and the deploy only when the built site can differ.
After changing the deploy job itself, start the workflow by hand (`gh workflow run site`): started
by hand it runs everything and deploys.

Content skips the two slow checks because a post or a shelf entry cannot break the layout or the
scripts. Watch a run with `gh run watch` or under Actions on GitHub; the commit gets a green mark
and a "production" deployment when it is live. A pull request runs the same checks without deploying.

One-time setup: the workflow needs the repository
variable `CLOUDFLARE_ACCOUNT_ID` and the secret `CLOUDFLARE_API_TOKEN`, a Cloudflare token with the
single permission "Account, Cloudflare Pages, Edit" (dash.cloudflare.com, My Profile, API Tokens).
Set it with `gh secret set CLOUDFLARE_API_TOKEN`, which asks for the value.

If GitHub Actions is down and something must go live: `npm run build`, then
`npx wrangler pages deploy dist --project-name levent-website --branch main` from `site/`.

The `*.pages.dev` addresses are no use for looking at a build before it is live (a Cloudflare rule
redirects them to the live domain): use `npm run preview`.

`robots.txt`, the web manifest, the sitemap and the RSS feed are generated at build time from the
same data as the pages.

## Bots

The site is for people. Search engines and the link previews of chat and social apps are welcome,
so that a person can find the site by name and a pasted link shows its card. Crawlers that collect
pages for language models, scrapers and scripted clients are not: `robots.txt` tells them so, and
Cloudflare stops the ones that do not listen. The Cloudflare settings are not in this repository;
they are written down in `docs/decisions/0001-bot-guard.md`.

## Speed and accessibility

Measured with Lighthouse on its phone profile against `npm run preview`:

```
npm run budget
```

Targets: performance 90 or more, accessibility, best practices and SEO 100, no layout shift. The
budget fails a change to the code that misses them (performance is the median of three runs; on
GitHub it reads 99, on a desk with other work going 83 to 95). On the live domain best practices
reads 81: Cloudflare's bot detection adds a script of its own, which is the price of keeping bots
out. What keeps the rest there, so a later change does not undo it by accident:

- The first photograph is the largest thing on the first screen. It loads first
  (`fetchpriority="high"`); the other five wait and load at low priority.
- The coloured light behind the photograph is a 1 KB blurred picture made at build time
  (`site/src/lib/glow.ts`), not a CSS blur filter. The filter cost a phone about a third of a second.
- The typeface is cut down to the characters, weights and widths the site uses (`npm run font`):
  about 50 KB instead of 176 KB.
- Projects, Shelf and Contact are laid out only when they come near the screen
  (`content-visibility` in `site/src/pages/index.astro`). The heights written there are measured;
  after adding or removing several projects or shelf rows, measure again.
- Nothing sits on the photographs. The arrows flank the progress ticks underneath, every control
  has a name for screen readers, and the slideshow can be paused.

## Rules for content

- Every image in the repository is re-encoded without EXIF or XMP before it is added
  (`npm run strip`); the commit hook and the CI refuse one that is not. No phone number and no
  home address anywhere.
- English only. Facts only, from the CV or the owner's own words.
- Logos and cover art belong to their owners and are shown to name the thing they belong to.
