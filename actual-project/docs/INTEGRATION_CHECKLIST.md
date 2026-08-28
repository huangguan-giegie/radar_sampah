# Radar Sampah Integration Checklist

## Identity and configuration

- [ ] Active pages and docs say **Radar Sampah**.
- [ ] `DATABASE_URL` and `LITTER_RECOGNITION_API_KEY` are private and absent
  from Git.
- [ ] `FRONTEND_ORIGINS` matches the frontend URL.
- [ ] `LITTER_RECOGNITION_ENABLED=false` unless the provider was reviewed.
- [ ] A live call requires exactly `true` plus an HTTPS API URL.
- [ ] API root is `actual-project/backend`; static root is
  `actual-project/frontend`; `/health` is the Render health check.

## End-to-end demo

- [ ] Options show five litter types and broad reporting areas.
- [ ] A report saves without coordinates or personal data.
- [ ] Detection clearly says demo fallback or suggestion, then needs user
  confirmation.
- [ ] Heatmap context is broad, source-labelled and has an accessible list.
- [ ] A mission join is anonymous and evidence uses a valid mission and item
  count only.
- [ ] Community progress refresh reads saved demo state without claiming real
  impact.
- [ ] Failed requests keep the draft and show a retry path.

## Evidence and boundary

- [ ] Record commit, test time, URLs, synthetic input, statuses, screenshots
  and known limits.
- [ ] Test keyboard flow, labels, focus and 375px layout.
- [ ] No page shows exact locations, credentials or real personal data.
- [ ] No page claims verified detection, pollution-source proof, dispatch,
  legal decision, cleanup completion or ecological outcome.
- [ ] Preserve a working commit/tag before the final demo.
