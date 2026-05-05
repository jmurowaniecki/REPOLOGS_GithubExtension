import {
  isPriority,
  sampleFiles,
  buildDepGraph,
  selectByCentrality,
  buildContext,
  estimateTokens,
} from '../src/shared/sampler'
import type { FileEntry } from '../src/shared/types'

function entry(path: string, size = 200): FileEntry {
  return { path, size, url: `https://api.github.com/blobs/${path}` }
}

// ---------------------------------------------------------------------------
// isPriority
// ---------------------------------------------------------------------------
describe('isPriority', () => {
  it('recognizes README.md', () => expect(isPriority('README.md')).toBe(true))
  it('recognizes package.json', () => expect(isPriority('package.json')).toBe(true))
  it('recognizes tsconfig.json', () => expect(isPriority('tsconfig.json')).toBe(true))
  it('recognizes Dockerfile', () => expect(isPriority('Dockerfile')).toBe(true))
  it('recognizes go.mod', () => expect(isPriority('go.mod')).toBe(true))
  it('recognizes Cargo.toml', () => expect(isPriority('Cargo.toml')).toBe(true))
  it('recognizes .github/workflows/ci.yml (startsWith match)', () =>
    expect(isPriority('.github/workflows/ci.yml')).toBe(true))
  it('recognizes docker-compose.yml', () =>
    expect(isPriority('docker-compose.yml')).toBe(true))

  it('returns false for src/index.ts', () => expect(isPriority('src/index.ts')).toBe(false))
  it('returns false for src/utils/helpers.ts', () =>
    expect(isPriority('src/utils/helpers.ts')).toBe(false))
  it('returns false for .env', () => expect(isPriority('.env')).toBe(false))

  it('recognizes README.md nested in a directory (filename match)', () =>
    expect(isPriority('docs/README.md')).toBe(true))
})

// ---------------------------------------------------------------------------
// sampleFiles
// ---------------------------------------------------------------------------
describe('sampleFiles', () => {
  it('excludes node_modules paths', () => {
    const tree = [
      entry('node_modules/lodash/index.js'),
      entry('src/main.ts'),
    ]
    const result = sampleFiles(tree)
    expect(result.map((f) => f.path)).toEqual(['src/main.ts'])
  })

  it('excludes dist/ and build/ paths', () => {
    const tree = [
      entry('dist/bundle.js'),
      entry('build/output.js'),
      entry('src/main.ts'),
    ]
    expect(sampleFiles(tree).map((f) => f.path)).toEqual(['src/main.ts'])
  })

  it('excludes .test. and .spec. files', () => {
    const tree = [
      entry('src/main.ts'),
      entry('src/main.test.ts'),
      entry('src/utils.spec.ts'),
    ]
    const result = sampleFiles(tree).map((f) => f.path)
    expect(result).toContain('src/main.ts')
    expect(result).not.toContain('src/main.test.ts')
    expect(result).not.toContain('src/utils.spec.ts')
  })

  it('excludes __tests__ directories and /tests/ nested paths', () => {
    // The IGNORE_PATTERN for /tests?/ requires a preceding "/" so only nested
    // paths like src/tests/ are excluded; a root-level tests/ dir is not.
    const tree = [
      entry('src/__tests__/unit.ts'),       // excluded: matches /__tests__/
      entry('src/tests/integration.ts'),    // excluded: matches /tests/
      entry('src/main.ts'),                 // included
    ]
    const result = sampleFiles(tree).map((f) => f.path)
    expect(result).not.toContain('src/__tests__/unit.ts')
    expect(result).not.toContain('src/tests/integration.ts')
    expect(result).toContain('src/main.ts')
  })

  it('excludes minified and map files', () => {
    const tree = [
      entry('public/app.min.js'),
      entry('src/app.js.map'),
      entry('src/main.ts'),
    ]
    expect(sampleFiles(tree).map((f) => f.path)).toEqual(['src/main.ts'])
  })

  it('puts priority files before regular code files', () => {
    const tree = [
      entry('src/main.ts'),
      entry('src/utils.ts'),
      entry('package.json'),
      entry('README.md'),
    ]
    const paths = sampleFiles(tree).map((f) => f.path)
    expect(paths.indexOf('README.md')).toBeLessThan(paths.indexOf('src/main.ts'))
    expect(paths.indexOf('package.json')).toBeLessThan(paths.indexOf('src/main.ts'))
  })

  it('respects maxFiles limit', () => {
    const tree = Array.from({ length: 20 }, (_, i) => entry(`src/file${i}.ts`))
    expect(sampleFiles(tree, { maxFiles: 5 })).toHaveLength(5)
  })

  it('excludes files over the token size limit', () => {
    const tree = [
      entry('src/small.ts', 100),
      entry('src/huge.ts', 1_000_000),
    ]
    const paths = sampleFiles(tree).map((f) => f.path)
    expect(paths).toContain('src/small.ts')
    expect(paths).not.toContain('src/huge.ts')
  })

  it('prefers src/ files over root-level files of equal priority', () => {
    const tree = [entry('root-helper.ts'), entry('src/component.ts')]
    const paths = sampleFiles(tree).map((f) => f.path)
    expect(paths.indexOf('src/component.ts')).toBeLessThan(
      paths.indexOf('root-helper.ts'),
    )
  })

  it('returns empty array for an all-ignored tree', () => {
    const tree = [entry('node_modules/pkg/index.js'), entry('dist/bundle.js')]
    expect(sampleFiles(tree)).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// estimateTokens
// ---------------------------------------------------------------------------
describe('estimateTokens', () => {
  it('returns 0 for empty string', () => expect(estimateTokens('')).toBe(0))
  it('estimates 1 token for 4 chars', () => expect(estimateTokens('abcd')).toBe(1))
  it('rounds up (ceil)', () => expect(estimateTokens('abcde')).toBe(2))
  it('handles larger text', () => expect(estimateTokens('a'.repeat(400))).toBe(100))
})

// ---------------------------------------------------------------------------
// buildDepGraph
// ---------------------------------------------------------------------------
describe('buildDepGraph', () => {
  it('returns zero in-degree for files with no importers', () => {
    const files = [{ path: 'src/utils.ts', content: 'export const x = 1' }]
    const graph = buildDepGraph(files)
    expect(graph.get('src/utils.ts')).toBe(0)
  })

  it('increments in-degree for imported files', () => {
    const files = [
      { path: 'src/index.ts', content: `import { x } from './utils'` },
      { path: 'src/utils.ts', content: 'export const x = 1' },
    ]
    const graph = buildDepGraph(files)
    expect(graph.get('src/utils.ts')).toBe(1)
    expect(graph.get('src/index.ts')).toBe(0)
  })

  it('counts multiple importers correctly', () => {
    const files = [
      { path: 'src/a.ts', content: `import { x } from './utils'` },
      { path: 'src/b.ts', content: `import { x } from './utils'` },
      { path: 'src/utils.ts', content: 'export const x = 1' },
    ]
    expect(buildDepGraph(files).get('src/utils.ts')).toBe(2)
  })

  it('does not count self-imports', () => {
    const files = [{ path: 'src/utils.ts', content: `import { x } from './utils'` }]
    expect(buildDepGraph(files).get('src/utils.ts')).toBe(0)
  })

  it('handles require() syntax', () => {
    const files = [
      { path: 'src/index.js', content: `const h = require('./helpers')` },
      { path: 'src/helpers.js', content: 'module.exports = {}' },
    ]
    expect(buildDepGraph(files).get('src/helpers.js')).toBe(1)
  })

  it('ignores non-relative imports (node_modules etc)', () => {
    const files = [
      { path: 'src/index.ts', content: `import React from 'react'` },
      { path: 'src/utils.ts', content: 'export const x = 1' },
    ]
    const graph = buildDepGraph(files)
    expect(graph.get('src/utils.ts')).toBe(0)
  })

  it('does not double-count repeated imports of the same file in one module', () => {
    const content = `
      import { a } from './helpers'
      import { b } from './helpers'
    `
    const files = [
      { path: 'src/index.ts', content },
      { path: 'src/helpers.ts', content: '' },
    ]
    expect(buildDepGraph(files).get('src/helpers.ts')).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// selectByCentrality
// ---------------------------------------------------------------------------
describe('selectByCentrality', () => {
  it('places priority files before non-priority files', () => {
    const files = [
      { path: 'src/main.ts', content: '' },
      { path: 'src/utils.ts', content: '' },
      { path: 'package.json', content: '' },
      { path: 'README.md', content: '' },
    ]
    const graph = new Map<string, number>([
      ['src/main.ts', 0],
      ['src/utils.ts', 5],
      ['package.json', 0],
      ['README.md', 0],
    ])
    const result = selectByCentrality(files, graph)
    const paths = result.map((f) => f.path)
    expect(paths.indexOf('package.json')).toBeLessThan(paths.indexOf('src/main.ts'))
    expect(paths.indexOf('README.md')).toBeLessThan(paths.indexOf('src/main.ts'))
  })

  it('sorts non-priority files by in-degree descending', () => {
    const files = [
      { path: 'src/low.ts', content: '' },
      { path: 'src/high.ts', content: '' },
      { path: 'src/medium.ts', content: '' },
    ]
    const graph = new Map<string, number>([
      ['src/low.ts', 1],
      ['src/high.ts', 10],
      ['src/medium.ts', 5],
    ])
    const result = selectByCentrality(files, graph)
    const paths = result.map((f) => f.path)
    expect(paths[0]).toBe('src/high.ts')
    expect(paths[1]).toBe('src/medium.ts')
    expect(paths[2]).toBe('src/low.ts')
  })

  it('prefers src/ files when in-degree is tied', () => {
    const files = [
      { path: 'scripts/deploy.ts', content: '' },
      { path: 'src/utils.ts', content: '' },
    ]
    const graph = new Map<string, number>([
      ['scripts/deploy.ts', 0],
      ['src/utils.ts', 0],
    ])
    const paths = selectByCentrality(files, graph).map((f) => f.path)
    expect(paths.indexOf('src/utils.ts')).toBeLessThan(
      paths.indexOf('scripts/deploy.ts'),
    )
  })

  it('respects maxFiles limit', () => {
    const files = Array.from({ length: 10 }, (_, i) => ({
      path: `src/file${i}.ts`,
      content: '',
    }))
    const graph = new Map(files.map((f) => [f.path, 0]))
    expect(selectByCentrality(files, graph, 5)).toHaveLength(5)
  })
})

// ---------------------------------------------------------------------------
// buildContext
// ---------------------------------------------------------------------------
describe('buildContext', () => {
  it('returns files unchanged when below limits', () => {
    const files = [{ path: 'src/a.ts', content: 'const x = 1' }]
    const result = buildContext(files)
    expect(result).toHaveLength(1)
    expect(result[0].content).toBe('const x = 1')
  })

  it('truncates content to maxLines and appends marker', () => {
    const manyLines = Array.from({ length: 200 }, (_, i) => `line ${i}`).join('\n')
    const result = buildContext([{ path: 'src/big.ts', content: manyLines }], {
      maxLines: 5,
    })
    expect(result[0].content).toContain('[truncado]')
    const lineCount = result[0].content.split('\n').length
    expect(lineCount).toBeLessThanOrEqual(7)
  })

  it('stops adding files when budget is exceeded and available space is small', () => {
    const files = [
      { path: 'src/a.ts', content: 'x'.repeat(400) }, // 100 tokens
      { path: 'src/b.ts', content: 'y'.repeat(3200) }, // 800 tokens — won't fit
    ]
    const result = buildContext(files, { maxTotalTokens: 500 })
    expect(result).toHaveLength(1)
    expect(result[0].path).toBe('src/a.ts')
  })

  it('partially includes a file when remaining budget exceeds 500 tokens', () => {
    const content = 'z'.repeat(4000) // 1000 tokens
    const result = buildContext([{ path: 'src/big.ts', content }], {
      maxTotalTokens: 600,
    })
    expect(result).toHaveLength(1)
    expect(result[0].content).toContain('[truncado]')
    // Truncated to 600 * 4 = 2400 chars
    expect(result[0].content.startsWith('z'.repeat(2400))).toBe(true)
  })

  it('compresses package.json dependency values to arrays of keys', () => {
    const pkg = JSON.stringify({
      name: 'my-app',
      version: '1.0.0',
      dependencies: { react: '^18.0.0', lodash: '^4.17.0' },
      devDependencies: { typescript: '^5.0.0' },
    })
    const result = buildContext([{ path: 'package.json', content: pkg }])
    const parsed = JSON.parse(result[0].content) as Record<string, unknown>
    expect(Array.isArray(parsed.dependencies)).toBe(true)
    expect(parsed.dependencies).toContain('react')
    expect(parsed.dependencies).toContain('lodash')
    expect(Array.isArray(parsed.devDependencies)).toBe(true)
    expect(parsed.devDependencies).toContain('typescript')
    // Non-dep keys preserved as-is
    expect(parsed.name).toBe('my-app')
  })
})
