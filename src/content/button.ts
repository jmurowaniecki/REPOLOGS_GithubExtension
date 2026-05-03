const BUTTON_ID = 'repolens-analyze-btn'
const EYE_BUTTON_ID = 'repolens-eye-btn'
const WRAPPER_ID = 'repolens-wrapper'
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
      background: var(--color-btn-bg, #11141d);
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
    [data-color-mode="light"] #${BUTTON_ID},
    [data-color-mode="auto"] #${BUTTON_ID} {
      color: var(--color-btn-text, #24292f);
      background: var(--color-btn-bg, #f6f8fa);
      border: 0.5px solid var(--color-btn-border, #d0d7de);
    }
    @media (prefers-color-scheme: dark) {
      [data-color-mode="auto"] #${BUTTON_ID} {
        color: var(--color-btn-text, #c9d1d9);
        background: var(--color-btn-bg, #11141d);
        border: 0.5px solid var(--color-btn-border, rgba(224, 240, 255, 0.66));
      }
    }

    #${BUTTON_ID}::before,
    #${BUTTON_ID}::after {
      content: '';
      position: absolute;
      left: -2px;
      top: -2px;
      border-radius: 8px;
      background: linear-gradient(45deg,
        #0d1117, #0d1117, #13171d,
        #343d47af, #13171d,
        #13171d, #0d1117, #0d1117
      );
      background-size: 400%;
      width: calc(100% + 4px);
      height: calc(100% + 4px);
      z-index: -1;
      animation: repolens-steam 30s linear infinite;
    }
    #${BUTTON_ID}::after {
      filter: blur(8px);
    }
    [data-color-mode="light"] #${BUTTON_ID}::before,
    [data-color-mode="light"] #${BUTTON_ID}::after {
      background: linear-gradient(45deg,
        #f6f8fa, #ffffff, #eaeef2,
        #c8d0daaf, #eaeef2,
        #eaeef2, #f6f8fa, #f6f8fa
      );
      background-size: 400%;
    }
    @media (prefers-color-scheme: light) {
      [data-color-mode="auto"] #${BUTTON_ID}::before,
      [data-color-mode="auto"] #${BUTTON_ID}::after {
        background: linear-gradient(45deg,
          #f6f8fa, #ffffff, #eaeef2,
          #c8d0daaf, #eaeef2,
          #eaeef2, #f6f8fa, #f6f8fa
        );
        background-size: 400%;
      }
    }

    @keyframes repolens-steam {
      0%   { background-position: 0 0; }
      50%  { background-position: 400% 0; }
      100% { background-position: 0 0; }
    }
    #${BUTTON_ID}:hover:not(:disabled) {
      background: var(--color-btn-hover-bg, #30363d);
      color: var(--color-fg-default, #e6edf3);
      border: 0.5px solid var(--color-btn-border, #a4b3c7);
    }
    [data-color-mode="light"] #${BUTTON_ID}:hover:not(:disabled),
    [data-color-mode="auto"] #${BUTTON_ID}:hover:not(:disabled) {
      background: var(--color-btn-hover-bg, #e8eaed);
      color: var(--color-fg-default, #24292f);
      border: 0.5px solid var(--color-btn-border, #b0bac4);
    }
    @media (prefers-color-scheme: dark) {
      [data-color-mode="auto"] #${BUTTON_ID}:hover:not(:disabled) {
        background: var(--color-btn-hover-bg, #30363d);
        color: var(--color-fg-default, #e6edf3);
        border: 0.5px solid var(--color-btn-border, #a4b3c7);
      }
    }

    #${BUTTON_ID}:active:not(:disabled) {
      transform: translateY(1px);
    }
    #${BUTTON_ID}:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    #${EYE_BUTTON_ID} {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      padding: 0;
      margin-left: 6px;
      color: var(--color-btn-text, #c9d1d9c4);
      background: var(--color-btn-bg, #0d1117);
      border: 0.5px solid var(--color-btn-border, rgba(224, 240, 255, 0.23));
      border-radius: 6px;
      cursor: pointer;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease, background 0.2s ease, color 0.2s ease;
    }
    [data-color-mode="light"] #${EYE_BUTTON_ID},
    [data-color-mode="auto"] #${EYE_BUTTON_ID} {
      color: var(--color-btn-text, #57606a);
      background: var(--color-btn-bg, #f6f8fa);
      border: 0.5px solid var(--color-btn-border, #d0d7de);
    }
    @media (prefers-color-scheme: dark) {
      [data-color-mode="auto"] #${EYE_BUTTON_ID} {
        color: var(--color-btn-text, #c9d1d9c4);
        background: var(--color-btn-bg, #0d1117);
        border: 0.5px solid var(--color-btn-border, rgba(224, 240, 255, 0.23));
      }
    }
    #${EYE_BUTTON_ID}.visible {
      opacity: 1;
      pointer-events: auto;
    }
    #${EYE_BUTTON_ID}:hover {
      background: var(--color-btn-hover-bg, #30363d);
      color: var(--color-fg-default, #e6edf3);
    }
    [data-color-mode="light"] #${EYE_BUTTON_ID}:hover,
    [data-color-mode="auto"] #${EYE_BUTTON_ID}:hover {
      background: var(--color-btn-hover-bg, #e8eaed);
      color: var(--color-fg-default, #24292f);
    }
    @media (prefers-color-scheme: dark) {
      [data-color-mode="auto"] #${EYE_BUTTON_ID}:hover {
        background: var(--color-btn-hover-bg, #30363d);
        color: var(--color-fg-default, #e6edf3);
      }
    }
    #${EYE_BUTTON_ID}:active {
      transform: translateY(1px);
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
    document.querySelector('.OverviewContent-module__Box_6__Y_Yb_') ??
    document.querySelector('.OverviewContent-module__Box_2__Di8Pb') ??
    document.querySelector('BorderGrid-row') ??
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
  wrapper.id = WRAPPER_ID
  wrapper.style.cssText = 'display: inline-flex; align-items: center; padding: 0 16px;'

  const btn = document.createElement('button')
  btn.id = BUTTON_ID
  btn.setAttribute('data-repolens', ALREADY_INJECTED)
  btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink:0"><path d="m13 13.5 2-2.5-2-2.5"/><path d="m21 21-4.3-4.3"/><path d="M9 8.5 7 11l2 2.5"/><circle cx="11" cy="11" r="8"/></svg><span>RepoLens</span>`

  btn.addEventListener('click', () => {
    onClick(repoInfo.owner, repoInfo.repo)
  })

  wrapper.appendChild(btn)

  // Insere antes do primeiro filho do target
  target.insertBefore(wrapper, target.firstChild)
}

export function injectEyeButton(onClick: () => void): void {
  const wrapper = document.getElementById(WRAPPER_ID)
  if (!wrapper) return

  let eye = document.getElementById(EYE_BUTTON_ID) as HTMLButtonElement | null
  if (eye) {
    eye.onclick = onClick
    return
  }

  eye = document.createElement('button')
  eye.id = EYE_BUTTON_ID
  eye.title = 'Ver última análise'
  eye.setAttribute('aria-label', 'Ver última análise')
  eye.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
  eye.onclick = onClick
  wrapper.appendChild(eye)
}

export function showEyeButton(): void {
  document.getElementById(EYE_BUTTON_ID)?.classList.add('visible')
}

export function setButtonLoading(loading: boolean): void {
  const btn = document.getElementById(BUTTON_ID) as HTMLButtonElement | null
  if (!btn) return
  btn.disabled = loading
  const span = btn.querySelector('span')
  if (span) span.textContent = loading ? 'Analisando...' : 'RepoLens'
}