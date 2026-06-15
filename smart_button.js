/**
 * smart_button.js — v2.0
 * <smart-button> — General-purpose icon button component.
 * <custom-button> — AJAX form-submission button component.
 *
 * ── WHAT'S NEW IN v2 ────────────────────────────────────────────────────────
 * • Token system     — all colours via --sc-* / --sb-* variables. Dark mode
 *                      works via [data-sc-theme="dark"] from smart-core.js.
 *                      styled="bootstrap" keeps Bootstrap classes (zero break).
 * • theme="auto|light|dark" — delegates to SmartElement when smart-core.js
 *                      is loaded; self-contained fallback when it isn't.
 * • href attribute   — renders an <a> tag instead of <button> when present.
 *                      Same visual, correct semantic for navigation links.
 * • copy attribute   — copies text or element content to clipboard.
 *                      Flashes success icon + optional confirmation toast.
 *                      <smart-button icon="copy" copy="Hello world">
 *                      <smart-button icon="copy" copy="#output-field">
 * • toggle attribute — declarative two-state button. No JS needed.
 *                      toggle-active-label, toggle-active-icon, toggle-active-variant
 *                      toggle-state="active" to pre-activate.
 *                      Emits "sb-toggle" CustomEvent with { active } detail.
 *                      <smart-button toggle text="Follow" toggle-active-label="Unfollow"
 *                                   icon="user-plus" toggle-active-icon="user-minus"
 *                                   toggle-active-variant="danger">
 * • countdown attribute — shows a live countdown inside the label before
 *                      enabling. Prevents accidental destructive actions.
 *                      <smart-button countdown="5" icon="trash" text="Delete">
 * • throttle attribute — prevents double-clicks. Disables the button for N ms
 *                      after each click. <smart-button throttle="2000">
 * • Focus glow       — focus-visible shows a coloured glow matching the variant.
 * • Style dedup      — styles injected into <head> once, not into each element.
 * • Phosphor CDN     — updated to jsDelivr (no tracking-prevention issues).
 *
 * ── ATTRIBUTE REFERENCE ─────────────────────────────────────────────────────
 * Shared (<smart-button> and <custom-button>):
 *   styled="bootstrap|default"   default=default (self-contained styles)
 *   theme="auto|light|dark"      default=auto
 *   variant="primary|secondary|success|danger|warning|info|ghost|outline"
 *   size="xs|sm|md|lg|xl"        default=md
 *   rounded="default|rounded|pill|square"
 *   shadow                       adds drop shadow
 *   disabled                     disables interaction
 *   loading                      shows spinner immediately on mount
 *   icon="phosphor-icon-name"    e.g. icon="trash"
 *   icon-weight="regular|bold|fill|duotone|thin|light"
 *   icon-position="start|end"    default=start
 *   text="Label"                 button label text
 *   tooltip="hint"               native title attribute
 *   href="url"                   renders <a> instead of <button>
 *   target="_blank|_self|..."    for href links
 *   throttle="ms"                disable for N ms after each click
 *
 * <smart-button> only:
 *   copy="text or #selector"     copy to clipboard on click
 *   toggle                       two-state toggle button
 *   toggle-active-label          label when active
 *   toggle-active-icon           icon when active
 *   toggle-active-variant        variant when active
 *   toggle-state="active"        start in active state
 *   countdown="N"                countdown N seconds before enabling
 *   form-id="formId"             AJAX: form to submit
 *   post="url"                   AJAX: submission endpoint
 *   method="POST|PUT|PATCH|DELETE"
 *   target="#selector"           AJAX: element to update with response
 *   success-message="..."        toast on success
 *   error-message="..."          toast on error
 *   skip-confirmation="true"     skip confirm dialog
 *   confirm-title="..."
 *   confirm-message="..."
 *   confirm-label="..."
 *   cancel-label="..."
 *   confirm-icon="..."
 *   data-onclick, data-onhover, data-onfocus, data-onsuccess, data-onerror
 *
 * ── EVENTS ───────────────────────────────────────────────────────────────────
 *   sb-toggle   — fired on toggle state change. detail: { active: boolean }
 *   sb-copy     — fired after copy. detail: { text: string }
 *   sb-countdown-end — fired when countdown finishes and button enables
 *
 * ── STABLE CLASS REFERENCE ───────────────────────────────────────────────────
 *   .sb-btn              — the inner <button> or <a> element
 *   .sb-icon             — the <i> phosphor icon
 *   .sb-text             — the label <span>
 *   .sb-spinner          — the loading spinner
 *   .sb-countdown        — the countdown badge inside the button
 *   .sb-btn--loading     — applied while loading
 *   .sb-btn--active      — applied in toggle active state
 *   .sb-btn--throttled   — applied during throttle lockout period
 */

// ─────────────────────────────────────────────────────────────────────────────
//  Shared: confirmation fallback modal (singleton, no smart-core.js needed)
// ─────────────────────────────────────────────────────────────────────────────

if (!window.__SmartConfirmFallback) {
    window.__SmartConfirmFallback = (() => {
        let _backdrop = null, _resolve = null, _keyHandler = null;

        function _injectStyles() {
            if (document.getElementById('sc-fallback-modal-styles')) return;
            const s = document.createElement('style');
            s.id = 'sc-fallback-modal-styles';
            s.textContent = `
                .sc-modal-backdrop {
                    position:fixed;inset:0;z-index:9997;
                    background:rgba(10,12,30,.5);backdrop-filter:blur(4px);
                    display:flex;align-items:center;justify-content:center;
                    opacity:0;pointer-events:none;transition:opacity .2s ease;
                }
                .sc-modal-backdrop.sc-modal-open{opacity:1;pointer-events:all;}
                .sc-modal-box {
                    background:var(--sc-modal-bg,#fff);
                    border:1.5px solid var(--sc-modal-border,#e4e6f0);
                    border-radius:14px;padding:1.6rem;max-width:340px;width:90%;
                    box-shadow:var(--sc-shadow-lg,0 24px 64px rgba(0,0,0,.22));
                    transform:translateY(10px) scale(.97);transition:transform .2s ease;
                    font-family:var(--sc-font,system-ui,sans-serif);
                    color:var(--sc-modal-text,#1e2340);
                }
                .sc-modal-backdrop.sc-modal-open .sc-modal-box{transform:translateY(0) scale(1);}
                .sc-modal-icon{
                    width:44px;height:44px;border-radius:50%;
                    background:var(--sc-modal-icon-bg,#fdeef2);
                    border:1.5px solid var(--sc-modal-icon-border,#f5b8c8);
                    display:flex;align-items:center;justify-content:center;
                    font-size:1.3rem;margin:0 auto 1rem;
                }
                .sc-modal-title{text-align:center;font-size:1rem;font-weight:700;margin:0 0 .4rem;color:inherit;}
                .sc-modal-message{text-align:center;font-size:.9rem;color:var(--sc-modal-subtext,#5a6290);margin:0 0 1.4rem;line-height:1.55;}
                .sc-modal-footer{display:flex;gap:10px;justify-content:center;}
                .sc-modal-btn{flex:1;padding:8px 16px;border-radius:8px;font-size:.875rem;font-weight:600;cursor:pointer;border:1.5px solid;transition:background .12s,transform .1s;}
                .sc-modal-btn:active{transform:scale(.97);}
                .sc-modal-cancel{background:var(--sc-modal-cancel-bg,#f3f5fb);border-color:var(--sc-modal-border,#e4e6f0);color:var(--sc-modal-text,#1e2340);}
                .sc-modal-cancel:hover{filter:brightness(.95);}
                .sc-modal-confirm{background:var(--sc-modal-confirm-bg,#fdeef2);border-color:var(--sc-modal-confirm-border,#f5b8c8);color:var(--sc-modal-confirm-text,#a8203c);}
                .sc-modal-confirm:hover{filter:brightness(.93);}
            `;
            document.head.appendChild(s);
        }

        function _build() {
            if (_backdrop) return;
            _injectStyles();
            _backdrop = document.createElement('div');
            _backdrop.className = 'sc-modal-backdrop';
            _backdrop.setAttribute('role', 'dialog');
            _backdrop.setAttribute('aria-modal', 'true');
            _backdrop.setAttribute('aria-labelledby', 'sc-fb-ttl');
            _backdrop.innerHTML = `
                <div class="sc-modal-box">
                    <div class="sc-modal-icon" aria-hidden="true">⚠</div>
                    <h2 class="sc-modal-title" id="sc-fb-ttl">Confirm</h2>
                    <p class="sc-modal-message">Are you sure?</p>
                    <div class="sc-modal-footer">
                        <button class="sc-modal-btn sc-modal-cancel">Cancel</button>
                        <button class="sc-modal-btn sc-modal-confirm">Confirm</button>
                    </div>
                </div>`;
            document.body.appendChild(_backdrop);
            _backdrop.querySelector('.sc-modal-cancel').addEventListener('click',  () => _close(false));
            _backdrop.querySelector('.sc-modal-confirm').addEventListener('click', () => _close(true));
            _backdrop.addEventListener('click', e => { if (e.target === _backdrop) _close(false); });
            _keyHandler = e => { if (e.key === 'Escape') _close(false); };
            document.addEventListener('keydown', _keyHandler);
        }

        function _close(confirmed) {
            if (!_backdrop) return;
            _backdrop.classList.remove('sc-modal-open');
            const r = _resolve; _resolve = null;
            if (r) r(confirmed);
        }

        function show({ title = 'Confirm', message = 'Are you sure?',
                        confirmLabel = 'Confirm', cancelLabel = 'Cancel', icon = '⚠' } = {}) {
            _build();
            const q = sel => _backdrop.querySelector(sel);
            q('.sc-modal-title').textContent   = title;
            q('.sc-modal-message').textContent = message;
            q('.sc-modal-confirm').textContent = confirmLabel;
            q('.sc-modal-cancel').textContent  = cancelLabel;
            q('.sc-modal-icon').textContent    = icon;
            return new Promise(res => {
                _resolve = res;
                void _backdrop.offsetWidth;
                _backdrop.classList.add('sc-modal-open');
                setTimeout(() => q('.sc-modal-confirm')?.focus(), 60);
            });
        }

        return { show };
    })();
}

// ─────────────────────────────────────────────────────────────────────────────
//  Shared: confirmation dispatcher (smart-modal → fallback)
// ─────────────────────────────────────────────────────────────────────────────

if (!window.__dispatchSmartConfirm) {
    window.__dispatchSmartConfirm = function({ title, message,
        confirmLabel = 'Confirm', cancelLabel = 'Cancel', icon } = {}) {
        return new Promise(resolve => {
            const event = new CustomEvent('smart-confirm', {
                cancelable: true,
                detail: { title, message, confirmLabel, cancelLabel, icon,
                          onConfirm: () => resolve(true),
                          onCancel:  () => resolve(false) },
            });
            const prevented = !window.dispatchEvent(event);
            if (!prevented) {
                window.__SmartConfirmFallback
                    .show({ title, message, confirmLabel, cancelLabel, icon })
                    .then(resolve);
            }
        });
    };
}

const SmartConfirmFallback  = window.__SmartConfirmFallback;
const dispatchSmartConfirm  = window.__dispatchSmartConfirm;


// ─────────────────────────────────────────────────────────────────────────────
//  Shared: style + Phosphor injection (once per page)
// ─────────────────────────────────────────────────────────────────────────────

function injectButtonStyles() {
    if (document.getElementById('smart-button-styles')) return;

    // Phosphor — skip if already loaded by smart-core.js or manually
    const phLoaded = !!document.querySelector('script[src*="phosphor"]') ||
                     !!document.querySelector('link[href*="phosphor"]');
    if (!phLoaded) {
        const base = 'https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.1/src';
        [{ id: 'sc-ph-regular', href: `${base}/regular/style.css` },
         { id: 'sc-ph-fill',    href: `${base}/fill/style.css`    }]
        .forEach(({ id, href }) => {
            if (document.getElementById(id)) return;
            const link = document.createElement('link');
            link.id = id; link.rel = 'stylesheet'; link.type = 'text/css'; link.href = href;
            document.head.appendChild(link);
        });
    }

    const s = document.createElement('style');
    s.id = 'smart-button-styles';
    s.textContent = `

        /* ── Tokens ──────────────────────────────────────────────────────────── */
        smart-button, custom-button {
            display: inline-block;
            --sb-radius:     var(--sc-radius, 0.4rem);
            --sb-font:       var(--sc-font, system-ui, -apple-system, 'Segoe UI', sans-serif);
            --sb-transition: 0.18s ease;
        }

        /* ── Base button / link ──────────────────────────────────────────────── */
        .sb-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 0.45rem;
            border: 1.5px solid transparent;
            cursor: pointer;
            font-family: var(--sb-font);
            font-weight: 500;
            text-decoration: none;
            position: relative;
            overflow: hidden;
            transition:
                background var(--sb-transition),
                border-color var(--sb-transition),
                box-shadow var(--sb-transition),
                transform var(--sb-transition),
                opacity var(--sb-transition);
            outline: none;
            white-space: nowrap;
            border-radius: var(--sb-radius);
            line-height: 1.4;
            user-select: none;
        }
        .sb-btn:disabled,
        .sb-btn--throttled { opacity: 0.55; cursor: not-allowed; pointer-events: none; }
        .sb-btn--loading   { pointer-events: none; }

        /* ── Sizes ───────────────────────────────────────────────────────────── */
        .sb-xs { padding: 0.2rem 0.45rem;  font-size: 0.72rem;  }
        .sb-sm { padding: 0.3rem 0.65rem;  font-size: 0.8125rem;}
        .sb-md { padding: 0.45rem 0.9rem;  font-size: 0.9375rem;}
        .sb-lg { padding: 0.6rem 1.1rem;   font-size: 1.0625rem;}
        .sb-xl { padding: 0.75rem 1.35rem; font-size: 1.1875rem;}

        /* ── Shape modifiers ─────────────────────────────────────────────────── */
        .sb-rounded { border-radius: 0.65rem !important; }
        .sb-pill    { border-radius: 9999px  !important; }
        .sb-square  { border-radius: 0       !important; }

        /* ── Shadow ──────────────────────────────────────────────────────────── */
        .sb-shadow      { box-shadow: var(--sc-shadow-sm, 0 2px 6px rgba(0,0,0,.1)); }
        .sb-shadow:hover:not(:disabled):not(.sb-btn--throttled) {
            box-shadow: var(--sc-shadow-md, 0 4px 16px rgba(0,0,0,.14));
        }

        /* ── Variants ────────────────────────────────────────────────────────── */
        .sb-primary   { background: #3b82f6; color: #fff; border-color: #3b82f6; }
        .sb-secondary { background: #6b7280; color: #fff; border-color: #6b7280; }
        .sb-success   { background: #10b981; color: #fff; border-color: #10b981; }
        .sb-danger    { background: #ef4444; color: #fff; border-color: #ef4444; }
        .sb-warning   { background: #f59e0b; color: #fff; border-color: #f59e0b; }
        .sb-info      { background: #0ea5e9; color: #fff; border-color: #0ea5e9; }
        .sb-ghost     { background: transparent; color: var(--sc-text,#374151); border-color: var(--sc-border,#d1d5db); }
        .sb-outline   { background: transparent; color: #3b82f6; border-color: #3b82f6; }
        .sb-subtle    { background: var(--sc-bg-subtle,#f3f4f6); color: var(--sc-text,#374151); border-color: transparent; }
        .sb-link      { background: transparent; color: #3b82f6; border-color: transparent; text-decoration: underline; }

        /* Hover — lift + darken */
        .sb-primary:hover:not(:disabled):not(.sb-btn--throttled)   { background: #2563eb; border-color: #2563eb; transform: translateY(-1px); }
        .sb-secondary:hover:not(:disabled):not(.sb-btn--throttled) { background: #4b5563; border-color: #4b5563; transform: translateY(-1px); }
        .sb-success:hover:not(:disabled):not(.sb-btn--throttled)   { background: #059669; border-color: #059669; transform: translateY(-1px); }
        .sb-danger:hover:not(:disabled):not(.sb-btn--throttled)    { background: #dc2626; border-color: #dc2626; transform: translateY(-1px); }
        .sb-warning:hover:not(:disabled):not(.sb-btn--throttled)   { background: #d97706; border-color: #d97706; transform: translateY(-1px); }
        .sb-info:hover:not(:disabled):not(.sb-btn--throttled)      { background: #0284c7; border-color: #0284c7; transform: translateY(-1px); }
        .sb-ghost:hover:not(:disabled):not(.sb-btn--throttled)     { background: var(--sc-bg-subtle,#f3f4f6); border-color: var(--sc-border,#9ca3af); }
        .sb-outline:hover:not(:disabled):not(.sb-btn--throttled)   { background: #3b82f6; color: #fff; }
        .sb-subtle:hover:not(:disabled):not(.sb-btn--throttled)    { filter: brightness(.96); }
        .sb-link:hover:not(:disabled):not(.sb-btn--throttled)      { color: #1d4ed8; }

        /* Active press */
        .sb-btn:active:not(:disabled):not(.sb-btn--throttled) { transform: translateY(0) scale(.97); }

        /* ── Focus glow (per variant) ────────────────────────────────────────── */
        .sb-primary:focus-visible   { box-shadow: 0 0 0 3px rgba(59,130,246,.35),  0 0 8px 2px rgba(59,130,246,.2);  }
        .sb-secondary:focus-visible { box-shadow: 0 0 0 3px rgba(107,114,128,.35), 0 0 8px 2px rgba(107,114,128,.2); }
        .sb-success:focus-visible   { box-shadow: 0 0 0 3px rgba(16,185,129,.35),  0 0 8px 2px rgba(16,185,129,.2);  }
        .sb-danger:focus-visible    { box-shadow: 0 0 0 3px rgba(239,68,68,.35),   0 0 8px 2px rgba(239,68,68,.2);   }
        .sb-warning:focus-visible   { box-shadow: 0 0 0 3px rgba(245,158,11,.35),  0 0 8px 2px rgba(245,158,11,.2);  }
        .sb-info:focus-visible      { box-shadow: 0 0 0 3px rgba(14,165,233,.35),  0 0 8px 2px rgba(14,165,233,.2);  }
        .sb-ghost:focus-visible,
        .sb-outline:focus-visible   { box-shadow: 0 0 0 3px rgba(59,130,246,.25),  0 0 8px 2px rgba(59,130,246,.15); }

        /* ── Spinner ─────────────────────────────────────────────────────────── */
        .sb-spinner {
            display: inline-block;
            width: 0.9em; height: 0.9em;
            border: 0.14em solid currentColor;
            border-right-color: transparent;
            border-radius: 50%;
            animation: sb-spin .65s linear infinite;
            flex-shrink: 0;
        }
        .sb-spinner--hidden { display: none; }
        @keyframes sb-spin { to { transform: rotate(360deg); } }

        /* ph-spinner icon alternative */
        .ph-spinner { animation: sb-spin 1s linear infinite; }

        /* ── Ripple ──────────────────────────────────────────────────────────── */
        .sb-ripple {
            position: absolute; border-radius: 50%;
            background: rgba(255,255,255,.55);
            transform: scale(0);
            animation: sb-ripple-anim .55s linear;
            pointer-events: none;
        }
        @keyframes sb-ripple-anim { to { transform: scale(4); opacity: 0; } }

        /* ── Countdown badge ─────────────────────────────────────────────────── */
        .sb-countdown {
            display: inline-flex; align-items: center; justify-content: center;
            min-width: 1.2em; height: 1.2em;
            background: rgba(0,0,0,.18);
            border-radius: 9999px;
            font-size: 0.78em;
            font-weight: 700;
            padding: 0 0.3em;
            margin-left: 0.25rem;
        }

        /* ── Toggle active state ─────────────────────────────────────────────── */
        .sb-btn--active { outline: none; }

        /* ── Dark theme ──────────────────────────────────────────────────────── */
        [data-sc-theme="dark"] .sb-ghost,
        smart-button[data-sc-theme="dark"] .sb-ghost,
        custom-button[data-sc-theme="dark"] .sb-ghost {
            color: var(--sc-text, #f3f4f6);
            border-color: var(--sc-border, #4b5563);
        }
        [data-sc-theme="dark"] .sb-ghost:hover:not(:disabled),
        smart-button[data-sc-theme="dark"] .sb-ghost:hover:not(:disabled),
        custom-button[data-sc-theme="dark"] .sb-ghost:hover:not(:disabled) {
            background: var(--sc-bg-subtle, #374151);
            border-color: var(--sc-border, #6b7280);
        }
        [data-sc-theme="dark"] .sb-subtle,
        smart-button[data-sc-theme="dark"] .sb-subtle,
        custom-button[data-sc-theme="dark"] .sb-subtle {
            background: var(--sc-bg-subtle, #374151);
            color: var(--sc-text, #e5e7eb);
        }

        /* ── custom-button Bootstrap passthrough utilities ───────────────────── */
        .sb-hidden { display: none !important; }
    `;
    document.head.appendChild(s);
}


// ─────────────────────────────────────────────────────────────────────────────
//  SmartButtonBase — delegates to SmartElement when loaded, else self-contained
// ─────────────────────────────────────────────────────────────────────────────

class SmartButtonBase extends HTMLElement {

    _getMode() {
        if (window.SmartElement) return SmartElement.prototype._getMode.call(this);
        const s = (this.getAttribute('styled') || '').toLowerCase().trim();
        return s === 'bootstrap' ? 'bootstrap' : 'default';
    }

    _getTheme() {
        if (window.SmartElement) return SmartElement.prototype._getTheme.call(this);
        if (this._getMode() !== 'default') return null;
        const t = (this.getAttribute('theme') || 'auto').toLowerCase().trim();
        return ['light', 'dark', 'auto'].includes(t) ? t : 'auto';
    }

    _applyTheme() {
        if (window.SmartElement) return SmartElement.prototype._applyTheme.call(this);
        if (this._getMode() !== 'default') return;

        if (this._scMqlHandler) {
            this._scMql?.removeEventListener('change', this._scMqlHandler);
            this._scMqlHandler = null; this._scMql = null;
        }
        if (this._scObserver) { this._scObserver.disconnect(); this._scObserver = null; }

        const theme = this._getTheme();
        if (theme === 'light' || theme === 'dark') { this.dataset.scTheme = theme; return; }

        const _resolve = () => {
            const ancestor = this.closest('[data-sc-theme]');
            if (ancestor && ancestor !== this) return ancestor.dataset.scTheme || 'light';
            if (this._scMql) return this._scMql.matches ? 'dark' : 'light';
            return 'light';
        };
        const _apply = () => { this.dataset.scTheme = _resolve(); };

        const targets = [document.body, document.documentElement].filter(Boolean);
        this._scObserver = new MutationObserver(_apply);
        targets.forEach(t => this._scObserver.observe(t, { attributes: true, attributeFilter: ['data-sc-theme'] }));

        this._scMql = window.matchMedia('(prefers-color-scheme: dark)');
        this._scMqlHandler = _apply;
        this._scMql.addEventListener('change', this._scMqlHandler);
        _apply();
    }

    disconnectedCallback() {
        if (this._scMqlHandler) {
            this._scMql?.removeEventListener('change', this._scMqlHandler);
            this._scMqlHandler = null; this._scMql = null;
        }
        if (this._scObserver) { this._scObserver.disconnect(); this._scObserver = null; }
        if (this._countdownTimer) clearInterval(this._countdownTimer);
        if (this._throttleTimer)  clearTimeout(this._throttleTimer);
    }

    // ── Shared helpers ───────────────────────────────────────────────────────

    _buildClasses(variant, size, rounded, shadow) {
        return [
            'sb-btn',
            `sb-${variant}`,
            `sb-${size}`,
            rounded !== 'default' ? `sb-${rounded}` : '',
            shadow ? 'sb-shadow' : '',
        ].filter(Boolean).join(' ');
    }

    _ripple(e, btn) {
        const r    = document.createElement('span');
        const rect = btn.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        r.className = 'sb-ripple';
        r.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - rect.left - size / 2}px;top:${e.clientY - rect.top - size / 2}px`;
        btn.appendChild(r);
        setTimeout(() => r.remove(), 600);
    }

    _showToast(message, type = 'info') {
        window.dispatchEvent(new CustomEvent('smart-toast', {
            detail: { message, type, duration: 3000 }
        }));
    }

    _applyThrottle(btn, ms) {
        if (!ms) return;
        btn.classList.add('sb-btn--throttled');
        this._throttleTimer = setTimeout(() => {
            btn.classList.remove('sb-btn--throttled');
        }, ms);
    }

    _startCountdown(btn, seconds, textEl) {
        const originalText = textEl?.textContent || '';
        let remaining = parseInt(seconds);

        // Inject countdown badge
        let badge = btn.querySelector('.sb-countdown');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'sb-countdown';
            btn.appendChild(badge);
        }

        btn.disabled = true;
        badge.textContent = remaining;

        this._countdownTimer = setInterval(() => {
            remaining--;
            badge.textContent = remaining;
            if (remaining <= 0) {
                clearInterval(this._countdownTimer);
                badge.remove();
                btn.disabled = false;
                this.dispatchEvent(new CustomEvent('sb-countdown-end', { bubbles: true }));
            }
        }, 1000);
    }

    _initCopy(btn, copyAttr) {
        const getText = () => {
            if (copyAttr.startsWith('#') || copyAttr.startsWith('.')) {
                const el = document.querySelector(copyAttr);
                return el ? (el.value || el.textContent || '') : '';
            }
            return copyAttr;
        };

        const iconEl = btn.querySelector('.sb-icon');
        const origIcon = iconEl?.className || '';

        btn.addEventListener('click', () => {
            const text = getText();
            if (!text) return;

            navigator.clipboard.writeText(text).catch(() => {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.cssText = 'position:fixed;opacity:0;';
                document.body.appendChild(ta);
                ta.select(); document.execCommand('copy');
                document.body.removeChild(ta);
            });

            // Flash success icon
            if (iconEl) {
                iconEl.className = 'ph ph-check sb-icon';
                setTimeout(() => { iconEl.className = origIcon; }, 1800);
            }

            this._showToast('Copied to clipboard', 'success');
            this.dispatchEvent(new CustomEvent('sb-copy', { bubbles: true, detail: { text } }));
        });
    }

    _initToggle(btn, config) {
        const {
            inactiveLabel, inactiveIcon, inactiveVariant,
            activeLabel,   activeIcon,   activeVariant,
        } = config;

        let active = this.getAttribute('toggle-state') === 'active';
        const textEl = btn.querySelector('.sb-text');
        const iconEl = btn.querySelector('.sb-icon');

        const _apply = () => {
            if (active) {
                btn.classList.add('sb-btn--active');
                btn.classList.remove(`sb-${inactiveVariant}`);
                btn.classList.add(`sb-${activeVariant}`);
                if (textEl && activeLabel)   textEl.textContent = activeLabel;
                if (iconEl && activeIcon)    iconEl.className   = `ph ph-${activeIcon} sb-icon`;
            } else {
                btn.classList.remove('sb-btn--active');
                btn.classList.remove(`sb-${activeVariant}`);
                btn.classList.add(`sb-${inactiveVariant}`);
                if (textEl && inactiveLabel) textEl.textContent = inactiveLabel;
                if (iconEl && inactiveIcon)  iconEl.className   = `ph ph-${inactiveIcon} sb-icon`;
            }
        };

        _apply(); // set initial state

        btn.addEventListener('click', () => {
            active = !active;
            _apply();
            this.dispatchEvent(new CustomEvent('sb-toggle', {
                bubbles: true, detail: { active }
            }));
        });
    }
}


// ═════════════════════════════════════════════════════════════════════════════
//  <smart-button>
// ═════════════════════════════════════════════════════════════════════════════

class IconButton extends SmartButtonBase {
    connectedCallback() {
        injectButtonStyles();
        this._applyTheme();

        // ── Read all attributes ───────────────────────────────────────────────
        const icon         = this.getAttribute('icon') || 'circle';
        const variant      = this.getAttribute('variant') || this.getAttribute('buttontype') || 'primary';
        const size         = this.getAttribute('size') || 'md';
        const disabled     = this.hasAttribute('disabled');
        const loading      = this.hasAttribute('loading');
        const iconWeight   = this.getAttribute('icon-weight') || 'regular';
        const iconPos      = this.getAttribute('icon-position') || 'start';
        const text         = this.getAttribute('text') || this.getAttribute('label') || '';
        const tooltip      = this.getAttribute('tooltip') || '';
        const rounded      = this.getAttribute('rounded') || 'default';
        const shadow       = this.hasAttribute('shadow');
        const href         = this.getAttribute('href') || '';
        const hrefTarget   = this.getAttribute('target') || '';
        const throttleMs   = parseInt(this.getAttribute('throttle') || '0', 10);
        const countdownSec = this.getAttribute('countdown') || '';
        const copyAttr     = this.getAttribute('copy') || '';
        const isToggle     = this.hasAttribute('toggle');
        const isGhost      = this.hasAttribute('is_ghost'); // v1 compat

        // AJAX
        const formId         = this.getAttribute('form-id');
        const postUrl        = this.getAttribute('post');
        const method         = this.getAttribute('method') || 'POST';
        const ajaxTarget     = this.getAttribute('data-target') || '';
        const successMessage = this.getAttribute('success-message') || '';
        const errorMessage   = this.getAttribute('error-message') || '';

        // Confirmation
        const skipConfirm  = this.getAttribute('skip-confirmation') === 'true';
        const confirmTitle = this.getAttribute('confirm-title')   || 'Confirm Action';
        const confirmMsg   = this.getAttribute('confirm-message') || 'Are you sure you want to proceed?';
        const confirmLabel = this.getAttribute('confirm-label')   || 'Confirm';
        const cancelLabel  = this.getAttribute('cancel-label')    || 'Cancel';
        const confirmIcon  = this.getAttribute('confirm-icon')    || '';

        // Callbacks
        const onClickFn   = this.getAttribute('data-onclick');
        const onHoverFn   = this.getAttribute('data-onhover');
        const onFocusFn   = this.getAttribute('data-onfocus');
        const onSuccessFn = this.getAttribute('data-onsuccess');
        const onErrorFn   = this.getAttribute('data-onerror');

        const finalVariant = isGhost ? 'ghost' : variant;
        const tag          = href ? 'a' : 'button';
        const classes      = this._buildClasses(finalVariant, size, rounded, shadow);

        // ── Build inner element ───────────────────────────────────────────────
        const btn = document.createElement(tag);
        btn.className = classes;
        if (tag === 'button') { btn.type = 'button'; if (disabled) btn.disabled = true; }
        if (tag === 'a')      { btn.href = href; if (hrefTarget) btn.target = hrefTarget; }
        if (tooltip)          btn.title = tooltip;
        if (loading)          btn.classList.add('sb-btn--loading');

        // Icon
        const iconEl = document.createElement('i');
        iconEl.className = `ph ph-${loading ? 'spinner' : icon} sb-icon`;

        // Text
        const textEl = text ? document.createElement('span') : null;
        if (textEl) { textEl.className = 'sb-text'; textEl.textContent = text; }

        // Spinner (hidden by default, shown during AJAX)
        const spinner = document.createElement('span');
        spinner.className = 'sb-spinner sb-spinner--hidden';
        spinner.setAttribute('role', 'status');
        spinner.setAttribute('aria-label', 'Loading');

        if (iconPos === 'end') {
            if (textEl) btn.appendChild(textEl);
            btn.appendChild(iconEl);
        } else {
            btn.appendChild(iconEl);
            if (textEl) btn.appendChild(textEl);
        }
        btn.appendChild(spinner);

        this.innerHTML = '';
        this.appendChild(btn);

        this.originalText = text;
        this.originalIcon = icon;

        // ── v2 features ───────────────────────────────────────────────────────

        // Copy to clipboard (short-circuits normal click handling)
        if (copyAttr) {
            this._initCopy(btn, copyAttr);
            return; // copy buttons don't do AJAX / confirm / toggle
        }

        // Toggle
        if (isToggle) {
            this._initToggle(btn, {
                inactiveLabel:   text,
                inactiveIcon:    icon,
                inactiveVariant: finalVariant,
                activeLabel:     this.getAttribute('toggle-active-label')   || text,
                activeIcon:      this.getAttribute('toggle-active-icon')    || icon,
                activeVariant:   this.getAttribute('toggle-active-variant') || finalVariant,
            });
            return; // toggle buttons don't do AJAX / confirm
        }

        // Countdown — disables button until timer reaches zero
        if (countdownSec) {
            this._startCountdown(btn, countdownSec, textEl);
        }

        // ── Click handler ─────────────────────────────────────────────────────
        btn.addEventListener('click', async (e) => {
            if (btn.disabled || btn.classList.contains('sb-btn--throttled')) return;

            this._ripple(e, btn);
            if (throttleMs) this._applyThrottle(btn, throttleMs);

            // Confirmation gate
            const labelText    = text.toLowerCase();
            const needsConfirm = !skipConfirm && (
                labelText.includes('delete') || labelText.includes('remove') ||
                labelText.includes('trash')  || this.hasAttribute('confirm-message')
            );

            if (needsConfirm) {
                const confirmed = await dispatchSmartConfirm({
                    title: confirmTitle, message: confirmMsg,
                    confirmLabel, cancelLabel,
                    icon: confirmIcon || (labelText.includes('delete') || labelText.includes('trash') ? '🗑' : '⚠'),
                });
                if (!confirmed) return;
            }

            // AJAX submit
            if (formId && postUrl) {
                await this._handleAjax(btn, textEl, spinner, {
                    formId, postUrl, method, target: ajaxTarget,
                    successMessage, errorMessage, onSuccessFn, onErrorFn,
                });
            }

            if (onClickFn && window[onClickFn]) window[onClickFn](e);
        });

        btn.addEventListener('mouseenter', e => { if (onHoverFn && window[onHoverFn]) window[onHoverFn](e); });
        btn.addEventListener('focus',      e => { if (onFocusFn && window[onFocusFn]) window[onFocusFn](e); });
    }

    // ── AJAX ─────────────────────────────────────────────────────────────────

    async _handleAjax(btn, textEl, spinner, config) {
        const form = document.getElementById(config.formId);
        if (!form) {
            console.error(`[smart-button] Form "${config.formId}" not found.`);
            if (config.errorMessage) this._showToast(config.errorMessage, 'error');
            return;
        }

        btn.classList.add('sb-btn--loading');
        btn.disabled = true;
        spinner.classList.remove('sb-spinner--hidden');
        const iconEl = btn.querySelector('.sb-icon');
        if (textEl)  textEl.textContent = 'Processing…';
        if (iconEl)  iconEl.className   = 'ph ph-spinner sb-icon';

        try {
            const response = await fetch(config.postUrl, {
                method:  config.method.toUpperCase(),
                body:    new FormData(form),
                headers: { 'X-Requested-With': 'XMLHttpRequest' },
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const result = await response.text();

            if (config.target) {
                const el = document.querySelector(config.target);
                if (el) el.innerHTML = result;
            }
            if (config.successMessage) this._showToast(config.successMessage, 'success');
            if (config.onSuccessFn && window[config.onSuccessFn]) window[config.onSuccessFn](result);

        } catch (err) {
            console.error('[smart-button] AJAX failed:', err);
            if (config.errorMessage) this._showToast(config.errorMessage, 'error');
            if (config.onErrorFn && window[config.onErrorFn]) window[config.onErrorFn](err);

        } finally {
            btn.classList.remove('sb-btn--loading');
            btn.disabled = false;
            spinner.classList.add('sb-spinner--hidden');
            if (textEl)  textEl.textContent = this.originalText;
            if (iconEl)  iconEl.className   = `ph ph-${this.originalIcon} sb-icon`;
        }
    }

    // ── Public API ────────────────────────────────────────────────────────────

    setIcon(name) {
        const el = this.querySelector('.sb-icon');
        if (el && !this.hasAttribute('loading')) {
            el.className = `ph ph-${name} sb-icon`;
            this.originalIcon = name;
        }
    }

    setText(text) {
        const el = this.querySelector('.sb-text');
        if (el) { el.textContent = text; this.originalText = text; }
    }

    setLoading(on) {
        const btn     = this.querySelector('.sb-btn');
        const iconEl  = this.querySelector('.sb-icon');
        const textEl  = this.querySelector('.sb-text');
        const spinner = this.querySelector('.sb-spinner');
        if (on) {
            btn.classList.add('sb-btn--loading'); btn.disabled = true;
            spinner?.classList.remove('sb-spinner--hidden');
            if (iconEl) iconEl.className = 'ph ph-spinner sb-icon';
            if (textEl) textEl.textContent = 'Processing…';
        } else {
            btn.classList.remove('sb-btn--loading'); btn.disabled = false;
            spinner?.classList.add('sb-spinner--hidden');
            if (iconEl) iconEl.className = `ph ph-${this.originalIcon} sb-icon`;
            if (textEl) textEl.textContent = this.originalText;
        }
    }
}

customElements.define('smart-button', IconButton);


// ═════════════════════════════════════════════════════════════════════════════
//  <custom-button> — AJAX form submission button
// ═════════════════════════════════════════════════════════════════════════════

const ButtonType = {
    DANGER: 'danger', WARNING: 'warning', SUCCESS: 'success',
    INFO: 'info', PRIMARY: 'primary', SECONDARY: 'secondary',
};

class CustomSubmitButton extends SmartButtonBase {
    connectedCallback() {
        const mode = this._getMode(); // 'bootstrap' | 'default'

        const label        = this.getAttribute('label') || 'Submit';
        const formId       = this.getAttribute('form-id') || this.getAttribute('formid') || '';
        const url          = this.getAttribute('post') || '';
        const method       = this.getAttribute('method') || 'POST';
        const buttonType   = this.getAttribute('buttontype') || ButtonType.WARNING;
        const throttleMs   = parseInt(this.getAttribute('throttle') || '0', 10);

        // Icon
        const customIcon      = this.getAttribute('icon') || '';
        const iconColor       = this.getAttribute('icon-color') || '';
        const iconPosition    = this.getAttribute('icon-position') || 'start';
        const iconSize        = this.getAttribute('icon-size') || '14';
        const disableAutoIcon = this.getAttribute('disable-auto-icon') === 'true';

        // Confirmation
        const skipConfirmation = this.getAttribute('skip-confirmation') === 'true';
        const confirmMessage   = this.getAttribute('confirm-message') || 'Are you sure you want to delete this item? This action cannot be undone.';
        const confirmTitle     = this.getAttribute('confirm-title')   || 'Confirm Delete';
        const confirmLabel     = this.getAttribute('confirm-label')   || 'Delete';
        const cancelLabel      = this.getAttribute('cancel-label')    || 'Cancel';

        if (mode === 'bootstrap') {
            // ── Bootstrap mode: original behaviour, zero breaking change ──────
            injectButtonStyles(); // still need sb-hidden utility

            const button = document.createElement('button');
            button.type      = 'button';
            button.className = `btn btn-${buttonType}`;

            const extraClasses = this.getAttribute('class');
            if (extraClasses) button.classList.add(...extraClasses.split(' ').filter(Boolean));

            const textSpan = document.createElement('span');
            textSpan.className = 'button-text';

            const iconName = this._getIconName(customIcon, label, disableAutoIcon);
            this._createButtonContent(textSpan, label, iconName, iconColor, iconPosition, iconSize);
            button.appendChild(textSpan);

            const spinner = document.createElement('span');
            spinner.className = 'spinner-border spinner-border-sm ms-2 d-none';
            spinner.setAttribute('role', 'status');
            spinner.setAttribute('aria-hidden', 'true');
            button.appendChild(spinner);

            this.innerHTML = '';
            this.appendChild(button);

            // Alignment style (Bootstrap mode)
            const style = document.createElement('style');
            style.textContent = `.button-text{display:inline-flex;align-items:center;gap:.375rem}.button-text i{display:inline-flex;align-items:center;vertical-align:middle;line-height:1}`;
            this.appendChild(style);

            button.addEventListener('click', async () => {
                if (throttleMs) {
                    if (this._throttleLocked) return;
                    this._throttleLocked = true;
                    setTimeout(() => { this._throttleLocked = false; }, throttleMs);
                }

                const needsConfirmation = !skipConfirmation && label.toLowerCase().includes('delete');
                if (needsConfirmation) {
                    const confirmed = await dispatchSmartConfirm({
                        title: confirmTitle, message: confirmMessage,
                        confirmLabel, cancelLabel, icon: '🗑',
                    });
                    if (!confirmed) return;
                }

                const form = document.getElementById(formId);
                if (!form) { console.error(`[custom-button] Form "${formId}" not found.`); return; }

                textSpan.textContent = 'Processing…';
                spinner.classList.remove('d-none');
                button.disabled = true;

                try {
                    const response = await fetch(url, {
                        method:  method.toUpperCase(),
                        body:    new FormData(form),
                        headers: { 'X-Requested-With': 'XMLHttpRequest' },
                    });
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    const result = await response.text();
                    const targetEl = this.getAttribute('target') ? document.querySelector(this.getAttribute('target')) : null;
                    if (targetEl) targetEl.innerHTML = result;
                    else location.reload();
                } catch (err) {
                    console.error('[custom-button] AJAX failed:', err);
                } finally {
                    textSpan.innerHTML = '';
                    this._createButtonContent(textSpan, label, iconName, iconColor, iconPosition, iconSize);
                    spinner.classList.add('d-none');
                    button.disabled = false;
                }
            });

        } else {
            // ── Default mode: self-contained styles ───────────────────────────
            injectButtonStyles();
            this._applyTheme();

            const size    = this.getAttribute('size') || 'md';
            const rounded = this.getAttribute('rounded') || 'default';
            const shadow  = this.hasAttribute('shadow');
            const iconName = this._getIconName(customIcon, label, disableAutoIcon);
            const classes  = this._buildClasses(buttonType, size, rounded, shadow);

            const btn = document.createElement('button');
            btn.type      = 'button';
            btn.className = classes;

            const iconEl = iconName ? document.createElement('i') : null;
            if (iconEl) {
                iconEl.className      = `ph ph-${iconName} sb-icon`;
                iconEl.style.fontSize = `${iconSize}px`;
                if (iconColor) iconEl.style.color = iconColor;
            }

            const textEl = document.createElement('span');
            textEl.className   = 'sb-text';
            textEl.textContent = label;

            const spinner = document.createElement('span');
            spinner.className = 'sb-spinner sb-spinner--hidden';

            if (iconPosition === 'end') {
                btn.appendChild(textEl);
                if (iconEl) btn.appendChild(iconEl);
            } else {
                if (iconEl) btn.appendChild(iconEl);
                btn.appendChild(textEl);
            }
            btn.appendChild(spinner);

            this.innerHTML = '';
            this.appendChild(btn);

            if (throttleMs) {
                // Visual throttle via CSS class
                btn.addEventListener('click', () => this._applyThrottle(btn, throttleMs));
            }

            btn.addEventListener('click', async () => {
                if (btn.disabled || btn.classList.contains('sb-btn--throttled')) return;

                this._ripple(event, btn);

                const needsConfirmation = !skipConfirmation && label.toLowerCase().includes('delete');
                if (needsConfirmation) {
                    const confirmed = await dispatchSmartConfirm({
                        title: confirmTitle, message: confirmMessage,
                        confirmLabel, cancelLabel, icon: '🗑',
                    });
                    if (!confirmed) return;
                }

                const form = document.getElementById(formId);
                if (!form) { console.error(`[custom-button] Form "${formId}" not found.`); return; }

                btn.classList.add('sb-btn--loading'); btn.disabled = true;
                textEl.textContent = 'Processing…';
                spinner.classList.remove('sb-spinner--hidden');
                if (iconEl) iconEl.className = 'ph ph-spinner sb-icon';

                try {
                    const response = await fetch(url, {
                        method:  method.toUpperCase(),
                        body:    new FormData(form),
                        headers: { 'X-Requested-With': 'XMLHttpRequest' },
                    });
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    const result = await response.text();
                    const targetEl = this.getAttribute('target') ? document.querySelector(this.getAttribute('target')) : null;
                    if (targetEl) targetEl.innerHTML = result;
                    else location.reload();
                } catch (err) {
                    console.error('[custom-button] AJAX failed:', err);
                } finally {
                    btn.classList.remove('sb-btn--loading'); btn.disabled = false;
                    textEl.textContent = label;
                    spinner.classList.add('sb-spinner--hidden');
                    if (iconEl) iconEl.className = `ph ph-${iconName} sb-icon`;
                }
            });
        }
    }

    // ── Icon helpers (shared between both modes) ──────────────────────────────

    _getIconName(customIcon, label, disableAutoIcon) {
        if (customIcon)      return customIcon;
        if (disableAutoIcon) return null;
        const l = label.toLowerCase();
        if (l.includes('delete') || l.includes('remove') || l.includes('trash')) return 'trash';
        if (l.includes('edit')   || l.includes('update') || l.includes('modify')) return 'pencil-simple';
        if (l.includes('save')   || l.includes('store'))                           return 'floppy-disk';
        if (l.includes('create') || l.includes('add')    || l.includes('new'))     return 'plus';
        if (l.includes('submit') || l.includes('send'))                            return 'paper-plane-tilt';
        if (l.includes('download') || l.includes('export'))                        return 'download-simple';
        if (l.includes('upload')   || l.includes('import'))                        return 'upload-simple';
        if (l.includes('search')   || l.includes('find'))                          return 'magnifying-glass';
        if (l.includes('view')     || l.includes('show') || l.includes('preview')) return 'eye';
        if (l.includes('copy')     || l.includes('duplicate'))                     return 'copy';
        if (l.includes('print'))                                                   return 'printer';
        if (l.includes('cancel')   || l.includes('close'))                        return 'x';
        if (l.includes('confirm')  || l.includes('ok')  || l.includes('yes'))     return 'check';
        if (l.includes('refresh')  || l.includes('reload'))                       return 'arrow-clockwise';
        return null;
    }

    _createButtonContent(container, label, iconName, iconColor, iconPosition, iconSize) {
        container.innerHTML = '';
        if (!iconName) { container.textContent = label; return; }
        const icon = document.createElement('i');
        icon.className      = `ph ph-${iconName} ph-bold p-1`;
        icon.style.fontSize = `${iconSize}px`;
        icon.style.cssText += ';line-height:1;display:inline-flex;align-items:center;';
        if (iconColor) icon.style.color = iconColor;
        const textSpan = document.createElement('span');
        textSpan.textContent = label;
        textSpan.style.cssText = 'display:inline-flex;align-items:center;';
        container.style.cssText = 'display:inline-flex;align-items:center;gap:.375rem;';
        if (iconPosition === 'end') {
            container.appendChild(textSpan);
            container.appendChild(icon);
        } else {
            container.appendChild(icon);
            container.appendChild(textSpan);
        }
    }
}

customElements.define('custom-button', CustomSubmitButton);