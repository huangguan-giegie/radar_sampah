# Iteration 3 — Iteration 2 Legacy Items: Closure and Evidence

## Scope and release

This record covers the Iteration 2 C0 usability and acceptance-test items
carried into Iteration 3, the fixes made, and the evidence gathered locally and
against the deployed release candidate.

- Iteration 2 baseline: `iteration2-final`, `38b88ec50c362e40b7f1444fc54f9d35ba61e37a`.
- Deployed branch: `main`.
- Deployed SHA: `368212375a25b3443ac002e7526a657dca2e35f2`.
- Render frontend deploy `dep-dar23bjbc2fs738imq30`: live at
  `2026-09-25T07:24:58.286383Z`.
- Render API deploy `dep-dar23bjbc2fs738imqlg`: live at
  `2026-09-25T07:27:35.368553Z`.
- Both Render deploy records reference the same SHA. Pushing Iteration 3 to
  `main` triggered the configured automatic deploys.

## Legacy items and resolution

| Item | Iteration 2 gap | Iteration 3 resolution | Retest result and evidence |
| --- | --- | --- | --- |
| AC2.4.4 — cleanup history | Cleanup confirmation implied the source report had been deleted, while the backend retained it. | Copy now says **“Source report kept as history; no longer counted.”** Backend deletion behavior was not changed. | **Pass locally** against an isolated SQLite database with synthetic reports: cleanup returned HTTP 201; `GET /reports/mine` returned HTTP 200 and retained the resolved report; the beach response counted two remaining reports. Public cleanup mutation was not repeated. |
| AC3.3.3 — active freshness | Resolved or older-than-90-day reports could determine the displayed latest-report date. | Added `newestCountedReportAt`, excluding resolved/expired reports; the beach page displays that active timestamp. `lastReportedAt` remains historical and `latestContributingReportAt` remains a compatibility alias. | **Pass locally and public field smoke.** Local case returned HTTP 200 with two eligible reports and `newestCountedReportAt=2026-09-23T22:30:31.805426+08:00`; resolved and 2026-06-07 reports did not determine freshness. Public `GET /beaches/morib` returned HTTP 200 with four eligible reports and `newestCountedReportAt=2026-09-18T14:12:29.080315+08:00`; the UI displayed `NEWEST COUNTED · 2026-09-18`. |
| Terminology | `/method` omitted the 90-day median; `/method/ai` contradicted Small=1; map and beach used inconsistent no-data labels; Very high/Severe wording drifted. | Documented the median/window and minimum-report rule; clarified Small-only evidence versus post-cleanup Small; standardized **INSUFFICIENT DATA**; explained participant-facing **Very high** versus internal API `Severe`. | **Pass locally and public smoke.** `/method`, `/method/ai`, and map terminology were visually checked. Public `/method` and `/method/ai` loaded; `GET /scoring-method` returned HTTP 200. |
| D1 — invalid beach | Invalid beach and network failure collapsed into a generic load error without a useful recovery action. | Invalid IDs show **Beach not found** and **Back to map**. Offline failures show **You seem to be offline** and **Retry**. | **Pass locally and public smoke.** Public `GET /beaches/not-a-real-beach` returned HTTP 404 and the UI showed the not-found state. Under browser offline emulation, beach reads failed with `ERR_INTERNET_DISCONNECTED`; restoring the network and retrying returned HTTP 200 and restored the beach page. |
| F1 — cold start | A sleeping free-tier service could leave a blank page. | Added the HTML boot shell **Waking up the server…** and read-only `scripts/prewarm_demo.py` requests to `/health`, `/beaches`, and `/cleanup-events`. No write retry was added. | **Pass locally under slow-network emulation.** With 400 ms latency and 50 KB/s download, the shell appeared while the app chunk was blocked; the app became ready after unblocking, with no POST observed during startup and no ready-state browser console warning/error. A sleeping Render cold start was not separately simulated. |
| Beach severity card | Hero imagery/gradient could show through the status card. | Made the overlapping status card opaque. | **Pass locally at 390×844 and 320×844 on Morib and Remis; public responsive smoke passed on Morib at both sizes.** |
| D3 — unfinished draft | Browser confirm could discard a draft without an in-app choice. | Added an in-app dialog with **Continue draft** and **Discard draft & start new**. | **Pass locally.** Both choices were visible; no JavaScript confirm dialog was present. |
| D5 — duplicate report | Warning exposed a raw report ID and lacked useful context. | Warning now identifies the report by date and beach. | **Pass locally.** Same-day Pantai Morib warning showed the date and beach and did not expose a raw report ID. |
| D7 — participant ID | Restore participant ID accepted non-digits or incorrect lengths. | Input is limited to exactly four digits before restore. | **Pass locally.** Input `12a34567` was reduced to `1234`; no restore was submitted. |

## Deployed smoke evidence

Read-only smoke was performed in the Codex in-app browser against the deployed
frontend and API on 2026-09-25. The API health request returned HTTP 200 with:

```json
{"database":"configured","status":"ok"}
```

| Request or check | Observed result |
| --- | --- |
| Frontend `/map` | HTTP 200; map rendered. |
| `GET /beaches`, `GET /auth/me` | HTTP 200. |
| `GET /beaches/morib` | HTTP 200; four valid/eligible reports and the active timestamp above. |
| `GET /cleanup-targets/morib`, `GET /beaches/morib/cleanups/latest`, `GET /scoring-method` | HTTP 200. |
| Frontend `/method`, `/method/ai` | Both pages rendered; scoring-method API returned HTTP 200. |
| `GET /beaches/not-a-real-beach` | HTTP 404; UI showed **Beach not found** and **Back to map**. |
| Offline beach request | Browser network emulation recorded `ERR_INTERNET_DISCONNECTED`; UI showed the offline message and Retry action. After reconnection, `GET /beaches/morib` returned HTTP 200. |
| Automatic `POST /api/species-distribution/predict` | HTTP 200. This is the page's automatic inference request, not a report or cleanup write. |

The public smoke made no `POST /reports` or `POST /cleanups` requests and no
restore submission. Public user data was not intentionally modified. Cleanup,
draft, duplicate-warning, participant-ID, and other mutation-oriented checks
used the isolated local synthetic-data setup described above.

## Console and service log evidence

- Browser warning/error query during the public smoke: **0 warnings, 0 errors**.
- Render API error-log query from `2026-09-25T07:24:00Z` through
  `2026-09-25T07:37:35Z`: **0 error entries**.
- API startup emitted an ONNX Runtime GPU-device detection warning because
  `/sys/class/drm/card0` was unavailable in the Render environment. Health and
  prediction endpoints returned HTTP 200; GPU inference was not asserted.
- Network and console observations above are the sanitized summary recorded
  from the browser session; a HAR export was not saved.

## CI and retained decisions

GitHub Actions run `35860555400` passed frontend typecheck, tests, production
build, and the backend suite before deployment. The stale frontend expectation
found after the NO DATA → INSUFFICIENT DATA terminology change was corrected.

Iteration 2 decisions not reopened by this work remain unchanged: write retries
(F1), flow bottom navigation (F2), keep/edit logging (F4), duplicate-rule
changes (F8), and notebook font sizing (F11). AC9.1.4 was not reopened for
SQLite; PostgreSQL concurrency remains covered by AC10.1.2.

**AC9.4.1 status: Pass.** This single record contains the carried-over gap,
resolution, local retest result, deployed SHA, Render deploy IDs, and public
network/console smoke evidence. The public release smoke was read-only apart
from the automatic prediction request; mutation-oriented C0 interactions were
checked with local synthetic data.
