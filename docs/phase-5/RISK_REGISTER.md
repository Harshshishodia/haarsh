# Risk Register — Phase 5

| Risk | State | Control |
|---|---|---|
| Duplicate offline messages | Controlled | Unique sender/client-message ID |
| Cross-side disclosure | Tested | Server policy plus per-SSE-subscriber filtering |
| Link spam | Controlled | External links rejected server-side |
| Flooding | Controlled locally | 20 messages per guest per minute |
| Multi-instance event loss | Open | PostgreSQL pub/sub or equivalent required before horizontal scaling |
| Process disconnect | Controlled | Durable history plus EventSource reconnect and client offline queue |
| Chat abuse | Partially controlled | Delete, freeze, reports foundation; multilingual classifier remains later hardening |
