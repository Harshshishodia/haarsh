# Data Model and Policy Blueprint

Target database: PostgreSQL with UUID primary keys, UTC timestamps, explicit `deleted_at`, `source`, `source_version`, and `confidence` where imported or inferred. Phone lookup uses a keyed HMAC; reversible phone ciphertext is separately encrypted and never exposed through guest queries.

## Domains

| Domain | Tables |
|---|---|
| Identity | households, guests, roles, guest_roles, consents, sessions, devices, otp_challenges, new_number_reviews |
| Wedding bible | events, venues, schedule_items, kb_documents, kb_chunks, standing_orders, settings |
| RSVP and logistics | rsvps, rsvp_attendees, seating_plans, seating_assignments, seating_rules, rooms, room_assignments, transport_runs, transport_assignments, arrivals |
| Social | posts, post_media, carousels, likes, comments, comment_likes, saves, collections, tags, mentions, stories, story_stickers, story_views, highlights, close_friends, blocks, mutes |
| Chat | channels, channel_members, messages, message_reads, reactions, message_outbox |
| Safety | reports, moderation_queue, bans, content_flags, upload_scans |
| Operations | tasks, task_events, vendors, vendor_checkins, run_of_show, expenses, budget_lines, handoffs |
| Tracking | tracker_sessions, tracker_points, tracker_health |
| Reliability | domain_events, outbox, queue_leases, dead_letters, alerts, alert_events, escalations, system_health, metrics, backups |
| Agents | agents, agent_versions, agent_runs, agent_actions, agent_feedback, blackboard_entries, autopilot_actions, undo_log, provider_quota, ai_cache |
| Quality | eval_suites, eval_cases, eval_runs, synthetic_probe_runs |
| Governance | feature_flags, autonomy_rules, audit_log, data_imports, import_rows, sync_cursors |

## Critical constraints and indexes

- `guests(phone_hash)` unique; raw phone unavailable to guest roles.
- `story_views(story_id, viewer_id)` unique for idempotent first view.
- `likes(post_id, guest_id)`, `saves(post_id, guest_id)`, `message_reads(message_id, guest_id)` unique.
- `messages(channel_id, created_at, id)` supports stable cursor pagination.
- `tracker_points(session_id, recorded_at)` and BRIN on `recorded_at` for time-series scans.
- `domain_events(idempotency_key)` and `outbox(idempotency_key)` unique.
- Partial indexes for open alerts, pending moderation, unassigned requests, active sessions and undelivered outbox rows.
- Check constraints for RSVP enum values, dietary categories, autonomy tiers, alert priorities/states and tracker consent state.
- Foreign keys default to restrict for financial/audit entities and cascade only for guest-owned ephemeral content after an approved deletion workflow.

## RLS policy matrix

| Role | Read | Write |
|---|---|---|
| Guest | Own profile/private logistics; permitted wedding members/content/channels; aggregate viewer count | Own RSVP/profile/content/reactions/reports; permitted chat channels |
| Family | Guest permissions plus assigned handoffs/tasks and approved logistics | Assigned operations; no budget/vendor costs unless separately granted |
| Vendor | Own vendor record, assigned tasks/check-in/transport instructions | Arrival/late status, task updates, proof media |
| Bride-view | Highlights, blessings, approved Moments | Reactions/profile only; no logistics/admin |
| Admin | All wedding operational records except raw secrets | All within server checks; A3 operations require step-up and approval workflow |
| Worker | Only tables and rows needed by its scoped service identity | Only whitelisted mutations with idempotency key |

RLS never replaces server authorization. Every request supplies a verified principal, role, wedding scope and consent context; every tool call rechecks them.

## Event/outbox transaction

Each business mutation performs in one transaction: validate policy → update domain row → append `domain_events` → append `outbox` if external work is needed → append `audit_log`. Workers use `FOR UPDATE SKIP LOCKED`, a lease expiry, bounded retries and a DLQ. External callbacks record provider event IDs to reject duplicates and replays.

## Import/sync policy

CSV and Google Sheets map into a canonical staging schema. Dry-run emits bad E.164 values, missing required fields, duplicate phone hashes, probable household duplicates and conflicts. Admin approval creates a versioned import. Rollback writes compensating events; it never rewinds unrelated guest self-updates. Google Sheets uses incremental cursors and an explicit conflict queue.

## Backup and deletion

- Encrypted logical database backup plus media manifest every 6 hours.
- Two independent destinations; neither is considered valid until restore-tested.
- Restore drill creates an isolated database, validates row counts, FK integrity, sample media hashes and critical synthetic journeys.
- Guest deletion is A3: export preview → approval → 10-minute cancellation window → anonymise audit references → delete or detach owned content according to policy.
- Teardown default is 30 days after the wedding, subject to Harsh's approved override.
