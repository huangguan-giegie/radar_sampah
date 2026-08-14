# DiveSafe MY - Team 04 Student MVP

## Purpose

DiveSafe MY is a small student MVP for divers in Malaysia. It helps a user
pick a broad demo site, read a short wildlife briefing and record a synthetic
sighting. It is a learning demo, not a permit, guide or scientific system.

The demo flow is:

`Profile -> Dive site -> Species guide -> Briefing -> Confirm -> Sighting`

## Current boundary

- Demo profiles use a nickname, experience level and interests only.
- Dive sites and species use source-labelled public or synthetic data.
- Site locations are coarse. Exact sensitive wildlife locations are never
  accepted, stored or returned.
- Leaflet shows broad demo pins. The same information is available as a list
  when the map is unavailable.
- Briefings cover calm entries, buoyancy, reef care, no-touch behaviour and
  checking local rules before a real dive.
- A sighting stores a site ID, species ID, date and short note only.
- Collection cards and badges are illustrative. They are not proof of a
  species record, ecological change or an enforcement decision.

The old marine-litter routes and tables remain as a rollback layer. They are
not part of the new screen flow and are not removed destructively.

`POST /api/recognize` is optional. Without a private HTTPS adapter it returns
a clear demo suggestion. It is not verified species identification.

HealthFirst material under `../references/healthfirst-example/` is read-only
reference material. It is not product code or evidence.

## Project spaces

- Real Project Drive: https://drive.google.com/drive/folders/18Px2njE27SCiZ4bs-40zgUgm_sRE70Kx
- GitHub: https://github.com/huangguan-giegie/team04-marine-observation-mvp
- Render frontend: https://team04-marine-observation-frontend.onrender.com
- Render API: https://team04-marine-observation-api.onrender.com
- Miro: https://miro.com/app/board/uXjVHySKbPY=/

The Sample Project PGIE was not modified.

## Run locally

Start the API:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

Without `DATABASE_URL`, the API uses SQLite. For Render, set
`DATABASE_URL` privately. Never commit a connection string or `.env` file.

Serve the frontend in another terminal:

```powershell
cd frontend
python -m http.server 8080
```

Open `http://localhost:8080`. The local frontend uses
`http://localhost:5000` for the API.

## API overview

Active DiveSafe routes:

- `GET /health`
- `GET /api/dive-sites`
- `GET /api/species` and `GET /api/species/<site_id>`
- `GET /api/briefing/<site_id>`
- `POST /api/profile`
- `POST /api/recognize`
- `POST /api/sightings`
- `GET /api/sightings` and `GET /api/collection/<profile_id>`

Legacy routes remain available for rollback: `/api/observations`,
`/api/context` and `/api/options`. The full contract is in `docs/API.md`.

## Render deployment

`../render.yaml` defines a Gunicorn Flask API and a static frontend. Render
uses PostgreSQL through `DATABASE_URL`; local work falls back to SQLite.
`FRONTEND_ORIGINS` should contain the frontend URL.

Recognition is deliberately optional. `RECOGNITION_ADAPTER_URL` or the
`SPECIES_RECOGNITION_API_*` variables may be set only after the team approves
the provider and its data flow. Values stay in Render, not in Git or Drive.

After a deploy, check `/health`, the site and species catalogues, one synthetic
profile, one sighting, refresh reads and the retry path. Keep all demo wording
visible.

## Release check — 15 August 2026

`main` commit `73f133f` is the DiveSafe MY switch. The live API returned the
health, site, species and briefing responses after the Render redeploy. A
synthetic profile, demo recognition fallback and sighting were created, then
read back from PostgreSQL; the fallback response stayed marked
`needs_user_confirmation: true`.
