# V&D Wedding Concierge release rules

- Core pass, RSVP, schedule, directions, authorization and moderation decisions must remain deterministic and database-backed. AI may explain verified records but may not grant access or invent wedding facts.
- A typed phone number is never ownership proof. Private routes require a server-side session created only after Telegram contact-share proof and OTP exchange.
- Filter guest reads and writes by the authenticated household and `invited_events`. Never return phone numbers or hashes to guest clients.
- Every manager write requires an authenticated admin, validation, and an audit entry. Never put secrets, database exports, backups, generated builds or `.env*` values in Git.
- Keep Vercel functions stateless. Durable data belongs in the configured Postgres database; do not depend on process timers, local SQLite or an always-on machine in production.
- Do not add paid services, cards, payment commitments, or billing code.
- GPL, AGPL, PolyForm/source-available and unknown-license repositories are reference-only. Do not copy their code.
- Run `npm run lint`, `npm test -- --run`, and `npm run build` before a release. Run the production smoke monitor after deployment.
