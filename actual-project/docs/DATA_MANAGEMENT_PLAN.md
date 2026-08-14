# Data Management Plan - TideTrace MY

## Purpose

TideTrace MY is a student marine-litter reporting and cleanup-planning demo.
It uses synthetic/public examples and broad area labels. It is not a live
reporting service, survey database or enforcement system.

## Data classes

| Class | Examples | Use |
|---|---|---|
| Litter options | five fixed types and broad areas | report form only |
| Report | area ID, litter type, short description, time | illustrative record |
| Detection | label, method, confidence/status | suggestion only |
| Hotspot context | source, version, broad label | learning context |
| Cleanup mission | confirmed report, team size, equipment plan | demo planning |
| Impact | report/mission counts and progress labels | demo feedback |
| Legacy data | DiveSafe and earlier observation records | rollback only |

## Storage and quality

- Render uses PostgreSQL through private `DATABASE_URL`; local development uses
  SQLite when it is absent.
- Schema setup is idempotent and does not delete legacy tables.
- Reports use a broad area ID. Exact latitude, longitude, GPS and coordinates
  are rejected and never returned by active endpoints.
- Names, email, phone, accounts, passwords, API keys and raw image files are
  not collected. An image input is a demo asset path or HTTPS URL only.
- Static samples keep a source URL, retrieval date, licence/attribution,
  sensitivity and version where available.

## External recognition

Recognition is off by default. It can only call a private HTTPS provider when
`LITTER_RECOGNITION_ENABLED=true`; its URL, key and timeout are Render-only
environment values. A result remains a suggestion and does not prove litter
type, source, ownership, risk or cleanup priority.

## Retention and sharing

Current records are for a class demo. Before collecting real reports, the team
must agree on consent, access, retention, deletion, moderation, incident
handling and provider-data rules. Do not use this data to claim pollution
trends, ecological impact, legal status or enforcement evidence.
