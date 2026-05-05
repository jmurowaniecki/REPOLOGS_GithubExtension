import { getState, setState } from './storage'

const SYSTEM_KEY = import.meta.env.VITE_GEMINI_SYSTEM_KEY as string

export interface KeyResolution {
  key: string
  isSystemKey: boolean
}

export class ApiKeyError extends Error {
  constructor(
    message: string,
    public requiresUserKey: boolean = false,
  ) {
    super(message)
    this.name = 'ApiKeyError'
  }
}

/**
 * Resolves which API key to use for the next call.
 * Rules:
 *   1. If the user has their own key → always use it
 *   2. If systemKey has not been used yet → use system key + mark as used
 *   3. Otherwise → throw error requesting the user's key
 */
export async function resolveApiKey(): Promise<KeyResolution> {
  const state = await getState()

  if (state.userApiKey) {
    return { key: state.userApiKey, isSystemKey: false }
  }

  const hasSystemKey = typeof SYSTEM_KEY === 'string' && SYSTEM_KEY.length > 0

  if (hasSystemKey && !state.systemKeyUsed) {
    return { key: SYSTEM_KEY, isSystemKey: true }
  }

  throw new ApiKeyError(
    hasSystemKey
      ? 'You have already used your free analysis. Enter your Google Gemini API key to continue.'
      : 'Enter your Google Gemini API key to continue.',
    true,
  )
}

export async function saveUserApiKey(key: string): Promise<void> {
  if (!key || key.trim().length < 10) {
    throw new Error('Invalid API key')
  }
  await setState({ userApiKey: key.trim() })
}

export async function clearUserApiKey(): Promise<void> {
  await setState({ userApiKey: null })
}

export async function markSystemKeyUsed(): Promise<void> {
  await setState({ systemKeyUsed: true })
}

export async function getKeyStatus() {
  const state = await getState()
  return {
    systemKeyUsed: state.systemKeyUsed,
    hasUserKey: !!state.userApiKey,
    analysisCount: state.analysisCount,
  }
}