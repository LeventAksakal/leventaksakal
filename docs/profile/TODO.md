# Profile README ledger

The README of this repository is the page github.com/LeventAksakal shows. How to refresh it is in
`SITE.md`, "Refresh the profile README".

Status values: open, in progress, shipped not measured, done.

| # | Owner's words (date) | Target | Status | How to check |
|---|---|---|---|---|
| 1 | "The readme on this shows up on my github profile. This one is built towards the website. You should rework it so its a showcase in my gh profile. while this version is kept under a different name." (19 Nov 2026) | `README.md` is a profile page; the site's README is kept whole under another name, and nothing that pointed at it is left pointing at the wrong file. | built, not committed, not pushed (19 Nov 2026): the old README is `SITE.md` (moved with `git mv`); the pointers in `.github/workflows/site.yml` and `site/scripts/budget.mjs` now name it. Waits for the owner to look. | `node profile/preview.mjs`, open `localhost:8790`; `grep -rn "README.md" .github site/scripts` shows no pointer to site documentation |
| 2 | "you can use nice CSS; html that gh support to shine. you can show aggregate stats and metrics on tech stack I use frequent LOC etc IDK make me suprised" (19 Nov 2026) | Real numbers only, counted from the owner's repositories by a script that states what it counts. Every drawing reads in GitHub's light and dark themes. Weight: hero 1 MB or less, each chart 60 KB or less, the whole page 1.3 MB or less. `render` in 30 s or less, `collect` in 6 min or less. | built, not committed, not pushed. Measured 19 Nov 2026: hero 1,005 KB, charts 21 to 55 KB, page 1.18 MB a theme, `render` 10 s, `collect` 4 min 44 s. Seen in the local preview (GitHub's renderer, GitHub's image headers) in Chromium at 1100px and 375px, light and dark. **Not seen on github.com itself, nor in Firefox, Safari or the GitHub phone app**: whether the embedded typeface and photographs load there is unproven until it is pushed. At phone width the chart labels are about 6px tall; the same numbers stand in the text under each chart. | Push, open github.com/LeventAksakal in both themes and on a phone; the hero cycles six photographs, the charts follow the theme |
| 3 | "github readme doesnt have to display my whole fucking CV idiot. you can link the porfolio website. dont repeat it."; on hosting: "no not hosted github readme isnt hosted anywhere github renders it automatically" (19 Nov 2026) | The README holds nothing the site already says: no Industry, Research, Projects or Education entries, no "away" line. One sentence and a link to leventaksakal.com. Nothing of it is served from the domain. | built, not committed, not pushed (19 Nov 2026): the four sections and the closing line are removed from `readme()` in `profile/render.mjs`; the README is 47 lines: hero, one line with the link, the numbers. | `grep -cE "Constructor|TÜBİTAK|GPA" README.md` prints 0 |

## Decisions the owner has not seen yet

- The line "I work with coding agents: these are the commits and lines made under my name, by me
  and by the agents I run." stands under the first chart. 1.65M lines and 241 commits in a day do
  not read as hand-typed; the page says so itself. It is a statement about the owner: his to keep,
  reword or remove (`readme()` in `profile/render.mjs`).
- "When the commits land" shows commits by weekday and hour. It is his working pattern, in public.
  Remove the section in `readme()` if he would rather not show it.
- The GitHub bio still reads "coding on..." and the location "Bursa & İstanbul". Not touched.

## What was counted, and what was left out

- 40 repositories in `C:\Code` hold a commit under the owner's name; 37 count as his. The MOQtail
  clones do not (he wrote under 60% of their commits), so their lines and tools are not counted.
- Commits on `main`, `master`, `stage` and the branch checked out. me2exp keeps its work on the
  checked-out branch (552 commits; `main` holds 5). Commits that only exist on other branches are
  not counted, so parallel agent lanes that were never merged are left out.
- Left out of the lines: `shared/api-types.ts` in temizelisg (62,559 generated lines), the
  `*.dc.html` design exports, `.agents/` and `.claude/` folders, lock files, snapshots.
- The repositories on GitHub that are not on this machine (the older course repositories) are not
  counted.
