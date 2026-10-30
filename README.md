# V&D Wedding Concierge

Local working application for the V&D guest concierge and wedding manager. It is deliberately separate from `/workspace/haarsh`, which is an unrelated Python library.

## Run locally

```bash
cd /workspace/vd-wedding
npm install
npm run dev
```

The terminal prints the local URL. No account, secret or paid service is required for the current local demo.

For the complete production-style server and durable local database:

```bash
cp .env.example .env
npm run build
npm start
```

Open `http://localhost:4173`. The health endpoint is `GET /api/health`. This server stores SQLite data in `DATA_DIR` and serves the compiled PWA itself, so the preview does not depend on a temporary Vite process.

## Validate

```bash
npm test
npm run build
npm run dev -- --host 127.0.0.1
```

The sample preview demonstrates the invitation home, Stories strip, posts, private pass, household RSVP, chat, profile/privacy controls and deterministic concierge. The authenticated production route is consent-first and uses a Telegram contact challenge. Later social, chat, tracking and autopilot modules remain disabled behind server-side feature flags.

## Data and privacy boundary

The sample preview uses synthetic records and browser-local RSVP state. The server provides durable sessions, guest/import records, help requests, flags, audit events and health state. It does not create calendar events, write to Google Drive or send WhatsApp messages. Do not put credentials in `VITE_` variables because those are included in the browser bundle.

Use `sample-data/guests.csv` as the initial import shape. Real phone numbers must be supplied through a private server-side import, never committed or placed in client code.

## Publication

No publication was performed. Telegram verification is implemented but needs a real bot credential and webhook drill. Public launch also remains blocked by the PostgreSQL/RLS migration, a second backup destination, external monitoring, privacy deletion verification and realistic load testing.

## Container deployment

```bash
docker build --secret id=proxy_ca,src=/path/to/session-proxy-ca.pem -t vd-wedding .
docker run --rm -p 4173:4173 -v vd-wedding-data:/data \
  -e PHONE_HASH_PEPPER='replace-with-a-long-random-value' \
  -e TELEGRAM_BOT_USERNAME='your_bot_username' \
  -e TELEGRAM_BOT_TOKEN='from-secret-store' \
  -e TELEGRAM_WEBHOOK_SECRET='from-secret-store' \
  -e BACKUP_ENCRYPTION_KEY='64-hex-characters' \
  vd-wedding
```

Set the Telegram webhook to `https://YOUR_HOST/api/webhooks/telegram` with Telegram's `secret_token` equal to `TELEGRAM_WEBHOOK_SECRET`. Guests enter their phone, accept the privacy notice, open the generated bot link and share their own Telegram contact. The API stores HMACs rather than plaintext phone numbers.

After placing the rotated bot token and a newly generated webhook secret in the deployment secret store, configure the bot without pasting either value into a command or chat:

```bash
set -a; . ./.env; set +a
npm run telegram:configure
```

Expected output contains `"status":"ok"`, `"bot":"@VDWeddingBot"`, the HTTPS webhook URL, zero or a small pending-update count, and `"lastError":null`. The command also installs the bot description and `/start` and `/help` commands.

Demo authentication is disabled in production unless `ALLOW_DEMO_AUTH=true`. Do not enable it for a guest launch. WhatsApp remains disabled and fail-closed; use the web app and Telegram whenever WhatsApp has a charge or delivery error. Google credentials are intentionally absent; the application never guesses or embeds them.

## Guest import

Use `sample-data/guests.csv` as the private CSV shape. An admin first posts the raw file with `Content-Type: text/csv` to `POST /api/admin/import/guests/dry-run`. Review every reported problem, then post the same file to `POST /api/admin/import/guests`. Apply is transactional and refuses a file with validation or duplicate errors.

For NocoDB, create a private table with the same eight column names, then store its table ID in `NOCODB_TABLE_ID` and a replacement API token in `NOCODB_API_TOKEN`. Call `POST /api/admin/import/nocodb/dry-run` first and inspect `problemCount`; only then call `POST /api/admin/import/nocodb`. Both endpoints require an authenticated admin session. The token stays on the server and is never returned to the browser.

## Backup and restore drill

```bash
BACKUP_ENCRYPTION_KEY='<same-64-hex-key>' npm run backup
BACKUP_ENCRYPTION_KEY='<same-64-hex-key>' npm run restore:verify -- backups/<file>.vdbak
```

The backup uses AES-256-GCM and writes a SHA-256 sidecar. Restore verification decrypts into an isolated temporary database, checks the digest and runs SQLite `quick_check`; it never overwrites the live database. Roll back an application release by stopping the new container and starting the previous immutable image with the same data volume. Restore data only from a verified backup after preserving the failed volume for investigation.

The Phase 2 design, validation evidence and remaining public-launch gates are in [`docs/phase-2`](docs/phase-2/PHASE_STATUS.md).

## Messaging operations

Phase 3 uses a durable priority outbox. WhatsApp begins disabled with a zero allowance and BLACK budget mode. Any requested WhatsApp message routes to Telegram when its recipient is expressed as `telegram:<chat-id>`; otherwise it becomes an in-app web notification.

Admin endpoints:

- `GET /api/admin/messaging/status`
- `POST /api/admin/messaging/enqueue`
- `POST /api/admin/messaging/dispatch`
- `PUT /api/admin/messaging/controls/:key`
- `PUT /api/admin/messaging/budget/whatsapp`

Guests retrieve in-app messages through `GET /api/notifications`. The background dispatcher runs every five seconds. Three failed attempts create a dead letter. Set `NTFY_TOPIC` and optionally `NTFY_ACCESS_TOKEN` for operator alerts; do not put private facts or phone numbers in a public ntfy topic.

Rollback Phase 3 by stopping the new container and starting the prior Phase 2 image against a preserved copy of the data volume. Schema version 2 is additive, so the old application ignores its messaging tables. Do not delete those tables during rollback; they contain dedupe and audit evidence.

The Phase 3 design and exact validation evidence are in [`docs/phase-3`](docs/phase-3/PHASE_STATUS.md).

## Private social layer

Authenticated guests use `/api/social/feed`, `/api/social/stories`, private profiles and notifications. New guest content waits in `/api/social/moderation` until an admin approves it. Images upload as multipart field `file` to `POST /api/social/media`; the server accepts JPEG, PNG, WebP or HEIC up to 8 MB, re-encodes to WebP at no more than 1600px and returns a private storage key.

The upload directory lives under `DATA_DIR/uploads` and must share the encrypted backup lifecycle with the database. Never map it to an unauthenticated static web directory. Video is deliberately unavailable until the local transcoding path enforces duration, size and resource limits.

Rollback Phase 4 by disabling `social.feed` and `social.stories`, stopping the Phase 4 container and starting the Phase 3 image with a preserved volume. Schema version 3 is additive. Preserve its tables and upload directory for audit and recovery.

The Phase 4 design and evidence are in [`docs/phase-4`](docs/phase-4/PHASE_STATUS.md).

## Live chat

Phase 5 exposes authenticated routes under `/api/chat`. `GET /api/chat/events` is the SSE stream; EventSource reconnects automatically. Messages use a caller-generated `clientMessageId`, unique per sender, so an offline retry cannot create a duplicate. External links are rejected and direct messages are absent by design.

The PWA keeps failed sends in `vd-chat-queue` and retries them with their original ID after SSE reconnects. Admins can pause a room through `PUT /api/chat/channels/:id/freeze`; the global `freeze.chat` and `panic` controls also block sends.

Rollback by disabling `chat.realtime`, stopping the Phase 5 container and starting the Phase 4 image against a preserved volume. Schema version 4 is additive. The Phase 5 evidence is in [`docs/phase-5`](docs/phase-5/PHASE_STATUS.md).

## RSVP and operations

Phase 6 routes live under `/api/planning`. Store `ADMIN_STEP_UP_PIN` in the deployment secret store; seating assignments/publication and transport dispatch fail closed when it is absent. Guests retrieve only their own published logistics through `/api/planning/my-logistics`. The validation record is in [`docs/phase-6`](docs/phase-6/PHASE_STATUS.md).

## Agent platform

Phase 7 loads `docs/phase-1/agent-specs.yaml` and exposes authenticated orchestration under `/api/agents`. The production image copies the same immutable spec into `/app/agents`. Autopilot begins off; admins can choose off, observe or on through `/api/agents/admin/autopilot`. The Operator loop runs every five minutes and remains subject to tool whitelists, autonomy tiers and the hourly cap. Evidence is in [`docs/phase-7`](docs/phase-7/PHASE_STATUS.md).

## AI quality engine

Phase 8 uses `knowledge/wedding-bible.json`, the persona guide and 320 synthetic cases. `POST /api/ai/ask` returns intent, short response, confidence, tier, provider and citations. `POST /api/ai/admin/evaluate` runs the deployment gate. Optional model providers stay disabled until independently verified. Evidence is in [`docs/phase-8`](docs/phase-8/PHASE_STATUS.md).
