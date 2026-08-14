# Marine MVP QA and Deployment Checklist

**Document control:** Version 1.0 | 14 August 2026 | Release evidence template

**Audience:** Testers, integrators, demonstrators and release reviewers

> **Safety boundary:** Use synthetic or public data only. This MVP is a demonstration and learning tool. It does not prove a pollution source, verify species identity, establish ecological impact, or direct environmental enforcement or official clean-up action.

## Test record

Complete this block for each release candidate.

| Field | Evidence |
|---|---|
| Test date and time |  |
| Tester |  |
| GitHub commit |  |
| Render frontend URL | https://team04-marine-observation-frontend.onrender.com |
| Render API URL | https://team04-marine-observation-api.onrender.com |
| Synthetic test case |  |
| Overall result | Pass / Pass with limitations / Fail |

## Preconditions

- [ ] The release commit is identified and matches the intended `main` state.
- [ ] The frontend and API services are reachable over HTTPS.
- [ ] `DATABASE_URL` is configured privately in Render and is not visible in Git or screenshots.
- [ ] The test uses invented values and a non-sensitive demonstration location.
- [ ] The tester has opened the browser console and can capture status codes or error evidence.

## End-to-end functional checks

- [ ] The report form accepts one supported category, area, time and valid coordinates.
- [ ] The Approximate area native dropdown displays all five source-labelled
  coarse area suggestions after `/api/options` loads.
- [ ] Optional notes and a safe HTTPS image URL behave as documented.
- [ ] Review displays every entered value and provides a clear edit action.
- [ ] Editing a reviewed value invalidates the previous confirmation.
- [ ] Only explicit confirmation submits the record.
- [ ] A successful submission shows the saved observation, category result, illustrative priority and disclaimer.
- [ ] Refreshing the observation view can read back the saved synthetic record.
- [ ] OBIS context shows source, data version and a list fallback beside the map.
- [ ] Sensitive context coordinates are approximate or masked.
- [ ] API failure keeps the confirmed draft and provides a clear retry message.

## Validation and error checks

- [ ] An unsupported category is rejected with a clear message.
- [ ] Missing required values are rejected before submission.
- [ ] Latitude outside -90 to 90 and longitude outside -180 to 180 are rejected.
- [ ] A future observation time, unsafe image URL or overlong notes are rejected.
- [ ] Validation identifies the field that needs correction.
- [ ] The interface does not display raw stack traces, database details or credentials.

## API checks

| Check | Expected result | Evidence |
|---|---|---|
| `GET /health` | HTTP 200; service, synthetic/public boundary and database mode are present |  |
| `GET /api/context` | HTTP 200; OBIS source and data version are present |  |
| `GET /api/options` | HTTP 200; catalogue version and five area labels are present |  |
| Valid `POST /api/observations` | HTTP 201; observation and derived fields are returned |  |
| Invalid `POST /api/observations` | HTTP 400 with a safe, actionable validation message |  |
| `GET /api/observations` after create | The saved synthetic record is returned after refresh |  |
| Response privacy review | No names, phone numbers, accounts, private locations, keys or connection strings |  |

## Accessibility and responsive checks

- [ ] Every input and control has a programmatic label.
- [ ] Keyboard focus is visible and the full flow can be completed without a mouse.
- [ ] Error messages are announced near the field that needs correction.
- [ ] Status is explained with text or symbols and not by colour alone.
- [ ] The map has an accessible list fallback containing equivalent context.
- [ ] The 375 px layout has no horizontal overflow or clipped controls.
- [ ] Zoom at 200% keeps content readable and actions available.
- [ ] Headings, landmarks and reading order are logical.

## Data, safety and interpretation checks

- [ ] All entered observation data is synthetic and contains no personal identifiers.
- [ ] OBIS context displays source and version information.
- [ ] Exact sensitive species locations are not exposed.
- [ ] Category and priority wording is clearly illustrative and rule-based.
- [ ] No screen claims to prove a pollution source, species identity or ecological impact.
- [ ] No screen directs enforcement or presents an official clean-up priority.
- [ ] External AI, computer vision and real raw-file upload remain disabled.

## Deployment and evidence checks

- [ ] The frontend calls the intended Render API URL.
- [ ] Both services use HTTPS and no mixed-content error appears.
- [ ] A cold-start or temporary API delay produces a recoverable experience.
- [ ] One screenshot shows the completed result and visible boundary wording.
- [ ] The PGP records commit, test time, URLs, synthetic inputs, response status and known limitations.
- [ ] The release owner records any failed item with an owner and next action.

## Known limitations to disclose

The first release uses a static OBIS sample and deterministic illustrative rules. It does not provide real-time monitoring, verified species identification, pollution-source attribution, ecological assessment, automated clean-up scheduling or enforcement support. Passing this checklist supports a course demonstration, not production readiness.

## Project spaces

[GitHub](https://github.com/huangguan-giegie/team04-marine-observation-mvp) | [Render frontend](https://team04-marine-observation-frontend.onrender.com) | [Render API](https://team04-marine-observation-api.onrender.com) | [Drive PGP](https://drive.google.com/drive/folders/18Px2njE27SCiZ4bs-40zgUgm_sRE70Kx) | [Miro](https://miro.com/app/board/uXjVHySKbPY=/)
