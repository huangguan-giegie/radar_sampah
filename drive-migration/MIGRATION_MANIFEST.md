# Migration Manifest

## DiveSafe MY alignment — 15 August 2026

The active documentation name is **DiveSafe MY**. This is a naming and
governance alignment, not a migration of the deployed implementation. The
current GitHub repository and Render services retain their legacy marine
observation/litter names because those are the hosting identifiers currently
connected and tested. The current code also contains the DiveSafe MY flow;
legacy litter routes remain compatibility paths.

| Iteration | Migrated/recorded outcome | Boundary |
|---|---|---|
| 1 | Scope, team roles and source/safety decisions. | No runtime feature claim. |
| 2 | Runnable DiveSafe MY profile, site, briefing and synthetic-sighting flow. | Legacy repository and Render identifiers remain active. |
| 3 | Integration evidence, source register and documentation alignment. | Optional recognition is illustrative; enforcement remains out of scope. |

The source register for Benshuai Su includes the [OBIS Malaysia-region
query](https://api.obis.org/occurrence?geometry=POLYGON((99%203,105%203,105%207,99%207,99%203))&size=50) and
the [CEFAS/Defra CLiP vocabulary](https://environment.data.gov.uk/dataset/faaf9538-2665-48c9-afc2-b976daa77cd2).
They support static source-labelled examples only. Approximate areas and
derived priorities are not survey evidence, incident dispatch, attribution or
enforcement decisions.

## New destination

Real Project Governance Portfolio (PGIE):
https://drive.google.com/drive/folders/18Px2njE27SCiZ4bs-40zgUgm_sRE70Kx

New project spaces:

- GitHub: https://github.com/huangguan-giegie/team04-marine-observation-mvp
- Miro: https://miro.com/app/board/uXjVHySKbPY=/
- Render: project and free API/frontend services created and verified
- LeanKit: new board deferred by PM; old board unchanged

## Existing example project

HealthFirst Onboarding Project:
https://drive.google.com/drive/folders/1ttA6TrMmV_lF-OQ8EmL6g7DSkd9mrkpS

The HealthFirst material remains preserved. It is not the new product scope.

## Selected material to carry forward

| Source material | Migration decision | New use |
|---|---|---|
| Team 04 social contract | Copy unchanged as governance reference | Team working agreement |
| Team information document | Adapt role names and project title | New team/project information |
| Miro reflection speaking notes | Copy as facilitation template | Future retrospective |
| DMP/security/integration checklist structure | Rewrite for marine observations | Actual project governance |
| LeanKit workflow pattern | Recreate with new epics/stories | Actual project planning |
| GitHub branch/PR workflow | Recreate in a new repository | Actual source control |
| Render deployment pattern | Recreate only after the new repository exists | Actual MVP deployment |
| HealthFirst deck, ERD and screenshots | Preserve as reference only | Do not reuse as actual product evidence |

## Runtime migration boundary

The new marine MVP reuses only general project patterns from the HealthFirst
example: a staged report/review/results flow, frontend/API separation,
validation and error handling, deployment documentation, test evidence and
clear safety wording.

The new runtime does not copy HealthFirst product logic. It does not use
medical input fields, BMI, clinical thresholds, health-risk assessment,
health-specific PostgreSQL tables, medical action cards or external medical AI.
Those materials remain under `references/healthfirst-example/` as read-only
examples.

The marine runtime target is a Flask API with PostgreSQL on Render plus a local
SQLite fallback, a static frontend, static source-labelled OBIS context,
Leaflet/OpenStreetMap and transparent category/illustrative-priority rules.
Database credentials remain Render environment variables, not migration files
or Git history.

## External resources to create

- New GitHub repository for the marine project.
- New Render frontend/backend services after the repository is ready.
- New Miro board for the actual project's discovery and reflection.
- New LeanKit board/cards for the actual project (deferred by PM; old board
  remains unchanged).
- New Drive subfolders for scope, governance, design, build and evidence.

## Current handoff status — 14 August 2026

GitHub, Drive, Miro and Render are created and verified. LeanKit setup is
deferred by the PM because the current account has no board-creation control.
The original HealthFirst spaces remain unchanged.

## Drive re-scan — 14 August 2026

The old HealthFirst shared folder was re-scanned through the signed-in Drive
session. The scan found more material than the first selected-reference list:

| Old location | Files or folders found | Decision |
|---|---|---|
| Team Formation | `Team 04 – HealthFirst Team Information.docx`, `TM04 Team Info`, `Group picture.jpg` | The original DOCX was copied into the local reference archive and uploaded to `99 Reference - HealthFirst Example`. The Google Doc and photo remain source-only references. |
| Design Artefacts | `Epics, User Stories`, `Persona_Mr_Lim_Wei_Jian.pdf`, `problem statement`, `Empathy_Map_Mr_Lim.pdf` | HealthFirst-specific; preserve as reference only. Do not use the persona or claims as marine-project evidence. |
| System Architecture | `System Architecture.svg` | Preserve as a technical-diagram reference only. |
| Iteration Build | `HealthFirst OB Project Development` | Preserve as a development-process reference only. |
| Data Governance | Draft governance document, `Peer Review for TM03`, `Usability Testing from TM03`, `Datasets & Analysis` | The draft is HealthFirst-specific. Cross-team folders and videos remain in the old source space; they are not copied into the marine project. |
| Others / Feedbacks | `Idea Generation`, `Mentor's Feedbacks` | Preserve as source references; no marine decisions are inferred from them. |
| Retrospective | Zoom recordings, `Miro Board Link`, `HealthFirst Retrospective Miro Board.pdf`, `Team04_Miro_Reflection_Speaking_Notes.docx` | The speaking-notes template was already selected; recordings remain source-only because they contain HealthFirst-specific discussion. |
| Old-folder root | `HealthFirst Expo Slides`, `TM04 Onboarding Project Presentation` | Preserve as reference only; the actual marine project has its own GitHub, Render, Miro and Drive spaces. |

Two user-provided links were checked directly:

- Course plan PDF: [FIT5120_Work_Plan_English.pdf](https://drive.google.com/file/d/1M77x8psaQ_E5XhwDgGP52cPEY5t8CHhc/view?usp=drive_link). It is a 22-page course/deadline guide, not a product artefact. Keep the source link; do not copy course-wide instructions into the marine scope.
- Team information document: [Team 04 – HealthFirst Team Information](https://docs.google.com/document/d/1ewGaDQvGQbnLW1Q3UvoVHeYL5LNrF0zf/edit?usp=drive_link). An unchanged DOCX copy is archived locally at `realwork/references/healthfirst-example/additional/Team 04 – HealthFirst Team Information - original.docx` and uploaded to the new Drive reference folder.
- Additional team document: [TM04 Team Info](https://docs.google.com/document/d/1hlf3fuAZF-GO_xGNOfx6etE56BKj03P_qDWguxnTPVE/edit?tab=t.0). This was missing from the first pass. An unchanged DOCX copy is archived at `realwork/references/healthfirst-example/additional/TM04 Team Info - original.docx` and uploaded under `99 Reference - HealthFirst Example/Team Formation`.
- Direct Slides link: [HealthFirst Expo Slides](https://docs.google.com/presentation/d/1J46QbnKZz0nYWjqUgyixGfbHs06RCyuRJM8QkRWEc1w/edit?usp=drive_link). This is the 13-slide HealthFirst Expo deck from the old-folder root, not the 19-slide Week 2 reference deck. It was exported unchanged as `realwork/references/healthfirst-example/additional/HealthFirst Expo Slides - original.pptx` and uploaded to `99 Reference - HealthFirst Example`.
- Old-root deck: [TM04 Onboarding Project Presentation](https://docs.google.com/presentation/d/18Im_faNrRVlV7JZ9CWcMiS8Ob8YOvLquEwMcLhAgKAU/edit?usp=drive_link). This separate native Slides deck was copied unchanged to `99 Reference - HealthFirst Example` as `TM04 Onboarding Project Presentation - original`. It remains a HealthFirst reference, not marine-project evidence.

This re-scan does not change the actual marine-project scope. HealthFirst files
are labelled as examples so they cannot be mistaken for marine requirements,
data, testing evidence or claims.

The Drive root now includes `README.md`, which explains the folder structure,
the code/evidence workflow and the HealthFirst reference boundary.

The archived `99 Reference - HealthFirst Example` folder now mirrors the old
source layout with subfolders for Retrospective, Team Formation, System
Architecture, Iteration Build, Data Governance, Others, Feedbacks and Design
Artefacts.
Selected reference files remain at the reference root for easy access; this
does not alter the actual marine-project folders.

## Adapted marine deliverables — 14 August 2026

These are new project outputs, not unchanged HealthFirst copies:

| Local output | Purpose | Drive link |
|---|---|---|
| `deliverables/TEAM04_Marine_Project_Information.docx` | Team, scope and links | [Google Doc](https://docs.google.com/document/d/1TS_3soYkpeXXs8wzo9m2_9Khs6k0eU49/edit) |
| `deliverables/TM04_Marine_Social_Contract.docx` | Working agreement | [Google Doc](https://docs.google.com/document/d/1qMRH9_it0VLtjlyf5WcbwFOpWXha_TQn/edit) |
| `deliverables/Marine_MVP_Work_Plan_and_Handover.docx` | Ownership and handover | [Google Doc](https://docs.google.com/document/d/19W1niQXJdC3rVam4MTLN1w4Z1enoXo6Y/edit) |
| `deliverables/Marine_MVP_QA_and_Deployment_Checklist.docx` | Acceptance and release evidence | [Google Doc](https://docs.google.com/document/d/1HJjSd-xeY4y8JJUx3m9qJdcSWaP8SAMD/edit) |
| `deliverables/Team04_Marine_Miro_Reflection_Speaking_Notes.docx` | Reflection facilitation | [Google Doc](https://docs.google.com/document/d/1V0IVCBnqlVUG-Be1lKUJpqiFNZEhD5-Y/edit) |
| `deliverables/presentation/Team04 Marine Observation Onboarding Presentation.pptx` | 19-slide English onboarding deck | [Google Slides](https://docs.google.com/presentation/d/1aU_HQoaEwIZ-__RMElYfMce7wdPLfnX4/edit) |

An editable native Slides copy is also available for team updates:
[Team04 DiveSafe MY Onboarding Presentation - editable](https://docs.google.com/presentation/d/1bFR83Sng4uYm_rUPjwVuzTzwKwcVLWPVoPJl9d-xbTU/edit).
The imported copy was checked through the Slides outline and contains all 19
slides. The previous editable Marine Observation file is archived and is not
the current deck.

Matching Markdown sources remain in `deliverables/documents/`; runtime code and
API/deployment documents remain in `actual-project/`. LibreOffice 26.2.5.2 is
  now installed. All five DOCX files were converted to PDF and inspected as
  page PNGs (17 pages total); the 19-slide PPTX was rendered with LibreOffice
  and artifact-tool. Backend tests passed 10/10 and frontend workflow tests
  passed 8/8. The checks found no blank pages, clipped tables, unexpected
  overlap or broken page markers.

## Quality upgrade and overwrite record - 14 August 2026

The deliverables were rebuilt with a mixed template approach: the old
HealthFirst reference supplies the narrative skeleton, spacing, heading levels,
cards, tables, footer and page numbering; all visible content, examples and
boundaries were rewritten for the Marine Observation MVP. No HealthFirst
medical logic or health data appears in the Marine deck or governance files.

Before any Drive replacement, the previous local outputs were copied to
`realwork/tmp/backups/quality-upgrade-2026-08-14/` and hashed in
`backup-sha256.csv`. The five raw DOCX files and the raw PPTX are then updated
in place using their existing Drive file IDs, preserving the links above. The
Google-native editable Slides handoff remains a separate file because its MIME
type cannot accept raw PPTX bytes; it remains a 19-slide editable copy.

Runtime alignment for this record is `b1e5baf`: Profile -> Dive site -> Species
directory -> Briefing -> Confirm -> Sighting; `/health`, `/api/dive-sites`,
`/api/species`, `/api/briefing/<site_id>`, `/api/profile`, `/api/recognize` and
`/api/sightings`; Render PostgreSQL with local SQLite fallback;
Leaflet/OpenStreetMap with an accessible list fallback; static source-labelled
public/synthetic context; deterministic recognition fallback; external AI/CV
disabled by default; no exact sensitive locations.

## PGIE structure alignment - 14 August 2026

The Real Project root (`18Px2njE27SCiZ4bs-40zgUgm_sRE70Kx`) now has a parallel
PGIE structure based on the Sample Project root (`1cp6A59lG5dYyOX_4Hi1ocD59TBiWdboe`):

`Team Information`, `Testing`, `Team Meeting`, `System Architecture`, `Others`,
`Iteration Build`, `Security Aspects`, `Design and Analysis Artifacts`, `Risks`,
`Retrospective`, `Feedbacks`, `Industry Mentor Communications`, `Handover`, and
`Data Governance`.

The matching nested paths are present at:

- `Design and Analysis Artifacts/Iteration 1`, `Iteration 2`, `System Vision`
- `Handover/Handover`, `Handover/Implementation Plan`
- `Data Governance/Onboarding project Analysis & Datasets/Datasets`
- `Data Governance/Onboarding project Analysis & Datasets/Analysis`
- `Data Governance/Onboarding project Analysis & Datasets/Datasets/Additional sources`

The numbered Real folders remain as empty legacy navigation shells after the
active files were moved into their canonical mirrored locations. Sample Project
files were copied into the matching Real locations without editing the Sample Project. Copied source
material includes Marine-specific datasets and analysis documents only. The
HealthFirst dataset copies were subsequently moved to `Archive - Removed
Sample Files`; the archived copies are explicitly reference-only and do not
alter the Marine API, schema or deployed inputs.

Marine supplements added to the mirrored tree include:

- `Analysis/MARINE_DATA_DICTIONARY.md`
- `Analysis/MARINE_ANALYSIS_NOTES.md`
- `Analysis/API.md — Marine runtime`
- `Analysis/DATA_MANAGEMENT_PLAN.md — Marine runtime`
- `Analysis/DECISIONS.md — Marine runtime`
- `Analysis/PROJECT_SCOPE.md — Marine runtime`
- `Analysis/INTEGRATION_CHECKLIST.md — Marine runtime`
- `Security Aspects/SECURITY_PLAN.md — Marine runtime`
- `Team Information/TEAM_INFORMATION.md — Marine project`
- `Datasets/MARINE_SYNTHETIC_OBSERVATIONS.csv`
- `Datasets/obis_context.json — Marine runtime`
- root `miro board link`

The exact Drive IDs for these folders and files are retained in the Drive
activity record and can be rechecked from the root links. The root item
`team reflection vedio - pending` records an evidence gap only; it is not a fake
recording. The original Sample Project tree remains unchanged.

## Canonical path migration - 14 August 2026

The active Marine files were moved (not re-uploaded) from the numbered folders
to the matching Sample-style folders. File IDs and Drive file URLs therefore
remain stable:

| Previous location | Canonical location |
|---|---|
| `01 Governance` project information and social contract | `Team Information` |
| `01 Governance` Miro reflection notes | `Retrospective` |
| `01 Governance` work plan and handover | `Handover/Implementation Plan` |
| `01 Governance` migration manifest and PM context | Real Project root |
| `03 Design` PPTX and editable Slides | `Design and Analysis Artifacts` |
| `04 Build` README, `render.yaml`, frontend and backend | `Iteration Build` |
| `05 Evidence` QA checklist | `Testing` |

Superseded duplicate drafts from `01 Governance` and `02 Product Scope` were
moved to `Archive - Superseded Marine Drafts` at the Real root and renamed with
an `ARCHIVE -` prefix. They are retained for recovery only. The numbered folder
shells remain as legacy navigation markers, but the mirrored folders are now
the canonical working paths. No Sample Project item was moved, renamed or
edited.

## Drive cleanup - 14 August 2026

The actual project root was cleaned without changing the Sample Project PGIE
(`1RfEiGPd5_v2Ka5TieeeLSh4-YB0mUjvk`) or any of its descendants.

The following items were moved, not deleted, to the recoverable archive
`Archive - Removed Sample Files`
(`1tWAKHAZ5RHkeoAkijmVrWzS_UWjBRP8v`):

- the complete `99 Reference - HealthFirst Example` subtree;
- HealthFirst medical datasets and mortality PDFs from
  `Data Governance/Onboarding project Analysis & Datasets/Datasets`;
- `Additional sources` after its medical files were moved;
- HealthFirst analysis documents and workbooks from the mixed `Analysis`
  folder;
- `TM04 Team Info - original.docx` from `Team Information`.

The Marine files retained in the mixed area are `MARINE_SYNTHETIC_OBSERVATIONS.csv`,
`obis_context.json — Marine runtime`, the Marine data dictionary, analysis notes,
API, data-management, decisions, project-scope and integration-checklist files.

The archive move preserved Drive file IDs and links. A final readback confirmed
the protected Sample Project PGIE still has its original parent and the Marine
dataset/analysis folders contain only the retained Marine materials.

## Form catalogue alignment - 14 August 2026

The Marine runtime now uses catalogue version
`marine-form-options-2026-08-14-v1`. The Approximate area control is a native
required dropdown containing five coarse Malaysian-region labels. The labels
are aggregated demonstration context, not verified litter-survey sites, and do
not expose more precise or sensitive locations. README, API, data-management,
scope, decisions, integration-checklist, QA and project-information documents
were updated to describe the same behaviour. The live Render frontend was
checked to load all five labels from `GET /api/options` after commit `aea23c9`.

## DiveSafe MY theme switch — 15 August 2026

The active product scope is now **DiveSafe MY — Endangered Species Hotspot
Guide for Divers in Malaysia**. The Marine Litter flow stays in the repository
as a rollback-compatible legacy path, but it is not the main user journey,
presentation story or new evidence set.

The new working flow is `Profile -> Dive site -> Species directory -> Briefing
-> Confirm -> Sighting`. It uses broad synthetic/public locations, source labels,
an optional recognition adapter with a local fallback, and no exact sensitive
species coordinates. Su's GitHub links are architecture references only; the
old PHP, MySQL and Arduino code was not copied into the runtime.

The source-of-truth files are the current `actual-project` backend, frontend,
documents and `deliverables` deck. The Sample Project PGIE remains protected and
was not edited. Before deployment, keep the current stable commit available for
rollback and verify the Render frontend points to the matching API service.

Drive sync on 15 August updated the existing Markdown, DOCX, raw PPTX, frontend
and backend files in the Real Project folders. A new editable Slides copy was
created at [Team04 DiveSafe MY Onboarding Presentation - editable](https://docs.google.com/presentation/d/1bFR83Sng4uYm_rUPjwVuzTzwKwcVLWPVoPJl9d-xbTU/edit)
because the old native Slides file could not be replaced byte-for-byte. The old
editable copy was renamed `Archive - Marine Observation editable (pre-DiveSafe)`;
the raw PPTX file kept its existing Drive ID.

## TideTrace MY documentation alignment - 15 August 2026

The active student-demo name is now **TideTrace MY - Marine Litter Reporting
and Cleanup Demo for Malaysia**. The active flow is `Report -> Recognize ->
Heatmap -> Join mission -> Evidence -> Progress`. It uses five fixed litter
categories, broad Malaysian area labels, source-labelled/synthetic context and
anonymous demo counts.

This is a scope and documentation alignment. The existing GitHub repository
and Render service names retain their historical marine-observation identifiers
because they are already connected deployment identifiers. TideTrace is not a
live reporting, emergency-dispatch, survey or enforcement system. No active
endpoint accepts identity data or exact coordinates. Detection, priority,
heatmap, mission, evidence and progress outputs are illustrative only.

Render's official recognition configuration is
`LITTER_RECOGNITION_ENABLED`, `LITTER_RECOGNITION_API_URL`,
`LITTER_RECOGNITION_API_KEY` and `LITTER_RECOGNITION_TIMEOUT_MS`.
Recognition is disabled by default and may call a provider only with exactly
`true` and a private HTTPS URL. Values stay in Render, not Git or Drive.

DiveSafe MY and earlier marine-observation paths are preserved as legacy
rollback records. They are not deleted and must not be presented as TideTrace
features, current screenshots or product evidence. HealthFirst and Sample
Project material remains reference-only and unchanged.

The preserved DiveSafe rollback commit is `d75264e`. It remains available for
recovery while TideTrace MY is the active documented scope.

The TideTrace code and documentation commit is `d19557e`. It includes the new
litter report, demo recognition, area heatmap, cleanup mission, before/after
evidence and community progress paths. Both Render services were rebuilt from
this `main` commit. The API smoke check used synthetic data only: health,
options, recognition fallback, report creation, heatmap, mission join,
before/after impact and read-back all returned the expected status. PostgreSQL
was configured on Render and the recognition provider remained disabled.
