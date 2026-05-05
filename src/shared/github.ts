import type { RepoInfo, FileEntry } from './types'

const BASE = 'https://api.github.com'

async function ghFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github.v3+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  if (res.status === 403) {
    throw new Error('GitHub API rate limit reached. Please try again in a few minutes.')
  }
  if (res.status === 404) {
    throw new Error('Repository not found or private.')
  }
  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status}`)
  }

  return res.json()
}

export async function getRepoInfo(owner: string, repo: string): Promise<RepoInfo> {
  const data = await ghFetch<{
    default_branch: string
    private: boolean
  }>(`${BASE}/repos/${owner}/${repo}`)

  if (data.private) {
    throw new Error('Private repositories are not supported.')
  }

  // Fetch the SHA of the latest commit on the default branch
  const branchData = await ghFetch<{ commit: { sha: string } }>(
    `${BASE}/repos/${owner}/${repo}/branches/${data.default_branch}`,
  )

  return {
    owner,
    repo,
    defaultBranch: data.default_branch,
    sha: branchData.commit.sha,
  }
}

export async function getFileTree(info: RepoInfo): Promise<FileEntry[]> {
  const data = await ghFetch<{
    tree: Array<{
      path: string
      type: string
      size: number
      url: string
    }>
    truncated: boolean
  }>(
    `${BASE}/repos/${info.owner}/${info.repo}/git/trees/${info.sha}?recursive=1`,
  )

  if (data.truncated) {
    console.warn('[RepoLogs] Tree truncated by GitHub — repo too large')
  }

  return data.tree
    .filter((item) => item.type === 'blob' && item.size > 0)
    .map((item) => ({
      path: item.path,
      size: item.size,
      url: item.url,
    }))
}

export async function getFileContent(url: string): Promise<string> {
  const data = await ghFetch<{ content: string; encoding: string }>(url)

  if (data.encoding === 'base64') {
    return atob(data.content.replace(/\n/g, ''))
  }

  return data.content
}

/**
 * Fetches multiple files in parallel with a concurrency limit
 */
export async function fetchFiles(
  entries: FileEntry[],
  concurrency = 8,
): Promise<Array<{ path: string; content: string }>> {
  const results: Array<{ path: string; content: string }> = []

  for (let i = 0; i < entries.length; i += concurrency) {
    const batch = entries.slice(i, i + concurrency)
    const batchResults = await Promise.allSettled(
      batch.map(async (entry) => ({
        path: entry.path,
        content: await getFileContent(entry.url),
      })),
    )

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value)
      }
    }
  }

  return results
}