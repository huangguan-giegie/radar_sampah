# Team 04 Marine Litter Observation MVP

## Purpose

This is a small, deployable MVP for reporting marine litter in one selected
Malaysian coastal area. It uses a fixed category list, transparent rules and a
static OBIS context sample. The project is for demonstration and learning only.

The workflow is:

`Report -> Review and confirm -> Save -> View results and map context`

## Scope and boundaries

- Categories: Plastic packaging, Fishing gear, Glass, Metal and Other.
- Data: synthetic observation records and public/static context only.
- Map: Leaflet with OpenStreetMap tiles and an accessible observation list.
- Context: a source-labelled static OBIS sample; sensitive records are
  aggregated or location-masked.
- Rules: fixed-category classification and an illustrative clean-up priority.
- No external AI, computer vision, user account, real personal data or image
  upload storage is enabled.
- Results do not prove a pollution source, species identity, ecological change
  or an enforcement decision.

HealthFirst material under `../references/healthfirst-example/` is read-only
reference material. It is not part of this product or its runtime code.

## Governance and presentation handoff

Adapted project information, social contract, work handover, QA checklist,
Miro reflection notes and the 19-slide onboarding deck are in
`../deliverables/`. They use this same API, PostgreSQL/SQLite boundary, Render
services and source-labelled OBIS context.

## Run locally

Start the API:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

Without `DATABASE_URL`, the API uses a local SQLite fallback. To test with a
PostgreSQL instance, set `DATABASE_URL` in your shell before starting the API.
Never commit a real connection string or `.env` file.

Serve the frontend from another terminal:

```powershell
cd frontend
python -m http.server 8080
```

Open `http://localhost:8080`. The frontend uses `http://localhost:5000` when
running locally.

## API

- `GET /health`
- `GET /api/observations`
- `POST /api/observations`
- `GET /api/context`

The API contract is documented in [docs/API.md](docs/API.md). The deploy and
data controls are documented in [docs/INTEGRATION_CHECKLIST.md](docs/INTEGRATION_CHECKLIST.md)
and [docs/DATA_MANAGEMENT_PLAN.md](docs/DATA_MANAGEMENT_PLAN.md).

## Render deployment

`../render.yaml` defines two services:

- Python API: `actual-project/backend`, built with `pip install -r requirements.txt`
  and started with Gunicorn.
- Static frontend: `actual-project/frontend`.

Set these API environment variables in Render:

- `DATABASE_URL`: the private Render PostgreSQL connection string. Add it in
  the Render dashboard; do not put its value in Git.
- `FRONTEND_ORIGINS`: `https://team04-marine-observation-frontend.onrender.com`
  (already declared in the Blueprint; update it if the frontend URL changes).

After deployment, verify `/health`, create one synthetic observation, refresh
the list and confirm that the record remains available.
