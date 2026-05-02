const BUTTON_ID = 'repolens-analyze-btn'
const ALREADY_INJECTED = 'repolens-injected'

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
  // Evita injeção dupla em SPA navigation
  if (document.getElementById(BUTTON_ID)) return

  const repoInfo = parseRepoFromUrl()
  if (!repoInfo) return

  const target = findInjectionPoint()
  if (!target) return

  const wrapper = document.createElement('div')
  wrapper.style.cssText = `
    display: inline-flex;
    margin: 8px 0;
    padding: 0 16px;
  `

  const btn = document.createElement('button')
  btn.id = BUTTON_ID
  btn.setAttribute('data-repolens', ALREADY_INJECTED)
  btn.textContent = '🔍 Analisar repo'
  btn.style.cssText = `
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 14px;
    font-size: 13px;
    font-weight: 500;
    color: #ffffff;
    background: #7C3AED;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  `

  btn.addEventListener('mouseenter', () => {
    btn.style.background = '#6D28D9'
  })
  btn.addEventListener('mouseleave', () => {
    btn.style.background = '#7C3AED'
  })
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
  btn.textContent = loading ? '⏳ Analisando...' : '🔍 Analisar repo'
  btn.style.opacity = loading ? '0.7' : '1'
}