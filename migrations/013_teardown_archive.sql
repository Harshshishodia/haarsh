-- Applied idempotently by server/db.ts.
-- Adds teardown_plans, teardown_checklist and data_exports.
INSERT OR IGNORE INTO schema_migrations(version,name) VALUES(13,'teardown_archive');
