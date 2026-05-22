import type { StorageState, AnalysisResult } from './types'

const DEFAULTS: StorageState = {
  systemKeyUsed: false,
  freeTierDisabled: false,
  userApiKey: null,
  geminiModel: 'gemini-2.5-flash',
  deepMode: false,
  analysisCount: 0,
  cache: {},
  lastResults: {},
  blobCache: {},
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

const BLOB_CACHE_MAX = 200

export async function getCachedBlob(url: string): Promise<string | null> {
  const state = await getState()
  return state.blobCache[url] ?? null
}

export async function setCachedBlob(url: string, content: string): Promise<void> {
  const state = await getState()
  const blobCache = { ...state.blobCache, [url]: content }
  const keys = Object.keys(blobCache)
  if (keys.length > BLOB_CACHE_MAX) {
    // Evict oldest entries (FIFO)
    keys.slice(0, keys.length - BLOB_CACHE_MAX).forEach((k) => delete blobCache[k])
  }
  await setState({ blobCache })
}