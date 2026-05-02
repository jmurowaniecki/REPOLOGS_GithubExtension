const BUTTON_ID = 'repolens-analyze-btn'
const ALREADY_INJECTED = 'repolens-injected'
const STYLE_ID = 'repolens-btn-styles'

function injectButtonStyles(): void {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    #${BUTTON_ID} {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 14px;
      font-size: 13px;
      font-weight: 500;
      line-height: 20px;
      letter-spacing: 0.02em;
      color: var(--color-btn-text, #c9d1d9);
      background: var(--color-btn-bg, #21262d);
      border: 0.5px solid var(--color-btn-border, rgba(224, 240, 255, 0.66));
      border-radius: 6px;
      cursor: pointer;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', sans-serif;
      white-space: nowrap;
      position: relative;
      z-index: 0;
      overflow: visible;
      transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
    }
    #${BUTTON_ID}::before,
    #${BUTTON_ID}::after {
      content: '';
      position: absolute;
      left: -2px;
      top: -2px;
      border-radius: 8px;
      background: linear-gradient(45deg,
        #21262dc5, #252a30c9, #2c3238b9,
        rgba(200, 210, 220, 0.18), #2e343a8c,
        #262b31c0, #21262dc2, #21262db9
      );
      background-size: 400%;
      width: calc(100% + 4px);
      height: calc(100% + 4px);
      z-index: -1;
      animation: repolens-steam 40s linear infinite;
    }
    #${BUTTON_ID}::after {
      filter: blur(8px);
    }
    @keyframes repolens-steam {
      0%   { background-position: 0 0; }
      50%  { background-position: 400% 0; }
      100% { background-position: 0 0; }
    }
    #${BUTTON_ID}:hover:not(:disabled) {
      background: var(--color-btn-hover-bg, #30363d);
      color: var(--color-fg-default, #e6edf3);
      border: 0.5px solid var(--color-btn-border, rgb(224, 240, 255));
    }

    #${BUTTON_ID}:active:not(:disabled) {
      transform: translateY(1px);
    }
    #${BUTTON_ID}:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  `
  document.head.appendChild(style)
}

function parseRepoFromUrl(): { owner: string; repo: string } | null {
  const match = location.pathname.match(/^\/([^/]+)\/([^/]+)/)
  if (!match) return null

  // Garante que estamos na raiz do repo, não em subpáginas irrelevantes
  const pathParts = location.pathname.split('/').filter(Boolean)
  if (pathParts.length < 2) return null

  // Exclui páginas que não são repos
  const skipSections = ['settings', 'marketplace', 'explore', 'notifications']
  if (skipSections.includes(pathParts[0])) return null

  return { owner: match[1], repo: match[2] }
}

function findInjectionPoint(): Element | null {
  // Tenta o header principal do repo
  return (
    document.querySelector('.repository-content') ??
    document.querySelector('#repository-container-header') ??
    document.querySelector('.pagehead-actions') ??
    null
  )
}

export function injectButton(onClick: (owner: string, repo: string) => void): void {
  if (document.getElementById(BUTTON_ID)) return

  const repoInfo = parseRepoFromUrl()
  if (!repoInfo) return

  const target = findInjectionPoint()
  if (!target) return

  injectButtonStyles()

  const wrapper = document.createElement('div')
  wrapper.style.cssText = 'display: inline-flex; margin: 8px 0; padding: 0 16px;'

  const btn = document.createElement('button')
  btn.id = BUTTON_ID
  btn.setAttribute('data-repolens', ALREADY_INJECTED)
  btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink:0"><path d="m13 13.5 2-2.5-2-2.5"/><path d="m21 21-4.3-4.3"/><path d="M9 8.5 7 11l2 2.5"/><circle cx="11" cy="11" r="8"/></svg><span>REPOLENS</span>`

  btn.addEventListener('click', () => {
    onClick(repoInfo.owner, repoInfo.repo)
  })

  wrapper.appendChild(btn)

  // Insere antes do primeiro filho do target
  target.insertBefore(wrapper, target.firstChild)
}

export function setButtonLoading(loading: boolean): void {
  const btn = document.getElementById(BUTTON_ID) as HTMLButtonElement | null
  if (!btn) return
  btn.disabled = loading
  const span = btn.querySelector('span')
  if (span) span.textContent = loading ? 'Analisando...' : 'Analisar repo'
}