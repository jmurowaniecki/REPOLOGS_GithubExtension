import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/shared/**/*.ts', 'src/background/**/*.ts'],
      exclude: ['src/manifest.ts', 'src/vite-env.d.ts'],
      reporter: ['text', 'html'],
    },
  },
  define: {
    'import.meta.env.VITE_PROXY_URL': JSON.stringify(''),
    'import.meta.env.VITE_PROXY_TOKEN': JSON.stringify(''),
  },
})
