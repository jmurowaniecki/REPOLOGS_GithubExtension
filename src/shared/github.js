const BASE = 'https://api.github.com';
async function ghFetch(url) {
    const res = await fetch(url, {
        headers: {
            Accept: 'application/vnd.github.v3+json',
            'X-GitHub-Api-Version': '2022-11-28',
        },
    });
    if (res.status === 403) {
        throw new Error('Rate limit da GitHub API atingido. Tente novamente em alguns minutos.');
    }
    if (res.status === 404) {
        throw new Error('Repositório não encontrado ou privado.');
    }
    if (!res.ok) {
        throw new Error(`GitHub API error: ${res.status}`);
    }
    return res.json();
}
export async function getRepoInfo(owner, repo) {
    const data = await ghFetch(`${BASE}/repos/${owner}/${repo}`);
    if (data.private) {
        throw new Error('Repositórios privados não são suportados no MVP.');
    }
    // Busca o SHA do último commit na branch default
    const branchData = await ghFetch(`${BASE}/repos/${owner}/${repo}/branches/${data.default_branch}`);
    return {
        owner,
        repo,
        defaultBranch: data.default_branch,
        sha: branchData.commit.sha,
    };
}
export async function getFileTree(info) {
    const data = await ghFetch(`${BASE}/repos/${info.owner}/${info.repo}/git/trees/${info.sha}?recursive=1`);
    if (data.truncated) {
        console.warn('[RepoLens] Árvore truncada pelo GitHub — repo muito grande');
    }
    return data.tree
        .filter((item) => item.type === 'blob' && item.size > 0)
        .map((item) => ({
        path: item.path,
        size: item.size,
        url: item.url,
    }));
}
export async function getFileContent(url) {
    const data = await ghFetch(url);
    if (data.encoding === 'base64') {
        return atob(data.content.replace(/\n/g, ''));
    }
    return data.content;
}
/**
 * Busca múltiplos arquivos em paralelo com limite de concorrência
 */
export async function fetchFiles(entries, concurrency = 8) {
    const results = [];
    for (let i = 0; i < entries.length; i += concurrency) {
        const batch = entries.slice(i, i + concurrency);
        const batchResults = await Promise.allSettled(batch.map(async (entry) => ({
            path: entry.path,
            content: await getFileContent(entry.url),
        })));
        for (const result of batchResults) {
            if (result.status === 'fulfilled') {
                results.push(result.value);
            }
        }
    }
    return results;
}
