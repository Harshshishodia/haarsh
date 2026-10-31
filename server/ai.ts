import crypto from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Router, type NextFunction, type Request, type Response } from 'express'
import { db } from './db.js'

type User = Record<string, unknown>
type AuthedRequest = Request & { user?: User }
type AuthMiddleware = (req: AuthedRequest, res: Response, next: NextFunction) => unknown
export type Language = 'English' | 'Hindi' | 'Hinglish' | 'Punjabi'
type Bible = { version: number; verifiedAt: string; source: string; chunks: { key: string; content: string; facts: object }[] }
type Synthetic = { cases: { id: string; suiteId: string; language: string; input: string; expected: object; tags: string[] }[] }
const bible = JSON.parse(readFileSync(resolve('knowledge/wedding-bible.json'), 'utf8')) as Bible
const docId = 'kb-wedding-bible-v1'
db.prepare("INSERT OR IGNORE INTO kb_documents(id,title,source,version,verified_at,status) VALUES(?,?,?,?,?,'verified')")
  .run(docId, 'V&D Wedding Bible', bible.source, bible.version, bible.verifiedAt)
for (const chunk of bible.chunks) db.prepare('INSERT OR IGNORE INTO kb_chunks(id,document_id,chunk_key,content,facts_json) VALUES(?,?,?,?,?)')
  .run(crypto.randomUUID(), docId, chunk.key, chunk.content, JSON.stringify(chunk.facts))
const examplesPath = resolve('knowledge/synthetic-conversations.json')
if (existsSync(examplesPath)) {
  const library = JSON.parse(readFileSync(examplesPath, 'utf8')) as Synthetic
  const insert = db.prepare('INSERT OR IGNORE INTO eval_cases(id,suite_id,language,input_json,expected_json,tags,synthetic) VALUES(?,?,?,?,?,?,1)')
  for (const item of library.cases) insert.run(item.id, item.suiteId, item.language, JSON.stringify({ message: item.input }), JSON.stringify(item.expected), JSON.stringify(item.tags))
}
const cite = (key: string) => ({ chunkId: key, source: 'V&D Wedding Bible v1', verifiedAt: bible.verifiedAt })
const localized = (language: Language, english: string, hindi: string, hinglish: string, punjabi: string) => ({ English: english, Hindi: hindi, Hinglish: hinglish, Punjabi: punjabi })[language]
export function detectLanguage(text: string, preference?: unknown): Language {
  if (/^(English|Hindi|Hinglish|Punjabi)$/.test(String(preference))) return preference as Language
  if (/[\u0a00-\u0a7f]/.test(text)) return 'Punjabi'
  if (/[\u0900-\u097f]/.test(text)) return 'Hindi'
  if (/\b(kab|kahan|kiska|shaadi|shadi|kaise|namaste|ji|hai|ho)\b/i.test(text)) return 'Hinglish'
  return 'English'
}

// A transparent, rules-based concierge. No model weights are trained by this module.
// Private lookups deliberately bypass semantic_cache: a guest's saved RSVP must never be reused for another guest.
export function answerWedding(message: string, user: User | null = null, preference?: unknown) {
  const lower = message.trim().toLowerCase()
  const language = detectLanguage(message, preference)
  const tr = (en: string, hi: string, hl: string, pa: string) => localized(language, en, hi, hl, pa)
  let intent = 'unknown'
  let text = tr('I do not have a confirmed answer yet. Please ask the family desk through the wedding app.', 'इसका पक्का जवाब अभी उपलब्ध नहीं है। कृपया ऐप में परिवार सहायता से पूछें।', 'Iska confirmed jawab abhi nahi hai Ji. App mein family desk se poochhiye.', 'ਇਸ ਦਾ ਪੱਕਾ ਜਵਾਬ ਅਜੇ ਨਹੀਂ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਐਪ ਵਿੱਚ ਪਰਿਵਾਰ ਤੋਂ ਪੁੱਛੋ।')
  let citations: ReturnType<typeof cite>[] = []
  if (/\bignore\b.*\b(rules|instructions|previous|all)\b|system prompt|developer message|नियम.*भूल|ਨਿਯਮ.*ਭੁੱਲ/.test(lower)) {
    intent = 'injection'
    text = tr('I cannot share protected details or override wedding privacy rules.', 'मैं निजी जानकारी नहीं दे सकता या गोपनीयता के नियम नहीं बदल सकता।', 'Private details share ya privacy rules override nahi kar sakta Ji.', 'ਮੈਂ ਨਿੱਜੀ ਜਾਣਕਾਰੀ ਨਹੀਂ ਦੇ ਸਕਦਾ ਜਾਂ ਗੋਪਨੀਯਤਾ ਦੇ ਨਿਯਮ ਨਹੀਂ ਬਦਲ ਸਕਦਾ।')
    citations = [cite('privacy')]
  } else if (/reveal.*(phone|budget)|phone number|total budget|vendor cost|फोन नंबर|बजट|ਫੋਨ ਨੰਬਰ|ਬਜਟ/.test(lower)) {
    intent = /budget|cost|बजट|ਬਜਟ/.test(lower) ? 'privacy_budget' : 'privacy_phone'
    text = tr('I cannot share private phone numbers, costs or protected family details.', 'मैं निजी फोन नंबर, खर्च या परिवार की गोपनीय जानकारी साझा नहीं कर सकता।', 'Private phone numbers, budget ya family details share nahi kar sakta Ji.', 'ਮੈਂ ਨਿੱਜੀ ਫੋਨ ਨੰਬਰ, ਖਰਚ ਜਾਂ ਪਰਿਵਾਰ ਦੀ ਗੁਪਤ ਜਾਣਕਾਰੀ ਸਾਂਝੀ ਨਹੀਂ ਕਰ ਸਕਦਾ।')
    citations = [cite('privacy')]
  } else if (/^(hi|hello|hey|namaste|namaskar|sat sri akal|नमस्ते|ਸਤ ਸ੍ਰੀ ਅਕਾਲ)[!.\s]*$|how are you|kaise ho|कैसे हो|ਕਿਵੇਂ ਹੋ/.test(lower)) {
    intent = 'greeting'
    text = tr('Hello! I am the wedding assistant for Vaishnavi & Dhruv. I can help with confirmed dates, venue, RSVP and travel requests.', 'नमस्ते! मैं वैष्णवी और ध्रुव का विवाह सहायक हूँ। तारीख, स्थान, RSVP और यात्रा सहायता के बारे में पूछिए।', 'Namaste Ji! Main Vaishnavi aur Dhruv ka wedding assistant hoon. Dates, venue, RSVP ya travel help poochhiye.', 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ ਵੈਸ਼ਨਵੀ ਅਤੇ ਧਰੁਵ ਦਾ ਵਿਆਹ ਸਹਾਇਕ ਹਾਂ। ਤਾਰੀਖ, ਸਥਾਨ, RSVP ਜਾਂ ਯਾਤਰਾ ਬਾਰੇ ਪੁੱਛੋ।')
    citations = [cite('couple')]
  } else if (/whose wedding|who.*(marry|marrying|couple)|couple|kiski shaadi|kiski shadi|किसकी शादी|कौन.*दूल्हा|ਕਿਸ ਦਾ ਵਿਆਹ/.test(lower)) {
    intent = 'couple'
    text = tr('This is Vaishnavi and Dhruv’s wedding, hosted by Sanjeev and Anita Shishodia.', 'यह वैष्णवी और ध्रुव का विवाह है। मेज़बान संजीव और अनीता शिशोदिया हैं।', 'Yeh Vaishnavi aur Dhruv ki shaadi hai Ji. Hosts Sanjeev aur Anita Shishodia hain.', 'ਇਹ ਵੈਸ਼ਨਵੀ ਅਤੇ ਧਰੁਵ ਦਾ ਵਿਆਹ ਹੈ। ਮੇਜ਼ਬਾਨ ਸੰਜੀਵ ਅਤੇ ਅਨੀਤਾ ਸ਼ਿਸ਼ੋਦੀਆ ਹਨ।')
    citations = [cite('couple')]
  } else if (/my name|who am i|mera naam|मेरा नाम|ਮੇਰਾ ਨਾਮ/.test(lower)) {
    intent = 'identity'
    const name = user?.display_name || user?.displayName
    text = name ? tr(`Your verified profile name is ${name}.`, `आपकी सत्यापित प्रोफ़ाइल का नाम ${name} है।`, `Aapka verified profile name ${name} hai Ji.`, `ਤੁਹਾਡੀ ਤਸਦੀਕਸ਼ੁਦਾ ਪ੍ਰੋਫਾਈਲ ਦਾ ਨਾਮ ${name} ਹੈ।`) : tr('Please verify your wedding login first; I cannot identify you from an unverified chat.', 'पहले अपना विवाह लॉगिन सत्यापित करें।', 'Pehle wedding login verify kijiye Ji.', 'ਪਹਿਲਾਂ ਆਪਣਾ ਵਿਆਹ ਲਾਗਇਨ ਤਸਦੀਕ ਕਰੋ।')
  } else if (/what time|start time|timing|kitne baje|कितने बजे|समय|ਕਿੰਨੇ ਵਜੇ|ਸਮਾਂ/.test(lower)) {
    intent = 'unknown_time'
    text = tr('The wedding start time is to be confirmed. I will not guess it.', 'विवाह का समय अभी तय होना बाकी है। मैं अनुमान नहीं लगाऊँगा।', 'Wedding ka time abhi to be confirmed hai Ji. Main guess nahi karunga.', 'ਵਿਆਹ ਦਾ ਸਮਾਂ ਅਜੇ ਪੱਕਾ ਨਹੀਂ ਹੈ। ਮੈਂ ਅੰਦਾਜ਼ਾ ਨਹੀਂ ਲਗਾਵਾਂਗਾ।')
    citations = [cite('wedding-venue'), cite('unknown-details')]
  } else if (/where.*wedding|wedding venue|emerald|shaadi kahan|शादी कहाँ|विवाह स्थल|ਵਿਆਹ ਕਿੱਥੇ|ਸਥਾਨ/.test(lower)) {
    intent = 'venue'
    text = tr('The wedding venue is Emerald Green, Govindpuram, Ghaziabad.', 'विवाह स्थल Emerald Green, Govindpuram, Ghaziabad है।', 'Wedding Emerald Green, Govindpuram, Ghaziabad mein hai Ji.', 'ਵਿਆਹ ਦਾ ਸਥਾਨ Emerald Green, Govindpuram, Ghaziabad ਹੈ।')
    citations = [cite('wedding-venue')]
  } else if (/when.*wedding|wedding date|date.*wedding|shaadi kab|shadi kab|शादी कब|तारीख|ਵਿਆਹ ਕਦੋਂ|ਤਾਰੀਖ/.test(lower)) {
    intent = 'wedding_date'
    text = tr('The wedding is on 16 February 2027 in Ghaziabad. The start time is to be confirmed.', 'विवाह 16 फ़रवरी 2027 को गाज़ियाबाद में है। समय अभी तय होना बाकी है।', 'Wedding 16 February 2027 ko Ghaziabad mein hai Ji. Time to be confirmed hai.', 'ਵਿਆਹ 16 ਫ਼ਰਵਰੀ 2027 ਨੂੰ ਗਾਜ਼ੀਆਬਾਦ ਵਿੱਚ ਹੈ। ਸਮਾਂ ਅਜੇ ਪੱਕਾ ਨਹੀਂ ਹੈ।')
    citations = [cite('dates'), cite('unknown-details')]
  } else if (/schedule|events|sagai|haldi|mehndi|sangeet|कार्यक्रम|हल्दी|मेहंदी|समारोह|ਮਹਿੰਦੀ|ਹਲਦੀ/.test(lower)) {
    intent = 'schedule'
    text = tr('Sagai: 12 February; Haldi: 14 February; Mehndi: 15 February; Wedding: 16 February 2027. Event times and remaining venues are to be confirmed. Your invitation determines which events you can attend.', 'सगाई: 12 फ़रवरी; हल्दी: 14 फ़रवरी; मेहंदी: 15 फ़रवरी; विवाह: 16 फ़रवरी 2027। समय और बाकी स्थान अभी तय होने हैं। अपने निमंत्रण के अनुसार शामिल हों।', 'Sagai 12 Feb, Haldi 14 Feb, Mehndi 15 Feb aur Wedding 16 February 2027 hai Ji. Times aur baaki venues to be confirmed hain. Apna invitation check kijiye.', 'ਸਗਾਈ: 12 ਫ਼ਰਵਰੀ; ਹਲਦੀ: 14 ਫ਼ਰਵਰੀ; ਮਹਿੰਦੀ: 15 ਫ਼ਰਵਰੀ; ਵਿਆਹ: 16 ਫ਼ਰਵਰੀ 2027। ਸਮਾਂ ਅਤੇ ਬਾਕੀ ਸਥਾਨ ਅਜੇ ਪੱਕੇ ਨਹੀਂ ਹਨ। ਆਪਣਾ ਸੱਦਾ ਦੇਖੋ।')
    citations = [cite('dates'), cite('unknown-details')]
  } else if (/jain|vegetarian|onion|food|diet|भोजन|खाना|जैन|शाकाहारी|ਖਾਣਾ|ਜੈਨ/.test(lower)) {
    intent = 'diet'
    text = tr('You can record Vegetarian, Jain, No onion or garlic, or Other in RSVP. The family must confirm any special arrangement; this is a preference record, not a catering guarantee.', 'RSVP में शाकाहारी, जैन, बिना प्याज़-लहसुन या अन्य पसंद दर्ज करें। विशेष व्यवस्था की पुष्टि परिवार से होगी।', 'RSVP mein Vegetarian, Jain, No onion or garlic ya Other preference save kijiye Ji. Special arrangement family confirm karegi.', 'RSVP ਵਿੱਚ ਸ਼ਾਕਾਹਾਰੀ, ਜੈਨ, ਬਿਨਾਂ ਪਿਆਜ਼-ਲਸਣ ਜਾਂ ਹੋਰ ਪਸੰਦ ਦਰਜ ਕਰੋ। ਖਾਸ ਪ੍ਰਬੰਧ ਦੀ ਪੁਸ਼ਟੀ ਪਰਿਵਾਰ ਕਰੇਗਾ।')
    citations = [cite('diet')]
  } else if (/rsvp|coming|attend/.test(lower)) {
    intent = 'rsvp'
    const rows = (user ? db.prepare('SELECT e.name,r.response FROM rsvp_responses r JOIN events e ON e.id=r.event_id WHERE r.guest_id=? ORDER BY e.event_date').all(String(user.id)) : []) as { name: string; response: string }[]
    text = user ? rows.length ? `Your saved RSVP: ${rows.map(row => `${row.name}: ${row.response}`).join(', ')}. Update it in the wedding app.` : 'No RSVP is saved for your profile yet. Open RSVP in the wedding app to respond.' : 'Verify your wedding login to see or change your private RSVP.'
  } else if (/pickup|driver|train|airport|transport/.test(lower)) {
    intent = 'pickup'
    text = user ? 'Your saved travel arrangements are in My Pass. If nothing is assigned, send a family help request; a pickup is not confirmed until the family assigns it.' : 'Verify your wedding login to see saved travel arrangements in My Pass.'
  } else if (/baraat|barat|track|location|बारात|ਬਰਾਤ/.test(lower)) {
    intent = 'tracking'
    text = tr('Open Baraat in the verified wedding app. Location appears only while the designated tracker is sharing. Stale positions must not be treated as current.', 'सत्यापित ऐप में बारात खोलें। नियुक्त व्यक्ति के साझा करते समय ही स्थान दिखेगा। पुराने स्थान को वर्तमान न मानें।', 'Verified app mein Baraat kholiye Ji. Designated tracker share kare tabhi live position milegi. Stale point ko current mat samajhiye.', 'ਤਸਦੀਕਸ਼ੁਦਾ ਐਪ ਵਿੱਚ ਬਰਾਤ ਖੋਲ੍ਹੋ। ਨਿਯੁਕਤ ਵਿਅਕਤੀ ਦੇ ਸਾਂਝਾ ਕਰਨ ਵੇਲੇ ਹੀ ਸਥਾਨ ਦਿਸੇਗਾ।')
  } else if (/stock|crypto|homework|weather/.test(lower)) {
    intent = 'off_topic'
    text = tr('I am the wedding assistant and can help with wedding dates, RSVP, venue and family help.', 'मैं विवाह सहायक हूँ। तारीख, RSVP, स्थान और परिवार सहायता के बारे में पूछिए।', 'Main wedding assistant hoon Ji. Dates, RSVP, venue aur family help poochhiye.', 'ਮੈਂ ਵਿਆਹ ਸਹਾਇਕ ਹਾਂ। ਤਾਰੀਖ, RSVP, ਸਥਾਨ ਅਤੇ ਪਰਿਵਾਰ ਦੀ ਮਦਦ ਬਾਰੇ ਪੁੱਛੋ।')
  }
  return { intent, text, citations, confidence: intent === 'unknown' ? 0.25 : 0.95, language, tier: 0, provider: 'deterministic', cached: false, training: 'none' }
}

export function aiRouter(requireAuth: AuthMiddleware, requireAdmin: AuthMiddleware) {
  const router = Router()
  router.use(requireAuth)
  router.post('/ask', (req: AuthedRequest, res) => {
    const message = String(req.body?.message || '').trim()
    if (message.length < 1 || message.length > 1500) return res.status(400).json({ error: 'invalid_message' })
    res.json(answerWedding(message, req.user!, req.body?.language))
  })
  router.post('/feedback', (req: AuthedRequest, res) => {
    const rating = Number(req.body?.rating)
    if (![-1, 1].includes(rating)) return res.status(400).json({ error: 'rating_must_be_minus1_or_1' })
    db.prepare('INSERT INTO agent_feedback(id,run_id,guest_id,rating,note) VALUES(?,NULL,?,?,?)').run(crypto.randomUUID(), String(req.user!.id), rating, String(req.body?.note || '').slice(0,500))
    res.status(201).json({ recorded: true })
  })
  router.get('/admin/providers', requireAdmin, (_req, res) => res.json({
    training: 'No fine-tuning or model training has been performed. Synthetic examples are evaluation fixtures.',
    providers: [{ id: 'deterministic', tier: 0, state: 'healthy', trainingRisk: false }, ...['gemini', 'groq', 'openrouter', 'ollama'].map(id => ({ id, state: 'not_integrated' }))],
  }))
  router.post('/admin/evaluate', requireAdmin, (_req, res) => {
    const rows = db.prepare('SELECT * FROM eval_cases WHERE suite_id=? ORDER BY id').all('eval-concierge-v1') as Record<string, unknown>[]
    const runId = crypto.randomUUID(), failures: object[] = []
    let passed = 0
    for (const row of rows) {
      const input = JSON.parse(String(row.input_json)), expected = JSON.parse(String(row.expected_json))
      const answer = answerWedding(input.message, null, 'English')
      const ok = answer.intent === expected.intent && answer.text.toLowerCase().includes(String(expected.mustContain).toLowerCase()) && (!expected.citation || answer.citations.some(c => c.chunkId === expected.citation))
      if (ok) passed++; else failures.push({ id: row.id, intent: answer.intent })
    }
    const state = rows.length && passed === rows.length ? 'passed' : 'failed'
    db.prepare('INSERT INTO eval_runs(id,suite_id,prompt_version,state,total,passed,metrics_json,finished_at) VALUES(?,?,?,?,?,?,?,CURRENT_TIMESTAMP)')
      .run(runId, 'eval-concierge-v1', 'rules-v2', state, rows.length, passed, JSON.stringify({ failures, scope: 'Repeated English fixtures with language labels; not proof of multilingual model quality.' }))
    res.json({ runId, state, total: rows.length, passed, failed: rows.length-passed, failures: failures.slice(0,20), limitation: 'These fixtures are repeated English questions, not trained AI or a multilingual quality benchmark.' })
  })
  return router
}
