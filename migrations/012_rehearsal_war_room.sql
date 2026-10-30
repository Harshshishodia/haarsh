-- Applied idempotently by server/db.ts.
-- Adds operation_modes, runbook_steps and shift_handoffs.
INSERT OR IGNORE INTO schema_migrations(version,name) VALUES(12,'rehearsal_war_room');
