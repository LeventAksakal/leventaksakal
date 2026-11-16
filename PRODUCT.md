# Product

<!-- impeccable:product-schema 1 -->

Written 16 Nov 2026 from the owner's answers in chat that day. Wishes and their status: `docs/site/TODO.md`.

## Platform

web

## Stack

Astro, static output, deployed on Cloudflare. The owner approved the move on 16 Nov 2026 "if it earns
its use". English only. No database, admin or live feeds.

## Users

- Recruiters and hiring engineers deciding whether to contact Levent. They skim: who he is, what he has
  built, how to reach him.
- Researchers and potential collaborators looking at his academic work.
- People who want to know him better (the photographs, the shelf, the writing).

## Product Purpose

The owner's words: "to have a webpresence so recruiters or potential people can reach out to me and get
to know me better". Success: a visitor can tell within the first screen what he does in industry and in
research, and can reach him in one click from any page.

## Positioning

A person, not a pitch. The site shows work and taste (his own photographs, what he built, what he
watches, plays and listens to) and makes no claims about himself.

## Operating Context

Read on a phone from a LinkedIn or CV link, or on a desktop by someone comparing candidates. The CV PDF
is the companion document; experience and education come from the same source (`C:\Code\cv`).

## Capabilities and Constraints

- Landing page is neutral and points to both industry work and research with equal weight.
- Industry: APS for Özyeğin University (internal system: describe it, never show its screens),
  Temizel İSG, BabyTell (in development, shown as in progress), internships at Constructor Tech and
  TÜBİTAK SAGE.
- Research: Turkish meaning-to-expression search (ongoing, aimed at publication); MOQtail (open-source
  contribution, counts as research). Thesis interests, not started: backdoors and sleeper agents in LLMs,
  mechanistic interpretability. Harness engineering is not the thesis direction.
- QUIC congestion control (Quinn) is a course project, not research.
- Blog: occasional posts on problems and ideas; one Markdown file per post; RSS.
- Shelf: static recommendations (films, games, music, books) with real cover art. Sources:
  `content/shelf/*.txt` and the owner's Movies list.
- Privacy: no phone number, no home address, no photo metadata. Every published image is re-encoded
  without EXIF.
- Undecided: which projects besides the above are listed; the book list.

## Brand Commitments

- The owner's own photographs give the site its character and must be shown well.
- No self-promotional prose; factual copy only. No paint-tube intro, no scroll video.
- The owner rejects machine tells: serif display paired with a sans, small uppercase labels above
  headings, card grids with tag pills, glow blobs, em dashes.

## Evidence on Hand

- Seven photographs (six panoramas, one portrait): `content/media/`.
- CV source and rendered CV: `C:\Code\cv`.
- Shelf lists: `content/shelf/games.txt`, `content/shelf/musics.txt`, the owner's `Movies.txt`
  (ratings and notes in his own words, in Turkish).
- No published blog posts yet. No testimonials, metrics dashboards or press: none may be invented.

## Product Principles

1. Show, do not tell: evidence and artefacts over adjectives.
2. One source for each fact; the site and the CV cannot disagree.
3. Nothing to maintain that can break: static content, no integrations.
4. The person is visible: photographs and taste sit beside the work, not behind it.
