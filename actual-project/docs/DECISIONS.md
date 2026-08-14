# Team 04 Decisions

## 2026-08-15 - DiveSafe MY product switch

- The active product name is **DiveSafe MY - Endangered Species Hotspot Guide
  for Divers in Malaysia**.
- The user journey is profile, site, species guide, briefing, confirmation and
  sighting.
- The old marine-litter endpoints and tables stay as a rollback layer. They are
  not shown in the new frontend or presentation.
- Iteration 1 is Prepare and Explore. Iteration 2 is Identify and Contribute.
  Iteration 3 is Learn and Connect. Quizzes, community feed and larger social
  features stay on the roadmap.

## 2026-08-15 - Data and safety

- Profiles use synthetic nicknames only. No names, contact details, accounts or
  passwords are accepted.
- Sites and species use public or synthetic source-labelled data. Sensitive
  locations are coarse or masked.
- A sighting stores site ID, species ID, date and a short note. It never stores
  exact wildlife coordinates.
- Recognition is a deterministic demo fallback unless a private HTTPS adapter
  is approved. A suggestion is not a confirmed species result.
- No external AI or computer vision is required for the first demo.
- Briefings must not state unverified permit or legal rules as facts.

## 2026-08-14 - Technical choices

- Flask and Gunicorn serve the API. The static frontend uses plain HTML, CSS
  and JavaScript with Leaflet and an accessible list fallback.
- Render uses PostgreSQL through `DATABASE_URL`; local work uses SQLite when it
  is absent.
- Profile, dive-site, species, briefing, sighting, recognition, collection and
  badge data have separate tables. Legacy observations remain separate.
- Static JSON files are loaded at startup so the demo does not rely on live
  OBIS or a live recognition provider.

## 2026-08-14 - Reference links

- Su's GitHub search and MakerBay repository are architecture references only.
  We do not copy their old PHP, MySQL or Arduino implementation.
- Public source URLs, retrieval dates, attribution and sensitivity flags stay
  beside the sample data and in the API response.
