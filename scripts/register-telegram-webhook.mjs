const token = process.env.TELEGRAM_BOT_TOKEN
const secret = process.env.TELEGRAM_WEBHOOK_SECRET
if (!token || !secret) throw new Error('Telegram webhook credentials are required')

const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    url: 'https://haarsh-black.vercel.app/api/telegram/webhook',
    secret_token: secret,
    allowed_updates: ['message'],
    drop_pending_updates: false,
  }),
})
const result = await response.json()
if (!response.ok || !result.ok) throw new Error(`Telegram webhook registration failed (${response.status})`)
console.log('Telegram webhook registered for production')
