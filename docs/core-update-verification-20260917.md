# Core workflow verification - 17 September 2026

## Local checks

- Baseline backend: 137 passed before changes.
- Updated backend final full run: 149 passed in 122.57 seconds. Contract tests
  use an unavailable model path; real ONNX inference was checked separately.
  The fallback test explicitly supplies an unavailable recognizer.
- A final GPS response consistency correction passed all four report-update
  regressions: creation returns the same current eligibility as the saved row.
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
- Refreshed the details page and verified restored photo preview and edited bands.
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
- PR #50 merged as `f0e1e66`; frontend preview restoration is `2964533`.
- Render confirmed both services live. Warm `/beaches` responses: 1203, 1119,
  1087 ms (median 1119 ms), compared with the 4.6-5.1 s baseline. Activity list:
  4101 ms versus 11.3 s, with no public participant identity arrays.
- Production browser checks: Reports and historical resolved detail load;
  `/reports/mine` requests were 1840-1956 ms. Four map pins and tiles render,
  and no activity request is made before selecting a beach.
- A historical production image was already unavailable; this update does not
  reconstruct previously lost photo bytes.
