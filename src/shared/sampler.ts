import type { FileEntry } from './types'

// 10 categorias de arquivos universais — sempre incluídos se existirem (até MAX_PRIORITY_SLOTS)
const PRIORITY_FILES = [
  'README.md', 'readme.md', 'README.rst',                    // 1. README
  'package.json',                                             // 2. Node deps
  'pyproject.toml', 'requirements.txt', 'requirements-dev.txt', // 3. Python deps
  'go.mod',                                                   // 4. Go deps
  'Cargo.toml',                                               // 5. Rust deps
  'pom.xml', 'build.gradle',                                  // 6. Java deps
  'tsconfig.json',                                            // 7. TS config
  'Dockerfile',                                               // 8. Container
  'docker-compose.yml', 'docker-compose.yaml',                // 9. Compose
  '.github/workflows',                                        // 10. CI/CD
]

const MAX_PRIORITY_SLOTS = 10

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

export function isPriority(path: string): boolean {
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

const IMPORT_RE = /(?:from|require\()\s*['"](\.[^'"]+)['"]/g

export function buildDepGraph(files: Array<{ path: string; content: string }>): Map<string, number> {
  const stemToPath = new Map<string, string>()
  for (const f of files) {
    const stem = f.path.split('/').pop()!.replace(/\.[^.]+$/, '')
    stemToPath.set(stem, f.path)
  }

  const inDegree = new Map<string, number>()
  for (const f of files) inDegree.set(f.path, 0)

  for (const f of files) {
    const seen = new Set<string>()
    IMPORT_RE.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = IMPORT_RE.exec(f.content)) !== null) {
      const segments = match[1].split('/')
      const stem = segments[segments.length - 1].replace(/\.[^.]+$/, '')
      if (!stem || seen.has(stem)) continue
      seen.add(stem)
      const target = stemToPath.get(stem)
      if (target && target !== f.path) {
        inDegree.set(target, (inDegree.get(target) ?? 0) + 1)
      }
    }
  }

  return inDegree
}

export function selectByCentrality(
  files: Array<{ path: string; content: string }>,
  depGraph: Map<string, number>,
  maxFiles = 40,
): Array<{ path: string; content: string }> {
  const priorityFiles = files.filter((f) => isPriority(f.path)).slice(0, MAX_PRIORITY_SLOTS)
  const priorityPaths = new Set(priorityFiles.map((f) => f.path))

  const rest = files
    .filter((f) => !priorityPaths.has(f.path))
    .sort((a, b) => {
      const degB = depGraph.get(b.path) ?? 0
      const degA = depGraph.get(a.path) ?? 0
      if (degB !== degA) return degB - degA
      const aInSrc = a.path.startsWith('src/') || a.path.startsWith('lib/') ? -1 : 0
      const bInSrc = b.path.startsWith('src/') || b.path.startsWith('lib/') ? -1 : 0
      return aInSrc - bInSrc
    })

  return [...priorityFiles, ...rest].slice(0, maxFiles)
}

export function buildContext(
  files: Array<{ path: string; content: string }>,
  options: { maxLines?: number; maxTotalTokens?: number } = {},
): Array<{ path: string; content: string }> {
  const { maxLines = MAX_LINES_PER_FILE, maxTotalTokens = 800_000 } = options
  const result: Array<{ path: string; content: string }> = []
  let totalTokens = 0

  for (const file of files) {
    const content = topLines(smartJsonContent(file.path, file.content), maxLines)
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