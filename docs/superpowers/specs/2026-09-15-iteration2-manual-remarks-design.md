# Iteration 2 Manual Remarks Design

## Purpose

Implement the final Iteration 2 Manual Remarks handoff on top of the current production `main` branch without reverting the active-composition work already merged in PR #46.

This design supersedes the same-day exact-count design documents where they conflict with the final handoff. The product contract for new Iteration 2 reporting and cleanup becomes quantity-band based.

## Source of truth and scope

Implement, in dependency order:

1. Point 10 — quantity-band migration
2. Point 14 — 10 m duplicate logic
3. Point 26 — Beach Attention event-generation gate
4. Point 24 — AI suggestion explanation
5. Point 27 — beach litter gallery
6. Point 39 — ecological background-story link

Point 11 has no new functional change, Point 30 is documentation-only, and Point 38 is deferred to Iteration 3.

The implementation must preserve existing token/security, photo privacy, biodiversity separation, report history, cleanup idempotency, event attendance, share links, and the PR #46 active-unresolved-composition behavior unless this design explicitly changes the quantity semantics.

## 1. Quantity-band reporting contract

### Canonical new report input

New report writes use the existing category-to-band shape as the authoritative value:

```json
{
  "quantities": {
    "Plastic": "Medium",
    "Glass": "Large"
  }
}
```

`Small`, `Medium`, `Large`, and `Very Large` are the only accepted band values. The participant is never asked to type a numeric quantity.

The existing `reports.item_counts` column and frontend legacy `itemCounts` support remain readable only for backward compatibility with already-stored rows. New report creation must not require or populate exact item counts as report state.

### AI recognition

The recognizer may count detections internally, but the participant-facing recognition endpoint exposes editable category + quantity-band suggestions. Exact counts are not copied into the report draft and are not required by the report-create API.

If recognition fails, times out, is unavailable, returns no supported class, or is rejected by the participant, the manual path remains fully usable with category and band selectors.

### Small threshold

`Small` remains a valid user-confirmable band but is below the active litter threshold.

For a mixed report, Small categories may remain in the immutable report evidence for display/history, but they are excluded from active composition and Beach Attention calculations. Non-Small categories continue normally.

If every confirmed category on a newly submitted report is `Small`, the backend does not create a normal `Counted` report. It returns a deterministic `SMALL_ONLY_REPORT` validation result and the frontend explains that the report is below the active reporting threshold. This avoids inventing a new persisted report status and satisfies the handoff wording that Small-only reports are excluded/not recorded.

### Scoring

Category Weight × Quantity Level remains the core scoring rule. Quantity Level is derived directly from the confirmed band, not from an exact count.

Only non-Small active categories participate in the active report score. If no non-Small category remains, the report is inactive/resolved for Beach Attention.

Beach Attention remains the median of eligible active report scores over the existing 90-day window, requires at least three eligible reports, excludes Duplicate and Incomplete reports, and remains separate from biodiversity and Cleanup Score.

## 2. Cleanup contract and active composition

### Linked cleanup

A linked cleanup records the litter remaining after the cleanup, not an exact number of items removed.

Flow:

1. Start `Add a Cleanup` from an active target.
2. Optionally upload one after-cleanup image.
3. Recognition returns category + band suggestions for what remains.
4. The participant confirms/edits remaining categories and bands.
5. Omitted categories mean no remaining litter for that category.
6. Submit the confirmed post-cleanup band state.

The after-cleanup image is processed ephemerally and is never stored as an ordinary report photo or cleanup photo.

The active state for a report is therefore:

- original `quantities` before any cleanup;
- otherwise the most recent linked cleanup's confirmed `remainingQuantities`.

Active composition and Beach Attention consume this band state after filtering out `Small` categories.

If no non-Small categories remain after a linked cleanup, the target is logically resolved and removed from active composition/Beach Attention. The original report row, original report photo, and cleanup action remain available for history/audit. No destructive report deletion and no in-place rewrite of the original report quantities is allowed.

### Standalone cleanup

A standalone cleanup has no report baseline, so it records the participant-confirmed bands for litter actually removed as `removedQuantities`. It never subtracts from or rewrites an unrelated report.

### Cleanup Score

Cleanup Score is action-local display data only.

Use deterministic band units:

- Small = 1
- Medium = 2
- Large = 3
- Very Large = 4

For a linked cleanup, the score is the sum of positive band-unit reductions from the pre-cleanup active state to the confirmed post-cleanup state. An omitted post-cleanup category has value 0. Increases do not create negative score.

For a standalone cleanup, the score is the sum of the confirmed removed-band units.

The score is not lifetime points, badge progress, a leaderboard value, or an environmental-impact claim.

### Cleanup persistence migration

Existing `cleanup_actions.removed_counts`, `total_removed`, and legacy count-shaped rows must remain readable for historical actions.

New cleanup writes require band-based persistence. Add migration-safe nullable fields for the canonical new state, conceptually:

```text
remaining_quantities  JSON/text nullable   # linked cleanup after-state
removed_quantities    JSON/text nullable   # standalone cleanup amount bands
cleanup_score         integer nullable
```

The existing `rows` JSON may continue to serialize presentation rows, but new rows contain band transitions rather than exact counts. Legacy exact-count columns are made nullable/conditional as required so new band-based actions do not need fabricated numeric values.

Startup migration/repair must remain idempotent for SQLite test databases and the production Neon/PostgreSQL path.

## 3. Duplicate detection

Duplicate matching applies only against active, unresolved cleanup targets.

Use temporary full-precision request coordinates for the distance/proximity comparison, but do not expose exact coordinates publicly and do not add raw precise GPS persistence.

For a candidate active target within 10 metres:

- equal normalized active quantity map (same categories + same bands) -> reject/save as `Duplicate` according to the existing report-status flow;
- any category or band difference -> accept the new report and refresh the existing active target's stored privacy-preserving proximity reference using the new coordinate;
- resolved targets do not block a new report.

A report more than 10 metres from all active targets is an independent location and must not update an unrelated target reference.

The 10 m comparison supersedes the existing blanket `ACTIVE_CLEANUP_TARGET_NEARBY` rejection. There is no separate blanket rejection merely because a target exists from an earlier Malaysia-local day.

For multi-category reports, "same category + same band" means equality of the normalized non-Small category-to-band map. This makes the singular checklist rule deterministic for the existing multi-category report model.

Boundary tests cover just inside, at the implementation's deterministic 10 m boundary, and just outside 10 m.

## 4. Weekly event generation gate

Retain the existing upcoming-Saturday scheduling model, Kuala Lumpur/Malaysia business timezone, unique beach/date behavior, retry safety, and idempotency.

Before auto-creating an event for a beach, read the current Beach Attention band:

- Moderate -> create/ensure scheduled event
- High -> create/ensure scheduled event
- Severe -> create/ensure scheduled event
- Low -> do not auto-create
- Insufficient data -> do not auto-create

Do not delete already-existing scheduled events merely because the current band later becomes Low or Insufficient; this change gates creation, not retrospective cancellation.

Moderator-created events remain independent of this automatic gate.

## 5. AI suggestion explanation

Add a visible `?` help control beside AI category/band suggestions in both report recognition and cleanup recognition flows.

The explanation states, in plain language:

- what supported litter category the model detected/mapped;
- which quantity band it suggested;
- that the band is an AI suggestion, not verification;
- that the participant must confirm or edit it;
- that AI does not determine Beach Attention;
- that AI does not prove cleanup success.

Do not use `verified detection`, `guaranteed result`, `confirmed by AI`, or equivalent certainty language. Do not expose an exact detector count as the user-facing reason for the final report state.

## 6. Litter gallery

### Data source

Reuse the existing ordinary-report `reports.photo_key` private-photo infrastructure. Do not add a duplicate report photo-reference column.

After-cleanup images remain ephemeral and therefore can never enter the gallery.

### API

Add a beach-scoped read endpoint such as:

```text
GET /beaches/{beachId}/litter-gallery
```

The response contains only minimal gallery metadata for ordinary Counted report photos belonging to that beach, for example report id, report date, and a short-lived gallery-safe photo URL. It must not return raw `photo_key`, reporter identity, exact GPS, `proximity_ref`, or data for another beach.

Gallery photo access gets its own short-lived signed scope/token bound to the selected report/photo/beach. It must not weaken the existing owner-only preview URL path or make the underlying photo object guessable/public.

Historical Counted report photos may remain visible after a cleanup resolves the target because the gallery is a litter-photo history, while active composition separately represents current unresolved litter.

### Frontend

Each Beach Information page shows a `Litter Gallery` button. The beach-specific gallery page shows ordinary report photos and beach-level context only, with a clear empty state when no gallery photos are available.

## 7. Background story link

Under the beach ecological-relevance section, add one `Learn more` external link/button to exactly:

```text
https://ourworldindata.org/grapher/share-of-global-plastic-waste-emitted-to-the-ocean?country=PAK
```

Open it in a new tab/external browser using safe external-link attributes (`target="_blank"`, `rel="noopener noreferrer"` on web). Do not add new ecological claims around the link.

## 8. Backward compatibility

Compatibility is one-way:

- old reports/actions may still be read and normalized;
- new reports use quantity bands as canonical state;
- new linked cleanups use remaining bands;
- new standalone cleanups use removed bands;
- exact counts are never required by new participant-facing flows.

Keep compatibility adapters isolated at serialization/normalization boundaries so legacy count semantics cannot leak back into new UI or new API validation.

## 9. Documentation retirement

Mark these exact-count documents as superseded by this design rather than allowing future work to follow them:

- `docs/superpowers/specs/2026-09-15-ai-first-exact-count-reporting-design.md`
- `docs/superpowers/plans/2026-09-15-ai-first-exact-count-reporting.md`

Update active API/OpenAPI/Iteration 2 documentation to describe band-based reporting and cleanup.

## 10. Testing strategy

Use TDD for every behavior change.

Frontend coverage includes:

- no numeric quantity input in report flow;
- AI band suggestions and editable manual fallback;
- Small-only submission messaging;
- cleanup band selectors and all-Small resolved state;
- AI `?` explanation copy;
- litter gallery routing/rendering/empty state;
- approved `Learn more` URL and safe external navigation.

Backend coverage includes:

- new report contract accepts band input while exact-count-only input is retained only as a legacy compatibility adapter;
- Small-only new report does not become Counted/persisted active evidence;
- mixed reports exclude Small categories from active score/composition;
- legacy item-count rows remain readable;
- linked cleanup stores remaining bands, preserves report history, and resolves all-Small targets logically;
- standalone cleanup stores removed bands without altering reports;
- Cleanup Score uses band units;
- duplicate matrix for <10 m / boundary / >10 m, equal vs changed category/band, and resolved targets;
- event generation Moderate/High/Severe vs Low/Insufficient plus idempotency/timezone;
- gallery beach isolation, no exact GPS, no raw photo key, safe signed access, and no cleanup-image persistence.

Regression verification includes backend pytest suites, frontend typecheck/tests/build, configured lint if present, API/OpenAPI consistency, and a repository search for stale active user-facing exact-count phrases.

## 11. Git and rollout discipline

Implementation branch: `codex/iteration2-manual-remarks-20260915`, based on the current `main` that already contains PR #46.

Do not force-push, reset, rewrite history, or overwrite unrelated teammate work. Keep commits grouped by the handoff points and run targeted tests before each commit, followed by full regression verification before a PR is considered ready.

Production deployment is not part of a code commit by itself. Changes should be reviewed through a PR to `main`; merging to `main` may trigger the repository's existing Render deployment workflow, so merge/deployment happens only after verification.