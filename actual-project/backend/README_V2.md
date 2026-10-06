# Iteration 3 backend for frontend v2

Based on frontend v2 (`ca566fa`), reusing the reviewed Flask/SQLAlchemy report,
photo, cleanup, privacy and model implementations. This version adds the 101
reference beaches, real Insights, persistent nicknames, optional leaderboard
participation and durable contribution history. Startup inserts reference
content only; it never inserts sample reports or demo ratings.

## Local review on Windows

Use Python 3.13; Node 22 is needed only to rebuild the frontend.

From `actual-project/backend`:

```powershell
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.txt
.venv/Scripts/python.exe scripts/prepare_local.py
.venv/Scripts/python.exe scripts/check_runtime_assets.py
```

From `actual-project/frontend`, run `npm ci` then `npm run build`. The delivery
ZIP includes the built frontend, so ZIP recipients can skip this build and Node
installation for local review.

From `actual-project/backend`, run `.venv/Scripts/python.exe wsgi.py` and open
<http://127.0.0.1:5000>. The UI and API share one origin. For frontend editing,
also run `npm run dev`: Vite forwards `/api` to port 5000.

Local preparation creates ignored `.env` and frontend `.env.local` files, keeping
existing settings unchanged. `VITE_API_BASE_URL=/api` enables the real backend;
an empty value explicitly selects the old mock preview. SQLite data lives in
`backend/radar_sampah.db`. Keep the generated secret stable across restarts.
Secrets, databases, accounts and uploaded photos are excluded from Git/packages.

## Deployment

The root Dockerfile builds v2 with `VITE_API_BASE_URL=/api` and uses one public
service for frontend and backend. The root Render Blueprint uses Docker and
checks `/api/health`. Supply a PostgreSQL `DATABASE_URL` in Render; signing and
location HMAC secrets are generated once by the Blueprint. Production startup
requires a database URL. It must use PostgreSQL rather than ephemeral SQLite.

A database is not automatically provisioned. Use a new database for a clean
installation, or set `DATABASE_SCHEMA=radar_v2` to test in a separate schema on
an existing instance. Tables/reference rows are initialized idempotently while
preserving report data. A configured schema is created if absent; the database
role needs CREATE permission for this first startup (or a DBA can create and
grant access to the schema in advance). New photos are stored privately in the database and
survive redeployment with report records.

The active database contract is `schema.sql`, not the historical Iteration 1
data plan or the unused `participant_profiles`/quiz modules. Existing databases
can apply `migrations/003_add_account_attendance.sql` after migration 002,
using the configured application schema on `search_path`. Startup also creates
these tables and the optional meeting point idempotently.

| API data | PostgreSQL tables |
| --- | --- |
| Anonymous sign-in and recovery | `users` |
| Beach and biodiversity references | `beaches`, `dim_threat`, `dim_species`, `area_species` |
| Reports and private uploaded photos | `reports`, `report_photos` |
| Cleanup records | `cleanup_actions` |
| Events, membership and successful check-in | `community_events`, `community_event_members`, `community_event_attendance` |
| Account nickname and leaderboard consent | `account_profiles` |

Retained beach rows without coordinates remain readable and selectable manually.
GPS resolution skips these rows; event check-in returns `409 LOCATION_UNAVAILABLE`
without recording attendance. The connection pool checks idle connections before
reuse so a server-closed connection is replaced before a new query starts. A
connection lost during an active transaction still returns an error.

For another Docker host, run from the repository root:

```text
git lfs pull
docker build -t radar-sampah-v2 .
docker run --env-file production.env -p 5000:5000 radar-sampah-v2
```

`production.env` needs `DATABASE_URL` and `AUTH_JWT_SECRET`. Optional settings:
stable `GEO_PRIVACY_HMAC_KEY` and `DATABASE_SCHEMA`. Keep this file private.
The build checks actual model bytes and fails clearly on Git LFS pointers.
Gunicorn uses one worker/four threads with ONNX CPU inference; training data,
PyTorch and Ultralytics are not needed to run this backend.

Local checks verify SQLite, the built frontend, routes and loaded models.
Docker image execution, real PostgreSQL migration and a successful Render
deployment need the corresponding runtime/provider and are separate checks.

## New API contracts

`app:create_app()` keeps the existing unprefixed API. `wsgi:create_app()` serves
the full site and mounts the API under `/api`. This means the existing species
route is `/api/api/species-distribution/predict` on the full site; the current
frontend already constructs this path correctly.

| Direct API route | Access | Result |
| --- | --- | --- |
| `GET /insights?beachId=optional` | Public | Report/cleanup aggregates, bands, dates, monthly counts, participation and reference context |
| `GET /account/profile` | Bearer session | Own nickname, opt-in preference, points and rank |
| `PATCH /account/profile` | Bearer session | Persist `{nickname?, joinedLeaderboard?}` |
| `GET /account/contributions` | Bearer session | Own counts and history, including past event attendance |
| `GET /leaderboard` | Public | Opted-in nicknames, points and ranks only |
| `GET /health` | Public | Queries database; returns 503 on database failure |
| `GET /beaches/cleanup-history` | Public | Latest cleanup dates for every registered beach in one request |

Points: +1 per nondeleted Counted report, +5 per confirmed event attendance.
Duplicate/incomplete reports add no points. Past attendance remains counted.
Leaving the leaderboard removes the public entry, preserving private history.
Public responses exclude participant IDs, recovery tokens and raw locations.

Insights calculates statistics deterministically from saved data. Ratings need
three active Counted reports in the latest 90 days. The 30-day comparison is
labelled a reconstruction from stored report values and cleanup dates because
historical report edits are not archived. Category shares describe weighted
quantity bands, not literal litter-item counts. A recurrence interval records
the next Counted report anywhere at that beach after a recorded cleanup. It is
not a forecast or proof that litter returned at the cleaned spot.
Volunteer recommendations apply the same H15 rule as Community.

Marine-life data remains published reference context, not a live sighting or
measured litter impact. The four OBIS models return relative occurrence scores,
not calibrated probabilities. All 38 frontend species retain reference images
and source credits. Coordinates are approximate published beach reference points.
To refresh nonpilot references from frontend content, run
`python scripts/sync_v2_catalogue.py`; preview metrics are never copied.

## Verification

Backend: `.venv/Scripts/python.exe -m pytest tests -q`.
Frontend: `npm run build` and `npm test`.

Tests cover migrations, recovery/authentication, private photos, report updates,
duplicates, active scoring, locked cleanup eligibility/idempotency, events,
sharing, species boundaries, profile privacy, past attendance, Insights,
all 101 beaches with no reports, and same-origin SPA/API/photo routing.
