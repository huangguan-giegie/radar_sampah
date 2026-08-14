# Marine Observation MVP — QA and Deployment Checklist

## Test boundary

Use the deployed Render frontend and API with synthetic/public values only. Do not enter personal information or private locations.

## Functional checks

- [ ] Report form accepts one supported litter category, area, time and valid coordinates.
- [ ] Invalid category, coordinate, time, image URL or overlong text is rejected with a clear message.
- [ ] Review shows all entered values and allows editing.
- [ ] Editing invalidates the previous confirmation.
- [ ] Only an explicit confirmation submits the record.
- [ ] Results show the saved observation, classification, illustrative priority and disclaimer.
- [ ] OBIS context shows source, version and a list fallback beside the map.
- [ ] Sensitive context coordinates are masked or aggregated.
- [ ] API failure shows a retry message and keeps the confirmed draft.

## API checks

- `GET /health` returns 200 and reports the configured database on Render.
- `GET /api/context` returns source-labelled OBIS data.
- A valid `POST /api/observations` returns 201 and derived fields.
- Missing fields and invalid values return 400.
- `GET /api/observations` can read the saved synthetic record after refresh.
- No response contains names, phone numbers, accounts or secrets.

## Accessibility checks

- [ ] All controls have labels and visible focus.
- [ ] Status is explained with words and symbols, not colour alone.
- [ ] The map has an accessible list fallback.
- [ ] The 375px layout has no horizontal overflow.
- [ ] Error text is announced near the control that needs correction.

## Deployment evidence

Record the date, GitHub commit, Render URL, test values, API response status and one screenshot in `05 Evidence`. The current service URLs are listed in `TEAM04_Marine_Project_Information.md`.

## Known limitations

The category and priority rules are illustrative. The demo does not establish pollution source, species identity, ecological impact or enforcement priority. External AI/CV and real data remain disabled.
