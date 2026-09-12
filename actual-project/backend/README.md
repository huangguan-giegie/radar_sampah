# Radar Sampah API

This Flask API keeps the Iteration 1 contract in
[`../frontend/API.en.md`](../frontend/API.en.md) and adds Iteration 2 endpoints
specified in [`API_ITERATION2.md`](API_ITERATION2.md): local litter recognition,
remaining-count cleanup targets, append-only partial cleanup actions, community
events, moderator event management and attendance checks. It does not collect
names, email addresses, phone numbers or passwords.

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
  `frontend_reports` table to `reports`, then adds the Iteration 2 fields and
  tables without deleting existing report rows.
- For a controlled PostgreSQL release, run
  [`migrations/001_rename_frontend_reports_to_reports.sql`](migrations/001_rename_frontend_reports_to_reports.sql).
  Its commented **DOWN** block is the rollback plan: first roll back the app,
  then rename `reports` back only when `frontend_reports` does not exist.
- Legacy reports may contain coordinates rounded to three decimal places. New
  Iteration 2 reports never persist raw coordinates; for GPS duplicate-target
  checks they store a target-scoped HMAC of a one-metre grid cell. No API
  response serialises report `lat` or `lng`. Set `GEO_PRIVACY_HMAC_KEY` to a
  stable random secret in production.
- Photo bytes live outside the public web root. `PHOTO_STORAGE_DIR` selects that
  private directory; the default is an OS temporary directory for local demos.
- Photos are re-encoded without EXIF, resized to a maximum 2048 px edge and
  returned only through owner-scoped links that expire after 15 minutes.
- The original report photo remains private for audit. Optional after-cleanup
  photos are sent to inference from memory and are not retained.
- Anonymous signup returns a `recoveryToken` once. The database stores only its
  SHA-256 digest. Use `scripts/provision_moderator.py` to create an activity
  administrator; the moderator role can manage events but does not review
  reports in this iteration.
- Model weights are Git LFS-managed. The checkout must include the real
  `sea_taco_yolo11m_best.pt` file, and the backend deployment must install
  `requirements-ml.txt` to enable YOLO. If either is missing, the API remains
  available and the recognition response requests manual counts.

## Render settings

- `FRONTEND_ORIGINS`: deployed frontend URL.
- `DATABASE_URL`: private Render database connection string.
- `AUTH_JWT_SECRET`: required private signing secret for anonymous demo tokens.
- `DEMO_PARTICIPANT_ID`: optional private deployment setting for a controlled
  demo account (for example `1637`). When set, startup creates that empty
  volunteer row only if it is missing; only this demo identity can be restored
  by participant ID alone. Normal identities require the recovery token.
- `PHOTO_STORAGE_DIR`: optional private, persistent photo directory. Production
  must point this at persistent storage outside the public web root.
- `GEO_PRIVACY_HMAC_KEY`: stable private key used to produce proximity
  references. Configure a random value before deploying Iteration 2.
- `LITTER_MODEL_PATH`, `LITTER_MODEL_VERSION`: optional model file and version
  overrides.

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
- `GET /scoring-method/iteration2`
- `POST /recognitions`
- `POST /recognitions/cleanup-photo`
- `GET /cleanup-targets`
- `POST /cleanup-actions`
- `GET /cleanups/mine`
- `GET /events`, `GET /events/<id>`
- `POST /events`, `PATCH /events/<id>` (moderator)
- `POST /events/<id>/join`, `POST /events/<id>/check-in`

Read `../frontend/API.en.md` for the existing Iteration 1 contract,
`API_ITERATION2.md` for the Iteration 2 contract and privacy boundary.

Anonymous access uses a four-digit participant number for this small demo only.
It is not a full account system. Logout removes the token on the client; the
server does not maintain a revocation list.

When `DEMO_PARTICIPANT_ID` is configured, that demo number is a public demo
credential: anyone who knows it can restore that anonymous identity. Do not use
it with personal data.
