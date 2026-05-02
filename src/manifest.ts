import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: 'RepoLens',
  version: '0.1.0',
  description: 'Analise a qualidade de repos GitHub com IA',
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
      resources: ['icons/repolensicon.png'],
      matches: ['https://github.com/*'],
    },
  ],
  permissions: ['storage', 'activeTab'],
  host_permissions: [
    'https://api.github.com/*',
    'https://generativelanguage.googleapis.com/*',
  ],
})