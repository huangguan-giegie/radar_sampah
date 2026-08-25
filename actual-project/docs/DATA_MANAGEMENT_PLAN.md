# Data Management Plan - Radar Sampah

## Purpose

Radar Sampah is a student marine-litter reporting and cleanup-planning demo.
The current Design Thinking direction has 25 stories (15 Must, 6 Should and 4
Could). It uses synthetic/public examples and broad area labels. It is not a
live reporting service, survey database or enforcement system.

## Main flow and roles

Users may start by viewing the map or by joining/creating a cleanup activity.
The Regular User records a photo, category, quantity and beach. An Event
Organiser is a temporary permission attached to the person who created an event;
it is not a separate login role. A project-group Moderator reviews submissions
and cannot verify their own report or cleanup.

## Data classes

| Class | Examples | Use |
|---|---|---|
| Litter report | broad area, type, quantity, photo URL, time | volunteer record |
| Detection | suggestion label, provider and status | suggestion only; user confirms |
| Review state | pending, verified, rejected, duplicate | controls public visibility |
| Area context | severity, freshness and source labels | illustrative map/list context |
| Cleanup outcome | after photo, categories, participants, disposal note | evidence summary; Future/TBD |
| Biodiversity context | source-labelled species/habitat cards | cautious learning context; Future/TBD |
| Contribution | verified report/session points and badge | recognition; Future/TBD |
| Legacy data | earlier observation records | rollback only |

## Storage and quality

- Render uses PostgreSQL through private `DATABASE_URL`; local development uses
  SQLite when it is absent. Schema setup is idempotent and keeps legacy tables.
- GPS may be requested once to suggest a beach. If a future private backend
  stores the exact coordinate for quality control, it must never be returned to
  the public map or included in screenshots. Public output is broad area only.
- Names, email, phone, accounts, passwords, API keys and raw image files are
  not collected. Images are demo paths or approved HTTPS URLs.
- Static samples keep source URL, retrieval date, licence/attribution,
  sensitivity and version where available.
- Pending reports remain hidden from public maps, scores and points until a
  moderator or controlled reviewer verifies them. Rejected, duplicate and
  removed records do not count.

## Current workshop decisions

- The detailed working source has 25 stories: 15 Must, 6 Should and 4 Could.
- I1 is Prepare & Report (Epic 1–2), I2 is Find & Understand (Epic 3–5), and
  I3 is Connect & Prepare (Epic 6–8). I1–I2 are the practical MVP direction;
  unsupported features remain Future/TBD.
- AI is optional assistance. The volunteer confirms the category and quantity;
  manual entry remains available when recognition is off.
- Severity uses versioned deterministic rules and four illustrative bands.
  `Insufficient data` means fewer than three verified reports; `Not recently
  reported` means the newest verified report is older than 90 days.
- Cleanup status is `Completed — awaiting verification` until review, then
  `Verified` or `Rejected`. A verified cleanup is shown as `Cleanup recorded —
  awaiting follow-up`, never as a clean beach.
- Proposed recognition is 5 points per verified cleanup and 1 point per verified
  litter report. Badges and leaderboards remain optional Future/TBD features.

## Review ownership

- **Keith Junn Chong** keeps the requirements baseline: Epics, User Stories and
  the technical Given/When/Then checks.
- **Hnin Darli** reviews the User Acceptance Criteria from Amirah's point of
  view. She checks that the wording is understandable, the evidence and source
  notes are traceable, and each item is labelled Current, Planned or Future/TBD.
- **Huang Guan** records the final cross-file result after the review.

This split keeps the technical requirement record separate from the user-facing
acceptance review. It does not change the project's data boundary or make
future moderation features available in the current demo.

## External recognition and sharing

Recognition is off by default. It can only call a private HTTPS provider when
`LITTER_RECOGNITION_ENABLED=true`; URL, key and timeout stay in Render-only
environment values. A result remains a suggestion and does not prove litter
type, source, ownership, risk or cleanup priority.

Before real collection, the team must agree on consent, access, retention,
deletion, moderation, incident handling and provider-data rules. Do not use the
demo to claim pollution trends, ecological impact, legal status, safety or
enforcement evidence.
