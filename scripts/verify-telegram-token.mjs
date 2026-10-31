const token = process.env.TELEGRAM_BOT_TOKEN
if (!token) throw new Error('TELEGRAM_BOT_TOKEN is required')

const response = await fetch(`https://api.telegram.org/bot${token}/getMe`)
const result = await response.json()
if (!response.ok || !result.ok) throw new Error(`Telegram token verification failed (${response.status})`)
if (result.result?.username !== 'VDWeddingBot') throw new Error('Telegram token belongs to the wrong bot')

console.log('Telegram token verified for @VDWeddingBot')
