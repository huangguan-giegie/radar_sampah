# Production QA Fixes — 6 October 2026

## Scope and release status

This follow-up addresses the findings in `Production_QA_Report_2026-10-06.docx`
against the corrected Iteration 3 acceptance criteria. The original report is
retained as a record of the deployed version observed before these repairs.

The changes below are deployed to both production services. PR #71 was merged
as commit `bce433963da233a495c7f0f0c90c5216d5dd0981` on 6 October 2026.
Targeted production verification passed for the affected browsing and display
flows. This is a repair verification record, not a new exhaustive AC audit.
Local checks used an isolated SQLite database and synthetic test photos; those
records are not production evidence and are not included in the release.

## Production release

| Service | Release status | Deployment | Completed |
|---|---|---|---|
| Frontend | Live at the release commit | dep-db2a6amq1p3s73eemm7g | 6 October 2026, 16:29:11 KST |
| Backend | Live at the release commit | dep-db2a6amq1p3s73eemm2g | 6 October 2026, 16:32:10 KST |

- [Merged PR #71](https://github.com/huangguan-giegie/radar_sampah/pull/71)
- [Production Home](https://team04-marine-observation-frontend.onrender.com/home)
- [Production API health](https://team04-marine-observation-api.onrender.com/health): `ok`.
- Both deployments were triggered automatically by the merge to `main`.

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

## Local browser inspection

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

## Production browser verification

The production site was inspected at a 390 × 844 mobile viewport and a
1280 × 900 desktop viewport. The following observations use the deployed
frontend and production API. Screenshots are saved in
`evidence/redeploy-qa-2026-10-06/production-repair` and embedded in the companion
English Word report. The Home capture excludes the participant identifier.

| Check | Result | Evidence |
|---|---|---|
| Home-to-list navigation | Pass. Explore Beaches appeared while loading. After loading, See Other Beaches opened the list directly in a signed-in session, without an automatic personal panel taking over. | P01–P03 |
| Catalogue and search | Pass. The live API and unfiltered list both contained 86 beaches; the 85-entry regression fixture remains valid. Morib search opened its detail page. | P02–P04 |
| Missing coordinates | Pass. Pulau Tulai Beach II remained searchable and its detail page loaded with honest empty-data states. It has no verified distinct marker. | P15–P16 |
| Needs Volunteers | Pass. Activity cards loaded and Low Remis was excluded. Browser network capture recorded one GET to `/cleanups/latest-by-beach`, returning HTTP 200; the endpoint returned 86 beach dates. | P06 |
| Gallery limit | Pass. Morib's gallery displayed 5 available photos, including historical resolved photos. Ranking, eligibility and hidden-link privacy are additionally covered by backend tests. | P04–P05 |
| Evidence insights | Pass. The overview included Evidence. Navigation opened at the top. Four pilot beach cards showed Active, Resolved, Duplicate and Incomplete counts, active eligible counts, sufficiency and latest contributing dates. Coverage displayed 4 of 4. | P10–P11, P17 |
| Severity and ranges | Pass. Overview displayed Severe and the method page showed all four exact AC boundaries. | P09, P12 |
| Event context and disposal | Pass. Current Beach Attention and the retention policy displayed. Disposal guidance stated that locations are unconfirmed, with no invented location/date or unusable map action. | P07–P08 |
| Map visual inspection | Pass. Selangor displayed all four pilot beach names, band markers, tiles and a usable regional list. | P13–P14 |
| Runtime errors | No browser error logs were captured during these checks. A focused Render error-log query after the backend went live returned no errors. | Browser and Render log observations |

### Production screenshot index

| Capture | Observed result |
|---|---|
| P01 — Home entry | Featured beach and See Other Beaches on the repaired mobile Home; participant identifier excluded. |
| P02 — Complete beach list | The searchable list opens directly from Home. The rendered list contains 86 API beaches. |
| P03 — Morib search | Search narrows the list to Pantai Morib with its activity link. |
| P04 — Morib detail | Search selection opens the detail page; repaired gallery and beach context load. |
| P05 — Gallery | The live gallery displays 5 available photos and retains resolved history. |
| P06 — Needs Volunteers | Activity groups render without a cleanup-history error. |
| P07 — Event context | The activity, participation action, current band and scheduling retention context render. |
| P08 — Disposal guidance | Explicit unconfirmed drop-off details replace the placeholders. |
| P09 — Severe wording | The overview displays Severe in a recorded band-change card. |
| P10 — Topic navigation | All five AC topics and the volunteer shortcut fit the mobile grid. |
| P11 — Evidence mobile | Coverage and real lifecycle counts render; navigation starts at the top. |
| P12 — Score boundaries | Low, Moderate, High and Severe use the exact AC ranges. |
| P13 — Regional map | Selangor tiles, four beach labels, band markers and list entry are visible. |
| P14 — Regional list | The four pilot beaches remain accessible from the map. |
| P15 — Beach without coordinates | Pulau Tulai Beach II appears in search alongside the other Pulau Tulai beach. |
| P16 — Empty beach detail | The beach without coordinates loads with no photo, insufficient-data and no-report states. |
| P17 — Evidence desktop | The real Evidence page renders in the wider viewport. |

## Verification limits

The production checks were read-only: no reports, photo uploads, joins, check-ins
or cleanup records were submitted. Failure/retry states and hidden-photo access
were covered by automated tests rather than forced production failures. The
original Remis event's creation-time band is still not established; existing
events and registrations remain under the documented retention policy. Disposal
locations remain unconfirmed until real local arrangements are supplied.

## First-visit location prompt repair

The earlier production pass began from an already-dismissed location prompt, so
it did not cover the first-visit state. On a fresh local browser session, loaded
Leaflet panes could sit above the prompt because the decorative `MiniMap`
container did not establish a stacking context. The prompt remained in the DOM,
but the map layer could obscure its controls.

The repair gives the `MiniMap` root an explicit `z-index: 0`, keeping Leaflet's
internal panes inside the background layer while the prompt's existing content
layer remains above it. A focused SSR regression protects this style contract.

The fresh local browser check loaded real OpenStreetMap tiles and showed the
complete `Find Beaches Near You` card, including `Allow Location`, `Not Now` and
the explanation control, above the map. Selecting `Not Now` returned to Home
with the bottom navigation visible. The list/detail continuation is covered by
the existing production QA captures; the local API returned a transient beach
list loading error during this isolated check and no production data was changed.
