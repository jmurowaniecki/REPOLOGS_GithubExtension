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
 * Resolve qual API key usar para a próxima chamada.
 * Regra:
 *   1. Se usuário tem key própria → usa ela sempre
 *   2. Se systemKey ainda não foi usada → usa system + marca como usada
 *   3. Caso contrário → lança erro pedindo key do usuário
 */
export async function resolveApiKey(): Promise<KeyResolution> {
  const state = await getState()

  if (state.userApiKey) {
    return { key: state.userApiKey, isSystemKey: false }
  }

  if (!state.systemKeyUsed) {
    // Primeira e única vez usando a key do sistema
    await setState({ systemKeyUsed: true })
    return { key: SYSTEM_KEY, isSystemKey: true }
  }

  throw new ApiKeyError(
    'Você já usou sua análise gratuita. Insira sua API key do Google Gemini para continuar.',
    true,
  )
}

export async function saveUserApiKey(key: string): Promise<void> {
  if (!key || key.trim().length < 10) {
    throw new Error('API key inválida')
  }
  await setState({ userApiKey: key.trim() })
}

export async function clearUserApiKey(): Promise<void> {
  await setState({ userApiKey: null })
}

export async function getKeyStatus() {
  const state = await getState()
  return {
    systemKeyUsed: state.systemKeyUsed,
    hasUserKey: !!state.userApiKey,
    analysisCount: state.analysisCount,
  }
}