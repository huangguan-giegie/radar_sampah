-- Add Iteration 2 storage to the latest main schema.
-- Run with the API schema on search_path (for example: app, public).
BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS user_token text;

ALTER TABLE reports ADD COLUMN IF NOT EXISTS item_counts text;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS proximity_ref char(64);
ALTER TABLE reports ADD COLUMN IF NOT EXISTS event_id text;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS beach_name varchar(160);
ALTER TABLE reports ADD COLUMN IF NOT EXISTS quantities text;

-- Older Iteration 2 drafts stored 1–4 in qty_*; the current contract stores
-- the corresponding text labels. Already migrated labels are left unchanged.
ALTER TABLE reports ALTER COLUMN qty_plastic TYPE text USING CASE qty_plastic::text
  WHEN '1' THEN 'Small' WHEN '2' THEN 'Medium' WHEN '3' THEN 'Large' WHEN '4' THEN 'Very Large'
  ELSE qty_plastic::text END;
ALTER TABLE reports ALTER COLUMN qty_fishing_gear TYPE text USING CASE qty_fishing_gear::text
  WHEN '1' THEN 'Small' WHEN '2' THEN 'Medium' WHEN '3' THEN 'Large' WHEN '4' THEN 'Very Large'
  ELSE qty_fishing_gear::text END;
ALTER TABLE reports ALTER COLUMN qty_glass TYPE text USING CASE qty_glass::text
  WHEN '1' THEN 'Small' WHEN '2' THEN 'Medium' WHEN '3' THEN 'Large' WHEN '4' THEN 'Very Large'
  ELSE qty_glass::text END;
ALTER TABLE reports ALTER COLUMN qty_metal TYPE text USING CASE qty_metal::text
  WHEN '1' THEN 'Small' WHEN '2' THEN 'Medium' WHEN '3' THEN 'Large' WHEN '4' THEN 'Very Large'
  ELSE qty_metal::text END;
ALTER TABLE reports ALTER COLUMN qty_paper TYPE text USING CASE qty_paper::text
  WHEN '1' THEN 'Small' WHEN '2' THEN 'Medium' WHEN '3' THEN 'Large' WHEN '4' THEN 'Very Large'
  ELSE qty_paper::text END;
ALTER TABLE reports ALTER COLUMN qty_other TYPE text USING CASE qty_other::text
  WHEN '1' THEN 'Small' WHEN '2' THEN 'Medium' WHEN '3' THEN 'Large' WHEN '4' THEN 'Very Large'
  ELSE qty_other::text END;

CREATE TABLE IF NOT EXISTS community_events (
  id text PRIMARY KEY,
  beach_id text NOT NULL REFERENCES beaches(id),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('Open','Closed')),
  source text NOT NULL CHECK (source IN ('scheduled','moderator')),
  created_by text REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  UNIQUE (beach_id, starts_at)
);
CREATE INDEX IF NOT EXISTS community_events_window ON community_events (beach_id, starts_at);

CREATE TABLE IF NOT EXISTS community_event_members (
  event_id text NOT NULL REFERENCES community_events(id) ON DELETE CASCADE,
  participant_id text NOT NULL REFERENCES users(id),
  joined_at timestamptz NOT NULL DEFAULT now(),
  checked_in_at timestamptz,
  location_passed boolean NOT NULL DEFAULT false,
  PRIMARY KEY (event_id, participant_id),
  CHECK (location_passed = (checked_in_at IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS cleanup_actions (
  id text PRIMARY KEY,
  target_report_id text REFERENCES reports(id),
  participant_id text NOT NULL REFERENCES users(id),
  event_id text REFERENCES community_events(id),
  beach_id text NOT NULL REFERENCES beaches(id),
  removed_counts text,
  rows text NOT NULL,
  total_removed integer CHECK (total_removed > 0),
  remaining_quantities text,
  removed_quantities text,
  cleanup_score integer CHECK (cleanup_score > 0),
  handling text NOT NULL CHECK (handling IN ('Collected for disposal','Recycled / handled','Not recorded')),
  note text,
  idempotency_key varchar(128) NOT NULL,
  request_fingerprint char(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (participant_id, idempotency_key)
);

-- Existing deployments may already have the legacy exact-count table. Upgrade
-- it in place without rewriting historical rows.
ALTER TABLE cleanup_actions ADD COLUMN IF NOT EXISTS remaining_quantities text;
ALTER TABLE cleanup_actions ADD COLUMN IF NOT EXISTS removed_quantities text;
ALTER TABLE cleanup_actions ADD COLUMN IF NOT EXISTS cleanup_score integer;
ALTER TABLE cleanup_actions ALTER COLUMN target_report_id DROP NOT NULL;
ALTER TABLE cleanup_actions ALTER COLUMN removed_counts DROP NOT NULL;
ALTER TABLE cleanup_actions ALTER COLUMN total_removed DROP NOT NULL;

-- If an application process created the Iteration 2 tables before this
-- migration ran, CREATE TABLE IF NOT EXISTS above cannot add the missing FKs
-- and CHECK constraints. Add the named constraints idempotently here too.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'community_events_beach_fk') THEN
    ALTER TABLE community_events ADD CONSTRAINT community_events_beach_fk FOREIGN KEY (beach_id) REFERENCES beaches(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'community_events_created_by_fk') THEN
    ALTER TABLE community_events ADD CONSTRAINT community_events_created_by_fk FOREIGN KEY (created_by) REFERENCES users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'community_events_status_check') THEN
    ALTER TABLE community_events ADD CONSTRAINT community_events_status_check CHECK (status IN ('Open','Closed'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'community_events_source_check') THEN
    ALTER TABLE community_events ADD CONSTRAINT community_events_source_check CHECK (source IN ('scheduled','moderator'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'community_events_time_check') THEN
    ALTER TABLE community_events ADD CONSTRAINT community_events_time_check CHECK (ends_at > starts_at);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'community_event_members_event_fk') THEN
    ALTER TABLE community_event_members ADD CONSTRAINT community_event_members_event_fk FOREIGN KEY (event_id) REFERENCES community_events(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'community_event_members_participant_fk') THEN
    ALTER TABLE community_event_members ADD CONSTRAINT community_event_members_participant_fk FOREIGN KEY (participant_id) REFERENCES users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'community_event_members_location_check') THEN
    ALTER TABLE community_event_members ADD CONSTRAINT community_event_members_location_check CHECK (location_passed = (checked_in_at IS NOT NULL));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cleanup_actions_target_report_fk') THEN
    ALTER TABLE cleanup_actions ADD CONSTRAINT cleanup_actions_target_report_fk FOREIGN KEY (target_report_id) REFERENCES reports(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cleanup_actions_participant_fk') THEN
    ALTER TABLE cleanup_actions ADD CONSTRAINT cleanup_actions_participant_fk FOREIGN KEY (participant_id) REFERENCES users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cleanup_actions_event_fk') THEN
    ALTER TABLE cleanup_actions ADD CONSTRAINT cleanup_actions_event_fk FOREIGN KEY (event_id) REFERENCES community_events(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cleanup_actions_beach_fk') THEN
    ALTER TABLE cleanup_actions ADD CONSTRAINT cleanup_actions_beach_fk FOREIGN KEY (beach_id) REFERENCES beaches(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cleanup_actions_total_removed_check') THEN
    ALTER TABLE cleanup_actions ADD CONSTRAINT cleanup_actions_total_removed_check CHECK (total_removed > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cleanup_actions_cleanup_score_check') THEN
    ALTER TABLE cleanup_actions ADD CONSTRAINT cleanup_actions_cleanup_score_check CHECK (cleanup_score > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cleanup_actions_handling_check') THEN
    ALTER TABLE cleanup_actions ADD CONSTRAINT cleanup_actions_handling_check CHECK (handling IN ('Collected for disposal','Recycled / handled','Not recorded'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reports_event_fk') THEN
    ALTER TABLE reports ADD CONSTRAINT reports_event_fk FOREIGN KEY (event_id) REFERENCES community_events(id);
  END IF;
END $$;

DROP INDEX IF EXISTS cleanup_actions_target;
CREATE INDEX cleanup_actions_target ON cleanup_actions (target_report_id, created_at);

COMMIT;
