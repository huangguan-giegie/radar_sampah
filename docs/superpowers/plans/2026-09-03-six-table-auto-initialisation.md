# Six-table database auto-initialisation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Radar Sampah API create and idempotently populate the six Iteration 1 database tables at application startup without changing existing user or report data.

**Architecture:** Keep SQLAlchemy as the runtime schema authority so SQLite and PostgreSQL use the same Python definitions. Create `users`, `beaches`, `dim_threat`, `dim_species`, `area_species`, and `reports` with `metadata.create_all`, then seed only fixed beach and biodiversity reference rows from `data/beaches.json`; user/report demo rows remain opt-in and are never inserted into an existing deployment by default. Retain the legacy report rename/backfill path before table creation.

**Tech Stack:** Flask, SQLAlchemy 2, SQLite fallback, PostgreSQL via psycopg, pytest, JSON reference data.

## Global Constraints

- Preserve existing `users` and `reports` rows and the `frontend_reports` rename/backfill migration.
- Do not execute `seeds.sql` automatically for report rows or write synthetic reports into an existing database.
- Keep photo bytes outside the database and keep exact coordinates out of API responses.
- Keep old API routes and the current frontend contract unchanged.
- Make initialisation safe to run repeatedly and compatible with SQLite and PostgreSQL.

---

### Task 1: Define the six runtime tables

**Files:**
- Modify: `actual-project/backend/app.py`
- Test: `actual-project/backend/tests/test_api.py`

**Interfaces:**
- Produces `beaches_table`, `dim_threat_table`, `dim_species_table`, and `area_species_table` SQLAlchemy tables alongside existing `users_table` and `reports_table`.
- `initialise_database(engine)` creates all six tables without dropping or renaming an existing `reports` table except through the existing guarded legacy migration.

- [ ] **Step 1: Write the failing schema test**

```python
def test_startup_creates_all_six_contract_tables(tmp_path):
    application = create_app(
        database_url=f"sqlite:///{tmp_path / 'six-tables.db'}",
        testing=True,
        photo_storage_dir=tmp_path / "photos",
    )
    names = set(sqlalchemy_inspect(application.extensions["marine_engine"]).get_table_names())
    assert {"users", "beaches", "dim_threat", "dim_species", "area_species", "reports"} <= names
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `PYTHONPATH=actual-project/backend py -m pytest -q actual-project/backend/tests/test_api.py -k startup_creates_all_six_contract_tables`

Expected: FAIL because the current startup metadata creates only `users` and `reports`.

- [ ] **Step 3: Add portable SQLAlchemy table definitions**

Add the four reference tables using `String` identifiers for UUID-compatible values, nullable foreign keys for habitat/group cards, and the same allowed values documented in `schema.sql`. Add `ForeignKey("beaches.id")` to `reports_table.c.beach_id` for new databases while preserving the existing column name and data.

- [ ] **Step 4: Run the schema test and the existing backend suite**

Run: `PYTHONPATH=actual-project/backend py -m pytest -q actual-project/backend/tests`

Expected: the new schema test and all existing tests pass.

- [ ] **Step 5: Commit the runtime schema change**

```powershell
git add actual-project/backend/app.py actual-project/backend/tests/test_api.py
git commit -m "feat: initialise six database tables at startup"
```

### Task 2: Seed fixed reference data idempotently

**Files:**
- Modify: `actual-project/backend/app.py`
- Test: `actual-project/backend/tests/test_api.py`
- Modify: `actual-project/backend/README.md`

**Interfaces:**
- Adds `seed_reference_data(engine, beaches)` that inserts four beaches and the biodiversity cards represented in `data/beaches.json`.
- Repeated application startup leaves row counts and values unchanged.
- No report seed row is inserted unless an explicit future migration command is run.

- [ ] **Step 1: Write the failing seed test**

```python
def test_startup_seeds_reference_tables_idempotently(tmp_path):
    database_url = f"sqlite:///{tmp_path / 'reference.db'}"
    first = create_app(database_url=database_url, testing=True, photo_storage_dir=tmp_path / "photos")
    second = create_app(database_url=database_url, testing=True, photo_storage_dir=tmp_path / "photos")
    engine = second.extensions["marine_engine"]
    with engine.connect() as connection:
        assert connection.execute(select(func.count()).select_from(beaches_table)).scalar_one() == 4
        assert connection.execute(select(func.count()).select_from(area_species_table)).scalar_one() == 11
        assert connection.execute(select(func.count()).select_from(reports_table)).scalar_one() == 0
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `PYTHONPATH=actual-project/backend py -m pytest -q actual-project/backend/tests/test_api.py -k seeds_reference_tables_idempotently`

Expected: FAIL because the current process reads `beaches.json` without inserting reference rows.

- [ ] **Step 3: Implement one idempotent reference seeder**

Use deterministic identifiers derived from beach ID and scientific/display name. Insert with a dialect-neutral existence check inside one transaction, insert two real scientific species only, and keep pending/unavailable source fields exactly as represented by the JSON. Do not insert `r1`–`r4` reports or alter existing reports.

- [ ] **Step 4: Call the seeder after table creation and before `load_beaches`**

Keep `migrate_legacy_reports_table`, `metadata.create_all`, `ensure_report_columns`, and `repair_existing_reports` in their existing order; run the reference seeder only after the tables exist. Ensure a pre-existing database with populated tables is not overwritten.

- [ ] **Step 5: Document the boundary and run tests**

Update `backend/README.md` to state that startup creates six tables and seeds fixed reference rows, while `seeds.sql` remains a manual report/demo fixture that is not executed automatically. Run: `PYTHONPATH=actual-project/backend py -m pytest -q actual-project/backend/tests`.

- [ ] **Step 6: Commit the reference-data change**

```powershell
git add actual-project/backend/app.py actual-project/backend/tests/test_api.py actual-project/backend/README.md
git commit -m "feat: seed beach and biodiversity reference data"
```

### Task 3: Migration safety and deployment verification

**Files:**
- Modify: `actual-project/backend/tests/test_api.py`
- Modify: `actual-project/backend/README.md`

**Interfaces:**
- Application startup is the normal cross-engine migration path; `schema.sql` and `seeds.sql` remain reviewable manual PostgreSQL fixtures.
- Existing `frontend_reports` data remains readable through `reports` after startup.

- [ ] **Step 1: Add a legacy-data regression test**

Extend the existing partial-main database test to assert that all six table names exist after startup and that the two legacy report rows remain present with their repaired statuses.

- [ ] **Step 2: Run the legacy-data regression test**

Run: `PYTHONPATH=actual-project/backend py -m pytest -q actual-project/backend/tests/test_api.py -k partial_main_database`

Expected: PASS after Tasks 1–2; the test protects the already implemented rename/backfill behavior.

- [ ] **Step 3: Keep manual SQL fixtures explicit**

Retain `schema.sql` as the full PostgreSQL contract and `seeds.sql` as a manual fixture. The application seeder is the portable implementation because the checked-in SQL uses PostgreSQL-only types and must not be executed against the SQLite fallback. The README states that report seed rows are excluded from automatic startup.

- [ ] **Step 4: Run the complete backend verification**

Run:

```text
PYTHONPATH=actual-project/backend py -m pytest -q
python -m compileall -q actual-project/backend
```

Expected: all backend tests pass and bytecode compilation exits successfully.

- [ ] **Step 5: Commit and record the migration**

```powershell
git add actual-project/backend/tests/test_api.py actual-project/backend/README.md
git commit -m "docs: record safe reference-table migration"
```

### Task 4: Read-only deployment check

**Files:**
- No production files are changed by this task.

- [ ] **Step 1: Start a temporary local SQLite instance from the branch**

Run the API with a temporary database and verify the six table names using SQLAlchemy inspection.

- [ ] **Step 2: Check the public deployment without writing data**

Request `/health`, `/beaches`, `/scoring-method`, restore participant `1637`, and `/reports/mine/counts`. Confirm existing report counts are unchanged.

- [ ] **Step 3: Record rollback information**

Keep the pre-change commit tag and revert the two implementation commits if startup or report-history verification fails. Do not run report seeds against the deployed database.

## Implementation result (2026-09-03)

- `app.py` now defines and creates all six tables through SQLAlchemy.
- Startup seeds four beaches and eleven biodiversity cards from `data/beaches.json` only when missing.
- Existing users, reports, and legacy `frontend_reports` migration behavior are preserved.
- `seeds.sql` remains manual; its synthetic report rows are never added automatically.
- Standard `schema.sql` databases receive the two legacy runtime compatibility columns (`beach_name`, `quantities`) on startup.
- Runtime table definitions include the contract value checks, foreign keys and indexes for new databases; reference inserts use native SQLite/PostgreSQL conflict handling.
- Backend verification completed with 39 passing tests and successful bytecode compilation; frontend verification completed with 48 tests, typecheck and production build.
