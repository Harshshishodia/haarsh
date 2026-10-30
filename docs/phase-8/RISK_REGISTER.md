# Risk Register — Phase 8

| Risk | State | Control |
|---|---|---|
| Hallucinated time or venue | Controlled | Verified chunks, explicit unknown policy and regression cases |
| Prompt injection | Tested | Injection intent precedes content lookup and tool use |
| Private-data training | Controlled | No provider enabled; synthetic examples only |
| Free provider outage | Controlled | Tier 0 handles critical journeys |
| Stale fact | Open operationally | Version, source and verified date stored per Bible release |
| Prompt regression | Controlled | Stored eval run must pass all current cases |
