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
    `CREATE TABLE IF NOT EXISTS rsvps (guest_id uuid PRIMARY KEY REFERENCES guests(id) ON DELETE CASCADE, responses jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS manager_records (id uuid PRIMARY KEY, section text NOT NULL, title text NOT NULL, details text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'New', notes text NOT NULL DEFAULT '', created_by uuid REFERENCES guests(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`,
    `CREATE INDEX IF NOT EXISTS manager_records_section_idx ON manager_records(section, created_at DESC)`,
    `CREATE TABLE IF NOT EXISTS baraat_sessions (id uuid PRIMARY KEY,label text NOT NULL,state text NOT NULL DEFAULT 'draft',tracker_id uuid REFERENCES guests(id),expires_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS baraat_points (session_id uuid REFERENCES baraat_sessions(id) ON DELETE CASCADE,sequence integer NOT NULL,latitude double precision NOT NULL,longitude double precision NOT NULL,accuracy_m double precision NOT NULL,signal_state text NOT NULL,recorded_at timestamptz NOT NULL,PRIMARY KEY(session_id,sequence))`,
    `ALTER TABLE baraat_points ADD COLUMN IF NOT EXISTS speed_mps double precision`,
    `ALTER TABLE baraat_points ADD COLUMN IF NOT EXISTS heading double precision`,
    `ALTER TABLE baraat_points ADD COLUMN IF NOT EXISTS battery_percent double precision`,
    `CREATE TABLE IF NOT EXISTS baraat_config (id integer PRIMARY KEY DEFAULT 1 CHECK (id=1),start_lat double precision,start_lng double precision,destination_lat double precision,destination_lng double precision,destination_label text NOT NULL DEFAULT 'Wedding venue',geofence_m integer NOT NULL DEFAULT 500,share_enabled boolean NOT NULL DEFAULT false,webhook_token_hash text,updated_by uuid REFERENCES guests(id) ON DELETE SET NULL,updated_at timestamptz NOT NULL DEFAULT now())`,
    `INSERT INTO baraat_config(id) VALUES(1) ON CONFLICT(id) DO NOTHING`,
    `CREATE TABLE IF NOT EXISTS social_posts (id uuid PRIMARY KEY,author_id uuid NOT NULL REFERENCES guests(id) ON DELETE CASCADE,caption text NOT NULL DEFAULT '',event_tag text,media_data text,status text NOT NULL DEFAULT 'published',created_at timestamptz NOT NULL DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS social_post_likes (post_id uuid REFERENCES social_posts(id) ON DELETE CASCADE,guest_id uuid REFERENCES guests(id) ON DELETE CASCADE,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(post_id,guest_id))`,
    `CREATE TABLE IF NOT EXISTS social_post_saves (post_id uuid REFERENCES social_posts(id) ON DELETE CASCADE,guest_id uuid REFERENCES guests(id) ON DELETE CASCADE,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(post_id,guest_id))`,
    `CREATE TABLE IF NOT EXISTS social_comments (id uuid PRIMARY KEY,post_id uuid NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,author_id uuid NOT NULL REFERENCES guests(id) ON DELETE CASCADE,body text NOT NULL,created_at timestamptz NOT NULL DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS social_stories (id uuid PRIMARY KEY,author_id uuid NOT NULL REFERENCES guests(id) ON DELETE CASCADE,media_data text,text_content text,event_tag text,status text NOT NULL DEFAULT 'published',expires_at timestamptz NOT NULL DEFAULT now()+interval '24 hours',created_at timestamptz NOT NULL DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS social_story_views (story_id uuid REFERENCES social_stories(id) ON DELETE CASCADE,viewer_id uuid REFERENCES guests(id) ON DELETE CASCADE,viewed_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(story_id,viewer_id))`,
    `CREATE INDEX IF NOT EXISTS social_posts_feed_idx ON social_posts(status,created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS social_stories_feed_idx ON social_stories(status,expires_at,created_at DESC)`,
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

function weddingAnswer(input: string) {
  const q = input.trim().toLowerCase().replace(/^\/ask\s*/, '')
  if (!q || q === '/ask') return 'Ask me about the wedding date, venue, schedule, RSVP, privacy or Baraat tracking Ji.'
  if (/^(hi|hello|hey|namaste)\b/.test(q)) return 'Namaste Ji. Main wedding dates, venue, RSVP aur Baraat tracking mein help kar sakta hoon.'
  if (/when|date|wedding day|shaadi kab/.test(q)) return 'Celebrations 12–16 February 2027 ko Ghaziabad mein hain Ji. Wedding Tuesday, 16 February ko hai; time abhi to be confirmed hai.'
  if (/venue|where|location|address|reach|direction/.test(q)) return 'Wedding venue Emerald Green, Govindpuram, Ghaziabad hai Ji. Baaki event venues abhi to be confirmed hain.'
  if (/rsvp|attend|coming/.test(q)) return 'RSVP website ke private wedding home mein login karke update kijiye Ji. Har household member aur event ka response save ho sakta hai.'
  if (/baraat|track|live/.test(q)) return 'Baraat tab authorised tracker ki live GPS position dikhata hai. Sharing band hote hi exact location unavailable ho jaati hai Ji.'
  if (/sagai/.test(q)) return 'Sagai 12 February 2027 ko planned hai; time aur venue abhi to be confirmed hain Ji.'
  if (/haldi/.test(q)) return 'Haldi 14 February 2027 ko planned hai; time aur venue abhi to be confirmed hain Ji.'
  if (/mehndi/.test(q)) return 'Mehndi 15 February 2027 ko planned hai; time aur venue abhi to be confirmed hain Ji.'
  if (/privacy|phone|number|data/.test(q)) return 'Guest phone numbers private rehte hain. Verified profile se data export ya deletion request ki ja sakti hai Ji.'
  return 'Is baat ka confirmed answer abhi available nahi hai Ji. Main guess nahi karunga; family desk se confirmation lijiye.'
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
  await telegram('sendMessage', { chat_id: chatId, text: weddingAnswer(String(message.text || '')) })
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
  if (path === 'manager' && req.method === 'GET') {
    const section = String(req.query.section || '')
    const allowed = ['requests','vendors','budget','seating','travel','content']
    if (!allowed.includes(section)) return json(res, 400, { error: 'invalid_section' })
    const rows = await sql`SELECT id,section,title,details,status,notes,created_at,updated_at FROM manager_records WHERE section=${section} ORDER BY created_at DESC LIMIT 500`
    return json(res, 200, { records: rows })
  }
  if (path === 'manager' && req.method === 'POST') {
    const section = String(req.body?.section || '')
    const title = String(req.body?.title || '').trim().slice(0, 160)
    const details = String(req.body?.details || '').trim().slice(0, 2000)
    const allowed = ['requests','vendors','budget','seating','travel','content']
    if (!allowed.includes(section) || !title) return json(res, 400, { error: 'valid_record_required' })
    const id = crypto.randomUUID()
    const rows = await sql`INSERT INTO manager_records(id,section,title,details,created_by) VALUES(${id},${section},${title},${details},${actor.id}) RETURNING id,section,title,details,status,notes,created_at,updated_at`
    await sql`INSERT INTO audit_log(id,actor_id,action,entity_type,entity_id,facts) VALUES(${crypto.randomUUID()},${actor.id},'manager_record.created','manager_record',${id},${JSON.stringify({section})}::jsonb)`
    return json(res, 201, { record: rows[0] })
  }
  if (path === 'manager' && req.method === 'PATCH') {
    const id = String(req.body?.id || '')
    const status = String(req.body?.status || '').trim().slice(0, 80)
    const notes = String(req.body?.notes || '').trim().slice(0, 4000)
    if (!/^[0-9a-f-]{36}$/.test(id) || !status) return json(res, 400, { error: 'valid_update_required' })
    const rows = await sql`UPDATE manager_records SET status=${status},notes=${notes},updated_at=now() WHERE id=${id} RETURNING id,section,title,details,status,notes,created_at,updated_at`
    if (!rows[0]) return json(res, 404, { error: 'record_not_found' })
    return json(res, 200, { record: rows[0] })
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

async function handleSocial(req:VercelRequest,res:VercelResponse,action:string){
  if(!sql)return json(res,503,{error:'database_missing'});const actor=await currentGuest(req);if(!actor)return json(res,401,{error:'verified_session_required'})
  if(action==='feed'&&req.method==='GET'){
    const rows=await sql`SELECT p.id,p.author_id,p.caption,p.event_tag,p.media_data,p.created_at,g.display_name,g.side,(SELECT count(*)::int FROM social_post_likes l WHERE l.post_id=p.id) like_count,(SELECT count(*)::int FROM social_comments c WHERE c.post_id=p.id) comment_count,EXISTS(SELECT 1 FROM social_post_likes l WHERE l.post_id=p.id AND l.guest_id=${actor.id}) liked,EXISTS(SELECT 1 FROM social_post_saves s WHERE s.post_id=p.id AND s.guest_id=${actor.id}) saved FROM social_posts p JOIN guests g ON g.id=p.author_id WHERE p.status='published' OR p.author_id=${actor.id} ORDER BY p.created_at DESC LIMIT 100`
    return json(res,200,{posts:rows.map(row=>({...row,media:row.media_data?[{id:`media-${row.id}`,media_type:'image',storage_key:row.media_data}]:[]}))})
  }
  if(action==='stories'&&req.method==='GET'){
    const rows=await sql`SELECT s.id,s.author_id,s.media_data,s.text_content,s.event_tag,s.created_at,g.display_name,g.side,EXISTS(SELECT 1 FROM social_story_views v WHERE v.story_id=s.id AND v.viewer_id=${actor.id}) viewed FROM social_stories s JOIN guests g ON g.id=s.author_id WHERE s.status='published' AND s.expires_at>now() ORDER BY s.created_at DESC LIMIT 100`
    return json(res,200,{stories:rows.map(row=>({...row,media_type:row.media_data?'image':'text',storage_key:row.media_data}))})
  }
  if(action==='post'&&req.method==='POST'){
    const caption=String(req.body?.caption||'').trim().slice(0,2200),media=String(req.body?.mediaData||'');if(!caption&&!media)return json(res,400,{error:'content_required'});if(media&&(!media.startsWith('data:image/webp;base64,')||media.length>3_000_000))return json(res,400,{error:'invalid_media'});const id=crypto.randomUUID();const status=actor.role==='admin'?'published':'published';await sql`INSERT INTO social_posts(id,author_id,caption,event_tag,media_data,status) VALUES(${id},${actor.id},${caption},${String(req.body?.eventTag||'Wedding').slice(0,80)},${media||null},${status})`;return json(res,201,{id,status})
  }
  if(action==='story'&&req.method==='POST'){
    const text=String(req.body?.text||'').trim().slice(0,500),media=String(req.body?.mediaData||'');if(!text&&!media)return json(res,400,{error:'content_required'});if(media&&(!media.startsWith('data:image/webp;base64,')||media.length>3_000_000))return json(res,400,{error:'invalid_media'});const id=crypto.randomUUID();await sql`INSERT INTO social_stories(id,author_id,media_data,text_content,event_tag) VALUES(${id},${actor.id},${media||null},${text},${String(req.body?.eventTag||'Wedding').slice(0,80)})`;return json(res,201,{id,status:'published'})
  }
  if(action==='like'&&['PUT','DELETE'].includes(String(req.method))){const id=String(req.query.id||'');if(req.method==='PUT')await sql`INSERT INTO social_post_likes(post_id,guest_id) VALUES(${id},${actor.id}) ON CONFLICT DO NOTHING`;else await sql`DELETE FROM social_post_likes WHERE post_id=${id} AND guest_id=${actor.id}`;return json(res,200,{status:req.method==='PUT'?'liked':'unliked'})}
  if(action==='save'&&['PUT','DELETE'].includes(String(req.method))){const id=String(req.query.id||'');if(req.method==='PUT')await sql`INSERT INTO social_post_saves(post_id,guest_id) VALUES(${id},${actor.id}) ON CONFLICT DO NOTHING`;else await sql`DELETE FROM social_post_saves WHERE post_id=${id} AND guest_id=${actor.id}`;return json(res,200,{status:req.method==='PUT'?'saved':'unsaved'})}
  if(action==='comments'){
    const id=String(req.query.id||'');if(req.method==='GET'){const rows=await sql`SELECT c.id,c.body,c.created_at,g.display_name FROM social_comments c JOIN guests g ON g.id=c.author_id WHERE c.post_id=${id} ORDER BY c.created_at LIMIT 200`;return json(res,200,{comments:rows})}if(req.method==='POST'){const body=String(req.body?.body||'').trim().slice(0,500);if(!body||/https?:\/\//i.test(body))return json(res,400,{error:'valid_comment_required'});const commentId=crypto.randomUUID();await sql`INSERT INTO social_comments(id,post_id,author_id,body) VALUES(${commentId},${id},${actor.id},${body})`;return json(res,201,{comment:{id:commentId,body,display_name:actor.display_name,created_at:new Date().toISOString()}})}
  }
  if(action==='view'&&req.method==='PUT'){const id=String(req.query.id||'');await sql`INSERT INTO social_story_views(story_id,viewer_id) VALUES(${id},${actor.id}) ON CONFLICT DO NOTHING`;return json(res,200,{status:'viewed'})}
  if(action==='profile'&&req.method==='GET'){const id=String(req.query.id||actor.id);const rows=await sql`SELECT id,display_name,side,relation,role,created_at FROM guests WHERE id=${id}`;if(!rows[0])return json(res,404,{error:'profile_not_found'});const counts=await sql`SELECT (SELECT count(*)::int FROM social_posts WHERE author_id=${id} AND status='published') posts,(SELECT count(*)::int FROM social_stories WHERE author_id=${id}) stories`;return json(res,200,{profile:{...rows[0],...counts[0]}})}
  return json(res,404,{error:'social_route_not_found'})
}

async function handleBaraat(req: VercelRequest, res: VercelResponse, path: string) {
  if (!sql) return json(res, 503, { error: 'database_missing' })
  if (path === 'baraat/ingest' && req.method === 'POST') {
    const token=String(req.query.token||'')
    const configs=await sql`SELECT * FROM baraat_config WHERE id=1`
    const config=configs[0]
    if(!config?.share_enabled||!token||!config.webhook_token_hash||!equal(digest('tracker',token),String(config.webhook_token_hash)))return json(res,401,{error:'tracker_token_required'})
    const p=req.body||{};const lat=Number(p.lat??p.latitude),lng=Number(p.lon??p.longitude),accuracy=Number(p.acc??p.accuracy??50),battery=p.batt===undefined?null:Number(p.batt),speed=p.vel===undefined&&p.speed===undefined?null:Number(p.vel??p.speed),heading=p.cog===undefined&&p.heading===undefined?null:Number(p.cog??p.heading)
    if((p._type&&p._type!=='location')||!Number.isFinite(lat)||Math.abs(lat)>90||!Number.isFinite(lng)||Math.abs(lng)>180||!Number.isFinite(accuracy)||accuracy<0||accuracy>5000)return json(res,400,{error:'valid_location_required'})
    let sessions=await sql`SELECT * FROM baraat_sessions WHERE state='live' AND expires_at>now() ORDER BY created_at DESC LIMIT 1`
    if(!sessions[0]){const id=crypto.randomUUID();await sql`INSERT INTO baraat_sessions(id,label,state,tracker_id,expires_at) VALUES(${id},'Wedding Baraat','live',${config.updated_by},now()+interval '12 hours')`;sessions=await sql`SELECT * FROM baraat_sessions WHERE id=${id}`}
    const seqRows=await sql`SELECT COALESCE(MAX(sequence),0)+1 sequence FROM baraat_points WHERE session_id=${sessions[0].id}`;const sequence=Number(seqRows[0].sequence);const recordedAt=Number.isFinite(Number(p.tst))?new Date(Number(p.tst)*1000).toISOString():new Date().toISOString()
    await sql`INSERT INTO baraat_points(session_id,sequence,latitude,longitude,accuracy_m,speed_mps,heading,battery_percent,signal_state,recorded_at) VALUES(${sessions[0].id},${sequence},${lat},${lng},${accuracy},${speed},${heading},${battery},'good',${recordedAt})`
    return json(res,202,{status:'received',sequence})
  }
  const actor = await currentGuest(req)
  if (!actor) return json(res, 401, { error: 'verified_session_required' })
  if(path==='baraat/settings'){
    if(actor.role!=='admin')return json(res,403,{error:'admin_required'})
    if(req.method==='GET'){const rows=await sql`SELECT start_lat,start_lng,destination_lat,destination_lng,destination_label,geofence_m,share_enabled,updated_at,(webhook_token_hash IS NOT NULL) token_ready FROM baraat_config WHERE id=1`;return json(res,200,{settings:rows[0]})}
    if(req.method==='PUT'){
      const b=req.body||{};const values=[b.startLat,b.startLng,b.destinationLat,b.destinationLng].map(v=>v===''||v===null?null:Number(v));if(values.some((v,i)=>v!==null&&(!Number.isFinite(v)||(i%2===0?Math.abs(v)>90:Math.abs(v)>180))))return json(res,400,{error:'invalid_coordinates'})
      const geofence=Math.max(100,Math.min(5000,Number(b.geofenceM)||500));const label=String(b.destinationLabel||'Wedding venue').trim().slice(0,100)||'Wedding venue'
      await sql`UPDATE baraat_config SET start_lat=${values[0]},start_lng=${values[1]},destination_lat=${values[2]},destination_lng=${values[3]},destination_label=${label},geofence_m=${geofence},share_enabled=${Boolean(b.shareEnabled)},updated_by=${actor.id},updated_at=now() WHERE id=1`
      return json(res,200,{status:'saved'})
    }
  }
  if(path==='baraat/rotate'&&req.method==='POST'){
    if(actor.role!=='admin')return json(res,403,{error:'admin_required'})
    const token=crypto.randomBytes(32).toString('base64url');await sql`UPDATE baraat_config SET webhook_token_hash=${digest('tracker',token)},updated_by=${actor.id},updated_at=now() WHERE id=1`
    const host=String(req.headers['x-forwarded-host']||req.headers.host||'haarsh-black.vercel.app');return json(res,200,{webhookUrl:`https://${host}/api/baraat?action=ingest&token=${encodeURIComponent(token)}`})
  }
  if (path === 'baraat/live' && req.method === 'GET') {
    const sessions = await sql`SELECT * FROM baraat_sessions WHERE state='live' AND expires_at>now() ORDER BY created_at DESC LIMIT 1`
    const configs=await sql`SELECT start_lat,start_lng,destination_lat,destination_lng,destination_label,geofence_m FROM baraat_config WHERE id=1`;const config=configs[0]||{}
    if (!sessions[0]) return json(res, 200, { session:null,point:null,route:[],destination:config,eta:null,distanceKm:null,arriving:false })
    const points = await sql`SELECT * FROM baraat_points WHERE session_id=${sessions[0].id} ORDER BY sequence DESC LIMIT 100`;const latest=points[0]
    const point = latest ? {...latest,stale:Date.now()-new Date(String(latest.recorded_at)).getTime()>120000,ageSeconds:Math.max(0,Math.round((Date.now()-new Date(String(latest.recorded_at)).getTime())/1000))} : null
    const radians=(v:number)=>v*Math.PI/180;let distanceKm:null|number=null;if(point&&config.destination_lat!==null&&config.destination_lng!==null){const dLat=radians(Number(config.destination_lat)-Number(point.latitude)),dLng=radians(Number(config.destination_lng)-Number(point.longitude)),a=Math.sin(dLat/2)**2+Math.cos(radians(Number(point.latitude)))*Math.cos(radians(Number(config.destination_lat)))*Math.sin(dLng/2)**2;distanceKm=6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))}const eta=distanceKm!==null&&Number(point?.speed_mps)>0.5?`${Math.max(1,Math.round(distanceKm*1000/Number(point.speed_mps)/60))} min`:null
    return json(res, 200, { session:{id:sessions[0].id,label:sessions[0].label,state:sessions[0].state,expiresAt:sessions[0].expires_at},point,route:points.reverse().map(row=>({latitude:row.latitude,longitude:row.longitude,recorded_at:row.recorded_at})),destination:config,eta,distanceKm:distanceKm===null?null:Number(distanceKm.toFixed(2)),arriving:distanceKm!==null&&distanceKm*1000<=Number(config.geofence_m) })
  }
  if (path === 'baraat/mine' && req.method === 'GET') {
    let sessions = await sql`SELECT * FROM baraat_sessions WHERE tracker_id=${actor.id} AND expires_at>now() ORDER BY created_at DESC LIMIT 1`
    if (!sessions[0] && actor.role === 'admin') {
      const id=crypto.randomUUID();await sql`INSERT INTO baraat_sessions(id,label,tracker_id,expires_at) VALUES(${id},'Wedding Baraat',${actor.id},now()+interval '12 hours')`;sessions=await sql`SELECT * FROM baraat_sessions WHERE id=${id}`
    }
    return json(res, 200, { session:sessions[0]||null })
  }
  const action=path.match(/^baraat\/sessions\/([0-9a-f-]+)\/(start|stop|points)$/)
  if (action) {
    const owned=await sql`SELECT * FROM baraat_sessions WHERE id=${action[1]} AND tracker_id=${actor.id} AND expires_at>now()`
    if (!owned[0]) return json(res,403,{error:'tracker_required'})
    if (action[2]==='start'&&req.method==='POST'){await sql`UPDATE baraat_sessions SET state='live' WHERE id=${action[1]}`;return json(res,200,{status:'live'})}
    if (action[2]==='stop'&&req.method==='POST'){await sql`UPDATE baraat_sessions SET state='stopped' WHERE id=${action[1]}`;return json(res,200,{status:'stopped'})}
    if (action[2]==='points'&&req.method==='POST'){
      const p=req.body||{};if(!Number.isFinite(p.latitude)||!Number.isFinite(p.longitude)||!Number.isFinite(p.accuracyM))return json(res,400,{error:'valid_point_required'})
      await sql`INSERT INTO baraat_points(session_id,sequence,latitude,longitude,accuracy_m,speed_mps,heading,battery_percent,signal_state,recorded_at) VALUES(${action[1]},${Number(p.sequence)},${p.latitude},${p.longitude},${p.accuracyM},${p.speedMps??null},${p.heading??null},${p.batteryPercent??null},${String(p.signalState||'unknown')},${String(p.recordedAt||new Date().toISOString())}) ON CONFLICT DO NOTHING`
      return json(res,201,{status:'recorded'})
    }
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
    if (path === 'planning/rsvp' && req.method === 'PUT') {
      const guest = await currentGuest(req)
      if (!guest) return json(res, 401, { error: 'verified_session_required' })
      const responses = req.body?.responses
      if (!Array.isArray(responses) || !responses.length) return json(res, 400, { error: 'responses_required' })
      await sql`INSERT INTO rsvps(guest_id,responses,updated_at) VALUES(${guest.id},${JSON.stringify(responses)}::jsonb,now()) ON CONFLICT(guest_id) DO UPDATE SET responses=excluded.responses,updated_at=now()`
      await sql`INSERT INTO audit_log(id,actor_id,action,entity_type,entity_id,facts) VALUES(${crypto.randomUUID()},${guest.id},'rsvp.updated','rsvp',${guest.id},${JSON.stringify({ count: responses.length })}::jsonb)`
      return json(res, 200, { status: 'saved' })
    }
    if (path === 'planning/rsvp' && req.method === 'GET') {
      const guest = await currentGuest(req)
      if (!guest) return json(res, 401, { error: 'verified_session_required' })
      const rows = await sql`SELECT responses,updated_at FROM rsvps WHERE guest_id=${guest.id}`
      return json(res, 200, { responses: rows[0]?.responses || [], updatedAt: rows[0]?.updated_at || null })
    }
    if (path === 'telegram/webhook' && req.method === 'POST') return await handleTelegram(req, res)
    if(path==='social')return await handleSocial(req,res,String(req.query.action||'feed'))
    if (path === 'manager' || path.startsWith('manager/')) {
      const managed = await handleManager(req, res, path)
      if (managed !== false) return managed
    }
    if (path === 'baraat') {
      const action=String(req.query.action||'live')
      const id=String(req.query.id||'')
      const trackingPath=['live','mine','settings','rotate','ingest'].includes(action)?`baraat/${action}`:`baraat/sessions/${id}/${action}`
      const tracked=await handleBaraat(req,res,trackingPath)
      if(tracked!==false)return tracked
    }
    if (path.startsWith('baraat/')) { const tracked=await handleBaraat(req,res,path);if(tracked!==false)return tracked }
    const auth = await handleAuth(req, res, path)
    if (auth !== false) return auth
    return json(res, 404, { error: 'route_not_found' })
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'unknown_api_error')
    return json(res, 500, { error: 'service_temporarily_unavailable' })
  }
}
