# Radar Sampah — Backend API Specification v1 (Iteration 1)

> **This is a contract, not a discussion draft.** The frontend is fully built against it and
> passes end-to-end on mock data. Implement to this and the two sides meet.
> If something here is impractical, say so before changing it — the frontend then adjusts
> in one file, `src/api.ts`.
>
> Chinese version: [`API.md`](./API.md) · Machine-readable: [`openapi.yaml`](./openapi.yaml)
> · Data governance: [the DMP](../docs/DATA_MANAGEMENT_PLAN.md) ([.docx](../docs/RadarSampah_Data_Management_Plan_Iteration1_MVP.docx))

---

## 0. Conventions

> ⚠️ **The backend currently in this repository does not implement this contract.**
> `actual-project/backend/app.py` serves the `/api/*` routes (`/api/litter-reports`,
> `/api/litter-options`, `/api/litter-recognize`, `/api/cleanup-missions` and others).
> It predates this contract and is a different shape: no auth at all, places are `area_id`
> rather than `beaches`, five categories (`Plastic packaging`, no `Paper`), quantity is an
> integer rather than one of four bands, and severity is a three-level high/medium/low
> `priority` rather than the four bands here.
>
> **This document is the target, not a description of what runs today.** Until it is
> implemented, the frontend's `VITE_API_BASE_URL` must stay empty — setting it produces 404s
> for every call to `/auth/*`, `/beaches` and `/reports`. The app currently runs on the seed
> data in `src/mockData.ts`.

| Item | Convention |
| --- | --- |
| Transport | HTTPS, JSON (except photo upload, which is `multipart/form-data`) |
| Encoding | UTF-8 |
| Time | ISO 8601 with offset, e.g. `2026-08-28T09:41:00+08:00`. **"Same day" is always evaluated in `Asia/Kuala_Lumpur`** |
| Auth | `Authorization: Bearer <token>`, stored by the frontend in localStorage |
| Paging | Not in Iteration 1. Four beaches and one person's own reports — return the full set |

### Error shape

Every non-2xx returns:

```json
{ "code": "PHOTO_TOO_LARGE", "message": "Photo exceeds the 10 MB limit." }
```

`message` is a **finished English sentence shown directly to the user** — the frontend does not
rewrite or template it.

| HTTP | code | When |
| --- | --- | --- |
| 400 | `VALIDATION_FAILED` | A required field is missing or a value is outside its enum |
| 400 | `PHOTO_REQUIRED` | A report was submitted without `photoUrl` |
| 400 | `PHOTO_TOO_LARGE` | Photo over 10 MB |
| 400 | `PHOTO_UNSUPPORTED_TYPE` | Not JPEG, PNG or HEIC |
| 401 | `UNAUTHENTICATED` | Token missing, expired or invalid |
| 403 | `NOT_OWNER` | Editing or deleting someone else's report |
| 404 | `NOT_FOUND` | Unknown beach or report |
| 404 | `UNKNOWN_PARTICIPANT` | The participant number does not exist |
| 413 | `PAYLOAD_TOO_LARGE` | Upload rejected at the server layer |
| 429 | `RATE_LIMITED` | See §8 |
| 500 | `INTERNAL_ERROR` | Fallback |

> ⚠️ **A duplicate report is not an error.** Return `201` with `status: "Duplicate"`. The
> frontend shows it as saved-but-not-counted. See §6.

---

## 1. Auth — anonymous participant numbers

**Team decision: Iteration 1 collects no personal data.** No name, no email, no password.
A person receives a 4-digit number (e.g. `1637`) and their reports hang off it.

| Method | Path | Auth | |
| --- | --- | --- | --- |
| POST | `/auth/anonymous` | no | Issue a new number |
| POST | `/auth/restore` | no | Continue with an existing number |
| POST | `/auth/logout` | yes | 204 |
| GET | `/auth/me` | yes | |

**POST `/auth/anonymous`** (no body)

```json
// 201
{
  "token": "eyJhbGciOi...",
  "user": { "id": "u_01H...", "participantId": "1637", "role": "volunteer" }
}
```

**POST `/auth/restore`** — body `{ "participantId": "1637" }`, responds as above.

**GET `/auth/me`** — returns `user`; 401 if the token is invalid.

- `participantId` — 4 digits, **randomly assigned, never sequential**. A sequence would leak how
  many participants exist and who joined first.
- `role` — `"volunteer" | "moderator"`. Iteration 1 only ever issues `volunteer`;
  `moderator` is reserved for the later review flow. Create the value, leave it unused.
- Token — JWT, 30-day expiry, no refresh flow.

> **One thing to be aware of (does not block this iteration).** The number *is* the credential,
> so anyone who types `1637` sees participant 1637's records. That is acceptable for an MVP
> running on synthetic data. Before this holds real public submissions it needs a secret
> alongside the number.

---

## 2. Beaches

| Method | Path | Auth | |
| --- | --- | --- | --- |
| GET | `/beaches` | no | List, for the map and home screen |
| GET | `/beaches/:id` | no | Detail |

**No auth required** — "Browsing needs nothing at all" is a promise made on the welcome screen.

### GET `/beaches` → `BeachSummary[]`

```json
[{
  "id": "morib",
  "name": "Pantai Morib",
  "area": "Banting, Selangor",
  "lat": 2.746,
  "lng": 101.440,

  "severity": "High",
  "band": 3,
  "insufficientData": false,
  "validReports": 8,
  "lastReportedAt": "2026-08-19T16:00:00+08:00",
  "freshnessKind": "ok",

  "habitat": "Intertidal mudflat & sandy shore",
  "habitatTag": "MUDFLAT",
  "sensitivity": "Migratory feeding ground",
  "primarySpeciesGlyph": "turtle",

  "coverImageUrl": "https://cdn.example.com/beaches/morib.jpg",
  "scene": "linear-gradient(178deg,#8FD0E8 0%,#4E9EC9 36%,#2E6EA8 58%,#173E77 100%)"
}]
```

| Field | Type | Notes |
| --- | --- | --- |
| `severity` | `"Low"｜"Moderate"｜"High"｜"Severe"｜null` | **Must be `null` when fewer than 3 valid reports qualify.** Never fall back to `"Low"` |
| `band` | `1｜2｜3｜4｜null` | Paired with `severity`; null together. Drives the four-bar marker |
| `insufficientData` | boolean | True exactly when `severity === null` |
| `validReports` | int | **Counts `Counted` rows only.** Duplicate and Incomplete never counted |
| `lastReportedAt` | string｜null | Newest **Counted** report. The frontend renders "6 days ago" itself — do not send prose |
| `freshnessKind` | `"ok"｜"aging"｜"stale"` | Under 30 days / 30–90 / over 90 or never |
| `primarySpeciesGlyph` | `"turtle"｜"bird"｜"mangrove"｜"grass"｜"crab"｜"fish"` | Icon for the biodiversity map marker |
| `coverImageUrl` | string｜null | Real photo. **Send `null` when there is none** — the frontend falls back to `scene`, so a new beach never renders a blank header |
| `scene` | string | A valid CSS `background` value used as the no-photo placeholder. Present in the seed data — store and return it verbatim |

### GET `/beaches/:id` → `BeachDetail`

`BeachSummary` plus three fields:

```json
{
  "composition": [
    { "category": "Plastic", "quantity": "Large" },
    { "category": "Fishing gear", "quantity": "Medium" }
  ],
  "compositionSource": { "reportId": "r_01H...", "createdAt": "2026-08-19T16:00:00+08:00" },
  "species": [ /* see §2c */ ],
  "ecologicalNote": "Plastic and abandoned fishing gear may affect turtles and shorebirds that feed in this coastal environment."
}
```

- `composition` — the non-null category columns of the beach's newest `Counted` report, ordered by
  category weight. It is **not** an aggregate and does not depend on `insufficientData`; see §2b.
  **`null`, not `[]`, when the beach has no `Counted` report at all.**
- `compositionSource` — which report the composition came from. Required whenever `composition`
  is non-null; the screen prints its date.
- `species` — static reference content, 0–5 entries. See §2c for provenance.
- `ecologicalNote` — one sentence, static.

> **Why severity, band, validReports and composition are all computed server-side.** The product's
> central claim to the user is that one identical rule runs on every beach — the scoring-method
> screen is entirely about this. That rule must have exactly one implementation, on the server,
> auditable. A second implementation in the client would be a second rule.

---

## 2b. Modelled species likelihood (Epic 5 · Su) — field shape pending

Iteration 1 ships a modelled likelihood that a species occurs at a beach. The frontend slot is
ready: each entry in `species[]` may carry an optional `likelihood`.

```json
"likelihood": { "percent": 38, "basis": "Habitat match + 2024 sighting records" }
```

- Omit it or send `null` → the card renders as pure reference content with no percentage at all.
- `basis` — one line explaining what the number rests on. **Shown on screen; never leave it empty
  while a percentage is set.**

### Three hard constraints (already implemented this way in the frontend)

1. **Never merged with litter severity into a single number.** They measure different things and a
   combined figure would be misread.
2. **Visually separate.** The frontend deliberately uses a blue dashed box, not the four severity
   colours, and not a bar chart.
3. **Labelled as an estimate.** When any species carries a likelihood, the beach page's disclaimer
   switches to "…an estimate of how likely a species is to occur here, never a confirmed sighting",
   and the scoring-method screen scopes its "No model, no judgement call" line to the litter band.

These are not fastidiousness. The product's whole proposition is that its numbers are trustworthy;
an unlabelled probability would spend the credibility Epic 4 is built on.

**Decided:** `percent` is a 0–100 integer (§2c: `likelihood_percent int CHECK BETWEEN 0 AND 100`).
**For Su to confirm:** should `basis` carry a model
version? Is there a confidence interval to display? Once decided, the frontend changes in one place.

---

## 2c. Where biodiversity data comes from (required by DMP §2 and §9)

The DMP's source register recognises exactly two open datasets. Both are **CC BY-NC — non-commercial
use only** — and both **require the attribution to be displayed**, with source URL and access date
retained (DMP §9).

Provenance is therefore **part of the data**, not a comment:

```json
{
  "name": "Green Sea Turtle",
  "kind": "species",
  "scientificName": "Chelonia mydas",
  "threatCategory": null,
  "glyph": "turtle",
  "text": "Occasional visitor along the Strait of Malacca…",
  "pictureUrl": null,
  "source": {
    "dataset": "OBIS",
    "citation": "OBIS — Ocean Biodiversity Information System. Intergovernmental Oceanographic Commission of UNESCO. www.obis.org — CC BY-NC",
    "url": "https://api.obis.org/occurrence",
    "accessedAt": "2026-08-28"
  }
}
```

- `kind` — `species` / `habitat` / `group`. **Only `species` can carry a scientific name or threat
  category.** Habitats (mangrove, seagrass) and groups (migratory birds, marine fish) cannot.
- `threatCategory` — from the FishBase extract. **Null when not retrieved. Do not guess.**
- `source.dataset` — `FishBase` / `OBIS` / `other` / `pending`.
- `pictureUrl` — FishBase `picture_url`. **Image rights are separate from the dataset licence** and
  must be checked per image.

### ⚠️ All 11 species cards are currently unsourced

Every entry in `src/mockData.ts` uses `PENDING_SOURCE`, which the UI renders as an amber
`SOURCE PENDING · NOT YET FROM FISHBASE / OBIS` badge. This is deliberate: **better a visible gap
than a fabricated citation in a demo or a report.**

### ⚠️ Only 1 of the 11 can actually come from FishBase

| Card type | Count | FishBase | OBIS |
| --- | --- | --- | --- |
| Marine fish (group) | 1 | yes | yes |
| Sea turtle, horseshoe crab | 2 | no — fish only | yes |
| Mangrove, seagrass (habitats) | 5 | no | no |
| Migratory and coastal birds | 3 | no | no |
| | | | |

**Seven exist in neither dataset.** FishBase covers fish; OBIS covers marine taxa but not
terrestrial birds or plant habitats. Those seven need either a different cited source
(`dataset: "other"`) or a rewrite that does not claim species-level provenance.
**Su and Keith need to settle this together** — it affects both Epic 5's content and the DMP's
source register.

---

### Species storage: `dim_species` + `area_species` (decided)

The species master and "which cards this area shows" are separated. The old `beach_species`
is replaced by these two tables.

```sql
-- Species master, extracted from FishBase. DMP §4.1: upsert on scientific_name
CREATE TABLE dim_threat (
  threat_id     serial PRIMARY KEY,
  threat_name   text NOT NULL UNIQUE          -- threat category dictionary
);

CREATE TABLE dim_species (
  species_id      uuid PRIMARY KEY,
  scientific_name text NOT NULL UNIQUE,       -- upsert key; rows without one are discarded
  common_name     text,
  threat_id       int  REFERENCES dim_threat(threat_id),
  glyph           text NOT NULL,              -- one of the six icon values
  picture_url     text,                       -- image rights are separate; check per image
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- "the biodiversity cards for this area". areas 1 ─ N area_species ─ N…1 dim_species
CREATE TABLE area_species (
  id                  uuid PRIMARY KEY,
  area_id             text NOT NULL REFERENCES beaches(id) ON DELETE CASCADE,
  species_id          uuid NULL REFERENCES dim_species(species_id),

  kind                text NOT NULL CHECK (kind IN ('species','habitat','group')),
  display_name        text NOT NULL,
  glyph               text NOT NULL,          -- 六个图标枚举之一。必须在这里：
                                              -- 生境和统称没有 dim_species 行，
                                              -- 图标也无法从 kind 推出来
                                              -- （group 里既有 bird 又有 fish）
  text                text NOT NULL,
  sort_order          int  NOT NULL DEFAULT 0,
  origin              text NOT NULL DEFAULT 'curated'
                           CHECK (origin IN ('curated','derived')),

  source_dataset      text NOT NULL,
  source_citation     text NOT NULL,
  source_url          text,
  source_accessed_at  date,

  likelihood_percent  int  CHECK (likelihood_percent BETWEEN 0 AND 100),
  likelihood_basis    text,

  UNIQUE (area_id, species_id),
  CHECK ((kind = 'species') = (species_id IS NOT NULL)),
  CHECK ((likelihood_percent IS NULL) = (likelihood_basis IS NULL))
);
```

**A nullable `species_id` is the crux.** Only 2 of the 11 cards are actual species (Green Sea
Turtle, Horseshoe Crab). The other 9 are habitats (mangrove, seagrass) and groups (coastal birds,
migratory shorebirds, marine fish). They have no scientific name, so under DMP §4.1 — *"Rows
without a usable scientific name are discarded"* — they cannot enter `dim_species` at all. The
nullable FK lets those 9 live on their own `area_species` row while `dim_species` stays purely
FishBase-derived.

**Why `text` sits on the junction, not on `dim_species`.** The same card reads differently per
beach: `Coastal Birds` at Morib is *"Migratory shorebirds feed along this tide line…"*, at Kelanang
it is *"Egrets and herons hunt along the shallow channels…"*. `likelihood_*` follows the same logic
— it is inherently a (species × place) value.

**The two CHECKs are guardrails.** `kind='species'` must carry a master row and nothing else may;
the two likelihood columns must be set or null together.

**The API response shape does not change.** The backend joins the two tables and flattens them into
the existing `species[]` array — no frontend code changes.

> **Two open items:**
> ① The DDL says `area_id REFERENCES beaches(id)`. The DMP calls this concept `areas`, the contract
>   calls it `beaches` — same thing, two names. Renaming is a separate step, not part of this change.
> ② `origin` defaults to `curated`. Once OBIS is wired up, occurrences falling inside an area's
>   bounding box can generate `derived` rows without a schema change.

---


### One report, six categories: six new columns on `reports` (decided)

A report used to carry one `category` and one `quantity`. With a column per category, a single
report can describe a mixed pile of litter.

```sql
ALTER TABLE reports
  ADD COLUMN qty_plastic      text CHECK (qty_plastic      IN ('Small','Medium','Large','Very Large')),
  ADD COLUMN qty_fishing_gear text CHECK (qty_fishing_gear IN ('Small','Medium','Large','Very Large')),
  ADD COLUMN qty_glass        text CHECK (qty_glass        IN ('Small','Medium','Large','Very Large')),
  ADD COLUMN qty_metal        text CHECK (qty_metal        IN ('Small','Medium','Large','Very Large')),
  ADD COLUMN qty_paper        text CHECK (qty_paper        IN ('Small','Medium','Large','Very Large')),
  ADD COLUMN qty_other        text CHECK (qty_other        IN ('Small','Medium','Large','Very Large')),

  -- a report with nothing recorded is not a report
  ADD CONSTRAINT reports_at_least_one_category CHECK (
    num_nonnulls(qty_plastic, qty_fishing_gear, qty_glass,
                 qty_metal, qty_paper, qty_other) >= 1
  );
```

**`NULL` means "this category was not seen"**, not "seen, amount zero". The interface has to keep
those apart: an unrecorded category draws no bar, rather than a zero-length one.

**The old `category` / `quantity` columns become derived**, kept so existing responses keep working:

```
category  = the highest-weighted non-null category among the six
            (weights in §3: Fishing gear 1.00 > Plastic 0.85 > Glass 0.70
             > Metal 0.60 > Other 0.50 > Paper 0.35)
quantity  = the value in that category's column
```

Drop them once the record screen is multi-select and the frontend no longer reads them.

### "Learn More" shows the latest report's composition (decided)

**Learn More** on the biodiversity map card and **View Beach** on the litter card go to the same
place — the beach detail page. That page's "LITTER COMPOSITION" block changes meaning:

> **The six-column breakdown of that beach's most recent `Counted` report**, rather than an
> aggregate over the 90-day window.

`GET /beaches/:id` changes accordingly:

```json
"composition": [
  { "category": "Plastic",      "quantity": "Large"  },
  { "category": "Fishing gear", "quantity": "Medium" },
  { "category": "Glass",        "quantity": "Small"  }
],
"compositionSource": {
  "reportId":  "r_01H...",
  "createdAt": "2026-08-19T16:00:00+08:00"
}
```

- List only the **non-null** categories, ordered by weight, descending.
- `compositionSource` is required — the current on-screen line
  `SHARE OF 8 VERIFIED REPORTS · BROAD CATEGORIES` becomes **false** under this change and has to
  say which report it came from instead. Leaving it would mislead the reader.
- With no `Counted` report at all, both `composition` and `compositionSource` return `null`.

> ⚠️ **This makes `area_garbage` pointless.** That table materialises "share of N reports by
> category". If composition is just the latest report, you read it off that one row and no
> aggregate is needed. **`area_garbage` will not be created (decided).**

### Three things this change pulls with it

| Where | Today | Has to become |
| --- | --- | --- |
| `RecordScreen.tsx` | Single-select category (`patchDraft({ category: cat })`) | A quantity band per category, several selectable |
| Severity formula (§7) | `category weight × quantity band`, one value per record | A record now has several categories — decide max, sum or mean |
| `BeachScreen.tsx` caption | `SHARE OF n VERIFIED REPORTS` | Point at the specific report and its date |

**The second one is Darli's call**, because it changes every beach's band on the map. Until it is
settled, severity can run on "the highest-weighted non-null category", which reproduces exactly
today's single-category behaviour.

---

## 3. Scoring rule (US4.3) — this endpoint is optional

| Method | Path | Auth | |
| --- | --- | --- | --- |
| GET | `/scoring-method` | no | **Optional.** Not implementing it does not break the frontend |

**Team decision: US4.3 is a non-blocking stretch, delivered by the frontend.** The weights,
thresholds and window are constants in `src/scoring.ts`, so the scoring-method screen renders
instantly, works offline, and does not wait on the backend.

```json
{
  "categoryWeights": [
    { "category": "Fishing gear", "weight": 1.00 },
    { "category": "Plastic",      "weight": 0.85 },
    { "category": "Glass",        "weight": 0.70 },
    { "category": "Metal",        "weight": 0.60 },
    { "category": "Other",        "weight": 0.50 },
    { "category": "Paper",        "weight": 0.35 }
  ],
  "quantityWeights": [
    { "quantity": "Small",      "weight": 1 },
    { "quantity": "Medium",     "weight": 2 },
    { "quantity": "Large",      "weight": 3 },
    { "quantity": "Very Large", "weight": 4 }
  ],
  "bands": [
    { "band": "Low",      "range": "below 1.5",     "color": "#7CA98B" },
    { "band": "Moderate", "range": "1.5 – 2.4",     "color": "#D9A24B" },
    { "band": "High",     "range": "2.5 – 3.4",     "color": "#CE6B45" },
    { "band": "Severe",   "range": "3.5 and above", "color": "#B84A3F" }
  ],
  "windowDays": 90,
  "minReports": 3
}
```

### ⚠️ You may skip the endpoint, but you must use these numbers

Severity is computed by the backend (§7); the published rule is rendered by the frontend. **If the
two disagree, the screen explaining the rule is lying about the rule.**

- The numbers above are the specification; `src/scoring.ts` is their executable copy.
- If you do implement the endpoint and return different values, the frontend **uses yours** (that
  is the rule actually in force) and logs a console warning in dev naming the mismatched field.
- Changing any weight or threshold means changing both sides and bumping the rule version.

> DMP §7.1 requires the rule set to be **fixed and versioned** so past scores stay explainable.
> Add a `ruleVersion` string when you implement scoring, and store it on each computed score.

---

## 4. Location → beach

| Method | Path | Auth | |
| --- | --- | --- | --- |
| POST | `/geo/resolve-beach` | yes | body `{ lat, lng }` → `BeachSummary` or `null` |

After the user taps "Allow Once", the browser hands over one reading and the backend resolves the
nearest supported beach. Out of range returns `null` (a 200 with a null body, not a 404) and the
frontend switches to manual selection.

- Haversine distance; **a hit requires ≤ 25 km**. The two closest beaches (Morib and Kelanang) are
  about 6 km apart, so 25 km separates them while tolerating coastal GPS drift.
- **These coordinates are not persisted by this endpoint.** They are used for the lookup and dropped.

---

## 5. Photo upload

**Photos do not go into the database, and there is no `photos` table.**
The bytes live in object storage (or on disk); `reports` keeps only an address.

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| POST | `/uploads/photos` | yes | `multipart/form-data`, field name `photo` |

```json
// 201
{
  "url": "https://cdn.example.com/photos/8f3a....jpg",
  "metadataStripped": true
}
```

Two columns on the report:

```sql
ALTER TABLE reports
  ADD COLUMN photo_url      text    NOT NULL,
  ADD COLUMN photo_stripped boolean NOT NULL;
```

`POST /reports` carries `photoUrl` — the address the upload returned — not an id. With no
`photos` table there is no id to reference.

### Three things the backend must do

1. **Strip EXIF**, the GPS block above all. Only return `metadataStripped: true`, and only write
   `reports.photo_stripped = true`, once it is really gone — the app shows its
   "LOCATION METADATA REMOVED FOR PRIVACY" badge from that field. **Return `false` rather than
   lying**; the badge is a promise to the user.
2. **Limits**: ≤ 10 MB; accept `image/jpeg`, `image/png` and `image/heic` (an iPhone shoots HEIC,
   so it must be accepted and converted to JPEG); resize the long edge to ≤ 2048 px.
3. **Sweep orphans**: files uploaded but referenced by no report within 24 hours get deleted. The
   bytes are outside the database, so this sweep has to be written by hand — no foreign key will
   do it for you.

### The address is public (decided)

`url` is readable without auth. This **departs from DMP §5**, which asks for storage
`outside public web root` with `Access controlled`. It is a team decision. Having chosen public,
these three are what make it defensible:

1. **Filenames must not be enumerable** — random ids, never a sequence, never the original filename
2. **EXIF must actually be gone** — with a public address, stripping is the only thing standing
   between a photo and a leaked location
3. **No personal information in the filename** — no participant number, beach name or date

> ⚠️ **The database holds an address, not an image.** Delete the file in storage and `photo_url`
> becomes a link to nothing, with nothing on the database side noticing. Deleting a report has to
> delete the file too, and vice versa.

---

## 6. Reports ★ core

| Method | Path | Auth | |
| --- | --- | --- | --- |
| POST | `/reports` | yes | Submit |
| GET | `/reports/mine?status=` | yes | Own reports, newest first |
| GET | `/reports/mine/counts` | yes | `{ counted, duplicate, incomplete }` |
| PATCH | `/reports/:id` | yes | Correct a report |

### POST `/reports`

```json
{
  "beachId": "morib",
  "quantities": {
    "Plastic": "Large",
    "Fishing gear": "Medium",
    "Glass": "Small"
  },
  "photoUrl": "https://cdn.example.com/photos/8f3a....jpg",
  "locationSource": "gps",
  "coords": { "lat": 2.746, "lng": 101.440 }
}
```

- **`quantities` is an object, not an array.** Keys are the category strings verbatim
  (`Plastic` / `Fishing gear` / `Glass` / `Metal` / `Paper` / `Other`), values are one of the four
  bands. **At least one entry.** A category that was not seen is simply absent — do not send
  `null` and do not send 0. The backend maps this onto the six `qty_*` columns and leaves the
  rest `NULL`.
- **`category` and `quantity` are no longer in the request.** They are derived server-side from
  `quantities` — the highest-weighted non-null category and its band (see §2c) — and still come
  back in every response.
- **The response must also carry the full `quantities` map.** The derived pair alone is not
  enough: the app's "correct this record" flow reads the response back into the form and PATCHes
  the whole set. If the response names only one category, a user replacing just the photo would
  silently clear the other five columns — a real data-loss bug, not a cosmetic one.

```json
// 201
{
  "id": "r_01H...",
  "beachId": "morib",
  "beachName": "Pantai Morib",
  "quantities": {
    "Plastic": "Large",
    "Fishing gear": "Medium",
    "Glass": "Small"
  },
  "category": "Fishing gear",
  "quantity": "Medium",
  "createdAt": "2026-08-28T09:41:00+08:00",
  "status": "Counted",
  "photoUrl": "https://cdn.example.com/photos/ph_01H....jpg"
}
```

When judged a duplicate, the same 201 shape carries:

```json
{
  "status": "Duplicate",
  "statusNote": "Matched an existing record for the same beach on the same day — excluded from the severity calculation."
}
```

### Status is decided synchronously, inside the POST transaction

**Why synchronous.** The design takes the user straight to a "Record saved" screen that prints the
conclusion — `VALID · NOT A DUPLICATE · COUNTED`. An asynchronous review would need a Pending state
and a notification system, which is the Iteration 2 moderation flow and explicitly out of scope.

Evaluated in order, first match wins:

| # | Condition | Result |
| --- | --- | --- |
| 1 | `photoUrl` missing | 400 `PHOTO_REQUIRED`, nothing stored |
| 2 | `quantities` empty, or a key/value outside its enum | 400 `VALIDATION_FAILED`, nothing stored |
| 3 | Same **reporter** + same **beachId** + same **calendar day** (`Asia/Kuala_Lumpur`) already has a `Counted` row | `Duplicate` |
| 4 | Otherwise | `Counted` |

**Rule 3 is the entire duplicate definition — do not add a coordinate-distance test.** The sentence
the app shows the user ("Matched an existing record for the same beach on the same day") is the
natural-language form of exactly this rule, and the two must not drift. Several photos of different
angles on one beach in one day should not score twice anyway.

**Where does `Incomplete` come from?** Never from a POST — a missing field is rejected with a 400 and
nothing is stored. `Incomplete` is set **afterwards**, from one of two places:

- the photo pipeline finding the image unreadable (all black, hopelessly blurred, decode failure)
- Iteration 2 human review (not implemented now; the value exists so the state machine is complete)

So in Iteration 1, `Incomplete` appears only in seed data and from the photo pipeline. The frontend
already handles it: tapping such a record opens the correction flow pre-filled, and a PATCH re-runs
the judgement.

### `statusNote`

**The backend sends a finished English sentence; the frontend prints it verbatim.** Two standard
strings:

- Duplicate → `Matched an existing record for the same beach on the same day — excluded from the severity calculation.`
- Incomplete → `Photo unreadable — excluded until you correct and save the record.`

Omit the field (or send `null`) when `Counted`.

### How location is stored (decided)

Coordinates live **on the `reports` row itself** (`lat` / `lng`, nullable) rather than in a separate
table, matching DMP §6's `litter_reports: photo ref, approx location, category, quantity, status…`.

- Written only when `locationSource = 'gps'`; both columns null for a manual beach pick.
- Used for exactly two things: matching the beach, and detecting duplicates.
- **Precision: 3 decimal places (~110 m).** The frontend rounds at capture in `GpsScreen`, so the
  full-precision reading never leaves the device. That is what makes both the DMP's
  `no exact locations are stored` and the on-screen "EXACT GPS IS PRIVATE" true at the same time.

### Privacy requirements (hard)

- **No endpoint may ever return `lat` / `lng`** — not report detail, not the record list, not a CSV
  export, not an admin screen.
- Public geography stops at `beachId`.

> ⚠️ **The coordinates now sit in the same table as business fields, so `SELECT *` will carry them
> out.** Exclude the two columns explicitly in the ORM or serialisation layer — never assemble a
> response straight from `SELECT *` — and make it a standing code-review check.

Two on-screen promises depend on this: "GPS USED ONCE · PRIVATE" on the confirm screen, and
"BROAD AREA SHOWN — EXACT GPS IS PRIVATE" on the map card.

### GET `/reports/mine?status=`

Optional `status` filter (`Counted` / `Duplicate` / `Incomplete`); omitted returns everything.
**Newest first.** Only the authenticated user's own rows.

### GET `/reports/mine/counts`

```json
{ "counted": 3, "duplicate": 1, "incomplete": 1 }
```

### PATCH `/reports/:id`

Body is any subset of the POST body (`beachId` / `quantities` / `photoUrl`).
**Sending `quantities` replaces the whole set**, it is not a per-key merge — a category left out is a column cleared.

- Own reports only, otherwise 403 `NOT_OWNER`.
- **Re-run the status judgement.** An `Incomplete` record with a fixed photo must return to `Counted`.
- Returns the full updated `LitterReport`.

---

## 7. How severity is computed (backend detail)

```
For one beach:

eligible = that beach's reports where status = 'Counted'
           and created_at falls within the last 90 days

if count(eligible) < 3:
    severity = null;  band = null;  insufficientData = true
else:
    record_score  = category_weight[category] × quantity_weight[quantity]
                    ← which category, when a report has several: see the open question below
    beach_score   = mean(record_score across eligible)
    severity      = < 1.5 → Low | < 2.5 → Moderate | < 3.5 → High | else Severe
    band          = Low=1, Moderate=2, High=3, Severe=4

validReports    = count(eligible)
lastReportedAt  = max(created_at) across ALL that beach's Counted reports (window ignored)
freshnessKind   = now - lastReportedAt: < 30d → 'ok' | ≤ 90d → 'aging' | else 'stale'

composition       = the non-null qty_* columns of that beach's newest Counted report,
                    ordered by category weight, descending
compositionSource = that report's { reportId, createdAt }
                    both null when the beach has no Counted report at all
                    ← composition ignores the 90-day window and does not depend
                      on insufficientData
```

Note `lastReportedAt` **deliberately ignores the 90-day window** — "nothing reported recently" is
itself the finding being reported, so an empty window is not the same as no history.

Use the weights and thresholds from §3 — do not introduce a second set.

Implementation is free: a cached column updated on write, or computed at read time (four beaches
makes live computation entirely viable).

---

## 8. Rate limits

Per user: `POST /reports` 30/hour, `POST /uploads/photos` 60/hour.
Over the limit returns 429 `RATE_LIMITED`.

---

## 9. Suggested tables

![Entity relationship diagram](./docs/erd.png)


```
users            id, participant_id(uniq), role, created_at
                 ← no name, email or phone columns of any kind

beaches          id, name, area, lat, lng, habitat, habitat_tag, sensitivity,
                 primary_species_glyph, cover_image_url, scene,
                 ecological_note, created_at

dim_threat       threat_id(PK), threat_name(uniq)          ← DMP §6 dictionary
dim_species      species_id(PK), scientific_name(uniq), common_name,
                 threat_id(FK), glyph, picture_url, created_at
                 ← real species only, upserted on scientific_name
area_species     id(PK), area_id(FK→beaches), species_id(FK→dim_species, nullable),
                 kind, display_name, glyph, text, sort_order, origin,
                 source_dataset, source_citation, source_url, source_accessed_at,
                 likelihood_percent(nullable), likelihood_basis(nullable)
                 ← area×species junction; habitats and groups have a null species_id

reports          id, reporter_id, beach_id, location_source,
                 photo_url, photo_stripped
                 ← no photos table and no bytes in the database; just an address
                 qty_plastic, qty_fishing_gear, qty_glass,
                 qty_metal, qty_paper, qty_other        ← 每列可空，至少一列非空
                 category, quantity                     ← 派生：权重最高的非空类别
                 lat(nullable), lng(nullable),
                 status, status_note, created_at, updated_at, deleted_at
                 ← lat/lng written only for gps, stored to 3 decimals,
                   never in any response (exclude explicitly when serialising)

```

Two indexes carry the whole application:
`(beach_id, status, created_at)` for the severity window, and
`(reporter_id, beach_id, created_at)` for the duplicate check.

`beaches` and `area_species` are **seed data** — four beaches fixed for Iteration 1, no CRUD
endpoints. Copy the contents from the frontend's `src/mockData.ts`; the field names line up.

---

## 10. Out of scope for Iteration 1 (do not build)

Marked out of scope in the design and the team's MVP split: US2.3 AI category suggestions,
peer and moderator review flows, Epic 1 cleanup activities, Epic 3 report reliability,
Epic 6 outcomes, Epic 7 recurrence, Epic 8 recognition, US5.3 quizzes, US5.4 species cards.

> ⚠️ **The DMP disagrees with this list.** Its Iteration 1 scope statement includes a
> "basic verification workflow", "community cleanup missions" and "basic points" — Epics 3, 1 and 8.
> The team's MVP split removed Epic 3 and parked the rest. **Both documents are signed and they
> contradict each other.** Settle it before anyone builds from the DMP's scope line.

---

## 11. Connecting the frontend when the backend is ready

```bash
cd actual-project/frontend
cp .env.example .env
# set VITE_API_BASE_URL=https://your-api.example.com
npm run dev
```

The frontend switches from mock data to real HTTP automatically; no page code changes. If field
names or paths differ from this document, the edits are confined to `src/api.ts`.
