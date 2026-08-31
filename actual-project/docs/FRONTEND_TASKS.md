# Frontend — what needs changing

**Owner:** Qian Jiang (UI/UX and frontend)
**Checked against:** [`frontend/API.md`](../frontend/API.md) as it stands today.

Every item below was found by reading the code and then re-checked against the contract; items
that did not survive that second pass are not here. Line numbers are from the current tree.

The app works today because it runs on mock data (`USE_MOCK` in `src/api.ts`). Most of what
follows only bites the first time a real backend is on the other end.

---

## 1. Blocking — a report can still only carry one category

This is the one thing worth doing first. Everything else is small by comparison.

`reports` now has six per-category quantity columns and `GET /beaches/:id` builds its composition
from them, but **the app can never produce more than one.** `RecordScreen.tsx:122` does
`patchDraft({ category: cat })` — picking a second category replaces the first — and
`RecordScreen.tsx:158` writes one global quantity band for the whole report.

**The wire format does not exist yet.** `CreateReportInput` (`src/types.ts:141`), the
`CreateReport` schema in `openapi.yaml:492`, and the `POST /reports` example in API.md §6 all
still show a single `category` + `quantity`. `grep -rn 'quantities\|qty_' src/ openapi.yaml`
returns nothing. **Agree the JSON field names with LiHanXia before writing any UI** — the
frontend cannot invent them.

Once the shape is settled, it touches five files, not one:

| File | Change |
| --- | --- |
| `src/AppContext.tsx:24` | add `quantities: Partial<Record<LitterCategory, QuantityBand>>`, seed `{}` in `emptyDraft` |
| `src/screens/RecordScreen.tsx:115` | each category gets its own band row; tapping a chosen band again clears that category |
| `src/screens/RecordScreen.tsx:142-202` | the standalone QUANTITY BAND section goes away |
| `src/flowRules.ts:16,23-24` | validation becomes "at least one category has a band", matching the DB `CHECK` |
| `src/screens/ReviewScreen.tsx:118-119` | summary becomes multi-row |

Keep `category` / `quantity` on the draft for now — responses still return the derived pair, and
the correction flow (`SubmittedScreen.tsx:154`, `MyReportsScreen.tsx:115`) seeds from it.

The severity formula is now fixed: calculate Category Score for every selected category, use the
maximum as Report Score, then use the median of eligible Report Scores from the latest 90 days for
the beach band. The frontend mirrors this rule in `src/scoring.ts` for mock/offline mode.

---

## 2. `openapi.yaml` has drifted from `API.md`

Not frontend code, but LiHanXia may generate from it, and a backend built from the current file
breaks the beach page in four different ways. **API.md wins on every one of these.**

| Line | Says | Should say |
| --- | --- | --- |
| `423` | `CompositionSlice` = `[category, percent]`, percent 0–100 | `[category, quantity]` — `src/types.ts:67` and `BeachScreen.tsx:177` read `quantity`. With `percent`, every bar renders at the same 25% fallback width and the label is blank |
| `434` | `BeachDetail` has no `compositionSource` | add it (nullable, required whenever `composition` is non-null). Without it `BeachScreen.tsx:190` loses the report date and falls back to a bare `BROAD CATEGORIES` |
| `405` | `Species.source` is a plain string | the four-field object from §2c. With a string, `sp.source.dataset` is `undefined`, so the amber `SOURCE PENDING` badge never fires and the citation line renders as a bare `SOURCE ·` |
| `398` | `Species` has only name/glyph/text/source | add `kind`, `scientificName`, `threatCategory`, `pictureUrl` — `BeachScreen.tsx:281` renders the middle two |
| `481` | `UploadedPhoto` requires an `id` | `required: [url, metadataStripped]` — the id was for the photos table, which no longer exists |

---

## 3. Copy that claims something untrue

These are the ones I would fix first after §1, because they mislead a user rather than breaking a
render.

- **`BeachScreen.tsx:201`** — the empty composition panel says "Composition appears once at least
  three valid, non-duplicate records exist." Composition now comes from the newest `Counted`
  report, so it appears after the **first** one. The three-report threshold governs severity only.
- **`BeachScreen.tsx:242` and `MethodScreen.tsx:197-222`** — "SENSITIVITY ANALYSIS APPLIED",
  "Thresholds were stress-tested", "±20% weight and threshold variation tested". No such analysis
  exists. Either drop the claim or reword it as planned. "SAME RULE FOR ALL BEACHES" is fine —
  API.md §3 backs it.
- **`MapScreen.tsx:347`** — a beach with no report reads "LAST REPORTED NEVER REPORTED". Branch on
  `lastReportedAt === null` and drop the prefix; `HomeScreen.tsx:84` already gets this right.
- **`mockData.ts:45,64`** — Green Sea Turtle carries `likelihood: { percent: 38 }` and Coastal
  Birds `{ percent: 76 }`. Both are invented, and `BeachScreen.tsx:355` then swaps the disclaimer
  to "Percentages are modelled from habitat type and past survey records", which is false for
  both. The same cards simultaneously show `SOURCE PENDING`. Either delete the two `likelihood`
  objects until Su's model lands (§2b says a null likelihood renders as pure reference content),
  or give the number the same visible placeholder treatment the citation gets.

---

## 4. What happens when the backend fails

The app has never met a failing backend. Ten places swallow errors in ways that mislead:

| File | Today | Should |
| --- | --- | --- |
| `api.ts:59`, `api.ts:312` | no timeout on any `fetch` | AbortController — ~15 s for JSON, longer for the photo upload (10 MB over mobile). Without it Submit sits on "Saving…" forever and MapScreen's existing Retry never renders |
| `MyReportsScreen.tsx:28` | `.catch(() => setReports([]))` | a failed list looks identical to "you have no reports yet". Add a `failed` flag and `ErrorNote`, as `MapScreen.tsx:35/43` already does |
| `HomeScreen.tsx:131` | same | renders a 2px hairline under a header still claiming "4 BEACHES". Also guard the counts fetch on `user` — `/home` is not behind `RequireAuth`, so a guest triggers a guaranteed 401 |
| `ConfirmBeachScreen.tsx:20` | same | strands the report flow in an empty picker reading `No supported beach matches ""`. The photo already uploaded then becomes an orphan |
| `ReviewScreen.tsx:117` | `beach?.name ?? 'Not selected'` | says "Not selected" for a beach the user did select, until `/beaches` resolves — and forever if it fails. Carry `beachName` on the draft; every setter already has it |
| `SubmittedScreen.tsx:20` | discards the POST response, re-fetches the list to find the record | if that GET is slow or fails, line 40 redirects away and the confirmation page never shows. Keep the returned `LitterReport` in context |
| `IdentityScreen.tsx:48` | bare `catch {` | a 500 tells the volunteer their ID is wrong. Bind the error and prefer its message |
| `api.ts:69,318` | Chinese fallback strings | `请求失败（502）` and `照片上传失败` are rendered verbatim in an English UI |
| `api.ts:231` | `getMe()` returns null on any failure | an unreachable server logs the user out. Return null only for 401 |
| `GpsScreen.tsx:42` | silent `catch` | a failed lookup is indistinguishable from "no beach nearby". Show a distinct toast |

---

## 5. Smaller things

- **`api.ts:330`** — mock `createReport` drops `input.photoUrl`, so "Correct Record" opens with an
  empty photo slot and My Reports falls back to the beach cover. Note the mock upload returns a
  `blob:` URL while reports persist to `localStorage`, so a naive copy leaves a dead URL after
  reload — return a `data:` URL from the mock instead.
- **`types.ts:135-136`** — `statusNote` and `photoUrl` are typed `?: string`, excluding null,
  while `openapi.yaml:526` marks both `nullable: true`. Nothing catches it today because
  `request()` returns untyped JSON. Change to `?: string | null`.
- **`MethodScreen.tsx:157` and `:12`** — the prose hardcodes "three" and "90-day" while every
  other number on the page interpolates from `ScoringMethod`. If the backend publishes different
  values, the page contradicts itself.
- **`MethodScreen.tsx:25`** — the backend's scoring rule replaces the local one wholesale with no
  comparison. API.md §3 promises a dev-mode warning on mismatch; there is no `console.warn`
  anywhere in `src/`. Either add the check under `import.meta.env.DEV`, or delete the promise
  from §3.
- **`SubmittedScreen.tsx:114`** — shows a locally written paraphrase instead of the backend's
  `statusNote`, so the same Duplicate report reads differently here and in My Reports.
- **`MyReportsScreen.tsx:109`** — `Counted` and `Duplicate` rows are `<button>` elements whose
  handler returns immediately. They are keyboard tab stops announced as buttons that do nothing.
- **`api.ts:403`** — `deleteReport` is implemented and specified, but no screen calls it. Either
  add a delete affordance or drop the endpoint from Iteration 1, so LiHanXia does not build soft
  delete plus severity recalculation for a path nothing uses.

---

## Suggested order

1. Settle the multi-category request shape with LiHanXia (§1) — everything else can proceed in
   parallel, but this one has a dependency outside the frontend
2. §3, the untrue copy — small, and it is what a marker or a user actually reads
3. §2, `openapi.yaml` — before LiHanXia generates anything from it
4. §4, the failure paths — as soon as there is a real backend to fail
5. §1 implementation, then §5
