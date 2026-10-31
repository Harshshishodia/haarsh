import express, { type NextFunction, type Request, type Response } from 'express'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import crypto from 'node:crypto'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from 'csv-parse/sync'
import { db, audit } from './db.js'
import { dispatchPending, enqueueMessage, messagingStatus, recordDelivered, recordInbound, sendTelegram } from './messaging.js'
import { socialRouter } from './social.js'
import { chatRouter } from './chat.js'
import { planningRouter } from './planning.js'
import { agentsRouter, runOperatorLoop } from './agents.js'
import { aiRouter } from './ai.js'
import { runWatchtower, watchtowerRouter } from './watchtower.js'
import { apiRateLimit, authRateLimit, hardeningRouter, requestContext, sameOrigin } from './hardening.js'
import { baraatRouter, ingestExternalLocation } from './baraat.js'
import { galleryRouter } from './gallery.js'
import { operationsRouter } from './operations.js'
import { teardownRouter } from './teardown.js'
import { handleTelegramUpdate } from './telegram.js'

const app = express()
const port = Number(process.env.PORT || 4173)
const production = process.env.NODE_ENV === 'production'
const phonePepper = process.env.PHONE_HASH_PEPPER || 'local-development-only-change-me'
const telegramUsername = process.env.TELEGRAM_BOT_USERNAME || ''
const challengeAttempts = new Map<string, { count: number, resetAt: number }>()

app.disable('x-powered-by')
app.set('trust proxy',1)
app.use(helmet({ referrerPolicy:{policy:'no-referrer'},crossOriginResourcePolicy:{policy:'same-site'},contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], baseUri:["'none'"], objectSrc:["'none'"], frameAncestors:["'none'"], formAction:["'self'"], styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'], fontSrc: ["'self'", 'https://fonts.gstatic.com'], imgSrc: ["'self'", 'data:', 'blob:'], connectSrc: ["'self'"] } } }))
app.use(requestContext)
app.use(express.json({ limit: '256kb', verify:(req, _res, buffer) => { (req as Request & {rawBody?:Buffer}).rawBody = Buffer.from(buffer) } }))
app.use(cookieParser())
app.use('/api',apiRateLimit)
app.use('/api/auth',authRateLimit)
app.use(sameOrigin)

const hashPhone = (phone: string) => crypto.createHmac('sha256', phonePepper).update(phone.replace(/\s/g, '')).digest('hex')
const hashCode = (code: string) => crypto.createHmac('sha256', phonePepper).update(`challenge:${code}`).digest('hex')
const safeGuest = (row: Record<string, unknown>) => ({ id: row.id, displayName: row.display_name, side: row.side, relation: row.relation, role: row.role, householdName: row.household_name, preferredLanguage: row.preferred_language, invitedEvents: JSON.parse(String(row.invited_events || '[]')) })
type AuthedRequest = Request & { user?: Record<string, unknown> }

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const sessionId = req.cookies.vd_session
  const user = sessionId ? db.prepare(`SELECT g.* FROM sessions s JOIN guests g ON g.id=s.guest_id WHERE s.id=? AND s.expires_at > datetime('now')`).get(sessionId) as Record<string, unknown> | undefined : undefined
  if (!user) return res.status(401).json({ error: 'verified_session_required' })
  req.user = user; next()
}
function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'admin_required' })
  next()
}
function withinChallengeLimit(key: string) {
  const now = Date.now(); const current = challengeAttempts.get(key)
  if (!current || current.resetAt < now) { challengeAttempts.set(key, { count: 1, resetAt: now + 15 * 60_000 }); return true }
  if (current.count >= 5) return false
  current.count += 1; return true
}
function createSession(res: Response, guest: Record<string, unknown>) {
  const sessionId = crypto.randomBytes(32).toString('hex'); const expires = new Date(Date.now() + 30 * 86400000)
  db.prepare('INSERT INTO sessions (id, guest_id, expires_at) VALUES (?, ?, ?)').run(sessionId, String(guest.id), expires.toISOString())
  res.cookie('vd_session', sessionId, { httpOnly: true, secure: production, sameSite: 'lax', expires, path: '/' })
  return safeGuest(guest)
}

app.get('/api/health', (_req, res) => {
  const check = db.prepare('PRAGMA quick_check').get() as {quick_check:string}
  const status = check.quick_check === 'ok' ? 'ok' : 'degraded'
  db.prepare("INSERT INTO system_health(component,state,facts) VALUES('database',?,?) ON CONFLICT(component) DO UPDATE SET state=excluded.state,facts=excluded.facts,checked_at=CURRENT_TIMESTAMP").run(status, JSON.stringify({quickCheck:check.quick_check}))
  res.status(status === 'ok' ? 200 : 503).json({ status, service: 'vd-wedding-concierge', database: check.quick_check, time: new Date().toISOString() })
})
app.get('/api/config', (_req, res) => res.json({ wedding: 'Vaishnavi & Dhruv', timezone: 'Asia/Kolkata', messaging: 'disabled_until_verified', payments: 'records_only' }))
app.get('/api/feature-flags', (_req, res) => {
  const rows = db.prepare('SELECT key, enabled FROM feature_flags').all() as {key:string,enabled:number}[]
  res.json({ flags: Object.fromEntries(rows.map(row => [row.key, Boolean(row.enabled)])) })
})
app.get('/api/calendar.ics', (_req, res) => {
  const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//VD Wedding Concierge//EN','CALSCALE:GREGORIAN',
    ['Sagai','20270212'],['Haldi','20270214'],['Mehndi','20270215'],['Wedding','20270216']
  ].flatMap(item => Array.isArray(item) ? ['BEGIN:VEVENT',`UID:${item[0].toLowerCase()}@vd-wedding`,`DTSTART;VALUE=DATE:${item[1]}`,`DTEND;VALUE=DATE:${String(Number(item[1])+1)}`,`SUMMARY:${item[0]} · Vaishnavi & Dhruv`,'DESCRIPTION:Time and venue may still be confirmed by the family.','END:VEVENT'] : [item])
  lines.push('END:VCALENDAR')
  res.type('text/calendar').attachment('vaishnavi-dhruv-wedding.ics').send(lines.join('\r\n'))
})

app.post('/api/auth/demo', (req, res) => {
  if (production && process.env.ALLOW_DEMO_AUTH !== 'true') return res.status(404).json({ error: 'not_available' })
  const { phone = '+919999000001', name = 'Rohan Sharma', role = 'guest' } = req.body || {}
  const normalized = String(phone).replace(/\s/g, '')
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) return res.status(400).json({ error: 'invalid_e164_phone' })
  const phoneHash = hashPhone(normalized)
  let guest = db.prepare('SELECT * FROM guests WHERE phone_hash=?').get(phoneHash) as Record<string, unknown> | undefined
  if (!guest) {
    const id = crypto.randomUUID()
    db.prepare(`INSERT INTO guests (id, phone_hash, display_name, side, relation, role, household_name, invited_events) VALUES (?, ?, ?, 'groom', 'family friend', ?, ?, ?)`)
      .run(id, phoneHash, String(name), role === 'admin' ? 'admin' : 'guest', `${name} family`, JSON.stringify(['Sagai','Wedding']))
    guest = db.prepare('SELECT * FROM guests WHERE id=?').get(id) as Record<string, unknown>
    audit(id, 'demo_guest_created', 'guest', id)
  }
  res.json({ user: createSession(res, guest) })
})

app.post('/api/auth/challenges', async (req, res) => {
  const { phone, consent } = req.body || {}; const normalized = String(phone || '').replace(/[\s()-]/g, '')
  if (consent !== true) return res.status(400).json({ error: 'consent_required' })
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) return res.status(400).json({ error: 'invalid_e164_phone' })
  const phoneHash = hashPhone(normalized); const ipKey = `ip:${req.ip}`; const phoneKey = `phone:${phoneHash}`
  if (!withinChallengeLimit(ipKey) || !withinChallengeLimit(phoneKey)) return res.status(429).json({ error: 'try_again_later' })
  db.prepare("UPDATE auth_challenges SET status='expired' WHERE phone_hash=? AND status IN ('pending','otp_sent')").run(phoneHash)
  const id = crypto.randomUUID(); const code = crypto.randomBytes(5).toString('hex').toUpperCase(); const expires = new Date(Date.now() + 10 * 60_000)
  const linked=db.prepare("SELECT a.telegram_chat_id FROM auth_challenges a JOIN guests g ON g.phone_hash=a.phone_hash WHERE a.phone_hash=? AND a.telegram_chat_id IS NOT NULL AND a.status IN ('verified','exchanged') ORDER BY a.created_at DESC LIMIT 1").get(phoneHash) as {telegram_chat_id:string}|undefined
  db.prepare('INSERT INTO auth_challenges (id, phone_hash, code_hash, channel, status, telegram_chat_id, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, phoneHash, hashCode(code), 'telegram', linked?'otp_sent':'pending', linked?.telegram_chat_id||null, expires.toISOString())
  if(linked){try{await sendTelegram(linked.telegram_chat_id,`Your V&D Wedding one-time code is ${code}. It expires in 10 minutes. Do not share it.`);return res.status(201).json({challengeId:id,mode:'telegram_otp',channel:'telegram',expiresAt:expires.toISOString()})}catch{db.prepare("UPDATE auth_challenges SET status='pending',telegram_chat_id=NULL WHERE id=?").run(id)}}
  const telegramUrl = telegramUsername ? `https://t.me/${telegramUsername}?start=${code}` : null
  res.status(201).json({ challengeId: id, code, mode:'contact_proof', channel: 'telegram', telegramUrl, expiresAt: expires.toISOString(), telegramSetupRequired: !telegramUsername })
})
app.get('/api/auth/challenges/:id', (req, res) => {
  const row = db.prepare('SELECT status, expires_at FROM auth_challenges WHERE id=?').get(req.params.id) as {status:string,expires_at:string}|undefined
  if (!row) return res.status(404).json({ error: 'challenge_not_found' })
  const expired = new Date(row.expires_at).getTime() <= Date.now()
  if (expired && row.status === 'pending') db.prepare("UPDATE auth_challenges SET status='expired' WHERE id=?").run(req.params.id)
  res.json({ status: expired ? 'expired' : row.status })
})
app.post('/api/auth/exchange', (req, res) => {
  const { challengeId, code, displayName = 'Wedding guest', side = 'shared', relation = 'guest' } = req.body || {}
  const row = db.prepare('SELECT * FROM auth_challenges WHERE id=?').get(String(challengeId)) as Record<string,unknown>|undefined
  if (!row || !['verified','otp_sent'].includes(String(row.status)) || Number(row.attempts)>=5 || new Date(String(row.expires_at)).getTime() <= Date.now() || !code || hashCode(String(code).toUpperCase()) !== row.code_hash){if(row)db.prepare('UPDATE auth_challenges SET attempts=attempts+1 WHERE id=?').run(String(challengeId));return res.status(401).json({ error: 'ownership_proof_required' })}
  let guest = db.prepare('SELECT * FROM guests WHERE phone_hash=?').get(String(row.phone_hash)) as Record<string,unknown>|undefined
  if (!guest) {
    const id = crypto.randomUUID(); const safeSide = ['bride','groom','shared'].includes(side) ? side : 'shared'
    db.prepare('INSERT INTO guests (id, phone_hash, display_name, side, relation, role, household_name, invited_events) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(id, String(row.phone_hash), String(displayName).slice(0,100), safeSide, String(relation).slice(0,80), 'guest', `${String(displayName).slice(0,80)} household`, '[]')
    guest = db.prepare('SELECT * FROM guests WHERE id=?').get(id) as Record<string,unknown>
    audit(id, 'verified_new_guest_created', 'guest', id)
  }
  db.prepare("UPDATE auth_challenges SET status='exchanged' WHERE id=?").run(String(challengeId))
  res.json({ user: createSession(res, guest), isNewGuest: guest.invited_events === '[]' })
})

app.get('/api/me', requireAuth, (req: AuthedRequest, res) => res.json({ user: safeGuest(req.user!) }))
app.get('/api/me/export', requireAuth, (req: AuthedRequest, res) => {
  const rsvp = db.prepare('SELECT answers, attendee_count, diet, notes, updated_at FROM rsvps WHERE guest_id=?').get(String(req.user!.id))
  const requests = db.prepare('SELECT category, message, status, owner, created_at, updated_at FROM help_requests WHERE guest_id=?').all(String(req.user!.id))
  res.attachment('my-vd-wedding-data.json').json({ exportedAt: new Date().toISOString(), profile: safeGuest(req.user!), rsvp, requests })
})
app.delete('/api/me', requireAuth, (req: AuthedRequest, res) => {
  const id = String(req.user!.id)
  audit(id, 'guest_data_deletion_requested', 'guest', id)
  db.prepare('DELETE FROM guests WHERE id=?').run(id)
  res.clearCookie('vd_session'); res.status(204).end()
})
app.delete('/api/session', requireAuth, (req: AuthedRequest, res) => { db.prepare('DELETE FROM sessions WHERE id=?').run(req.cookies.vd_session); res.clearCookie('vd_session'); res.status(204).end() })
app.get('/api/rsvp', requireAuth, (req: AuthedRequest, res) => {
  const row = db.prepare('SELECT * FROM rsvps WHERE guest_id=?').get(String(req.user!.id)) as Record<string, unknown> | undefined
  res.json(row ? { answers: JSON.parse(String(row.answers)), attendeeCount: row.attendee_count, diet: row.diet, notes: row.notes, updatedAt: row.updated_at } : null)
})
app.put('/api/rsvp', requireAuth, (req: AuthedRequest, res) => {
  const { answers, attendeeCount, diet, notes = '' } = req.body || {}
  if (!answers || !Number.isInteger(attendeeCount) || attendeeCount < 0 || attendeeCount > 20 || !['Vegetarian','Jain','No onion or garlic','Other'].includes(diet)) return res.status(400).json({ error: 'invalid_rsvp' })
  db.prepare(`INSERT INTO rsvps (guest_id, answers, attendee_count, diet, notes) VALUES (?, ?, ?, ?, ?) ON CONFLICT(guest_id) DO UPDATE SET answers=excluded.answers, attendee_count=excluded.attendee_count, diet=excluded.diet, notes=excluded.notes, updated_at=CURRENT_TIMESTAMP`).run(String(req.user!.id), JSON.stringify(answers), attendeeCount, String(diet), String(notes).slice(0, 1000))
  audit(String(req.user!.id), 'rsvp_updated', 'rsvp', String(req.user!.id)); res.json({ saved: true })
})
app.post('/api/help-requests', requireAuth, (req: AuthedRequest, res) => {
  const { category = 'general', message } = req.body || {}
  if (!message || String(message).trim().length < 3) return res.status(400).json({ error: 'message_required' })
  const id = crypto.randomUUID()
  db.prepare('INSERT INTO help_requests (id, guest_id, category, message) VALUES (?, ?, ?, ?)').run(id, String(req.user!.id), String(category).slice(0,50), String(message).trim().slice(0,1500))
  audit(String(req.user!.id), 'help_request_created', 'help_request', id); res.status(201).json({ id, status: 'received' })
})
app.get('/api/admin/summary', requireAuth, requireAdmin, (_req, res) => {
  const guests = db.prepare('SELECT COUNT(*) AS count FROM guests').get() as {count:number}
  const requests = db.prepare("SELECT COUNT(*) AS count FROM help_requests WHERE status != 'resolved'").get() as {count:number}
  const rsvps = db.prepare('SELECT COUNT(*) AS count, COALESCE(SUM(attendee_count),0) AS attendees FROM rsvps').get()
  res.json({ guests: guests.count, openRequests: requests.count, rsvps })
})
app.put('/api/admin/feature-flags/:key', requireAuth, requireAdmin, (req: AuthedRequest, res) => {
  const { enabled } = req.body || {}; if (typeof enabled !== 'boolean') return res.status(400).json({error:'enabled_boolean_required'})
  const flagKey=String(req.params.key)
  const result = db.prepare('UPDATE feature_flags SET enabled=?, updated_by=?, updated_at=CURRENT_TIMESTAMP WHERE key=?').run(Number(enabled), String(req.user!.id), flagKey)
  if (!result.changes) return res.status(404).json({error:'flag_not_found'})
  audit(String(req.user!.id), 'feature_flag_changed', 'feature_flag', flagKey, {enabled}); res.json({key:flagKey,enabled})
})
app.get('/api/admin/messaging/status', requireAuth, requireAdmin, (_req, res) => res.json(messagingStatus()))
app.put('/api/admin/messaging/controls/:key', requireAuth, requireAdmin, (req: AuthedRequest, res) => {
  const key=String(req.params.key); const {enabled}=req.body||{}
  if (typeof enabled !== 'boolean') return res.status(400).json({error:'enabled_boolean_required'})
  const result=db.prepare('UPDATE system_controls SET enabled=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE key=?').run(Number(enabled),String(req.user!.id),key)
  if (!result.changes) return res.status(404).json({error:'control_not_found'})
  audit(String(req.user!.id),'messaging_control_changed','system_control',key,{enabled}); res.json({key,enabled})
})
app.put('/api/admin/messaging/budget/whatsapp', requireAuth, requireAdmin, (req: AuthedRequest, res) => {
  const {freeAllowance,verifiedFree}=req.body||{}
  if (verifiedFree!==true||!Number.isInteger(freeAllowance)||freeAllowance<1||freeAllowance>100000) return res.status(400).json({error:'verified_free_allowance_required'})
  const period=new Date().toISOString().slice(0,7)
  db.prepare("INSERT INTO msg_budget(provider,period,free_allowance,delivered_count,mode) VALUES('whatsapp',?,?,0,'GREEN') ON CONFLICT(provider,period) DO UPDATE SET free_allowance=excluded.free_allowance,mode=CASE WHEN msg_budget.delivered_count < excluded.free_allowance*0.6 THEN 'GREEN' WHEN msg_budget.delivered_count < excluded.free_allowance*0.85 THEN 'AMBER' WHEN msg_budget.delivered_count < excluded.free_allowance THEN 'RED' ELSE 'BLACK' END,updated_at=CURRENT_TIMESTAMP").run(period,freeAllowance)
  audit(String(req.user!.id),'whatsapp_budget_verified','msg_budget',period,{freeAllowance}); res.json({provider:'whatsapp',period,freeAllowance})
})
app.post('/api/admin/messaging/enqueue', requireAuth, requireAdmin, (req: AuthedRequest, res) => {
  const {channel,recipientRef,messageType='admin_message',text,priority='P2',idempotencyKey}=req.body||{}
  if (!['telegram','ntfy','web','whatsapp'].includes(channel)||!recipientRef||!text||!['P0','P1','P2','P3'].includes(priority)||!idempotencyKey) return res.status(400).json({error:'invalid_message'})
  const result=enqueueMessage({channel,recipientRef:String(recipientRef),messageType:String(messageType),text:String(text),priority,idempotencyKey:String(idempotencyKey)},String(req.user!.id))
  res.status(result.queued?201:200).json(result)
})
app.post('/api/admin/messaging/dispatch', requireAuth, requireAdmin, async (_req, res) => res.json(await dispatchPending()))
app.get('/api/notifications', requireAuth, (req: AuthedRequest, res) => {
  const rows=db.prepare("SELECT id,message_type,payload,priority,created_at FROM outbox WHERE channel='web' AND recipient_ref=? AND status IN ('pending','pending_web') ORDER BY created_at DESC LIMIT 50").all(String(req.user!.id)) as Record<string,unknown>[]
  if (rows.length) db.prepare(`UPDATE outbox SET status='sent',sent_at=CURRENT_TIMESTAMP WHERE id IN (${rows.map(()=>'?').join(',')})`).run(...rows.map(row=>String(row.id)))
  res.json({notifications:rows.map(row=>({...row,payload:JSON.parse(String(row.payload))}))})
})
const guestHeaders = ['display_name','phone_e164','side','relation','role','household_name','preferred_language','invited_events']
function analyzeGuestRows(records: Record<string,string>[]) {
  const columns = records.length ? Object.keys(records[0]) : []
  if (guestHeaders.some(header => !columns.includes(header))) return {records:[],problems:[{line:1,reason:'invalid_guest_columns',expected:guestHeaders}]}
  const seen = new Set<string>(); const problems: object[]=[]
  records.forEach((record,index) => {
    const phone=record.phone_e164; const phoneHash=/^\+[1-9]\d{7,14}$/.test(phone||'') ? hashPhone(phone) : ''
    if (!record.display_name) problems.push({line:index+2,field:'display_name',reason:'required'})
    if (!phoneHash) problems.push({line:index+2,field:'phone_e164',reason:'invalid_e164'})
    else if (seen.has(phoneHash)) problems.push({line:index+2,field:'phone_e164',reason:'duplicate_in_file'})
    else if (db.prepare('SELECT 1 FROM guests WHERE phone_hash=?').get(phoneHash)) problems.push({line:index+2,field:'phone_e164',reason:'already_exists'})
    if (!['bride','groom','shared'].includes(record.side)) problems.push({line:index+2,field:'side',reason:'invalid_side'})
    seen.add(phoneHash)
  })
  return {records,problems}
}
function analyzeGuestCsv(text: string) {
  let records: Record<string,string>[]
  try { records = parse(text, {columns:true, skip_empty_lines:true, trim:true, bom:true}) as Record<string,string>[] } catch { return {records:[],problems:[{line:1,reason:'csv_parse_error'}]} }
  return analyzeGuestRows(records)
}
function applyGuestRows(records: Record<string,string>[]) {
  let imported = 0
  const insert = db.prepare('INSERT OR IGNORE INTO guests (id, phone_hash, display_name, side, relation, role, household_name, preferred_language, invited_events) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
  db.exec('BEGIN')
  try {
    records.forEach(record => {
      const result = insert.run(crypto.randomUUID(), hashPhone(record.phone_e164), record.display_name, record.side, record.relation, record.role || 'guest', record.household_name, record.preferred_language || 'Hinglish', JSON.stringify(record.invited_events.split('|').filter(Boolean)))
      imported += Number(result.changes)
    })
    db.exec('COMMIT')
  } catch (error) { db.exec('ROLLBACK'); throw error }
  return imported
}
async function fetchNocoGuestRows() {
  const baseUrl = process.env.NOCODB_BASE_URL
  const tableId = process.env.NOCODB_TABLE_ID
  const token = process.env.NOCODB_API_TOKEN
  if (!baseUrl || !tableId || !token) throw new Error('nocodb_not_configured')
  const origin = new URL(baseUrl)
  if (!['https:', ...(production ? [] : ['http:'])].includes(origin.protocol)) throw new Error('nocodb_invalid_url')
  const url = new URL(`/api/v2/tables/${encodeURIComponent(tableId)}/records`, origin)
  url.searchParams.set('limit', '1000')
  const response = await fetch(url, { headers: { 'xc-token': token, accept: 'application/json' }, signal: AbortSignal.timeout(10_000) })
  if (!response.ok) throw new Error(`nocodb_http_${response.status}`)
  const payload = await response.json() as { list?: Record<string,unknown>[] }
  if (!Array.isArray(payload.list)) throw new Error('nocodb_invalid_response')
  return payload.list.map(row => Object.fromEntries(guestHeaders.map(header => {
    const value = row[header]
    return [header, Array.isArray(value) ? value.join('|') : String(value ?? '').trim()]
  })))
}
app.post('/api/admin/import/guests/dry-run', express.text({ type: 'text/csv', limit: '2mb' }), requireAuth, requireAdmin, (req: AuthedRequest, res) => {
  if (typeof req.body !== 'string') return res.status(415).json({error:'csv_required'})
  const analysis=analyzeGuestCsv(req.body); const id=crypto.randomUUID(); const checksum=crypto.createHash('sha256').update(req.body).digest('hex')
  db.prepare("INSERT INTO data_imports(id,source,mode,status,row_count,problem_count,checksum,created_by) VALUES(?,'csv','dry_run','complete',?,?,?,?)").run(id,analysis.records.length,analysis.problems.length,checksum,String(req.user!.id))
  res.json({importId:id,rows:analysis.records.length,problemCount:analysis.problems.length,problems:analysis.problems})
})
app.post('/api/admin/import/guests', express.text({ type: 'text/csv', limit: '2mb' }), requireAuth, requireAdmin, (req: AuthedRequest, res) => {
  if (typeof req.body !== 'string') return res.status(415).json({ error: 'csv_required' })
  const analysis=analyzeGuestCsv(req.body); if (analysis.problems.length) return res.status(422).json({error:'dry_run_problems',problems:analysis.problems})
  const imported = applyGuestRows(analysis.records)
  const importId=crypto.randomUUID(); const checksum=crypto.createHash('sha256').update(req.body).digest('hex')
  db.prepare("INSERT INTO data_imports(id,source,mode,status,row_count,problem_count,checksum,created_by) VALUES(?,'csv','apply','complete',?,0,?,?)").run(importId,imported,checksum,String(req.user!.id))
  audit(String(req.user!.id), 'guest_csv_imported', 'guest', null, { imported, importId })
  res.json({ importId, imported, skipped: analysis.records.length-imported, problems: [] })
})
app.post('/api/admin/import/nocodb/dry-run', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  try {
    const records = await fetchNocoGuestRows(); const analysis = analyzeGuestRows(records)
    const checksum = crypto.createHash('sha256').update(JSON.stringify(records)).digest('hex'); const id = crypto.randomUUID()
    db.prepare("INSERT INTO data_imports(id,source,mode,status,row_count,problem_count,checksum,created_by) VALUES(?,'nocodb','dry_run','complete',?,?,?,?)").run(id, records.length, analysis.problems.length, checksum, String(req.user!.id))
    res.json({ importId:id, rows:records.length, problemCount:analysis.problems.length, problems:analysis.problems, checksum })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'nocodb_failed'
    res.status(message === 'nocodb_not_configured' ? 503 : 502).json({ error: message })
  }
})
app.post('/api/admin/import/nocodb', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  try {
    const records = await fetchNocoGuestRows(); const analysis = analyzeGuestRows(records)
    if (analysis.problems.length) return res.status(422).json({ error:'dry_run_problems', problems:analysis.problems })
    const imported = applyGuestRows(records); const checksum = crypto.createHash('sha256').update(JSON.stringify(records)).digest('hex'); const importId = crypto.randomUUID()
    db.prepare("INSERT INTO data_imports(id,source,mode,status,row_count,problem_count,checksum,created_by) VALUES(?,'nocodb','apply','complete',?,0,?,?)").run(importId, imported, checksum, String(req.user!.id))
    audit(String(req.user!.id), 'guest_nocodb_imported', 'guest', null, { imported, importId })
    res.json({ importId, imported, skipped:records.length-imported, problems:[] })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'nocodb_failed'
    res.status(message === 'nocodb_not_configured' ? 503 : 502).json({ error: message })
  }
})

app.post('/api/webhooks/telegram', async (req, res) => {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!expectedSecret) return res.status(503).json({ error: 'telegram_not_configured' })
  const supplied = req.header('x-telegram-bot-api-secret-token') || ''
  if (supplied.length !== expectedSecret.length || !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expectedSecret))) return res.status(401).json({ error: 'invalid_signature' })
  const externalId=String(req.body?.update_id ?? '')
  if (!externalId) return res.status(400).json({error:'update_id_required'})
  if (!recordInbound('telegram',externalId,'update',req.body)) return res.json({received:true,duplicate:true})
  res.json(await handleTelegramUpdate(req.body, { hashPhone, hashCode }))
})

app.post('/api/webhooks/whatsapp', (req: Request & {rawBody?:Buffer}, res) => {
  if (!process.env.WHATSAPP_WEBHOOK_SECRET) return res.status(503).json({ error: 'whatsapp_not_configured' })
  const signature = req.header('x-hub-signature-256') || ''
  const body = req.rawBody || Buffer.from(JSON.stringify(req.body))
  const expected = 'sha256=' + crypto.createHmac('sha256', process.env.WHATSAPP_WEBHOOK_SECRET).update(body).digest('hex')
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return res.status(401).json({ error: 'invalid_signature' })
  const value=req.body?.entry?.[0]?.changes?.[0]?.value; const status=value?.statuses?.[0]; const message=value?.messages?.[0]
  const eventType=status?.status?`status:${status.status}`:message?'message':'webhook'
  const baseId=String(message?.id || status?.id || crypto.createHash('sha256').update(body).digest('hex')); const externalId=`${baseId}:${eventType}`
  if (!recordInbound('whatsapp',externalId,eventType,req.body)) return res.json({received:true,duplicate:true})
  if (status?.status==='delivered') recordDelivered('whatsapp')
  let tracking:unknown=null
  if(message?.location){const waId=String(value?.contacts?.[0]?.wa_id||'').replace(/\D/g,'');const normalized=waId?`+${waId}`:'';const owner=normalized?db.prepare('SELECT id FROM guests WHERE phone_hash=?').get(hashPhone(normalized)) as {id:string}|undefined:undefined;tracking=owner?ingestExternalLocation(owner.id,'whatsapp',message.location,message.timestamp?new Date(Number(message.timestamp)*1000):new Date()):{accepted:false,reason:'whatsapp_identity_not_verified'}}
  res.status(202).json({ received: true, processing: message?.location?'location_ingested_if_session_live':'redirected_to_free_web_or_telegram',tracking })
})

app.use('/api/social',socialRouter(requireAuth,requireAdmin))
app.use('/api/chat',chatRouter(requireAuth,requireAdmin))
app.use('/api/planning',planningRouter(requireAuth,requireAdmin))
app.use('/api/agents',agentsRouter(requireAuth,requireAdmin))
app.use('/api/ai',aiRouter(requireAuth,requireAdmin))
app.use('/api/watchtower',watchtowerRouter(requireAuth,requireAdmin))
app.use('/api/hardening',hardeningRouter(requireAuth,requireAdmin))
app.use('/api/baraat',baraatRouter(requireAuth,requireAdmin))
app.use('/api/gallery',galleryRouter(requireAuth,requireAdmin))
app.use('/api/operations',operationsRouter(requireAuth,requireAdmin))
app.use('/api/teardown',teardownRouter(requireAuth,requireAdmin))

const staticDir = resolve('dist')
app.use(express.static(staticDir, { index: false, maxAge: production ? '1h' : 0 }))
app.get('*path', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next()
  const index = resolve(staticDir, 'index.html')
  if (!existsSync(index)) return res.status(503).json({ error: 'frontend_not_built', command: 'npm run build' })
  res.sendFile(index)
})
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => { const status=typeof err==='object'&&err&&'status' in err&&Number((err as {status?:number}).status)>=400&&Number((err as {status?:number}).status)<500?Number((err as {status:number}).status):500;if(status===500)console.error(err);res.status(status).json({ error: status===413?'payload_too_large':'internal_error' }) })
const dispatchTimer=setInterval(()=>{ void dispatchPending().catch(error=>console.error('outbox_dispatch_failed',error instanceof Error?error.message:'unknown')) },5_000)
dispatchTimer.unref()
const operatorTimer=setInterval(()=>{try{runOperatorLoop()}catch(error){console.error('operator_loop_failed',error instanceof Error?error.message:'unknown')}},300_000)
operatorTimer.unref()
const watchtowerTimer=setInterval(()=>{try{runWatchtower('scheduled')}catch(error){console.error('watchtower_loop_failed',error instanceof Error?error.message:'unknown')}},120_000)
watchtowerTimer.unref()
app.listen(port, '0.0.0.0', () => console.log(`V&D Wedding Concierge ready on http://0.0.0.0:${port}`))
