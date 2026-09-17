# Core workflow update - 17 September 2026

## Approved decisions

This update follows the current deployment and independently reproduced defects,
not the pass/fail totals in the earlier acceptance reports. Baseline: `a90f082`.
The baseline backend suite passed 137 tests before changes.

- New reports follow photo, beach selection, recognition, participant review or
  manual correction, final review, and submit. Category and band entry must not
  be a prerequisite for recognition. Existing reports can be corrected without
  rerunning recognition unless the photo changes.
- Every submitted value is confirmed by the participant. Recognition failure,
  empty output, and a 15-second client wait offer manual entry without losing
  the photo or beach. The client wait is not a claim that server inference is
  forcibly terminated.
- All-Small new reports and corrections return `422 SMALL_ONLY_REPORT` without
  saving the attempted change. An all-Small cleanup resolves the target but
  preserves the source report, photo, and cleanup audit history. This supersedes
  destructive deletion wording in TD-2 and AC2.4.4.
- `currentState` (`active`, `resolved`, `excluded`) describes current eligibility
  independently of the original `Counted`, `Duplicate`, `Incomplete` decision.
  Resolved reports must not be presented as contributing to the current score.
- Successful check-in for a joined participant within the existing location and
  activity-time boundaries records attendance immediately and idempotently.
  No report, cleanup evidence, or additional confirmation tap is required.
- Shared report links refer to the selected report permanently. Event-only
  links never substitute the most recent report at that beach. Public activity
  and share responses expose counts, not other participants' identifiers,
  check-ins, or evidence maps.
- The location check uses a one-metre privacy grid around an approximately
  ten-metre boundary. Quantization can extend matches by roughly one cell
  diagonal; this is not centimetre-accurate positioning. Raw GPS is not retained.
  A different nearby category/band updates the privacy reference; it does not
  replace the original report or require a `replaced` record status.
- Ordinary photos are EXIF-stripped, resized, encoded as JPEG, and stored
  privately in PostgreSQL with a `reports.photo_key` reference. They survive
  redeployment. After-cleanup images remain ephemeral. No object-storage
  migration or paid hosting change is part of this release.
- `latestContributingReportAt` comes only from active eligible reports within
  the 90-day scoring window; `lastReportedAt` remains the historical observation
  date. Neither a missing report nor a resolved target proves the beach clean.
- Automatic events remain server-generated under the severity rule, with at
  most four upcoming automatic events per beach. Moderator-created activities
  are separately identified. An idempotent public read trigger is not a
  participant-controlled event-creation permission.

## Performance and regression targets

Batch all-beach report and cleanup reads; avoid per-report photo metadata and
cleanup queries. Cache only public beach summaries in the frontend, deduplicate
in-flight reads, and invalidate them after successful report or cleanup writes.
Map points must not wait for activity or cleanup-target requests.

Reference live measurements before the update: `/beaches` 4.6-5.1 seconds,
`/cleanup-events` 11.3 seconds, `/reports/mine` about 2 seconds for one report.
The local query probe recorded 8 SELECTs for four beach summaries, 22 for the
activity list, and 14 for twelve personal reports. These are observations, not
load-test guarantees. Target a warmed median of at most two seconds for beach
summaries and a cached return to the map within one second; record cold starts
separately.

Verify AI success and fallback, draft preservation, report correction, GPS
storage privacy, resolved history, freshness, stable shares, automatic
attendance, double join, and conflicting cleanups. Check 390x844 and 320x844
layouts, console and failed requests. PostgreSQL locking must be checked against
PostgreSQL, not inferred from SQLite.

## Evidence policy

Earlier deployment/persistence evidence exists outside the tracked runtime.
Its existence must not be confused with complete evidence for this release.
Record fresh test results, build versions, screenshots, and public smoke checks
in the release verification record. Keep measured results distinct from targets
and explicitly identify anything not verified. No model test-set metric may be
invented from validation metrics.

Deferred: Iteration 3 recurrence prediction, contribution points, badges, and
leaderboards. No broad redesign or framework replacement is required.
