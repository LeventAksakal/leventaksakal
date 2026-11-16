---
status: open
created: 2026-11-16
tags: [cloudflare, performance]
---

# Keep Cloudflare's bot-detection script on the site?

## Question

Cloudflare adds its own script to every page of leventaksakal.com. It is the only thing left that
costs Lighthouse points on the live domain. Keep it or turn it off?

## Context

The script (`/cdn-cgi/challenge-platform/scripts/jsd/main.js`, "JavaScript detections") is added by
the zone, not by the repository: the local build does not have it. Measured on the live domain,
16 Nov 2026, Lighthouse phone profile, three runs:

- Best practices 81 on the live domain against 100 for the same build served locally. The one
  failing audit is "Uses deprecated APIs", and both entries point at that script.
- 300 to 470 ms of main-thread time on the simulated phone, and about 17 KiB.
- Performance is still 91, 96 and 99 with it on.

The site is static: no form, no login, no comments, nothing a bot can abuse beyond reading pages
that are public anyway. It is a security setting of the zone, so it is not changed without you.

## Options

1. **Turn it off** (Cloudflare dashboard, the zone, Security, Settings, Bot traffic: "JavaScript
   detections" off). Best practices returns to 100, the phone gets about 0.4 s of main thread back.
   Cost: Bot Fight Mode loses one of its signals. On some plans the script is tied to Bot Fight
   Mode, and turning it off means turning that off too.
2. **Keep it.** Nothing changes; best practices stays at 81 on the live domain, and the number can
   move again whenever Cloudflare changes its script.

## Recommendation

Option 1, as long as the dashboard lets you turn the script off on its own. If it only goes
together with Bot Fight Mode, still option 1: a static site has little to protect, and the AI
crawler rules are a separate setting.

## Answer

