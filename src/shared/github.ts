import type { RepoInfo, FileEntry } from './types'
import { getCachedBlob, setCachedBlob } from './storage'

const BASE = 'https://api.github.com'
const RAW_BASE = 'https://raw.githubusercontent.com'

// Track the last known rate-limit state from GitHub API response headers
let rateLimitRemaining = 60
let rateLimitReset = 0 // Unix timestamp (seconds)

export function getRateLimitStatus() {
  return { remaining: rateLimitRemaining, reset: rateLimitReset }
}

async function ghFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github.v3+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  // Keep rate-limit counters updated from every response
  const remaining = res.headers.get('X-RateLimit-Remaining')
  const reset = res.headers.get('X-RateLimit-Reset')
  if (remaining !== null) rateLimitRemaining = parseInt(remaining, 10)
  if (reset !== null) rateLimitReset = parseInt(reset, 10)

  if (res.status === 403 || res.status === 429) {
    let msg = 'GitHub API rate limit reached.'
    if (rateLimitReset) {
      const resetDate = new Date(rateLimitReset * 1000)
      msg += ` Resets at ${resetDate.toLocaleTimeString()}.`
    } else {
      msg += ' Please try again in a few minutes.'
    }
    throw new Error(msg)
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

/**
 * Fetches a single file's content using the raw.githubusercontent.com CDN.
 * Raw content requests are served from GitHub's CDN and are not subject to
 * the GitHub REST API rate limit (60 req/hour for unauthenticated clients).
 *
 * Falls back to the blob API URL only if the raw fetch fails.
 */
export async function getFileContent(
  entry: FileEntry,
  repoInfo: RepoInfo,
): Promise<string> {
  // Use the commit SHA (not branch name) so the URL is immutable and the cache
  // never returns stale content after a push to the default branch.
  const rawUrl = `${RAW_BASE}/${repoInfo.owner}/${repoInfo.repo}/${repoInfo.sha}/${entry.path}`

  // Check local cache first (keyed by raw URL which encodes owner/repo/branch/path)
  const cached = await getCachedBlob(rawUrl)
  if (cached !== null) {
    console.log(`[GitHub] cache hit: ${entry.path}`)
    return cached
  }

  // Fetch from CDN — no rate limit for public repos
  const res = await fetch(rawUrl)

  if (res.ok) {
    const content = await res.text()
    await setCachedBlob(rawUrl, content)
    return content
  }

  // Fallback: use the blob API URL (counts against rate limit)
  console.warn(`[GitHub] raw fetch failed (${res.status}) for ${entry.path}, falling back to blob API`)
  const data = await ghFetch<{ content: string; encoding: string }>(entry.url)
  const content = data.encoding === 'base64'
    ? atob(data.content.replace(/\n/g, ''))
    : data.content
  await setCachedBlob(rawUrl, content)
  return content
}

/**
 * Fetches multiple files in parallel with a concurrency limit.
 * Uses raw.githubusercontent.com CDN to avoid API rate limits.
 */
export async function fetchFiles(
  entries: FileEntry[],
  repoInfo: RepoInfo,
  concurrency = 8,
): Promise<Array<{ path: string; content: string }>> {
  const results: Array<{ path: string; content: string }> = []

  for (let i = 0; i < entries.length; i += concurrency) {
    const batch = entries.slice(i, i + concurrency)
    const batchResults = await Promise.allSettled(
      batch.map(async (entry) => ({
        path: entry.path,
        content: await getFileContent(entry, repoInfo),
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