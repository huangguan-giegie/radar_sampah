# Security Plan - DiveSafe MY

## Implemented demo controls

- Accept synthetic/public profile and sighting data only.
- Reject names, contact details, accounts, passwords and exact coordinates.
- Validate site IDs, species IDs, timestamps, note length and image URL scheme.
- Store PostgreSQL credentials only in Render environment variables.
- Use `FRONTEND_ORIGINS` for the deployed frontend.
- Keep sensitive wildlife locations coarse or masked.
- Use a deterministic recognition fallback unless a private HTTPS adapter is
  approved.
- Keep source, version and demo/non-enforcement wording visible.

## Not claimed

This MVP has no production authentication, role model, MFA, formal retention
process, PDPA compliance claim, public raw-file storage or incident-response
system. It does not provide verified species recognition, legal advice,
pollution-source attribution, ecological assessment or enforcement support.

## Adapter boundary

An adapter URL and key may be configured privately in Render later. The key is
never committed, returned by the API or written into a sighting. Provider
errors, timeouts and unknown results fall back to a suggestion that needs user
confirmation.

## Before real use

The team would need a privacy review, access model, retention/deletion process,
backups, monitoring, source update review and a separate decision about any
external recognition data flow. The class demo should stay synthetic.
