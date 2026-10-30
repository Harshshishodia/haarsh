# Risk Register — Phase 4

| Risk | State | Control |
|---|---|---|
| Guest media exhausts storage | Open | 8 MB ingress cap, 1600px WebP output; quota/dashboard required before launch |
| Malicious image payload | Controlled locally | MIME allowlist, Sharp decode/re-encode, pixel limit, random storage key |
| Private media guessed publicly | Controlled | UUID key plus verified-session route; storage directory is not statically served |
| Newcomer abuse | Controlled | Pending moderation until one admin approval |
| Viewer count inflation | Controlled | Unique story/viewer primary key |
| Phone-number disclosure | Tested | Social query allowlists omit phone hash and plaintext is never stored |
| Video bomb/transcoding overload | Controlled | Video disabled rather than weakly validated |
| SQLite high write concurrency | Open | PostgreSQL/RLS migration and Phase 12 load test gate public launch |
