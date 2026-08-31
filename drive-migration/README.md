# Team 04 Real Project Drive Guide

This Drive is the working Project Governance Portfolio for the new Team 04
Radar Sampah project. Earlier sample material is kept in the recoverable
`Archive - Removed Sample Files` area and is not the current product.

If an audit or migration file mentions TideTrace, Marine Observation,
HealthFirst or DiveSafe, treat that wording as historical, rollback or
compatibility context. Current scope and requirements come from the Radar
Sampah documents listed below.

## Start here

1. Read `01 Governance/DECISIONS.md` and
   `01 Governance/INTEGRATION_CHECKLIST.md` before changing scope or merging
   work.
2. Read `02 Product Scope/PROJECT_SCOPE.md` to confirm what the MVP includes
   and what is out of scope.
3. Use `04 Build` for the current frontend, backend and Render configuration.
   The GitHub repository is the source of truth for code:
   https://github.com/huangguan-giegie/radar_sampah
4. Put screenshots, test notes, deployment evidence and PGP links in
   `05 Evidence`.
5. Use `03 Design` for the adapted 19-slide onboarding deck and
   `01 Governance` for the editable DOCX/Markdown handover documents.

PM context and the migration manifest are maintained locally only and are not
tracked in GitHub. The archived
`archive/compatibility/tidetrace_catalog.json` is historical compatibility
material, not active runtime data.

## Folder guide

### `01 Governance`

Use this folder for PM context, team information, decisions, integration
checks, migration records and working agreements. Record a decision here when
it affects the whole team. Do not silently replace an earlier decision.

### `02 Product Scope`

Use this folder for the product scope, data-management plan and security plan.
The current MVP reports marine litter in one Malaysian coastal area and uses
OBIS marine-life data as ecological context. Use public or synthetic data only.

### `03 Design`

Use this folder for the current Miro board, user flow, wireframes, map layout,
labels and accessibility decisions. Keep design notes consistent with the
scope in `02 Product Scope`.

### `04 Build`

Use this folder for the deployable starter build and run instructions:

- `frontend/`: static interface (`index.html`, `styles.css`, `app.js`);
- `backend/`: Flask API, requirements and backend notes;
- `render.yaml`: Render service configuration.

For code changes, create a feature branch, open a Pull Request, merge the
reasonably safe change into `main`, run an integrated test, then update Render.
Do not commit credentials, personal data or large generated files.

Current demo services:

- Frontend: https://team04-marine-observation-frontend.onrender.com
- API: https://team04-marine-observation-api.onrender.com

The new `radar-sampah-frontend` and `radar-sampah-api` hostnames are not yet
enabled.

### `05 Evidence`

Use this folder for dated screenshots, API responses, deployment checks,
usability notes and links to PGP evidence. Name files with the date and a
short description so another team member can find the evidence quickly.

The adapted QA and deployment checklist is stored here alongside future test
evidence. It covers the same Render API, PostgreSQL configuration and
synthetic/public-data boundary as the code in `04 Build`.

### Adapted marine deliverables

The new project copies the useful structure of the old onboarding artefacts
without copying the sample product content:

- project information and social contract;
- work-plan handover and QA/deployment checklist;
- Miro reflection speaking notes;
- a 19-slide English Radar Sampah onboarding deck.

The editable Markdown sources and DOCX copies are in `01 Governance`; the
PPTX is in `03 Design`. The local source bundle is under
`realwork/deliverables/`. Exact Drive links remain in the local migration
manifest.

### `Archive - Removed Sample Files`

This is a read-only learning/reference area. Its social contract, onboarding
deck, QA notes, team information and course references can show format or
process, but they must not be copied as marine requirements, data claims,
testing evidence or product screenshots.

The archived reference area mirrors the old sample folder structure with these
subfolders: `Retrospective`, `Team Formation`, `System Architecture`,
`Iteration Build`, `Data Governance`, `Others`, `Feedbacks` and
`Design Artefacts`. The selected files already migrated remain visible at the
reference-folder root; source-only videos and cross-team material stay in the
old Drive space and are recorded in the migration manifest.

## Working rules

- Keep the actual scope and safety limits visible.
- Use synthetic or public data; never upload private or personal data.
- Treat AI/CV output as illustrative assistance, not verified species identity,
  pollution-source proof or an environmental enforcement decision.
- Keep GitHub, Drive, Miro and Render links aligned after important changes.
- If a file is superseded, keep the old version or record the reason in
  `01 Governance/DECISIONS.md`.
