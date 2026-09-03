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
- Schema setup is idempotent. On startup the API creates the six contract tables
  (`users`, `beaches`, `dim_threat`, `dim_species`, `area_species`, and
  `reports`), safely renames a legacy `frontend_reports` table to `reports`,
  backfills the contract fields (including the legacy `beach_name` and
  `quantities` compatibility columns) and quantity columns, and inserts the
  fixed beach/biodiversity reference rows when they are missing. Existing
  report rows are never deleted or overwritten.
- New databases receive the value checks, foreign keys and indexes defined in
  `schema.sql`. Reference inserts use database-native conflict handling, so
  concurrent application starts remain safe and repeatable.
- `seeds.sql` remains a manual PostgreSQL fixture for the optional demo user and
  report rows. It is intentionally not run during application startup, so a
  deploy cannot add synthetic reports to an existing database.
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
- `DEMO_PARTICIPANT_ID`: optional private deployment setting for a controlled
  demo account (for example `1637`). When set, startup creates that empty
  volunteer row only if it is missing; normal anonymous registration remains
  random. This is for synthetic mentor-check data only.
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

When `DEMO_PARTICIPANT_ID` is configured, the configured number is a public demo
credential: anyone who knows it can restore that anonymous identity. Do not use
it with personal or production data.
