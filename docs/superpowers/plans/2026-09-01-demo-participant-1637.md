# Demo Participant 1637 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with checkpoints.

**Goal:** Add a safe, repeatable demo-only participant `1637`, deploy it to the existing compatibility API, and verify the real report flow with that participant.

**Architecture:** Keep normal anonymous registration random. At startup, when `DEMO_PARTICIPANT_ID` is explicitly configured, insert the configured four-digit volunteer row only when it does not already exist. No report rows, personal fields, passwords or coordinates are seeded. The existing restore endpoint then issues the normal JWT for that user.

**Tech Stack:** Flask, SQLAlchemy Core, SQLite/PostgreSQL, pytest, Render compatibility service.

## Global Constraints

- Preserve random IDs for normal `POST /auth/anonymous` requests.
- Seed only a four-digit anonymous volunteer ID from `DEMO_PARTICIPANT_ID`; default is disabled when the variable is absent.
- Do not change existing reports, scoring, duplicate rules, or API response contracts.
- Do not store names, email, phone, password, exact coordinates, or photo bytes.
- Use the existing `team04-marine-observation-api` compatibility service; do not create a new Render service.
- Keep a rollback commit/tag before deployment and record verification in the PM context.

---

### Task 1: Add the failing seed test

**Files:**
- Modify: `actual-project/backend/tests/test_api.py`

**Interfaces:**
- Consumes: `create_app()` with a temporary SQLite database.
- Produces: A regression test proving `DEMO_PARTICIPANT_ID=1637` creates exactly one user and is restorable.

- [ ] **Step 1: Write the failing test**

Add a test that sets `DEMO_PARTICIPANT_ID=1637`, creates the app with a temporary SQLite URL, calls `POST /auth/restore` with `1637`, and asserts HTTP 200 plus `participantId == "1637"`. Before the implementation this must return 404.

- [ ] **Step 2: Run the focused test**

Run from `actual-project/backend`: `py -m pytest tests/test_api.py -k demo_participant_1637 -q`.
Expected: FAIL because startup does not currently seed the configured participant.

### Task 2: Implement controlled startup seeding

**Files:**
- Modify: `actual-project/backend/app.py` near `initialise_database()`
- Modify: `actual-project/backend/tests/test_api.py`

**Interfaces:**
- Consumes: `DEMO_PARTICIPANT_ID` environment variable and existing `users_table`.
- Produces: `ensure_demo_participant(engine)` and an idempotent startup row for the configured participant.

- [ ] **Step 1: Implement the minimal helper**

Implement `ensure_demo_participant(engine)` to return immediately when `DEMO_PARTICIPANT_ID` is empty, reject non-four-digit values with a clear startup error, query `users_table` for the ID, and insert `u_demo_<id>` with role `volunteer` only when absent. Call it from `initialise_database()` after schema/table creation and before report repair. Use the existing timezone-aware timestamp helper and never insert report data.

- [ ] **Step 2: Run the focused test**

Run: `py -m pytest tests/test_api.py -k demo_participant_1637 -q`.
Expected: PASS, with a second app initialisation still returning the same single user.

- [ ] **Step 3: Add negative and idempotency assertions**

Assert a second startup does not create a duplicate and a non-four-digit configured value raises `RuntimeError` before serving requests.

- [ ] **Step 4: Run the backend suite**

Run: `py -m pytest -q`.
Expected: all existing tests plus the new seed coverage pass.

### Task 3: Deploy and run the real flow

**Files:**
- Modify: `actual-project/backend/README.md` with the demo-only variable boundary.
- Modify: `PM_CONTEXT_ACTUAL_PROJECT.md` with commit, deployment and test evidence.

**Interfaces:**
- Consumes: deployed `team04-marine-observation-api` and `DEMO_PARTICIPANT_ID=1637` configuration.
- Produces: HTTP 200 restore for 1637 and a verified report flow.

- [ ] **Step 1: Run focused local integration checks**

Start the backend against a temporary SQLite database with `DEMO_PARTICIPANT_ID=1637`; call restore, `/auth/me`, `/beaches`, upload, report creation, `/reports/mine`, `/reports/mine/counts`, and PATCH correction. Confirm the saved response and duplicate rules remain unchanged.

- [ ] **Step 2: Commit and preserve rollback**

Create a rollback tag from `main`, commit the tested change, and push the feature branch. Merge only after the focused and full backend tests pass.

- [ ] **Step 3: Configure the compatibility service**

Set the private Render environment variable `DEMO_PARTICIPANT_ID=1637` on the existing API service and redeploy the merged commit. Do not expose the value in source files or logs.

- [ ] **Step 4: Verify the deployed ID and full flow**

Call `POST /auth/restore` with `1637`, then run the deployed flow without writing a duplicate pair: auth → beaches → upload → report → saved response → My Reports → correction. Confirm HTTP statuses, `Counted` response, and no 404/500.

- [ ] **Step 5: Record the result**

Append the exact commit, deployment URL, test timestamps, flow result and the public-demo credential limitation to `PM_CONTEXT_ACTUAL_PROJECT.md`.

### Task 4: Notify Darli

**Files:**
- Modify: `PM_CONTEXT_ACTUAL_PROJECT.md` with the sent-message status.

**Interfaces:**
- Consumes: verified production result for participant `1637`.
- Produces: one concise private WhatsApp message to Darli.

- [ ] **Step 1: Prepare the message**

Use: `Hi Darli, I created the demo participant ID 1637 on the current compatibility deployment and verified the real report flow from restore through submission, saved result, My Reports and correction. The ID is now available for mentor-check demos. It is a public demo credential, so it should only be used with synthetic data.`

- [ ] **Step 2: Send after verification**

Send only after the deployed restore and flow checks pass, then record the send status in the PM context.
