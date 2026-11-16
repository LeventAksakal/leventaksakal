---
status: open
created: 2026-11-16
tags: [cleanup]
---

# Delete the archive of the old branches?

## Question

"then you can prune everything else" (16 Nov 2026): does that include the local archive of the
branches deleted today?

## Context

`.git/pre-v4-2026-11-16.bundle` (56 MB, this machine only) holds the branches `v3`, `v4`, `redesign`,
`pinboard-prototype` and `claude/wizardly-archimedes-3xochp`, which were deleted locally and on
GitHub. `.git/pre-v4-admin.dev.vars` is a copy of the old admin's local settings file. The `admin/`
folder itself was deleted on 16 Nov 2026. Deleting the bundle cannot be undone: it is the only copy
of those branches.

## Options

1. **Keep both.** Costs 56 MB on disk and nothing else; the old reworks stay recoverable with
   `git fetch .git/pre-v4-2026-11-16.bundle v3:v3`.
2. **Delete both.** The 2025 site, the paint intro, the scroll-video journey and the admin are gone
   for good.

## Recommendation

Option 1. You disliked those versions, but 56 MB is cheap and the deletion is permanent.

## Answer

