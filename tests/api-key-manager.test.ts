import {
  resolveApiKey,
  saveUserApiKey,
  clearUserApiKey,
  markSystemKeyUsed,
  getKeyStatus,
  ApiKeyError,
} from '../src/shared/api-key-manager'
import { setState, getState } from '../src/shared/storage'

// Note: VITE_PROXY_URL is defined as '' in vitest.config.ts, so hasProxy = false
// throughout this file. The proxy code path is covered by integration tests.

// ---------------------------------------------------------------------------
// resolveApiKey
// ---------------------------------------------------------------------------
describe('resolveApiKey — user key takes priority', () => {
  it('returns api-key auth with the stored user key', async () => {
    await setState({ userApiKey: 'user-key-abc123' })

    const resolution = await resolveApiKey()
    expect(resolution.isSystemKey).toBe(false)
    expect(resolution.auth).toEqual({ mode: 'api-key', apiKey: 'user-key-abc123' })
  })

  it('uses the user key even when systemKeyUsed is true', async () => {
    await setState({ userApiKey: 'user-key-abc123', systemKeyUsed: true })

    const resolution = await resolveApiKey()
    expect(resolution.auth.mode).toBe('api-key')
    if (resolution.auth.mode === 'api-key') {
      expect(resolution.auth.apiKey).toBe('user-key-abc123')
    }
  })
})

describe('resolveApiKey — no user key and no proxy configured', () => {
  it('throws ApiKeyError asking for a user key', async () => {
    await expect(resolveApiKey()).rejects.toThrow(ApiKeyError)
  })

  it('thrown error has requiresUserKey = true', async () => {
    let caught: unknown
    try {
      await resolveApiKey()
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(ApiKeyError)
    expect((caught as ApiKeyError).requiresUserKey).toBe(true)
  })

  it('error message instructs user to insert API key', async () => {
    await expect(resolveApiKey()).rejects.toThrow('API key')
  })
})

// ---------------------------------------------------------------------------
// saveUserApiKey
// ---------------------------------------------------------------------------
describe('saveUserApiKey', () => {
  it('saves a valid key to storage', async () => {
    await saveUserApiKey('valid-api-key-12345')
    const { hasUserKey } = await getKeyStatus()
    expect(hasUserKey).toBe(true)
  })

  it('trims surrounding whitespace before saving', async () => {
    await saveUserApiKey('  trimmed-key-12345  ')
    const state = await getState()
    expect(state.userApiKey).toBe('trimmed-key-12345')
  })

  it('throws for a key shorter than 10 characters', async () => {
    await expect(saveUserApiKey('short')).rejects.toThrow('Invalid API key')
  })

  it('throws for an empty string', async () => {
    await expect(saveUserApiKey('')).rejects.toThrow('Invalid API key')
  })

  it('throws for a whitespace-only string', async () => {
    await expect(saveUserApiKey('         ')).rejects.toThrow('Invalid API key')
  })
})

// ---------------------------------------------------------------------------
// clearUserApiKey
// ---------------------------------------------------------------------------
describe('clearUserApiKey', () => {
  it('removes an existing user key from storage', async () => {
    await saveUserApiKey('valid-api-key-12345')
    await clearUserApiKey()
    const { hasUserKey } = await getKeyStatus()
    expect(hasUserKey).toBe(false)
  })

  it('sets userApiKey to null in storage', async () => {
    await saveUserApiKey('valid-api-key-12345')
    await clearUserApiKey()
    const state = await getState()
    expect(state.userApiKey).toBeNull()
  })

  it('is idempotent when called with no key stored', async () => {
    await expect(clearUserApiKey()).resolves.toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// markSystemKeyUsed
// ---------------------------------------------------------------------------
describe('markSystemKeyUsed', () => {
  it('sets systemKeyUsed to true in storage', async () => {
    await markSystemKeyUsed()
    const { systemKeyUsed } = await getKeyStatus()
    expect(systemKeyUsed).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// getKeyStatus
// ---------------------------------------------------------------------------
describe('getKeyStatus', () => {
  it('returns default values for a fresh state', async () => {
    const status = await getKeyStatus()
    expect(status.systemKeyUsed).toBe(false)
    expect(status.hasUserKey).toBe(false)
    expect(status.analysisCount).toBe(0)
  })

  it('reflects stored values', async () => {
    await setState({ systemKeyUsed: true, userApiKey: 'k'.repeat(12), analysisCount: 7 })
    const status = await getKeyStatus()
    expect(status.systemKeyUsed).toBe(true)
    expect(status.hasUserKey).toBe(true)
    expect(status.analysisCount).toBe(7)
  })
})

// ---------------------------------------------------------------------------
// ApiKeyError
// ---------------------------------------------------------------------------
describe('ApiKeyError', () => {
  it('is an instance of Error', () => {
    const err = new ApiKeyError('test message')
    expect(err).toBeInstanceOf(Error)
  })

  it('has the name ApiKeyError', () => {
    expect(new ApiKeyError('msg').name).toBe('ApiKeyError')
  })

  it('defaults requiresUserKey to false', () => {
    expect(new ApiKeyError('msg').requiresUserKey).toBe(false)
  })

  it('accepts requiresUserKey as second argument', () => {
    expect(new ApiKeyError('msg', true).requiresUserKey).toBe(true)
  })
})
