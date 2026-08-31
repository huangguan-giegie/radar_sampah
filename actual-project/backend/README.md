# Radar Sampah API

This Flask API implements the Iteration 1 contract in
[`../frontend/API.en.md`](../frontend/API.en.md): anonymous participant access,
beach summaries, private photo uploads and multi-category litter reports.
It does not collect names, email addresses, phone numbers or passwords.

The active API does not expose the earlier sample routes. The old runtime can
still be recovered from the repository rollback tags when needed.

## Local setup

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

The development server listens on `http://localhost:5000` by default.

## Storage

- `DATABASE_URL` selects PostgreSQL; absent means the local SQLite fallback.
  PostgreSQL tables use the database's default schema unless an already-created
  schema is explicitly selected with `DATABASE_SCHEMA`.
- Schema setup is idempotent. On startup it safely renames a legacy
  `frontend_reports` table to `reports`, then backfills the contract fields and
  quantity columns without deleting report rows.
- For a controlled PostgreSQL release, run
  [`migrations/001_rename_frontend_reports_to_reports.sql`](migrations/001_rename_frontend_reports_to_reports.sql).
  Its commented **DOWN** block is the rollback plan: first roll back the app,
  then rename `reports` back only when `frontend_reports` does not exist.
- GPS reports store only coordinates rounded to three decimal places. No API
  response serialises report `lat` or `lng`.
- Photo bytes live outside the public web root. `PHOTO_STORAGE_DIR` selects that
  private directory; the default is an OS temporary directory for local demos.
- Photos are re-encoded without EXIF, resized to a maximum 2048 px edge and
  returned only through owner-scoped links that expire after 15 minutes.

## Render settings

- `FRONTEND_ORIGINS`: deployed frontend URL.
- `DATABASE_URL`: private Render database connection string.
- `AUTH_JWT_SECRET`: required private signing secret for anonymous demo tokens.
- `PHOTO_STORAGE_DIR`: optional private, persistent photo directory. Production
  must point this at persistent storage outside the public web root.

## Active endpoints

- `GET /health`
- `POST /auth/anonymous`
- `POST /auth/restore`
- `GET /auth/me`
- `POST /auth/logout`
- `GET /beaches`
- `GET /beaches/<id>`
- `GET /scoring-method`
- `POST /geo/resolve-beach`
- `POST /uploads/photos`
- `POST /reports`
- `GET /reports/mine`
- `GET /reports/mine/counts`
- `PATCH /reports/<id>`

Read `../frontend/API.en.md` for the full contract and privacy boundary.

Anonymous access uses a four-digit participant number for this small demo only.
It is not a full account system. Logout removes the token on the client; the
server does not maintain a revocation list.
