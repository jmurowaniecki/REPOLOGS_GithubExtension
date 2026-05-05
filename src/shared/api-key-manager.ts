import { getState, setState } from './storage'
import type { AuthConfig } from './gemini'

const PROXY_URL = import.meta.env.VITE_PROXY_URL as string | undefined
const PROXY_TOKEN = import.meta.env.VITE_PROXY_TOKEN as string | undefined

const hasProxy = typeof PROXY_URL === 'string' && PROXY_URL.length > 0

export interface KeyResolution {
  isSystemKey: boolean
  auth: AuthConfig
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
 * Resolve qual autenticação usar para a próxima chamada.
 * Regra:
 *   1. Se usuário tem key própria → usa ela diretamente (sem proxy)
 *   2. Se proxy configurado e ainda não foi usado → usa proxy + marca como usado
 *   3. Caso contrário → lança erro pedindo key do usuário
 */
export async function resolveApiKey(): Promise<KeyResolution> {
  const state = await getState()

  if (state.userApiKey) {
    return {
      isSystemKey: false,
      auth: { mode: 'api-key', apiKey: state.userApiKey },
    }
  }

  if (hasProxy && !state.systemKeyUsed) {
    await setState({ systemKeyUsed: true })
    return {
      isSystemKey: true,
      auth: { mode: 'proxy', url: PROXY_URL!, token: PROXY_TOKEN },
    }
  }

  throw new ApiKeyError(
    hasProxy
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
