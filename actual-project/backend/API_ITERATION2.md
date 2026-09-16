# Radar Sampah Backend Contract — Iteration 2

This document is the reviewed Iteration 2 backend contract after the final Manual Remarks review. It supplements the frontend API documentation and records the integration decisions that must remain aligned across frontend, backend and database code.

Business timezone: `Asia/Kuala_Lumpur`. JSON timestamps use ISO 8601 with timezone information. Event cards expose local `date`, `startsAt` and `endsAt` values.

## 1. Authentication and participant recovery

The app does not collect a participant name, email address or phone number.

A new anonymous participant receives:

- a random 4-digit `participantId`;
- a session JWT in `token`;
- a one-time `recoveryToken` that must be saved by the participant.

`POST /auth/restore` requires **both** the participant ID and the recovery token:

```json
{
  "participantId": "1637",
  "token": "RS-..."
}
```

The 4-digit participant ID is an identifier, **not a credential by itself**. Missing or incorrect recovery tokens return `401 INVALID_RECOVERY_TOKEN`. A successful restore returns a new session JWT.

Protected mutations require a valid bearer/session token. Participant ID alone must never authorize a mutation or expose a participant's private reports.

## 2. Reports and quantity bands

For new Iteration 2 participant-facing reports, the canonical quantity state is `quantities`: one editable band per selected litter category.

Allowed values are exactly:

- `Small`
- `Medium`
- `Large`
- `Very Large`

Example new report payload:

```json
{
  "beachId": "morib",
  "photoKey": "private/report-photo.jpg",
  "locationSource": "manual",
  "quantities": {
    "Plastic": "Medium",
    "Glass": "Large"
  }
}
```

The participant is not asked to enter exact item counts. New report writes do not require `itemCounts`. Historical `item_counts` / `itemCounts` remain readable only as a compatibility boundary for already-stored records and legacy callers.

A new report whose selected categories are all `Small` is rejected with `422 SMALL_ONLY_REPORT` and is not persisted as active `Counted` evidence.

Model class mapping remains:

- `plastic → Plastic`
- `metal → Metal`
- `glass → Glass`
- `paper_cardboard → Paper`
- `styrofoam → Other`
- `fishing_gear → Fishing gear`

`POST /recognitions` analyses an already-owned report photo. Recognition may count detections internally, but its participant-facing result is an editable category-to-band suggestion. `POST /recognitions/cleanup-photo` accepts a temporary after-cleanup photo, performs inference in memory and does **not** persist that photo.

AI output is a suggestion, not verification. The participant confirms or edits the categories and bands. Empty, failed or unavailable recognition falls back to manual band entry and must not be presented as a successful suggestion.

## 3. Duplicate rule

The reviewed duplicate rule distinguishes location proximity from report content.

For GPS-backed reports at the same beach, compare against active unresolved `Counted` targets using the privacy-preserving 10 metre reference:

- within 10 m **and the same normalized non-Small category-to-band map** → save the new report as `Duplicate`;
- within 10 m but category or band differs → save as independent `Counted` evidence and refresh the matched active target's privacy reference to the new observation location;
- more than 10 m away → independent report;
- a resolved target does not block or duplicate a new report.

The location rule applies across participants. It is not a blanket same-day rule and it does not reject a changed report merely because an active target is nearby.

Manual reports have no proximity evidence and are treated as independent reports. The same participant, beach, date, or category/band signature alone does not establish a duplicate. Historical duplicate decisions remain unchanged.

Duplicate submissions are still saved with HTTP `201` and status `Duplicate`; they are excluded from Beach Attention. Startup migration/backfill must not reclassify historical report statuses.

For GPS reports, raw coordinates are not persisted. The backend stores a target-scoped HMAC over an approximately one-metre projected grid and compares neighbouring cells during the request.

## 4. Beach Attention after cleanup

The scoring structure remains band-based:

1. Category Score = category weight × quantity-band weight.
2. Report Score = the maximum Category Score within that report.
3. Use active `Counted` reports from the latest 90 days.
4. Apply linked cleanup state to each report before scoring it.
5. A report whose current state has no non-Small category is resolved and excluded from the active set, while the original report, photo and cleanup ledger remain in history.
6. Fewer than 3 active reports → insufficient data (`score`, `severity` and `band` are null).
7. Otherwise Beach Attention is the **median of active Report Scores**.

Cleanup does not add personal points to Beach Attention.

`GET /scoring-method/iteration2` publishes the same concepts, including:

- `reportAggregation: max-category-score`
- `beachAggregation: median-of-active-reports`
- cleanup score as quantity-band-unit reduction rather than an item count.

## 5. Current unresolved litter composition

The beach composition panel represents the **current reported unresolved litter estimate**, not a raw item-count percentage and not only the newest historical report.

It uses the same active eligible report set as Beach Attention:

- status must be `Counted`;
- report must be within the latest 90 days;
- linked cleanup changes the report's current band state;
- an all-Small resolved target is excluded;
- a partial cleanup uses the submitted remaining bands;
- legacy stored records may be normalized through compatibility adapters without inventing participant-facing counts.

Composition aggregates internal quantity-level weights (`Small=1`, `Medium=2`, `Large=3`, `Very Large=4`) by category across the active set, then normalises those category totals to percentages that sum to 100.

Standalone cleanup actions have no `targetReportId`; they are separate cleanup evidence and do not alter an unrelated report or directly change report-based composition.

The three-report evidence threshold applies to the public Beach Attention band, **not** to composition. Composition may still be shown when one or two active unresolved reports remain, with its active report count disclosed.

When composition is available, `GET /beaches/{id}` returns an `active_report_estimate` source with `activeReportCount` and `windowDays`. When no active unresolved report remains, both `composition` and `compositionSource` are `null`.

## 6. Cleanup targets and actions

Cleanup is also band-based.

### Linked cleanup

A linked cleanup references one active `Counted` report and submits the litter **remaining after cleanup**:

```json
{
  "targetReportId": "r_123",
  "remainingQuantities": {
    "Plastic": "Small",
    "Glass": "Medium"
  },
  "handling": "Collected for disposal",
  "idempotencyKey": "..."
}
```

Rules:

- remaining bands cannot increase beyond the target's current band state;
- categories with no litter left may be omitted;
- if every remaining category is `Small` (or none remains), the target becomes logically resolved;
- resolution does **not** delete the historical report, original photo or cleanup action;
- the updated active state is used by Beach Attention and current composition.

### Standalone cleanup

A standalone cleanup omits `targetReportId`, supplies `beachId`, and records bands for litter removed during that cleanup:

```json
{
  "beachId": "kelanang",
  "removedQuantities": {
    "Plastic": "Large",
    "Glass": "Small"
  },
  "handling": "Collected for disposal",
  "idempotencyKey": "..."
}
```

It does not alter an unrelated report.

### Cleanup score

Cleanup `score` is a transparent **quantity-band unit** total, not a raw item count and not a personal points system:

- Small = 1
- Medium = 2
- Large = 3
- Very Large = 4

For standalone cleanup, sum the submitted removed bands. For linked cleanup, score the band-unit reduction from the previous state to the submitted remaining state.

Both forms are idempotent for the same participant + `idempotencyKey` + request fingerprint.

After-cleanup photos used for AI suggestions are processed ephemerally and are not stored as cleanup media.

## 7. Community events and attendance

Automatic Saturday activities are created only for beaches whose current Beach Attention severity is `Moderate`, `High` or `Severe`.

- `Low` → no new automatic event.
- insufficient data → no new automatic event.
- existing scheduled events are not deleted merely because later cleanup lowers the beach's Attention state.
- generation remains idempotent and keeps the established Malaysia timezone and upcoming-Saturday schedule.

A moderator may add another event date through `POST /events`; Iteration 2 does not require a full edit/cancel management console.

Join, Check-in and Attendance are separate states. Attendance is recorded only when all of these are true:

1. participant joined the event;
2. participant successfully checked in within the broad beach area during the event;
3. participant produced same-event evidence at the same beach: either a photo-backed `Counted` report linked to the event or a cleanup action linked to the event.

Check-in uses request GPS only for the broad proximity decision. Exact check-in coordinates are not stored.

## 8. Location privacy

New GPS report requests may include coordinates for the immediate beach/proximity decision, but the backend clears raw report latitude/longitude and retains only a target-scoped HMAC proximity reference.

The HMAC is not an encrypted coordinate and is not exposed publicly. Check-in stores only the pass result and timestamp. No public response serializes exact report or check-in coordinates.

`GEO_PRIVACY_HMAC_KEY` must be a stable private production secret.

## 9. Sharing and public litter gallery

Sharing is target-scoped and does not create a social graph.

`GET /share-links?eventId=...&reportId=...` creates a signed share scope. At least one ID is required. When both IDs are supplied they must refer to the same beach.

- Event-only links may be created publicly.
- Report links require the authenticated report owner.
- Shared report pages expose only the selected report/target and its scoped photo endpoint.
- Sharing never exposes account details, raw private photo keys or exact coordinates.

### Beach litter gallery

`GET /beaches/{beachId}/litter-gallery` is public and returns only ordinary historical `Counted` report photos scoped to that beach. Each entry contains only:

- `reportId`
- `reportedAt`
- short-lived `photoUrl`

The response does not expose reporter identity, `photoKey`, latitude/longitude or `proximityRef`. Duplicate reports are excluded. A logically resolved historical Counted report remains eligible because the gallery is historical evidence, not the active-score set.

Gallery photo access uses a short-lived token bound to beach + report + an HMAC photo reference. The raw private storage key is not embedded in the public token. Cleanup images cannot enter the gallery because cleanup suggestion photos are not persisted.

## 10. Database integration and compatibility

Production uses PostgreSQL through `DATABASE_URL`; local development may use SQLite. `DATABASE_SCHEMA` may select an existing PostgreSQL schema.

The active schema keeps historical compatibility fields such as `reports.item_counts`, but new participant-facing report and cleanup writes are band-based. Compatibility fields must not become a second source of truth for new writes.

Iteration 2 cleanup storage includes band-state fields for remaining and removed quantities plus cleanup score. Startup migration/backfill is idempotent and must preserve stored report statuses.

`schema.sql`, release migrations and SQLAlchemy runtime tables must stay aligned. Existing report rows are preserved.

## 11. Moderator provisioning

Normal anonymous signup creates `volunteer` users only. Use `scripts/provision_moderator.py` for controlled moderator provisioning. The moderator role can create event dates but does not gain report-review powers in this iteration.

## 12. Deployment configuration

Required or recommended production settings:

- `DATABASE_URL`
- `DATABASE_SCHEMA` when using a non-default schema
- `AUTH_JWT_SECRET`
- `FRONTEND_ORIGINS`
- `PHOTO_STORAGE_DIR` on persistent private storage
- `GEO_PRIVACY_HMAC_KEY`
- `LITTER_MODEL_PATH` and `LITTER_MODEL_VERSION` when recognition is enabled

The original report photo is retained in private audit storage. After-cleanup recognition photos are temporary and discarded after inference.
