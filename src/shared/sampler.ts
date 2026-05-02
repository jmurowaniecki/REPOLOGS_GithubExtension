import type { FileEntry } from './types'

// Arquivos com prioridade máxima — sempre incluídos se existirem
const PRIORITY_FILES = [
  'README.md',
  'readme.md',
  'README.rst',
  'package.json',
  'requirements.txt',
  'requirements-dev.txt',
  'pyproject.toml',
  'setup.py',
  'go.mod',
  'go.sum',
  'Cargo.toml',
  'Gemfile',
  'pom.xml',
  'build.gradle',
  'Dockerfile',
  'docker-compose.yml',
  'docker-compose.yaml',
  '.github/workflows',
  'tsconfig.json',
  'vite.config.ts',
  'vite.config.js',
  'webpack.config.js',
  'next.config.js',
  '.eslintrc.json',
  '.eslintrc.js',
  'jest.config.ts',
  'jest.config.js',
]

// Extensões de código aceitas para análise
const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs',
  '.py', '.go', '.rs', '.java', '.kt',
  '.rb', '.php', '.cs', '.cpp', '.c',
  '.swift', '.scala', '.ex', '.exs',
  '.vue', '.svelte',
  '.sql', '.graphql', '.gql',
  '.yaml', '.yml', '.toml', '.json',
  '.env.example', '.env.sample',
])

// Padrões a ignorar completamente
const IGNORE_PATTERNS = [
  /node_modules\//,
  /\.git\//,
  /dist\//,
  /build\//,
  /\.next\//,
  /\.nuxt\//,
  /coverage\//,
  /\.cache\//,
  /vendor\//,
  /target\//,
  /\.min\.(js|css)$/,
  /\.lock$/,
  /package-lock\.json$/,
  /yarn\.lock$/,
  /pnpm-lock\.yaml$/,
  /\.map$/,
  /\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/,
  /\.(pdf|zip|tar|gz|mp4|mp3)$/,
  // Arquivos de teste — verbosos e irrelevantes para análise arquitetural
  /\.(test|spec)\.(ts|tsx|js|jsx|mjs|py|rb|go|java|cs|cpp|swift|kt|rs)$/,
  /\/__tests__\//,
  /\/tests?\//,
  /\/specs?\//,
  /\/e2e\//,
  /\/cypress\//,
  /\/playwright\//,
  /\/fixtures?\//,
  /\/mocks?\//,
]

function getExtension(path: string): string {
  const lastDot = path.lastIndexOf('.')
  if (lastDot === -1) return ''
  return path.slice(lastDot).toLowerCase()
}

function isPriority(path: string): boolean {
  const filename = path.split('/').pop() ?? path
  return PRIORITY_FILES.some((p) =>
    filename === p || path === p || path.startsWith(p),
  )
}

function shouldIgnore(path: string): boolean {
  return IGNORE_PATTERNS.some((pattern) => pattern.test(path))
}

function isCodeFile(path: string): boolean {
  const ext = getExtension(path)
  return CODE_EXTENSIONS.has(ext)
}

/**
 * Estima tokens de um texto (aproximação: 1 token ≈ 4 chars)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

export interface SamplerOptions {
  maxFiles?: number          // default: 40
  maxTokensPerFile?: number  // default: 8000
  maxTotalTokens?: number    // default: 800000 (deixa margem para prompt)
}

export function sampleFiles(
  tree: FileEntry[],
  options: SamplerOptions = {},
): FileEntry[] {
  const {
    maxFiles = 40,
    maxTokensPerFile = 8000,
  } = options

  const filtered = tree.filter(
    (f) => !shouldIgnore(f.path) && (isPriority(f.path) || isCodeFile(f.path)),
  )

  // Separa prioritários dos demais
  const priority = filtered.filter((f) => isPriority(f.path))
  const rest = filtered
    .filter((f) => !isPriority(f.path))
    .sort((a, b) => {
      // Prioriza arquivos menores (mais fáceis de incluir) e em src/
      const aInSrc = a.path.startsWith('src/') || a.path.startsWith('lib/') ? -1 : 0
      const bInSrc = b.path.startsWith('src/') || b.path.startsWith('lib/') ? -1 : 0
      return aInSrc - bInSrc || a.size - b.size
    })

  const selected: FileEntry[] = []
  const maxSizeBytes = maxTokensPerFile * 4  // bytes

  for (const file of [...priority, ...rest]) {
    if (selected.length >= maxFiles) break
    if (file.size > maxSizeBytes) continue  // pula arquivos muito grandes
    selected.push(file)
  }

  return selected
}

const MAX_LINES_PER_FILE = 150
const DEP_KEYS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']

function smartJsonContent(path: string, content: string): string {
  const filename = path.split('/').pop()
  if (filename !== 'package.json') return content
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>
    const summary: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(parsed)) {
      if (DEP_KEYS.includes(k) && v && typeof v === 'object') {
        summary[k] = Object.keys(v as object)
      } else {
        summary[k] = v
      }
    }
    return JSON.stringify(summary, null, 2)
  } catch {
    return content
  }
}

function topLines(content: string, maxLines: number): string {
  const lines = content.split('\n')
  if (lines.length <= maxLines) return content
  return lines.slice(0, maxLines).join('\n') + '\n... [truncado]'
}

export function buildContext(
  files: Array<{ path: string; content: string }>,
  maxTotalTokens: number = 800_000,
): Array<{ path: string; content: string }> {
  const result: Array<{ path: string; content: string }> = []
  let totalTokens = 0

  for (const file of files) {
    const content = topLines(smartJsonContent(file.path, file.content), MAX_LINES_PER_FILE)
    const tokens = estimateTokens(content)
    if (totalTokens + tokens > maxTotalTokens) {
      const available = maxTotalTokens - totalTokens
      if (available > 500) {
        const truncated = content.slice(0, available * 4)
        result.push({ path: file.path, content: truncated + '\n... [truncado]' })
        totalTokens = maxTotalTokens
      }
      break
    }
    result.push({ path: file.path, content })
    totalTokens += tokens
  }

  return result
}

export { estimateTokens }