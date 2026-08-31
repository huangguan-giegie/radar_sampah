-- PR #13 data migration (PostgreSQL)
--
-- Run once against the production database before (or together with) the
-- release that reads `reports`. It is safe to re-run: it changes the table
-- only when the legacy name exists and the new name does not.
--
-- Rollback: use the DOWN block below only after rolling the application back
-- to a version that reads `frontend_reports`. Do not run it while the current
-- application is serving traffic.

BEGIN;

DO $$
BEGIN
  IF to_regclass('app.frontend_reports') IS NOT NULL
     AND to_regclass('app.reports') IS NULL THEN
    ALTER TABLE app.frontend_reports RENAME TO reports;
  ELSIF to_regclass('app.frontend_reports') IS NOT NULL
        AND to_regclass('app.reports') IS NOT NULL THEN
    RAISE EXCEPTION
      'Both frontend_reports and reports exist; stop and reconcile them before migrating.';
  END IF;
END $$;

COMMIT;

-- DOWN (manual rollback; run as a separate transaction):
-- BEGIN;
-- DO $$
-- BEGIN
--   IF to_regclass('app.reports') IS NOT NULL
--      AND to_regclass('app.frontend_reports') IS NULL THEN
--     ALTER TABLE app.reports RENAME TO frontend_reports;
--   ELSIF to_regclass('app.reports') IS NOT NULL
--         AND to_regclass('app.frontend_reports') IS NOT NULL THEN
--     RAISE EXCEPTION
--       'Both reports and frontend_reports exist; stop and reconcile them before rollback.';
--   END IF;
-- END $$;
-- COMMIT;
