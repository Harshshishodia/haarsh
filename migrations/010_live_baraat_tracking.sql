-- Applied idempotently by server/db.ts.
-- Adds tracker_sessions, tracker_points and tracker_events.
INSERT OR IGNORE INTO schema_migrations(version,name) VALUES(10,'live_baraat_tracking');
