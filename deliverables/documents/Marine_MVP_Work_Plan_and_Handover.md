# Marine Observation MVP — Work Plan and Handover

## Product slice

The MVP has one reporting flow for marine litter in one Malaysian coastal placeholder area. Marine-life information is a contextual OBIS map layer, not a second reporting flow.

## Delivery sequence

| Stage | Output | Owner |
|---|---|---|
| Scope | Frozen category list, boundary statement and sources | Huang + team |
| Report | Accessible entry form and validation | Qian + Hanxia |
| Review | Editable review screen and explicit confirmation | Qian + Hanxia |
| Save | PostgreSQL on Render, SQLite fallback locally | Keith + Hanxia |
| Results | Rule-based classification, illustrative priority and source labels | Su + Darli |
| Context | Static OBIS sample, masked map markers and list fallback | Darli + Qian |
| Release | Render smoke check, screenshots and PGP evidence | Huang |

## Technical handover

- Backend entry point: `actual-project/backend/app.py`.
- Local API: `python app.py` from `actual-project/backend`.
- Frontend entry point: `actual-project/frontend/index.html`; local server `python -m http.server 8080`.
- API contract: `GET /health`, `GET /api/observations`, `POST /api/observations`, `GET /api/context`.
- Render uses `DATABASE_URL`; local development falls back to SQLite.
- Runtime tables separate original observations, classifications, priorities and marine context.
- `actual-project/backend/data/obis_context.json` is the versioned static source sample.

## Integration rules

1. Branch from `main`.
2. Make the smallest change that can be tested.
3. Open a Pull Request and review the API/data/safety impact.
4. Merge reasonably safe work, then run the integrated flow.
5. Fix concrete integration failures and redeploy from `main`.
6. Record the commit, test time, URL and limitations in the PGP.

## Release boundary

The demo must use synthetic/public records. External AI/CV, real uploads, exact threatened-species locations, scientific validation and enforcement workflows are outside this MVP.

## Handover checklist

- [ ] `main` and Render service point to the intended code.
- [ ] `DATABASE_URL` is set only in Render, never in Git.
- [ ] `/health` and `/api/context` return 200.
- [ ] A synthetic observation can be created and read back.
- [ ] The frontend keeps the draft when the API fails.
- [ ] Evidence and known limitations are linked in the PGP.
