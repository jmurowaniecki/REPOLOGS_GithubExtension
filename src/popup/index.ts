import { getKeyStatus } from '../shared/api-key-manager'
import { getState } from '../shared/storage'

async function render() {
  const status = await getKeyStatus()
  const state = await getState()

  const app = document.getElementById('app')!
  app.innerHTML = `
    <div class="header">
      <span class="logo">🔍 RepoLens</span>
      <span class="badge-free">Beta</span>
    </div>

    <div class="body">

      <div class="status-card">
        <div class="status-row">
          <span class="status-label">Consulta gratuita</span>
          <span class="status-value ${status.systemKeyUsed ? 'used' : 'ok'}">
            ${status.systemKeyUsed ? 'Utilizada' : 'Disponível'}
          </span>
        </div>
        <div class="status-row">
          <span class="status-label">API key própria</span>
          <span class="status-value ${status.hasUserKey ? 'ok' : ''}">
            ${status.hasUserKey ? 'Configurada' : 'Não configurada'}
          </span>
        </div>
        <div class="status-row">
          <span class="status-label">Total de análises</span>
          <span class="status-value">${status.analysisCount}</span>
        </div>
      </div>

      <div class="input-group">
        <p class="section-label">Sua API key do Gemini</p>
        <input
          type="password"
          id="api-key-input"
          placeholder="AIza..."
          value="${state.userApiKey ?? ''}"
        />
        <p class="input-hint">
          Obtenha grátis em
          <a href="https://aistudio.google.com" target="_blank">aistudio.google.com</a>
          → Get API key
        </p>
      </div>

      <button class="btn-primary" id="save-btn">Salvar API key</button>

      ${status.hasUserKey ? `<button class="btn-danger" id="clear-btn">Remover API key</button>` : ''}

      <div id="msg"></div>

    </div>

    <div class="footer">
      Repos públicos · Gemini Flash-Lite · Gratuito
    </div>
  `

  document.getElementById('save-btn')?.addEventListener('click', async () => {
    const input = document.getElementById('api-key-input') as HTMLInputElement
    const key = input.value.trim()
    const msg = document.getElementById('msg')!

    if (!key) {
      msg.innerHTML = '<p class="error-msg">Insira uma API key válida</p>'
      return
    }

    try {
      const response = await chrome.runtime.sendMessage({ type: 'SAVE_API_KEY', key })
      if (response?.ok) {
        msg.innerHTML = '<p class="success-msg">API key salva com sucesso!</p>'
        setTimeout(render, 1500)
      } else {
        msg.innerHTML = `<p class="error-msg">Erro: ${response?.error ?? 'desconhecido'}</p>`
      }
    } catch (e) {
      msg.innerHTML = `<p class="error-msg">Erro: ${(e as Error).message}</p>`
    }
  })

  document.getElementById('clear-btn')?.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'CLEAR_API_KEY' })
    render()
  })
}

render()
