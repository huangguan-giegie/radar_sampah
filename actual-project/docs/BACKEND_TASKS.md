# Backend — what to build

**Owner:** LiHanXia (backend / API — validation, Flask routes, service integration)
**Source of truth:** [`frontend/API.md`](../frontend/API.md). English:
[`frontend/API.en.md`](../frontend/API.en.md).

> ⚠️ **`frontend/openapi.yaml` has drifted and is wrong in five places** — the composition shape,
> the missing `compositionSource`, the species `source` shape, four missing `Species` fields, and
> a leftover `id` on the photo upload. They are listed in
> [`FRONTEND_TASKS.md`](FRONTEND_TASKS.md) §2 and are being fixed. **Until then, API.md wins** —
> do not generate models from the YAML.
**Schema:** [`DATABASE_TASKS.md`](DATABASE_TASKS.md) (Keith) — build order and constraints.

14 endpoints. The frontend is already written against all of them and runs today on mock
data, so **the contract is not a proposal — it is what the app already calls.**

---

## 0. How to know it works

The app switches from mock data to a real backend with one environment variable:

```
VITE_API_BASE_URL=http://localhost:5000
```

With it unset, `USE_MOCK` in `frontend/src/api.ts` is true and nothing hits the network. Set it,
and every call in that file goes to your Flask app. **That file is the exact list of requests you
have to answer** — one function per endpoint, each showing the precise URL, method and body.
Read it before writing routes; it is shorter than this document.

Ask Qian Jiang to point the frontend at your machine as soon as `/auth/anonymous` and
`/beaches` work. Do not wait until everything is done.

---

## 1. Build in this order

Each step makes a bit more of the app usable. Do not build them in file order.

| # | Endpoints | Unlocks |
| --- | --- | --- |
| 1 | `POST /auth/anonymous`, `POST /auth/restore`, `GET /auth/me`, `POST /auth/logout` | the app opens at all — every other route needs a token |
| 2 | `GET /beaches`, `GET /beaches/:id` | map, beach list, beach detail, biodiversity |
| 3 | `POST /uploads/photos` | the photo step |
| 4 | `POST /reports` | the whole record flow, end to end |
| 5 | `GET /reports/mine`, `GET /reports/mine/counts` | "My records" |
| 6 | `PATCH /reports/:id`, `DELETE /reports/:id` | correcting and removing |
| 7 | `POST /geo/resolve-beach` | GPS → beach; the app falls back to manual pick without it |
| 8 | `GET /scoring-method` | **optional.** The frontend already ships these numbers; see §5 |

---

## 2. Auth — a number, not an account

`POST /auth/anonymous` issues a **random** 4-digit `participantId` and returns a token. Random,
not sequential: a sequence leaks how many participants exist and who joined first. The pool is
9000, so retry on collision and fail loudly when it is exhausted rather than reusing one.

`POST /auth/restore` takes an existing number and returns a token for it. **A number that does
not exist is `404 UNKNOWN_PARTICIPANT`, not 401** — the app shows a different message for each.

There is no password. **The number is the credential**, and anyone who types 1637 sees
participant 1637's records. That is acceptable for a demo on synthetic data and is a decision
already taken — do not add a password field. Do not add name, email or phone either; `users` has
no columns for them, by design.

---

## 3. `POST /reports` — the one that matters

This is the core of the product. Everything else is around it.

### Validation, in this order, stopping at the first hit

| # | Condition | Result |
| --- | --- | --- |
| 1 | `photoUrl` missing | `400 PHOTO_REQUIRED`, nothing stored |
| 2 | a category or quantity value outside its enum | `400 VALIDATION_FAILED`, nothing stored |
| 3 | all six `qty_*` fields empty | `400 VALIDATION_FAILED`, nothing stored |
| 4 | same reporter + same beach + same calendar day (**`Asia/Kuala_Lumpur`**) already has a `Counted` report | store with `status = 'Duplicate'` |
| 5 | otherwise | store with `status = 'Counted'` |

**Row 4 is the entire duplicate rule. Do not add a coordinate-distance test.** The app already
prints the natural-language version of this rule to the user ("Matched an existing record for the
same beach on the same day"), and the two must agree. Several photos of the same beach on the
same day should not each count.

**The timezone matters.** "Same day" is a Kuala Lumpur calendar day, not UTC. Getting this wrong
makes the duplicate rule behave differently in the evening.

**This all happens synchronously, inside the POST transaction.** The app navigates straight to a
"Record saved" screen that states the outcome. There is no pending state in Iteration 1.

### `Incomplete` is not produced here

A missing field is rejected with a 400, so `POST` never creates an `Incomplete` row. That status
exists for one thing only in Iteration 1: a photo the processing pipeline later finds unreadable
flips an existing report to `Incomplete`. Create the value; nothing has to produce it yet.

### Six categories, one report

`reports` has six nullable quantity columns, one per category. **`NULL` means "not seen", never
"zero".** `category` and `quantity` are derived — the highest-weighted non-null column and its
value — and are kept so the existing list views and the severity rule keep working. Compute them
on write.

---

## 4. Photos — bytes never touch the database

`POST /uploads/photos` takes `multipart/form-data` with a field named `photo`, and returns
`{ url, metadataStripped }`. There is no `photos` table and no `id` — the report carries the URL.

Three things are not optional:

1. **Strip EXIF, above all the GPS block.** Only return `metadataStripped: true` once it is
   really gone. The app renders a "LOCATION METADATA REMOVED FOR PRIVACY" badge from that field.
   **Return `false` rather than lying** — that badge is a promise to a user.
2. **Limits:** ≤ 10 MB; accept `image/jpeg`, `image/png` and `image/heic` (an iPhone shoots HEIC,
   so it must be accepted and converted to JPEG); resize the long edge to ≤ 2048 px.
3. **The URL must not be enumerable.** Random filename — never a sequence, never the original
   filename, and never containing a participant number, beach name or date. The URL is public
   and unauthenticated, so an enumerable name exposes every photo ever uploaded.

### Two jobs no foreign key will do for you

The bytes live outside the database, so nothing cascades:

- **Sweep orphans.** A file uploaded but referenced by no report within 24 hours gets deleted.
  Without this, every abandoned record flow leaks a file forever.
- **Delete the file when the report goes.** And the reverse: a file deleted in storage leaves
  `photo_url` pointing at nothing, with the database none the wiser.

---

## 5. Severity — one implementation, on the server

`GET /beaches` and `GET /beaches/:id` return `severity`, `band`, `insufficientData`,
`validReports`, `lastReportedAt` and `freshnessKind` already computed. **The frontend does not
calculate any of them.** The product's promise to the user is that one rule runs for every beach;
that needs one implementation, server-side and auditable.

The full algorithm is in API.md §7. Four things people get wrong:

- **Fewer than 3 eligible reports → `severity` and `band` are `null`, not `"Low"`.** The app
  shows a dedicated "not enough data" state and keys it off null.
- **`lastReportedAt` ignores the 90-day window.** "Nothing reported recently" is itself the
  finding; an empty window is not the same as no history.
- **Only `Counted` reports are eligible.** `Duplicate` and `Incomplete` never count.
- **`composition` is not an aggregate.** See §6.

`GET /scoring-method` publishes the weights and thresholds. It is **optional** — the frontend
already ships identical numbers in `src/scoring.ts` and renders the "How it's rated" page from
them. But if you implement severity server-side, you now have two copies of those numbers. Either
publish them from one place, or agree with Qian Jiang that the frontend's copy is authoritative.
They must not drift; the whole scoring page is about the rule being the same everywhere.

---

## 6. Composition — the newest report, not an average

`GET /beaches/:id` returns:

```json
"composition": [
  { "category": "Plastic",      "quantity": "Large"  },
  { "category": "Fishing gear", "quantity": "Medium" }
],
"compositionSource": { "reportId": "r_01H...", "createdAt": "2026-08-19T16:00:00+08:00" }
```

Take that beach's **newest `Counted` report**, list its non-null `qty_*` columns ordered by
category weight, and name the report it came from. Both fields are `null` when the beach has no
`Counted` report at all.

This ignores the 90-day window and does not depend on `insufficientData`. **`compositionSource`
is required whenever `composition` is non-null** — the screen prints its date, and without it the
UI would be claiming an aggregate it does not have.

---

## 7. Privacy — the hard requirements

These are not preferences. Each one has a sentence of UI copy resting on it.

- **`reports.lat` / `lng` must never appear in any response.** Not report detail, not the list,
  not an export, not an admin view. They sit on the same row as everything else, so `SELECT *`
  will carry them out — exclude them explicitly in the serialisation layer, not by remembering
  per endpoint. On screen: "GPS USED ONCE · PRIVATE" and "BROAD AREA SHOWN — EXACT GPS IS
  PRIVATE".
- **Coordinates arrive already rounded to 3 decimals** (~110 m); the app rounds at capture so the
  exact value never leaves the device. Do not store more precision than you are sent, and reject
  or truncate anything finer.
- **They have exactly two uses:** matching a report to a beach, and nothing else. Not the
  duplicate check (§3), not analytics.
- **Public geographic granularity stops at `beachId`.**
- **EXIF stripping is real, not claimed** (§4).

---

## 8. Errors and limits

Error responses carry a `code` the frontend switches on — the exact list is in API.md §0. Two
that matter most: `UNKNOWN_PARTICIPANT` (404, not 401) and `PHOTO_REQUIRED` (400).

Rate limits, per user: `POST /reports` 30/hour, `POST /uploads/photos` 60/hour, both `429
RATE_LIMITED`.

All timestamps are ISO 8601 **with offset**. Business "same day" is `Asia/Kuala_Lumpur`.

---

## 9. Do not build

Marked out of scope in the design and the team's MVP split: AI category suggestions (US2.3), the
peer and moderator review flow, Epic 1 missions, Epic 6 outcomes, Epic 7 recurrence, Epic 8
recognition, US5.3 and US5.4. No endpoint is reserved for them.

`GET /photos/:id` is gone — photos are served from storage, not by the API.

---

## 10. Blocked on a decision — please chase these, do not guess

1. **Multi-category severity.** A report can now carry up to six categories. Max, sum or mean
   changes every beach's band on the map. **Hnin Darli's call.** Until then use "the
   highest-weighted non-null category and its band", which reproduces the previous
   single-category behaviour exactly. See the warning box in API.md §7.
2. **`DECISIONS.md` (2026-08-19) describes a different severity formula** — with recency and an
   "area sensitivity" multiplier of 1.0/1.25/1.5. That is not the published rule, and area
   sensitivity in particular folds biodiversity into the litter score, which API.md §2b
   explicitly forbids. **One of the two documents has to change** — Huang Guan.
3. **Does the backend own severity, or does `scoring.ts`?** (§5) Answering this decides whether
   `severity_bands` becomes a table.
4. **`areas` / `beaches` and `litter_reports` / `reports`.** The DMP and the contract use
   different names for the same things. Renaming is cheap before there is a backend.

---

## Done when

- [ ] `VITE_API_BASE_URL` pointed at your server, and the whole record flow completes without
      touching mock data
- [ ] A second report for the same beach on the same Kuala Lumpur day comes back `Duplicate`
- [ ] A beach with fewer than 3 `Counted` reports returns `severity: null`, and the app shows
      its "not enough data" panel
- [ ] `composition` changes the moment a new `Counted` report is added, and
      `compositionSource` names it
- [ ] `grep` the serialised output of every endpoint: no `lat`, no `lng`, anywhere
- [ ] A photo with GPS EXIF comes back with `metadataStripped: true` and the tag actually gone
- [ ] An upload nobody attaches to a report is gone 24 hours later
