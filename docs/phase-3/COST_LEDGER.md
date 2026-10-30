# Cost Ledger — Phase 3

| Item | Current cost state | Enforced behavior |
|---|---|---|
| In-app web inbox | Rs 0 within existing host | Default fallback; no external message |
| Telegram Bot API | No per-message charge observed; live terms not re-verified in this restricted environment | Disabled until replacement token is stored; never logs token |
| ntfy | Self-hostable/open source; public service limits are not guaranteed | Optional; disabled without topic; P0/P1 operator alerts only |
| WhatsApp Cloud API | Price/free allowance unverified | Allowance 0, BLACK, provider disabled; Telegram/web redirect |
| SQLite outbox | Rs 0 local/container | Accepted for sandbox; PostgreSQL remains public concurrency gate |

No paid send is performed by Phase 3.
