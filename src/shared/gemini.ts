import { buildSystemPrompt, buildUserPrompt } from './prompt'
import type { AnalysisResult, DimensionScores } from './types'

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

export function scoreToGrade(score: number): AnalysisResult['grade'] {
  if (score >= 85) return 'A'
  if (score >= 70) return 'B'
  if (score >= 55) return 'C'
  if (score >= 40) return 'D'
  return 'F'
}

const DIMENSION_WEIGHTS: Record<keyof DimensionScores, number> = {
  tests:           0.20,
  security:        0.20,
  architecture:    0.15,
  codeQuality:     0.15,
  documentation:   0.10,
  consistency:     0.10,
  maintainability: 0.10,
}

export function computeScore(d: DimensionScores): number {
  const raw = (Object.keys(DIMENSION_WEIGHTS) as (keyof DimensionScores)[]).reduce(
    (acc, k) => acc + Math.max(0, Math.min(10, d[k])) * DIMENSION_WEIGHTS[k],
    0,
  )
  return Math.round(raw * 10)
}

function parseGeminiResult(raw: string): AnalysisResult {
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()

  try {
    const parsed = JSON.parse(cleaned)

    if (!parsed.dimensionScores || typeof parsed.dimensionScores !== 'object') {
      throw new Error('JSON missing dimensionScores field')
    }

    const score = computeScore(parsed.dimensionScores as DimensionScores)
    parsed.score = score
    parsed.grade = scoreToGrade(score)

    return parsed as AnalysisResult
  } catch (e) {
    throw new Error(`Failed to parse Gemini response: ${(e as Error).message}`)
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
      temperature: 0,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
    },
  }

  const bodyStr = JSON.stringify(body)
  // Conservative estimate: 1 token ≈ 3 chars
  const estimatedTokens = Math.ceil(bodyStr.length / 3)
  console.log(
    `[Gemini] Model: ${model} | Estimated tokens: ~${estimatedTokens.toLocaleString()} | ${owner}/${repo} | ${files.length} file(s)`,
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
      throw new Error(`Gemini HTTP ${res.status}: response is not valid JSON`)
    }

    if (data.error) {
      console.error('[Gemini] API error:', JSON.stringify(data.error))
      const { code, message } = data.error

      if (code === 429) {
        const isZeroQuota = message.includes('limit: 0')
        if (isZeroQuota) {
          throw new Error(
            'Invalid model for selected API key or zero quota on project. Create your key at aistudio.google.com/app/apikey (not in Google Cloud Console).',
          )
        }
        if (retriesLeft > 0) {
          const waitSecs = Math.ceil(RETRY_WAIT_MS / 1000)
          console.warn(`[Gemini] Rate limit 429 — waiting ${waitSecs}s before retrying`)
          onRetry?.(waitSecs)
          await new Promise<void>((resolve) => setTimeout(resolve, RETRY_WAIT_MS))
          return attempt(retriesLeft - 1)
        }
        throw new Error('Gemini rate limit reached. Please wait a few minutes and try again.')
      }

      const isKeyProblem =
        message.toLowerCase().includes('api key') ||
        message.toLowerCase().includes('api_key') ||
        data.error.status === 'INVALID_ARGUMENT'
      if (code === 400 && isKeyProblem) {
        const isExpired = message.toLowerCase().includes('expired')
        if (isExpired) {
          throw new Error('API key expired or still propagating. Wait 1-2 minutes after creating the key and try again.')
        }
        throw new Error('Invalid API key. Check in the extension settings.')
      }
      throw new Error(`Gemini API [${code}]: ${message}`)
    }

    if (!res.ok) {
      throw new Error(`Gemini HTTP ${res.status}: ${res.statusText}`)
    }

    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error('Empty response from Gemini')
    }

    const rawText = data.candidates[0].content.parts[0].text
    return parseGeminiResult(rawText)
  }

  return attempt(MAX_RETRIES)
}
