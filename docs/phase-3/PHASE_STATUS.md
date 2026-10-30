# Phase 3 Status

## Passed

- ESLint and TypeScript production build.
- Existing UI suite: 4/4 tests.
- Clean database created schema version 2.
- WhatsApp enqueue redirected to web while BLACK/disabled.
- Duplicate idempotency key produced no second queue row.
- Web and ntfy dispatch: 2 examined, 2 sent, 0 failed.
- Web inbox returned the queued fallback notification once.
- `freeze.non_p0` rejected P2; P0 remained queueable.
- Telegram signed webhook accepted once and suppressed the duplicate update.
- WhatsApp HMAC-signed delivery receipt accepted once and suppressed the duplicate.
- Governor recorded one delivery and remained BLACK with allowance 0.
- Three forced provider failures produced one dead outbox row and one dead-letter record.

## Live gates

- Revoke the credentials exposed in chat and install replacements in the secret store.
- Deploy an HTTPS URL, run `npm run telegram:configure`, and complete a real contact-verification drill.
- Configure a private ntfy topic and run a real P0 receipt/acknowledgment drill.
- WhatsApp remains disabled unless official eligibility and a genuinely free allowance are verified.

Phase 3 code is locally validated. It is not approved for public messaging until the live gates pass.
