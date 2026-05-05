import type { AnalysisResult } from '../shared/types'
import { GEMINI_MODELS, DEFAULT_MODEL } from '../shared/gemini'

const HOST_ID = 'repologs-modal-host'
const CIRC = +(2 * Math.PI * 40).toFixed(2) // r=40 → 251.33

// ── Utilities ──────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function isDark(): boolean {
  const mode = document.documentElement.getAttribute('data-color-mode')
  if (mode === 'dark') return true
  if (mode === 'light') return false
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

// ── Design helpers ─────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 85) return '#1a7f37'
  if (score >= 70) return '#0969da'
  if (score >= 55) return '#9a6700'
  if (score >= 40) return '#bc4c00'
  return '#cf222e'
}

interface GradeInfo { color: string; bg: string; label: string }
const GRADE_MAP: Record<string, GradeInfo> = {
  A: { color: '#1a7f37', bg: '#dafbe1', label: 'Excelente' },
  B: { color: '#0969da', bg: '#ddf4ff', label: 'Bom' },
  C: { color: '#9a6700', bg: '#fff8c5', label: 'Regular' },
  D: { color: '#bc4c00', bg: '#fff1e5', label: 'Ruim' },
  F: { color: '#cf222e', bg: '#ffebe9', label: 'Crítico' },
}
function gradeInfo(grade: string): GradeInfo {
  return GRADE_MAP[grade] ?? { color: '#636c76', bg: '#f6f8fa', label: '-' }
}

const ARCH_LABEL: Record<string, string> = {
  excellent: 'Excelente', good: 'Boa', fair: 'Regular', poor: 'Fraca',
}
const PRI_LABEL: Record<string, string> = {
  high: 'Alta', medium: 'Média', low: 'Baixa',
}
const PRI_CLASS: Record<string, string> = {
  high: 'rl-badge--red', medium: 'rl-badge--amber', low: 'rl-badge--green',
}

// ── SVG score ring ─────────────────────────────────────────────────

function scoreRing(score: number, color: string): string {
  const offset = +(CIRC * (1 - score / 100)).toFixed(2)
  return `
    <svg viewBox="0 0 100 100" width="88" height="88" class="rl-ring" aria-hidden="true">
      <circle class="rl-ring-track" cx="50" cy="50" r="40"/>
      <circle class="rl-ring-fill" cx="50" cy="50" r="40"
        stroke="${color}"
        stroke-dasharray="${CIRC}"
        style="--rl-circ:${CIRC};--rl-target:${offset}"/>
    </svg>`
}

// ── CSS ────────────────────────────────────────────────────────────

function buildCSS(): string {
  return `
    :host { all: initial; }
    * { box-sizing: border-box; }

    /* ── Theme tokens (on overlay, inherited by all children) ── */
    .rl-ov {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      --bg:        #ffffff;
      --bg-sub:    #f6f8fa;
      --bg-in:     #eaeef2;
      --bdr:       #d0d7de;
      --sh:        0 8px 24px rgba(140,149,159,.2), 0 2px 6px rgba(140,149,159,.12);
      --tx:        #1f2328;
      --tx-m:      #636c76;
      --green:     #1a7f37; --green-bg: #dafbe1;
      --amber:     #9a6700; --amber-bg: #fff8c5;
      --red:       #cf222e; --red-bg:   #ffebe9;
      --blue:      #0969da; --blue-bg:  #ddf4ff;
      --purple:    #8250df; --purple-bg:#fbefff;
      --r:         12px;
    }
    .rl-ov.dk {
      --bg:        #161b22;
      --bg-sub:    #0d1117;
      --bg-in:     #21262d;
      --bdr:       #30363d;
      --sh:        0 8px 32px rgba(0,0,0,.55), 0 2px 8px rgba(0,0,0,.3);
      --tx:        #e6edf3;
      --tx-m:      #8b949e;
      --green:     #3fb950; --green-bg: rgba(63,185,80,.13);
      --amber:     #d29922; --amber-bg: rgba(210,153,34,.13);
      --red:       #f85149; --red-bg:   rgba(248,81,73,.13);
      --blue:      #58a6ff; --blue-bg:  rgba(88,166,255,.13);
      --purple:    #bc8cff; --purple-bg:rgba(188,140,255,.13);
    }

    /* ── Overlay backdrop ── */
    .rl-ov {
      position: fixed; inset: 0; z-index: 999999;
      background: rgba(1,4,9,.65);
      backdrop-filter: blur(3px) saturate(120%);
      display: flex; align-items: center; justify-content: center;
      padding: 16px;
      animation: rl-fade .18s ease;
    }
    @keyframes rl-fade { from { opacity:0 } to { opacity:1 } }

    /* ── Result modal ── */
    .rl-modal {
      background: var(--bg); border: 1px solid var(--bdr);
      border-radius: var(--r); box-shadow: var(--sh);
      width: 100%; max-width: 680px; max-height: 88vh;
      display: flex; flex-direction: column; overflow: hidden;
      animation: rl-up .24s cubic-bezier(.16,1,.3,1);
    }
    @keyframes rl-up {
      from { transform: translateY(22px); opacity:0 }
      to   { transform: translateY(0);    opacity:1 }
    }

    /* Header */
    .rl-hd {
      display: flex; justify-content: space-between; align-items: center;
      padding: 12px 20px; border-bottom: 1px solid var(--bdr);
      background: var(--bg-sub); flex-shrink: 0;
    }
    .rl-brand { display: flex; align-items: center; gap: 8px; }
    .rl-bname { font-size: 14px; font-weight: 600; color: var(--tx); letter-spacing: -.2px; }
    .rl-pw {
      font-size: 10px; font-weight: 500; padding: 2px 7px; border-radius: 99px;
      background: var(--purple-bg); color: var(--purple);
      border: 1px solid currentColor; opacity: .8;
    }
    .rl-hactions { display: flex; align-items: center; gap: 6px; }
    .rl-xbtn {
      display: flex; align-items: center; justify-content: center;
      width: 26px; height: 26px; padding: 0;
      border: 1px solid var(--bdr); border-radius: 6px;
      background: var(--bg); color: var(--tx-m); cursor: pointer;
      transition: background .1s, color .1s;
    }
    .rl-xbtn:hover { background: var(--bg-in); color: var(--tx); }

    /* Scrollable body */
    .rl-bd { overflow-y: auto; flex: 1; padding: 20px; display: flex; flex-direction: column; gap: 16px; }

    /* ── Hero: ring + grade + summary ── */
    .rl-hero { display: flex; align-items: center; gap: 20px; }

    .rl-rw { position: relative; width: 88px; height: 88px; flex-shrink: 0; }
    .rl-ring { display: block; }
    .rl-ring-track { fill: none; stroke: var(--bg-in); stroke-width: 8; }
    .rl-ring-fill {
      fill: none; stroke-width: 8; stroke-linecap: round;
      transform-origin: 50% 50%; transform: rotate(-90deg);
      animation: rl-ring .9s .1s cubic-bezier(.16,1,.3,1) both;
    }
    @keyframes rl-ring {
      from { stroke-dashoffset: var(--rl-circ) }
      to   { stroke-dashoffset: var(--rl-target) }
    }
    .rl-rov {
      position: absolute; inset: 0;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
    }
    .rl-snum { font-size: 22px; font-weight: 700; color: var(--tx); line-height: 1; }
    .rl-ssub { font-size: 10px; color: var(--tx-m); }

    .rl-hi { flex: 1; min-width: 0; }
    .rl-grow { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .rl-gbadge {
      display: inline-flex; align-items: center;
      font-size: 12px; font-weight: 600; padding: 3px 10px;
      border-radius: 99px; border: 1px solid transparent;
    }
    .rl-sum { font-size: 13px; color: var(--tx); line-height: 1.6; margin: 0 0 10px; }
    .rl-chips { display: flex; flex-wrap: wrap; gap: 5px; }
    .rl-chip {
      font-size: 11px; padding: 2px 8px; border-radius: 99px;
      background: var(--bg-sub); color: var(--tx-m); border: 1px solid var(--bdr);
    }

    /* Architecture card */
    .rl-arch {
      display: flex; align-items: flex-start; gap: 12px;
      padding: 12px 14px; border-radius: 8px;
      background: var(--bg-sub); border: 1px solid var(--bdr);
    }
    .rl-aico { font-size: 18px; line-height: 1.4; flex-shrink: 0; }
    .rl-ameta { display: flex; align-items: center; gap: 6px; margin-bottom: 3px; }
    .rl-albl { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: var(--tx-m); font-weight: 500; }
    .rl-arat { font-size: 12px; font-weight: 600; color: var(--tx); }
    .rl-anotes { font-size: 12px; color: var(--tx-m); line-height: 1.55; margin: 0; }

    /* 2-col grid */
    .rl-g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    @media (max-width: 480px) { .rl-g2 { grid-template-columns: 1fr; } }

    /* Section */
    .rl-sec { display: flex; flex-direction: column; gap: 7px; }
    .rl-ttl {
      font-size: 11px; font-weight: 600; margin: 0; letter-spacing: .05em;
      text-transform: uppercase; padding-bottom: 6px;
      border-bottom: 1px solid; display: flex; align-items: center; gap: 5px;
    }
    .rl-ttl--green { color: var(--green); border-color: var(--green-bg); }
    .rl-ttl--amber { color: var(--amber); border-color: var(--amber-bg); }
    .rl-ttl--red   { color: var(--red);   border-color: var(--red-bg);   }
    .rl-ttl--blue  { color: var(--blue);  border-color: var(--blue-bg);  }

    /* List */
    .rl-ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
    .rl-li {
      display: flex; align-items: flex-start; gap: 8px;
      font-size: 12px; line-height: 1.5; padding: 6px 10px; border-radius: 6px; color: var(--tx);
    }
    .rl-li--green { background: var(--green-bg); }
    .rl-li--amber { background: var(--amber-bg); }
    .rl-li--red   { background: var(--red-bg); }
    .rl-li--muted { background: var(--bg-sub); color: var(--tx-m); }
    .rl-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; margin-top: 4px; }
    .rl-li--green .rl-dot { background: var(--green); }
    .rl-li--amber .rl-dot { background: var(--amber); }
    .rl-li--red   .rl-dot { background: var(--red); }
    .rl-li--muted .rl-dot { background: var(--tx-m); }

    /* Recommendations */
    .rl-recs { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
    .rl-rec { display: flex; align-items: flex-start; gap: 8px; color: var(--tx); }
    .rl-rtx { font-size: 12px; line-height: 1.55; flex: 1; }
    .rl-badge {
      display: inline-flex; align-items: center; flex-shrink: 0;
      font-size: 10px; font-weight: 600; padding: 1px 6px;
      border-radius: 99px; border: 1px solid; white-space: nowrap; margin-top: 2px;
    }
    .rl-badge--red   { background: var(--red-bg);   color: var(--red);   border-color: var(--red);   }
    .rl-badge--amber { background: var(--amber-bg); color: var(--amber); border-color: var(--amber); }
    .rl-badge--green { background: var(--green-bg); color: var(--green); border-color: var(--green); }

    /* Footer */
    .rl-ft {
      font-size: 11px; color: var(--tx-m); text-align: center;
      padding: 10px 20px; border-top: 1px solid var(--bdr);
      background: var(--bg-sub); flex-shrink: 0;
    }

    /* ── Loading card ── */
    .rl-lc {
      background: var(--bg); border: 1px solid var(--bdr);
      border-radius: var(--r); box-shadow: var(--sh);
      padding: 40px 48px; text-align: center;
      min-width: 280px; max-width: 380px;
      position: relative;
      animation: rl-up .22s cubic-bezier(.16,1,.3,1);
    }
    .rl-spin {
      width: 40px; height: 40px; margin: 0 auto 20px;
      border: 3px solid var(--bg-in); border-top-color: var(--purple);
      border-radius: 50%; animation: rl-s .65s linear infinite;
    }
    @keyframes rl-s { to { transform: rotate(360deg) } }
    .rl-step { font-size: 13px; font-weight: 500; color: var(--tx); margin: 0 0 14px; }
    .rl-bar { height: 3px; background: var(--bg-in); border-radius: 99px; overflow: hidden; margin-bottom: 6px; }
    .rl-fill {
      height: 100%; background: linear-gradient(90deg, var(--purple) 0%, #bc8cff 100%);
      border-radius: 99px; transition: width .4s ease;
    }
    .rl-pct { font-size: 11px; color: var(--tx-m); margin: 0 0 16px; }

    /* ── Error card ── */
    .rl-ec {
      background: var(--bg); border: 1px solid var(--bdr);
      border-radius: var(--r); box-shadow: var(--sh);
      padding: 36px 40px; text-align: center;
      max-width: 400px; min-width: 280px;
      position: relative;
      animation: rl-up .22s cubic-bezier(.16,1,.3,1);
    }
    .rl-xbtn--corner {
      position: absolute; top: 10px; right: 10px;
    }
    .rl-eico { font-size: 36px; margin-bottom: 12px; }
    .rl-ettl { font-size: 16px; font-weight: 600; color: var(--tx); margin: 0 0 8px; }
    .rl-emsg { font-size: 13px; color: var(--tx-m); line-height: 1.55; margin: 0 0 14px; }
    .rl-ehint { font-size: 12px; color: var(--tx-m); line-height: 1.55; margin: 0 0 16px; }
    .rl-ehint a { color: var(--blue); }

    /* ── Shared button styles ── */
    .rl-btn {
      display: inline-flex; align-items: center; justify-content: center;
      padding: 6px 16px; font-size: 13px; font-weight: 500;
      border-radius: 6px; cursor: pointer; border: 1px solid; transition: opacity .12s;
    }
    .rl-btn--primary { background: var(--purple); color: #fff; border-color: var(--purple); }
    .rl-btn--primary:hover { opacity: .87; }
    .rl-btn--secondary { background: var(--bg); color: var(--tx); border-color: var(--bdr); }
    .rl-btn--secondary:hover { background: var(--bg-sub); }
    .rl-btn:disabled { opacity: .5; cursor: default; }

    /* ── API key form (shared across loading/result/error/key-form) ── */
    .rl-keyrow {
      display: flex; gap: 6px; width: 100%; margin-bottom: 8px;
    }
    .rl-keyinput {
      flex: 1; padding: 6px 10px; font-size: 13px; font-family: monospace;
      border: 1px solid var(--bdr); border-radius: 6px;
      background: var(--bg-sub); color: var(--tx); outline: none;
    }
    .rl-keyinput:focus { border-color: var(--purple); box-shadow: 0 0 0 2px rgba(130,80,223,.2); }
    .rl-keymsg { font-size: 12px; margin: 0; min-height: 16px; }
    .rl-keymsg--ok  { color: var(--green); }
    .rl-keymsg--err { color: var(--red); }

    /* subtle text link for "Configurar API key" in loading/error cards */
    .rl-keylnk {
      display: inline-flex; align-items: center; gap: 4px;
      background: none; border: none; cursor: pointer;
      font-size: 11px; color: var(--tx-m); padding: 4px 8px;
      border-radius: 6px; transition: background .1s, color .1s;
      margin-top: 8px;
    }
    .rl-keylnk:hover { background: var(--bg-sub); color: var(--purple); }

    /* ── Model selector ── */
    .rl-model-section { width: 100%; margin-top: 14px; text-align: left; }
    .rl-model-lbl {
      font-size: 11px; font-weight: 600; color: var(--tx-m);
      text-transform: uppercase; letter-spacing: .05em; margin-bottom: 6px;
    }
    .rl-model-list {
      max-height: 152px; overflow-y: auto;
      border: 1px solid var(--bdr); border-radius: 8px;
      background: var(--bg-sub);
    }
    .rl-model-item {
      display: flex; align-items: center; gap: 8px;
      padding: 7px 10px; cursor: pointer;
      border-bottom: 1px solid var(--bdr); transition: background .1s;
    }
    .rl-model-item:last-child { border-bottom: none; }
    .rl-model-item:hover { background: var(--bg-in); }
    .rl-model-item input[type="radio"] { accent-color: var(--purple); flex-shrink: 0; cursor: pointer; }
    .rl-model-name { font-size: 12px; color: var(--tx); flex: 1; }
    .rl-tag {
      font-size: 10px; font-weight: 600; padding: 1px 6px;
      border-radius: 99px; border: 1px solid; flex-shrink: 0;
    }
    .rl-tag--free { background: var(--green-bg); color: var(--green); border-color: var(--green); }
    .rl-tag--pro  { background: var(--amber-bg); color: var(--amber); border-color: var(--amber); }

    /* ── Deep mode toggle ── */
    .rl-toggle-row {
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      width: 100%; margin-top: 14px; padding: 10px 12px;
      background: var(--bg-sub); border: 1px solid var(--bdr); border-radius: 8px;
      text-align: left;
    }
    .rl-toggle-info { display: flex; flex-direction: column; gap: 2px; }
    .rl-toggle-lbl { font-size: 13px; font-weight: 500; color: var(--tx); }
    .rl-toggle-desc { font-size: 11px; color: var(--tx-m); }
    .rl-toggle-sw {
      position: relative; width: 32px; height: 18px; flex-shrink: 0; cursor: pointer;
    }
    .rl-toggle-sw input { opacity: 0; width: 0; height: 0; position: absolute; }
    .rl-toggle-thumb {
      position: absolute; inset: 0; background: var(--bdr); border-radius: 99px;
      transition: background 0.2s ease;
    }
    .rl-toggle-thumb::before {
      content: ''; position: absolute;
      width: 12px; height: 12px; left: 3px; top: 3px;
      background: #fff; border-radius: 50%; transition: transform 0.2s ease;
    }
    .rl-toggle-sw input:checked + .rl-toggle-thumb { background: var(--purple); }
    .rl-toggle-sw input:checked + .rl-toggle-thumb::before { transform: translateX(14px); }
  `
}

// ── HTML builders ──────────────────────────────────────────────────

function wrapOverlay(content: string, dark: boolean, id?: string): string {
  return `<div class="rl-ov${dark ? ' dk' : ''}"${id ? ` id="${id}"` : ''}>${content}</div>`
}

function closeXIcon(): string {
  return `<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.749.749 0 011.275.326.749.749 0 01-.215.734L9.06 8l3.22 3.22a.749.749 0 01-.326 1.275.749.749 0 01-.734-.215L8 9.06l-3.22 3.22a.751.751 0 01-1.042-.018.751.751 0 01-.018-1.042L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/></svg>`
}

function keyIcon(): string {
  return `<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M6.5 0a6.5 6.5 0 0 1 5.25 10.325l3.849 3.851a.75.75 0 0 1-1.06 1.06l-3.851-3.849A6.5 6.5 0 1 1 6.5 0zm0 1.5a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm0 1.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/></svg>`
}

function keyFormFields(): string {
  return `
    <div class="rl-keyrow">
      <input class="rl-keyinput" id="rl-key-input" type="password" placeholder="AIza..." autocomplete="new-password"/>
      <button class="rl-btn rl-btn--primary" id="rl-save-key">Salvar</button>
    </div>
    <p class="rl-keymsg" id="rl-key-msg"></p>
  `
}

function deepModeToggleHTML(): string {
  return `
    <label class="rl-toggle-row" id="rl-deep-toggle-row">
      <div class="rl-toggle-info">
        <span class="rl-toggle-lbl">Análise profunda</span>
        <span class="rl-toggle-desc">350 linhas por arquivo · Normal: 150 linhas</span>
      </div>
      <span class="rl-toggle-sw" aria-label="Alternar análise profunda">
        <input type="checkbox" id="rl-deep-mode"/>
        <span class="rl-toggle-thumb"></span>
      </span>
    </label>
  `
}

function modelSelectorHTML(): string {
  const items = GEMINI_MODELS.map(m => `
    <label class="rl-model-item">
      <input type="radio" name="rl-gemini-model" value="${m.id}"/>
      <span class="rl-model-name">${esc(m.name)}</span>
      <span class="rl-tag ${m.free ? 'rl-tag--free' : 'rl-tag--pro'}">${m.free ? 'Grátis' : 'Pro'}</span>
    </label>
  `).join('')
  return `
    <div class="rl-model-section" id="rl-model-section" style="display:none">
      <p class="rl-model-lbl">Modelo Gemini</p>
      <div class="rl-model-list">${items}</div>
    </div>
  `
}

function loadingHTML(step: string, percent: number, dark: boolean): string {
  return wrapOverlay(`
    <div class="rl-lc">
      <button class="rl-xbtn rl-xbtn--corner" id="rl-close" aria-label="Fechar">${closeXIcon()}</button>
      <div class="rl-spin"></div>
      <p class="rl-step">${esc(step)}</p>
      <div class="rl-bar"><div class="rl-fill" style="width:${percent}%"></div></div>
      <p class="rl-pct">${percent}%</p>
      
    </div>
  `, dark)
}

function errorHTML(message: string, requiresKey: boolean, dark: boolean): string {
  const action = requiresKey
    ? `<p class="rl-ehint">
        Obtenha sua key gratuita em
        <a href="https://aistudio.google.com" target="_blank">aistudio.google.com</a>
        → <strong>Get API key</strong>
      </p>
      ${keyFormFields()}`
    : `<button class="rl-btn rl-btn--secondary" id="rl-close-btn">Fechar</button>
       <button class="rl-keylnk" id="rl-key-btn">${keyIcon()} Configurar API key</button>`

  return wrapOverlay(`
    <div class="rl-ec">
      <button class="rl-xbtn rl-xbtn--corner" id="rl-close" aria-label="Fechar">${closeXIcon()}</button>
      <div class="rl-eico">${requiresKey ? '🔑' : '⚠️'}</div>
      <h3 class="rl-ettl">${requiresKey ? 'API key necessária' : 'Erro na análise'}</h3>
      <p class="rl-emsg">${esc(message)}</p>
      ${action}
    </div>
  `, dark)
}

function keyFormCardHTML(dark: boolean): string {
  return wrapOverlay(`
    <div class="rl-ec">
      <button class="rl-xbtn rl-xbtn--corner" id="rl-close" aria-label="Fechar">${closeXIcon()}</button>
      <div class="rl-eico">🔑</div>
      <h3 class="rl-ettl">Configurar API key</h3>
      <p class="rl-emsg">Cole sua Gemini API key abaixo.</p>
      <p class="rl-ehint">
        Obtenha gratuitamente em
        <a href="https://aistudio.google.com" target="_blank">aistudio.google.com</a>
        → <strong>Get API key</strong>
      </p>
      ${keyFormFields()}
      ${modelSelectorHTML()}
      ${deepModeToggleHTML()}
      <button class="rl-keylnk" id="rl-cancel">Cancelar</button>
    </div>
  `, dark)
}

function resultHTML(r: AnalysisResult, dark: boolean, modelName: string): string {
  const gc = gradeInfo(r.grade)
  const sc = scoreColor(r.score)

  const li = (text: string, cls: string) =>
    `<li class="rl-li ${cls}"><span class="rl-dot"></span><span>${esc(text)}</span></li>`

  const strengths = r.strengths.map(s => li(s, 'rl-li--green')).join('')
  const weaknesses = r.weaknesses.map(w => li(w, 'rl-li--amber')).join('')
  const inconsistencies = r.inconsistencies.length
    ? r.inconsistencies.map(i => li(i, 'rl-li--red')).join('')
    : li('Nenhuma inconsistência detectada', 'rl-li--muted')

  const chips = r.techStack.map(t => `<span class="rl-chip">${esc(t)}</span>`).join('')

  const recs = r.recommendations.map(rec => `
    <li class="rl-rec">
      <span class="rl-badge ${PRI_CLASS[rec.priority] ?? 'rl-badge--green'}">${PRI_LABEL[rec.priority] ?? rec.priority}</span>
      <span class="rl-rtx">${esc(rec.text)}</span>
    </li>
  `).join('')

  const security = r.securityFlags.length ? `
    <section class="rl-sec">
      <h3 class="rl-ttl rl-ttl--red">⚑ Flags de segurança</h3>
      <ul class="rl-ul">${r.securityFlags.map(f => li(f, 'rl-li--red')).join('')}</ul>
    </section>
  ` : ''

  return wrapOverlay(`
    <div class="rl-modal">

      <header class="rl-hd">
        <div class="rl-brand">
          <span class="rl-bname">RepoLogs</span>
          <span class="rl-pw">${esc(modelName)}</span>
        </div>
        <div class="rl-hactions">
          <button class="rl-xbtn" id="rl-key-btn" aria-label="Configurar API key" title="Configurar API key">
            ${keyIcon()}
          </button>
          <button class="rl-xbtn" id="rl-close" aria-label="Fechar">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
              <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.749.749 0 011.275.326.749.749 0 01-.215.734L9.06 8l3.22 3.22a.749.749 0 01-.326 1.275.749.749 0 01-.734-.215L8 9.06l-3.22 3.22a.751.751 0 01-1.042-.018.751.751 0 01-.018-1.042L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/>
            </svg>
          </button>
        </div>
      </header>

      <div class="rl-bd">

        <div class="rl-hero">
          <div class="rl-rw">
            ${scoreRing(r.score, sc)}
            <div class="rl-rov">
              <span class="rl-snum">${r.score}</span>
              <span class="rl-ssub">/100</span>
            </div>
          </div>
          <div class="rl-hi">
            <div class="rl-grow">
              <span class="rl-gbadge" style="color:${gc.color};background:${gc.bg};border-color:${gc.color}55">
                ${esc(r.grade)} — ${gc.label}
              </span>
            </div>
            <p class="rl-sum">${esc(r.summary)}</p>
            ${chips ? `<div class="rl-chips">${chips}</div>` : ''}
          </div>
        </div>

        <div class="rl-arch">
          <span class="rl-aico">🏗</span>
          <div>
            <div class="rl-ameta">
              <span class="rl-albl">Arquitetura</span>
              <span class="rl-arat">${ARCH_LABEL[r.architecture.rating] ?? r.architecture.rating}</span>
            </div>
            <p class="rl-anotes">${esc(r.architecture.notes)}</p>
          </div>
        </div>

        <div class="rl-g2">
          <section class="rl-sec">
            <h3 class="rl-ttl rl-ttl--green">✓ Pontos fortes</h3>
            <ul class="rl-ul">${strengths}</ul>
          </section>
          <section class="rl-sec">
            <h3 class="rl-ttl rl-ttl--amber">⚠ Pontos fracos</h3>
            <ul class="rl-ul">${weaknesses}</ul>
          </section>
        </div>

        <section class="rl-sec">
          <h3 class="rl-ttl rl-ttl--red">✕ Inconsistências</h3>
          <ul class="rl-ul">${inconsistencies}</ul>
        </section>

        ${security}

        <section class="rl-sec">
          <h3 class="rl-ttl rl-ttl--blue">↑ Recomendações</h3>
          <ul class="rl-recs">${recs}</ul>
        </section>

      </div>

      <footer class="rl-ft">
        Análise gerada por IA · Use como referência, não como verdade absoluta
      </footer>

    </div>
  `, dark, 'rl-overlay')
}

// ── DOM management ─────────────────────────────────────────────────

function getOrCreateShadow(): ShadowRoot {
  let host = document.getElementById(HOST_ID)
  if (!host) {
    host = document.createElement('div')
    host.id = HOST_ID
    document.body.appendChild(host)
  }
  return host.shadowRoot ?? host.attachShadow({ mode: 'open' })
}

function render(html: string): ShadowRoot {
  const shadow = getOrCreateShadow()
  shadow.innerHTML = `<style>${buildCSS()}</style>${html}`
  return shadow
}

// ── Key form wiring (reused across all states) ─────────────────────

function wireKeyFormFields(shadow: ShadowRoot): void {
  const input = shadow.getElementById('rl-key-input') as HTMLInputElement | null
  const saveBtn = shadow.getElementById('rl-save-key') as HTMLButtonElement | null
  const msg = shadow.getElementById('rl-key-msg')

  saveBtn?.addEventListener('click', async () => {
    const key = input?.value.trim() ?? ''
    if (!key) {
      if (msg) { msg.textContent = 'Insira a API key antes de salvar.'; msg.className = 'rl-keymsg rl-keymsg--err' }
      return
    }
    saveBtn.disabled = true
    if (msg) { msg.textContent = ''; msg.className = 'rl-keymsg' }
    const res: { ok: boolean; error?: string } = await chrome.runtime.sendMessage({ type: 'SAVE_API_KEY', key })
    if (res?.ok) {
      if (msg) { msg.textContent = 'Salva! Clique em RepoLogs novamente.'; msg.className = 'rl-keymsg rl-keymsg--ok' }
      setTimeout(closeModal, 1800)
    } else {
      if (msg) { msg.textContent = res?.error ?? 'Erro ao salvar.'; msg.className = 'rl-keymsg rl-keymsg--err' }
      saveBtn.disabled = false
    }
  })

  // Show model selector only when user already has an API key
  chrome.storage.local.get(['userApiKey', 'geminiModel'], (data) => {
    if (!data['userApiKey']) return
    const modelSection = shadow.getElementById('rl-model-section')
    if (modelSection) modelSection.style.display = 'block'
    const selected = (data['geminiModel'] as string | undefined) || DEFAULT_MODEL
    const radio = shadow.querySelector<HTMLInputElement>(
      `input[name="rl-gemini-model"][value="${selected}"]`
    )
    if (radio) radio.checked = true
  })

  shadow.querySelectorAll<HTMLInputElement>('input[name="rl-gemini-model"]').forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.checked) {
        chrome.runtime.sendMessage({ type: 'SAVE_GEMINI_MODEL', model: radio.value })
      }
    })
  })

  chrome.storage.local.get(['deepMode'], (data) => {
    const toggle = shadow.getElementById('rl-deep-mode') as HTMLInputElement | null
    if (toggle) toggle.checked = !!data['deepMode']
  })

  shadow.getElementById('rl-deep-mode')?.addEventListener('change', (e) => {
    const checked = (e.target as HTMLInputElement).checked
    chrome.runtime.sendMessage({ type: 'SAVE_DEEP_MODE', deepMode: checked })
  })
}

function wireKeyBtn(shadow: ShadowRoot): void {
  shadow.getElementById('rl-key-btn')?.addEventListener('click', showKeyForm)
}

function showKeyForm(): void {
  document.removeEventListener('keydown', onEsc)
  const shadow = render(keyFormCardHTML(isDark()))
  shadow.getElementById('rl-close')?.addEventListener('click', closeModal)
  shadow.getElementById('rl-cancel')?.addEventListener('click', closeModal)
  document.addEventListener('keydown', onEsc)
  wireKeyFormFields(shadow)
}

// ── Public API ─────────────────────────────────────────────────────

export function showLoading(step: string, percent: number): void {
  const shadow = render(loadingHTML(step, percent, isDark()))
  shadow.getElementById('rl-close')?.addEventListener('click', closeModal)
  wireKeyBtn(shadow)
}

export function showResult(result: AnalysisResult): void {
  lockScroll()
  chrome.storage.local.get(['geminiModel'], (data) => {
    const modelId = (data['geminiModel'] as string | undefined) || DEFAULT_MODEL
    const modelName = GEMINI_MODELS.find(m => m.id === modelId)?.name ?? modelId
    const shadow = render(resultHTML(result, isDark(), modelName))
    shadow.getElementById('rl-close')?.addEventListener('click', closeModal)
    shadow.getElementById('rl-overlay')?.addEventListener('click', (e) => {
      if ((e.target as Element).id === 'rl-overlay') closeModal()
    })
    document.addEventListener('keydown', onEsc)
    wireKeyBtn(shadow)
  })
}

export function showError(message: string, requiresApiKey = false): void {
  const shadow = render(errorHTML(message, requiresApiKey, isDark()))
  shadow.getElementById('rl-close')?.addEventListener('click', closeModal)
  shadow.getElementById('rl-close-btn')?.addEventListener('click', closeModal)
  document.addEventListener('keydown', onEsc)

  if (requiresApiKey) {
    wireKeyFormFields(shadow)
  } else {
    wireKeyBtn(shadow)
  }
}

function lockScroll(): void {
  document.body.style.overflow = 'hidden'
}

function unlockScroll(): void {
  document.body.style.overflow = ''
}

export function closeModal(): void {
  document.getElementById(HOST_ID)?.remove()
  document.removeEventListener('keydown', onEsc)
  unlockScroll()
}

function onEsc(e: KeyboardEvent): void {
  if (e.key === 'Escape') closeModal()
}
