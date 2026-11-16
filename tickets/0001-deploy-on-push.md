---
status: open
created: 2026-11-16
tags: [deploy, blog]
---

# Should a push to `main` deploy the site?

## Question

Today the site ships only when `npm run deploy` is run on this machine. Do you want a push to
`main` on GitHub to build and deploy it as well?

## Context

Asked on 16 Nov 2026: "just write in md then deploy auto ships as static embed?". Writing a post is
already one Markdown file. What is not automatic is the last step. The Pages project `levent-website`
is a direct-upload project, so pushing to GitHub deploys nothing.

## Options

1. **Keep `npm run deploy` (now).** One command, about 40 seconds. Nothing goes live that you have
   not built and looked at. A post can only be published from this machine.
2. **GitHub Action on push to `main`.** A post written anywhere (GitHub's web editor, a phone) is
   live about 1 to 2 minutes after the push; free for a public repository. Every push to `main`
   deploys, design changes included, so anything you want to look at first has to sit on a branch.
   Needs two repository secrets that only you can create: a Cloudflare API token with the
   "Cloudflare Pages: Edit" permission, and the account id.
3. **Action that deploys only when `site/src/content/writing/**` changed.** Posts ship on push;
   design and data changes still wait for `npm run deploy`. Same secrets as option 2, one more
   rule to remember.

## Recommendation

Option 1 until you have written a few posts. If publishing from this machine turns out to be the
thing that stops you, option 3: it automates posts without giving up the look before a design
change goes live.

## Answer

