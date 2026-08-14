# Marine Observation Project Information

**Document control:** Version 1.0 | 14 August 2026 | Audience-facing

**Audience:** Team members, academic mentors, reviewers and demonstration stakeholders

> **Safety boundary:** Use synthetic or public data only. This MVP is a demonstration and learning tool. It does not prove a pollution source, verify species identity, establish ecological impact, or direct environmental enforcement or official clean-up action.

## Project overview

Team 04 is building a focused web MVP for reporting marine litter in one selected Malaysian coastal demonstration area. A user records a synthetic observation, reviews and confirms it, then receives a transparent category result and an illustrative clean-up priority. A small, source-labelled OBIS sample provides marine-life context beside the result.

Marine litter is the only reporting flow. Marine-life information is contextual and must not be interpreted as a verified sighting, ecological assessment or second reporting workflow.

## Product flow

`Report -> Review and edit -> Confirm -> Save -> Results and OBIS context`

The user remains in control of the record before submission. Editing after review invalidates the previous confirmation, and only an explicit confirmation can create an observation.

## Team roles

| Member | Role | Main responsibility |
|---|---|---|
| Huang Guan | Project Manager | Scope, facilitation, integration, evidence coordination and release checks |
| Hnin Darli Myint Myat | Data Analysis and Visualisation | Public-data review, OBIS source notes, context explanation and visual communication |
| Qian Jiang | UI/UX and Frontend | Accessible interface, responsive layout, interaction flow and visual design |
| Hanxia Li | Backend Developer | Flask API, input validation, application logic and integration support |
| Chong Junn Keith | Database and Backend | PostgreSQL/SQLite schema, persistence and database verification |
| Benshuai Su | Backend and Intelligent Features | Transparent rule explanation, future AI-adapter boundary and technical support |

## MVP scope

### Included in the first release

- One marine-litter reporting flow in one selected Malaysian coastal demonstration area, using Plastic packaging, Fishing gear, Glass, Metal and Other.
- The form keeps five fixed litter categories and offers five coarse area labels
  through a native dropdown. These labels are aggregated demonstration context,
  not verified litter-survey sites.
- Validated input, review, edit and explicit confirmation before submission.
- PostgreSQL on Render with a local SQLite fallback when `DATABASE_URL` is absent.
- Transparent rule-based classification and illustrative priority wording.
- A versioned, source-labelled static OBIS sample with location masking, a map and an accessible list fallback.

### Outside the first release

- Personal identifiers, accounts, private observations or raw file uploads.
- Live OBIS dependence, real-time scientific monitoring or a second marine-animal reporting flow.
- Pollution-source attribution, ecological-impact assessment or enforcement workflow.
- External AI/CV, verified species recognition, exact threatened-species locations or automated clean-up decisions.

## Implementation baseline

- Backend and frontend entry points: `actual-project/backend/app.py` and `actual-project/frontend/index.html`.
- API contract: `GET /health`, `GET /api/observations`, `POST /api/observations`,
  `GET /api/context` and `GET /api/options`.
- Context source: `actual-project/backend/data/obis_context.json`.
- Scope, decisions, data, security and integration evidence: `actual-project/docs/`.

## Interpretation boundary

All saved reports used for teaching and demonstration must be synthetic. Public OBIS records remain attributed context, not user-generated evidence. Category and priority outputs are deterministic demonstration aids and do not establish a scientific finding, operational priority, legal conclusion or official response.

## Project spaces

[GitHub](https://github.com/huangguan-giegie/team04-marine-observation-mvp) | [Render frontend](https://team04-marine-observation-frontend.onrender.com) | [Render API](https://team04-marine-observation-api.onrender.com) | [Drive PGP](https://drive.google.com/drive/folders/18Px2njE27SCiZ4bs-40zgUgm_sRE70Kx) | [Miro](https://miro.com/app/board/uXjVHySKbPY=/)
