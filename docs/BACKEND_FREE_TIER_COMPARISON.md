# Backend comparison for 600 concurrent guests

Checked 2026-11-08. Official pages: [Supabase pricing](https://supabase.com/pricing), [Appwrite pricing](https://appwrite.io/pricing), and [PocketBase FAQ](https://pocketbase.io/faq/). Automated retrieval from this environment returned HTTP 403 for the managed pricing pages, so numeric current quotas are **unverified** and are not repeated as facts.

| Option | 600 concurrent guest implication | Constraint result |
|---|---|---|
| Supabase managed free | Realtime/database/storage limits and pause policy need a current official dashboard verification plus a measured 600-client test. | No selection; availability at 600 is unverified. |
| Appwrite Cloud free | Connection, function, bandwidth and storage quotas need current official verification plus a measured 600-client test. | No selection; availability at 600 is unverified. |
| PocketBase self-hosted | Technically compact, but requires a continuously reachable server for realtime/auth. | Rejected for production under “no always-on machine.” |

The local build keeps SQLite and SSE for repeatable testing. No managed backend is selected and no external account was touched. Production realtime cannot be promised under the current constraints until a free managed tier is verified and load-tested.
