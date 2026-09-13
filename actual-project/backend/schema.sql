-- ============================================================================
-- Radar Sampah — schema.sql
--
-- Latest main contract plus additive Iteration 2 fields and tables.
--
-- Keep this file aligned with the deployed database. The API uses
-- DATABASE_SCHEMA=app in production; run this file with `app` as the active
-- schema (for example: SET search_path TO app, public;) when creating a new
-- database.
--
-- PostgreSQL.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- users — one participant. Deliberately holds no personal data.
-- types.ts:188  User { id, participantId, role }
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id             text        PRIMARY KEY,              -- 'u_anon_1637'
  participant_id text        NOT NULL UNIQUE,          -- '1637', four digits
  role           text        NOT NULL DEFAULT 'volunteer'
                             CHECK (role IN ('volunteer','moderator')),
  user_token     text,                                  -- SHA-256 recovery-token digest; never the raw token
  created_at     timestamptz NOT NULL DEFAULT now()
  -- No name, email or phone column of any kind. API.md §9 states this as a rule,
  -- not as an omission — adding one later is a DMP change, not a schema change.
);

-- ---------------------------------------------------------------------------
-- beaches — the four monitored beaches. Seed data, no write endpoints.
-- types.ts:94  BeachSummary / BeachDetail
--
-- IMPORTANT: severity, band, insufficientData, validReports, lastReportedAt,
-- freshnessKind, composition and compositionSource are NOT columns. API.md §9
-- marks them "computed per request" — they are recomputed from `reports` on
-- every call (API.md §7). Storing them would let the stored value and the
-- reports disagree, and there would be no way to tell which was right.
-- ---------------------------------------------------------------------------
CREATE TABLE beaches (
  id                    text        PRIMARY KEY,       -- slug: 'morib'
  name                  text        NOT NULL,
  area                  text        NOT NULL,
  lat                   double precision NOT NULL,
  lng                   double precision NOT NULL,

  habitat               text        NOT NULL,          -- 'Intertidal mudflat & sandy shore'
  habitat_tag           text        NOT NULL,          -- 'MUDFLAT', shown on the map badge
  sensitivity           text        NOT NULL,          -- the RELEVANCE row on the map card
  primary_species_glyph text        NOT NULL
                        CHECK (primary_species_glyph IN
                               ('turtle','bird','mangrove','grass','crab','fish')),
                                                        -- types.ts:12 SpeciesGlyph

  cover_image_url       text,                          -- null → the app falls back to `scene`
  scene                 text        NOT NULL,          -- CSS gradient, sent to the client as-is
  ecological_note       text        NOT NULL,          -- "WHY LITTER MAY MATTER HERE"

  created_at            timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- dim_threat — IUCN conservation categories. Dictionary table (DMP §6).
-- API.md §2c, verbatim.
-- ---------------------------------------------------------------------------
CREATE TABLE dim_threat (
  threat_id   serial PRIMARY KEY,
  threat_name text NOT NULL UNIQUE
);

-- ---------------------------------------------------------------------------
-- dim_species — species master, extracted from FishBase.
-- API.md §2c, verbatim. DMP §4.1: upsert on scientific_name; rows without one
-- are discarded, which is why only real species reach this table.
-- ---------------------------------------------------------------------------
CREATE TABLE dim_species (
  species_id      text PRIMARY KEY,
  scientific_name text NOT NULL UNIQUE,
  common_name     text,
  threat_id       int  REFERENCES dim_threat(threat_id),
  glyph           text NOT NULL
                  CHECK (glyph IN ('turtle','bird','mangrove','grass','crab','fish')),
  picture_url     text,                                -- image rights are separate per image
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- area_species — "the biodiversity cards this beach shows", in order.
-- API.md §2c, verbatim, with the CHECK on source_dataset added from
-- types.ts:47 SourceDataset.
--
-- species_id is nullable on purpose: 9 of the 11 seeded cards are habitats and
-- groups with no scientific name, so they cannot enter dim_species at all.
-- ---------------------------------------------------------------------------
CREATE TABLE area_species (
  id                 text PRIMARY KEY,
  area_id            text NOT NULL REFERENCES beaches(id) ON DELETE CASCADE,
  species_id         text NULL REFERENCES dim_species(species_id),

  kind               text NOT NULL CHECK (kind IN ('species','habitat','group')),
  display_name       text NOT NULL,
  glyph              text NOT NULL
                     CHECK (glyph IN ('turtle','bird','mangrove','grass','crab','fish')),
  text               text NOT NULL,                    -- reads differently per beach, so it
                                                       -- lives here and not on dim_species
  sort_order         int  NOT NULL DEFAULT 0,
  origin             text NOT NULL DEFAULT 'curated'
                          CHECK (origin IN ('curated','derived')),

  source_dataset     text NOT NULL DEFAULT 'pending'
                          CHECK (source_dataset IN ('FishBase','OBIS','other','pending')),
  source_citation    text NOT NULL,
  source_url         text,
  source_accessed_at date,

  occurrence_state   text NOT NULL DEFAULT 'unavailable'
                          CHECK (occurrence_state IN ('ready','pending','unavailable')),
  occurrence_score   int  CHECK (occurrence_score BETWEEN 0 AND 100),
                                                       -- a RELATIVE score, not a probability
  occurrence_basis   text,

  -- Postgres treats NULLs as distinct in a UNIQUE constraint, and 9 of the 11
  -- seeded cards have a NULL species_id. So this stops the same real species
  -- being listed twice on one beach, and nothing else — two identical habitat
  -- cards on the same beach would still be accepted. Add a partial unique index
  -- on (area_id, display_name) if that matters:
  --   CREATE UNIQUE INDEX area_species_one_card_per_name
  --     ON area_species (area_id, display_name);
  UNIQUE (area_id, species_id),
  CHECK ((kind = 'species') = (species_id IS NOT NULL)),
  CHECK ((occurrence_score IS NULL) = (occurrence_state <> 'ready')),
  CHECK ((occurrence_score IS NULL) OR (occurrence_basis IS NOT NULL))
);

-- ---------------------------------------------------------------------------
-- reports — the core table. One submitted observation.
-- API.md §9 for the column list, §2d for the six categories, types.ts for the
-- allowed values.
--
-- No photos table and no image bytes in the database. photo_key is a storage
-- key, not a reachable address; the photoUrl in a response is signed per
-- request after an ownership check (API.md §5).
-- ---------------------------------------------------------------------------
CREATE TABLE reports (
  id              text        PRIMARY KEY,             -- 'r_01H…'
  reporter_id     text        NOT NULL REFERENCES users(id),
  beach_id        text        NOT NULL REFERENCES beaches(id),

  location_source text        NOT NULL
                  CHECK (location_source IN ('gps','manual')),   -- types.ts:183

  photo_key       text        NOT NULL,                -- storage key, never a URL
  photo_mime      text        NOT NULL
                  CHECK (photo_mime IN ('image/jpeg','image/png','image/heic')),
                                                       -- PhotoScreen.tsx:11 ACCEPTED_TYPES
  photo_stripped  boolean     NOT NULL DEFAULT false,  -- EXIF location removed by the server

  -- One report, up to six categories. NULL means "this category was not seen",
  -- not "seen, amount zero". Actual item counts live separately in item_counts.
  qty_plastic      text CHECK (qty_plastic      IN ('Small','Medium','Large','Very Large')),
  qty_fishing_gear text CHECK (qty_fishing_gear IN ('Small','Medium','Large','Very Large')),
  qty_glass        text CHECK (qty_glass        IN ('Small','Medium','Large','Very Large')),
  qty_metal        text CHECK (qty_metal        IN ('Small','Medium','Large','Very Large')),
  qty_paper        text CHECK (qty_paper        IN ('Small','Medium','Large','Very Large')),
  qty_other        text CHECK (qty_other        IN ('Small','Medium','Large','Very Large')),

  -- Derived from the six columns above: the highest-scoring non-null category
  -- and its band. Kept so existing responses keep working (API.md §2d).
  -- Ties are broken by the order of the weights table in scoring.ts — the
  -- frontend mock does the same (api.ts:419), and the backend must match.
  category        text        NOT NULL
                  CHECK (category IN ('Plastic','Fishing gear','Glass','Metal','Paper','Other')),
  quantity        text        NOT NULL
                  CHECK (quantity IN ('Small','Medium','Large','Very Large')),

  -- Written only when location_source = 'gps'. Rounded to 3 decimals by the
  -- client (~110 m). NEVER returned in any response — exclude it explicitly
  -- when serialising, do not rely on it being forgotten.
  lat             numeric(9,3),
  lng             numeric(9,3),

  -- Iteration 2 stores actual whole-item counts separately from the v1 bands.
  -- The original GPS coordinate is not saved for v2 reports: proximity_ref is
  -- a keyed, target-scoped HMAC of a roughly one-metre projected grid cell.
  item_counts     text,
  proximity_ref   char(64),
  event_id        text,

  status          text        NOT NULL DEFAULT 'Counted'
                  CHECK (status IN ('Counted','Duplicate','Incomplete')),   -- types.ts:7
  status_note     text,                                -- why it was excluded, shown to the user

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,                         -- soft delete

  -- Compatibility columns retained by the running API during migration.
  beach_name      varchar(160),
  quantities      text,

  -- Retained for compatibility with reports created by the earlier API.
  beach_name      varchar(160),
  quantities      text,

  -- A report with nothing recorded is not a report. API.md §2d.
  CONSTRAINT reports_at_least_one_category CHECK (
    num_nonnulls(qty_plastic, qty_fishing_gear, qty_glass,
                 qty_metal, qty_paper, qty_other) >= 1
  ),

  -- A manually chosen beach carries no coordinates at all. flowRules.ts:73
  CONSTRAINT reports_manual_has_no_coords CHECK (
    location_source = 'gps' OR (lat IS NULL AND lng IS NULL)
  ),

  -- A note only makes sense on an excluded report.
  CONSTRAINT reports_note_only_when_excluded CHECK (
    status <> 'Counted' OR status_note IS NULL
  )
);

-- Two indexes carry the whole application (API.md §9).
CREATE INDEX reports_severity_window  ON reports (beach_id, status, created_at);
CREATE INDEX reports_duplicate_check  ON reports (reporter_id, beach_id, created_at);

-- ---------------------------------------------------------------------------
-- community_events — scheduled Saturday beach cleanups and moderator-created
-- activities. Event times are stored in UTC; API responses are Kuala Lumpur.
-- ---------------------------------------------------------------------------
CREATE TABLE community_events (
  id          text PRIMARY KEY,
  beach_id    text NOT NULL REFERENCES beaches(id),
  starts_at   timestamptz NOT NULL,
  ends_at     timestamptz NOT NULL,
  status      text NOT NULL CHECK (status IN ('Open','Closed')),
  source      text NOT NULL CHECK (source IN ('scheduled','moderator')),
  created_by  text REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  UNIQUE (beach_id, starts_at)
);

CREATE INDEX community_events_window ON community_events (beach_id, starts_at);

-- ---------------------------------------------------------------------------
-- community_event_members — joining is separate from attendance. Exact check-in
-- coordinates are request-only; only the pass result and timestamp are kept.
-- Attendance is computed from join + passed proximity + same-event evidence.
-- ---------------------------------------------------------------------------
CREATE TABLE community_event_members (
  event_id       text NOT NULL REFERENCES community_events(id) ON DELETE CASCADE,
  participant_id text NOT NULL REFERENCES users(id),
  joined_at      timestamptz NOT NULL DEFAULT now(),
  checked_in_at  timestamptz,
  location_passed boolean NOT NULL DEFAULT false,
  PRIMARY KEY (event_id, participant_id),
  CHECK (location_passed = (checked_in_at IS NOT NULL))
);

-- ---------------------------------------------------------------------------
-- cleanup_actions — append-only partial cleanup records. Multiple actions may
-- reduce one target until its remaining item counts reach zero. No points.
-- ---------------------------------------------------------------------------
CREATE TABLE cleanup_actions (
  id                text PRIMARY KEY,
  target_report_id  text NOT NULL REFERENCES reports(id),
  participant_id    text NOT NULL REFERENCES users(id),
  event_id          text REFERENCES community_events(id),
  beach_id          text NOT NULL REFERENCES beaches(id),
  removed_counts    text NOT NULL,
  rows              text NOT NULL,
  total_removed     integer NOT NULL CHECK (total_removed > 0),
  handling          text NOT NULL CHECK (handling IN
                    ('Collected for disposal','Recycled / handled','Not recorded')),
  note              text,
  idempotency_key   varchar(128) NOT NULL,
  request_fingerprint char(64) NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (participant_id, idempotency_key)
);

CREATE INDEX cleanup_actions_target ON cleanup_actions (target_report_id, created_at);

COMMIT;

-- ============================================================================
-- Not created, and why
--
--   area_garbage    API.md §2d: composition is read off the newest Counted
--                   report, so there is no aggregate to materialise. Decided.
--   photos          API.md §9: no photos table, no bytes in the database.
--   severity cache  API.md §7 leaves this open — "a cached column updated on
--                   write, or computed at read time (four beaches makes live
--                   computation entirely viable)". Nothing here assumes a cache.
--
-- Left open by the frontend, decide before you build
--
--   1. area_id vs beach_id. This file uses beaches(id) because API.md §2c does.
--      The DMP calls the same thing `areas`. One name, chosen once.
--   2. dim_threat is empty. Every seeded card has threatCategory: null, so the
--      frontend gives no dictionary to copy. It comes from DMP §6, not from here.
--   3. photo_key is NOT NULL because the app refuses to submit without a photo
--      (flowRules.ts:96). If the score spec's "image_url optional" wins instead,
--      this column becomes nullable and the app has to change too.
-- ============================================================================
