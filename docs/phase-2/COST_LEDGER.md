# Cost Ledger — Phase 2

Budget remains ₹0 and no card is allowed.

| Foundation item | Cost state | Control |
|---|---|---|
| SQLite local database | Open source / local | No provider account; production PostgreSQL remains unselected |
| Telegram login fallback | Provider terms still require official verification | No outbound bot operation until token configured; web sample remains available |
| WhatsApp | Disabled | Feature flag false; paid/error paths redirect to Telegram/web |
| CSV adapter | Local | No external calls |
| Google Sheets adapter | Not activated | Requires later OAuth and verified quota terms |
| Encrypted backups | Local destination implemented | Second independent destination pending cardless provider selection |
| Monitoring | Local health endpoint implemented | External dead-man monitor pending provider verification |

No Phase 2 implementation authorizes spend or an automatic upgrade.
