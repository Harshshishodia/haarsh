# Phase 2 Changelog

## 30 October 2026

- Approved Phase 1 with Telegram/web replacing WhatsApp whenever cost is positive, unknown or delivery fails.
- Added migration/version, consent, device, challenge, feature-flag, import-history and health tables.
- Added Telegram contact-verification state machine and signed webhook.
- Added consent-first login UI and removed automatic access to private guest/admin screens.
- Added robust CSV dry-run/apply, duplicate detection and import audit records.
- Added audited feature flags with risky modules disabled by default.
- Added encrypted backup and isolated restore verification scripts.
- Added database health verification and updated container packaging.
- Added a flat ESLint configuration and changed the container health probe to Node fetch so inherited proxy variables cannot intercept localhost checks.
- Added a server-only NocoDB guest adapter with dry-run/apply validation and configured the public `VDWeddingBot` username without storing credentials.
