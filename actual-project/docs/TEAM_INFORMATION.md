# Team 04 - Marine Observation Project Information

## Project

**Marine Litter Hotspot & Marine-Life Observation MVP (Source2Sea MY)**

The project has one reporting workflow for marine litter in a selected
Malaysian coastal area. Static OBIS context supports a map layer; it is not a
second animal-reporting flow. The first build uses source-visible public data,
synthetic demo reports and transparent rules.

The report form keeps five fixed litter categories and exposes five coarse
area labels through a native dropdown: Selected Malaysian coastal area,
North-west Peninsular Malaysia coast, East coast Peninsular Malaysia,
Terengganu coastal waters and Selangor coastal waters. These labels are
aggregated demonstration context, not verified litter-survey sites.

The API contract includes `GET /api/options`, which returns the versioned
catalogue used by the form. The frontend must show all five labels after the
catalogue loads; this does not add a second reporting workflow or more precise
location data.

## Team roles

| Member | Working role | Main responsibility |
|---|---|---|
| Huang Guan | Project Manager and integration | Scope, decisions, repository, deployment and evidence |
| Hnin Darli | Data analysis and visualisation | Dataset review, OBIS source notes and map context |
| Qian Jiang | UI/UX and frontend | Report/review/results flow, accessible copy and interface |
| LiHanXia | Backend/API | Validation, observation API and service integration |
| Keith Junn Chong | Database/data integration | PostgreSQL schema, persistence and source data loading |
| Benshuai Su | Classification support | Transparent rule explanations and future-model boundary |

## Shared boundaries

- Use only Plastic packaging, Fishing gear, Glass, Metal and Other in the MVP.
- Do not create a second marine-animal reporting flow.
- Use synthetic/public data and do not collect personal details.
- Do not publish exact threatened-species locations.
- Do not claim pollution-source proof, verified species identity, environmental
  outcomes or enforcement decisions.
- Keep HealthFirst files and code as reference-only material.
