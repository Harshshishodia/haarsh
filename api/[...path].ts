import crypto from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { neon } from '@neondatabase/serverless'
import { parsePhoneNumberFromString } from 'libphonenumber-js'
import { z } from 'zod'

const databaseUrl = process.env.DATABASE_URL
const sql = databaseUrl ? neon(databaseUrl) : null
const pepper = process.env.PHONE_HASH_PEPPER || ''
const sessionSecret = process.env.SESSION_SECRET || ''
const botToken = process.env.TELEGRAM_BOT_TOKEN || ''
const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'VDWeddingBot'
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET || ''
const migrationSecret = process.env.MIGRATION_SECRET || ''
const adminPhone = process.env.ADMIN_PHONE_E164 || ''

async function migrateCore() {
  if (!sql) throw new Error('database_missing')
  const statements = [
    `CREATE TABLE IF NOT EXISTS app_migrations (version integer PRIMARY KEY, name text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS guests (id uuid PRIMARY KEY, phone_hash text UNIQUE NOT NULL, display_name text NOT NULL, side text NOT NULL CHECK (side IN ('bride','groom','shared')), relation text NOT NULL, role text NOT NULL DEFAULT 'guest', preferred_language text NOT NULL DEFAULT 'Hinglish', review_state text NOT NULL DEFAULT 'pending', created_at timestamptz NOT NULL DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS login_challenges (id uuid PRIMARY KEY, phone_hash text NOT NULL, code_hash text NOT NULL, start_token_hash text UNIQUE NOT NULL, status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','otp_sent','exchanged','expired','locked')), telegram_chat_id text, telegram_user_id text, attempts integer NOT NULL DEFAULT 0, expires_at timestamptz NOT NULL, consented_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`,
    `CREATE INDEX IF NOT EXISTS login_challenges_phone_idx ON login_challenges(phone_hash, created_at DESC)`,
    `CREATE TABLE IF NOT EXISTS sessions (id_hash text PRIMARY KEY, guest_id uuid NOT NULL REFERENCES guests(id) ON DELETE CASCADE, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS telegram_updates (update_id bigint PRIMARY KEY, received_at timestamptz NOT NULL DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS login_rate_limits (key text PRIMARY KEY, count integer NOT NULL, window_start timestamptz NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS audit_log (id uuid PRIMARY KEY, actor_id uuid REFERENCES guests(id) ON DELETE SET NULL, action text NOT NULL, entity_type text NOT NULL, entity_id text, facts jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now())`,
    `INSERT INTO app_migrations(version,name) VALUES (1,'vercel_core') ON CONFLICT (version) DO NOTHING`,
  ]
  for (const statement of statements) await sql.query(statement)
}

const digest = (purpose: string, value: string) =>
  crypto.createHmac('sha256', purpose === 'session' ? sessionSecret : pepper).update(`${purpose}:${value}`).digest('hex')
const equal = (a: string, b: string) => {
  const left = Buffer.from(a), right = Buffer.from(b)
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}
const json = (res: VercelResponse, status: number, body: unknown) => {
  res.setHeader('cache-control', 'no-store')
  return res.status(status).json(body)
}
const normalizePhone = (raw: string) => {
  const phone = parsePhoneNumberFromString(raw, 'IN')
  return phone?.isValid() ? phone.number : null
}
const cookies = (header = '') => Object.fromEntries(header.split(';').map(v => v.trim().split('=').map(decodeURIComponent)).filter(v => v.length === 2))
const bodySchema = z.object({ phone: z.string().min(7).max(30), consent: z.literal(true) })

async function telegram(method: string, payload: unknown) {
  if (!botToken) throw new Error('telegram_token_missing')
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
  })
  const result = await response.json() as { ok?: boolean }
  if (!response.ok || !result.ok) throw new Error(`telegram_${method}_failed`)
}

async function rateLimited(key: string) {
  if (!sql) return true
  const rows = await sql`
    INSERT INTO login_rate_limits(key, count, window_start)
    VALUES (${key}, 1, now())
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN login_rate_limits.window_start < now() - interval '15 minutes' THEN 1 ELSE login_rate_limits.count + 1 END,
      window_start = CASE WHEN login_rate_limits.window_start < now() - interval '15 minutes' THEN now() ELSE login_rate_limits.window_start END
    RETURNING count
  `
  return Number(rows[0]?.count || 0) > 5
}

async function currentGuest(req: VercelRequest) {
  if (!sql || !sessionSecret) return null
  const raw = cookies(req.headers.cookie).vd_session
  if (!raw) return null
  const rows = await sql`
    SELECT g.id, g.display_name, g.side, g.relation, g.role, g.preferred_language
    FROM sessions s JOIN guests g ON g.id = s.guest_id
    WHERE s.id_hash = ${digest('session', raw)} AND s.expires_at > now()
  `
  return rows[0] || null
}

async function handleAuth(req: VercelRequest, res: VercelResponse, path: string) {
  if (!sql || !pepper || !sessionSecret) return json(res, 503, { error: 'identity_service_not_configured' })
  if (path === 'auth/challenges' && req.method === 'POST') {
    const parsed = bodySchema.safeParse(req.body)
    if (!parsed.success) return json(res, 400, { error: 'valid_phone_and_consent_required' })
    const normalized = normalizePhone(parsed.data.phone)
    if (!normalized) return json(res, 400, { error: 'invalid_phone_number' })
    const phoneHash = digest('phone', normalized)
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim()
    if (await rateLimited(`ip:${digest('rate', ip)}`) || await rateLimited(`phone:${phoneHash}`)) {
      return json(res, 429, { error: 'try_again_later' })
    }
    const id = crypto.randomUUID()
    const otp = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
    const startToken = crypto.randomBytes(32).toString('base64url')
    await sql`UPDATE login_challenges SET status='expired' WHERE phone_hash=${phoneHash} AND status IN ('pending','otp_sent')`
    await sql`
      INSERT INTO login_challenges(id, phone_hash, code_hash, start_token_hash, expires_at, consented_at)
      VALUES (${id}, ${phoneHash}, ${digest('otp', otp)}, ${digest('start', startToken)}, now() + interval '5 minutes', now())
    `
    return json(res, 201, {
      challengeId: id,
      mode: 'telegram_contact',
      telegramUrl: `https://t.me/${botUsername}?start=${startToken}`,
      expiresInSeconds: 300,
    })
  }
  const challengeMatch = path.match(/^auth\/challenges\/([0-9a-f-]+)$/)
  if (challengeMatch && req.method === 'GET') {
    const rows = await sql`SELECT status, expires_at FROM login_challenges WHERE id=${challengeMatch[1]}`
    if (!rows[0]) return json(res, 404, { error: 'challenge_not_found' })
    const expired = new Date(String(rows[0].expires_at)).getTime() <= Date.now()
    if (expired && ['pending', 'otp_sent'].includes(String(rows[0].status))) {
      await sql`UPDATE login_challenges SET status='expired' WHERE id=${challengeMatch[1]}`
    }
    return json(res, 200, { status: expired ? 'expired' : rows[0].status })
  }
  if (path === 'auth/exchange' && req.method === 'POST') {
    const challengeId = String(req.body?.challengeId || '')
    const code = String(req.body?.code || '')
    const rows = await sql`SELECT * FROM login_challenges WHERE id=${challengeId}`
    const challenge = rows[0]
    const valid = challenge && challenge.status === 'otp_sent' && challenge.attempts < 5 &&
      new Date(String(challenge.expires_at)).getTime() > Date.now() && /^\d{6}$/.test(code) &&
      equal(digest('otp', code), String(challenge.code_hash))
    if (!valid) {
      if (challenge) await sql`UPDATE login_challenges SET attempts=attempts+1, status=CASE WHEN attempts+1>=5 THEN 'locked' ELSE status END WHERE id=${challengeId}`
      return json(res, 401, { error: 'ownership_proof_required' })
    }
    let guests = await sql`SELECT * FROM guests WHERE phone_hash=${challenge.phone_hash}`
    if (!guests[0]) {
      const guestId = crypto.randomUUID()
      const displayName = String(req.body?.displayName || 'Wedding guest').trim().slice(0, 100) || 'Wedding guest'
      const side = ['bride','groom','shared'].includes(String(req.body?.side)) ? String(req.body.side) : 'shared'
      const relation = String(req.body?.relation || 'guest').slice(0, 80)
      const role = adminPhone && equal(digest('phone', adminPhone), String(challenge.phone_hash)) ? 'admin' : 'guest'
      await sql`INSERT INTO guests(id,phone_hash,display_name,side,relation,role) VALUES(${guestId},${challenge.phone_hash},${displayName},${side},${relation},${role})`
      guests = await sql`SELECT * FROM guests WHERE id=${guestId}`
    }
    if (adminPhone && equal(digest('phone', adminPhone), String(challenge.phone_hash)) && guests[0].role !== 'admin') {
      await sql`UPDATE guests SET role='admin', review_state='approved' WHERE id=${guests[0].id}`
      guests = await sql`SELECT * FROM guests WHERE id=${guests[0].id}`
    }
    const rawSession = crypto.randomBytes(32).toString('base64url')
    await sql`INSERT INTO sessions(id_hash,guest_id,expires_at) VALUES(${digest('session', rawSession)},${guests[0].id},now()+interval '30 days')`
    await sql`UPDATE login_challenges SET status='exchanged' WHERE id=${challengeId}`
    res.setHeader('set-cookie', `vd_session=${encodeURIComponent(rawSession)}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax`)
    return json(res, 200, { user: { id: guests[0].id, displayName: guests[0].display_name, side: guests[0].side, relation: guests[0].relation, role: guests[0].role } })
  }
  return false
}

async function handleTelegram(req: VercelRequest, res: VercelResponse) {
  if (!sql || !pepper || !webhookSecret || !botToken) return json(res, 503, { error: 'telegram_not_configured' })
  const supplied = String(req.headers['x-telegram-bot-api-secret-token'] || '')
  if (!equal(supplied, webhookSecret)) return json(res, 401, { error: 'invalid_signature' })
  const updateId = Number(req.body?.update_id)
  if (!Number.isSafeInteger(updateId)) return json(res, 400, { error: 'update_id_required' })
  const inserted = await sql`INSERT INTO telegram_updates(update_id) VALUES(${updateId}) ON CONFLICT DO NOTHING RETURNING update_id`
  if (!inserted.length) return json(res, 200, { received: true, duplicate: true })
  const message = req.body?.message
  if (!message?.chat?.id || message.chat.type !== 'private') return json(res, 200, { received: true, ignored: true })
  const chatId = String(message.chat.id)
  const start = String(message.text || '').match(/^\/start\s+([A-Za-z0-9_-]{40,60})$/)
  if (start) {
    const rows = await sql`SELECT id FROM login_challenges WHERE start_token_hash=${digest('start', start[1])} AND status='pending' AND expires_at>now()`
    if (!rows[0]) await telegram('sendMessage', { chat_id: chatId, text: 'Yeh verification link expire ho gaya hai Ji. Website se dobara shuru kijiye.' })
    else {
      await sql`UPDATE login_challenges SET telegram_chat_id=${chatId}, telegram_user_id=${String(message.from.id)} WHERE id=${rows[0].id}`
      await telegram('sendMessage', { chat_id: chatId, text: 'Apna wahi Telegram mobile number share kijiye jo website par dala tha Ji.', reply_markup: { keyboard: [[{ text: 'Share my number', request_contact: true }]], resize_keyboard: true, one_time_keyboard: true } })
    }
    return json(res, 200, { received: true })
  }
  if (/^\/start\s*$/.test(String(message.text || ''))) {
    await telegram('sendMessage', { chat_id: chatId, text: 'Website par apna number daalne ke baad, neeche se apna Telegram contact share kijiye Ji.', reply_markup: { keyboard: [[{ text: 'Share my number securely', request_contact: true }]], resize_keyboard: true, one_time_keyboard: true } })
    return json(res, 200, { received: true })
  }
  if (message.contact?.phone_number) {
    if (Number(message.contact.user_id) !== Number(message.from?.id)) {
      await telegram('sendMessage', { chat_id: chatId, text: 'Sirf apna Telegram contact share kijiye Ji; forwarded contact accept nahi hota.' })
      return json(res, 200, { received: true, rejected: true })
    }
    const normalized = normalizePhone(String(message.contact.phone_number).startsWith('+') ? String(message.contact.phone_number) : `+${message.contact.phone_number}`)
    const phoneHash = normalized ? digest('phone', normalized) : ''
    const rows = await sql`SELECT id,phone_hash,code_hash FROM login_challenges WHERE phone_hash=${phoneHash} AND status='pending' AND expires_at>now() AND (telegram_chat_id IS NULL OR (telegram_chat_id=${chatId} AND telegram_user_id=${String(message.from.id)})) ORDER BY created_at DESC LIMIT 1`
    if (!rows[0] || !normalized) {
      await telegram('sendMessage', { chat_id: chatId, text: 'Number match nahi hua Ji. Website par number check karke phir try kijiye.' })
      return json(res, 200, { received: true, matched: false })
    }
    const otp = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
    await sql`UPDATE login_challenges SET code_hash=${digest('otp', otp)}, status='otp_sent', telegram_chat_id=${chatId}, telegram_user_id=${String(message.from.id)} WHERE id=${rows[0].id}`
    await telegram('sendMessage', { chat_id: chatId, text: `Aapka V&D Wedding OTP ${otp} hai. Yeh 5 minutes mein expire hoga. Kisi se share na karein Ji.`, reply_markup: { remove_keyboard: true } })
    return json(res, 200, { received: true, matched: true })
  }
  if (/^\+?[0-9\s()-]{7,20}$/.test(String(message.text || ''))) {
    await telegram('sendMessage', { chat_id: chatId, text: 'Number type karne se ownership verify nahi hoti Ji. Neeche “Share my number securely” button tap kijiye. Telegram tabhi aapka apna number confirm karta hai.', reply_markup: { keyboard: [[{ text: 'Share my number securely', request_contact: true }]], resize_keyboard: true, one_time_keyboard: true } })
    return json(res, 200, { received: true, needsContact: true })
  }
  await telegram('sendMessage', { chat_id: chatId, text: 'Namaste Ji. Wedding login ke liye website se Telegram verification shuru kijiye. Main confirmed date, venue aur RSVP mein help kar sakta hoon.' })
  return json(res, 200, { received: true })
}

async function handleManager(req: VercelRequest, res: VercelResponse, path: string) {
  if (!sql) return json(res, 503, { error: 'database_missing' })
  const actor = await currentGuest(req)
  if (!actor || actor.role !== 'admin') return json(res, 403, { error: 'admin_required' })
  if (path === 'manager/guests' && req.method === 'GET') {
    const rows = await sql`SELECT id,display_name,side,relation,review_state,created_at FROM guests ORDER BY created_at DESC LIMIT 500`
    return json(res, 200, { guests: rows })
  }
  const match = path.match(/^manager\/guests\/([0-9a-f-]+)$/)
  if (match && req.method === 'PATCH') {
    const state = String(req.body?.reviewState || '')
    if (!['approved','rejected','pending'].includes(state)) return json(res, 400, { error: 'invalid_review_state' })
    await sql`UPDATE guests SET review_state=${state} WHERE id=${match[1]}`
    return json(res, 200, { status: 'updated', reviewState: state })
  }
  return false
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const path = Array.isArray(req.query.path) ? req.query.path.join('/') : String(req.query.path || '')
  try {
    if (path === 'internal/migrate' && req.method === 'POST') {
      const supplied = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
      if (!migrationSecret || !equal(supplied, migrationSecret)) return json(res, 401, { error: 'unauthorized' })
      await migrateCore()
      return json(res, 200, { status: 'ok', migration: '1:vercel_core' })
    }
    if (path === 'health' && req.method === 'GET') {
      if (!sql) return json(res, 503, { status: 'degraded', database: 'missing' })
      await sql`SELECT 1`
      return json(res, 200, { status: 'ok', service: 'wedding-os-core', database: 'ok' })
    }
    if (path === 'me' && req.method === 'GET') {
      const guest = await currentGuest(req)
      return guest ? json(res, 200, { user: guest }) : json(res, 401, { error: 'verified_session_required' })
    }
    if (path === 'session' && req.method === 'DELETE') {
      const raw = cookies(req.headers.cookie).vd_session
      if (raw && sql && sessionSecret) await sql`DELETE FROM sessions WHERE id_hash=${digest('session', raw)}`
      res.setHeader('set-cookie', 'vd_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax')
      return res.status(204).end()
    }
    if (path === 'telegram/webhook' && req.method === 'POST') return await handleTelegram(req, res)
    if (path.startsWith('manager/')) {
      const managed = await handleManager(req, res, path)
      if (managed !== false) return managed
    }
    const auth = await handleAuth(req, res, path)
    if (auth !== false) return auth
    return json(res, 404, { error: 'route_not_found' })
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'unknown_api_error')
    return json(res, 500, { error: 'service_temporarily_unavailable' })
  }
}
