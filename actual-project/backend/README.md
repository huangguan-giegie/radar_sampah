# Radar Sampah API

This Flask API supports the Radar Sampah student demo: broad-area litter
reports, a clearly labelled recognition suggestion, broad heatmap summaries,
anonymous cleanup-mission joins, illustrative evidence and community progress.
It does not accept personal details or exact coordinates.

The active API does not expose the earlier sample routes. The old runtime can
still be recovered from the repository rollback tags when needed.

## Local setup

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

The development server listens on `http://localhost:5001` by default. Set
`PORT` to override it when needed.

## Storage

- `DATABASE_URL` selects PostgreSQL; absent means the local SQLite fallback.
- Schema setup is idempotent and keeps the current Radar Sampah tables.
- Active Radar Sampah tables cover litter reports, cleanup missions, anonymous
  joins and cleanup evidence. Recognition results may be stored separately as
  demo metadata.
- No name, email, phone, account, password, API key, exact coordinate or raw
  image file is stored. Image references must be HTTPS or `/assets/` demo
  paths.

## Render settings

- `FRONTEND_ORIGINS`: deployed frontend URL.
- `DATABASE_URL`: private Render database connection string.
- `AUTH_JWT_SECRET`: required private signing secret for anonymous demo tokens.
- `LITTER_RECOGNITION_ENABLED`: `false` by default. Only exact `true` can
  enable a provider request.
- `LITTER_RECOGNITION_API_URL`: private HTTPS provider URL, only used when
  enabled.
- `LITTER_RECOGNITION_API_KEY`: private provider key; never commit or return it.
- `LITTER_RECOGNITION_TIMEOUT_MS`: provider timeout; default `4000`.

Without an enabled HTTPS provider, recognition returns a deterministic demo
fallback. It is not verified litter classification, pollution attribution,
cleanup instruction or enforcement evidence.

## Active endpoints

- `GET /health`
- `POST /auth/anonymous`
- `POST /auth/restore`
- `GET /auth/me`
- `POST /auth/logout`
- `GET /api/litter-options`
- `GET/POST /api/litter-reports`
- `POST /api/litter-recognize`
- `GET /api/litter-heatmap`
- `GET /api/cleanup-missions`
- `POST /api/cleanup-missions/<mission_id>/join`
- `POST /api/cleanup-evidence`
- `GET /api/community-progress`

Read `../docs/API.md` for the full demo contract and privacy boundary.

Anonymous access uses a four-digit participant number for this small demo only.
It is not a full account system. Logout removes the token on the client; the
server does not maintain a revocation list.
