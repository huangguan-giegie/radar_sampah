# Team 04 Actual Project PM Context

## Current decision

The group selected **Idea 1 Version 2**: marine litter is the only reporting
flow, while an OBIS marine-life map layer supplies ecological context. The MVP
will freeze one Malaysian coastal area and a small litter-category list.

The system must not claim that it proves pollution sources, exact threatened
species locations, or environmental outcomes. Use public or synthetic data and
label illustrative rules clearly.

## Active implementation contract - 14 August 2026

- The deployable MVP flow is Report -> Review/edit -> Confirm -> Results.
- Supported litter categories are Plastic packaging, Fishing gear, Glass,
  Metal and Other.
- The API contract is `/health`, `GET/POST /api/observations` and
  `GET /api/context`.
- Render storage uses PostgreSQL through `DATABASE_URL`; local development
  falls back to SQLite when it is not set.
- The map uses Leaflet/OpenStreetMap with an accessible list fallback. Marine
  context is a static, source-labelled OBIS sample; sensitive locations are
  masked or aggregated.
- Classification uses fixed-category rules. Priority is illustrative and must
  never be presented as pollution-source proof or enforcement advice.
- External AI and CV are disabled. Observation image input is an optional demo
  asset path or HTTPS URL; raw files are not stored.
- HealthFirst remains a reference-only archive. No health fields, thresholds,
  medical tables or medical AI logic are used by the marine runtime.

## Spaces created

- GitHub: https://github.com/huangguan-giegie/team04-marine-observation-mvp
- Miro: https://miro.com/app/board/uXjVHySKbPY=/
- Drive: https://drive.google.com/drive/folders/18Px2njE27SCiZ4bs-40zgUgm_sRE70Kx
- Render: project `Team 04 Marine Observation` and free API/frontend services
  created from `main`.
- LeanKit: the existing HealthFirst board is preserved. The PM has decided to
  defer the new-board setup for now; no LeanKit board changes are required in
  this migration.

## Work completed

- Created `realwork/` with actual-project docs, references and migration manifest.
- Replaced the starter with the complete marine MVP: Flask API, PostgreSQL/
  SQLite schema, static OBIS context, rule-based classification/priority and a
  three-step accessible frontend with Leaflet plus list fallback.
- Added `render.yaml` for free API and static-site services; local verification
  passed backend tests (10/10), frontend workflow tests (8/8), syntax checks,
  API smoke checks and `git diff --check`.
- Pushed the complete project to the new GitHub repository (`main`, commit
  `c2f3dae66c6a5caea088537a0afa0b92db318ca9`).
- Pushed the adapted governance and presentation deliverables in commit
  `f9b5dc4926cc07028bc3e013e344b6d1531531f1`. This is documentation/PPTX
  only; the deployed runtime code remains the verified `c2f3dae` build.
- Invited the five confirmed team GitHub accounts (`hlii0333`, `hnin0011`,
  `kcho0072`, `qjia0033-dev` and `SUBENSHUAI`); all are currently pending
  acceptance.
- Created five Drive folders and uploaded the rewritten governance docs, the
  starter frontend/backend folders and selected HealthFirst materials under a
  clearly labelled reference folder.
- Created and named the new Miro board. The old HealthFirst Miro board remains
  unchanged. The new board now has three concise cards: current scope, MVP
  flow and open decisions.
- Added the adapted deliverable set under `deliverables/`: project information,
  social contract, work-plan handover, QA/deployment checklist, Miro reflection
  notes and a 19-slide Marine Observation onboarding deck. These use the old
  deck/document structure but contain only the marine MVP scope.
- Uploaded the DOCX/Markdown sources to the new Drive Governance/Evidence
  folders and the PPTX to the new Design folder. The file IDs and links are
  recorded in `drive-migration/MIGRATION_MANIFEST.md`.
- Imported a native editable Google Slides copy into `03 Design` and verified
  its outline contains all 19 slides; the original PPTX remains there as the
  downloadable source copy.
- The latest `main` also records this editable-slide handoff in commit
  `022f9f732f19238b8c9c3db6b444f3c6e40fa9a2`.
- Generated DOCX copies from the Markdown sources and checked their paragraph,
  table and package structure. LibreOffice 26.2.5.2 is now installed and the
  five DOCX files were exported to PDF and inspected as page PNGs. The current
  files are readable, have no blank pages or clipped tables, and keep the
  Marine-only scope. The 19-slide PPTX was regenerated and rendered through
  LibreOffice plus artifact-tool; no unintended overlap or overflow was found.

## Next actions

1. LeanKit setup is deferred by the PM; do not modify the old HealthFirst
   board.
2. Keep the GitHub, Drive, Miro and Render links in sync as the MVP evolves.
3. Keep the verified `deliverables/` DOCX and PPTX files aligned with the
   Drive Governance/Design/Evidence folders; the quality-upgrade overwrite
   record and local backup are in the migration manifest.

## Quality upgrade record - 14 August 2026

- Approach: reuse the HealthFirst reference skeleton (narrative order,
  hierarchy, spacing, footer and page markers) while rewriting all visible
  content for Marine Observation and retaining the navy/teal/sand theme.
- Local backup: `realwork/tmp/backups/quality-upgrade-2026-08-14/`, with
  SHA-256 manifest in `backup-sha256.csv`.
- Runtime source of truth remains `c2f3dae`; no runtime code or database
  contract was changed in this presentation/document pass.
- QA evidence: five DOCX files rendered with LibreOffice to PDFs/PNGs (17
  pages total); the 19-slide deck rendered with LibreOffice and artifact-tool
  with no overflow; backend tests passed 10/10, frontend workflow tests passed
  8/8, syntax checks and `git diff --check` passed; deployed smoke endpoints
  returned 200/201 using synthetic data and the frontend returned 200.
- Drive raw DOCX/PPTX files are updated in place after the local QA gate so
  their existing file IDs and links remain stable. The native editable Slides
  copy is retained as a separate handoff because Google-native presentations
  cannot be replaced with raw PPTX bytes in place.

## Verification snapshot — 14 August 2026

- Render project page is reachable at
  `https://dashboard.render.com/project/prj-d9uverdbedkc73b6p130`.
  GitHub App access now lists both `healthfirst-team04-mvp` and
  `team04-marine-observation-mvp`.
- Free Render services were created from `main`:
  - API dashboard: `https://dashboard.render.com/web/srv-d9v00r3ncjis73amjvi0`
  - API URL: `https://team04-marine-observation-api.onrender.com`
  - Frontend dashboard: `https://dashboard.render.com/static/srv-d9v01afqj5pc738lpi5g`
  - Frontend URL: `https://team04-marine-observation-frontend.onrender.com`
  The frontend and API deploy logs both report that the services are live from
  `c2f3dae`. The API service now has `DATABASE_URL` and `FRONTEND_ORIGINS`
  configured in Render; the URL value is intentionally not recorded here.
  External smoke checks passed: `GET /health` and `GET /api/context` returned
  200, a synthetic `POST /api/observations` returned 201 with the expected
  classification and illustrative priority, `GET /api/observations` returned
  the saved record, and the frontend returned 200. The browser flow also
  passed Report → Confirm → Results against the deployed services.
- LeanKit home at `https://monashie.leankit.com/` still exposes the existing
  Team 04 board but no board-creation control. The old board was not renamed,
  edited or reused for the actual project.
- The actual Miro board and Drive destination remain available and were
  reopened for handoff during this check.

## Drive re-scan update — 14 August 2026

The old HealthFirst Drive space was checked again, including the user-provided
course-plan PDF and Team Information document. Additional folders found were
Team Formation, Design Artefacts, System Architecture, Iteration Build, Data
Governance, Others, Feedbacks and Retrospective. These contain HealthFirst
personas, epics/user stories, architecture diagrams, draft governance, mentor
feedback, peer-review videos and retrospective evidence.

The Team Information DOCX was archived locally and uploaded unchanged into the
new Drive's `99 Reference - HealthFirst Example` folder. The course-plan PDF,
raw videos and cross-team evidence remain source-only because they are not
marine-project artefacts and some are shared-folder material. The migration
manifest records the source links and classification. No old Drive file was
deleted, renamed or edited.

The new Drive root now contains `README.md`, which explains the purpose and
usage of every project folder, the GitHub/Render workflow, and the HealthFirst
reference boundary.

The previously missed `TM04 Team Info` Google Doc was checked, exported
unchanged and added to the reference archive under `Team Formation`. It is
HealthFirst reference material, not a marine-project requirement.

The direct Slides link for `HealthFirst Expo Slides` was checked and compared
with the existing Week 2 deck. It is a separate 13-slide HealthFirst Expo
presentation, so it was exported unchanged and uploaded to
`99 Reference - HealthFirst Example` as `HealthFirst Expo Slides - original.pptx`.
It remains reference material only; it is not evidence for the marine project.

The second old-root deck, `TM04 Onboarding Project Presentation`, was also
copied unchanged into the same reference folder as `TM04 Onboarding Project
Presentation - original`. It is kept as a source reference and is not part of
the marine-project scope.

## PGIE structure alignment record - 14 August 2026

To make handover easier, the Real Project Drive root now contains the same
named PGIE folder layers as the Sample Project while retaining the original
numbered Real folders as legacy navigation shells. The aligned tree includes Team Information, Testing,
Team Meeting, System Architecture, Others, Iteration Build, Security Aspects,
Design and Analysis Artifacts, Risks, Retrospective, Feedbacks, Industry Mentor
Communications, Handover and Data Governance, plus the matching nested design,
handover and analysis/dataset folders.

The Sample Project was not changed. Its datasets, analysis files and template
placeholders were copied into the matching Real locations as reference
material. Marine-specific supplements were added alongside them: a data
dictionary, analysis notes, synthetic observations CSV, source-labelled OBIS
context JSON, runtime API/DMP/decisions/scope/checklist notes and the Marine
team-information file. The copied HealthFirst material is not read by the
Marine runtime and must not be used as Marine evidence.

The Real root also has the current Miro link. A `team reflection vedio - pending`
item records that an approved recording is still required; no invented video or
test evidence was added. The migration manifest and root README describe this
boundary and the preserved numbered structure.

## Canonical Drive path update - 14 August 2026

The active deliverables have now been moved to the Sample-style folders so the
team can use one clear path: Team Information, Retrospective,
Handover/Implementation Plan, Testing, Design and Analysis Artifacts and
Iteration Build. The migration manifest and PM context are at the Real Project
root. File IDs and links were preserved when the files were moved.

Older duplicate Marine drafts were moved to the root folder
`Archive - Superseded Marine Drafts` and marked `ARCHIVE -`; they are not
current evidence. The numbered folders remain only as legacy navigation shells,
while the mirrored tree is the canonical working structure. The Sample Project
folder remains unchanged.

## Public dataset integration record - 14 August 2026

The Marine runtime context bundle was refreshed from a bounded public OBIS
occurrence query covering the Malaysian-region demonstration area. Five records
are stored in `actual-project/backend/data/obis_context.json` with retrieval
date, source URL, attribution note and coarse aggregated coordinates. The
bundle version is `obis-malaysia-public-2026-08-14-v1`.

The same JSON was updated in the Real Project Drive `Datasets` folder and is
seeded into the `marine_context` table at API startup. The deployment still
uses static public context rather than live OBIS requests; the records support
source-visible demonstration context only and do not prove species identity,
pollution source or enforcement outcomes.
