# Risk register

| Risk | Control | Residual state |
|---|---|---|
| No verified free automated phone gateway | Ladder records the skipped step and continues with web, Telegram and ntfy | Open |
| False alerts during maintenance | Time-bounded maintenance window suppresses alert creation while checks continue | Controlled |
| Alert storm or flapping | One active alert per deterministic dedupe key and occurrence counter | Controlled |
