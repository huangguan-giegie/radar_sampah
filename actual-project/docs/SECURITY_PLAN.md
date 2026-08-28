# Security Plan - Radar Sampah

## Demo controls

- Accept a broad area ID, current catalogue litter type and short description only.
- Reject personal details, secrets and exact coordinates.
- Validate IDs, text length, confirmation state, team size, equipment choice
  and image URL scheme.
- Store `DATABASE_URL`, `LITTER_RECOGNITION_API_KEY` and provider URL only in
  Render environment settings.
- Keep `LITTER_RECOGNITION_ENABLED=false` unless the team approves a provider
  and its data flow. A call needs both `true` and an HTTPS URL.
- Use `FRONTEND_ORIGINS` for the deployed frontend and keep source/version and
  demo wording visible.
- Every litter report carries a system-controlled review `status` (`pending`,
  `verified`, `rejected`, `duplicate` or `removed`); a report always starts
  `pending` and a client cannot set or change it through the API. Iteration 1
  only defines the field and states — the verification actor, review process
  and evidence requirements remain open (Future/TBD).
- Render uses PostgreSQL through a private `DATABASE_URL`; local development
  falls back to SQLite when it is absent. Schema setup only creates tables
  that do not exist yet; it never adds a column to a table that is already
  there. An existing local SQLite file or Render database created before a
  schema change (such as adding the `status` column) must be reset or
  migrated manually — it will not pick up the change automatically.

## Not claimed

This MVP has no production login, role model, public upload storage, formal
retention process, PDPA compliance claim, incident-response service or
emergency dispatch. Detection, hotspot context, priority, mission and impact
are illustrative. Organiser-supplied preparation text is not a safety
assessment. They do not prove pollution source, waste ownership, safety
risk, legal duty, cleanup completion or environmental benefit.

## Before real use

The team would need privacy and safety reviews, consent, access controls,
moderation, retention/deletion rules, backups, monitoring, source refresh
review, provider agreement and a real operational escalation process.
