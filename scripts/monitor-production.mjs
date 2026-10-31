const baseUrl = process.env.PUBLIC_BASE_URL || 'https://haarsh-black.vercel.app'
const started = Date.now()
const response = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(12_000) })
const body = await response.json().catch(() => ({}))
const report = { checkedAt: new Date().toISOString(), status: response.status, latencyMs: Date.now() - started, service: body }
console.log(JSON.stringify(report))
if (!response.ok || body.status !== 'ok') process.exit(1)
