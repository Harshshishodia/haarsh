# Phase 13 — Rehearsal and wedding week

The operator receives a T-30 to T+7 evidence-based runbook, normal/rehearsal/war-room modes, a combined readiness snapshot and acknowledged shift handoffs. A checklist cannot pass without evidence. War-room status combines open alerts, Watchtower, Synthetic Guest and checklist progress. Mode changes are audited and do not silently change kill switches or send messages.

The 24-hour Synthetic Guest soak is a launch gate and must run in the published production-like environment. This phase supplies the loop and evidence ledger; it does not claim that future 24-hour period has already elapsed.

## Rollback

Switch mode to normal, deploy the Phase 11 image and restore the schema-version-11 backup. Runbook evidence remains exportable before restore.
