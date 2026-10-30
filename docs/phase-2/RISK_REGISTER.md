# Risk Register — Phase 2 Update

| Risk | Current state | Mitigation / remaining gate |
|---|---|---|
| SQLite cannot provide PostgreSQL RLS or safe multi-instance writes | Open, high | Local/auxiliary only; PostgreSQL migration and RLS tests required before launch |
| Telegram identity proves the shared contact only when the user voluntarily sends it | Controlled | Signed webhook, chat-bound challenge, exact phone HMAC match, expiry and one-time exchange |
| Telegram provider outage blocks new logins | Open | Existing 30-day sessions continue; admin-approved recovery path and second verified method required |
| In-memory rate limiter resets on restart | Open | Replace with shared durable limiter in production hosting implementation |
| Backup exists only in one local destination | Open, high | Configure two encrypted destinations and run restore drills before launch |
| Demo auth could bypass proof | Controlled | Production returns 404 unless explicitly enabled; never set `ALLOW_DEMO_AUTH=true` publicly |
| Feature-flag admin endpoint lacks separate step-up PIN | Open | Implement with privileged 2FA/A3 controls before portal exposure |
| Google Sheets sync not implemented | Open | CSV is the tested fallback; OAuth adapter remains behind a disabled flag |

Phase 1 risks remain applicable; this file records Phase 2 changes rather than deleting them.
