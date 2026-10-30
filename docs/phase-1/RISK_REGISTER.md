# Risk Register — Phase 1

Scoring: probability (P) and impact (I), 1–5. Score=P×I. Owners are operational roles, not AI authority.

| # | Risk | P | I | Score | Mitigation / release gate | Owner |
|---|---|---:|---:|---:|---|---|
| 1 | No-card rule makes official WhatsApp production onboarding unavailable | 4 | 5 | 20 | Verify Coexistence and card requirement; preserve Business App; PWA-first launch | Harsh |
| 2 | Free managed realtime cannot sustain 600 concurrent/300 chat users | 4 | 5 | 20 | Official quota verification plus load test; batching, caps, chat kill switch | SRE |
| 3 | ASUS power/ISP/sleep causes outage | 4 | 5 | 20 | Never place critical core on laptop; cached lite mode; independent host | SRE |
| 4 | Media exhausts storage/bandwidth | 5 | 4 | 20 | 5 GB budget, compression, caps, video flag, secondary export | Media owner |
| 5 | Immediate newcomer posting and DMs enable abuse or impersonation | 4 | 4 | 16 | Rate limits, report/block, new-number queue, freeze switches, default safety review | Safety |
| 6 | WhatsApp number migration loses Business App access/history | 3 | 5 | 15 | No migration before verified Coexistence and tested backup/rollback | Messaging owner |
| 7 | Unknown event facts are hallucinated or broadcast | 3 | 5 | 15 | Bible provenance, confirmation states, critic, A3 fact changes | Data steward |
| 8 | Phone numbers or sensitive family/admin facts leak | 3 | 5 | 15 | Field-level policy, pseudonymisation, red-team tests, guest response allowlist | Security |
| 9 | Backup/restore fails during wedding week | 3 | 5 | 15 | Encrypted 6-hour backups to two locations; scheduled restore drills | SRE |
| 10 | AI provider quota/latency causes guest-visible failure | 5 | 3 | 15 | Tier 0 handles critical flows; circuit breakers; handoff; L2 drill | AI platform |
| 11 | Baraat browser tracking stops in background or poor network | 4 | 3 | 12 | Screen-on guidance, buffered points, stale warnings, rehearsal, backup share link | Transport |
| 12 | Google Sheets sync overwrites newer guest/RSVP changes | 3 | 4 | 12 | One source of truth, version columns, dry run, conflict queue, rollback | Data steward |
| 13 | Automated action exceeds authority or messages wrong recipients | 2 | 5 | 10 | Tool whitelist, dry run, autonomy policy, recipient preview, undo, rate cap | Security |
| 14 | Privileged account takeover | 2 | 5 | 10 | 2FA, step-up PIN, device list, short risky-action session, audit alerts | Security |
| 15 | Schedule cannot deliver full social/AI/gallery scope safely | 4 | 4 | 16 | MVP gates first; stretch flags off; weekly critical-path review | Harsh/PM |

## Top decisions

- Reliability outranks social completeness.
- No quota or policy is accepted from memory.
- A hidden or cut feature is preferable to an untested visible feature.
- Live launch is blocked until verified auth, restore drill, load test, P0 drill and 24-hour Synthetic Guest run pass.
