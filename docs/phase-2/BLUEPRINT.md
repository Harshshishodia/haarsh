# Foundation Blueprint — Phase 2

Phase 2 implements a provider-neutral, self-hostable foundation while managed cardless hosting remains unverified. The current runtime uses SQLite WAL for local and container operation; the approved production target remains PostgreSQL with RLS before public launch. This phase does not claim production readiness.

## Components delivered

- Versioned schema foundation with migrations, challenge/session/device/consent/import/flag/health records and critical indexes.
- Private-route boundary in the PWA; consent and E.164 phone entry precede all private data.
- Telegram reverse verification: deep-link code, signed webhook, shared-contact match, expiry, rate limit and one-time exchange.
- WhatsApp auth flag disabled; web/Telegram handles paid or failing WhatsApp conditions.
- Unknown verified guests receive a guest record only after ownership proof.
- Admin CSV dry-run/apply with quoted-field parsing, validation, duplicate detection, checksums and import history.
- Audited server-controlled feature flags; social/chat/tracking remain disabled by default.
- Database health check and encrypted backup/isolated restore verification.
- Docker packaging includes migrations and operational scripts.

## Authentication sequence

```mermaid
sequenceDiagram
  participant G as Guest PWA
  participant A as API
  participant T as Telegram Bot
  participant D as Database
  G->>A: phone + privacy consent
  A->>D: rate-limited challenge (phone HMAC, code HMAC, expiry)
  A-->>G: one-time code + Telegram deep link
  G->>T: /start CODE
  T->>G: request Telegram contact
  G->>T: shared contact
  T->>A: signed webhook
  A->>D: match contact phone HMAC; mark verified
  G->>A: exchange challenge + code
  A->>D: lookup/create guest; consume challenge; create session
  A-->>G: HTTP-only 30-day cookie
```

## Operational commands

```bash
npm run build
npm test
DATA_DIR=./data npm start
BACKUP_ENCRYPTION_KEY=<64-hex> npm run backup
BACKUP_ENCRYPTION_KEY=<same-key> npm run restore:verify -- <backup.vdbak>
```

## Production migration gate

Before public launch, port the migration to PostgreSQL, implement RLS policies from Phase 1, replace in-memory challenge throttling with shared durable limits, and test multiple API instances. SQLite is accepted for current sandbox/local development and ASUS auxiliary use only.
