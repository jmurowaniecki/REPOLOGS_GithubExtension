import type { StorageState, AnalysisResult } from './types'

const DEFAULTS: StorageState = {
  systemKeyUsed: false,
  userApiKey: null,
  analysisCount: 0,
  cache: {},
  lastResults: {},
}

export async function getState(): Promise<StorageState> {
  const result = await chrome.storage.local.get(Object.keys(DEFAULTS))
  return { ...DEFAULTS, ...(result as Partial<StorageState>) }
}

export async function setState(partial: Partial<StorageState>): Promise<void> {
  await chrome.storage.local.set(partial)
}

export async function getCachedAnalysis(key: string) {
  const state = await getState()
  return state.cache[key] ?? null
}

export async function setCachedAnalysis(key: string, result: AnalysisResult) {
  const state = await getState()
  const cache = { ...state.cache, [key]: result }
  // Limita cache a 50 entradas para não estourar storage
  const keys = Object.keys(cache)
  if (keys.length > 50) {
    delete cache[keys[0]]
  }
  await setState({ cache })
}

export async function getLastResult(repoKey: string): Promise<AnalysisResult | null> {
  const state = await getState()
  return state.lastResults[repoKey] ?? null
}

export async function setLastResult(repoKey: string, result: AnalysisResult): Promise<void> {
  const state = await getState()
  await setState({ lastResults: { ...state.lastResults, [repoKey]: result } })
}