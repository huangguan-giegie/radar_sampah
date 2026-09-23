# Iteration 3 — Part C0 legacy closure

Baseline: `iteration2-final` at `38b88ec50c362e40b7f1444fc54f9d35ba61e37a`.
Iteration 3 work is isolated on `iteration3`. The baseline was chosen only after
checking the Render deployment history: later `main` commits changed docs/LICENSE,
not the deployed frontend/backend application code.

## Week 1 closure table

| Item | Evidence-backed gap | Iteration 3 fix | Owner | Effort | Status |
| --- | --- | --- | --- | --- | --- |
| AC2.4.4 | Cleanup UI said the source report was removed although the backend retained history. | Changed copy to **“Source report kept as history; no longer counted.”** No backend deletion change. | UI/UX — Qian Jiang; Frontend — Benshuai Su | 0.5 day | Code complete |
| AC3.3.3 | The displayed freshness date could be driven by resolved or >90-day historical reports. | Added `newestCountedReportAt`, excluded resolved/expired reports, made freshness use the active timestamp, displayed the date below the freshness label, and added contract/regression assertions. `lastReportedAt` remains historical; `latestContributingReportAt` remains as a compatibility alias. | Hnin Darli Myint Myat; Backend — Hanxia Li | 1 day | Code complete |
| AC9.4.1 | No single QA evidence pack existed. | Added `evidence/iteration3-c0/` index and retest checklist; reused the existing 17–18 Sep verification records as references. Real screenshots/network captures still have to be attached by the team before this AC can be closed. | Hanxia Li; all members | 1 day | **In progress — evidence still required** |
| Terminology | /method omitted the 90-day median; /method/ai contradicted Small=1; map used NO DATA while the page used INSUFFICIENT DATA; Very high/Severe wording drifted. | Published the median/window rule, clarified Small-only vs cleanup Small, unified **INSUFFICIENT DATA**, and documented **Very high** as the participant-facing label while `Severe` remains the API value. | UI/UX — Qian Jiang; Rules — Hanxia Li | 0.5 day | Code complete |
| Negative D1 | Invalid beach and offline failures collapsed into “Could not load this beach” with no retry. | Added **Beach not found + Back to map** and **You seem to be offline + Retry** paths. | UI/UX — Qian Jiang; Frontend — Benshuai Su | 0.5 day | Code complete |
| Usability F1 | Free-tier cold start could show a blank page; event API is slow when cold. | Added an HTML boot shell with **Waking up the server…** and a read-only `scripts/prewarm_demo.py` for `/health`, `/beaches`, and `/cleanup-events`. No write retry was added. | Benshuai Su | 0.5 day | Code complete |
| Beach severity card | Transparent/glass status card allowed the hero gradient edge to cut through the card. | Made the hero-overlap status card opaque. | UI/UX — Qian Jiang; Frontend — Benshuai Su | 1 hour | Code complete |
| Negative D3/D5/D7 | Browser confirm could discard a draft; duplicate warning exposed raw report ID; participant ID accepted letters. | Replaced draft confirm with a two-button in-app dialog; duplicate warning now uses report date + beach; participant ID is digit-only and exactly four digits before restore. | UI/UX — Qian Jiang; Frontend — Benshuai Su | 1 day | Code complete |

## Explicitly not carried into Iteration 3 C0

The following Iteration 2 decisions remain unchanged: write-operation retries (F1),
flow bottom navigation (F2), keep/edit logging (F4), duplicate-rule changes (F8),
and notebook font sizing (F11). AC9.1.4 is not reopened for SQLite; PostgreSQL
concurrency remains covered under AC10.1.2.

## Verification

GitHub Actions now runs on pushes to `iteration3` and on PRs targeting it.
The first Iteration 3 review exposed one stale frontend expectation after the
NO DATA → INSUFFICIENT DATA terminology change; that assertion was corrected.
Run 35860555400 then passed frontend typecheck/tests/build and the backend suite
before this documentation-only handoff commit.
