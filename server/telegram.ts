import { db } from './db.js'
import { answerWedding } from './ai.js'
import { sendTelegram } from './messaging.js'
import { ingestExternalLocation } from './baraat.js'

type TelegramMessage = {
  chat?: { id?: number; type?: string }
  from?: { id?: number }
  text?: string
  date?: number
  contact?: { phone_number?: string; user_id?: number }
  location?: { latitude?: number; longitude?: number; live_period?: number }
}

export type TelegramUpdate = {
  update_id?: number
  message?: TelegramMessage
  edited_message?: TelegramMessage
}

type HandlerOptions = {
  hashPhone: (phone: string) => string
  hashCode: (code: string) => string
  send?: typeof sendTelegram
}

export async function handleTelegramUpdate(update: TelegramUpdate, options: HandlerOptions) {
  const send = options.send || sendTelegram
  const message = update.message || update.edited_message
  const chatId = message?.chat?.id ? String(message.chat.id) : ''
  if (!message || !chatId) return { received: true, ignored: true }
  if (message.chat?.type && message.chat.type !== 'private') {
    await send(chatId, 'For privacy, please message @VDWeddingBot in a private chat.')
    return { received: true, privateChatRequired: true }
  }

  const text = String(message.text || '').trim()
  const start = text.match(/^\/start(?:@\w+)?(?:\s+([A-F0-9]{10}))?$/i)
  if (start) {
    if (!start[1]) {
      await send(chatId, answerWedding('hello', null).text)
      return { received: true, replied: true }
    }
    const challenge = db.prepare("SELECT id FROM auth_challenges WHERE code_hash=? AND status='pending' AND expires_at > datetime('now')")
      .get(options.hashCode(start[1].toUpperCase())) as { id: string } | undefined
    if (!challenge) {
      await send(chatId, 'This verification code has expired. Please start again in the wedding app.')
      return { received: true }
    }
    db.prepare('UPDATE auth_challenges SET telegram_chat_id=? WHERE id=?').run(chatId, challenge.id)
    await send(chatId, 'Please tap below to share the mobile number attached to your Telegram account. This is used only to verify your wedding login.', true)
    return { received: true }
  }

  if (/^\/help(?:@\w+)?$/i.test(text)) {
    await send(chatId, 'Ask me about Vaishnavi & Dhruv’s wedding date, venue, schedule, RSVP, travel or Baraat tracking. Private RSVP and travel details require a verified wedding login.')
    return { received: true, replied: true }
  }

  if (message.contact?.phone_number) {
    if (!message.from?.id || message.contact.user_id !== message.from.id) {
      await send(chatId, 'Please use the “Verify my mobile number” button to share your own Telegram contact.')
      return { received: true, contactRejected: true }
    }
    const challenge = db.prepare("SELECT id, phone_hash FROM auth_challenges WHERE telegram_chat_id=? AND status='pending' AND expires_at > datetime('now') ORDER BY created_at DESC LIMIT 1")
      .get(chatId) as { id: string; phone_hash: string } | undefined
    if (!challenge) {
      await send(chatId, 'No active wedding login request was found. Please start again in the wedding app.')
      return { received: true }
    }
    const supplied = String(message.contact.phone_number).replace(/[\s()-]/g, '')
    const normalized = supplied.startsWith('+') ? supplied : `+${supplied}`
    if (options.hashPhone(normalized) !== challenge.phone_hash) {
      db.prepare('UPDATE auth_challenges SET attempts=attempts+1 WHERE id=?').run(challenge.id)
      await send(chatId, 'That Telegram number does not match the number entered in the wedding app. Please return and check it.')
      return { received: true }
    }
    db.prepare("UPDATE auth_challenges SET status='verified' WHERE id=?").run(challenge.id)
    await send(chatId, 'Verified Ji. Please return to the wedding app to continue.')
    return { received: true, verified: true }
  }

  const owner = db.prepare("SELECT g.* FROM auth_challenges a JOIN guests g ON g.phone_hash=a.phone_hash WHERE a.telegram_chat_id=? AND a.status IN ('verified','exchanged') ORDER BY a.created_at DESC LIMIT 1")
    .get(chatId) as Record<string, unknown> | undefined
  if (message.location) {
    const tracking = owner
      ? ingestExternalLocation(String(owner.id), 'telegram', message.location, message.date ? new Date(message.date * 1000) : new Date())
      : { accepted: false, reason: 'telegram_identity_not_verified' }
    if (!tracking.accepted) await send(chatId, 'Live tracking is not active for this verified account. Please start sharing from the wedding app first.')
    return { received: true, tracking }
  }

  if (text) {
    const answer = answerWedding(text.replace(/^\/ask(?:@\w+)?\s*/i, ''), owner || null, owner?.preferred_language)
    await send(chatId, answer.text)
    return { received: true, replied: true, intent: answer.intent }
  }
  return { received: true, ignored: true }
}
