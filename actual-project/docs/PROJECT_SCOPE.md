# Project Scope - TideTrace MY

## Product focus

TideTrace MY is a student marine-litter reporting and cleanup-planning demo
for Malaysia. A user chooses a broad area and fixed litter type, sees a clear
demo recognition result, reads a broad heatmap, joins a demo cleanup mission,
adds illustrative evidence and views community progress.

## User journey

1. Select a broad reporting area and one of five litter categories.
2. Save a short synthetic/public demo report.
3. Read a detection suggestion and confirm it is not verified.
4. View broad area context in a map/list fallback.
5. Join a demo cleanup mission anonymously and add item-count evidence.
6. View illustrative community progress.

## MVP boundary

- Broad area labels only; precise locations are rejected.
- Five fixed categories; no free-form scientific classification.
- PostgreSQL on Render and SQLite locally.
- Recognition is disabled by default; the local fallback is the standard demo.
- No login, identity data, live dispatch, public upload storage or real cleanup
  verification.

The MVP does not prove a detection, pollution source, waste ownership, risk,
legal status, mission attendance, cleanup completion or ecological impact.
DiveSafe routes and data remain only for rollback compatibility.

## Iterations

| Iteration | Outcome | Boundary |
|---|---|---|
| 1 | Report and Recognize | broad report, fixed category and demo fallback |
| 2 | Map and Act | broad heatmap, mission join and evidence |
| 3 | Learn and Connect | progress, reflection and future community roadmap |
