# Radar Sampah Work Plan and Handover

**Version 3.0 | 15 August 2026**

> Use synthetic or public data only. All results are illustrative.

## Goal

Deliver one simple marine-litter demo on Render:

`Report -> Recognize -> Heatmap -> Join mission -> Evidence -> Progress`

## Ownership

| Area | Owner | Handover evidence |
|---|---|---|
| Scope and release | Huang | decision log, links and smoke test |
| Sources and context | Hnin | source URLs, dates and area limits |
| Frontend/accessibility | Qian | workflow test and browser check |
| API and validation | LiHanXia | Flask tests and API examples |
| Database | Keith | schema, Render variable and read-back |
| Recognition boundary | Benshuai | fallback result and provider notes |

## API handover

`/health`, `/api/litter-options`, `/api/litter-reports`,
`/api/litter-recognize`, `/api/litter-heatmap`, `/api/cleanup-missions`,
`/api/cleanup-evidence` and `/api/community-progress` are active.

Earlier sample routes are available only through Git rollback tags.

## Integration steps

1. Branch from `main` and make a small change.
2. Review for secrets, broken code or API mismatch.
3. Merge safe work, run the full flow and fix real failures.
4. Deploy from `main`; record commit, time, URL and synthetic input.

Render uses `DATABASE_URL`. Keep `LITTER_RECOGNITION_ENABLED=false` unless a
private HTTPS provider has been reviewed. Never commit a key or collect real
reporter details.
