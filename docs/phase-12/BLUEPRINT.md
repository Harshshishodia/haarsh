# Phase 12 — Security, privacy and resilience hardening

The API now applies bounded request bodies, global and authentication-specific rate limits, same-origin write enforcement, hardened browser headers, opaque request IDs and no-store API caching. Security events retain hashed request sources rather than raw IP addresses. Admin-only drills prove freeze, panic, AI-down (L2) and webhook replay behavior while restoring control state after each drill.

Automated smoke checks cover headers, unauthenticated admin rejection, cross-origin writes, oversized payloads and closed Telegram webhooks. The load smoke sends 600 requests with 100 concurrent virtual users and requires HTTP 200 with p95 under two seconds. Existing encrypted backup/restore verification remains the restore drill.

## Rollback

Deploy `vd-wedding:phase9` and restore the schema-version-8 backup. The new schema tables are additive; no guest rows are transformed.
