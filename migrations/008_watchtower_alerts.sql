-- Phase 9 is applied idempotently by server/db.ts for SQLite deployments.
-- Tables: watchtower_runs, watchtower_checks, alerts, alert_deliveries,
-- synthetic_guest_runs, metric_samples, maintenance_windows.
INSERT OR IGNORE INTO schema_migrations(version,name) VALUES(8,'watchtower_alerts');
