# DiveSafe MY API Contract

Local base URL: `http://localhost:5000`. Render uses the API URL in the
project links. All examples use synthetic data.

## Active endpoints

### Catalogues

- `GET /api/dive-sites` returns broad site cards with region and source/version
  labels. No exact wildlife coordinates are returned.
- `GET /api/species` returns the source-labelled species directory.
- `GET /api/species/<site_id>` returns the directory for a known demo site.
- `GET /api/briefing/<site_id>` returns safety checks and a reminder to follow
  the operator and current official instructions.

### Profile

`POST /api/profile` accepts a synthetic nickname, experience level and a short
interest list. Names, email, phone, account and password fields are rejected.
The response is a demo profile ID and privacy note. No login is created.

### Recognition

`POST /api/recognize` accepts an approved HTTPS image URL or `/assets/` demo
path and an optional species hint. Without a private HTTPS adapter it returns:

```json
{
  "status": "demo_fallback",
  "candidates": ["clownfish-demo"],
  "provider": "demo",
  "needs_user_confirmation": true,
  "source": "synthetic/public demonstration data"
}
```

An external provider suggestion uses `status: provider_suggestion` and still
needs user confirmation. A provider key never appears in a response.

### Sightings

`POST /api/sightings` accepts only `site_id`, `species_id`, `observed_at` and
an optional short `note`. Exact latitude/longitude, names and contacts are
rejected. A successful response is `201` and contains the saved site-level
record plus collection/badge information.

`GET /api/sightings` returns saved synthetic records without coordinates.
`GET /api/collection/<profile_id>` returns the demo collection and badges.

### Health

`GET /health` returns `200` when the Flask process and database are ready.

## Legacy compatibility routes

`GET/POST /api/observations`, `GET /api/context` and `GET /api/options` remain
for rollback and old sample checks. They are not shown in the DiveSafe main
flow and must not be used to claim a litter survey or enforcement outcome.

## Data boundary

PostgreSQL is used when `DATABASE_URL` is set; local SQLite is the fallback.
Static JSON data records source URL, retrieval date, attribution, version and
sensitivity. Broad locations are for demonstration only. No endpoint proves a
species identity, ecological change, permit status or enforcement decision.
