import { buildSystemPrompt, buildUserPrompt } from './prompt'
import type { AnalysisResult } from './types'

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

export const DEFAULT_MODEL = 'gemini-2.5-flash'

export const GEMINI_MODELS: Array<{ id: string; name: string; free: boolean }> = [
  { id: 'gemini-2.5-flash',      name: 'Gemini 2.5 Flash',      free: true  },
  { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', free: true  },
  { id: 'gemini-2.5-pro',        name: 'Gemini 2.5 Pro',        free: false },
]

const RETRY_WAIT_MS = 62_000
const MAX_RETRIES = 1

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>
    }
    finishReason: string
  }>
  error?: { message: string; code: number; status: string }
}

function parseGeminiResult(raw: string): AnalysisResult {
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()

  try {
    const parsed = JSON.parse(cleaned)

    if (typeof parsed.score !== 'number') {
      throw new Error('JSON sem campo score')
    }

    return parsed as AnalysisResult
  } catch (e) {
    throw new Error(`Falha ao parsear resposta do Gemini: ${(e as Error).message}`)
  }
}

export async function analyzeWithGemini(
  apiKey: string,
  owner: string,
  repo: string,
  files: Array<{ path: string; content: string }>,
  model: string = DEFAULT_MODEL,
  onRetry?: (waitSecs: number) => void,
): Promise<AnalysisResult> {
  const systemPrompt = buildSystemPrompt()
  const userPrompt = buildUserPrompt(owner, repo, files)

  const body = {
    system_instruction: {
      parts: [{ text: systemPrompt }],
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: userPrompt }],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 2048,
      responseMimeType: 'application/json',
    },
  }

  const bodyStr = JSON.stringify(body)
  // Estimativa conservadora: 1 token ≈ 3 chars
  const estimatedTokens = Math.ceil(bodyStr.length / 3)
  console.log(
    `[Gemini] Tokens estimados: ~${estimatedTokens.toLocaleString()} | ${owner}/${repo} | ${files.length} arquivo(s)`,
  )

  async function attempt(retriesLeft: number): Promise<AnalysisResult> {
    const res = await fetch(`${API_BASE}/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: bodyStr,
    })

    let data: GeminiResponse
    try {
      data = await res.json()
    } catch {
      throw new Error(`Gemini HTTP ${res.status}: resposta não é JSON válido`)
    }

    if (data.error) {
      console.error('[Gemini] Erro da API:', JSON.stringify(data.error))
      const { code, message } = data.error

      if (code === 429) {
        const isZeroQuota = message.includes('limit: 0')
        if (isZeroQuota) {
          throw new Error(
            'Quota zero no projeto desta API key. Crie a key em aistudio.google.com/app/apikey (não no Google Cloud Console).',
          )
        }
        if (retriesLeft > 0) {
          const waitSecs = Math.ceil(RETRY_WAIT_MS / 1000)
          console.warn(`[Gemini] Rate limit 429 — aguardando ${waitSecs}s antes de tentar novamente`)
          onRetry?.(waitSecs)
          await new Promise<void>((resolve) => setTimeout(resolve, RETRY_WAIT_MS))
          return attempt(retriesLeft - 1)
        }
        throw new Error('Rate limit do Gemini atingido. Aguarde alguns minutos e tente novamente.')
      }

      const isKeyProblem =
        message.toLowerCase().includes('api key') ||
        message.toLowerCase().includes('api_key') ||
        data.error.status === 'INVALID_ARGUMENT'
      if (code === 400 && isKeyProblem) {
        const isExpired = message.toLowerCase().includes('expired')
        if (isExpired) {
          throw new Error('API key expirada ou ainda propagando. Aguarde 1-2 minutos após criar a key e tente novamente.')
        }
        throw new Error('API key inválida. Verifique nas configurações da extensão.')
      }
      throw new Error(`Gemini API [${code}]: ${message}`)
    }

    if (!res.ok) {
      throw new Error(`Gemini HTTP ${res.status}: ${res.statusText}`)
    }

    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error('Resposta vazia do Gemini')
    }

    const rawText = data.candidates[0].content.parts[0].text
    return parseGeminiResult(rawText)
  }

  return attempt(MAX_RETRIES)
}
