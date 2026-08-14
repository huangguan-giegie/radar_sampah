# Migration Manifest

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

The `99 Reference - HealthFirst Example` folder now mirrors the old source
layout with subfolders for Retrospective, Team Formation, System Architecture,
Iteration Build, Data Governance, Others, Feedbacks and Design Artefacts.
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
[Team04 Marine Observation Onboarding Presentation - editable](https://docs.google.com/presentation/d/1vGFr8Px9Tffn62yLFJdaGqdVSPnVpDC8DP2AN_9X65A/edit).
The imported copy was checked through the Slides outline and contains all 19
slides.

Matching Markdown sources remain in `deliverables/documents/`; runtime code and
API/deployment documents remain in `actual-project/`. The PPTX passed slide
overflow checks and the DOCX files passed structural/text checks. The local
environment has no LibreOffice binary, so DOCX pixel rendering is explicitly
not claimed as complete.
