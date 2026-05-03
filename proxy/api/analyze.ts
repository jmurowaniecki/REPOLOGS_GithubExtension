import type { VercelRequest, VercelResponse } from '@vercel/node'

const GEMINI_KEY = process.env.GEMINI_SYSTEM_KEY
const PROXY_TOKEN = process.env.PROXY_TOKEN
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
const ALLOWED_MODELS = new Set(['gemini-2.5-flash', 'gemini-2.5-flash-lite'])

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Request-Token')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  if (!PROXY_TOKEN || req.headers['x-request-token'] !== PROXY_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (!GEMINI_KEY) {
    return res.status(503).json({ error: 'Service temporarily unavailable' })
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

    const data: unknown = await upstream.json()
    return res.status(upstream.status).json(data)
  } catch {
    return res.status(502).json({ error: 'Upstream unreachable' })
  }
}
