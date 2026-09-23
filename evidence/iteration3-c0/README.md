# AC9.4.1 — QA evidence pack index

This folder assembles the evidence location for Iteration 3 C0. It does **not**
turn missing evidence into a pass.

## Existing evidence that can be reused

- `docs/core-update-verification-20260917.md`: local checks, production browser
  observations, request timing, map/event request behaviour, and known limitations.
- `docs/iteration2-usability-fix-status-20260917.md`: 18 September acceptance-test
  follow-up and the open/partial criteria carried into C0.
- GitHub Actions Iteration 3 integration runs: automated backend suite plus frontend
  typecheck, Vitest, and production build.

## Evidence still required before AC9.4.1 may be marked Pass

- [ ] request/response capture for the C0 routes and fields
- [ ] screenshots of each repaired UI state
- [ ] public smoke-test record against the deployed release candidate
- [ ] 390×844 layout captures
- [ ] 320×844 layout captures
- [ ] browser console record
- [ ] browser network record, including failed/offline case
- [ ] blocker list with owner
- [ ] retest result for every blocker

Store screenshots/captures in this folder (or link immutable team evidence) and
record the exact build/commit SHA. Do not substitute descriptions for captures.
