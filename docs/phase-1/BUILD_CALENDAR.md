# Build Calendar — Working Back from 12 February 2027

Dates use Asia/Kolkata. Scope advances only after the prior phase gate and tests.

| Window | Phase / exit result |
|---|---|
| 30 Oct–5 Nov 2026 | Phase 1 Blueprint: verification, cost/risk/data/capacity/matrix approved |
| 6–19 Nov | Phase 2 Foundation: production repo, migrations/RLS, verified login skeleton, dataset dry-run, backup/restore, flags/monitoring |
| 20 Nov–3 Dec | Phase 3 Messaging: official webhook sandbox, dedupe/outbox/DLQ, Telegram/ntfy, governor, kill switches |
| 4–17 Dec | Phase 4 Social MVP: feed, posts, Stories/viewers, profiles, moderation; video remains flagged if storage unverified |
| 18–31 Dec | Phase 5 Chat: channels, offline/idempotent realtime, moderation, 300-chatter test |
| 1–14 Jan 2027 | Phase 6 Operations: RSVP, seating, transport, admin, vendor role and imports |
| 15–21 Jan | Phase 7 Agent platform: registry, scoped tools, blackboard, Operator, Autopilot observe-only |
| 22–27 Jan | Phase 8 AI quality: bible, persona, examples/evals, router; Tier 0 remains production default |
| 28–31 Jan | Phase 9 Watchtower: Synthetic Guest, alert lifecycle, P0 drill |
| 1–3 Feb | Phase 10 Baraat tracking: Android rehearsal, stale/fallback/expiry tests |
| 4 Feb | Phase 11 decision gate: gallery/stretch ship only if all critical gates green; otherwise remain hidden |
| 5–7 Feb | Phase 12 Hardening: load/chaos/security/privacy/accessibility and restore drills |
| 8–11 Feb | Phase 13 Rehearsal: freeze risky changes, 24h green probes, operator training, war room |
| 12–18 Feb | Wedding-week operation: daily checks, incident log, no unreviewed releases |
| 19 Mar onward | Phase 14 teardown after approved archive/retention decision |

## MVP versus stretch

MVP: verified login/fallback, RSVP, text chat, admin/alerts/kill switches, seating display/manual editor, transport, deterministic concierge/handoff, Baraat tracker, backups and lite mode.

Conditional: photo feed and Stories after media/storage and moderation gates.

Stretch/off by default: Reels, live video, automated seating optimizer, Immich face matching, advanced AI, receipt OCR and AI-generated highlights.

If any critical phase slips by more than five working days, gallery and social polish are cut before reliability, privacy or rehearsal time.
