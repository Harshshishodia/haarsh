# Watchtower Alert Matrix

| Check | Trigger candidate | Priority | Dedupe / flap control | Owner | Automatic action |
|---|---|---|---|---|---|
| Site/API health | 2 consecutive probe failures | P0 during event window, P1 otherwise | host+route; resolve after 3 successes | SRE | Enter L3 if core unavailable |
| API latency | p95 above journey SLO for 3 windows | P1 | route+release | SRE | Shed background work |
| Error rate | >2% critical journey or sharp EWMA change | P1 | service+error class | SRE | Roll back canary if correlated |
| Queue depth | Oldest P0 >10 s; guest >60 s | P0/P1 | queue+priority | Operator | Add consumer if allowed; shed P3 |
| Dead letters | Any P0 or >5 same cause | P0/P1 | cause+provider | Operator | Freeze affected outbound class |
| Realtime | Disconnect surge or connections near verified cap | P1 | service+region | Chat | Coalesce presence; text-only mode |
| AI provider | Circuit open/quota threshold | P2; P1 if all providers | provider+tier | AI platform | L1/L2 fallback |
| WhatsApp delivery | Repeated failure, unknown cost, budget threshold | P1 | number+template+cause | Messaging | Block send; use app/Telegram |
| Storage | 70/85/95% of verified allowance | P2/P1/P0 | bucket+threshold | Media | Disable originals/video/uploads |
| Moderation age | High-risk item >5 min | P1 | item | Safety | Hide pending review |
| New-number queue | Oldest >30 min in event window | P2 | queue | Family admin | Digest/assign |
| RSVP anomaly | Large total drop, impossible count, duplicate household | P2 | household+event | RSVP | Quarantine update |
| Human handoff | P0 immediate; VIP >2 min; normal >15 min | P0/P1/P2 | handoff | Harsh/family | Escalate owner ladder |
| Chat abuse | Rate/profanity/report spike | P1 | user+channel | Safety | One-hour mute only if policy-clear |
| Baraat tracker | Stale >30 s warning; >2 min event alert | P1 | tracker session | Transport | Show stale card; request backup |
| Vendor silence | Critical check-in overdue | P1 | vendor+task | Operations | Escalate task chain |
| Duplicate sends | Any confirmed duplicate | P0 | idempotency key | Messaging/SRE | Freeze outbound worker |
| Backup freshness | >7 h or failed hash | P1 | destination | SRE | Retry other destination |
| Heartbeat | Watchtower silent >5 min | P0 | environment | Harsh | External dead-man alert |
| Synthetic Guest | 2 failures; auth/privacy failure immediate | P1/P0 | journey+release | QA/SRE | Block deploy or rollback |

## P0 escalation ladder

- T+0: WhatsApp buttons if verified and free, Telegram, loud ntfy; create open alert.
- T+2: phone-call path only if a verified zero-cost method exists; otherwise repeat loud push and Telegram.
- T+4: contact privately configured Sanjeev backup and second admin.
- T+8: repeat and post to family-core channel.
- Continue with dedupe and acknowledgement checks; never expose private numbers in logs or portal responses.

The call step is **BLOCKED** until a compliant zero-cost mechanism is verified. Maintenance mode suppresses P2/P3 only; P0 is never suppressed.
