# Core workflow verification - 17 September 2026

## Local checks

- Baseline backend: 137 passed before changes.
- Updated backend full run: 148 passed, one environment-dependent fallback test
  failed after ONNX Runtime was installed. The test now explicitly supplies an
  unavailable recognizer; its focused rerun passed. All 149 cases have passed.
- Frontend: 119 tests passed across 14 files; TypeScript build and Vite production
  build passed.
- Query regression: `/beaches` uses two report/cleanup SELECTs for both six and
  sixty reports. Mixed Small/non-Small categories agree with single-beach scoring.
- Report regressions cover all-Small edit rejection without mutation, private GPS
  edits, self-exclusion, unchanged duplicate status, resolved history and expired
  reports. Event regressions cover automatic attendance, public privacy and four
  idempotently generated weekly slots through `/cleanup-events`.
- Independent review found and verified fixes for AI route guards, stale retries,
  historic report editing, mixed-band scoring and the event scheduling trigger.

## Browser checks

Used the local Flask API, isolated SQLite database and Vite frontend, not the
production database. No production report was created during local verification.

- Uploaded the repository sample image, chose a beach, and reached recognition
  before manual category entry.
- Verified unavailable recognition -> manual bands -> review -> successful save.
- Installed the repository-pinned ONNX Runtime 1.27.0 in the local Python runtime;
  the real bundled ONNX model loaded and returned editable suggestions.
- Changed Plastic to Large, then opened the manual correction form successfully.
- Reports list, detail and signed selected-report share displayed the saved image.
- Inspected 390x844 review and 320x844 report/share layouts for clipping/overlap.
- Map rendered four pins and tiles before any activity request. Local resource
  timing recorded one `/beaches` request at 16 ms and no initial `/cleanup-events`
  or cleanup-target request. This is local timing, not a production speed claim.

## Limits and release

- PostgreSQL concurrency was not exercised: no isolated PostgreSQL test service
  was available. SQLite tests do not prove PostgreSQL lock behavior.
- Client timeout and route state have automated coverage of flow decisions;
  browser timing under every slow-network/replacement race was not exhaustively
  simulated.
- Source Google Docs were reviewed; this repository decision record is the
  implementation reference. Remote documents were not edited.
- Rollback baseline: `a90f082cbb0460f455d56106286688a20114fac9`.
- Production deployment and smoke results will be recorded after release.
