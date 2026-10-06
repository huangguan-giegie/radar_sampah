-- Run with the application's DATABASE_SCHEMA on search_path.
-- Match the tables created by the active account and event routes.
BEGIN;

ALTER TABLE community_events ADD COLUMN IF NOT EXISTS meeting_point varchar(160);

CREATE TABLE IF NOT EXISTS community_event_attendance (
  event_id       varchar(100) NOT NULL,
  participant_id varchar(80) NOT NULL,
  confirmed_at   timestamptz NOT NULL,
  PRIMARY KEY (event_id, participant_id)
);

CREATE TABLE IF NOT EXISTS account_profiles (
  user_id            text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  nickname           varchar(30) NOT NULL,
  joined_leaderboard boolean NOT NULL DEFAULT false,
  updated_at         timestamptz NOT NULL
);

COMMIT;
