# Project Scope - DiveSafe MY

## Product focus

DiveSafe MY is a marine-safety learning MVP for divers in Malaysia. A user
chooses a synthetic profile, picks a broad site, reads the wildlife directory
and briefing, then confirms a synthetic sighting. The map is approximate and
the list remains available without Leaflet.

## User journey

1. Choose a synthetic profile.
2. Choose a broad demo dive site.
3. Read the species directory and responsible-dive briefing.
4. Optionally request a demo recognition suggestion.
5. Confirm the species and record a site-level sighting.
6. View collection and badge feedback.

## MVP boundary

- Two broad demo sites and three source-labelled species examples.
- Site-level data only; exact sensitive coordinates are rejected.
- PostgreSQL on Render with SQLite fallback locally.
- Optional private recognition adapter with a deterministic fallback.
- Synthetic/public data only and no identity fields.
- Iteration 3 social and quiz features are roadmap items.

The MVP does not prove species identity, live conditions, ecological change,
permit status, pollution source or enforcement action. Legacy litter endpoints
remain for rollback but are not part of the new flow.

## Iterations

| Iteration | Outcome | Status boundary |
|---|---|---|
| 1 | Prepare and Explore | profile, sites, directory, briefing and broad map |
| 2 | Identify and Contribute | fallback suggestion, confirmation, sighting, collection and badge |
| 3 | Learn and Connect | quizzes, community feed and wider gamification roadmap |
