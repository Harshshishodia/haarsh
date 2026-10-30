# Cost Ledger — Phase 1

Budget ceiling: **₹0**. Card on file: **not allowed**. Every billable API fails closed.

Official pages were requested on 30 October 2026 and blocked by the managed proxy with HTTP 403. Values are therefore deliberately omitted rather than guessed.

| Item | Official source | Verification | Expected use | Zero-cost control | At limit / uncertainty |
|---|---|---|---|---|---|
| WhatsApp Cloud API | https://developers.facebook.com/docs/whatsapp/pricing/ | UNVERIFIED — network blocked | Inbound concierge, opt-in handoff, P0 | Inbound-first; pre-send governor; no template without proven ₹0 cost | Shift to PWA/Telegram; P0 preview requires human approval |
| WhatsApp Coexistence | Meta WhatsApp Business Platform docs | UNVERIFIED — network blocked | Preserve Business App number | No migration until eligible and backed up | Use separate test number or PWA only |
| Managed database/realtime | https://supabase.com/pricing and realtime quotas | UNVERIFIED — network blocked | 600 users, 300 active chatters | Cardless free plan only; connection caps; load shedding | Read-only lite mode; chat feature flag off |
| Edge compute | https://developers.cloudflare.com/workers/platform/pricing/ | UNVERIFIED — network blocked | API, snapshots, lightweight workers | Hard request counters and fail-closed deployment | Static PWA remains; dynamic writes paused |
| Object storage | https://developers.cloudflare.com/r2/pricing/ | UNVERIFIED — network blocked | Target 5 GB media | Compression, per-user caps, admin originals flag | Disable new video, then new uploads; preserve RSVP/chat |
| Google Sheets API | https://developers.google.com/workspace/sheets/api/limits | UNVERIFIED — network blocked | Admin dataset sync only | Batched sync, backoff, CSV fallback | Queue changes; CSV export/import |
| GitHub Actions | GitHub Actions billing docs | UNVERIFIED — network blocked | CI, scheduled checks, release artifacts | Stop workflows before quota; local CI fallback | No deployment; existing release remains |
| Telegram Bot API | https://core.telegram.org/bots/faq | UNVERIFIED — network blocked | Core family/vendor alerts | Rate queue and batching | In-app/ntfy fallback |
| ntfy | Official ntfy docs / self-host | UNVERIFIED — network blocked | P0/P1 device alerts | Self-host on laptop only as secondary | Telegram/in-app alert remains |
| AI providers | Provider official pricing and data-use terms | UNVERIFIED — network blocked | Optional Tier 1/2 only | Per-provider token buckets; no auto-upgrade; Tier 0 default | Circuit opens; deterministic fallback |
| Maps/tiles | https://operations.osmfoundation.org/policies/tiles/ | UNVERIFIED — network blocked | Venue and Baraat maps | No bulk public-tile use; packaged PMTiles candidate | Text directions and last-known status |
| Monitoring/error tracking | Provider official pricing | UNVERIFIED — network blocked | Health/error events | Sampling, retention cap, no PII | Local metrics and Watchtower remain |
| ASUS laptop | Already owned | VERIFIED by user statement, 30 Oct 2026 | Wedding-week local AI/gallery/redundancy | No new purchase | Managed core continues without it |

## Spend governor

1. Every provider begins with `spend_allowed=false`.
2. Outbound action calculates expected cost and recipient count before enqueue.
3. Unknown price is treated as potentially billable and rejected.
4. GREEN/AMBER/RED/BLACK thresholds apply only after an official free allowance is verified.
5. No automatic plan upgrade, overage, paid call, SMS or template send exists.

True 100% free operation cannot be guaranteed until provider eligibility and quotas are verified. The system can guarantee that it will stop optional operations instead of intentionally authorizing spend.
