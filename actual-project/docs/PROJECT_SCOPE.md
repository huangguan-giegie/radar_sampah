# Project Scope - Radar Sampah

## Product focus

Radar Sampah is a student marine-litter reporting and cleanup-planning demo
for Malaysia. The confirmed direction supports two entry points: explore a
broad-area map first, or join/create a cleanup activity and then report litter.
The active persona is Amirah, a regular volunteer in the Selangor pilot.

## Confirmed journey

1. Explore the map or open a cleanup activity.
2. Join or create an activity where the organiser permission allows it.
3. Start a report with photo, category, quantity and one-time GPS assistance.
4. Correct the suggested beach/category/quantity and confirm the record.
5. Keep the report pending until a moderator or controlled reviewer checks it.
6. Show verified broad-area severity and source-labelled context.
7. Record cleanup evidence and later follow-up wording when those features are
   delivered.
8. Add verified contribution points only after the relevant Future/TBD flow is
   implemented.

## MVP boundary

- The Design Thinking direction is 25 stories: 15 Must, 6 Should and 4 Could.
- I1 Prepare & Report covers Epics 1–2. I2 Find & Understand covers Epics 3–5.
  These two iterations define the practical MVP direction.
- I3 Connect & Prepare covers Epics 6–8 and remains Future/TBD unless the team
  moves an item earlier with evidence.
- Public views use broad areas only. GPS is one-time assistance; exact points
  are never public. If private storage is added for review, it must stay
  restricted and out of screenshots.
- Recognition is disabled by default. AI suggestions require volunteer
  confirmation and manual input remains available.
- Moderator review, full organiser management, cleanup outcome, recurrence,
  biodiversity learning, points, badges and leaderboard are not presented as
  live unless the current runtime proves them.
- PostgreSQL runs on Render and SQLite is the local fallback. No login,
  identity data, emergency dispatch or public upload storage is included.

The MVP does not prove detection, pollution source, waste ownership, risk,
legal status, mission attendance, cleanup completion or ecological impact.
Scores and maps are illustrative decision aids only.

## Iterations

| Iteration | Outcome | Boundary |
|---|---|---|
| 1 | Prepare & Report | activity entry, litter report, correction and suggestion |
| 2 | Find & Understand | verification status, area severity and biodiversity context |
| 3 | Connect & Prepare | cleanup outcome, recurrence and contribution recognition; Future/TBD |
