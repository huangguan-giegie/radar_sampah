-- Schema for Radar Sampah backend (PostgreSQL / Neon)
-- Run this on your Neon/Postgres database to create the required tables.
-- This version uses the 'app' schema

-- First, create the schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS app;

-- Set the search path to use app schema by default
SET search_path TO app, public;

BEGIN;

CREATE TABLE IF NOT EXISTS app.users (
  id varchar(80) PRIMARY KEY,
  participant_id varchar(4) NOT NULL UNIQUE,
  role varchar(20) NOT NULL DEFAULT 'volunteer',
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS app.observations (
  id serial PRIMARY KEY,
  category varchar(64) NOT NULL,
  area varchar(160) NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  observed_at varchar(40) NOT NULL,
  image_url varchar(500),
  note text,
  source varchar(80) NOT NULL,
  demo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS app.observation_classifications (
  id serial PRIMARY KEY,
  observation_id integer NOT NULL UNIQUE REFERENCES app.observations(id) ON DELETE CASCADE,
  label varchar(64) NOT NULL,
  rule varchar(80) NOT NULL,
  method text NOT NULL
);

CREATE TABLE IF NOT EXISTS app.observation_priorities (
  id serial PRIMARY KEY,
  observation_id integer NOT NULL UNIQUE REFERENCES app.observations(id) ON DELETE CASCADE,
  level varchar(12) NOT NULL,
  reason text NOT NULL,
  disclaimer text NOT NULL,
  illustrative boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS app.marine_context (
  id varchar(80) PRIMARY KEY,
  source varchar(40) NOT NULL,
  source_url varchar(500) NOT NULL,
  retrieved_at varchar(40) NOT NULL,
  license varchar(160) NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  taxon_or_context_label varchar(240) NOT NULL,
  sensitivity varchar(40) NOT NULL
);

CREATE TABLE IF NOT EXISTS app.litter_reports (
  id serial PRIMARY KEY,
  area_id varchar(80) NOT NULL,
  category varchar(64) NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  observed_at varchar(40) NOT NULL,
  detection varchar(80) NOT NULL,
  priority varchar(12) NOT NULL,
  image_url varchar(500),
  note text,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS app.litter_detections (
  id serial PRIMARY KEY,
  report_id integer NOT NULL UNIQUE REFERENCES app.litter_reports(id) ON DELETE CASCADE,
  method varchar(80) NOT NULL,
  status varchar(40) NOT NULL,
  category varchar(64) NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS app.litter_priorities (
  id serial PRIMARY KEY,
  report_id integer NOT NULL UNIQUE REFERENCES app.litter_reports(id) ON DELETE CASCADE,
  level varchar(12) NOT NULL,
  severity_score integer NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS app.cleanup_missions (
  id varchar(80) PRIMARY KEY,
  title varchar(160) NOT NULL,
  area_id varchar(80) NOT NULL,
  region varchar(80) NOT NULL,
  scheduled_for varchar(40) NOT NULL
);

CREATE TABLE IF NOT EXISTS app.cleanup_joins (
  id serial PRIMARY KEY,
  mission_id varchar(80) NOT NULL REFERENCES app.cleanup_missions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS app.cleanup_evidence (
  id serial PRIMARY KEY,
  mission_id varchar(80) REFERENCES app.cleanup_missions(id),
  before_report_id integer REFERENCES app.litter_reports(id),
  after_report_id integer REFERENCES app.litter_reports(id),
  item_count integer NOT NULL,
  image_url varchar(500),
  before_image_url varchar(500),
  after_image_url varchar(500),
  impact_note text,
  note text,
  created_at timestamptz NOT NULL
);

COMMIT;
