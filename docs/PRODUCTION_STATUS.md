# Production status

Updated: 31 October 2026

## Live foundation

- Production: <https://haarsh-black.vercel.app>
- Vercel project: `haarsh`
- Neon resource: free plan, connected to Production, Preview, and Development
- Database migration: `1:vercel_core`, confirmed in the Vercel build log
- Telegram bot: `@VDWeddingBot`
- Telegram webhook route: `/api/telegram/webhook`

## Verified checks

- ESLint passes.
- Nine Vitest checks pass.
- Vercel production deployment is Ready.
- Production build applies the Neon migration idempotently.
- Telegram reports the configured production webhook URL.
- Login uses a five-minute challenge, Telegram contact ownership, six-digit OTP, hashed phone identity, rate limiting, and an HTTP-only session cookie.

## Operator action required

Rotate the Telegram token that appeared in chat, then enter the replacement directly in Vercel as `TELEGRAM_BOT_TOKEN` for Production, Preview, and Development. Do not paste it into source code, GitHub, documentation, or chat. Redeploy after saving it, then reset the webhook with the configured webhook secret.

The cloud secret broker lets this workspace call Telegram without revealing the token. It intentionally cannot export the raw value into Vercel, so a value forwarded by CLI becomes an unusable broker placeholder. This is the only reason production Telegram replies are not yet authenticated.

Google OAuth credentials shown in screenshots should also be rotated before enabling Google sign-in. Google OAuth is outside the current production login path.
