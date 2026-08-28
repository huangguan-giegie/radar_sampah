# Database — what to build

**Owner:** Keith Junn Chong (database / data integration)
**Source of truth:** [`frontend/API.md`](../frontend/API.md) §9, and the `CREATE TABLE`
blocks in §2c. English: [`frontend/API.en.md`](../frontend/API.en.md).
**Picture:** [`frontend/docs/erd.png`](../frontend/docs/erd.png)

Six tables. Nothing else. If a table is not on this page, do not create it.

---

## 0. Before anything: Postgres or SQLite?

[`DECISIONS.md`](DECISIONS.md) says Render uses PostgreSQL through `DATABASE_URL`, and local
development falls back to SQLite. **That means every statement below has to run on both**, and
the two differ in ways that fail silently rather than loudly:

| Postgres | SQLite | What to write instead |
| --- | --- | --- |
| `uuid` | no such type | `text` everywhere — see §1 |
| `serial` | no such type | `integer PRIMARY KEY AUTOINCREMENT` / `serial` per dialect |
| `timestamptz` | no such type | `text` holding ISO 8601 **with offset** |
| `date` | no such type | `text` holding `YYYY-MM-DD` |
| `num_nonnulls(a, b, …)` | no such function | the portable `CASE` sum in §2 |
| foreign keys enforced | **ignored unless switched on** | `PRAGMA foreign_keys = ON` on every connection |

That last row is the dangerous one. On SQLite a foreign key is decorative until you enable it,
so a bug that would be caught immediately on Render passes locally. Turn it on in the connection
setup, not in a migration.

**Decide now whether SQLite is really needed.** If local development can run Postgres in Docker,
delete this whole section and write Postgres-only DDL — it is less code and fewer surprises.
If SQLite stays, every migration needs testing on both before it is merged.

---

## 1. Every id is a `text` string, not a `uuid`

Every id the contract shows by example is a prefixed string — `u_01H…`, `r_01H…`. A `uuid`
column will not accept those, and this is the single most likely thing to force a migration
later. Use `text` for `users.id`, `reports.id`, and `beaches.id` (which is a slug: `morib`,
`remis`, `kelanang`, `bagan`).

`dim_species.species_id` and `area_species.id` are written as `uuid` in the API.md DDL. On
SQLite they must be `text` anyway, so **make them `text` too and keep one convention across the
schema.** Generate them however you like — ULID reads better in logs than UUID because it sorts
by time.

---

## 2. Build order

Foreign keys force this order. Reverse it to drop.

```
1. dim_threat        no dependencies
2. dim_species       → dim_threat
3. beaches           no dependencies
4. area_species      → beaches, dim_species
5. users             no dependencies
6. reports           → users, beaches
```

Copy the DDL for `dim_threat`, `dim_species` and `area_species` **verbatim** from API.md §2c —
it is written out in full there, including three `CHECK` constraints that are not decoration:

- `CHECK ((kind = 'species') = (species_id IS NOT NULL))` — a card is either a real species with
  a master record, or a habitat/group with none. Nothing in between.
- `glyph text NOT NULL` sits on `area_species`, not only on `dim_species`. Nine of the eleven
  seed cards are habitats or group names with no `dim_species` row at all, and the icon cannot be
  inferred from `kind` — `group` covers both `bird` and `fish`. Without this column those nine
  cards have nowhere to keep their icon.
- `CHECK ((likelihood_percent IS NULL) = (likelihood_basis IS NULL))` — a percentage with no
  stated basis reads to a user as measured fact. The two live and die together.
- `UNIQUE (area_id, species_id)` — stops the same species being seeded twice for one beach.

`users`, `beaches` and `reports` have no `CREATE TABLE` in the contract, only the column list in
§9. Write them from that list.

### The one constraint you have to translate

`reports` must have at least one non-null category column. API.md writes it with
`num_nonnulls()`, which is Postgres-only:

```sql
-- Postgres
CHECK (num_nonnulls(qty_plastic, qty_fishing_gear, qty_glass,
                    qty_metal, qty_paper, qty_other) >= 1)

-- Portable — runs on both
CHECK (
  (CASE WHEN qty_plastic      IS NULL THEN 0 ELSE 1 END) +
  (CASE WHEN qty_fishing_gear IS NULL THEN 0 ELSE 1 END) +
  (CASE WHEN qty_glass        IS NULL THEN 0 ELSE 1 END) +
  (CASE WHEN qty_metal        IS NULL THEN 0 ELSE 1 END) +
  (CASE WHEN qty_paper        IS NULL THEN 0 ELSE 1 END) +
  (CASE WHEN qty_other        IS NULL THEN 0 ELSE 1 END) >= 1
)
```

**`NULL` means "not seen", never "zero".** Nobody counted an absence. Do not add a default of
`'Small'` or `0` to make the columns non-nullable — it would invent observations.

---

## 3. Indexes

Three, and they are not optional — the first two carry every page in the app:

```sql
CREATE INDEX ON reports (beach_id, status, created_at);      -- the severity window
CREATE INDEX ON reports (reporter_id, beach_id, created_at); -- the duplicate check
CREATE INDEX ON area_species (area_id, sort_order);          -- the biodiversity card order
```

There is deliberately **no unique constraint** on `(reporter_id, beach_id, day)`. A second report
on the same day is not rejected — it is stored with `status = 'Duplicate'` so the person still
sees it in their own records. That decision lives in the backend, not in a constraint.

---

## 4. Two columns that must never leave the database

`reports.lat` and `reports.lng`. They are written only when `location_source = 'gps'`, already
rounded to 3 decimals (~110 m) by the app before they are sent, and **no endpoint may ever
return them** — not report detail, not the list, not a CSV export, not an admin view.

They sit on the same row as everything else, so **`SELECT *` will carry them out**. Exclude them
explicitly in whichever layer builds responses, and make it a fixed item in code review. Two
sentences of UI copy depend on this being true: "GPS USED ONCE · PRIVATE" on the confirm screen
and "BROAD AREA SHOWN — EXACT GPS IS PRIVATE" on the map.

`users` has no name, email, phone or password column. That is a decision, not an oversight —
please do not add one for convenience.

---

## 5. Seed data

`beaches` and `area_species` are seeded and have no create/update/delete endpoints in
Iteration 1. The content is already written in [`frontend/src/mockData.ts`](../frontend/src/mockData.ts)
and the field names line up one for one. Four beaches: `morib`, `remis`, `kelanang`, `bagan`.

Two things to get right while seeding:

- `dim_threat` needs its nine IUCN rows before `dim_species` can reference them.
- **All eleven biodiversity cards currently carry `source_dataset = 'pending'`.** That is
  deliberate — only one of them can actually be sourced from FishBase, and seven exist in
  neither FishBase nor OBIS. The app prints an amber `SOURCE PENDING` badge on those cards.
  Do not seed a citation that has not been checked; a fabricated source is worse than a visible
  gap. Benshuai Su and Keith own closing this.

---

## 6. Do not create

| Table | Why not |
| --- | --- |
| `photos` | Decided: photos do not go in the database. Private object storage holds the bytes; `reports.photo_key` holds the key. The bucket is not publicly readable — see API.md §5. |
| `area_garbage` | Decided: the beach page reads the latest `Counted` report directly, so the aggregate would only duplicate `reports` and drift from it. |
| `communities`, `community_users` | Epic 1, parked by the team's MVP split. |
| `verification_log` | Epic 3, removed from the MVP split. |
| `fact_occurrence` | In the DMP's ERD; nothing in Iteration 1 reads it. |
| `severity_bands` | The four bands live in the frontend's `scoring.ts` today. It becomes a table only if the backend computes severity — see the open question below. |

The Data Management Plan's ERD shows all of these. **The DMP and the team's MVP split disagree
about Iteration 1 scope**, and this page follows the split. If that is wrong, it is Huang Guan's
call to make, not something to resolve by quietly creating tables.

---

## 7. Open questions — please raise these rather than guessing

1. **SQLite or Postgres-only?** (§0) Everything else is easier if the answer is Postgres-only.
2. **Should `severity_bands` become a table?** It depends on whether the backend computes
   severity. If it does, the bands must be in one place, not two — the frontend's `scoring.ts`
   and a server copy would drift on the first change.
3. **`dim_threat.threat_category` or `threat_name`?** The DMP's ERD says the first, API.md says
   the second. Same column, two names. Pick one before writing the migration.
4. **`areas` or `beaches`?** Same again, for the table itself. The DMP says `areas`, the contract
   and the running frontend say `beaches`. Renaming is cheap now and expensive once there is a
   backend and seeded data.

---

## Done when

- [ ] All six tables exist, in the order in §2, on whichever engines §0 settles on
- [ ] Every `CHECK` and `UNIQUE` from API.md §2c is present, including the translated one in §2
- [ ] The three indexes in §3 exist
- [ ] `PRAGMA foreign_keys = ON` is set on every SQLite connection (if SQLite stays)
- [ ] Seed data loads: 4 beaches, 11 biodiversity cards, 9 threat categories
- [ ] A test proves a report with all six `qty_*` columns null is rejected
- [ ] A test proves `lat` / `lng` do not appear in any serialised response
