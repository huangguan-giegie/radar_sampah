# Data Management Plan - DiveSafe MY

## Purpose and boundary

DiveSafe MY is a student learning MVP. It uses synthetic profiles, public or
synthetic site/species examples and coarse locations. It is not a public data
collection service and does not store real diver identity data.

## Data classes

| Class | Examples | Table or file |
|---|---|---|
| Demo profile | nickname, level, interests | `demo_profiles` |
| Site catalogue | name, broad region, habitat, precision label | `dive_sites`, `data/dive_sites.json` |
| Species catalogue | common/scientific label, note, sensitivity | `species`, `data/species_directory.json` |
| Briefing | checks, title and emergency reminder | `briefings`, `data/responsible_diving_briefings.json` |
| Sighting | site ID, species ID, date and short note | `sightings` |
| Recognition | image URL, candidate, status and method | `recognition_results` |
| Collection | confirmed sighting count and badge | `species_collections`, `contributor_badges` |
| Legacy data | earlier litter observations/context | legacy tables and files only |

## Storage controls

- Render uses PostgreSQL through `DATABASE_URL`; local work uses SQLite.
- Schema setup is idempotent and does not delete old tables.
- `site_species` keeps the directory relationship separate from the site and
  species records.
- No names, emails, phone numbers, passwords or raw image files are stored.
- Exact sensitive wildlife coordinates are rejected and never returned.
- Image input is only a safe demo path or HTTPS URL.
- Source URL, retrieval date, attribution, sensitivity and data version stay
  beside each static sample.

## Recognition and sharing

With no approved adapter, recognition is a deterministic local fallback. A
private HTTPS adapter may be configured later with Render environment values.
Its result is always a suggestion and needs user confirmation. Provider keys
are not committed or written to the database.

## Retention and use

The current data is for a class demo. If the project later accepts real reports,
the team must agree access, retention and deletion rules before deployment.
The data cannot be used as a biodiversity survey, permit decision, pollution
source claim or enforcement record.
