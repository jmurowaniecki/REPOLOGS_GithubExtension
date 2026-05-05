import { getKeyStatus } from '../shared/api-key-manager'
import { getState } from '../shared/storage'
import { GEMINI_MODELS, DEFAULT_MODEL } from '../shared/gemini'

async function render() {
  const [status, storageState] = await Promise.all([getKeyStatus(), getState()])
  const selectedModel = storageState.geminiModel || DEFAULT_MODEL
  const deepMode = storageState.deepMode

  const modelItems = GEMINI_MODELS.map(m => `
    <label class="model-item">
      <input type="radio" name="gemini-model" value="${m.id}" ${selectedModel === m.id ? 'checked' : ''}/>
      <span class="model-name">${m.name}</span>
      <span class="tag ${m.free ? 'tag-free' : 'tag-pro'}">${m.free ? 'Free' : 'Pro'}</span>
    </label>
  `).join('')

  const app = document.getElementById('app')!
  app.innerHTML = `
    <div class="header">
      <span class="logo" style="display: flex; gap: 5px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink:0"><path d="m13 13.5 2-2.5-2-2.5"/><path d="m21 21-4.3-4.3"/><path d="M9 8.5 7 11l2 2.5"/><circle cx="11" cy="11" r="8"/></svg> RepoLogs</span>
      <span class="badge-free">Beta</span>
    </div>

    <div class="body">

      <div class="status-card">
        <div class="status-row">
          <span class="status-label">Free query</span>
          <span class="status-value ${status.systemKeyUsed ? 'used' : 'ok'}">
            ${status.systemKeyUsed ? 'Used' : 'Available'}
          </span>
        </div>
        <div class="status-row">
          <span class="status-label">Your API key</span>
          <span class="status-value ${status.hasUserKey ? 'ok' : ''}">
            ${status.hasUserKey ? 'Configured' : 'Not configured'}
          </span>
        </div>
        <div class="status-row">
          <span class="status-label">Total analyses</span>
          <span class="status-value">${status.analysisCount}</span>
        </div>
      </div>

      <div class="input-group">
        <p class="section-label">Your Gemini API key</p>
        <input
          type="password"
          id="api-key-input"
          placeholder="AIza..."
          value=""
          autocomplete="new-password"
        />
        <p class="input-hint">
          Get for free at
          <a href="https://aistudio.google.com" target="_blank">aistudio.google.com</a>
          → Get API key
        </p>
      </div>

      <button class="btn-primary" id="save-btn">Save API key</button>

      ${status.hasUserKey ? `<button class="btn-danger" id="clear-btn">Remove API key</button>` : ''}

      ${status.hasUserKey ? `
        <div class="model-section">
          <p class="section-label">Gemini Model</p>
          <div class="model-list">${modelItems}</div>
        </div>
      ` : ''}

      <div class="toggle-section">
        <div class="toggle-row">
          <div class="toggle-info">
            <span class="toggle-label">Deep analysis</span>
            <span class="toggle-desc">350 lines per file · Normal: 150 lines</span>
          </div>
          <label class="toggle-switch" aria-label="Toggle deep analysis">
            <input type="checkbox" id="deep-mode-toggle" ${deepMode ? 'checked' : ''} />
            <span class="toggle-thumb"></span>
          </label>
        </div>
      </div>

      <div id="msg"></div>

    </div>

    <div class="footer">
      Public repos · Free
    </div>
  `

  document.getElementById('save-btn')?.addEventListener('click', async () => {
    const input = document.getElementById('api-key-input') as HTMLInputElement
    const key = input.value.trim()
    const msg = document.getElementById('msg')!

    if (!key) {
      msg.innerHTML = '<p class="error-msg">Enter a valid API key</p>'
      return
    }

    try {
      const response = await chrome.runtime.sendMessage({ type: 'SAVE_API_KEY', key })
      if (response?.ok) {
        msg.innerHTML = '<p class="success-msg">API key saved successfully!</p>'
        setTimeout(render, 1500)
      } else {
        msg.innerHTML = `<p class="error-msg">Error: ${response?.error ?? 'unknown'}</p>`
      }
    } catch (e) {
      msg.innerHTML = `<p class="error-msg">Error: ${(e as Error).message}</p>`
    }
  })

  document.getElementById('clear-btn')?.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'CLEAR_API_KEY' })
    render()
  })

  document.querySelectorAll<HTMLInputElement>('input[name="gemini-model"]').forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.checked) {
        chrome.runtime.sendMessage({ type: 'SAVE_GEMINI_MODEL', model: radio.value })
      }
    })
  })

  document.getElementById('deep-mode-toggle')?.addEventListener('change', (e) => {
    const checked = (e.target as HTMLInputElement).checked
    chrome.runtime.sendMessage({ type: 'SAVE_DEEP_MODE', deepMode: checked })
  })
}

render()
