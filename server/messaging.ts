import crypto from 'node:crypto'
import { db, audit } from './db.js'

type Channel = 'telegram' | 'ntfy' | 'web' | 'whatsapp'
type Priority = 'P0' | 'P1' | 'P2' | 'P3'

const digest = (value: unknown) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')

export function recordInbound(provider: string, externalId: string, eventType: string, payload: unknown) {
  const result = db.prepare('INSERT OR IGNORE INTO inbound_events(id,provider,external_id,event_type,payload_digest) VALUES(?,?,?,?,?)')
    .run(crypto.randomUUID(), provider, externalId, eventType, digest(payload))
  return Boolean(result.changes)
}

export function recordDelivered(provider: string) {
  const period=new Date().toISOString().slice(0,7)
  const row=db.prepare('SELECT free_allowance,delivered_count FROM msg_budget WHERE provider=? AND period=?').get(provider,period) as {free_allowance:number,delivered_count:number}|undefined
  if (!row) return
  const delivered=row.delivered_count+1; const allowance=row.free_allowance
  const ratio=allowance>0?delivered/allowance:1
  const mode=allowance<=0?'BLACK':ratio<0.6?'GREEN':ratio<0.85?'AMBER':ratio<1?'RED':'BLACK'
  db.prepare('UPDATE msg_budget SET delivered_count=?,mode=?,updated_at=CURRENT_TIMESTAMP WHERE provider=? AND period=?').run(delivered,mode,provider,period)
  if (provider==='whatsapp' && mode==='BLACK') db.prepare("UPDATE provider_quota SET state='disabled',facts=?,updated_at=CURRENT_TIMESTAMP WHERE provider='whatsapp'").run(JSON.stringify({reason:'free_allowance_exhausted'}))
}

function controlEnabled(key: string) {
  return Boolean((db.prepare('SELECT enabled FROM system_controls WHERE key=?').get(key) as { enabled:number } | undefined)?.enabled)
}

function resolveChannel(requested: Channel, recipientRef: string): Channel {
  if (requested !== 'whatsapp') return requested
  const period = new Date().toISOString().slice(0,7)
  const budget = db.prepare("SELECT mode FROM msg_budget WHERE provider='whatsapp' AND period=?").get(period) as {mode:string}|undefined
  const provider = db.prepare("SELECT state FROM provider_quota WHERE provider='whatsapp'").get() as {state:string}|undefined
  if (budget?.mode === 'BLACK' || provider?.state !== 'healthy') return recipientRef.startsWith('telegram:') ? 'telegram' : 'web'
  return 'whatsapp'
}

export function enqueueMessage(input: { channel:Channel, recipientRef:string, messageType:string, text:string, priority:Priority, idempotencyKey:string }, actorId: string | null = null) {
  if ((controlEnabled('panic') || controlEnabled('freeze.non_p0')) && input.priority !== 'P0') return { queued:false, reason:'non_p0_frozen' }
  const channel = resolveChannel(input.channel, input.recipientRef)
  const recipientRef = channel === 'telegram' ? input.recipientRef.replace(/^telegram:/, '') : input.recipientRef
  const result = db.prepare('INSERT OR IGNORE INTO outbox(id,channel,recipient_ref,message_type,payload,priority,idempotency_key) VALUES(?,?,?,?,?,?,?)')
    .run(crypto.randomUUID(), channel, recipientRef, input.messageType, JSON.stringify({text:input.text.slice(0,3500)}), input.priority, input.idempotencyKey)
  if (result.changes) audit(actorId, 'message_queued', 'outbox', null, {channel,priority:input.priority,messageType:input.messageType})
  return { queued:Boolean(result.changes), channel, duplicate:!result.changes }
}

export async function sendTelegram(chatId: string, text: string, requestContact = false) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('telegram_not_configured')
  const reply_markup = requestContact ? { keyboard: [[{ text: 'Verify my mobile number', request_contact: true }]], resize_keyboard: true, one_time_keyboard: true } : { remove_keyboard: true }
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({chat_id:chatId,text,reply_markup}), signal:AbortSignal.timeout(10_000) })
  const result = await response.json() as {ok?:boolean,result?:{message_id?:number}}
  if (!response.ok || !result.ok) throw new Error(`telegram_http_${response.status}`)
  return String(result.result?.message_id || '')
}

async function sendNtfy(text: string, priority: Priority) {
  const base = process.env.NTFY_BASE_URL || 'https://ntfy.sh'
  const topic = process.env.NTFY_TOPIC
  if (!topic) throw new Error('ntfy_not_configured')
  const url = new URL(encodeURIComponent(topic), base.endsWith('/') ? base : `${base}/`)
  const headers: Record<string,string> = { 'content-type':'text/plain; charset=utf-8', title:'V&D Wedding Alert', priority:priority === 'P0' ? 'urgent' : priority === 'P1' ? 'high' : 'default', tags:priority === 'P0' ? 'rotating_light' : 'wedding' }
  if (process.env.NTFY_ACCESS_TOKEN) headers.authorization = `Bearer ${process.env.NTFY_ACCESS_TOKEN}`
  const response = await fetch(url, {method:'POST',headers,body:text,signal:AbortSignal.timeout(10_000)})
  if (!response.ok) throw new Error(`ntfy_http_${response.status}`)
  return response.headers.get('id') || ''
}

function markProvider(provider: Channel, success: boolean, error?: string) {
  const configured = provider === 'web' || (provider === 'telegram' && Boolean(process.env.TELEGRAM_BOT_TOKEN)) || (provider === 'ntfy' && Boolean(process.env.NTFY_TOPIC))
  const state = success ? 'healthy' : configured ? 'degraded' : 'disabled'
  db.prepare("INSERT INTO provider_quota(provider,state,consecutive_failures,facts) VALUES(?,?,?,?) ON CONFLICT(provider) DO UPDATE SET state=excluded.state,consecutive_failures=CASE WHEN excluded.state='healthy' THEN 0 ELSE provider_quota.consecutive_failures+1 END,facts=excluded.facts,updated_at=CURRENT_TIMESTAMP")
    .run(provider,state,success?0:1,JSON.stringify(error?{lastError:error}:{}))
}

export async function dispatchPending(limit = 20) {
  const rows = db.prepare("SELECT * FROM outbox WHERE status='pending' AND available_at <= CURRENT_TIMESTAMP ORDER BY CASE priority WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 ELSE 3 END, created_at LIMIT ?").all(limit) as Record<string,unknown>[]
  let sent=0, failed=0
  for (const row of rows) {
    const id=String(row.id); const attempt=Number(row.attempts)+1; const channel=String(row.channel) as Channel; const payload=JSON.parse(String(row.payload)) as {text:string}
    try {
      let providerMessageId=''
      if (channel === 'telegram') providerMessageId = await sendTelegram(String(row.recipient_ref), payload.text)
      else if (channel === 'ntfy') providerMessageId = await sendNtfy(payload.text, String(row.priority) as Priority)
      else if (channel === 'whatsapp') throw new Error('whatsapp_paid_or_unverified')
      db.prepare("UPDATE outbox SET status=?,attempts=?,sent_at=CASE WHEN ?='sent' THEN CURRENT_TIMESTAMP ELSE sent_at END,last_error=NULL WHERE id=?").run(channel==='web'?'pending_web':'sent',attempt,channel==='web'?'pending_web':'sent',id)
      db.prepare("INSERT INTO delivery_attempts(id,outbox_id,provider,attempt_number,state,provider_message_id) VALUES(?,?,?,?,?,?)").run(crypto.randomUUID(),id,channel,attempt,channel==='web'?'available':'sent',providerMessageId)
      markProvider(channel,true); sent++
    } catch (error) {
      const code=error instanceof Error?error.message:'delivery_failed'; const terminal=attempt>=3
      db.prepare("UPDATE outbox SET status=?,attempts=?,last_error=?,available_at=datetime('now', '+' || ? || ' seconds') WHERE id=?").run(terminal?'dead':'pending',attempt,code,Math.min(300,2**attempt),id)
      db.prepare('INSERT INTO delivery_attempts(id,outbox_id,provider,attempt_number,state,error_code) VALUES(?,?,?,?,?,?)').run(crypto.randomUUID(),id,channel,attempt,terminal?'dead':'retry',code)
      if (terminal) db.prepare('INSERT OR IGNORE INTO dead_letters(id,outbox_id,reason,payload_digest) VALUES(?,?,?,?)').run(crypto.randomUUID(),id,code,digest(payload))
      markProvider(channel,false,code); failed++
    }
  }
  return {examined:rows.length,sent,failed}
}

export function messagingStatus() {
  const period=new Date().toISOString().slice(0,7)
  return {
    controls:db.prepare('SELECT key,enabled,updated_at FROM system_controls ORDER BY key').all(),
    budgets:db.prepare('SELECT * FROM msg_budget WHERE period=? ORDER BY provider').all(period),
    providers:db.prepare('SELECT * FROM provider_quota ORDER BY provider').all(),
    queues:db.prepare('SELECT status,priority,COUNT(*) AS count FROM outbox GROUP BY status,priority ORDER BY status,priority').all(),
    deadLetters:(db.prepare('SELECT COUNT(*) AS count FROM dead_letters WHERE resolved_at IS NULL').get() as {count:number}).count,
  }
}
