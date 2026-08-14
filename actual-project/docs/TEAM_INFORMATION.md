# Team 04 - DiveSafe MY Project Information

**DiveSafe MY - Marine-safety learning MVP**

## Project overview

DiveSafe MY helps a diver prepare for a Malaysian dive, open a broad dive-site
guide, read a short wildlife briefing and record a synthetic sighting. The
project uses source-labelled public data and simple rules. It does not replace
a guide, a permit check or a species expert.

The active flow is:

`Profile -> Site -> Species directory -> Briefing -> Confirm -> Sighting`

The site map uses broad demo pins. Exact sensitive wildlife locations are never
accepted or returned.

## Team roles

| Member | Working role | Main responsibility |
|---|---|---|
| Huang Guan | Project Manager and integration | Scope, decisions, repository, deployment and evidence |
| Hnin Darli | Data analysis and visualisation | Public-data review, source notes and map context |
| Qian Jiang | UI/UX and frontend | Accessible interface, responsive layout and interaction flow |
| LiHanXia | Backend/API | Validation, Flask routes and service integration |
| Keith Junn Chong | Database/data integration | PostgreSQL/SQLite schema, persistence and source loading |
| Benshuai Su | Recognition and reference support | Adapter boundary, source register and plain-language limits |

## Shared boundaries

- Use synthetic or public data only.
- Do not collect names, emails, phone numbers, accounts or passwords.
- Do not publish exact threatened-species locations.
- Treat recognition as a demo suggestion until a provider is reviewed.
- Do not claim verified species identity, ecological outcomes, legal advice or
  enforcement decisions.
- Keep the old HealthFirst and marine-litter material as reference/rollback
  only.

## Main routes

`/api/dive-sites`, `/api/species`, `/api/briefing/<site_id>`, `/api/profile`,
`/api/recognize`, `/api/sightings` and `/api/collection/<profile_id>` are the
active DiveSafe routes. The older observation routes remain compatible but are
not the main product journey.

## Source register

- [OBIS Malaysia-region occurrence query](https://api.obis.org/occurrence?geometry=POLYGON((99%203,105%203,105%207,99%207,99%203))&size=50) - public context reference.
- [CEFAS/Defra CLiP vocabulary](https://environment.data.gov.uk/dataset/faaf9538-2665-48c9-afc2-b976daa77cd2) - broad marine-litter reference only.
- Su's [MakerBay reference repository](https://github.com/MakerBay/Marine_Litter_Detective) - architecture inspiration only; its old PHP, MySQL and Arduino code is not copied.
