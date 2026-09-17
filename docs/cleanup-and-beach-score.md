# Cleanup and Beach Attention: how the two are connected

Engineer-facing description of what a recorded cleanup changes, and how that
change reaches the public beach band. It documents the deployed behaviour at
`49af6ea` (scoring contract `radar-sampah-scoring-i2-v3`); it does not define
new rules. The product-level rules live in the Iteration 2 score analysis
document; this file is the implementation view of the same calculations.

## 1. Two different numbers that share one piece of state

| Number | Scope | Scale | Where it comes from |
| :---- | :---- | :---- | :---- |
| **Cleanup Score** | one cleanup action | band steps removed, no category weights | `standalone_cleanup.py:513-528` |
| **Beach Attention band** | one beach | weighted category scores, median across reports | `app_core.py:1064-1144` |

They are not the same scale and one does not feed the other. A cleanup of two
band steps on Paper contributes `2` to the Cleanup Score while changing the
beach's weighted signal by at most `0.35 x 2`. The only thing the two have in
common is the report's **current band state**: cleanup writes it, Beach
Attention reads it.

## 2. The state model

A report is immutable. Cleanup never rewrites it.

* `reports` keeps the submitted bands in `quantities` (JSON) and, for legacy
  count-backed rows, exact `item_counts`.
* A cleanup appends a row to `cleanup_actions` holding
  `remaining_quantities` - the complete post-cleanup band map for that report -
  plus `cleanup_score`, `handling` and an idempotency key
  (`standalone_cleanup.py:19-55`, `576-597`).
* The **current state** of a report is the newest cleanup row that carries
  `remaining_quantities`; with no such row it falls back to the submitted bands
  (`quantity_band_state_for`, `app_core.py:1325-1336`, and the equivalent
  `_current_band_state`, `standalone_cleanup.py:85-110`).
* A report is **active** when at least one current category band is above Small
  (`_active_quantities`, `standalone_cleanup.py:113-114`). "Active" is exactly
  the condition that puts a report into the beach median.

Because the latest row wins, a second cleanup on the same report starts from the
first one's after-state, not from the original submission.

## 3. How a cleanup target is chosen

`GET /cleanup-targets/<beachId>` returns **one** target (`v3_contract.py:342-362`):

1. all `Counted` reports at that beach, newest first;
2. the first one whose current state is still active after every earlier
   cleanup.

There is no target picker in the participant UI, and a partially cleaned report
keeps being returned until every category reaches Small. So the flow is "work
the newest unresolved pile until it is closed, then move to the next newest".
The client sends `POST /cleanups` with `targetReportId`, `afterBands`,
`handling`, `note` and `idempotencyKey` (`iteration2Api.ts:127-145`); the v3
layer renames `afterBands` to `remainingQuantities` and hands it to the reviewed
handler (`v3_contract.py:364-393`).

## 4. What a cleanup is allowed to change

Enforced in `standalone_cleanup.py:441-528`:

* bands must be `Small`, `Medium`, `Large` or `Very Large`;
* a band may stay the same or decrease - an increase returns
  `409 CLEANUP_STATE_INCREASED`;
* categories that are not sent keep their previous band (the payload is merged
  with the before-state, `506-508`);
* a cleanup cannot introduce a category the report never recorded (`509-510`);
* at least one reduction is required (`517-518`);
* when every post-cleanup category is Small the target is resolved;
* handling (`Collected for disposal` / `Recycled / handled` / `Not recorded`)
  and the note are stored and never enter a score.

The optional after-cleanup photo is inference input only: it is sent to
`/recognitions/cleanup-photo`, used to pre-fill bands (clamped so a suggestion
can never raise a band), and never persisted (`app_core.py:2002-2021`,
`iteration2.ts:591-607`, `tests/test_photo_storage.py:41-56`).

## 5. From cleanup state to the beach band

For one beach (`app_core.py:1064-1144`):

1. take `Counted` reports created within the last 90 days;
2. drop any report that is not active after its cleanups;
3. per report, `Report Score = max(category weight x current band level)`
   (`category_scores_for` / `report_score_for`, `app_core.py:814-825`);
4. with three or more active reports, the beach score is their **median**;
5. `Low < 1.50`, `Moderate < 2.50`, `High < 3.50`, `Very High >= 3.50`
   (`app_core.py:1052-1061`; the contract value for the top band is `Severe`
   and the interface displays "Very high").

Category weights are `Fishing gear 1.00, Plastic 0.85, Glass 0.70, Metal 0.60,
Other 0.50, Paper 0.35`; band levels are `Small 1 ... Very Large 4`.

The map pins and the beach detail page read the same function. The map is served
by `beach_summaries_batch` (`app_core.py:1106-1144`, `quantity_band_state_for`
per report); the beach page is served by `beach_summary` (`1064-1103`), which
calls the active-report helper that `standalone_cleanup.py:125-145` replaces
with the band-aware version. Both therefore apply cleanups; there is no path
that scores the submitted bands after a cleanup exists.

## 6. Worked examples

**One cleanup usually does not move the band.** Four active reports scoring
`1.70`, `1.80`, `2.00`, `2.55` give a median of `1.90` -> Moderate. Cleaning the
`2.55` report down to `1.70` gives `1.70, 1.70, 1.80, 2.00`, median `1.75`.
Beach Attention drops a little and stays Moderate; Cleanup Score is `1`. This is
the normal outcome and the reason the beach page says a new report will confirm
the change.

**Clearing reports can remove the band instead of lowering it.** Resolved
reports leave the active set (`_is_resolved`, `_active_quantities`). Clearing two
of four reports leaves two active observations, so the beach shows
**Insufficient data** rather than Low - the minimum-evidence rule is applied
before any band is published.

**Two cleanups can move a band.** Four active reports scoring `0.70` (Paper
Medium), `1.20` (Metal Medium), `2.55`, `2.55` (both Plastic Large) give a
median of `1.875` -> Moderate. Cleaning both Plastic reports to Medium gives
`0.70, 1.20, 1.70, 1.70`, median `1.45` -> **Low**. Nothing else changed: no
report was deleted, and the two source reports remain in history.

## 7. What a cleanup does not do

* It does not change the report's submitted bands, its `createdAt`, its status or
  its freshness label - "last reported" keeps counting from submission.
* It does not delete anything. A resolved report stays readable and stays in
  "My reports"; it only leaves the current median and the current composition.
* It does not assign a `0` to a cleared report; the report is excluded, not
  zeroed.
* It does not create a beach-level cleanup total. Beach Attention has no cleanup
  component; the Cleanup Score stays attached to the action.
* It does not guarantee the beach band moves. See the median examples above.
* It does not re-run recognition, and the after-photo is not evidence kept
  against the score.

## 8. Cleanup Score and Event Cleanup Total

`Band Reduction Value = max(before level - after level, 0)` per cleaned
category; `Cleanup Score = sum of those values` for the action
(`standalone_cleanup.py:513-518`). Example: Plastic Very Large -> Medium is `2`,
Glass Large -> Small is `2`, Cleanup Score `4`.

The action payload returns that number as `score` (`standalone_cleanup.py:191-207`,
`v3_contract.py:138-150`). Event Cleanup Total is the sum of the linked actions'
scores and is computed by the client for display
(`screens/EventResultScreen.tsx:41`). Neither number enters Beach Attention.

## 9. What the participant sees, and what it means

* Beach page: the band, `N counted reports`, the current composition, and a
  callout `Cleanup recorded - awaiting follow-up ... Cleanup score N from
  confirmed band changes. A new report will confirm the change.`
  (`screens/BeachScreen.tsx:410-416`). The callout is the action's score, not a
  drop in the beach band.
* Cleanup result: `Cleanup completed` for a resolved target or
  `Cleanup recorded`, the action score, and
  `TARGET RESOLVED - HISTORY RETAINED` (`screens/CleanupResultScreen.tsx:113-158`).
* Composition percentages are recalculated from the same active set, so
  "Litter composition" shows what is left now, not what was reported
  originally (`standalone_cleanup.py:210-254`, `291-321`,
  `tests/test_active_composition.py`).

## 10. Boundaries and known gaps

* **Target selection is newest-first, not worst-first**, and the UI offers no
  picker. The list endpoint `GET /cleanup-targets?beachId=` exists
  (`app_core.py:2301-2325`) but the participant flow does not use it.
* **`currentRemainingReportScore` is not exposed.** The report response returns
  the original `reportScore` plus `currentState` (`app_core.py:1350-1378`); the
  current value is only used internally by the median.
* **Legacy count-backed cleanups still exist** for older clients
  (`removedCounts` path) and are normalised at the same boundary
  (`standalone_cleanup.py:103-110`, `529-548`). New actions never use counts.
* **`409 ACTIVE_CLEANUP_TARGET_NEARBY` only applies to the legacy path**: it is
  guarded by `item_counts is not None` (`app_core.py:2549-2567`). Band-based
  reports within 10 m of an active target go through the duplicate/replacement
  decision instead (`app.py:320-367`), and a target that is already cleared
  neither blocks nor duplicates a new report.
* **The beach detail path does not filter `deleted_at`** the way the batch path
  does (`app_core.py:1122` vs `1068-1073`). Nothing writes `deleted_at` today,
  so the two agree; a future soft delete must add the filter to both.
* **Mock mode mirrors these rules offline** (`iteration2.ts:324-434`), so a demo
  without the API shows the same band-state behaviour.

## 11. Where to look in the tests

* `backend/tests/test_active_composition.py` - composition and attention read the
  same non-Small active evidence.
* `backend/tests/test_standalone_cleanup.py` - a cleanup can exist without a
  report target.
* `backend/tests/test_v3_contract.py` - band-based target and cleanup contract.
* `backend/tests/test_final_band_contract.py` - the scoring metadata is band
  native.
* `backend/tests/test_photo_storage.py` - the after-cleanup photo is never
  stored.
* `frontend/src/standaloneCleanup.test.ts`, `iteration2.test.ts`,
  `flowRules.test.ts` - the same rules in the client and mock store.
