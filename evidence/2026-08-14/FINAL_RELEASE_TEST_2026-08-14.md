# Final release test — 14 August 2026

## Test record

- Test time: 2026-08-14 21:31 KST / 2026-08-14 12:31 UTC
- GitHub main: `649277c2e75497451c9cef0dfefe9f07ed9745e0`
- Render frontend: `https://team04-marine-observation-frontend.onrender.com`
- Render API: `https://team04-marine-observation-api.onrender.com`
- Data boundary: synthetic/public data only; no personal or sensitive data
- Catalogue: `marine-form-options-2026-08-14-v1`

## Deployment alignment

The Render frontend and API were manually redeployed from the latest `main`
commit `649277c`. Render logs showed the checkout of that commit and successful
builds for both services. The API returned successfully after the redeploy.

## Live API checks

| Check | Result | Evidence |
|---|---|---|
| `GET /health` | Passed — HTTP 200, database configured | response: `{"database":"configured","status":"ok"}` |
| `GET /api/options` | Passed — HTTP 200, five area labels and version returned | `marine-form-options-2026-08-14-v1` |
| `GET /api/context` | Passed — HTTP 200, five OBIS records and data version returned | `obis-malaysia-public-2026-08-14-v1` |
| Valid `POST /api/observations` | Passed — HTTP 201 | synthetic Metal record, id 16 |
| `GET /api/observations` after create | Passed — HTTP 200; id 16 was read back | 16 synthetic records currently returned |
| Missing category | Passed — HTTP 400 | `Missing required fields` |
| Out-of-range latitude | Passed — HTTP 400 | `Coordinates are out of range` |

## Live frontend checks

- The native area dropdown displayed all five labels.
- Report -> Review -> Confirm -> Results completed with synthetic data.
- The result showed the selected area, submitted coordinates, category rule,
  illustrative priority, OBIS source context and the non-enforcement boundary.
- Screenshot: `frontend-area-options.png`.
- Screenshot: `frontend-results.png`.

## Error recovery

The frontend workflow test suite passed 12/12, including the API-unavailable
case. The UI keeps the confirmed draft and exposes a retry action. A live API
outage was not injected into the production service because that would require
changing the deployed runtime; this remains a controlled-test limitation.

## Limitations and follow-up

- All created records are synthetic demonstration records and should not be
  interpreted as a real litter survey.
- Classification and clean-up priority remain fixed illustrative rules.
- OBIS context is a static, source-labelled, aggregated sample; it does not
  verify species identity or expose exact sensitive locations.
- External AI/CV, real uploads, personal identifiers and enforcement workflows
  remain disabled.
- Darli still needs to confirm the five area labels and the source wording
  before any new category or more precise location is added.

## Post-redeploy smoke recheck

- Test time: 2026-08-14 21:37 KST / 12:37 UTC
- Render services were live from `main` commit `0357dbb52d514da256f56f02ad18926bdedf2dcc`.
- `/health`, `/api/options`, and `/api/context` returned HTTP 200.
- A synthetic Metal observation returned HTTP 201 as id 17; a subsequent
  `GET /api/observations` returned the same record.
- A missing-category request returned HTTP 400.
- The deployed UI completed Report -> Review -> Confirm -> Results with the
  North-west Peninsular Malaysia coast label and coordinates 5.5, 100.5.
- The automated frontend suite remained 12/12, including API failure retry.
