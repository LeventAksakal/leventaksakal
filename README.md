# leventaksakal.com

Personal site of Levent Aksakal: industry work, research, projects, a shelf of films, games and
music, and occasional writing. Static, built with Astro, served by Cloudflare Pages.

## Layout

| Path | What it is |
| --- | --- |
| `site/` | The Astro project. Everything that ships is built from here. |
| `site/src/data/site.ts` | Every fact on the pages: work, research, education, projects, photographs. |
| `site/src/data/shelf.json` | The shelf. `npm run covers` fetches the cover art it names. |
| `site/src/content/writing/` | Posts, one Markdown file each. `draft: true` keeps a post out of the build. |
| `DESIGN.md`, `PRODUCT.md` | The design rules and who the site is for. Read before changing how it looks. |
| `docs/LEDGERS.md` | Index of the ledgers: what was asked, what shipped, what is still open. |

## Commands

Run from `site/` (Node 22.23 or newer).

| Command | Does |
| --- | --- |
| `npm run dev` | Dev server on `localhost:4321`. |
| `npm run build` | Static build into `site/dist/`, about 15 seconds. |
| `npm run covers` | Fetch missing shelf covers into `src/assets/covers/`. |
| `npm run deploy` | Build, then upload `dist/` to production. |

## Deploy

Cloudflare Pages project `levent-website`, direct upload. There is no Git integration: pushing to
GitHub deploys nothing. `npm run deploy` uploads to the production branch `main`, which serves
leventaksakal.com. Needs a one-time `npx wrangler login`. To look before it is live, upload to any
other branch name and open the address Wrangler prints:

```
npx wrangler pages deploy --branch preview
```

Response headers (cache, content security policy) are in `site/public/_headers`. `robots.txt`,
`llms.txt`, the web manifest, the sitemap and the RSS feed are generated at build time from the same
data as the pages.

## Rules for content

- Every image in the repository is re-encoded without EXIF or XMP before it is added. No phone
  number and no home address anywhere.
- English only. Facts only, from the CV or the owner's own words.
- Logos and cover art belong to their owners and are shown to name the thing they belong to.
