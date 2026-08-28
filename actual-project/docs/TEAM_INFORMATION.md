# Team 04 - Radar Sampah Project Information

**Radar Sampah - Marine-litter demo**

## Project overview

Radar Sampah helps a user record a broad litter report, see a labelled demo
suggestion, explore broad area context and join a demo cleanup mission. It
uses synthetic/public examples and anonymous counts. It is not a reporting
authority, emergency service or environmental survey.

## Team roles

| Member | Working role | Main responsibility |
|---|---|---|
| Huang Guan | Project Manager and integration | scope, decisions, deployment and evidence |
| Hnin Darli | Data analysis and visualisation | source notes, category data and heatmap context |
| Qian Jiang | UI/UX and frontend | accessible flow, responsive layout and retry path |
| LiHanXia | Backend/API | validation, Flask routes and service integration |
| Keith Junn Chong | Database/data integration | PostgreSQL/SQLite schema and persistence |
| Benshuai Su | Recognition and reference support | fallback boundary and source register |

## Shared boundaries

- Use synthetic or public data only.
- Do not collect identity data, secrets or exact coordinates.
- Keep recognition, priorities, mission counts and impact wording illustrative.
- Do not claim a pollution source, legal result, real cleanup or ecological
  outcome.
- Keep previous sample material in Git rollback tags only.

## Active routes

`/api/litter-options`, `/api/litter-reports`, `/api/litter-recognize`,
`/api/litter-heatmap`, `/api/cleanup-missions`, `/api/cleanup-evidence` and
`/api/community-progress` support the Radar Sampah demo.
