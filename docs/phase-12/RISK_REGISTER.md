# Risk register

| Risk | Control | Residual state |
|---|---|---|
| Credential copied into chat | Secure environment bindings; rotate exposed values before production | Open |
| Single-process SQLite capacity | WAL, bounded writes and load smoke; production sizing still requires representative hardware | Open |
| Browser and device matrix unavailable in CLI | Responsive automated UI tests and manual Safari/Android rehearsal remain required | Open |
