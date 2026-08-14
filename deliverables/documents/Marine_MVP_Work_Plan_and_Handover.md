# DiveSafe MY Work Plan and Handover

**Version 2.0 | 15 August 2026**

> Use synthetic or public data only. Results are illustrative and do not prove
> species identity, ecological impact or legal status.

## Goal

Deliver one simple diver journey that can run on Render:

`Profile -> Site -> Species guide -> Briefing -> Confirm -> Sighting`

## Iterations

| Iteration | Focus | Boundary |
|---|---|---|
| 1 | Prepare and Explore | profile, site guide, species directory, briefing and broad map |
| 2 | Identify and Contribute | demo recognition, confirmation, sighting, collection and badge |
| 3 | Learn and Connect | quizzes, community feed and wider gamification roadmap |

## Ownership

| Area | Owner | Handover evidence |
|---|---|---|
| Scope and release | Huang | decision log, links and final smoke test |
| Sources and map context | Hnin | source URLs, dates and location limits |
| Frontend and accessibility | Qian | workflow test and browser check |
| API and validation | LiHanXia | Flask tests and API examples |
| Database | Keith | schema, Render variable and read-back check |
| Recognition boundary | Benshuai | fallback response and provider notes |

## API handover

- `GET /health`
- `GET /api/dive-sites`
- `GET /api/species` and `/api/species/<site_id>`
- `GET /api/briefing/<site_id>`
- `POST /api/profile`, `/api/recognize`, `/api/sightings`
- `GET /api/sightings` and `/api/collection/<profile_id>`

The earlier `/api/observations`, `/api/context` and `/api/options` routes stay
as a legacy rollback layer only.

## Integration steps

1. Branch from `main` and make a small change.
2. Do a quick review for secrets, broken code or API mismatch.
3. Merge safe work, run the whole flow and fix real failures.
4. Deploy from `main` and record commit, time, URL and synthetic input.

Render uses `DATABASE_URL` for PostgreSQL. Local work uses SQLite when it is
missing. Recognition is a local fallback unless a reviewed HTTPS adapter is
set privately. Never commit a key or a real diver profile.
