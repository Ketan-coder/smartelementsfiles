/**
 * smart-core.js  — v1.0
 * Global UI primitives for the SmartComponents system.
 *
 * Provides three optional web components:
 *   <smart-toast>   — stacked, auto-dismissing toast notifications
 *   <smart-loader>  — full-page or scoped overlay loader
 *   <smart-modal>   — confirmation modal (intercepts smart-confirm events)
 *
 * ARCHITECTURE RULES
 * ─────────────────────────────────────────────────────────────────
 * • All components listen on window via CustomEvents only.
 * • No component queries another component directly.
 * • Every other module (smart-table, smart-filter-bar) works fine
 *   when this file is NOT loaded — graceful degradation throughout.
 * • No uncaught errors, ever.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Shared style injection — runs once, safe to call multiple times
// ─────────────────────────────────────────────────────────────────────────────
function injectSharedStyles() {
  if (document.getElementById('smart-core-styles')) return;
  const s = document.createElement('style');
  s.id = 'smart-core-styles';
  s.textContent = `
    /* ── Toast host ─────────────────────────────────────────── */
    smart-toast {
      position: fixed; z-index: 9999;
      display: flex; flex-direction: column; gap: 8px;
      pointer-events: none;
      max-width: 360px; width: calc(100vw - 32px);
      box-sizing: border-box;
    }
    smart-toast[position="top-right"]     { top:16px;    right:16px;  align-items:flex-end; }
    smart-toast[position="top-left"]      { top:16px;    left:16px;   align-items:flex-start; }
    smart-toast[position="top-center"]    { top:16px;    left:50%;    transform:translateX(-50%); align-items:center; }
    smart-toast[position="bottom-right"]  { bottom:16px; right:16px;  align-items:flex-end;   flex-direction:column-reverse; }
    smart-toast[position="bottom-left"]   { bottom:16px; left:16px;   align-items:flex-start; flex-direction:column-reverse; }
    smart-toast[position="bottom-center"] { bottom:16px; left:50%;    transform:translateX(-50%); align-items:center; flex-direction:column-reverse; }

    .sc-toast-item {
      pointer-events: all;
      position: relative; overflow: hidden;
      display: flex; align-items: flex-start; gap: 10px;
      padding: 11px 14px; border-radius: 10px;
      border: 1.5px solid transparent;
      font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
      font-size: .855rem; font-weight: 500; line-height: 1.45;
      max-width: 100%;
      box-shadow: 0 4px 20px rgba(0,0,0,.12), 0 1px 4px rgba(0,0,0,.08);
      cursor: default;
      opacity: 0; transform: translateY(6px) scale(.97);
      transition: opacity .22s ease, transform .22s ease;
    }
    .sc-toast-item.sc-toast-visible { opacity:1; transform:translateY(0) scale(1); }
    .sc-toast-item.sc-toast-out { opacity:0; transform:translateY(-6px) scale(.97); transition:opacity .18s ease,transform .18s ease; }

    .sc-toast-success { background:#e8faf2; color:#145c38; border-color:#b0e8c8; }
    .sc-toast-error   { background:#fdeef2; color:#a8203c; border-color:#f5b8c8; }
    .sc-toast-warning { background:#fff8e6; color:#92600a; border-color:#fde68a; }
    .sc-toast-info    { background:#eef3ff; color:#2a40a0; border-color:#c7d2fe; }
    .sc-toast-loading { background:#f5f6fd; color:#444c80; border-color:#d0d4f0; }
    @media (prefers-color-scheme: dark) {
      .sc-toast-success { background:#0a2018; color:#6ecf98; border-color:#1a4a30; }
      .sc-toast-error   { background:#2a0e18; color:#f090a8; border-color:#4a1828; }
      .sc-toast-warning { background:#1e1200; color:#fde047; border-color:#a16207; }
      .sc-toast-info    { background:#080e28; color:#93c5fd; border-color:#1e3a8a; }
      .sc-toast-loading { background:#1a1e32; color:#9aa0d0; border-color:#2c3050; }
    }
    .sc-toast-icon  { flex-shrink:0; font-size:1rem; line-height:1; margin-top:1px; }
    .sc-toast-body  { flex:1; min-width:0; word-break:break-word; }
    .sc-toast-close { flex-shrink:0; background:none; border:none; cursor:pointer; opacity:.5; font-size:1rem; line-height:1; padding:0 2px; color:inherit; transition:opacity .12s; }
    .sc-toast-close:hover { opacity:1; }
    .sc-toast-progress { position:absolute; bottom:0; left:0; height:2px; border-radius:0 0 10px 10px; background:currentColor; opacity:.3; transform-origin:left; }

    /* ── Loader overlay ─────────────────────────────────────── */
    smart-loader { display: none; }
    .sc-loader-overlay {
      position: fixed; inset: 0; z-index: 9998;
      background: rgba(10,12,30,.55); backdrop-filter: blur(3px);
      display: flex; align-items: center; justify-content: center;
      opacity: 0; transition: opacity .18s ease;
    }
    .sc-loader-overlay.sc-loader-visible { opacity: 1; }
    .sc-loader-overlay.sc-loader-scoped  { position: absolute; border-radius: inherit; }
    .sc-spinner {
      width: 42px; height: 42px;
      border: 3px solid rgba(255,255,255,.2); border-top-color: #818cf8;
      border-radius: 50%; animation: sc-spin .75s linear infinite;
    }
    @keyframes sc-spin { to { transform: rotate(360deg); } }

    /* ── Confirm modal ──────────────────────────────────────── */
    smart-modal { display: contents; }
    .sc-modal-backdrop {
      position: fixed; inset: 0; z-index: 9997;
      background: rgba(10,12,30,.5); backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      opacity: 0; pointer-events: none; transition: opacity .2s ease;
    }
    .sc-modal-backdrop.sc-modal-open { opacity:1; pointer-events:all; }
    .sc-modal-box {
      background: #fff; border: 1.5px solid #e4e6f0; border-radius: 14px;
      padding: 1.6rem; max-width: 340px; width: 90%;
      box-shadow: 0 24px 64px rgba(0,0,0,.22);
      transform: translateY(10px) scale(.97); transition: transform .2s ease;
      font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
    }
    .sc-modal-backdrop.sc-modal-open .sc-modal-box { transform: translateY(0) scale(1); }
    @media (prefers-color-scheme: dark) {
      .sc-modal-box { background:#20243a; border-color:#2c3050; color:#c4c8e8; }
    }
    .sc-modal-icon {
      width:44px; height:44px; border-radius:50%;
      background:#fdeef2; border:1.5px solid #f5b8c8;
      display:flex; align-items:center; justify-content:center;
      font-size:1.3rem; margin: 0 auto 1rem;
    }
    @media (prefers-color-scheme: dark) { .sc-modal-icon { background:#2a0e18; border-color:#4a1828; } }
    .sc-modal-title   { text-align:center; font-size:1rem; font-weight:700; margin:0 0 .4rem; color:inherit; }
    .sc-modal-message { text-align:center; font-size:.9rem; color:#5a6290; margin:0 0 1.4rem; line-height:1.55; }
    @media (prefers-color-scheme: dark) { .sc-modal-message { color:#848cb8; } }
    .sc-modal-footer  { display:flex; gap:10px; justify-content:center; }
    .sc-modal-btn {
      flex:1; padding:8px 16px; border-radius:8px;
      font-size:.875rem; font-weight:600; cursor:pointer;
      border: 1.5px solid; transition: background .12s, transform .1s;
    }
    .sc-modal-btn:active { transform: scale(.97); }
    .sc-modal-cancel  { background:#f3f5fb; border-color:#e4e6f0; color:#1e2340; }
    .sc-modal-cancel:hover  { background:#e8eaf4; }
    .sc-modal-confirm { background:#fdeef2; border-color:#f5b8c8; color:#a8203c; }
    .sc-modal-confirm:hover { background:#fbd8e0; }
    @media (prefers-color-scheme: dark) {
      .sc-modal-cancel  { background:#20243a; border-color:#2c3050; color:#c4c8e8; }
      .sc-modal-cancel:hover  { background:#262a44; }
      .sc-modal-confirm { background:#2a0e18; border-color:#4a1828; color:#f090a8; }
      .sc-modal-confirm:hover { background:#3a1022; }
    }
  `;
  document.head.appendChild(s);
}


// ═════════════════════════════════════════════════════════════════════════════
//  <smart-toast>
// ═════════════════════════════════════════════════════════════════════════════

class SmartToast extends HTMLElement {
  connectedCallback() {
    injectSharedStyles();
    if (!this.getAttribute('position')) this.setAttribute('position', 'bottom-right');
    this._max    = parseInt(this.getAttribute('max') || '5', 10);
    this._toasts = [];
    this._handler = (e) => this._handle(e.detail);
    window.addEventListener('smart-toast', this._handler);
  }

  disconnectedCallback() {
    window.removeEventListener('smart-toast', this._handler);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Called from other modules: SmartToast.fire(detail) */
  static fire(detail) {
    window.dispatchEvent(new CustomEvent('smart-toast', { detail }));
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  _handle(detail) {
    if (!detail) return;
    if (detail.promise) {
      // Promise mode — show loading, update on settle
      const item = this._create(detail.loading || 'Loading…', 'loading', 0);
      Promise.resolve(detail.promise).then(
        () => this._update(item, detail.success || 'Done!',   'success'),
        () => this._update(item, detail.error   || 'Failed.', 'error')
      );
      return;
    }
    this._create(detail.message || '', detail.type || 'info', detail.duration ?? 3000);
  }

  _create(message, type, duration) {
    // Trim stack if over limit
    while (this._toasts.length >= this._max) this._dismiss(this._toasts[0]);

    const ICONS = { success:'✓', error:'✕', warning:'⚠', info:'ℹ', loading:'⟳' };
    const el = document.createElement('div');
    el.className = `sc-toast-item sc-toast-${type}`;
    el.setAttribute('role', 'alert');
    el.setAttribute('aria-live', 'assertive');
    el.innerHTML = [
      `<span class="sc-toast-icon" aria-hidden="true">${ICONS[type] || 'ℹ'}</span>`,
      `<span class="sc-toast-body">${this._esc(message)}</span>`,
      `<button class="sc-toast-close" aria-label="Dismiss">✕</button>`,
      duration > 0 ? '<div class="sc-toast-progress"></div>' : '',
    ].join('');

    el.querySelector('.sc-toast-close').addEventListener('click', () => this._dismiss(el));
    el.addEventListener('mouseenter', () => clearTimeout(el._timer));
    el.addEventListener('mouseleave', () => {
      if (duration > 0) el._timer = setTimeout(() => this._dismiss(el), 1200);
    });

    this.appendChild(el);
    this._toasts.push(el);

    // Trigger entrance (double rAF ensures layout is committed)
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('sc-toast-visible')));

    // Animated progress bar
    if (duration > 0) {
      const bar = el.querySelector('.sc-toast-progress');
      if (bar) {
        bar.style.transition = `transform ${duration}ms linear`;
        requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.transform = 'scaleX(0)'; }));
      }
      el._timer = setTimeout(() => this._dismiss(el), duration);
    }

    return el;
  }

  _update(el, message, type) {
    if (!el || !el.isConnected) return;
    const ICONS = { success:'✓', error:'✕', warning:'⚠', info:'ℹ', loading:'⟳' };
    el.className = `sc-toast-item sc-toast-visible sc-toast-${type}`;
    el.querySelector('.sc-toast-icon').textContent = ICONS[type] || 'ℹ';
    el.querySelector('.sc-toast-body').textContent = message;
    clearTimeout(el._timer);
    el._timer = setTimeout(() => this._dismiss(el), 3000);
  }

  _dismiss(el) {
    if (!el || !el.isConnected) return;
    clearTimeout(el._timer);
    el.classList.remove('sc-toast-visible');
    el.classList.add('sc-toast-out');
    const remove = () => {
      el.remove();
      this._toasts = this._toasts.filter(t => t !== el);
    };
    el.addEventListener('transitionend', remove, { once: true });
    // Safety fallback in case transitionend doesn't fire
    setTimeout(remove, 400);
  }

  _esc(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
}

customElements.define('smart-toast', SmartToast);


// ═════════════════════════════════════════════════════════════════════════════
//  <smart-loader>
// ═════════════════════════════════════════════════════════════════════════════

class SmartLoader extends HTMLElement {
  constructor() {
    super();
    this._counter  = 0;        // global concurrent show counter
    this._overlays = new Map(); // key → overlay element
    this._timers   = new Map(); // key → delay timer
  }

  connectedCallback() {
    injectSharedStyles();
    this._handler = (e) => this._handle(e.detail || {});
    window.addEventListener('smart-loader', this._handler);
  }

  disconnectedCallback() {
    window.removeEventListener('smart-loader', this._handler);
    this._overlays.forEach(ov => ov.remove());
    this._timers.forEach(t => clearTimeout(t));
  }

  _handle({ action, scope } = {}) {
    const key = scope || '__global__';

    if (action === 'show') {
      this._counter++;
      // 200ms delay prevents flicker on fast operations
      if (!this._timers.has(key)) {
        this._timers.set(key, setTimeout(() => {
          this._timers.delete(key);
          this._show(key, scope);
        }, 200));
      }
    } else if (action === 'hide') {
      this._counter = Math.max(0, this._counter - 1);
      // Cancel pending show timer if hide arrives before delay expires
      const t = this._timers.get(key);
      if (t) { clearTimeout(t); this._timers.delete(key); }
      if (this._counter === 0 || scope) this._hide(key, scope);
    }
  }

  _show(key, scope) {
    if (this._overlays.has(key)) return;

    const ov = document.createElement('div');
    ov.className = 'sc-loader-overlay';
    ov.innerHTML = '<div class="sc-spinner" role="status" aria-label="Loading"></div>';

    if (scope) {
      const target = document.getElementById(scope);
      if (!target) return;
      // Ensure position context for absolute overlay
      const pos = getComputedStyle(target).position;
      if (!['relative','absolute','fixed','sticky'].includes(pos)) {
        target.dataset.scPrevPos = target.style.position;
        target.style.position = 'relative';
      }
      ov.classList.add('sc-loader-scoped');
      target.appendChild(ov);
    } else {
      document.body.appendChild(ov);
    }

    this._overlays.set(key, ov);
    requestAnimationFrame(() => requestAnimationFrame(() => ov.classList.add('sc-loader-visible')));
  }

  _hide(key, scope) {
    const ov = this._overlays.get(key);
    if (!ov) return;

    ov.classList.remove('sc-loader-visible');
    const cleanup = () => {
      if (scope) {
        const target = document.getElementById(scope);
        if (target && target.dataset.scPrevPos !== undefined) {
          target.style.position = target.dataset.scPrevPos;
          delete target.dataset.scPrevPos;
        }
      }
      ov.remove();
      this._overlays.delete(key);
    };
    ov.addEventListener('transitionend', cleanup, { once: true });
    setTimeout(cleanup, 400); // safety fallback
  }
}

customElements.define('smart-loader', SmartLoader);


// ═════════════════════════════════════════════════════════════════════════════
//  <smart-modal>
// ═════════════════════════════════════════════════════════════════════════════

/**
 * When <smart-modal> is in the DOM it intercepts "smart-confirm" events and
 * shows a branded modal. It calls event.preventDefault() so SmartTable knows
 * NOT to run the native window.confirm() fallback.
 *
 * When <smart-modal> is absent, window.dispatchEvent() returns true (the event
 * is not cancelled), so SmartTable's fallback path runs instead — zero errors.
 */
class SmartModal extends HTMLElement {
  connectedCallback() {
    injectSharedStyles();
    this._build();
    this._handler = (e) => this._handle(e);
    window.addEventListener('smart-confirm', this._handler);
  }

  disconnectedCallback() {
    window.removeEventListener('smart-confirm', this._handler);
    if (this._keyHandler) document.removeEventListener('keydown', this._keyHandler);
    if (this._backdrop) this._backdrop.remove();
  }

  _build() {
    this._backdrop = document.createElement('div');
    this._backdrop.className = 'sc-modal-backdrop';
    this._backdrop.setAttribute('role', 'dialog');
    this._backdrop.setAttribute('aria-modal', 'true');
    this._backdrop.setAttribute('aria-labelledby', 'sc-modal-ttl');
    this._backdrop.innerHTML = `
      <div class="sc-modal-box">
        <div class="sc-modal-icon" aria-hidden="true"></div>
        <h2 class="sc-modal-title" id="sc-modal-ttl">Confirm</h2>
        <p  class="sc-modal-message">Are you sure?</p>
        <div class="sc-modal-footer">
          <button class="sc-modal-btn sc-modal-cancel">Cancel</button>
          <button class="sc-modal-btn sc-modal-confirm">Delete</button>
        </div>
      </div>`;

    document.body.appendChild(this._backdrop);

    this._backdrop.querySelector('.sc-modal-cancel').addEventListener('click',  () => this._close(false));
    this._backdrop.querySelector('.sc-modal-confirm').addEventListener('click', () => this._close(true));
    // Close on backdrop click (outside box)
    this._backdrop.addEventListener('click', (e) => { if (e.target === this._backdrop) this._close(false); });

    this._keyHandler = (e) => { if (e.key === 'Escape' && this._open) this._close(false); };
    document.addEventListener('keydown', this._keyHandler);
    this._open = false;
  }

  _handle(event) {
    const { message, title, confirmLabel, cancelLabel, onConfirm, onCancel, icon } = event.detail || {};

    // Prevent SmartTable's window.confirm() fallback
    event.preventDefault();

    this._onConfirm = typeof onConfirm === 'function' ? onConfirm : null;
    this._onCancel  = typeof onCancel  === 'function' ? onCancel  : null;

    // Update text content
    const q = (sel) => this._backdrop.querySelector(sel);
    if (q('.sc-modal-message')) q('.sc-modal-message').textContent = message      || 'Are you sure?';
    if (q('.sc-modal-title'))   q('.sc-modal-title').textContent   = title        || 'Confirm';
    if (q('.sc-modal-confirm')) q('.sc-modal-confirm').textContent = confirmLabel || 'Delete';
    if (q('.sc-modal-cancel'))  q('.sc-modal-cancel').textContent  = cancelLabel  || 'Cancel';
    if (q('.sc-modal-icon')) q('.sc-modal-icon').textContent = icon || '⚠';

    this._backdrop.classList.add('sc-modal-open');
    this._open = true;

    // Accessibility: focus confirm button
    setTimeout(() => { const b = q('.sc-modal-confirm'); if (b) b.focus(); }, 60);
  }

  _close(confirmed) {
    this._backdrop.classList.remove('sc-modal-open');
    this._open = false;
    if (confirmed && this._onConfirm) {
      try { this._onConfirm(); } catch(e) { console.error('[SmartModal] onConfirm error:', e); }
    } else if (!confirmed && this._onCancel) {
      try { this._onCancel(); } catch(e) { console.error('[SmartModal] onCancel error:', e); }
    }
    this._onConfirm = null;
    this._onCancel  = null;
  }
}

customElements.define('smart-modal', SmartModal);