import { buildSystemPrompt, buildUserPrompt } from './prompt'
import type { AnalysisResult } from './types'

const API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

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

  const res = await fetch(`${API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
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
      throw new Error('Rate limit do Gemini atingido. Aguarde alguns minutos.')
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
