# Team 04 Real Project Drive Guide

This Drive is the working Project Governance Portfolio for the new Team 04
marine-observation project. The earlier HealthFirst project is kept under
`99 Reference - HealthFirst Example` and is not the current product.

## Start here

1. Read `01 Governance/PM_CONTEXT_ACTUAL_PROJECT.md` for the latest decision,
   ownership and handover notes.
2. Read `01 Governance/DECISIONS.md` and
   `01 Governance/INTEGRATION_CHECKLIST.md` before changing scope or merging
   work.
3. Read `02 Product Scope/PROJECT_SCOPE.md` to confirm what the MVP includes
   and what is out of scope.
4. Use `04 Build` for the current frontend, backend and Render configuration.
   The GitHub repository is the source of truth for code:
   https://github.com/huangguan-giegie/team04-marine-observation-mvp
5. Put screenshots, test notes, deployment evidence and PGP links in
   `05 Evidence`.

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

### `05 Evidence`

Use this folder for dated screenshots, API responses, deployment checks,
usability notes and links to PGP evidence. Name files with the date and a
short description so another team member can find the evidence quickly.

### `99 Reference - HealthFirst Example`

This is a read-only learning/reference area. Its social contract, onboarding
deck, QA notes, team information and course references can show format or
process, but they must not be copied as marine requirements, data claims,
testing evidence or product screenshots.

## Working rules

- Keep the actual scope and safety limits visible.
- Use synthetic or public data; never upload private health or personal data.
- Treat AI/CV output as illustrative assistance, not verified species identity,
  pollution-source proof or an environmental enforcement decision.
- Keep GitHub, Drive, Miro and Render links aligned after important changes.
- If a file is superseded, keep the old version or record the reason in
  `01 Governance/DECISIONS.md`.
