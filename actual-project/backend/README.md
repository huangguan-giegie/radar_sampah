# Marine Observation API

This Flask API records synthetic/public marine-litter observations and returns
transparent, illustrative results. It does not use external AI, computer
vision, health data or HealthFirst code.

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
- Schema initialisation must be idempotent and must create `observations`,
  `observation_classifications`, `observation_priorities` and `marine_context`.
- Do not store names, contact details, account identifiers, secrets or raw
  uploaded image files. `image_url` is optional and must be an approved demo
  path or HTTPS URL.

For Render, set `DATABASE_URL` manually in the service environment variables.
The value is a secret and must never be committed.

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
  category examples and coarse area suggestions. It does not expand the
  five-category MVP or claim that the suggestions are litter survey sites.

See `../docs/API.md` for request and response details.
