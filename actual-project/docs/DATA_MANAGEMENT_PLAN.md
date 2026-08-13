# Data Management Plan — Marine Observation MVP

## Data classes

- User-submitted observation: category, approximate area, timestamp and optional sample image.
- Public context: OBIS marine-life records and other approved public environmental datasets.
- Derived demo fields: category label, map marker and illustrative priority explanation.

## Collection boundary

The MVP uses synthetic values and public data. It should not collect names, phone numbers, account identifiers or precise threatened-species locations.

## Storage and retention

The initial implementation should use a local or team-controlled database for the demo. The team must document the chosen schema, retention period and deletion process before any public deployment or real user submission.

## Data quality

Validate required fields, category values, coordinates and timestamps. Mark model or rule-based classification as illustrative. Keep the original submitted observation separate from derived labels.

## External services

Do not send personal or sensitive location data to external AI services. If an external model is later enabled, show the data flow to users and review the provider, retention and cost settings first.
