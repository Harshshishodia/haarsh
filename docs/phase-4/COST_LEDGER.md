# Cost Ledger — Phase 4

| Item | Cost | Limit and behavior |
|---|---:|---|
| Feed, Stories and profiles | Rs 0 | SQLite/container for current sandbox; PostgreSQL required for launch scale |
| Image processing | Rs 0 | Sharp, open-source; one image up to 8 MB per request |
| Image storage | Rs 0 on attached volume | Media fills local storage first; monitor and export before public launch |
| Video | Rs 0 | Disabled until a safe local transcoder and capacity budget are verified |
| Notifications | Rs 0 | In-app records; Phase 3 Telegram/ntfy can carry operator alerts |

No external media or AI service is called.
