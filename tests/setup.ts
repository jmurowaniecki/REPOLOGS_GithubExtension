import { vi, beforeEach, afterEach } from 'vitest'

// In-memory store that backs the Chrome storage mock.
// Each test starts with an empty store (reset in beforeEach).
const chromeSt: Record<string, unknown> = {}

const chromeMock = {
  storage: {
    local: {
      get: vi.fn(async (keys: string[]) => {
        const result: Record<string, unknown> = {}
        for (const key of keys) {
          if (key in chromeSt) result[key] = chromeSt[key]
        }
        return result
      }),
      set: vi.fn(async (partial: Record<string, unknown>) => {
        Object.assign(chromeSt, partial)
      }),
    },
  },
  runtime: {
    sendMessage: vi.fn(),
    onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    id: 'test-extension-id',
  },
  tabs: { sendMessage: vi.fn() },
}

// Use Object.defineProperty so vi.unstubAllGlobals() won't remove the chrome mock.
Object.defineProperty(globalThis, 'chrome', {
  value: chromeMock,
  writable: true,
  configurable: true,
})

beforeEach(() => {
  // Empty the store between tests without replacing the object reference
  // (the mock implementations close over the same object).
  for (const key of Object.keys(chromeSt)) delete chromeSt[key]
  // Clear call history but keep implementations.
  vi.clearAllMocks()
})

afterEach(() => {
  // Remove any vi.stubGlobal('fetch', ...) stubs set in individual tests.
  vi.unstubAllGlobals()
})
