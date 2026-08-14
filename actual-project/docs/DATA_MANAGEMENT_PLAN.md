# Data Management Plan - Marine Observation MVP

## Purpose and data boundary

The MVP demonstrates a marine-litter reporting flow for one selected Malaysian
coastal area. It uses synthetic observations and a static public OBIS context
sample. It is not a public data-collection service.

Do not enter real names, contact details, account identifiers, secrets or raw
personal images. Do not use exact threatened-species locations.

## Data classes

| Data class | Examples | Storage and use |
|---|---|---|
| Observation | fixed category, approximate area, time, latitude/longitude, optional demo image URL, note | `observations`; shown as a demo record |
| Derived result | fixed-category rule, illustrative priority, rule explanation | `observation_classifications` and `observation_priorities`; separate from the original observation |
| Marine context | five-record static OBIS Malaysia-region sample, attribution, retrieval date, approximate/masked location, sensitivity flag | `marine_context`; map and source-visible context |

## Storage

- Render uses PostgreSQL through `DATABASE_URL`.
- Local development falls back to SQLite when `DATABASE_URL` is absent.
- Schema setup is idempotent. It creates the four data tables without deleting
  existing records.
- Database passwords are environment variables only and are never included in
  Git, screenshots or PGP evidence.
- The MVP does not store raw upload files. `image_url` is only a local demo
  asset path or HTTPS link.

## Quality and safety controls

- Validate the five fixed categories, coordinates, ISO timestamp, optional URL
  scheme and text lengths on the server.
- Keep original observations separate from derived results.
- Label classification and priority as `demo`/`illustrative` in the API and UI.
- Mask or aggregate sensitive context locations before they reach the map.
- Keep the OBIS source URL, retrieval date and attribution in every context
  record.
- Current bundle: `obis-malaysia-public-2026-08-14-v1`, retrieved 2026-08-14
  from the bounded OBIS occurrence query used in `backend/data/obis_context.json`.
  The records are public context examples, not a complete biodiversity survey.

## Retention and sharing

Use synthetic/public data for the course demo. If the project later collects
real reports, the team must agree a retention period, deletion procedure,
access model and privacy review before deployment. Do not export PostgreSQL
records outside the team without that review.

## External services

External AI and computer-vision services are disabled in this MVP. No
observation data is sent to an LLM or image-analysis provider.
