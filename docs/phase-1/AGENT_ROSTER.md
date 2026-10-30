# Agent Platform Roster

Agents are policy-bound workers, not independent authorities. Tier 0 means no model; Tier 1 is a small optional model; Tier 2 is a scarce stronger model; Tier 3 is local/on-device ML. All write tools support dry-run, recheck role/consent and produce audit events.

| Agent | Purpose | Model | Default autonomy | Primary escalation |
|---|---|---:|---:|---|
| Orchestrator | Classify, fan out, combine one safe reply | 0/1 | A0 | Critic / human handoff |
| Identity | Login, newcomer and session guidance | 0 | A1 | Security / admin |
| RSVP | Household RSVP slots, totals and corrections | 0 | A1 | Admin on conflicts |
| Concierge | Bible-grounded schedule/venue/ritual answers | 0/1 | A1 | Family handoff |
| Social | Feed, Stories, profile and notification actions | 0 | A1 | Moderation |
| Chat | Channel/message operations and delivery recovery | 0 | A1 | Safety/admin |
| Content Safety | Rules-first profanity and content triage | 0/3/1 | A1 | Doubtful cases to admin |
| Seating | Capacity checks and manual-plan assistance | 0/3 | A1 | Publish is A2 |
| Transport | Pickup, rooms, arrivals and manifests | 0 | A1 | Operator |
| Tracker | Baraat/shuttle point health and ETA | 0/3 | A1 | Stale tracker alert |
| Handoff | Route guests to Harsh/family with SLA | 0 | A1 | P0/P1 alerts |
| Messaging | WhatsApp/Telegram/in-app outbox and budget | 0 | A1 | Unknown cost blocks |
| Data Steward | Imports, conflicts, provenance and bible fixes | 0/1 | A0 | Merge/fact change A3 |
| Operator | Five-minute work queue and Autopilot report | 0/1 | Observe-only initially | Harsh digest |
| Nigrani | Two-minute health/anomaly checks | 0/3 | A0 | Alert ladder |
| Critic | Privacy, fact, policy and tool-call review | 0/2 | A0 | Reject or human review |
| Synthetic Guest | Continuous critical-journey probes | 0 | A0 | Nigrani |

## Shared agent-spec schema

Every registry record contains:

```yaml
id: string
role: string
goals: [string]
model_tier: [0, 1, 2, 3]
allowed_tools: [string]
input_schema: JSON_Schema_reference
output_schema: JSON_Schema_reference
timeout_ms: integer
retry: {max_attempts: integer, backoff: exponential_with_jitter}
memory_scope: [request, conversation, guest_profile, wedding_bible, operational]
autonomy_tier: A0|A1|A2|A3
escalation_rules: [string]
prompt_version: semver
eval_suite_id: string
dry_run_default: boolean
```

Registry validation rejects unknown tools, autonomy above the tool ceiling, absent schemas, unbounded retries, mutable kill-switch access and prompt versions without an eval result.
