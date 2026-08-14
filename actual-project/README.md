# TideTrace MY - Team 04 Student MVP

## Purpose

TideTrace MY is a short student demo for marine-litter reporting and cleanup
planning in Malaysia. It uses a broad area, one fixed litter category and a
short note. Results, map context, mission activity and progress are
illustrative. They are not survey evidence, a dispatch service or enforcement.

The active demo flow is:

`Report -> Recognize -> Heatmap -> Join mission -> Evidence -> Progress`

## Current boundary

- Use synthetic/public demo data only.
- No names, contacts, accounts, passwords, secrets or exact coordinates.
- A report stores a broad `area_id`, category, optional safe image URL and
  short note.
- Recognition is a labelled fallback by default. It is never verified proof.
- Missions and evidence are demo planning/counting records, not real cleanup
  verification.
- DiveSafe MY routes and data remain as legacy rollback material. Do not remove
  them destructively or present them as TideTrace functionality.

## Run locally

Start the API:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

Without `DATABASE_URL`, the API uses SQLite. Serve the frontend separately:

```powershell
cd frontend
python -m http.server 8080
```

Open `http://localhost:8080`. The local frontend uses `http://localhost:5000`.

## Render deployment

`../render.yaml` defines the API and static frontend. `DATABASE_URL` and
`LITTER_RECOGNITION_API_KEY` stay private in Render. `FRONTEND_ORIGINS` should
contain the frontend URL.

Recognition stays off with `LITTER_RECOGNITION_ENABLED=false`. A provider is
allowed only with exactly `true` plus a private HTTPS
`LITTER_RECOGNITION_API_URL`; `LITTER_RECOGNITION_TIMEOUT_MS` defaults to
`4000`. Never commit a connection string, key or `.env` file.

After deployment, check `/health`, the options and heatmap, one synthetic
report, the fallback detection, one mission join, one evidence record and
community progress. Keep demo wording visible.
