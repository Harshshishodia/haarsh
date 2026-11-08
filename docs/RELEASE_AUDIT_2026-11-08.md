# Release audit — 2026-11-08

## Architecture

The production repository uses Vite/React on Vercel, serverless TypeScript API routes and Neon Postgres. The separate local Express/SQLite review build was not copied over because it requires a continuously running process and would break the Vercel runtime model.

## Authentication and privacy

- Login starts with a random Telegram deep-link token.
- The Telegram bot must receive Telegram's contact payload; typed chat text is not ownership proof.
- A six-digit OTP is stored only as a hash and exchanged server-side for an HTTP-only session.
- Guest API output omits phone numbers and hashes.
- RSVP reads and writes are restricted to `invited_events`.
- Manager routes verify the admin role.

## Product behavior

The production application already contains the stronger implementation of the reviewed requirements: distinct Posts and 24-hour Stories, profile editing/follows, per-profile notifications, manager guest approval and event assignment, household RSVP enforcement, a confirmed venue link, a Leaflet Baraat map, manager tracker configuration, CSV export/search/filter, Telegram assistant rules and database-backed serverless APIs.

## AI decision

No external LLM or “training” service was added. Wedding access, RSVP, dates, venue and privacy answers remain deterministic. This avoids cost, hallucinated private data and a new third-party data boundary. Improvements should be evaluated against a fixed wedding-question suite before any provider is enabled.

## Verification

- Tracked-secret pattern scan: passed; only documented placeholders found.
- `npm test -- --run`: 13/13 passed after release changes using an isolated data directory.
- `npm run lint`: passed after release changes.
- `npm run build`: passed after release changes.
- The production smoke result is recorded after deployment.
