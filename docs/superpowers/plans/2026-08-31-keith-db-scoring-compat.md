# Keith DB Scoring Compatibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Merge Keith's database migration into the current deployed main without regressing the Max + Median scoring contract or frontend report API.

**Architecture:** Keep the current frontend contract and scoring behavior as the source of truth. Use an idempotent startup migration from `frontend_reports` to `reports`, with six quantity columns backfilled from the legacy JSON field; read and write the new table after migration while preserving private-field and legacy-route rules. Keep PostgreSQL on its existing default schema unless an explicitly configured schema exists.

**Tech Stack:** Flask 3, SQLAlchemy 2, PostgreSQL/SQLite, pytest, React/Vite, TypeScript, Vitest, Render.

## Global Constraints

- Do not rewrite Git history or delete existing report data.
- Preserve Max(Category Score) per report and Median eligible report scores per beach.
- Preserve `categoryScores`, `reportScore`, `attentionScore`, `eligibleReportCount` and legacy `/api/*` routes.
- Do not persist or expose personal identifiers, exact public coordinates, photo bytes or secrets.
- Keep `ppt-render-check/`, bridge artifacts and unrelated project files untouched.

### Task 1: Establish the integration baseline

**Files:**
- Modify: `actual-project/backend/tests/test_api.py`
- Modify: `actual-project/backend/app.py`

- [ ] **Step 1: Confirm baseline commit and branch**

Run `git rev-parse HEAD` and `git rev-parse origin/main`; expected current main is `7de8fdb`.

- [ ] **Step 2: Add a failing migration/scoring regression test**

Add a SQLite fixture that creates a legacy `frontend_reports` row with JSON quantities, starts the app, asserts a `reports` table contains the row with `qty_plastic`/`qty_fishing_gear`, and asserts the beach response still exposes the v2 scoring fields. Add an assertion that a three-report set uses the median of `reportScore` values rather than a mean.

- [ ] **Step 3: Run the new tests and confirm RED**

Run `py -m pytest -q tests/test_api.py -k "migration or median"` from `actual-project/backend`. Expected: failure because the current app has no `reports` migration path.

### Task 2: Integrate the database layout without data loss

**Files:**
- Modify: `actual-project/backend/app.py`
- Create: `actual-project/backend/migrations/001_rename_frontend_reports_to_reports.sql`
- Modify: `actual-project/backend/README.md`
- Modify: `render.yaml`

- [ ] **Step 1: Add the table mapping and migration guard**

Define `QUANTITY_COLUMNS`, `reports_table`, `migrate_legacy_reports_table()`, `ensure_report_columns()` and `repair_existing_reports()`. Rename only when `frontend_reports` exists and `reports` does not; fail clearly if both exist. Backfill quantity columns and preserve `Counted`, `Duplicate` and `Incomplete` status semantics.

- [ ] **Step 2: Keep PostgreSQL schema compatibility**

Make `DATABASE_SCHEMA` optional. Use the existing default PostgreSQL schema when it is unset; only apply a schema translation when the configured schema is valid and already available. Do not force a new schema in the Render blueprint.

- [ ] **Step 3: Add the controlled SQL migration and rollback note**

Keep the idempotent `reports` rename migration and a manual DOWN block that is only run after rolling the application back. Document that the app startup guard is the safety net for existing SQLite/Render deployments.

- [ ] **Step 4: Run the migration regression test and full backend tests**

Run `py -m pytest -q`. Expected: all existing and new tests pass.

### Task 3: Restore the current scoring and report contract on the migrated table

**Files:**
- Modify: `actual-project/backend/app.py`
- Modify: `actual-project/backend/tests/test_api.py`

- [ ] **Step 1: Convert row quantities at the boundary**

Use `quantities_from_row()` wherever scoring, composition or report serialization reads a `reports` row. Never call `json.loads(row.quantities)` after the migration.

- [ ] **Step 2: Restore Max + Median behavior**

Compute category scores from the six quantity columns, select the maximum score per report, take the median of eligible `Counted` reports from the latest 90 days, return `Insufficient data` below three rows, and keep the existing four bands and UI labels.

- [ ] **Step 3: Restore API fields and compatibility routes**

Return `categoryScores` and `reportScore` in report responses and retain `attentionScore` and `eligibleReportCount` in beach responses. Keep `/api/*` routes as compatibility-only behavior.

- [ ] **Step 4: Run scoring and legacy regression tests**

Run `py -m pytest -q tests/test_api.py -k "score or severity or legacy or report"`; expected: PASS.

### Task 4: Verify frontend and local real flow

**Files:**
- Modify: `actual-project/frontend/src/api.test.ts` only if the migrated response contract requires a regression assertion.

- [ ] **Step 1: Run frontend checks**

Run `npm run typecheck`, `npm test -- --run` and `npm run build` from `actual-project/frontend`; expected: PASS.

- [ ] **Step 2: Start a local backend and real-mode frontend**

Use a temporary SQLite database and `VITE_API_BASE_URL` pointing at the local backend. Do not use production credentials or personal data.

- [ ] **Step 3: Exercise the full flow**

Verify anonymous login → beaches → photo upload with metadata stripping → manual beach selection → multi-category quantities → Review → Submit Report → `/report/saved` → My Reports → Correct Record → resubmit. Check no request returns 404 and report responses include scoring fields.

### Task 5: Merge, deploy and verify online

**Files:**
- Modify: `PM_CONTEXT_ACTUAL_PROJECT.md`

- [ ] **Step 1: Commit the integration changes**

Create focused commits for migration/scoring and tests, then merge the integration branch into local `main` after all checks pass. Preserve rollback tag `radar-sampah-pre-scoring-v2`.

- [ ] **Step 2: Push main and verify the deployed compatibility hosts**

Push `main` and check the current frontend compatibility host, API `/health`, `/beaches`, `/scoring-method`, auth, upload, report creation, report history and correction. Record any unprovisioned `radar-sampah-*.onrender.com` hosts as unavailable.

- [ ] **Step 3: Re-run the browser flow online**

Use a dedicated anonymous participant and the non-personal project sample image. Confirm `/report/saved`, My Reports and correction. Keep exact coordinates out of the submitted payload and verify browser console has no errors.

### Task 6: Update the two review documents and project log

**Files:**
- Modify: Google Doc `1_Jlps_zaXAWUWiOkXWkVFzcfFV_MPDQv2WccI9Biwm4`
- Modify: Google Doc `1rMWczM9IAsYqXAxEZ2tWKUYF79m0KZJYgGJV18VZxQg`
- Modify: `realwork/PM_CONTEXT_ACTUAL_PROJECT.md`

- [ ] **Step 1: Update Code Walkthrough**

Describe the `reports` migration, six quantity columns, Max + Median scoring, preserved private fields, real flow evidence and compatibility-host limitation.

- [ ] **Step 2: Update QA Question Bank**

Add questions for migration/backfill, schema safety, score fields, Max + Median behavior and the full saved/correction flow. Keep mock, deployed and future boundaries explicit.

- [ ] **Step 3: Verify document content**

Read both native Docs after writing; confirm titles, links and no stale claim that the backend uses mean or lacks the report contract.

- [ ] **Step 4: Record final evidence**

Append branch/commit, tests, deployment URLs, online flow results, document revisions, rollback path and any remaining Render hostname limitation to the PM context.
