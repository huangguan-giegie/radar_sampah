# DiveSafe MY QA and Deployment Checklist

**Version 2.0 | 15 August 2026**

> Test with synthetic values only. A demo suggestion is not a verified species
> result or legal advice.

## Test record

| Field | Evidence |
|---|---|
| Date and time | |
| Tester | |
| GitHub commit | |
| Frontend | https://team04-marine-observation-frontend.onrender.com |
| API | https://team04-marine-observation-api.onrender.com |
| Synthetic profile/site/species | |
| Result and limits | |

## Browser flow

- [ ] Profile accepts a synthetic nickname only.
- [ ] Site list shows broad sites and the map has a list fallback.
- [ ] Species directory and briefing load for the chosen site.
- [ ] Optional recognition shows a demo suggestion and asks for confirmation.
- [ ] Review shows the chosen site and species before submission.
- [ ] Editing a value requires a new confirmation.
- [ ] Confirmed sighting reaches the result page and keeps the safe boundary text.
- [ ] Collection and badge update only after a sighting is saved.
- [ ] API failure keeps the draft and shows a retry action.
- [ ] Keyboard focus, labels and 375px layout work.

## API smoke checks

| Request | Expected |
|---|---|
| `GET /health` | 200 |
| `GET /api/dive-sites` | 200, coarse locations |
| `GET /api/species` | 200, source/version present |
| `GET /api/briefing/tioman-demo` | 200, safety wording present |
| `POST /api/profile` | 201, no PII fields |
| `POST /api/recognize` without provider | 200, demo fallback and confirmation flag |
| `POST /api/sightings` | 201, site/species IDs only |
| `GET /api/sightings` | 200, no coordinates |
| `GET /api/collection/divesafe-demo-diver` | 200, collection/badge response |

Reject names, phone numbers, emails, passwords, exact coordinates, unknown
sites/species and unsafe image URLs. Never show a provider key.

## Release checks

- [ ] Render points at the intended `main` commit.
- [ ] PostgreSQL is private in Render; no connection string is in Git.
- [ ] No exact sensitive wildlife location is shown.
- [ ] The old litter routes are not shown as the DiveSafe journey.
- [ ] PPT and docs use the same routes, sources and limitations.
- [ ] PGP records time, commit, screenshots, response status and open issues.

Passing this list supports a course demo only. It does not support a real
survey, species claim, permit decision or enforcement action.
