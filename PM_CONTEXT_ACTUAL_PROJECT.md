# Team 04 Actual Project PM Context

## Current decision

The group selected **Idea 1 Version 2**: marine litter is the only reporting
flow, while an OBIS marine-life map layer supplies ecological context. The MVP
will freeze one Malaysian coastal area and a small litter-category list.

The system must not claim that it proves pollution sources, exact threatened
species locations, or environmental outcomes. Use public or synthetic data and
label illustrative rules clearly.

## Spaces created

- GitHub: https://github.com/huangguan-giegie/team04-marine-observation-mvp
- Miro: https://miro.com/app/board/uXjVHySKbPY=/
- Drive: https://drive.google.com/drive/folders/18Px2njE27SCiZ4bs-40zgUgm_sRE70Kx
- Render: project `Team 04 Marine Observation` created; GitHub repository
  permission is still required before the new Web Service can be created.
- LeanKit: the existing HealthFirst board is preserved. The PM has decided to
  defer the new-board setup for now; no LeanKit board changes are required in
  this migration.

## Work completed

- Created `realwork/` with actual-project docs, references and migration manifest.
- Added a minimal Flask API and static frontend starter using synthetic in-memory
  observations only.
- Added `render.yaml` for free API and static-site services; the API smoke test
  passed health, list, valid create and invalid-coordinate checks (4/4).
- Pushed the local project to the new GitHub repository (`main`, commit
  `0ecca35`).
- Invited the five confirmed team GitHub accounts (`hlii0333`, `hnin0011`,
  `kcho0072`, `qjia0033-dev` and `SUBENSHUAI`); all are currently pending
  acceptance.
- Created five Drive folders and uploaded the rewritten governance docs, the
  starter frontend/backend folders and selected HealthFirst materials under a
  clearly labelled reference folder.
- Created and named the new Miro board. The old HealthFirst Miro board remains
  unchanged. The new board now has three concise cards: current scope, MVP
  flow and open decisions.

## Next actions

1. A repository owner must complete the GitHub Render App permission step; do
   not make the private repository public just to bypass this.
2. LeanKit setup is deferred by the PM; do not modify the old HealthFirst
   board.
3. Keep the GitHub, Drive, Miro and Render links in sync as the MVP evolves.

## Verification snapshot — 14 August 2026

- Render project page is reachable at
  `https://dashboard.render.com/project/prj-d9uverdbedkc73b6p130`.
  GitHub App access now lists both `healthfirst-team04-mvp` and
  `team04-marine-observation-mvp`.
- Free Render services were created from `main`:
  - API dashboard: `https://dashboard.render.com/web/srv-d9v00r3ncjis73amjvi0`
  - API URL: `https://team04-marine-observation-api.onrender.com`
  - Frontend dashboard: `https://dashboard.render.com/static/srv-d9v01afqj5pc738lpi5g`
  - Frontend URL: `https://team04-marine-observation-frontend.onrender.com`
  The frontend deploy log reports “Your site is live”. The API deploy log
  reports “Your service is live”. After setting the API health-check path to
  `/health` and restarting the service, external smoke checks passed: `GET /`,
  `GET /health`, `GET /api/observations` returned 200, `POST
  /api/observations` returned 201, and the frontend returned 200.
- LeanKit home at `https://monashie.leankit.com/` still exposes the existing
  Team 04 board but no board-creation control. The old board was not renamed,
  edited or reused for the actual project.
- The actual Miro board and Drive destination remain available and were
  reopened for handoff during this check.
