# Risk Register — Phase 7

| Risk | State | Control |
|---|---|---|
| Agent calls unauthorized tool | Controlled | Spec whitelist checked before every execution |
| Agent acts while Autopilot off | Tested | Background actions stay proposed and create no task |
| Runaway action loop | Controlled locally | 20 actions/hour hard cap and fixed five-minute loop |
| Agent changes permissions | Controlled | No mutation tool exists for specs or kill switches |
| Sensitive input retained | Controlled | Run record stores digest; tool-owned domain tables hold necessary data |
| Incorrect model decision | Controlled | Critical routes are rules/SQL; Phase 8 models remain optional |
