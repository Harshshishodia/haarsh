# Feature Matrix — Phase 1

Status legend: `PROTOTYPE` visible locally but not quality-gated; `PLANNED`; `STRETCH`; `BLOCKED` external prerequisite. Every row requires unit, integration, phone E2E, slow/flaky network and accessibility checks in addition to the named test.

| ID | Surface / feature | Acceptance criteria | Friendly error / offline behavior | Accessibility | Owner | Flag | Status |
|---|---|---|---|---|---|---|---|
| ID-01 | Guest phone landing | E.164 input, consent required, no private data shown | “Number check nahi ho paaya Ji; retry or family approval.” Draft retained | Label, country-code help, 48px action | Identity | auth | PLANNED |
| ID-02 | Reverse WhatsApp OTP | One-use code confirmed from same number; expiry/replay/rate limits | Webhook down offers approved fallback; never treats typed number as proof | Code announced; wa.me action described | Identity | wa_auth | BLOCKED |
| ID-03 | Unknown-number onboarding | Verified user supplies name/side/relation; enters review queue | Local draft; retry without duplicate guest | One question/screen; tap options | Identity | newcomer | PLANNED |
| ID-04 | Sessions/devices | 30-day secure session, refresh, device list, global logout | Existing session remains usable during refresh outage | Device descriptions and confirmations | Identity | sessions | PLANNED |
| ID-05 | Privileged 2FA | Admin/family/vendor require second factor and step-up | Deny risky action; preserve draft | Alternative to QR; clear timeout | Security | privileged_2fa | PLANNED |
| FEED-01 | Home feed | Pinned/newest posts, filters, cursor scroll, new-post pill | Cached last page; retry card; no duplicate posts | Landmarks, alt text, focus restoration | Social | feed | PROTOTYPE |
| FEED-02 | Post creator | 10 images/30s video, draft, progress/pause/retry, EXIF removed | Draft survives closure; failed items retry individually | Camera/gallery labels, alt-text prompt | Social | post_create | PLANNED |
| FEED-03 | Interactions | Idempotent likes, threaded comments, save/report/mute/block, in-app share | Optimistic action rolls back with explanation | Named controls, counts not color-only | Social | interactions | PROTOTYPE |
| PROF-01 | Profiles | Name/side/relation/bio, posts/tagged/saved/memories, no phone | Cached own profile; private tabs stay local | Heading order, avatar alt, large text | Social | profiles | PROTOTYPE |
| STORY-01 | Story creation/viewer | 15s media, stickers, 24h expiry, navigation/pause/reply | Queued upload; cached viewed stories; expiry enforced server-side | Pause control, captions, reduced motion | Stories | stories | PROTOTYPE |
| STORY-02 | Viewer list | Unique first view; author/admin names+times; others count only; live update | Queue view once offline; dedupe on reconnect | Count announcement; accessible list | Stories | story_views | PLANNED |
| STORY-03 | Highlights/archive | User/admin event highlights; private admin export | Archive unavailable shows retained retry | Named collections and keyboard order | Stories | highlights | PLANNED |
| REEL-01 | Vertical video feed | Flagged, data saver, muted autoplay, pagination | Disabled on constrained data/network | Pause/mute/captions | Social | reels | STRETCH |
| ALBUM-01 | Event albums/photos of me | Admin originals policy; local opt-in face match only | Thumbnails/cache; no cloud face processing | Alt text and non-face search | Gallery | albums | STRETCH |
| SAFE-01 | Moderation | Limits, reports, queue, rules-first profanity, preapproval | Suspicious content hidden pending review | Reason/status announced | Safety | moderation | PLANNED |
| CHAT-01 | Channels | Required channels, role membership, announcements read-only | Cached history; reconnect without duplicates | Channel headings/unread labels | Chat | chat | PROTOTYPE |
| CHAT-02 | Realtime delivery | Ordered idempotent messages, p95<1s under target load | Offline queue and automatic resend | Delivery states announced | Chat | chat_realtime | PLANNED |
| CHAT-03 | Rich messaging | Reply/reactions/media/voice/edit 5m/delete/pins/mentions/search | Media retry; text remains usable | Transcripts, waveform label, touch targets | Chat | chat_rich | PLANNED |
| CHAT-04 | DMs, mute, report, freeze | DMs enabled per Constitution; block/mute/report; admin freeze | Frozen room remains readable | State not color-only | Chat/Safety | dms | PLANNED |
| RSVP-01 | Household RSVP | Per event status, adults/kids/names/diet/stay/arrival/pickup/language | Local draft; idempotent sync; late flag | Group labels, errors summarized | RSVP | rsvp | PROTOTYPE |
| RSVP-02 | RSVP admin totals | Live event/diet counts, consent-based reminders, export | Last-updated timestamp; CSV fallback | Tables with captions | RSVP | rsvp_admin | PROTOTYPE |
| RSVP-03 | Calendar export | Correct dates/timezone; unknown times remain all-day/unconfirmed | Downloadable ICS works offline | Descriptive action | RSVP | calendar | PROTOTYPE |
| SEAT-01 | Guest assignment | Shows only own table/seat/room/bus after publish | “Family is confirming this Ji”; cached assignment | Plain text alternative to map | Seating | seating_guest | PLANNED |
| SEAT-02 | Manual editor | Drag/drop, household bulk assign, undo, capacities, constraints | Draft autosave; publish blocked on violations | Keyboard move controls | Seating | seating_admin | PLANNED |
| SEAT-03 | Optimizer | Proposes only; admin edits/accepts; explains conflicts | Falls back to manual editor | Text conflict report | Seating | seating_optimizer | STRETCH |
| TRANS-01 | Pickup/arrival | Requests, drivers, manifests, statuses and arrivals board | SMS-free web path; local request draft | Time/location labels | Transport | transport | PLANNED |
| BARAAT-01 | Tracker sender | Explicit consent, visible active state, buffer/retry, instant stop/expiry | Stale indicator and backup share-link instructions | Screen-on and battery guidance | Tracking | baraat_tracking | PLANNED |
| BARAAT-02 | Guest/admin map | Latest point/ETA/distance; history only for admin; stale health | Text status when tiles/network fail | Text ETA and direction alternative | Tracking | baraat_map | PLANNED |
| CON-01 | Deterministic concierge | Answers only cited bible/live facts; language matching; handoff on unknown | L2 rules continue; never guesses | Text and later voice-note path | Concierge | concierge_t0 | PROTOTYPE |
| CON-02 | Family handoff | VIP routing menu, owner, SLA, warm alert, states | Request receipt distinguished from confirmation | Clear owner/status | Concierge | handoff | PLANNED |
| ADMIN-01 | Mobile dashboard | RSVP/arrivals/alerts/queues/tracking/health/budget/autopilot | Cached status with freshness labels | Responsive cards and table alternatives | Admin | admin | PROTOTYPE |
| ADMIN-02 | Dataset adapter | CSV+Sheets mapping, dry run, conflicts, version, rollback | CSV fallback when Sheets fails | Keyboard mapping form, error file | Data steward | dataset | PLANNED |
| ADMIN-03 | Moderation/new numbers | Review, approve, mute/remove/reverify, audit | Queue retained; bulk action partial-result report | Batch controls labeled | Safety | admin_safety | PLANNED |
| ADMIN-04 | Tasks/vendors/run-of-show | Delegation, escalation, check-ins, critical path, private costs | Offline vendor taps queued | Phone-first buttons | Operations | ops | PROTOTYPE |
| ADMIN-05 | Budget/expenses | Private ledger, payment due, confirmed OCR, no autonomous payment | No guest exposure; OCR failure manual entry | Currency labels and confirmations | Finance | budget | PROTOTYPE |
| ADMIN-06 | Broadcasts | Recipient/cost preview, consent/caps, A3 approval, outbox | Unknown cost blocks send | Preview read aloud; explicit confirm | Messaging | broadcast | PLANNED |
| ADMIN-07 | Agent console | Status/actions/errors/quota/version; pause/clone/rollback | Agents default observe-only | Tables and status text | AI platform | agent_console | PLANNED |
| ADMIN-08 | Autopilot/standing orders | Versioned tiers, report, A2 undo, hourly cap | Master switch works without AI | Explicit state/confirmations | Governance | autopilot | PLANNED |
| ADMIN-09 | Alerts/kill switches | Alert lifecycle, escalation config, freeze/chat/all/panic | Deterministic path; survives AI outage | High-contrast state and confirmation | SRE | watchtower | PLANNED |
| ADMIN-10 | Audit/exports/privacy | Searchable audit, scoped exports, deletion workflow | Encrypted export retry; deletion A3 | Machine and human-readable export | Security | governance | PLANNED |
| VENDOR-01 | Vendor mobile role | Assigned tasks, arrived/late, proof photo, opt-in location | Offline queue; no costs outside grant | Large tap targets | Operations | vendor | PLANNED |

## Global test IDs

- `E2E-PHONE-*`: Android Chrome and WebKit phone viewport.
- `NET-3G-*`, `NET-FLAKY-*`: slow and interrupted network.
- `RT-IDEMP-*`: ordering, dedupe and reconnect.
- `SEC-RBAC-*`, `SEC-PII-*`, `SEC-INJECT-*`: authorization and red team.
- `LOAD-600-*`: full capacity model.
- `CHAOS-*`: provider, database, storage, token and agent failures.
- `A11Y-*`: keyboard, screen reader, contrast, large text, Devanagari and reduced motion.

No row is `DONE`. Prototype status means visual or local behavior exists but the complete gate has not passed.
