# DiveSafe MY API — Legacy Marine Observation Baseline

This Flask API provides the DiveSafe MY demo flow: a diver profile, coarse
dive-site directory, responsible briefing, species directory and synthetic
sighting record. Earlier marine-litter endpoints and storage remain as legacy
compatibility paths. It does not use health data or HealthFirst code.

The low-AI boundary is deliberate: `POST /api/recognize` can call an optional
HTTPS adapter only when `RECOGNITION_ADAPTER_URL` is configured. Otherwise it
returns a deterministic local demo fallback. It is not a verified AI species
identification result and uses no stored provider key.

## Local setup

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

The development server listens on `http://localhost:5000` by default.

## Storage

- If `DATABASE_URL` is set, use PostgreSQL.
- If it is not set, use the local SQLite fallback for development.
- Schema initialisation must be idempotent. It creates the legacy
  `observations`, `observation_classifications`, `observation_priorities` and
  `marine_context` tables, plus `demo_profiles`, `dive_sites`, `species`,
  `site_species`, `briefings`, `sightings`, `recognition_results`,
  `species_collections` and `contributor_badges` for DiveSafe.
- Do not store names, contact details, account identifiers, secrets or raw
  uploaded image files. `image_url` is optional and must be an approved demo
  path or HTTPS URL.

For Render, set `DATABASE_URL` manually in the service environment variables.
The value is a secret and must never be committed.

`FRONTEND_ORIGINS` is the other active deployment setting.
`RECOGNITION_ADAPTER_URL` is optional, private and HTTPS-only; leave it unset
for the normal local-demo fallback.

## Endpoints

- `GET /health` returns a service health response.
- `GET /api/observations` returns stored observations and their saved derived
  results.
- `POST /api/observations` validates and saves one confirmed observation,
  computes its fixed-category classification and illustrative priority, then
  returns the result.
- `GET /api/context` returns the five-record static OBIS Malaysia-region
  context bundle (`obis-malaysia-public-2026-08-14-v1`) with sensitive
  locations masked or aggregated. The bundle is copied into the database at
  startup; the deployed API does not depend on a live OBIS request.
- `GET /api/options` returns the source-labelled form catalogue used for
  category examples and five coarse area suggestions. The frontend renders
  these area values as a native select, not as free-text survey locations. It
  does not expand the five-category MVP or claim that the suggestions are
  litter survey sites.

See `../docs/API.md` for request and response details.
