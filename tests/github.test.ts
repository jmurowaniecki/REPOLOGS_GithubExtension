import { getRepoInfo, getFileTree, getFileContent, fetchFiles } from '../src/shared/github'

type FakeResponse = { status?: number; ok?: boolean; data: unknown }

function stubFetch(responses: FakeResponse[]) {
  let i = 0
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async () => {
      const r = responses[i] ?? responses[responses.length - 1]
      i++
      const status = r.status ?? 200
      return {
        status,
        ok: r.ok ?? status < 300,
        json: async () => r.data,
      }
    }),
  )
}

// ---------------------------------------------------------------------------
// getRepoInfo
// ---------------------------------------------------------------------------
describe('getRepoInfo', () => {
  it('returns repo info with branch name and latest SHA', async () => {
    stubFetch([
      { data: { default_branch: 'main', private: false } },
      { data: { commit: { sha: 'abc123def456' } } },
    ])

    const info = await getRepoInfo('owner', 'repo')
    expect(info).toEqual({
      owner: 'owner',
      repo: 'repo',
      defaultBranch: 'main',
      sha: 'abc123def456',
    })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('fetches the correct API URLs', async () => {
    stubFetch([
      { data: { default_branch: 'develop', private: false } },
      { data: { commit: { sha: 'sha999' } } },
    ])

    await getRepoInfo('myorg', 'myrepo')
    const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls as [string][]
    expect(calls[0][0]).toBe('https://api.github.com/repos/myorg/myrepo')
    expect(calls[1][0]).toBe('https://api.github.com/repos/myorg/myrepo/branches/develop')
  })

  it('throws for private repositories', async () => {
    stubFetch([{ data: { default_branch: 'main', private: true } }])
    await expect(getRepoInfo('owner', 'repo')).rejects.toThrow('Private')
  })

  it('throws on 404 (repo not found)', async () => {
    stubFetch([{ status: 404, ok: false, data: {} }])
    await expect(getRepoInfo('owner', 'repo')).rejects.toThrow('not found')
  })

  it('throws on 403 (rate limit)', async () => {
    stubFetch([{ status: 403, ok: false, data: {} }])
    await expect(getRepoInfo('owner', 'repo')).rejects.toThrow('rate limit')
  })

  it('throws a generic error on other 5xx status', async () => {
    stubFetch([{ status: 500, ok: false, data: {} }])
    await expect(getRepoInfo('owner', 'repo')).rejects.toThrow('500')
  })
})

// ---------------------------------------------------------------------------
// getFileTree
// ---------------------------------------------------------------------------
describe('getFileTree', () => {
  const repoInfo = { owner: 'o', repo: 'r', defaultBranch: 'main', sha: 'abc' }

  it('returns only blob entries with size > 0', async () => {
    stubFetch([{
      data: {
        tree: [
          { path: 'src/main.ts', type: 'blob', size: 500, url: 'url1' },
          { path: 'src/',        type: 'tree', size: 0,   url: 'url2' },
          { path: 'empty.ts',   type: 'blob', size: 0,   url: 'url3' },
        ],
        truncated: false,
      },
    }])

    const entries = await getFileTree(repoInfo)
    expect(entries).toHaveLength(1)
    expect(entries[0]).toEqual({ path: 'src/main.ts', size: 500, url: 'url1' })
  })

  it('builds the correct recursive tree URL', async () => {
    stubFetch([{ data: { tree: [], truncated: false } }])
    await getFileTree(repoInfo)
    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string]
    expect(url).toContain('/git/trees/abc?recursive=1')
  })

  it('maps path, size, and url from each blob entry', async () => {
    stubFetch([{
      data: {
        tree: [
          { path: 'README.md', type: 'blob', size: 200, url: 'bloburl' },
        ],
        truncated: false,
      },
    }])
    const [entry] = await getFileTree(repoInfo)
    expect(entry.path).toBe('README.md')
    expect(entry.size).toBe(200)
    expect(entry.url).toBe('bloburl')
  })
})

// ---------------------------------------------------------------------------
// getFileContent
// ---------------------------------------------------------------------------
describe('getFileContent', () => {
  it('decodes base64-encoded content', async () => {
    const text = 'hello world from base64'
    stubFetch([{ data: { content: btoa(text), encoding: 'base64' } }])
    const content = await getFileContent('https://api.github.com/blobs/x')
    expect(content).toBe(text)
  })

  it('handles base64 with embedded newlines (GitHub API adds \\n every 60 chars)', async () => {
    const text = 'a'.repeat(120)
    const raw = btoa(text)
    const withNewlines = raw.replace(/.{60}/g, '$&\n')
    stubFetch([{ data: { content: withNewlines, encoding: 'base64' } }])
    const content = await getFileContent('https://api.github.com/blobs/x')
    expect(content).toBe(text)
  })

  it('returns content as-is for non-base64 encoding', async () => {
    stubFetch([{ data: { content: 'plain text content', encoding: 'utf-8' } }])
    const content = await getFileContent('https://api.github.com/blobs/x')
    expect(content).toBe('plain text content')
  })
})

// ---------------------------------------------------------------------------
// fetchFiles
// ---------------------------------------------------------------------------
describe('fetchFiles', () => {
  it('fetches all files and returns path/content pairs', async () => {
    const entries = [
      { path: 'a.ts', size: 10, url: 'url_a' },
      { path: 'b.ts', size: 10, url: 'url_b' },
    ]
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ content: btoa('content_a'), encoding: 'base64' }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ content: btoa('content_b'), encoding: 'base64' }) }),
    )

    const results = await fetchFiles(entries)
    expect(results).toHaveLength(2)
    expect(results.find((r) => r.path === 'a.ts')?.content).toBe('content_a')
    expect(results.find((r) => r.path === 'b.ts')?.content).toBe('content_b')
  })

  it('skips failed files and returns the successful ones', async () => {
    const entries = [
      { path: 'good.ts', size: 10, url: 'url_good' },
      { path: 'bad.ts',  size: 10, url: 'url_bad'  },
    ]
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ content: btoa('ok'), encoding: 'base64' }) })
        .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) }),
    )

    const results = await fetchFiles(entries)
    expect(results).toHaveLength(1)
    expect(results[0].path).toBe('good.ts')
  })

  it('returns empty array when all files fail', async () => {
    const entries = [{ path: 'fail.ts', size: 10, url: 'url' }]
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }),
    )
    const results = await fetchFiles(entries)
    expect(results).toHaveLength(0)
  })

  it('processes files in batches of the given concurrency', async () => {
    const entries = Array.from({ length: 4 }, (_, i) => ({
      path: `f${i}.ts`, size: 10, url: `url${i}`,
    }))
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ content: btoa('x'), encoding: 'base64' }) }),
    )
    const results = await fetchFiles(entries, 2) // concurrency = 2
    expect(results).toHaveLength(4)
    expect(fetch).toHaveBeenCalledTimes(4)
  })
})
