import type { VercelRequest, VercelResponse } from '@vercel/node'
import { kv } from '@vercel/kv'

const GEMINI_KEY = process.env.GEMINI_SYSTEM_KEY
const PROXY_TOKEN = process.env.PROXY_TOKEN
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
const ALLOWED_MODELS = new Set(['gemini-2.5-flash', 'gemini-2.5-flash-lite'])
const FREE_USES_PER_IP = parseInt(process.env.FREE_USES_PER_IP ?? '1', 10)

function getIp(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for']
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded
  return (raw?.split(',')[0] ?? req.socket?.remoteAddress ?? 'unknown').trim()
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Proxy-Token')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  if (PROXY_TOKEN && req.headers['x-proxy-token'] !== PROXY_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (!GEMINI_KEY) {
    return res.status(503).json({ error: 'Service temporarily unavailable' })
  }

  const ip = getIp(req)
  const key = `uses:${ip}`
  let uses = 0
  let kvAvailable = true
  try {
    uses = (await kv.get<number>(key)) ?? 0
  } catch {
    kvAvailable = false
  }

  if (kvAvailable && uses >= FREE_USES_PER_IP) {
    return res.status(429).json({ error: 'Free quota exceeded' })
  }

  const { model, body } = (req.body ?? {}) as { model?: unknown; body?: unknown }

  if (typeof model !== 'string' || !ALLOWED_MODELS.has(model)) {
    return res.status(400).json({ error: 'Invalid model' })
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'Invalid request body' })
  }

  try {
    const upstream = await fetch(`${API_BASE}/${model}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GEMINI_KEY,
      },
      body: JSON.stringify(body),
    })

    if (upstream.ok && kvAvailable) {
      try {
        await kv.set(key, uses + 1)
      } catch {
        // best-effort
      }
    }

    const data: unknown = await upstream.json()
    return res.status(upstream.status).json(data)
  } catch {
    return res.status(502).json({ error: 'Upstream unreachable' })
  }
}