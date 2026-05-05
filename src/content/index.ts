import { injectButton, injectEyeButton, showEyeButton, setButtonLoading } from './button'
import { showLoading, showResult, showError, closeModal } from './modal'
import { getLastResult } from '../shared/storage'
import type { MessageType } from '../shared/types'

async function init() {
  injectButton((owner, repo) => {
    setButtonLoading(true)
    showLoading('Starting analysis...', 0)
    chrome.runtime.sendMessage({
      type: 'ANALYZE_REPO',
      owner,
      repo,
    } satisfies MessageType).catch((err: Error) => {
      setButtonLoading(false)
      showError(`Failed to contact extension: ${err.message}`)
    })
  })

  const repoMatch = location.pathname.match(/^\/([^/]+)\/([^/]+)/)
  if (repoMatch) {
    const lastResult = await getLastResult(`${repoMatch[1]}/${repoMatch[2]}`)
    if (lastResult) {
      injectEyeButton(() => showResult(lastResult))
      showEyeButton()
    }
  }
}

chrome.runtime.onMessage.addListener((message: MessageType) => {
  if (message.type === 'ANALYSIS_PROGRESS') {
    showLoading(message.step, message.percent)
  }

  if (message.type === 'ANALYSIS_COMPLETE') {
    setButtonLoading(false)
    showResult(message.result)
    injectEyeButton(() => showResult(message.result))
    showEyeButton()
  }

  if (message.type === 'ANALYSIS_ERROR') {
    setButtonLoading(false)
    showError(message.error, message.requiresApiKey)
  }
})

// Re-inject button after GitHub SPA navigation
let lastUrl = location.href
const observer = new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href
    closeModal()
    setTimeout(init, 500)
  }
})
observer.observe(document.body, { subtree: true, childList: true })

init()
