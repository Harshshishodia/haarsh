import crypto from 'node:crypto'
import { handleTelegramUpdate } from '../dist-server/telegram.js'

const token = process.env.TELEGRAM_BOT_TOKEN
const pepper = process.env.PHONE_HASH_PEPPER
if (!token) throw new Error('TELEGRAM_BOT_TOKEN is required')
if (!pepper) throw new Error('PHONE_HASH_PEPPER is required')

const api = async (method, body = {}) => {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(40_000),
  })
  const result = await response.json()
  if (!response.ok || !result.ok) throw new Error(`${method}_http_${response.status}`)
  return result.result
}
const hashPhone = phone => crypto.createHmac('sha256', pepper).update(phone.replace(/\s/g, '')).digest('hex')
const hashCode = code => crypto.createHmac('sha256', pepper).update(`challenge:${code}`).digest('hex')
const send = async (chatId, text, requestContact = false) => {
  const reply_markup = requestContact
    ? { keyboard: [[{ text: 'Verify my mobile number', request_contact: true }]], resize_keyboard: true, one_time_keyboard: true }
    : { remove_keyboard: true }
  const result = await api('sendMessage', { chat_id: chatId, text, reply_markup })
  return String(result.message_id || '')
}

const webhook = await api('getWebhookInfo')
if (webhook.url) throw new Error('telegram_webhook_already_active')
let offset = 0
console.log(JSON.stringify({ status: 'polling', bot: process.env.TELEGRAM_BOT_USERNAME || 'configured' }))
while (true) {
  const updates = await api('getUpdates', { offset, timeout: 25, allowed_updates: ['message'] })
  for (const update of updates) {
    offset = Math.max(offset, Number(update.update_id) + 1)
    try {
      await handleTelegramUpdate(update, { hashPhone, hashCode, send })
    } catch (error) {
      console.error(JSON.stringify({ updateId: update.update_id, error: error instanceof Error ? error.message : 'update_failed' }))
    }
  }
}
