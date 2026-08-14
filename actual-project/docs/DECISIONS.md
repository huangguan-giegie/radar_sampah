# Team 04 Decisions

## 2026-08-13 - Project direction

- The vote favoured `Idea 1 Version 2` (4 votes) over `Idea 1` (2 votes).
- Working title: Marine Litter Hotspot & Marine-Life Observation Platform.
- Marine litter is the only reporting flow; marine life is a context/map layer.
- The MVP is limited to one selected Malaysian coastal area.
- The reporting categories are Plastic packaging, Fishing gear, Glass, Metal
  and Other.

## 2026-08-14 - Build and data decisions

- The interaction follows Report -> Review/confirm -> Results.
- PostgreSQL is used in Render through `DATABASE_URL`; local development uses
  SQLite when that variable is absent.
- The schema separates observations, classifications, priorities and marine
  context records.
- A static, source-visible OBIS sample is used first; do not depend on live
  OBIS requests for the demo.
- Sensitive context locations are aggregated or masked before display.
- An optional image field is a demo asset path or HTTPS URL only. Raw files are
  not stored.

## 2026-08-14 - Safety and explanation

- Classification uses a fixed-category rule; clean-up priority is illustrative.
- The API and UI must label results as demo/illustrative and show their source.
- Do not use external AI or computer vision in the first MVP.
- Do not accept personal data or claim pollution-source proof, verified species
  identity, ecological outcomes or enforcement action.
- HealthFirst code and documents remain read-only examples; no medical fields,
  thresholds, database tables or AI logic are carried into the marine runtime.

## 2026-08-14 - Form option clarity

- Keep the five fixed litter categories and expose the coarse area catalogue
  through a native required dropdown rather than a free-text input with a
  `datalist`.
- The catalogue version is `marine-form-options-2026-08-14-v1`. Its five area
  labels are aggregated demonstration context from the OBIS snapshot, not
  verified litter-survey sites or a new location-precision feature.
