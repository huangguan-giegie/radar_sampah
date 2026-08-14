# Team 04 Actual Project PM Context

## Current product - 15 August 2026

The active product is **DiveSafe MY - Endangered Species Hotspot Guide for
Divers in Malaysia**. Use short, natural student English in code, documents,
slides and team messages.

The demo journey is:

`Profile -> Dive site -> Species directory -> Briefing -> Confirm -> Sighting`

It uses synthetic/public data, broad site locations and source labels. It does
not collect real identity data, exact sensitive wildlife locations or secrets.

## Current implementation

- Backend: Flask/Gunicorn, SQLAlchemy, PostgreSQL on Render and SQLite fallback.
- Frontend: plain HTML/CSS/JavaScript, Leaflet/OpenStreetMap and accessible list
  fallback.
- New API: `/api/dive-sites`, `/api/species`, `/api/briefing/<site_id>`,
  `/api/profile`, `/api/recognize`, `/api/sightings` and collection routes.
- Recognition: deterministic local fallback. A private HTTPS adapter is
  optional; it is never described as verified identification.
- Database: profiles, sites, species, briefings, sightings, recognition,
  collections and badges are separate from the old observation tables.
- Old marine-litter routes remain only as a rollback layer.

## Iterations

1. Prepare and Explore: profile, dive-site guide, species directory, briefing,
   broad map.
2. Identify and Contribute: demo recognition, confirmation, sighting,
   collection and badge.
3. Learn and Connect: quizzes, community feed and wider gamification roadmap.

## Sources and references

OBIS public context and Malaysian official pages are source references. Su's
GitHub search and MakerBay repository are architecture inspiration only; the
old PHP, MySQL and Arduino code is not a dependency. Source URL, retrieval
date, attribution, sensitivity and version stay with each static sample.

## Project spaces

- GitHub: https://github.com/huangguan-giegie/team04-marine-observation-mvp
- Frontend: https://team04-marine-observation-frontend.onrender.com
- API: https://team04-marine-observation-api.onrender.com
- Editable deck: https://docs.google.com/presentation/d/1bFR83Sng4uYm_rUPjwVuzTzwKwcVLWPVoPJl9d-xbTU/edit
- Real Project Drive: https://drive.google.com/drive/folders/18Px2njE27SCiZ4bs-40zgUgm_sRE70Kx
- Miro: https://miro.com/app/board/uXjVHySKbPY=/
- LeanKit: the old HealthFirst board is preserved; new-board setup remains
  deferred.

## Migration boundary

HealthFirst files remain read-only references under
`references/healthfirst-example/`. The Sample Project PGIE was not modified.
Marine-litter sample data in the Real Project archive is not read by the
DiveSafe runtime.

## Evidence and next actions

- Run backend tests from `actual-project/backend` and frontend tests from the
  repository root.
- Run local synthetic profile, site, briefing, recognition fallback and
  sighting smoke checks.
- Before the course demo, confirm Render uses the intended `main` commit and
  that PostgreSQL read-back works.
- Record commit, test time, screenshots, URLs and limits in the QA checklist.
- Do not enable a provider or add a key until the team agrees on the data flow.

## DiveSafe implementation check — 15 August 2026

- Release commits: `b1e5baf` is the current `main` tip; it includes the product
  switch, live smoke evidence and the editable deck link.
- Backend tests: `python -m pytest tests -q` from `actual-project/backend` — 18
  passed.
- Frontend tests: `node --test actual-project/frontend/tests/workflow.test.mjs`
  — 8 passed. JavaScript syntax checks and Python compile checks also passed.
- DOCX QA: five updated documents rendered through LibreOffice into ten PNG
  pages. No clipped text, blank pages or visible overlap was found.
- PPT QA: the DiveSafe deck has 19 slides. LibreOffice exported all 19 slides
  to PNG for a visual pass; the audience-facing text is English and follows the
  new product flow.
- Local smoke path: synthetic profile, site list, briefing, recognition
  fallback, sighting and collection read-back passed with SQLite.
- Deployment note: after the redeploy, the live API returned `/health`, `/api/dive-sites`,
  `/api/species`, `/api/briefing/tioman-demo` and `/api/context`. A synthetic
  profile, fallback recognition and sighting were written and read back. The
  frontend now contains the DiveSafe flow and points to the Render API.
- Drive sync is complete for the Real Project files. The raw PPTX and DOCX
  files were updated in place; a new editable Slides copy was added because
  Google Slides Office files cannot be replaced through the Slides API. The
  old editable deck is clearly archived. Sample Project PGIE was not changed.

The current code keeps the old litter API for rollback. It does not make a
claim that an external recognition provider, a legal rule or a scientific
species result is verified.
