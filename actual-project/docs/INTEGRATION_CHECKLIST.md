# DiveSafe MY Integration Checklist

## Release identity

- [ ] Demo and docs use **DiveSafe MY**.
- [ ] Iteration 1, 2 and 3 labels match the project plan.
- [ ] Old litter routes are described only as rollback compatibility.

## Configuration

- [ ] `DATABASE_URL` is private in Render and absent from Git.
- [ ] `FRONTEND_ORIGINS` matches the frontend URL.
- [ ] API root is `actual-project/backend`; static site root is
  `actual-project/frontend`.
- [ ] `/health` is the Render health check.
- [ ] Recognition adapter variables are unset unless the team has reviewed the
  provider data flow.

## API and database

- [ ] `/api/dive-sites`, `/api/species` and `/api/briefing/<site_id>` return
  source/version labels and coarse locations.
- [ ] `POST /api/profile` accepts synthetic fields and rejects PII.
- [ ] `POST /api/recognize` returns demo fallback when no provider is set.
- [ ] `POST /api/sightings` accepts site/species IDs and rejects coordinates.
- [ ] Refreshing `/api/sightings` and `/api/collection/<profile_id>` reads the
  saved synthetic record.
- [ ] PostgreSQL and SQLite both initialise the new tables.

## Frontend and accessibility

- [ ] Profile -> Site -> Guide -> Briefing -> Confirm -> Sighting works.
- [ ] Map and list show the same broad site information.
- [ ] Recognition is marked as a suggestion and needs confirmation.
- [ ] API failure keeps the draft and gives a retry action.
- [ ] Labels, focus, keyboard flow and 375px layout work.
- [ ] Status is explained with text, not colour alone.

## Evidence and safety

- [ ] Record commit, test time, URLs, synthetic input, screenshots and limits.
- [ ] No real identity data, secrets or exact sensitive locations are used.
- [ ] Sources, versions and approximate wording are visible.
- [ ] No page claims verified species identity, legal status, pollution source,
  ecological impact or enforcement action.
- [ ] Preserve a working commit/tag before the final demo.
