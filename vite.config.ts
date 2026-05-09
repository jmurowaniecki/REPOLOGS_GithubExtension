import { defineConfig, loadEnv } from 'vite'
import { crx } from '@crxjs/vite-plugin'

export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  Object.assign(process.env, env)

  const { default: manifest } = await import('./src/manifest')

  return {
    plugins: [
      crx({ manifest }),
    ],
    build: {
      rollupOptions: {
        input: {
          popup: 'src/popup/index.html',
        },
      },
    },
  }
})