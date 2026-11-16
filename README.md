# leventaksakal.com

Personal site of Levent Aksakal: industry work, research, projects, a shelf of films, games and
music, and occasional writing. Static pages built with Astro, served by Cloudflare Pages.

All commands run from `site/` (Node 22.23 or newer; `npm install` once).

## Day to day

### Write a post

A post is one Markdown file. There is no separate app and no admin: write, look, deploy.

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
4. To publish, delete the `draft: true` line and run `npm run deploy`. The post appears on the home
   page (the four newest), on `/writing/`, in `/rss.xml` and in the sitemap.
5. When you change a published post later, add `updated: 2026-12-01` under `date`.

`draft: true` keeps a post off the site, but the file is still in the public repository once pushed.

### Change what the pages say

Every fact on the home page is in `site/src/data/site.ts`: the top bar, work, research, education,
projects, contact. Edit the text there; the pages, `llms.txt` and the page descriptions follow.
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
npm run deploy     # build, then upload to leventaksakal.com (about 40 seconds)
```

Pushing to GitHub does not deploy anything; `npm run deploy` does, and needs a one-time
`npx wrangler login`. Commit and push as usual so the repository matches what is live.

## Commands

| Command | Does |
| --- | --- |
| `npm run dev` | Dev server on `localhost:4321`. Drafts are visible. |
| `npm run build` | Static build into `site/dist/`. |
| `npm run preview` | Serves the last build on `localhost:8788` under the Pages runtime, which applies `_headers` the way production does. |
| `npm run deploy` | Build, then upload `dist/` to production. |
| `npm run covers` | Fetch missing shelf covers into `src/assets/covers/`. |
| `npm run strip -- <files>` | Remove EXIF, XMP and IPTC from images, in place. `--max 1600` also shrinks anything wider. |
| `npm run font` | Rebuild the cut-down Archivo files in `src/assets/fonts/`. Only after changing `scripts/font.mjs` or upgrading the font package. |

## Layout

| Path | What it is |
| --- | --- |
| `site/` | The Astro project. Everything that ships is built from here. |
| `site/src/content/writing/` | Posts, one Markdown file each. |
| `site/src/data/site.ts` | Every fact on the pages, and the list of photographs. |
| `site/src/data/shelf.json` | The shelf. |
| `site/src/components/`, `site/src/pages/`, `site/src/styles/` | How it looks. Read `DESIGN.md` and `PRODUCT.md` before changing it. |
| `site/public/_headers` | Response headers: cache rules and the content security policy. |
| `docs/LEDGERS.md` | Index of the ledgers: what was asked, what shipped, what is still open. |
| `tickets/` | Decisions that wait for an answer, one file each. |

## Deploy

Cloudflare Pages project `levent-website`, direct upload, production branch `main`, which serves
leventaksakal.com. There is no Git integration. The `*.pages.dev` addresses are no use for looking at
a build before it is live (a Cloudflare rule redirects them to the live domain): use
`npm run preview`.

`robots.txt`, `llms.txt`, the web manifest, the sitemap and the RSS feed are generated at build time
from the same data as the pages.

## Speed and accessibility

Measured with Lighthouse on its phone profile against `npm run preview`:

```
npx lighthouse http://127.0.0.1:8788/ --view
```

Targets: performance 90 or more, accessibility, best practices and SEO 100, no layout shift. What
keeps it there, so a later change does not undo it by accident:

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
  (`npm run strip`). No phone number and no home address anywhere.
- English only. Facts only, from the CV or the owner's own words.
- Logos and cover art belong to their owners and are shown to name the thing they belong to.
