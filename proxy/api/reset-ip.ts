import type { VercelRequest, VercelResponse } from '@vercel/node'
import { kv } from '@vercel/kv'

const ADMIN_TOKEN = process.env.PROXY_TOKEN

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  if (!ADMIN_TOKEN || req.headers['x-proxy-token'] !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { ip } = (req.body ?? {}) as { ip?: string }
  if (!ip || typeof ip !== 'string') {
    return res.status(400).json({ error: 'Missing ip in body' })
  }

  await kv.del(`uses:${ip}`)
  return res.status(200).json({ ok: true, deleted: `uses:${ip}` })
}
