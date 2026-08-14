# Team 04 Actual Project PM Context

## Current product - 15 August 2026

The active product is **TideTrace MY - Marine Litter Reporting and Cleanup Demo for Malaysia**. Use short, natural student English in code, documents, slides and team messages.

`Report -> Recognize -> Heatmap -> Join mission -> Evidence -> Progress`

Use synthetic/public data, broad area labels and source notes. Do not collect identity data, secrets or exact coordinates.

## Implementation boundary

- Backend: Flask/Gunicorn, PostgreSQL on Render and SQLite fallback.
- Frontend: plain HTML/CSS/JavaScript with an accessible list fallback.
- Active API: litter options/reports/recognition/heatmap, cleanup missions and evidence, plus community progress.
- Recognition: deterministic fallback by default. A provider needs `LITTER_RECOGNITION_ENABLED=true`, a private HTTPS URL and team review.
- Database: reports, missions, anonymous joins and evidence are separate from legacy tables.
- DiveSafe MY and older routes remain rollback paths only.

The TideTrace implementation is on `main` at commit `393affd`. Local checks on
15 August passed: backend `25 passed`, frontend `8 passed`, Python compileall,
JavaScript syntax checks and PPT overflow checks. Render was rebuilt from
`393affd` for both the API and static frontend. A synthetic smoke check returned
200 for health/options/context, 200 for demo recognition, 201 for a report,
mission join and before/after evidence, and the report was readable after a
fresh GET. Render reported `database: configured`; no recognition provider was
contacted.

## Rollback record

Commit `d75264e` is the preserved DiveSafe MY rollback point. Keep it available
before TideTrace deployment. It is a recovery record, not the active product
claim or demo path.

## Iterations

1. Report and Recognize: broad report, fixed categories, clear fallback.
2. Map and Act: broad heatmap, anonymous mission join and evidence.
3. Learn and Connect: progress and future community roadmap.

## PM release checks

- Run backend and frontend tests from their documented folders.
- Run one local synthetic report, fallback recognition, heatmap, mission join, evidence and progress read-back.
- Before demo, confirm Render uses the intended `main` commit and PostgreSQL can read saved demo data.
- Record commit, test time, URLs, screenshots, response status and limits.
- Keep provider keys private and disabled unless the data flow is agreed.

## Evidence boundary

Passing a checklist supports a course demo only. It does not prove a real detection, pollution source, safety risk, dispatch, legal duty, cleanup result or ecological impact. HealthFirst stays read-only reference material; the Sample Project PGIE is not changed.
