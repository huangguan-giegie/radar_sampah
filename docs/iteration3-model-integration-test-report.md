# Iteration 3: 40-species model integration test report

Date: 6 October 2026 (Asia/Seoul).

## Scope and upstream delivery

The model source is [iteration3-model-upgrade](https://github.com/huangguan-giegie/radar_sampah/tree/iteration3-model-upgrade)
at `0397c82f557638a799c377dd6718cf8f4a420604`, model version
`iteration3-upgrade-40-species-20261003`. Before this integration, the website
served the earlier four-model package. The independent branch is imported into
the existing backend package, preserving its weights, training inputs,
inference and provenance without replacing the website deployment configuration.

The API now exposes the 40-species catalog and all 40 scores, with optional
Top-K suggestions. Exact mode preserves the supplied point; explicit nearby
mode selects a frozen marine-grid centre within a fixed 15 km limit and reports
the original point, used point, grid identity and distance. The actual
`/beach/:beachId` route renders `CoastalBeachScreen`, which displays Top 5 and an
expandable all-40 list. Four approved conservation cards and their prepared
questions remain separate from the model catalog.

## Pre-release verification

| Round | Result | Coverage |
| --- | --- | --- |
| Upstream artifacts | Passed | Exactly 40 actual weights; every SHA matches the upstream manifest and validation record. Direct inference matches the 4,227-by-40 saved grid scores. |
| First integrated API focus | 87 passed in 102.28 s | Catalog, score identities, direct/nearby semantics, Top-K, validation and existing API contracts. |
| Final focused regression | 52 passed in 58.71 s | Model upgrade, marine area gate, approved wildlife cards/questions and complete Iteration 3 journeys. |
| Complete backend regression | **275 passed in 255.70 s** | All backend tests, including privacy, reference migrations, evidence, contributions, cleanup, recurrence and existing litter model contracts. |
| First frontend regression | 238 passed in 37 files, 4.61 s; build passed | API options, score semantics, card renderer and existing frontend journeys. Actual browser testing subsequently identified the routed-page omission described below. |
| Final actual-route frontend regression | **243 passed in 38 files, 4.74 s; TypeScript and Vite build passed, 547 ms** | Production CoastalBeachScreen, shared card renderer, all-40 inspection, loading/errors, null coordinates, stale requests, source links and existing screens. |
| Complete local runtime | Passed | Actual ONNX litter detector loaded and returned ready; 40-species registry loaded once; all 56 located beach records returned valid nearby context. |
| Frozen training preparation | Passed | All 157 original training candidates prepared offline; 151 animals and six seagrasses. Serving weights were not retrained. |
| Staged-tree package verification | Passed | Extracted Git index tree, rather than relying on working files; all five input/reference fingerprints verified, 40 weights complete, direct and saved scores consistent. |
| Actual local browser | Passed; console warnings/errors empty | Real routed Kelanang page shows the marine-grid reference, 8.4 km displacement, recommended new species, introductions/sources and More species (40). |

The complete runtime probe used Python 3.12.10 on Windows, the installed website
backend dependencies and real ONNX weights. Cold startup was **10.96 s**;
resident memory after detector inference and 56 nearby predictions was
**401.63 MiB**, peak **406.21 MiB**. These are local measurements, distinct from
Render/Linux capacity. The existing one-worker deployment configuration is retained.

The catalogue contains 86 beaches: 82 export entries and four core beaches.
All **56 located records** (52 export plus four core) returned 40 rows within the
15 km limit. The other **30 export entries remain unlocated**; the frontend
skips inference and explains that coordinates are needed. The coordinate
sources are documented separately in [52-coordinate source register](beach-coordinate-sources-52.md).

## Failures found and corrected

- The initial pytest invocation could not use Windows' shared temporary test
  directory. Tests were rerun with a fresh workspace-local temporary directory.
- Two old shoreline tests expected silent tolerance in exact mode. The new
  model correctly rejects Kelanang's land-side point. Tests and the real beach
  request now require explicit nearby mode and verify disclosed displacement.
- The first frontend work targeted the legacy BeachScreen. Real browser
  inspection exposed that App routes to CoastalBeachScreen. A shared model
  component was connected to that actual route, with route/component regression
  tests and a second full frontend run.
- The first actual-route build used a Node filesystem import in a browser test
  without Node types. It was replaced by the existing Vite raw-source import;
  the complete frontend suite and production build were rerun successfully.
- The first memory-probe output used an incorrectly typed Windows process
  handle. The probe was corrected and rerun with the real detector loaded.
- Git's newline conversion initially changed a frozen EEZ input in the staged
  tree, although working-directory package verification passed. Byte-preserving
  attributes and explicit re-normalisation preserve the upstream bytes;
  verification of an extracted staged snapshot subsequently passed.

## Interpretation and limits

Raw relative-occurrence scores are uncalibrated historical model scores.
Location match is a within-species reference percentile. Cross-species Top-5
accuracy, current beach sightings and ecological abundance have not been
independently validated. The UI identifies these limits and retains all raw
scores for inspection.

The package has no photographs. The website uses its four existing licensed
images by exact scientific identity and neutral category icons for other
species. Insights uses the returned percentile order but only links to the
four approved conservation cards, preventing missing new-species answer pages.
Model calls do not write coordinates/results or affect litter severity. Local
fixtures establish database independence; production tests create no public
reports, joins, attendance or cleanups.

## Actual local screenshots

Captured from the running website and backend on 6 October 2026; these are
pre-release local evidence, not deployed-site screenshots. The viewport shows
the first visible cards/list rows; the DOM and API checks establish all 40 rows.

![Actual routed beach page showing nearby marine context and new species](screenshots/iteration3-model-local-top5.jpg)

![Expanded 40-species result list with distinct raw and location-match scores](screenshots/iteration3-model-local-all40.jpg)
