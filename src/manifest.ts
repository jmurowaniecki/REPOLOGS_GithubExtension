import { defineManifest } from '@crxjs/vite-plugin'

const proxyUrl = process.env.VITE_PROXY_URL as string | undefined
const proxyOrigin = proxyUrl ? `${new URL(proxyUrl).origin}/*` : null

export default defineManifest({
  manifest_version: 3,
  name: 'RepoLogs',
  version: '0.1.1',
  description: 'AI code review, right inside GitHub. One click on any public repository and you get a full quality report (Google Gemini. Free try).',
  icons: {
    '16': 'public/icons/icon-16.png',
    '32': 'public/icons/icon-32.png',
    '48': 'public/icons/icon-48.png',
    '128': 'public/icons/icon-128.png',
  },
  action: {
    default_popup: 'src/popup/index.html',
    default_icon: 'public/icons/icon-32.png',
  },
  background: {
    service_worker: 'src/background/worker.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['https://github.com/*/*'],
      js: ['src/content/index.ts'],
      run_at: 'document_idle',
    },
  ],
  web_accessible_resources: [
    {
      resources: ['icons/repologsicon.png'],
      matches: ['https://github.com/*'],
    },
  ],
  permissions: ['storage'],
  host_permissions: [
    'https://api.github.com/*',
    'https://generativelanguage.googleapis.com/*',
    ...(proxyOrigin ? [proxyOrigin] : []),
  ],
})