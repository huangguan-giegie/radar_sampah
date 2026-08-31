# Migration Manifest

> **Current-status notice:** Radar Sampah is the active product on `main`.
> TideTrace, Marine Observation, HealthFirst and DiveSafe names in this
> manifest are dated migration, audit, rollback or compatibility references;
> they are not current product requirements. Do not delete these records.

## Work allocation update — 21 August 2026

The actual-project allocation is now split between requirements authorship and
user acceptance review. Hnin Darli owns the User Acceptance Criteria review
from Amirah's perspective; Keith Junn Chong keeps the Epics, User Stories and
technical Given/When/Then baseline. Huang Guan coordinates the final
cross-file check. Qian Jiang owns the Amirah persona, prototype and UX, LiHanXia owns tech and data
feasibility, and Benshuai Su owns architecture and technical risk.

Local source: `actual-project/docs/WORK_ALLOCATION_PLAN.md`.
Drive copy: `Team Information/Radar Sampah Work Allocation Plan.md`
(`1BErKy4-lGgD4hAULGh9ieHfNCiqIcMNR`). The previous Team Information Office
file was backed up in Drive as `TM04 Team Info - before allocation 20260821.docx`
(`1GntAcAnnO9QhbIFgNGJ0q_UDkTj52HLM`) before the updated role split was
uploaded to the original file ID. The Sample Project PGIE and Future Features
folder remain unchanged.

## Radar Sampah Design Thinking sync — 19 August 2026

The active Design Thinking tab was updated from the workshop decision set. It now records 19 stories (11 Must, 6 Should, 2 Could), GR1–GR9, the Report & Classify / Find & Understand / Connect & Prepare iteration split, GPS one-off area assistance, AI suggestion-only wording, deterministic illustrative scoring, moderator verification, collected reports, area sensitivity and the `102+` display. The historical requirements tab is marked superseded. The separate Radar Sampah deck remains a local, independently validated artifact until the team chooses a Drive destination.

## Historical — DiveSafe MY alignment — 15 August 2026

At that migration stage, the active documentation name was **DiveSafe MY**. This is a naming and
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

- GitHub: https://github.com/huangguan-giegie/radar_sampah
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

## Adapted Radar Sampah deliverables — 14 August 2026

These are new project outputs, not unchanged HealthFirst copies:

| Local output | Purpose | Drive link |
|---|---|---|
| `deliverables/TEAM04_Radar_Sampah_Project_Information.docx` | Team, scope and links | [Google Doc](https://docs.google.com/document/d/1TS_3soYkpeXXs8wzo9m2_9Khs6k0eU49/edit) |
| `deliverables/TM04_Radar_Sampah_Social_Contract.docx` | Working agreement | [Google Doc](https://docs.google.com/document/d/1qMRH9_it0VLtjlyf5WcbwFOpWXha_TQn/edit) |
| `deliverables/Radar_Sampah_MVP_Work_Plan_and_Handover.docx` | Ownership and handover | [Google Doc](https://docs.google.com/document/d/19W1niQXJdC3rVam4MTLN1w4Z1enoXo6Y/edit) |
| `deliverables/Radar_Sampah_MVP_QA_and_Deployment_Checklist.docx` | Acceptance and release evidence | [Google Doc](https://docs.google.com/document/d/1HJjSd-xeY4y8JJUx3m9qJdcSWaP8SAMD/edit) |
| `deliverables/Team04_Radar_Sampah_Miro_Reflection_Speaking_Notes.docx` | Reflection facilitation | [Google Doc](https://docs.google.com/document/d/1V0IVCBnqlVUG-Be1lKUJpqiFNZEhD5-Y/edit) |
| `deliverables/presentation/Team04 Radar Sampah Onboarding Presentation.pptx` | 19-slide English onboarding deck | [Google Slides](https://docs.google.com/presentation/d/1aU_HQoaEwIZ-__RMElYfMce7wdPLfnX4/edit) |

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

- `Analysis/RADAR_SAMPAH_DATA_DICTIONARY.md`
- `Analysis/RADAR_SAMPAH_ANALYSIS_NOTES.md`
- `Analysis/API.md — Radar Sampah runtime`
- `Analysis/DATA_MANAGEMENT_PLAN.md — Radar Sampah runtime`
- `Analysis/DECISIONS.md — Radar Sampah runtime`
- `Analysis/PROJECT_SCOPE.md — Radar Sampah runtime`
- `Analysis/INTEGRATION_CHECKLIST.md — Radar Sampah runtime`
- `Security Aspects/SECURITY_PLAN.md — Radar Sampah runtime`
- `Team Information/TEAM_INFORMATION.md — Radar Sampah project`
- `Datasets/MARINE_SYNTHETIC_OBSERVATIONS.csv`
- `Datasets/obis_context.json — Radar Sampah runtime`
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

## Historical — DiveSafe MY theme switch — 15 August 2026

At that historical stage, the active product scope was **DiveSafe MY — Endangered Species Hotspot
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

## Radar Sampah documentation alignment - 15 August 2026

The active student-demo name is now **Radar Sampah - Marine Litter Reporting
and Cleanup Demo for Malaysia**. The active flow is `Report -> Recognize ->
Heatmap -> Join mission -> Evidence -> Progress`. It uses five fixed litter
categories, broad Malaysian area labels, source-labelled/synthetic context and
anonymous demo counts.

This is a scope and documentation alignment. The active GitHub repository is
`https://github.com/huangguan-giegie/radar_sampah`; the Render services are
`radar-sampah-api` and `radar-sampah-frontend` at
`https://radar-sampah-api.onrender.com` and
`https://radar-sampah-frontend.onrender.com`. Former TideTrace and
marine-observation identifiers remain compatibility/history aliases only. Radar
Sampah is not a
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
recovery while Radar Sampah is the active documented scope.

The TideTrace code and documentation commit is `d19557e`. It includes the new
litter report, demo recognition, area heatmap, cleanup mission, before/after
evidence and community progress paths. Both Render services were rebuilt from
this `main` commit. The API smoke check used synthetic data only: health,
options, recognition fallback, report creation, heatmap, mission join,
before/after impact and read-back all returned the expected status. PostgreSQL
was configured on Render and the recognition provider remained disabled.

## Design Thinking requirements documents - 17 August 2026

Four new TideTrace MY native Google Docs were created in the actual project's
Design Thinking folder. They were based on the sample project's Epic, User
Story and Acceptance Criteria structure, while using only current TideTrace
facts:

- 8 Epics
- 16 User Stories
- Given/When/Then Acceptance Criteria
- Implemented, Demo, Future and TBD labels
- Separate Security Plan with implemented controls, planned controls and
  release blockers

The local Markdown source copies are in `actual-project/docs/`. The protected
Sample Project PGIE was not modified. The new documents contain no HealthFirst
or DiveSafe product claims.

## Design Thinking Tab 11 local sync — 18 August 2026

The latest detailed Tab 11 source supersedes the earlier compact copy for local
working documents. Local Markdown now records 8 Epics, 18 stories
(US1.1–US8.2, including US3.3) and 98 acceptance criteria, grouped as I1 Report & Classify
(E1–E2), I2 Find & Understand (E3–E5) and I3 Connect & Prepare (E6–E8).

The active scope is Radar Sampah. Amirah and the Selangor central west example
are used with broad-area/no-exact-coordinate wording. AI suggestions need
confirmation; scores, heatmap and impact are illustrative; organiser safety
text is not verified; no legal or enforcement claim is made. Unsupported stories
are marked Future/TBD. Historical references and the HealthFirst example were
not modified.

## Final Design Thinking sync — 18 August 2026

This section supersedes older scope notes above. The current detailed Design
Thinking Tab 11 is the source: 8 Epics, 18 stories (US1.1–US8.2) and 98
Given/When/Then criteria. Iterations are I1 Report & Classify (E1–E2), I2
Find & Understand (E3–E5) and I3 Connect & Prepare (E6–E8). The older 16-story
section and the single historical “Radar Sampah” name are not copied into the
active documents.

The following actual-project Drive files were updated in place, with local
backups in `realwork/.backup_design_thinking_sync_20260818`: Epics
(`1FHAREKsiwuJGBYBnM1a-92JhvSXfWQq5CwtmjFX4AAk`), User Stories
(`19IYH4zz2faeTyS8yFB5lilzWXn693GJUILKK3JX3yp4`), Acceptance Criteria
(`1oDHIvUh9r_DZd67obguPgpEaGR3X9YU_lmhEeW4Vedc`), Security Plan
(`1VsL_ZxKCirMxQYiOV46MXb35rlBV7J6ud0hFpsIlijs`), Data Management Plan
(`1YXWiFnHCLmaPlKB5uflM0fvMfqcgKNj77x46CMbb2mk`), Articles and Sources
(`1MEG45YyJsjqDfLFyfOsREWh9yQq78LnJim4JBuRuLL0`), Persona
(`1BjMHyyzrwB7jqSZrYm7EF_OEV5jIxoao`), Team Info
(`1lpXD7Yw9fJQ7xt8A5QyQe6UsGQmUcTsi`), Social Contract
(`122H3bxvLLXvAlW3ZI9sW5GZs0SE8hJ3e`) and the 19-slide deck
(`1aU_HQoaEwIZ-__RMElYfMce7wdPLfnX4`).

The six-category target, activity filters, reminders, recurrence monitoring,
biodiversity learning and full preparation are Future/TBD where the deployed
code does not support them. The Sample Project PGIE, historical materials and
Future Features were not edited.

## Design Thinking visual assets — 19 August 2026

The active Design Thinking deck now has eight generated, text-free visuals. The
Design Thinking source was checked for reusable images first; its visual
references were not clean standalone assets, so synthetic illustrations were
used instead. Prompts and dates are recorded in
`realwork/.tmp_ppt_images/prompts.txt`. The visuals are illustrative only and
do not show exact sensitive locations, real people, product screenshots or
measured environmental evidence. The previous deck is backed up at
`realwork/.tmp_ppt_image_edit/TideTrace_MY_Design_Thinking_before_visuals.pptx`.

## Current project documentation alignment — 19 August 2026

The active public copy is Radar Sampah; older TideTrace MY filenames stay for
link stability. The plan has 19 stories: 11 Must, 6 Should and 2 Could. GR5 is
Must. GR7 hides a reported private-person or private-property photo immediately.
GR9 measures the AI-assisted path and keeps manual entry available.

GPS is one-off area selection help only; exact coordinates are never stored.
US5.3 requires moderator verification before a report can be marked collected.
Severity is deterministic and versioned, with four bands, sensitivity factors
1.0/1.25/1.5 and an open quantity display of `102+`. D1-D7 are in the active
project docs. Current code gaps remain Future/TBD. Sample, reference, history
and Future Features material was not changed.

## Radar Sampah filename alignment — 30 August 2026

The active deliverables were renamed from Marine-labelled filenames to
Radar_Sampah-labelled filenames. Git history is unchanged and the previous
names remain recoverable through Git history and rollback tags. The current
Render services still use the legacy `team04-marine-observation-*` hostnames;
these are compatibility endpoints, not the product name. The proposed
`radar-sampah-*.onrender.com` names have not been provisioned.

## Radar Sampah flow and lightweight deck — 19 August 2026

The confirmed Radar Sampah flow was sent to Darli. The active Design Thinking
baseline is 19 stories (11 Must, 6 Should, 2 Could), with GR5, GR7, GR9, US5.3
and D1-D7 aligned. A separate 12-slide Swiss/IKB deck was created locally at
`radar-sampah-design-thinking/`; the existing shared deck was not overwritten.

The six local governance DOCX files were rebuilt after the naming sync. They
were rendered with LibreOffice and checked page by page. Radar Sampah is the
active audience-facing name; older TideTrace/DiveSafe files remain only as
legacy or historical material where the filename is retained for link stability.

## Latest Design Thinking and confirmed workflow sync — 20 August 2026

The current detailed Design Thinking tab `t.omld9s7348k4` is now the working
requirements source for the document copies: 25 stories (15 Must, 6 Should,
4 Could), grouped as I1 E1–E2, I2 E3–E5 and I3 E6–E8. The practical MVP
direction is I1–I2; unsupported organiser, moderator, cleanup follow-up,
biodiversity learning, recurrence and recognition features remain Future/TBD.

The separate `[Draft] Radar Sampah Confirmed Workflow` document is the flow
source. It supports map-first or cleanup-first entry, one-time GPS assistance,
user confirmation, pending visibility, moderator review, broad public areas,
cleanup status and recurrence wording. Exact GPS, if later retained privately
for quality control, must never be public or included in screenshots.

Local copies of Epics, User Stories, Acceptance Criteria, DMP, Project Scope,
Team Information and Integration Checklist were backed up in
`realwork/.backup_sync_20260820` before the 25-story rewrite. The 9-slide IM
Proposal is being aligned to the same map and MVP boundary. No Sample Project
PGIE, history or Future Features file was changed.

## Latest Darli requirements sync — 20 August 2026

The active Design Thinking tab is `t.omld9s7348k4` in
`1GuVQunTtGfwmbHVXSh1ybBSLHtDxwRirWvdV1Fnp9LQ`; the Confirmed Workflow is
`1Nw_yOmg_YNBCfM6viIUeUrIWpktDRcjl8Z_CSyudr3Q`. The current baseline is 25
stories (15 Must, 6 Should, 4 Could), with I1 E1–E2, I2 E3–E5 and I3 E6–E8.
I1–I2 are the practical MVP direction; unsupported organiser, moderator,
cleanup-outcome, recurrence, biodiversity-learning and recognition features
remain Future/TBD.

The three native requirements Docs were updated in place with revision guards.
The 9-slide IM Proposal `1DBadsZJZ-GbkpK6Q_ki9PlJAp9vXTBXGMPJknbaEn1A` was
updated in place to match the two-entry workflow, roles, pending review,
broad-area privacy and current MVP boundary. Local source documents were
backed up under `realwork/.backup_sync_20260820/`. The Drive draft DMP is
listed by Drive search but returns 404 through the Docs API, and the Team Info
DOCX cannot be edited by the native Docs batch API; these remain explicit
follow-up items rather than silently claiming completion. Sample Project PGIE,
history, archive and Future Features were not changed.

The updated requirement document revisions are recorded in PM context; the
deck head revision is `Vg0Gpsy9oYTYSw`.

Verification: native Docs readback found 25 story references and no old
19-story/11-Must baseline. The IM Proposal readback remains 9 slides and its
fresh thumbnails for Slides 5–9 are stored under
`realwork/.tmp_ppt_verify/`; PDF export completed successfully. No runtime or
deployment change was made.

## GitHub legacy sample cleanup — 28 August 2026

This cleanup applies only to `github.com/huangguan-giegie/radar_sampah`.
No Drive file, ePortfolio page, Sample Project PGIE or Render configuration was
changed.

- Before cleanup: `main` at `6ea1190d7bcc7f352dbb72465402ee831a5a11da`.
- Local recovery copies: `realwork/backups/github-legacy-cleanup-20260828/`
  (`radar_sampah-main-before-cleanup.tar`,
  `radar_sampah-all-refs-before-cleanup.bundle`, tree/hash manifests and ref
  list).
- Recovery tags: `divesafe-last-stable` and
  `radar-sampah-pre-legacy-cleanup-20260828`.
- Cleanup commit: `47ca9c28b92f8b8462c8b4c8d040431313c20b89` on
  `codex/remove-legacy-sample-material`.
- Removed from the active tree: the complete
  `references/healthfirst-example/` tree and the three DiveSafe data files
  (`dive_sites.json`, `species_directory.json`,
  `responsible_diving_briefings.json`).
- Removed from the active Flask runtime: DiveSafe tables, seed loading,
  helpers and profile/site/species/briefing/recognition/sighting/collection
  routes. Current Radar Sampah litter routes, data, frontend and Sea-TACO
  model remain.
- Active documentation was changed to stop describing the removed runtime;
  PM context and this manifest retain historical names only as audit records.
- Backend tests: 19 passed; compileall and whitespace checks passed. Frontend
  build/test remains a pre-merge check.
- Remote branch deletion is planned for `agent/liquid-effects-more-visible`
  and `codex/radar-sampah-frontend`; `main`,
  `Sea-TACO-Detection-Model` and `feature/lihanxia-litter-report-status` stay.

### Final verification — 28 August 2026

- `codex/remove-legacy-sample-material` was merged to `main` as
  `2df923e910f962f7eaa29a8159634f7d8843d3ff`.
- The two planned obsolete remote branches were deleted. The model and
  backend feature branches were not changed; the recovery tags remain.
- Backend tests: 19 passed with `python -m pytest -q`; compileall and
  whitespace checks passed. Frontend tests: 10 passed; Vite production build
  passed using a clean verification output directory.
- Smoke checks passed for the active litter endpoints and synthetic report,
  demo recognition and mission join. The removed DiveSafe endpoints return
  404. No Drive, ePortfolio, Sample Project PGIE or Render settings changed.
- Existing Render services still respond at their current team04 hostnames.
  The planned radar-sampah hostnames are not configured (404), so this GitHub
  cleanup does not claim a Render rename or redeployment.
- A live API check returned 200 for `/health`, `/api/litter-options`,
  `/api/context`, `/api/litter-reports`, `/api/litter-heatmap`,
  `/api/cleanup-missions` and `/api/community-progress`.
- Final active-tree search contains no old sample runtime routes or data files;
  historical names remain only in this manifest, PM context and retained plan
  history.
