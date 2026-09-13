# Radar Sampah API

This Flask API keeps the frontend contract from commit `1a113fbb1f900192e4cf0ec0d1620abc7cba309f` in
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
- The Iteration 2 extension adds actual item counts, privacy-preserving proximity
  references, event links and community cleanup tables without deleting existing
  report rows. Legacy integer quantity columns are migrated to the contract's
  text bands (`Small` through `Very Large`).
- For a controlled PostgreSQL release, run
  [`migrations/001_rename_frontend_reports_to_reports.sql`](migrations/001_rename_frontend_reports_to_reports.sql).
  Its commented **DOWN** block is the rollback plan: first roll back the app,
  then rename `reports` back only when `frontend_reports` does not exist.
- For an existing latest-main database, run
  [`migrations/002_add_iteration2.sql`](migrations/002_add_iteration2.sql) after
  migration 001. It adds the Iteration 2 columns and tables and converts any
  legacy numeric quantity codes to the current text bands.
- Legacy reports may contain coordinates rounded to three decimal places. New
  Iteration 2 reports never persist raw coordinates; for GPS duplicate-target
  checks they store a target-scoped HMAC of a one-metre grid cell. No API
  response serialises report `lat` or `lng`. Set `GEO_PRIVACY_HMAC_KEY` to a
  stable random secret in production.
- Photo bytes live outside the public web root. `PHOTO_STORAGE_DIR` selects that
  private directory; the default is an OS temporary directory for local demos.
- Photos are re-encoded without EXIF and resized to a maximum 2048 px edge.
  Original reports stay private except when their owner creates a scoped public
  share link; owner-only photo URLs expire after 15 minutes.
- The original report photo remains private for audit. Optional after-cleanup
  photos are sent to inference from memory and are not retained.
- Anonymous signup returns a `recoveryToken` once. The database stores only its
  SHA-256 digest. Use `scripts/provision_moderator.py` to create an activity
  administrator; the moderator role can add event dates but cannot edit or
  cancel events and does not review reports in this iteration.
- Model weights are Git LFS-managed. The checkout must include the real
  `sea_taco_yolo11m_best.pt` file, and the backend deployment must install
  `requirements-ml.txt` to enable YOLO. If either is missing, the API remains
  available and the recognition response requests manual counts.
- Four packaged OBIS species-distribution models load once per process. Their
  endpoint needs the scientific Python dependencies in `requirements.txt`; it
  returns relative occurrence context and never persists coordinates or scores.

## Render settings

- `FRONTEND_ORIGINS`: deployed frontend URL.
- `DATABASE_URL`: private Render database connection string.
- `AUTH_JWT_SECRET`: required private signing secret for anonymous demo tokens.
- `DEMO_PARTICIPANT_ID`: optional private deployment setting for a controlled
  demo account (for example `1637`). When set, startup creates that empty
  volunteer row only if it is missing. The current main contract restores by
  participant ID; an optional recovery token from older clients is validated.
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
- `POST /api/species-distribution/predict`
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
- `GET /share-links`, `GET /share-links/{token}`, `GET /share-links/{token}/photo`
- `POST /cleanup-actions`
- `GET /cleanups/mine`
- `GET /events`, `GET /events/<id>`, `GET /events/<id>/cleanups`
- `POST /events` (moderator; event creation only)
- `POST /events/<id>/join`, `POST /events/<id>/check-in`

Read `../frontend/API.en.md` for the existing Iteration 1 contract,
`API_ITERATION2.md` for the Iteration 2 contract and privacy boundary.

The species-distribution endpoint serves a four-model offline OBIS snapshot baseline. Its scores
are relative occurrence/suitability context, not calibrated probabilities or real-time OBIS
results, and they do not affect litter severity or report status.

Anonymous access uses a four-digit participant number for this small demo only.
It is not a full account system. Logout removes the token on the client; the
server does not maintain a revocation list.

When `DEMO_PARTICIPANT_ID` is configured, that demo number is a public demo
credential: anyone who knows it can restore that anonymous identity. Do not use
it with personal data.
