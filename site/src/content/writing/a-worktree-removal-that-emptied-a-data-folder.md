---
title: A worktree removal that emptied a data folder
description: On Windows, git worktree remove followed a directory junction and deleted the files it pointed to. What happened, and the rules I work by now.
date: 2026-11-16
draft: true
---

<!-- DRAFT. Levent: the facts below come from your own notes. Fill in the two TODO paragraphs
     (what was in the folder, and how you got it back or did not), then set draft: false. -->

On 16 November 2026 I removed a git worktree on Windows with a plain `git worktree remove`. No `--force`. Git 2.47.1.

The worktree held a directory junction named `data` that pointed at a shared data folder outside the worktree. Git followed the junction while deleting, and the real folder ended up empty.

TODO (Levent): what the folder held and how you noticed.

## Why it happened

A junction looks like an ordinary directory to code that walks a tree and deletes what it finds. This is a known problem in Git for Windows, tracked as [git-for-windows/git#6545](https://github.com/git-for-windows/git/issues/6545). It is fixed in Git 2.56 and later by pull request #6151. A follow-up, pull request #6543, is still open.

"No uncommitted changes" does not help here. Git's status does not look through a link, so the worktree reported clean right up to the moment it took the data with it.

TODO (Levent): what you recovered, from where, and what was lost.

## The rules I work by now

1. No junction or symlink inside a worktree, or inside any tree that will be deleted. A task that needs shared data gets it by path: an environment variable or a config value that points at the real folder.
2. If a link cannot be avoided, unlink it before removal, without recursion: `cmd /c rmdir "<link>"`. Then check that the real folder still holds its files.
3. Before removing a worktree, look for links: `dir /AL /S <worktree>`.
4. Git 2.56 or later.
5. A hook that refuses the delete when a link is present, because rules 1 to 3 depend on remembering them.
