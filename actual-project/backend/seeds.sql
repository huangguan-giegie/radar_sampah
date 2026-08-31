-- Seeds for Radar Sampah backend
-- Inserts initial marine_context rows and cleanup_missions based on bundled data files.

BEGIN;

-- marine_context seeds (from data/obis_context.json)
INSERT INTO marine_context (id, source, source_url, retrieved_at, license, latitude, longitude, taxon_or_context_label, sensitivity) VALUES
('obis-malaysia-ambassis-interrupta-000c8b50', 'OBIS', 'https://api.obis.org/occurrence?geometry=POLYGON((99%203,105%203,105%207,99%207,99%203))&size=50', '2026-08-14', 'OBIS data policy; dataset-level attribution required', 5.7, 102.7, 'Ambassis interrupta · public Malaysia-region occurrence sample', 'aggregated'),
('obis-malaysia-siganus-canaliculatus-000f3b97', 'OBIS', 'https://api.obis.org/occurrence?geometry=POLYGON((99%203,105%203,105%207,99%207,99%203))&size=50', '2026-08-14', 'OBIS data policy; dataset-level attribution required', 5.9, 103.1, 'Siganus canaliculatus · public Malaysia-region occurrence sample', 'aggregated'),
('obis-malaysia-dipsastraea-favus-001d7288', 'OBIS', 'https://api.obis.org/occurrence?geometry=POLYGON((99%203,105%203,105%207,99%207,99%203))&size=50', '2026-08-14', 'OBIS data policy; dataset-level attribution required', 5.7, 103.1, 'Dipsastraea favus · public Malaysia-region occurrence sample', 'aggregated'),
('obis-malaysia-sonneratia-alba-001e34da', 'OBIS', 'https://api.obis.org/occurrence?geometry=POLYGON((99%203,105%203,105%207,99%207,99%203))&size=50', '2026-08-14', 'OBIS data policy; dataset-level attribution required', 3.3, 101.2, 'Sonneratia alba · public Malaysia-region occurrence sample', 'aggregated'),
('obis-malaysia-sillago-sihama-00164666', 'OBIS', 'https://api.obis.org/occurrence?geometry=POLYGON((99%203,105%203,105%207,99%207,99%203))&size=50', '2026-08-14', 'OBIS data policy; dataset-level attribution required', 5.5, 100.5, 'Sillago sihama · public Malaysia-region occurrence sample', 'aggregated')
ON CONFLICT (id) DO NOTHING;

-- cleanup_missions seeds (from data/tidetrace_catalog.json)
INSERT INTO cleanup_missions (id, title, area_id, region, scheduled_for) VALUES
('tioman-shoreline-demo', 'Tioman shoreline clean-up', 'tioman-coast', 'Pahang', '2026-08-22T09:00:00+08:00'),
('selangor-river-mouth-demo', 'Kuala Selangor river-mouth clean-up', 'kuala-selangor-coast', 'Selangor', '2026-08-29T09:00:00+08:00')
ON CONFLICT (id) DO NOTHING;

COMMIT;
