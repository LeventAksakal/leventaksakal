# Profile README ledger

The README of this repository is the page github.com/LeventAksakal shows. How to refresh it is in
`SITE.md`, "Refresh the profile README".

Status values: open, in progress, shipped not measured, done.

| # | Owner's words (date) | Target | Status | How to check |
|---|---|---|---|---|
| 1 | "The readme on this shows up on my github profile. This one is built towards the website. You should rework it so its a showcase in my gh profile. while this version is kept under a different name." (19 Nov 2026) | `README.md` is a profile page; the site's README is kept whole under another name, and nothing that pointed at it is left pointing at the wrong file. | done, pushed 19 Nov 2026 (commit `96fed77`): the old README is `SITE.md` (moved with `git mv`); the pointers in `.github/workflows/site.yml` and `site/scripts/budget.mjs` now name it. | `node profile/preview.mjs`, open `localhost:8790`; `grep -rn "README.md" .github site/scripts` shows no pointer to site documentation |
| 2 | "you can use nice CSS; html that gh support to shine. you can show aggregate stats and metrics on tech stack I use frequent LOC etc IDK make me suprised" (19 Nov 2026) | Real numbers only, counted from the owner's repositories by a script that states what it counts. Every drawing reads in GitHub's light and dark themes. Weight: hero 1 MB or less, each chart 60 KB or less, the whole page 1.3 MB or less. `render` in 30 s or less, `collect` in 6 min or less. | shipped 19 Nov 2026 (commit `96fed77`), partly measured. Measured: hero 1,005 KB, charts 21 to 55 KB, page 1.18 MB a theme, `render` 10 s, `collect` 4 min 44 s. Seen in the local preview (GitHub's renderer, GitHub's image headers) in Chromium at 1100px and 375px, light and dark. On github.com/LeventAksakal after the push, in Chromium: the hero, its typeface and photographs load, and the charts switch between their light and dark files with the theme. **Not seen in Firefox, Safari or the GitHub phone app.** At phone width the chart labels are about 6px tall; the same numbers stand in the text under each chart. | Open github.com/LeventAksakal in both themes and on a phone; the hero cycles six photographs, the charts follow the theme |
| 3 | "github readme doesnt have to display my whole fucking CV idiot. you can link the porfolio website. dont repeat it."; on hosting: "no not hosted github readme isnt hosted anywhere github renders it automatically" (19 Nov 2026) | The README holds nothing the site already says: no Industry, Research, Projects or Education entries, no "away" line. One sentence and a link to leventaksakal.com. Nothing of it is served from the domain. | done, pushed 19 Nov 2026 (commit `96fed77`): the four sections and the closing line are removed from `readme()` in `profile/render.mjs`; the README is 47 lines: hero, one line with the link, the numbers. | `grep -cE "Constructor|TÜBİTAK|GPA" README.md` prints 0 |
| 4 | "When commits land and 'Repositories that use each tool [...]' is just garbage dump. please put out useful stuff as well as the character; like the website iframe is really nice with image carousel. stat dump isnt; it should give insgiht or character to the repo." (19 Nov 2026) | Nothing on the page is a number shown because it could be counted. What stays tells a visitor something (what he works on and when, what it is written in) or carries character (his photographs). | done, pushed 19 Nov 2026: the weekday-by-hour chart and the tools chart are gone, with their files; `collect.mjs` no longer gathers hours, tools, streaks, the busiest day, Markdown lines or lines added and removed, and `stats.json` no longer holds them. The page is the hero, one line with the link, four figures, the year by project and one language bar. Whether the three that stay read as insight to him is his call | `ls profile/*.svg` lists hero, figures, year and languages only; `grep -c "punch\|tools" profile/stats.json` prints 0 |

## Shipped without the owner's word on them

- The line "I work with coding agents: these are the commits and lines made under my name, by me
  and by the agents I run." stands under the first chart. 1.65M lines and 241 commits in a day do
  not read as hand-typed; the page says so itself. It is a statement about the owner: his to keep,
  reword or remove (`readme()` in `profile/render.mjs`).
- The GitHub bio still reads "coding on..." and the location "Bursa & İstanbul". Not touched.

## What was counted, and what was left out

- 40 repositories in `C:\Code` hold a commit under the owner's name; 37 count as his. The MOQtail
  clones do not (he wrote under 60% of their commits), so their lines are not counted.
- Commits on `main`, `master`, `stage` and the branch checked out. me2exp keeps its work on the
  checked-out branch (552 commits; `main` holds 5). Commits that only exist on other branches are
  not counted, so parallel agent lanes that were never merged are left out.
- Left out of the lines: `shared/api-types.ts` in temizelisg (62,559 generated lines), the
  `*.dc.html` design exports, `.agents/` and `.claude/` folders, lock files, snapshots.
- The repositories on GitHub that are not on this machine (the older course repositories) are not
  counted.
