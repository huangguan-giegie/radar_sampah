# Iteration 3 backend integration

Based on the merged frontend PR #53 (`6fcba3b112945d86b4146d27faba35028152e583`) and Part C of the acceptance document supplied on 5 October 2026.

## Delivered API

| Endpoint | Access | Behaviour |
| --- | --- | --- |
| `GET /insights/summary` | Public | Four MVP beach aggregates, headlines, historical bands, weighted composition, monthly reporting, volunteers, cleanup rows, recurrence, participation, evidence and separate biodiversity. |
| `GET /insights/trends`, `/insights/cleanup`, `/insights/participation`, `/insights/evidence`, `/insights/wildlife` | Public | Topic views using the same services. |
| `GET /beaches/<id>/recurrence` | Public | Latest cleanup follow-up status and provisional median when sufficient. Existing beach and cleanup responses also include recurrence. |
| `GET /profile`, `PATCH /profile` | Participant | Persisted nickname and explicit leaderboard consent. Default is opt-out. |
| `GET /contributions` | Participant | Counted report history and attendance at events with recorded cleanups. One point per report; five per eligible attended event, deduplicated across legacy and current attendance. |
| `GET /leaderboard` | Public | Consented nicknames and contribution points for the four MVP beaches. No participant identifiers or Cleanup Score totals. |
| `GET /recommendations/next-action` | Public or participant | Guest card or one authorised action selected in the six-rule priority order. Never performs the action. |
| `GET /personal-insights` | Participant | Own Counted report aggregates, cleanup follow-up and persistent litter context. |
| `GET /species-cards`, `/species-cards/<id>` | Public | Approved, sourced conservation introductions and photo permissions. |
| `POST /species-cards/<id>/answers` | Public | Prepared, reviewed answers for three suggested questions. |
| `GET /wildlife-risks`, `/wildlife-guidance` | Public | Approved risk mappings, cautious cleanup guidance and source-labelled contacts. |

The live frontend connects these endpoints on Insights, Home, Map, Account, species introductions, beach and cleanup result pages. Design fixtures remain exclusive to preview mode.

## Rules and persistence

Beach Attention uses the existing category weights, quantity bands, report maximum and median. Current evidence uses active Counted reports within 90 days. Historical comparisons filter reports and cleanups at the comparison date. Recurrence uses whole calendar days in Malaysia and the first Counted report strictly after a cleanup and before the next cleanup.

Defaults: three eligible reports, 30-day trend comparison, 30 days without cleanup, fewer than three next-event joins, three cross-cleanup observations, three recurrence intervals, ten recent cleanups, 60-second Insights request timeout, and a three-calendar-month advanced baseline. Small participation counts are suppressed on the backend; associated percentages and beach breakdowns are withheld when they could reveal the hidden count.

New `participant_profiles` preferences and `user_litter_aggregate` audit rows are stored in the configured database schema. Startup upgrades are idempotent. The SQLite coordinate migration preserves report references, existing beach keys, indexes, triggers and the foreign-key setting. PostgreSQL only relaxes the coordinate nullability; existing reports, photos and cleanups are preserved.

Optional AI explanations default to reviewed templates and prepared answers. This release does not require an additional AI credential. Failure, insufficient data and invalid output use the approved fallback; no environmental cause, confirmed sighting or ecological recovery is inferred.

## Expanded beach data boundary

The supplied [82-row names CSV](https://drive.google.com/file/d/14SaJV_6mz6nvKhZuhNI6hDyk28JPOxUK/view) is reproduced in `actual-project/backend/data/beach_names.csv`. Its source URL, filters, retrieval date and row identities are recorded in `expanded_beaches.json`. The two Turtle Beach entries and the two Pasir Panjang names are kept separate rather than guessed to be the same location.

All 82 names are registered alongside the four validated MVP beaches. Manual reporting, scoring, history and cleanups use the existing rules. Four uniquely matched catalogue names have source-labelled OpenStreetMap coordinates. The other 78 entries have no verified coordinates; individual regions and water types are also withheld when not supplied. They are selectable in lists but have no invented map pins, GPS assignment or GPS check-in. **AC4.4.4's full location enrichment remains incomplete until those records are supplied or independently verified.** The four MVP beaches remain the only scope of public Insights and the leaderboard.

## Validation and release

Baseline: 149 backend tests and 195 frontend tests passed. Subsequent rounds cover historical cleanup cutoffs, Malaysia date boundaries, privacy, small-count suppression, species source validation, recommendation priority and fallback, nickname consent, persistence and legacy database migration.

The integrated acceptance journey starts with at least three recorded attendances, opts a participant into the leaderboard, records an event-linked cleanup, checks contribution points and participation, adds a later Counted report, checks recurrence on Insights and the beach, changes the nickname, and withdraws consent while retaining private history.

Current integration test results and deployment revisions are recorded in [iteration3-test-report.md](iteration3-test-report.md). Final pre-release runs passed all 241 backend tests and 227 frontend tests; the production build passed. The previous main and live backend commits are preserved by release tags before main is updated.
