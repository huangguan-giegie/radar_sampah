-- Add Iteration 2 storage to the latest main schema.
-- Run with the API schema on search_path (for example: app, public).
BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS user_token text;

ALTER TABLE reports ADD COLUMN IF NOT EXISTS item_counts text;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS proximity_ref char(64);
ALTER TABLE reports ADD COLUMN IF NOT EXISTS event_id text;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS beach_name varchar(160);
ALTER TABLE reports ADD COLUMN IF NOT EXISTS quantities text;

-- Older Iteration 2 drafts stored 1–4 in qty_*; the main contract stores the
-- corresponding text labels. This expression also leaves already migrated
-- labels unchanged.
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
  target_report_id text NOT NULL REFERENCES reports(id),
  participant_id text NOT NULL REFERENCES users(id),
  event_id text REFERENCES community_events(id),
  beach_id text NOT NULL REFERENCES beaches(id),
  removed_counts text NOT NULL,
  rows text NOT NULL,
  total_removed integer NOT NULL CHECK (total_removed > 0),
  handling text NOT NULL CHECK (handling IN ('Collected for disposal','Recycled / handled','Not recorded')),
  note text,
  idempotency_key varchar(128) NOT NULL,
  request_fingerprint char(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (participant_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS cleanup_actions_target ON cleanup_actions (target_report_id, created_at);

COMMIT;
