# Wedding-Day Capacity Model

All numbers below are engineering demand assumptions for testing, not provider guarantees.

## Peak model

| Traffic | Peak assumption | Derived load | Design response |
|---|---:|---:|---|
| Concurrent sessions | 600 | 600 authenticated connections | Stateless API; connection pooling; cached reads |
| Active chatters | 300 | 5 messages/min each = 25 writes/s burst-average | Batch fan-out; cursor pagination; per-channel limits |
| Chat burst | 300 messages in 10 s | 30 writes/s plus fan-out | Durable ingest before broadcast; backpressure |
| Story/feed viewers | 450 | 15 reads/min = 112.5 reads/s | CDN media; cached metadata; paginated queries |
| Uploaders | 100 simultaneous | 100 signed uploads; throttle to 2 active/device | Direct object upload; progress/retry; no API proxy |
| RSVP peak | 100 households/10 min | 0.17 writes/s | Idempotent upsert; negligible compared with chat |
| Baraat viewers | 500 | 1 location update/5 s fan-out = 100 deliveries/s | One ingest stream; coalesced latest-point broadcast |
| Tracker sender | 1 primary + 1 backup | 1 point/3–5 s | Local buffer; idempotent sequence; stale threshold |
| WhatsApp inbound burst | 300 in 5 min | 1 webhook/s average, higher burst | Immediate ack, durable queue, Tier 0 routing |
| Admin users | 10 | Low volume, high priority | Separate priority lane and step-up actions |
| Watchtower | Every 2 min | Bounded aggregate queries | Precomputed metrics; no table scans |

## Latency budgets

| Journey | Target | Budget allocation |
|---|---:|---|
| First useful screen on 4G | <2 s | shell 500 ms; cached data 500 ms; render 500 ms; headroom 500 ms |
| Chat delivery p95 | <1 s | ingest 150 ms; commit 150 ms; fan-out 400 ms; client render 300 ms |
| Deterministic concierge p95 | <5 s | intent 100 ms; lookup 500 ms; handoff/outbox 1 s; headroom |
| Optional AI reply | <15 s | Tier 1 timeout 3 s; fallback/strong tier up to 10 s; render/headroom |
| Baraat location p95 | <5 s | geolocation 2 s; upload 1 s; fan-out 1 s; render 1 s |

## Media demand

Target working set: 5 GB. Images: 4,800 × 0.45 MB ≈ 2.16 GB. Thumbnails ≈ 0.35 GB. Videos: 120 × 8 MB ≈ 0.96 GB. Remaining ≈ 1.53 GB for metadata, retry staging and headroom. Hard controls: 10-image carousel, 1600 px images, 15 s Stories, 30 s posts, local EXIF stripping, client compression, per-user daily caps and a video kill switch.

## Load-shedding order

1. Preserve P0 alerts, verified login, RSVP, seat/pickup lookup and kill switches.
2. Coalesce presence/typing/story-view count updates.
3. Disable autoplay, originals and video upload.
4. Delay notifications, thumbnails and background agents.
5. Freeze new social writes while chat remains text-only.
6. Enter L3 signed read-only lite mode.

## Required proving tests

- 600 virtual sessions for 60 minutes; 300 chatters; 100 upload simulations.
- 300-message burst with unique idempotency keys and replay duplicates.
- Tracker update/fan-out with network loss, reordering and 60-second offline buffer.
- Database pool exhaustion, realtime disconnect, storage ceiling and AI-zero-quota tests.
- Results must include p50/p95/p99, error rate, duplicates, loss, queue delay and recovery time.

No capacity claim is approved until tested against the selected provider after its official limits are verified.
