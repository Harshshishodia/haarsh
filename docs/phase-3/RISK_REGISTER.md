# Risk Register — Phase 3

| Risk | State | Control |
|---|---|---|
| Exposed Telegram/NocoDB credentials | Open until revoked | Never stored or used; rotate before live configuration |
| Duplicate provider webhooks | Controlled | Unique provider/external ID; duplicate response is successful and side-effect free |
| Duplicate outbound sends | Controlled locally | Unique idempotency key and attempt ledger |
| WhatsApp creates cost | Controlled | BLACK/disabled default and automatic Telegram/web routing |
| Provider outage | Controlled for core journey | Retry, dead letter, in-app fallback design; live provider drill pending |
| Kill switch bypass | Tested for enqueue path | P0 allowed; P1–P3 blocked under non-P0 freeze/panic |
| SQLite concurrent writers | Open | PostgreSQL/RLS required before 600-guest launch |
| Public ntfy topic leaks alerts | Open | Use a private self-hosted topic or access token; never include guest PII |
| Webhook replay with altered IDs | Partially controlled | Signature plus event ID; timestamp/replay-window support depends on provider payload |
| Queue worker restart | Controlled locally | Durable rows remain pending and resume after process restart |
