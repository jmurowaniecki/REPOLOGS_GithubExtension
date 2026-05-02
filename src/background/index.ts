import { resolveApiKey, ApiKeyError, saveUserApiKey, getKeyStatus } from '../shared/api-key-manager'
import { getRepoInfo, getFileTree, fetchFiles } from '../shared/github'
import { sampleFiles, buildContext } from '../shared/sampler'
import { analyzeWithGemini } from '../shared/gemini'
import { getCachedAnalysis, setCachedAnalysis, setState, getState } from '../shared/storage'
import type { MessageType, AnalysisResult } from '../shared/types'

function sendToTab(tabId: number, message: MessageType) {
  chrome.tabs.sendMessage(tabId, message).catch(() => {
    // Tab pode ter fechado; ignora silenciosamente
  })
}

chrome.runtime.onMessage.addListener(
  (message: MessageType, sender, sendResponse) => {
    const tabId = sender.tab?.id

    if (message.type === 'ANALYZE_REPO' && tabId) {
      handleAnalysis(tabId, message.owner, message.repo)
      sendResponse({ ok: true })
    }

    if (message.type === 'GET_STATUS') {
      getKeyStatus().then(sendResponse)
      return true
    }

    return true
  },
)

async function handleAnalysis(tabId: number, owner: string, repo: string) {
  try {
    let keyResolution
    try {
      keyResolution = await resolveApiKey()
    } catch (e) {
      if (e instanceof ApiKeyError && e.requiresUserKey) {
        sendToTab(tabId, {
          type: 'ANALYSIS_ERROR',
          error: e.message,
          requiresApiKey: true,
        })
        return
      }
      throw e
    }

    sendToTab(tabId, { type: 'ANALYSIS_PROGRESS', step: 'Buscando informações do repo...', percent: 5 })

    const repoInfo = await getRepoInfo(owner, repo)
    const cacheKey = `${owner}/${repo}@${repoInfo.sha}`

    const cached = await getCachedAnalysis(cacheKey)
    if (cached) {
      sendToTab(tabId, { type: 'ANALYSIS_COMPLETE', result: cached as AnalysisResult })
      return
    }

    sendToTab(tabId, { type: 'ANALYSIS_PROGRESS', step: 'Mapeando arquivos...', percent: 15 })

    const tree = await getFileTree(repoInfo)
    const sampled = sampleFiles(tree)

    sendToTab(tabId, {
      type: 'ANALYSIS_PROGRESS',
      step: `Lendo ${sampled.length} arquivos...`,
      percent: 30,
    })

    const rawFiles = await fetchFiles(sampled)

    sendToTab(tabId, { type: 'ANALYSIS_PROGRESS', step: 'Montando contexto...', percent: 55 })

    const contextFiles = buildContext(rawFiles)

    sendToTab(tabId, { type: 'ANALYSIS_PROGRESS', step: 'Analisando com IA...', percent: 65 })

    const result = await analyzeWithGemini(
      keyResolution.key,
      owner,
      repo,
      contextFiles,
    )

    const state = await getState()
    await setState({ analysisCount: state.analysisCount + 1 })
    await setCachedAnalysis(cacheKey, result)

    sendToTab(tabId, { type: 'ANALYSIS_COMPLETE', result })
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Erro desconhecido'
    sendToTab(tabId, { type: 'ANALYSIS_ERROR', error })
  }
}

chrome.runtime.onMessage.addListener((message: { type: string; key: string }, _, sendResponse) => {
  if (message.type === 'SAVE_API_KEY') {
    saveUserApiKey(message.key)
      .then(() => sendResponse({ ok: true }))
      .catch((e) => sendResponse({ ok: false, error: (e as Error).message }))
    return true
  }
})
