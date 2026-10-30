# Phase 10 — Live Baraat tracking

A designated person shares browser geolocation only after explicit consent and only inside an admin-defined window of at most 12 hours. A visible sharing state, instant stop and automatic expiry limit collection. Points may arrive in batches after a network drop, use sequence-based deduplication, and stream to authenticated guests through SSE. Guests receive a stale warning after 30 seconds. Admins can inspect battery, signal and history. Watchtower warns after 60 seconds without a point.

The implementation does not invent a destination, route, distance or ETA. Those remain `null` until the family supplies approved coordinates. OpenStreetMap tiles are intentionally not embedded until tile-use terms and expected traffic are approved; the API remains map-provider independent.

## Rollback

Disable `baraat.tracking`, stop live sessions, deploy `vd-wedding:phase12`, and restore the schema-version-9 backup.
