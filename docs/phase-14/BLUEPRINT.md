# Phase 14 — Archive and teardown

Teardown is built as a dry-run-first, evidence-gated process. Admins can create an archive or deletion plan, see exact record counts, export operational logs with a SHA-256 checksum, and complete credential, account, data and privacy checklists. Approval requires the data and privacy checklist.

Execution is locked until 18 March 2027, requires `ALLOW_TEARDOWN=true`, teardown operation mode, an approved plan and the exact confirmation phrase. Current data is therefore protected from premature deletion. External tokens and accounts remain manual evidence items because the application must not silently revoke or close services.

## Rollback

Draft or approved plans can be abandoned without changing wedding data. Before an executed deletion, restore only from the final verified encrypted archive under the approved retention decision.
