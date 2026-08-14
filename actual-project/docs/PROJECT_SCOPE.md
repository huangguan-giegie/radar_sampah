# Project Scope - Idea 1 Version 2

## Product focus

The Marine Litter Hotspot & Marine-Life Observation MVP helps people record a
marine-litter observation in one selected Malaysian coastal area and view it
alongside source-visible marine context. Marine life is an OBIS context layer,
not a second reporting workflow.

## User journey

1. Enter one synthetic/public litter observation.
2. Review every field and return to edit if needed.
3. Confirm and save the report.
4. See the fixed-category result, illustrative clean-up priority and map/list
   view.
5. Review the static OBIS context source and the result boundaries.

## MVP acceptance boundary

- Five fixed litter categories and five coarse area suggestions in the form:
  Selected Malaysian coastal area, North-west Peninsular Malaysia coast, East
  coast Peninsular Malaysia, Terengganu coastal waters and Selangor coastal
  waters. The labels are demonstration context, not survey sites.
- Coordinates, time, approximate area, optional sample-image URL and note.
- PostgreSQL in Render with local SQLite fallback.
- A five-record static source-labelled OBIS Malaysia-region context bundle
  (`obis-malaysia-public-2026-08-14-v1`) with coarse coordinates.
- Leaflet/OpenStreetMap plus an accessible list fallback.
- Transparent rules only; no LLM, external CV or live unreviewed model.
- Synthetic/public data only.

The MVP does not prove pollution sources, species identity, ecological change,
or environmental enforcement decisions. It does not accept personal details,
store raw uploaded images or publish exact sensitive-species locations.
