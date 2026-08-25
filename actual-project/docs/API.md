# Radar Sampah API Contract

Local base URL: `http://localhost:5000`. All request examples are synthetic
or illustrative. This student demo never stores exact coordinates or personal
details. One-off GPS assistance may return only a broad area name.

## Active endpoints

- `GET /health` returns `200` when the Flask process and database are ready.
- `GET /api/litter-options` returns the five fixed litter types and broad
  Malaysian reporting areas. Areas are labels, not survey coordinates.
- `POST /api/litter-reports` accepts `area_id`, `category`, optional positive
  `quantity`, optional `observed_at`, a safe `image_url` and a short `note`.
  It returns the saved demo report and a fixed-category,
  illustrative priority. It rejects names, contacts, credentials and precise
  locations.
- `GET /api/litter-reports` returns saved demo reports without coordinates.
- `POST /api/litter-recognize` accepts an approved HTTPS image URL or
  `/assets/` demo path and an optional `category_hint`. The normal result is a labelled demo
  fallback. A provider call is possible only when
  `LITTER_RECOGNITION_ENABLED=true` and a private HTTPS endpoint is configured.
  Detection is a suggestion, not verified evidence.
- `GET /api/litter-heatmap` returns broad, source-labelled area summaries with
  an illustrative four-band severity score and priority. Area sensitivity is
  applied as 1.0, 1.25 or 1.5. It is not a live alert map.
- `GET /api/cleanup-missions` returns demo missions. `POST
  /api/cleanup-missions/<mission_id>/join` increments an anonymous demo join
  count. Neither route is dispatch, safety approval or a permit.
- `POST /api/cleanup-evidence` accepts a mission ID, item count, optional safe
  image URLs, before/after image URLs and short impact/note text. It records
  illustrative evidence only.
- `GET /api/community-progress` returns simple demo report, mission, join and
  item counts. It does not prove litter removal, pollution reduction or impact.

Reports are separate from collected reports. A collected result is shown only
after moderator verification. Quantity totals use `102+` for an open upper
range. The current Design Thinking plan has 25 stories: 15 Must, 6 Should and
4 Could. The practical MVP direction is Iterations 1–2; later review,
recurrence and recognition features stay Future/TBD when they are not in the
current runtime.

## Typical flow

1. Read `GET /api/litter-options`.
2. Create one broad-area report with `POST /api/litter-reports`.
3. Confirm the demo or provider suggestion from `POST /api/litter-recognize`.
4. Read `GET /api/litter-heatmap`, join a demo mission and add evidence.
5. Read `GET /api/community-progress` and list endpoints after a refresh.

## Configuration boundary

`DATABASE_URL` is private on Render; local development falls back to SQLite.
`FRONTEND_ORIGINS` contains the deployed frontend URL.

`LITTER_RECOGNITION_ENABLED` defaults to `false`. A live provider is allowed
only when it is exactly `true` and `LITTER_RECOGNITION_API_URL` is HTTPS.
`LITTER_RECOGNITION_API_KEY` stays private in Render. The timeout is set by
`LITTER_RECOGNITION_TIMEOUT_MS` (default `4000`). No key is returned or stored
in report data.

## Legacy rollback routes

Earlier DiveSafe routes (`/api/profile`, `/api/dive-sites`, `/api/species`,
`/api/briefing`, `/api/recognize`, `/api/sightings` and collection routes) and
the earlier observation routes remain in the repository as legacy rollback
paths. They are not part of Radar Sampah, its screenshots or its demo claim.
