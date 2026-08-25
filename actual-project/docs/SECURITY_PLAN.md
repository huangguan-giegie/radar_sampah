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
