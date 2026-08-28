# Radar Sampah QA and Deployment Checklist

**Version 3.0 | 15 August 2026**

> Use synthetic values only. A detection, heatmap, mission or progress count is
> not verified environmental evidence.

## Test record

| Field | Evidence |
|---|---|
| Date and time | |
| Tester | |
| GitHub commit | |
| Frontend | https://team04-marine-observation-frontend.onrender.com |
| API | https://team04-marine-observation-api.onrender.com |
| Synthetic area/category | |
| Result and limits | |

## Browser flow

- [ ] Broad area, category and short report validate correctly.
- [ ] Detection shows a demo fallback/suggestion and confirmation wording.
- [ ] Heatmap/list shows broad areas only.
- [ ] Mission join is anonymous; evidence accepts a sensible item count.
- [ ] Community progress refreshes after a saved demo action.
- [ ] API failure keeps the draft and shows retry.
- [ ] Keyboard focus, labels and 375px layout work.

## API smoke checks

| Request | Expected |
|---|---|
| `GET /health` | 200 |
| `GET /api/litter-options` | 200, five categories and broad areas |
| `POST /api/litter-reports` | 201, no coordinates or PII |
| `POST /api/litter-recognize` | 200, fallback/suggestion flag |
| `GET /api/litter-heatmap` | 200, broad context |
| mission join/evidence/progress | successful demo response |

Reject names, phone numbers, emails, passwords, API keys, exact coordinates
and unsafe image URLs. Never show a provider key.

## Release checks

- [ ] Render points at the intended `main` commit.
- [ ] PostgreSQL/provider secrets are private in Render.
- [ ] `LITTER_RECOGNITION_ENABLED=false` unless reviewed.
- [ ] Docs use only active Radar Sampah routes.
- [ ] Evidence records time, commit, screenshots, response status and limits.
