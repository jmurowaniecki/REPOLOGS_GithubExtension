import {
  getState,
  setState,
  getCachedAnalysis,
  setCachedAnalysis,
  getLastResult,
  setLastResult,
} from '../src/shared/storage'
import type { AnalysisResult } from '../src/shared/types'

const mockResult: AnalysisResult = {
  score: 75,
  grade: 'B',
  dimensionScores: {
    tests: 7, security: 8, architecture: 7,
    codeQuality: 8, documentation: 6,
    consistency: 8, maintainability: 7,
  },
  reasoning: {
    tests: '', security: '', architecture: '',
    codeQuality: '', documentation: '',
    consistency: '', maintainability: '',
  },
  summary: 'Test result',
  strengths: [],
  weaknesses: [],
  inconsistencies: [],
  architecture: { rating: 'good', notes: '' },
  recommendations: [],
  techStack: [],
  securityFlags: [],
}

// ---------------------------------------------------------------------------
// getState / setState
// ---------------------------------------------------------------------------
describe('getState', () => {
  it('returns all default values when storage is empty', async () => {
    const state = await getState()
    expect(state.systemKeyUsed).toBe(false)
    expect(state.userApiKey).toBeNull()
    expect(state.geminiModel).toBe('gemini-2.5-flash')
    expect(state.deepMode).toBe(false)
    expect(state.analysisCount).toBe(0)
    expect(state.cache).toEqual({})
    expect(state.lastResults).toEqual({})
  })
})

describe('setState', () => {
  it('persists a partial state update', async () => {
    await setState({ userApiKey: 'my-key', analysisCount: 5 })
    const state = await getState()
    expect(state.userApiKey).toBe('my-key')
    expect(state.analysisCount).toBe(5)
  })

  it('merges with previously stored state', async () => {
    await setState({ analysisCount: 3 })
    await setState({ deepMode: true })
    const state = await getState()
    expect(state.analysisCount).toBe(3)
    expect(state.deepMode).toBe(true)
  })

  it('overwrites a specific key without touching others', async () => {
    await setState({ geminiModel: 'gemini-2.5-pro', deepMode: true })
    await setState({ deepMode: false })
    const state = await getState()
    expect(state.geminiModel).toBe('gemini-2.5-pro')
    expect(state.deepMode).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// getCachedAnalysis / setCachedAnalysis
// ---------------------------------------------------------------------------
describe('getCachedAnalysis', () => {
  it('returns null on a cache miss', async () => {
    expect(await getCachedAnalysis('owner/repo@abc')).toBeNull()
  })
})

describe('setCachedAnalysis', () => {
  it('stores a result that can be retrieved with the same key', async () => {
    await setCachedAnalysis('owner/repo@abc123', mockResult)
    const cached = await getCachedAnalysis('owner/repo@abc123')
    expect(cached?.score).toBe(75)
    expect(cached?.grade).toBe('B')
  })

  it('different keys do not interfere', async () => {
    await setCachedAnalysis('owner/repo@sha1', { ...mockResult, score: 60 })
    await setCachedAnalysis('owner/repo@sha2', { ...mockResult, score: 90 })
    expect((await getCachedAnalysis('owner/repo@sha1'))?.score).toBe(60)
    expect((await getCachedAnalysis('owner/repo@sha2'))?.score).toBe(90)
  })

  it('overwrites an existing entry for the same key', async () => {
    await setCachedAnalysis('owner/repo@sha1', { ...mockResult, score: 50 })
    await setCachedAnalysis('owner/repo@sha1', { ...mockResult, score: 80 })
    expect((await getCachedAnalysis('owner/repo@sha1'))?.score).toBe(80)
  })

  it('enforces the 50-entry FIFO limit by evicting the oldest entry', async () => {
    const initial: Record<string, AnalysisResult> = {}
    for (let i = 0; i < 50; i++) initial[`key${i}`] = mockResult
    await setState({ cache: initial })

    await setCachedAnalysis('key50', mockResult)

    const state = await getState()
    expect(Object.keys(state.cache)).toHaveLength(50)
    expect(state.cache['key0']).toBeUndefined()
    expect(state.cache['key50']).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// getLastResult / setLastResult
// ---------------------------------------------------------------------------
describe('getLastResult', () => {
  it('returns null when no result has been stored for a repo', async () => {
    expect(await getLastResult('owner/repo')).toBeNull()
  })
})

describe('setLastResult', () => {
  it('stores and retrieves a result by repo key', async () => {
    await setLastResult('owner/repo', mockResult)
    const result = await getLastResult('owner/repo')
    expect(result?.score).toBe(75)
  })

  it('different repo keys are independent', async () => {
    await setLastResult('orgA/repoX', { ...mockResult, score: 40 })
    await setLastResult('orgB/repoY', { ...mockResult, score: 90 })
    expect((await getLastResult('orgA/repoX'))?.score).toBe(40)
    expect((await getLastResult('orgB/repoY'))?.score).toBe(90)
  })

  it('overwrites the last result for the same repo', async () => {
    await setLastResult('owner/repo', { ...mockResult, score: 50 })
    await setLastResult('owner/repo', { ...mockResult, score: 95 })
    expect((await getLastResult('owner/repo'))?.score).toBe(95)
  })

  it('does not affect other repos when updating one', async () => {
    await setLastResult('owner/repo1', { ...mockResult, score: 70 })
    await setLastResult('owner/repo2', { ...mockResult, score: 80 })
    await setLastResult('owner/repo1', { ...mockResult, score: 75 })
    expect((await getLastResult('owner/repo2'))?.score).toBe(80)
  })
})
