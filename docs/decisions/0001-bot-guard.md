---
status: accepted
date: 2026-11-16
deciders: Levent Aksakal
---

# Who may fetch leventaksakal.com: people, search engines and link previews

## Context

The owner, 16 Nov 2026: "we dont want bots to go into our site. a personal portfolio is made for
human-gaze; its not a ecom site. so you should enable strcit guards on leventaksakal.com on
cloudflare."

Before this decision the site invited every crawler: `robots.txt` allowed all, an `llms.txt` offered
the content to language models, and on Cloudflare only Bot Fight Mode was on.

## Options

1. **Search engines and link previews stay, everything else automated goes.** People can still find
   the site by name, and a link pasted into LinkedIn, WhatsApp or Slack still shows its card.
2. Link previews only: also out of Google and Bing, which takes months to undo.
3. People only: a pasted link shows as a bare address.

## Decision

Option 1, chosen by the owner on 16 Nov 2026.

The price, accepted with it: Cloudflare's bot detection adds its own script to every page. On the
live domain that costs 300 to 470 ms of main thread on a simulated phone and holds Lighthouse's
best practices at 81 (the same build scores 100 served locally). This closes
[ticket 0003](../../tickets/0003-cloudflare-bot-script.md).

## What implements it

In the repository (done, 16 Nov 2026):

- `site/src/pages/llms.txt.ts` is deleted.
- `site/src/pages/robots.txt.ts` disallows the crawlers of language-model companies by name and
  allows everyone else. This only asks; a crawler can ignore it.

On Cloudflare, zone leventaksakal.com, Free plan. These settings live in the dashboard, not in the
repository, so they are written here in full:

| Setting (Security, Settings, Bot traffic) | API field on `/zones/{zone}/bot_management` | Before | Now (16 Nov 2026) |
| --- | --- | --- | --- |
| Bot Fight Mode | `fight_mode` | on | on |
| JavaScript detections | `enable_js` | on | on |
| AI traffic, Training | `ai_training` | `disallow` | `block` |
| AI traffic, Search | `ai_search` | `disabled` | `block` |
| AI traffic, Agent | `ai_user` | `only_on_ad_pages` | `block` |
| Personal AI agents (all five listed) | `ai_agents.*` | `disabled` | `block` |
| AI Labyrinth | `crawler_protection` | `disabled` | `enabled` |
| Managed robots.txt with Bot Preference Sync | `is_robots_txt_managed`, `bot_preference_sync_enabled` | off | on |
| Block AI bots (the older single switch) | `ai_bots_protection` | `disabled` | `disabled`: the API accepts `block` and keeps reading `disabled`; the three AI traffic policies above replace it |
| Block content bots | `content_bots_protection` | `disabled` | `disabled`, left off on purpose: what it does to link previews is not documented and could not be tested |

One custom rule (Security, Security rules, Custom rules; action Block; ruleset
`717107c7d0c04e788b384880c0194788`, rule `700f4e30fd6f432a87b40fd7063aa732`). It stops clients that do
not even pretend to be a browser. Verified bots (search engines, link previews, feed readers) and
the RSS feed pass. `httpclient` is not in the list on purpose: LinkedIn's preview fetcher calls itself
`Apache-HttpClient`, and the first version of this rule refused it:

```
(not cf.client.bot and http.request.uri.path ne "/rss.xml" and (http.user_agent eq "" or lower(http.user_agent) contains "curl/" or lower(http.user_agent) contains "wget/" or lower(http.user_agent) contains "python-requests" or lower(http.user_agent) contains "python-urllib" or lower(http.user_agent) contains "python-httpx" or lower(http.user_agent) contains "aiohttp" or lower(http.user_agent) contains "go-http-client" or lower(http.user_agent) contains "java/" or lower(http.user_agent) contains "libwww-perl" or lower(http.user_agent) contains "scrapy" or lower(http.user_agent) contains "node-fetch" or lower(http.user_agent) contains "axios/" or lower(http.user_agent) contains "undici" or lower(http.user_agent) contains "guzzlehttp" or lower(http.user_agent) contains "headlesschrome" or lower(http.user_agent) contains "phantomjs" or lower(http.user_agent) contains "puppeteer" or lower(http.user_agent) contains "playwright" or lower(http.user_agent) contains "selenium" or lower(http.user_agent) contains "colly" or lower(http.user_agent) contains "postmanruntime"))
```

Not done on purpose: a challenge page for every visitor ("Under Attack" mode). It would put an
interstitial in front of the people the site is for.

## Status of the Cloudflare part

Applied on 16 Nov 2026 through the API, after the owner granted the agent's Cloudflare connection
the scopes for it. Checked from outside the same day, by user agent:

| Request | Answer |
| --- | --- |
| A browser, `/` and `/writing/` | 200 |
| `curl`, `python-requests`, headless Chrome | 403 |
| `curl` on `/rss.xml` | 200 |
| GPTBot, ClaudeBot, PerplexityBot | 403 |
| Link previews: Facebook, Slack, LinkedIn, WhatsApp, X, Discord, Telegram | 200 |
| A Googlebot user agent | 200 |

`robots.txt` now starts with Cloudflare's managed block (`Content-Signal: search=yes,ai-train=no`
and its own list of crawlers), followed by this repository's list.

Lighthouse on the live domain afterwards, phone profile: performance 92 (86, 100, 92),
accessibility 100, SEO 100, best practices 81, layout shift 0. AI Labyrinth added nothing to the
page a browser receives.

Not proven:

- The previews were tested with the user agent of each service from a desk, not by pasting a link
  into the real apps. Paste one into LinkedIn and WhatsApp once to be sure.
- A request that only claims to be `ChatGPT-User` still got 200: on the Free plan the Agent policy
  seems to act on agents Cloudflare has verified, not on the name alone.
- `https://leventaksakal.com/llms.txt` still answers although the file is gone from the build (a
  fresh address such as `/llms.txt?x=1` answers 404). This is Pages itself: it keeps a deployed
  asset in each data centre for up to a week after a later deploy removes it, and purging the
  zone's cache does not touch that copy (tried twice). It ends by 23 Nov 2026 without anyone doing
  anything; the crawlers it was written for are refused at the edge meanwhile.

## How to check

- `https://leventaksakal.com/robots.txt` lists the AI crawlers under `Disallow: /`, and
  `/llms.txt` answers 404.
- `curl -I https://leventaksakal.com/` answers 403; a browser still gets the page. To fetch the
  live site from a script, send a browser's user agent.
- A link pasted into a chat app still shows the title and the picture.
- Search Console (or a `site:leventaksakal.com` search after a few weeks) still lists the pages.

## Consequences

- A script that checks the live site (uptime monitors, `curl` in a terminal, an agent fetching
  the page) is refused. The CI never fetches the live domain; it measures the build locally.
- Lighthouse's "agentic browsing" category on the live domain will fall: it rewards exactly what
  this decision removes.
