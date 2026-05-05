import { resolveApiKey, ApiKeyError, saveUserApiKey, clearUserApiKey, getKeyStatus, markSystemKeyUsed } from '../shared/api-key-manager'
import { getRepoInfo, getFileTree, fetchFiles } from '../shared/github'
import { sampleFiles, buildContext, buildDepGraph, selectByCentrality, isPriority, estimateTokens } from '../shared/sampler'
import { analyzeWithGemini, DEFAULT_MODEL } from '../shared/gemini'
import { setCachedAnalysis, setState, getState, setLastResult } from '../shared/storage'
import type { MessageType} from '../shared/types'

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

    sendToTab(tabId, { type: 'ANALYSIS_PROGRESS', step: 'Mapeando arquivos...', percent: 15 })

    const tree = await getFileTree(repoInfo)
    const sampled = sampleFiles(tree, { maxFiles: 80 })

    sendToTab(tabId, {
      type: 'ANALYSIS_PROGRESS',
      step: `Lendo ${sampled.length} arquivos...`,
      percent: 30,
    })

    const rawFiles = await fetchFiles(sampled)

    sendToTab(tabId, { type: 'ANALYSIS_PROGRESS', step: 'Mapeando dependências...', percent: 45 })

    const depGraph = buildDepGraph(rawFiles)
    const selectedFiles = selectByCentrality(rawFiles, depGraph, 40)

    const prioritySelected = selectedFiles.filter((f) => isPriority(f.path))
    const graphSelected = selectedFiles.filter((f) => !isPriority(f.path))
    console.log(`[Sampler] Padrão (${prioritySelected.length}):`, prioritySelected.map((f) => f.path))
    console.log(
      `[Sampler] Grafo (${graphSelected.length}):`,
      graphSelected.map((f) => `${f.path} [in-degree: ${depGraph.get(f.path) ?? 0}]`),
    )

    sendToTab(tabId, { type: 'ANALYSIS_PROGRESS', step: 'Montando contexto...', percent: 55 })

    const { geminiModel, deepMode } = await getState()
    const model = geminiModel || DEFAULT_MODEL

    const maxLines = deepMode ? 350 : 150
    console.log(`[Worker] deepMode=${deepMode} | maxLines=${maxLines}`)
    const contextFiles = buildContext(selectedFiles, { maxLines })
    const totalContextTokens = contextFiles.reduce((sum, f) => sum + estimateTokens(f.content), 0)
    console.log(
      `[Worker] Contexto: ${contextFiles.length} arquivo(s) | ~${totalContextTokens.toLocaleString()} tokens estimados`,
    )

    if (deepMode) {
      sendToTab(tabId, { type: 'ANALYSIS_PROGRESS', step: 'Análise profunda — processando contexto expandido...', percent: 65 })
    } else {
      sendToTab(tabId, { type: 'ANALYSIS_PROGRESS', step: 'Analisando com IA...', percent: 65 })
    }

    console.log('[Worker] Usando key:', keyResolution.isSystemKey ? 'SYSTEM_KEY' : 'user key', '| key prefix:', keyResolution.key?.slice(0, 8))
    console.log(`[Worker] Modelo selecionado: ${model}`)

    if (deepMode && model === 'gemini-2.5-pro' && keyResolution.isSystemKey) {
      sendToTab(tabId, {
        type: 'ANALYSIS_ERROR',
        error: 'Análise profunda com Gemini Pro requer sua própria API key.',
        requiresApiKey: true,
      })
      return
    }

    const result = await analyzeWithGemini(
      keyResolution.key,
      owner,
      repo,
      contextFiles,
      model,
      (waitSecs) => {
        sendToTab(tabId, {
          type: 'ANALYSIS_PROGRESS',
          step: `Rate limit atingido — aguardando ${waitSecs}s e tentando novamente...`,
          percent: 66,
        })
      },
    )

    const state = await getState()
    await setState({ analysisCount: state.analysisCount + 1 })
    if (keyResolution.isSystemKey) {
      await markSystemKeyUsed()
    }
    await setCachedAnalysis(cacheKey, result)
    await setLastResult(`${owner}/${repo}`, result)

    sendToTab(tabId, { type: 'ANALYSIS_COMPLETE', result })
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Erro desconhecido'
    sendToTab(tabId, { type: 'ANALYSIS_ERROR', error })
  }
}

chrome.runtime.onMessage.addListener((message: { type: string; key?: string; model?: string; deepMode?: boolean }, _, sendResponse) => {
  if (message.type === 'SAVE_API_KEY') {
    saveUserApiKey(message.key ?? '')
      .then(() => sendResponse({ ok: true }))
      .catch((e: Error) => sendResponse({ ok: false, error: e.message }))
    return true
  }

  if (message.type === 'CLEAR_API_KEY') {
    clearUserApiKey()
      .then(() => sendResponse({ ok: true }))
      .catch((e: Error) => sendResponse({ ok: false, error: e.message }))
    return true
  }

  if (message.type === 'SAVE_GEMINI_MODEL') {
    setState({ geminiModel: message.model ?? DEFAULT_MODEL })
      .then(() => sendResponse({ ok: true }))
      .catch((e: Error) => sendResponse({ ok: false, error: e.message }))
    return true
  }

  if (message.type === 'SAVE_DEEP_MODE') {
    setState({ deepMode: !!message.deepMode })
      .then(() => sendResponse({ ok: true }))
      .catch((e: Error) => sendResponse({ ok: false, error: e.message }))
    return true
  }
})
