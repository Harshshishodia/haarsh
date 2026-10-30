const token = process.env.TELEGRAM_BOT_TOKEN
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET
const publicBaseUrl = process.env.PUBLIC_BASE_URL

if (!token || !webhookSecret || !publicBaseUrl) {
  throw new Error('TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET and PUBLIC_BASE_URL are required')
}
if (!/^[A-Za-z0-9_-]{1,256}$/.test(webhookSecret)) {
  throw new Error('TELEGRAM_WEBHOOK_SECRET must use only letters, numbers, underscore or hyphen')
}
const base = new URL(publicBaseUrl)
if (base.protocol !== 'https:') throw new Error('PUBLIC_BASE_URL must use HTTPS')

const api = async (method, body = {}) => {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  })
  const result = await response.json()
  if (!response.ok || !result.ok) throw new Error(`${method} failed with HTTP ${response.status}`)
  return result.result
}

const identity = await api('getMe')
await api('setMyDescription', { description: 'The private wedding assistant for Vaishnavi & Dhruv. Verify your number and get help with confirmed wedding details.' })
await api('setMyShortDescription', { short_description: 'Private assistant for the Vaishnavi & Dhruv wedding.' })
await api('setMyCommands', { commands: [
  { command: 'start', description: 'Verify a wedding app login' },
  { command: 'help', description: 'Get wedding assistant help' },
] })
await api('setWebhook', {
  url: new URL('/api/webhooks/telegram', base).toString(),
  secret_token: webhookSecret,
  allowed_updates: ['message'],
  drop_pending_updates: true,
})
const webhook = await api('getWebhookInfo')
console.log(JSON.stringify({
  status: 'ok',
  bot: `@${identity.username}`,
  webhookUrl: webhook.url,
  pendingUpdates: webhook.pending_update_count,
  lastError: webhook.last_error_message || null,
}))
