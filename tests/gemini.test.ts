import { scoreToGrade, computeScore, analyzeWithGemini } from '../src/shared/gemini'
import type { DimensionScores, AnalysisResult } from '../src/shared/types'

const perfect: DimensionScores = {
  tests: 10, security: 10, architecture: 10,
  codeQuality: 10, documentation: 10,
  consistency: 10, maintainability: 10,
}

const zeros: DimensionScores = {
  tests: 0, security: 0, architecture: 0,
  codeQuality: 0, documentation: 0,
  consistency: 0, maintainability: 0,
}

function makeValidGeminiResponse(scores: DimensionScores = perfect) {
  const payload: Omit<AnalysisResult, 'score' | 'grade'> = {
    dimensionScores: scores,
    reasoning: {
      tests: 'ok', security: 'ok', architecture: 'ok',
      codeQuality: 'ok', documentation: 'ok',
      consistency: 'ok', maintainability: 'ok',
    },
    summary: 'Great repo',
    strengths: ['TypeScript'],
    weaknesses: [],
    inconsistencies: [],
    architecture: { rating: 'excellent', notes: '' },
    recommendations: [],
    techStack: ['TypeScript'],
    securityFlags: [],
  }
  return {
    candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] }, finishReason: 'STOP' }],
  }
}

// ---------------------------------------------------------------------------
// scoreToGrade
// ---------------------------------------------------------------------------
describe('scoreToGrade', () => {
  it('returns A for score >= 85', () => {
    expect(scoreToGrade(85)).toBe('A')
    expect(scoreToGrade(100)).toBe('A')
    expect(scoreToGrade(95)).toBe('A')
  })
  it('returns B for score 70-84', () => {
    expect(scoreToGrade(70)).toBe('B')
    expect(scoreToGrade(84)).toBe('B')
  })
  it('returns C for score 55-69', () => {
    expect(scoreToGrade(55)).toBe('C')
    expect(scoreToGrade(69)).toBe('C')
  })
  it('returns D for score 40-54', () => {
    expect(scoreToGrade(40)).toBe('D')
    expect(scoreToGrade(54)).toBe('D')
  })
  it('returns F for score below 40', () => {
    expect(scoreToGrade(39)).toBe('F')
    expect(scoreToGrade(0)).toBe('F')
  })
  it('handles boundary at exactly 70, 55, 40', () => {
    expect(scoreToGrade(70)).toBe('B')
    expect(scoreToGrade(55)).toBe('C')
    expect(scoreToGrade(40)).toBe('D')
  })
})

// ---------------------------------------------------------------------------
// computeScore
// ---------------------------------------------------------------------------
describe('computeScore', () => {
  it('returns 100 when all dimensions are 10', () => {
    expect(computeScore(perfect)).toBe(100)
  })

  it('returns 0 when all dimensions are 0', () => {
    expect(computeScore(zeros)).toBe(0)
  })

  it('clamps values above 10 to 10 (still 100)', () => {
    const over: DimensionScores = {
      tests: 15, security: 15, architecture: 15,
      codeQuality: 15, documentation: 15,
      consistency: 15, maintainability: 15,
    }
    expect(computeScore(over)).toBe(100)
  })

  it('clamps negative values to 0', () => {
    const neg: DimensionScores = {
      tests: -5, security: -5, architecture: -5,
      codeQuality: -5, documentation: -5,
      consistency: -5, maintainability: -5,
    }
    expect(computeScore(neg)).toBe(0)
  })

  it('applies weights: only tests=10 → score 20', () => {
    const onlyTests: DimensionScores = {
      tests: 10, security: 0, architecture: 0,
      codeQuality: 0, documentation: 0,
      consistency: 0, maintainability: 0,
    }
    expect(computeScore(onlyTests)).toBe(20)
  })

  it('applies weights: only security=10 → score 20', () => {
    const onlySecurity: DimensionScores = {
      tests: 0, security: 10, architecture: 0,
      codeQuality: 0, documentation: 0,
      consistency: 0, maintainability: 0,
    }
    expect(computeScore(onlySecurity)).toBe(20)
  })

  it('applies weights: only architecture=10 → score 15', () => {
    const onlyArch: DimensionScores = {
      tests: 0, security: 0, architecture: 10,
      codeQuality: 0, documentation: 0,
      consistency: 0, maintainability: 0,
    }
    expect(computeScore(onlyArch)).toBe(15)
  })
})

// ---------------------------------------------------------------------------
// analyzeWithGemini
// ---------------------------------------------------------------------------
describe('analyzeWithGemini', () => {
  it('calls Gemini API with api-key auth and returns parsed result', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => makeValidGeminiResponse() }),
    )

    const result = await analyzeWithGemini(
      { mode: 'api-key', apiKey: 'test-key' },
      'owner', 'repo',
      [{ path: 'README.md', content: '# Test' }],
    )

    expect(result.score).toBe(100)
    expect(result.grade).toBe('A')
    expect(fetch).toHaveBeenCalledOnce()
    const [url, opts] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit]
    expect(url).toContain('gemini-2.5-flash')
    expect(url).toContain('generateContent')
    expect((opts.headers as Record<string, string>)['X-Goog-Api-Key']).toBe('test-key')
  })

  it('calls proxy endpoint when using proxy auth', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => makeValidGeminiResponse() }),
    )

    await analyzeWithGemini(
      { mode: 'proxy', url: 'https://proxy.example.com', token: 'tok' },
      'owner', 'repo', [],
    )

    const [url, opts] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://proxy.example.com/api/analyze')
    expect((opts.headers as Record<string, string>)['X-Request-Token']).toBe('tok')
  })

  it('uses the specified model in the URL', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => makeValidGeminiResponse() }),
    )
    await analyzeWithGemini(
      { mode: 'api-key', apiKey: 'k' },
      'o', 'r', [], 'gemini-2.5-pro',
    )
    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string]
    expect(url).toContain('gemini-2.5-pro')
  })

  it('throws on invalid API key (400 INVALID_ARGUMENT)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({
          error: { code: 400, message: 'API key not valid', status: 'INVALID_ARGUMENT' },
        }),
      }),
    )
    await expect(
      analyzeWithGemini({ mode: 'api-key', apiKey: 'bad' }, 'o', 'r', []),
    ).rejects.toThrow('Invalid API key')
  })

  it('throws on expired API key', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({
          error: { code: 400, message: 'API key expired', status: 'INVALID_ARGUMENT' },
        }),
      }),
    )
    await expect(
      analyzeWithGemini({ mode: 'api-key', apiKey: 'exp' }, 'o', 'r', []),
    ).rejects.toThrow('expired')
  })

  it('throws when Gemini returns zero-quota 429', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({
          error: { code: 429, message: 'limit: 0', status: 'RESOURCE_EXHAUSTED' },
        }),
      }),
    )
    await expect(
      analyzeWithGemini({ mode: 'api-key', apiKey: 'k' }, 'o', 'r', []),
    ).rejects.toThrow('Invalid model')
  })

  it('throws after exhausting one retry on rate limit', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({
          error: { code: 429, message: 'Too Many Requests', status: 'RESOURCE_EXHAUSTED' },
        }),
      }),
    )

    // Attach the rejection handler BEFORE running timers to avoid
    // "PromiseRejectionHandledWarning" from Node.js.
    const expectation = expect(
      analyzeWithGemini({ mode: 'api-key', apiKey: 'k' }, 'o', 'r', []),
    ).rejects.toThrow('rate limit')

    await vi.runAllTimersAsync()
    await expectation
    expect(fetch).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it('retries once on rate limit and succeeds on second attempt', async () => {
    vi.useFakeTimers()
    const onRetry = vi.fn()
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({
            error: { code: 429, message: 'Too Many Requests', status: 'RESOURCE_EXHAUSTED' },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => makeValidGeminiResponse(),
        }),
    )

    const resultPromise = analyzeWithGemini(
      { mode: 'api-key', apiKey: 'k' }, 'o', 'r', [], undefined, onRetry,
    )
    await vi.runAllTimersAsync()
    const result = await resultPromise

    expect(fetch).toHaveBeenCalledTimes(2)
    expect(onRetry).toHaveBeenCalledWith(62)
    expect(result.score).toBe(100)
    vi.useRealTimers()
  })

  it('throws on empty candidates array', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ candidates: [] }),
      }),
    )
    await expect(
      analyzeWithGemini({ mode: 'api-key', apiKey: 'k' }, 'o', 'r', []),
    ).rejects.toThrow('Empty response')
  })

  it('throws when response JSON cannot be parsed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{
            content: { parts: [{ text: 'not json {{{' }] },
            finishReason: 'STOP',
          }],
        }),
      }),
    )
    await expect(
      analyzeWithGemini({ mode: 'api-key', apiKey: 'k' }, 'o', 'r', []),
    ).rejects.toThrow('Failed to parse')
  })

  it('throws when dimensionScores field is missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{
            content: { parts: [{ text: JSON.stringify({ summary: 'no scores' }) }] },
            finishReason: 'STOP',
          }],
        }),
      }),
    )
    await expect(
      analyzeWithGemini({ mode: 'api-key', apiKey: 'k' }, 'o', 'r', []),
    ).rejects.toThrow('dimensionScores')
  })

  it('handles JSON wrapped in markdown code block', async () => {
    const payload = JSON.stringify({
      dimensionScores: perfect,
      reasoning: { tests: '', security: '', architecture: '', codeQuality: '', documentation: '', consistency: '', maintainability: '' },
      summary: '', strengths: [], weaknesses: [], inconsistencies: [],
      architecture: { rating: 'good', notes: '' },
      recommendations: [], techStack: [], securityFlags: [],
    })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{
            content: { parts: [{ text: '```json\n' + payload + '\n```' }] },
            finishReason: 'STOP',
          }],
        }),
      }),
    )
    const result = await analyzeWithGemini(
      { mode: 'api-key', apiKey: 'k' }, 'o', 'r', [],
    )
    expect(result.score).toBe(100)
  })
})
