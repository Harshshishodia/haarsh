import type { VercelRequest, VercelResponse } from '@vercel/node'
import handler from './[...path].js'
export default (req: VercelRequest, res: VercelResponse) => { req.query.path = 'me'; return handler(req, res) }
