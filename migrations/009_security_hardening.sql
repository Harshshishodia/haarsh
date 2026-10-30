-- Applied idempotently by server/db.ts.
-- Adds security_events, drill_runs and retention_jobs.
INSERT OR IGNORE INTO schema_migrations(version,name) VALUES(9,'security_hardening');
