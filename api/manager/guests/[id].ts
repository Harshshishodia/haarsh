import type { VercelRequest, VercelResponse } from '@vercel/node'
import handler from '../../[...path].js'
export default (req: VercelRequest, res: VercelResponse) => { req.query.path = `manager/guests/${String(req.query.id || '')}`; return handler(req, res) }
