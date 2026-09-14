# Radar Sampah Backend Contract — Iteration 2

This document is the reviewed Iteration 2 backend contract. It supplements the existing frontend API documentation and records the integration decisions that must remain aligned across frontend, backend and database code.

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

## 2. Reports, exact item counts and YOLO

Iteration 1 quantity bands remain available through `quantities` and the six `qty_*` database columns:

- `Small = 1`
- `Medium = 2`
- `Large = 3`
- `Very Large = 4`

Iteration 2 additionally stores confirmed whole-item counts in `itemCounts`. These counts come from a YOLO suggestion that the user confirms/edits, or from manual fallback when recognition is unavailable.

Item-count-to-band compatibility mapping:

- 1–5 items → `Small`
- 6–20 items → `Medium`
- 21–50 items → `Large`
- 51+ items → `Very Large`

Model class mapping:

- `plastic → Plastic`
- `metal → Metal`
- `glass → Glass`
- `paper_cardboard → Paper`
- `styrofoam → Other`
- `fishing_gear → Fishing gear`

`POST /recognitions` analyses an already-owned report photo. `POST /recognitions/cleanup-photo` accepts a temporary after-cleanup photo, performs inference in memory and does **not** persist that photo.

If model weights are unavailable or inference fails, the recognition response must request manual entry instead of pretending a model result exists.

## 3. Duplicate rule

A report is saved with status `Duplicate` when **either** of these rules matches an existing `Counted` report:

1. **Exact-signature rule:** same participant, same beach, same Malaysia local calendar day, and exactly the same category/quantity signature.
2. **Privacy-proximity rule:** same beach, same Malaysia local calendar day, both reports use GPS-backed Iteration 2 location matching, and the privacy-preserving location comparison places them within approximately 10 metres. This rule applies **across participants** and does not require matching categories or quantities.

Different categories or quantity bands remain independent reports unless the privacy-proximity rule matches. Duplicate submissions are still saved with HTTP `201` and status `Duplicate`; they are excluded from the beach score.

For Iteration 2 GPS reports, raw coordinates are not persisted. The backend stores a target-scoped HMAC over a one-metre projected grid and checks neighbouring grid cells for the approximately 10 m rule. A same-day proximity match is saved as `Duplicate` rather than returning the active-target conflict. A nearby active target from an earlier local day still returns `409 ACTIVE_CLEANUP_TARGET_NEARBY` until it is cleared.

Startup repair continues to correct legacy broad same-day duplicate classifications while preserving privacy-proximity duplicates that were explicitly recorded by the reviewed rule.

## 4. Beach Attention Score after cleanup

The original scoring structure is retained in Iteration 2:

1. convert each report's current category quantities to category scores using category weight × quantity weight;
2. the report score is the maximum category score within that report;
3. use active `Counted` reports from the latest 90 days;
4. fully cleared count-backed reports are excluded from the active set (but the original report and cleanup ledger remain in history);
5. fewer than 3 active reports → insufficient data (`score`, `severity` and `band` are null);
6. otherwise the beach Attention Score is the **median of the active report scores**.

For a report with Iteration 2 `itemCounts`, cleanup actions first reduce that report's remaining counts. The remaining counts are converted back to quantity bands, that report is rescored, and only then is the beach median recomputed. A fully cleared report contributes no score to the current median and does not count toward the active minimum; the original report and cleanup ledger remain available for history and audit.

Cleanup does not add points to Attention Score.

`GET /scoring-method/iteration2` publishes this as:

- `remainingCountAggregation: per-report-after-cleanup`
- `reportAggregation: max-category-score`
- `beachAggregation: median-of-active-reports`

## 5. Cleanup targets and actions

Only `Counted` reports with confirmed `itemCounts` and a positive remaining quantity can become cleanup targets.

`GET /cleanup-targets?beachId=morib` returns current targets. Optional `reportId` limits the response to one shared target.

`POST /cleanup-actions` appends a cleanup action. A cleanup action:

- targets one report;
- cannot remove more than the current remaining count in any category;
- is idempotent for the same participant + `idempotencyKey` + request fingerprint;
- stores the removal ledger but does not overwrite the original audit report;
- may be partial, allowing later cleanup actions until remaining counts reach zero.

Cleanup `score` means **number of items removed**. It is not a personal point score, badge or leaderboard value.

## 6. Community events and attendance

`GET /events` idempotently ensures four upcoming Saturday activities per supported beach, normally 09:00–12:00 Malaysia time. A moderator may add another event date through `POST /events`; Iteration 2 does not require a full edit/cancel management console.

Join, Check-in and Attendance are separate states.

Attendance is recorded only when all of these are true:

1. participant joined the event;
2. participant successfully checked in within the broad beach area during the event;
3. participant produced same-event evidence at the same beach: either a photo-backed `Counted` report linked to the event or a cleanup action linked to the event.

Check-in uses the requested GPS coordinates only for the proximity decision. Exact check-in coordinates are not stored.

Relevant endpoints:

- `GET /events`
- `GET /events/{id}`
- `POST /events/{id}/join`
- `DELETE /events/{id}/join`
- `POST /events/{id}/check-in`
- `GET /events/{id}/cleanups`
- `POST /events` (moderator)

## 7. Location privacy

Iteration 2 does not persist raw report GPS coordinates for the new count-backed flow.

For the active-target proximity check, the server stores a target-scoped HMAC of an approximately one-metre projected grid cell. It is used to detect another active cleanup target within roughly 10 metres. The HMAC is not an encrypted coordinate and cannot be reversed into latitude/longitude without the original coordinate search space and server key.

Check-in stores only the pass result and timestamp. No public response serializes exact report or check-in coordinates.

`GEO_PRIVACY_HMAC_KEY` must be a stable private production secret.

## 8. Sharing

Sharing is target-scoped and does not create a social graph.

`GET /share-links?eventId=...&reportId=...` creates a stable signed share scope. At least one ID is required. When both IDs are supplied they must refer to the same beach.

- Event-only links may be created publicly.
- Report links require the authenticated report owner.
- Shared report pages expose only the selected report/target, its current remaining counts and the scoped photo endpoint.
- Sharing never exposes account details or exact coordinates.

Public read endpoints:

- `GET /share-links/{token}`
- `GET /share-links/{token}/photo`

Invalid or out-of-scope tokens return `404`.

## 9. Database integration

Production uses PostgreSQL through `DATABASE_URL`; local development may use SQLite. `DATABASE_SCHEMA` may select an existing PostgreSQL schema.

For an existing database:

1. apply `migrations/001_rename_frontend_reports_to_reports.sql` when the legacy `frontend_reports` table still exists;
2. apply `migrations/002_add_iteration2.sql` before deploying the Iteration 2 backend;
3. deploy the application with the same schema selected by `DATABASE_SCHEMA`.

Migration 002 adds:

- `users.user_token`;
- report `item_counts`, `proximity_ref`, `event_id` and compatibility fields;
- `community_events`;
- `community_event_members`;
- `cleanup_actions`;
- foreign keys, CHECK constraints and indexes required by the Iteration 2 contract.

The application startup path is idempotent and also repairs missing Iteration 2 constraints if an application process created the tables before the release migration was applied. Existing report rows are preserved.

`schema.sql` is the clean-new-database definition. It must stay aligned with migration 002 and the SQLAlchemy runtime tables.

## 10. Moderator provisioning

Normal anonymous signup creates `volunteer` users only. Use `scripts/provision_moderator.py` for a controlled moderator account. The moderator role can create event dates but does not gain report-review powers in this iteration.

## 11. Deployment configuration

Required or recommended production settings:

- `DATABASE_URL`
- `DATABASE_SCHEMA` when using a non-default schema
- `AUTH_JWT_SECRET`
- `FRONTEND_ORIGINS`
- `PHOTO_STORAGE_DIR` on persistent private storage
- `GEO_PRIVACY_HMAC_KEY`
- `LITTER_MODEL_PATH` and `LITTER_MODEL_VERSION` when YOLO inference is enabled

The original report photo is retained in private audit storage. After-cleanup recognition photos are temporary and are discarded after inference.
