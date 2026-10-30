# Phase 4 Status

## Passed

- ESLint, client/server TypeScript build and 4/4 existing UI workflows.
- Three-user private social integration test.
- Event-filtered feed returned only published content.
- Duplicate like returned `created:false` and did not double-count.
- Like and comment created two private author notifications.
- Duplicate Story view returned `firstView:false`; author viewer list contained one named viewer.
- Unrelated guest viewer-list request returned HTTP 403.
- New guest post entered pending moderation and published after admin approval.
- External-link post returned HTTP 400.
- Public profile contained no phone field.
- 2400×1800 JPEG became 1600×1200 WebP; unauthenticated retrieval returned 401.

## Deferred behind safe gates

- Video, Reels and live streaming remain disabled until duration, transcoding and capacity controls are verified.
- PostgreSQL/RLS, 600-user load, flaky-network and multi-device browser tests remain Phase 12 gates.
- Native offline mutation queue and realtime fan-out are implemented with the Phase 5 realtime spine, not simulated here.

The tested Phase 4 image/text social path is enabled. Deferred modules remain unavailable rather than partially shipping.
