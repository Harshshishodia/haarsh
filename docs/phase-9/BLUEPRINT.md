# Phase 9 — Watchtower, Synthetic Guest and alerts

Nigrani runs deterministic checks every two minutes and on demand. It checks the database, queues, dead letters, provider failures, stale requests, SOS requests and a five-probe Synthetic Guest journey. Metric samples and z-scores are kept locally; alerts are created only for actionable state changes and deduplicated by check.

P0 alerts immediately queue web, configured Telegram and configured ntfy delivery. The ladder records the T+2 phone step as skipped until a zero-cost gateway is configured, escalates to Sanjeev at T+4, and the family core at T+8. No paid call or WhatsApp send occurs. Alerts support acknowledge, resolve and snooze. Maintenance mode suppresses new alerts while checks continue.

Admin API: `GET /api/watchtower/status`, `POST /api/watchtower/run`, `POST /api/watchtower/synthetic-guest`, `POST /api/watchtower/drill-p0`, `PATCH /api/watchtower/alerts/:id`, and `POST /api/watchtower/maintenance`.

## Rollback

Stop the service, restore the pre-Phase-9 verified backup, and deploy `vd-wedding:phase8`. Remove queued Phase-9 outbox rows before restart if required.
