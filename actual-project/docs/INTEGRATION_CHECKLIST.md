# Integration Checklist

## Configuration

- [ ] Confirm the selected Malaysian coastal area name and placeholder map view.
- [ ] Set `DATABASE_URL` in the Render API service, not in Git.
- [ ] Confirm `FRONTEND_ORIGINS` matches the deployed frontend URL.
- [ ] Confirm the API root directory is `actual-project/backend`, the frontend
  root directory is `actual-project/frontend`, and `/health` is the API health
  check path.

## API and database

- [ ] `GET /health` returns `200`.
- [ ] `GET /api/observations` returns saved records without secrets or personal
  fields.
- [ ] `POST /api/observations` returns `201` for a valid synthetic report.
- [ ] Missing fields, invalid categories, coordinates, timestamps and image
  URLs return `400`.
- [ ] `GET /api/context` returns a source-visible static OBIS sample.
- [ ] PostgreSQL initialises and persists observations after a service restart.
- [ ] Local startup without `DATABASE_URL` uses SQLite successfully.
- [ ] Original observations, classifications and priorities are stored in their
  separate tables.

## Frontend and accessibility

- [ ] Report -> Review/edit -> Confirm -> Results completes with synthetic data.
- [ ] Editing a reviewed report invalidates the previous confirmation.
- [ ] The result shows category rule, illustrative priority, sources and limits.
- [ ] The Leaflet map and accessible list show consistent observation/context
  information.
- [ ] If the map or API fails, the UI shows an understandable retry/error
  message and preserves confirmed form input.
- [ ] Keyboard focus, labels and text/shape status indicators work without
  depending only on colour.

## Evidence and release boundary

- [ ] Record deployment URL, commit, test time, synthetic input and result in
  the PGP evidence folder.
- [ ] Confirm no real personal data, credentials or raw user images are used.
- [ ] Confirm sensitive marine-context locations are masked or aggregated.
- [ ] Confirm no AI/CV service is enabled and no HealthFirst medical code is in
  the deployed runtime.
- [ ] Preserve a known working commit or tag before the final demonstration.
