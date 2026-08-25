# Team 04 Decisions

## 2026-08-19 - Radar Sampah workshop sync

- Public product copy is **Radar Sampah**. The current plan has 25 stories: 15
  Must, 6 Should and 4 Could. I1–I2 are the practical MVP direction; I3 is
  Future/TBD unless the team moves a story earlier. GR5 is Must.
- AI is an optional assisted path. The volunteer must confirm the suggestion;
  manual entry is still complete when AI is unavailable.
- GPS can help once with area selection only. Exact coordinates are never kept.
- Reports use separate reported, moderator-verified and collected states.
  A collected report needs moderator verification before it appears as a
  collected result.
- Severity is deterministic and versioned: quantity-band midpoint × category
  weight, with recency and area sensitivity (1.0, 1.25 or 1.5). The UI uses
  four severity bands and displays an open total as `102+`.

## 2026-08-15 - Radar Sampah direction

- The active product is **Radar Sampah - Marine Litter Reporting and Cleanup
  Demo for Malaysia**.
- The demo flow is Report -> Recognize -> Heatmap -> Join mission -> Evidence
  -> Community progress.
- It uses one broad Malaysian-area catalogue, five fixed litter categories and
  anonymous demo counts.
- DiveSafe MY remains in the repository as a legacy rollback record. It is not
  the current user journey, deck story or evidence claim.

## 2026-08-15 - Safety and AI boundary

- Reports use `area_id`, not latitude, longitude, GPS or exact location.
- No names, contact details, accounts, passwords or secrets are accepted.
- Recognition defaults to a deterministic demo fallback. A provider can be
  called only when `LITTER_RECOGNITION_ENABLED=true` and its private URL is
  HTTPS.
- A detection, heatmap, priority, mission, evidence count or progress value is
  illustrative. None proves litter source, safety risk, legal duty, cleanup or
  environmental impact.

## 2026-08-15 - Technical choices

- Flask/Gunicorn serves the API; the frontend is plain HTML, CSS and
  JavaScript with an accessible list fallback.
- Render uses PostgreSQL through `DATABASE_URL`; local development uses SQLite
  when it is absent.
- Active data is stored separately for reports, missions, anonymous joins and
  cleanup evidence. Legacy DiveSafe and observation data is retained; the active product is Radar Sampah.
- Static source-labelled data is used for the demo. The flow does not depend
  on a live environmental feed or external AI service.
