# AI operations

The wedding system uses one confirmed-facts answer engine across the website and Telegram. It answers deterministic wedding questions immediately and refuses to invent unknown details.

Optional external model roles can be enabled later with provider API keys:

- **Llama/Ollama-compatible provider:** conversational rewriting and multilingual tone. Ollama must run on a separate always-on host; it cannot run persistently inside Vercel.
- **DeepSeek-compatible provider:** manager summaries, request classification and planning analysis.
- **Grok-compatible provider:** operational alert analysis after the deterministic health monitor detects a problem.
- **Kiwi or another retrieval model:** document extraction only after its provider and API contract are selected.

External models never decide authentication, approval, payments, privacy or location access. Those remain deterministic server rules. GitHub Actions checks production every 15 minutes using `scripts/monitor-production.mjs`; Vercel handles Telegram messages continuously through its webhook.
