import { buildSystemPrompt, buildUserPrompt } from '../src/shared/prompt'

// ---------------------------------------------------------------------------
// buildSystemPrompt
// ---------------------------------------------------------------------------
describe('buildSystemPrompt', () => {
  it('returns a non-empty string', () => {
    const prompt = buildSystemPrompt()
    expect(typeof prompt).toBe('string')
    expect(prompt.length).toBeGreaterThan(100)
  })

  it('includes all 7 dimension names', () => {
    const prompt = buildSystemPrompt()
    const dimensions = [
      'tests',
      'security',
      'architecture',
      'codeQuality',
      'documentation',
      'consistency',
      'maintainability',
    ]
    for (const dim of dimensions) {
      expect(prompt).toContain(dim)
    }
  })

  it('includes the dimensionScores field in the JSON schema', () => {
    expect(buildSystemPrompt()).toContain('dimensionScores')
  })

  it('mentions the scoring weight percentages', () => {
    const prompt = buildSystemPrompt()
    expect(prompt).toContain('20%') // tests + security
    expect(prompt).toContain('15%') // architecture + codeQuality
    expect(prompt).toContain('10%') // documentation + consistency + maintainability
  })

  it('instructs the model to return only valid JSON', () => {
    const prompt = buildSystemPrompt()
    expect(prompt.toLowerCase()).toContain('json')
    expect(prompt).toContain('no markdown')
  })

  it('includes the reasoning field in the schema description', () => {
    expect(buildSystemPrompt()).toContain('"reasoning"')
  })

  it('mentions strengths and weaknesses fields', () => {
    const prompt = buildSystemPrompt()
    expect(prompt).toContain('strengths')
    expect(prompt).toContain('weaknesses')
  })

  it('mentions recommendations field', () => {
    expect(buildSystemPrompt()).toContain('recommendations')
  })

  it('is deterministic (same output on multiple calls)', () => {
    expect(buildSystemPrompt()).toBe(buildSystemPrompt())
  })
})

// ---------------------------------------------------------------------------
// buildUserPrompt
// ---------------------------------------------------------------------------
describe('buildUserPrompt', () => {
  it('includes the owner/repo path', () => {
    const prompt = buildUserPrompt('myowner', 'myrepo', [])
    expect(prompt).toContain('myowner/myrepo')
  })

  it('includes the GitHub URL', () => {
    const prompt = buildUserPrompt('myowner', 'myrepo', [])
    expect(prompt).toContain('https://github.com/myowner/myrepo')
  })

  it('includes the file count', () => {
    const files = [
      { path: 'src/a.ts', content: '' },
      { path: 'src/b.ts', content: '' },
    ]
    expect(buildUserPrompt('o', 'r', files)).toContain('Analyzed files: 2')
  })

  it('shows zero files when the array is empty', () => {
    expect(buildUserPrompt('o', 'r', [])).toContain('Analyzed files: 0')
  })

  it('wraps each file with === FILE: and === END: delimiters', () => {
    const files = [{ path: 'src/main.ts', content: 'const x = 1' }]
    const prompt = buildUserPrompt('o', 'r', files)
    expect(prompt).toContain('=== FILE: src/main.ts ===')
    expect(prompt).toContain('=== END: src/main.ts ===')
    expect(prompt).toContain('const x = 1')
  })

  it('includes all files in the output', () => {
    const files = [
      { path: 'src/a.ts', content: 'export const a = 1' },
      { path: 'src/b.ts', content: 'export const b = 2' },
    ]
    const prompt = buildUserPrompt('o', 'r', files)
    expect(prompt).toContain('=== FILE: src/a.ts ===')
    expect(prompt).toContain('=== FILE: src/b.ts ===')
    expect(prompt).toContain('export const a = 1')
    expect(prompt).toContain('export const b = 2')
  })

  it('ends with an instruction to analyze and return JSON', () => {
    const prompt = buildUserPrompt('o', 'r', [])
    expect(prompt.toLowerCase()).toContain('analyze')
    expect(prompt.toLowerCase()).toContain('json')
  })
})
