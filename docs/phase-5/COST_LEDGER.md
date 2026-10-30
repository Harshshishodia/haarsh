# Cost Ledger — Phase 5

| Item | Cost | Limit |
|---|---:|---|
| SSE chat | Rs 0 | Single process for current runtime; multi-instance fan-out requires PostgreSQL/Redis-equivalent |
| Message storage | Rs 0 local volume | Text-first; monitor database growth |
| Chat images | Rs 0 | Reuses authenticated, compressed Phase 4 images |
| Voice notes | Rs 0 | Disabled until encoding, duration and storage controls pass |

No AI or paid messaging provider is used for in-app chat.
