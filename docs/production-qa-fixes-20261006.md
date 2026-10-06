# Production QA Fixes — 6 October 2026

## Scope and release status

This follow-up addresses the findings in `Production_QA_Report_2026-10-06.docx`
against the corrected Iteration 3 acceptance criteria. The original report is
retained as a record of the deployed version observed before these repairs.

The changes below have been implemented and checked locally. Production
deployment and production browser verification are pending. Local browser
checks use an isolated SQLite database and synthetic test photos; those records
are not production evidence and are not included in the release.

## Findings and resolution

| Finding | Cause | Resolution |
|---|---|---|
| QA-01 — Needs Volunteers fails to load cleanup history | The screen requested a complete latest-cleanup object for every beach at once. One failed or timed-out request rejected the entire result. | A public batch endpoint returns only the latest cleanup date for each beach, using two SQL queries regardless of catalogue size. The screen makes one history request and retains loading, failure and Retry states. Targeted and standalone cleanups both contribute. |
| QA-02 — Highest band and score ranges differ from AC | A shared display helper renamed `Severe` to `Very high`; frontend and backend method text used incomplete ranges. | Use `Severe` consistently in labels, legends and explanations. Publish exact AC boundaries in both method sources. Calculation thresholds remain unchanged. |
| QA-03 — Gallery displays 15 photos | The gallery returned all Counted reports ordered only by submission date. | Filter eligible photos before taking the highest five original Report Scores; newest submission wins ties. Exclude all-Small, Duplicate, Incomplete, missing photos and hidden reports. Preserve historical resolved photos. Previously issued signed links stop serving a report when it is hidden. |
| QA-04 — Evidence is absent from Insights | The overview and topic navigation omitted Evidence; its routes redirected to the scoring method. | Restore Evidence navigation and routes. Render the existing aggregate's four lifecycle/status counts, a stacked bar, eligible report count, latest contributing date, sufficiency, freshness and pilot coverage. Include zero-report, missing-data, loading and retry states. |
| QA-05 — A Low beach still has an upcoming event | The established event lifecycle preserves planned activities when a band's value falls; current eligibility controls new scheduling. | Keep existing activities and registrations. Show current Beach Attention and explain the retention policy. Regression checks protect the four-Saturday rule, qualifying bands, idempotency and retention when the band drops. The particular production Remis event's creation-time band was not established. |
| QA-06 — Event disposal guidance contains placeholders | The shared guide held template names and an unfilled verification date, with a disabled map button. | Show an explicit unconfirmed-location state and appropriate local-council guidance. Omit map navigation when no real destination is configured. No disposal point or verification date is invented. |
| QA-07 — Beaches are difficult to access from Home | The browsing entry was hidden until featured beach data loaded. It opened region counts instead of beach names, and an automatic personal-insights popup could replace a requested list. | Keep an Explore Beaches entry available during loading and failure. See Other Beaches opens the complete searchable beach list directly. Explicit panels take priority over automatic personal insights. The list displays its own loading and retry states and includes beaches without map coordinates. |

The static species FAQ heading now reads **Read answers**, matching its prepared,
sourced content. The excluded quiz, beach-specific risk cards, weekly activity
and first-cleanup badge remain outside this repair scope.

## Verification

- Frontend: **276 tests passed across 45 files**; production build and TypeScript
  checks passed.
- Backend: **288 tests passed**, complete regression run, in **344.06 seconds**.
- Focused regression evidence includes gallery ranking and signed-link privacy,
  public cleanup-history batching, exact severity wording, Evidence navigation
  and lifecycle data, missing disposal details, event eligibility/retention,
  and Home-to-beach-list navigation with the expanded 85-beach catalogue.
- An independent code review found the hidden-photo eligibility gap; it was
  repaired and its focused regression passed before the final integrated run.

## Browser inspection

The repaired frontend was exercised against the local API at a **390 × 844**
mobile viewport. Captures are available inline in the working conversation;
they are not embedded in this text record.

| Capture | Observed result |
|---|---|
| R01 — Evidence, desktop | Real pilot aggregates, report status legend and sufficient-beach count rendered. |
| R02 — Needs Volunteers, mobile | Activity groups loaded; no cleanup-history error. The Low test beach was excluded from priorities. |
| R03 — Event detail, mobile | Current band and the existing-activity retention explanation rendered with the Join action intact. |
| R04 — Event drop-off section, mobile | No template names/date and no unusable map button; explicit unconfirmed details rendered. |
| R05 — Gallery, mobile | Exactly five available photos from eight eligible local test reports. |
| R06 — Insights overview, mobile | All five AC topics plus the volunteer shortcut rendered in a readable two-row grid. |
| R07 — Evidence entry navigation, mobile | The new topic opens at the top; the coverage number and report details fit the narrow viewport. |

The live scoring-method text was also checked against all four exact AC ranges.
These local observations do not establish the production release status.

## Deployment dependency

Deploy the backend containing `/cleanups/latest-by-beach` before, or alongside,
the frontend that consumes it. Confirm both services use the release commit,
then repeat the six affected production flows. Do not rewrite existing event
registrations or replace production photos as part of this release.
