/**
 * smart_button.js — IconButton (<smart-button>)
 *
 * Confirmation flow (single dialog guarantee):
 *  1. Fires a cancellable "smart-confirm" CustomEvent on window.
 *  2. If <smart-modal> (from smart-core.js) is present it calls
 *     event.preventDefault() and owns the dialog — nothing else runs.
 *  3. If the event was NOT prevented (smart-core not loaded), the
 *     built-in styled fallback modal is used instead.
 *  ➜  Native browser confirm() is NEVER used.
 *  ➜  Only ONE dialog can appear per click, regardless of environment.
 */

/* ─── Shared built-in fallback modal (singleton, injected once) ─────────────
   Used by BOTH <custom-button> and <smart-button> when smart-core.js is absent.
   Matches the sc-modal-* visual style from smart-core.js.
   If button.js is also on the page, SmartConfirmFallback is already defined;
   we guard with a window-scoped flag so styles are only injected once.
   ─────────────────────────────────────────────────────────────────────────── */
if (!window.__SmartConfirmFallback) {
    window.__SmartConfirmFallback = (() => {
        let _backdrop   = null;
        let _resolve    = null;
        let _keyHandler = null;

        function _injectStyles() {
            if (document.getElementById('sc-fallback-modal-styles')) return;
            const s = document.createElement('style');
            s.id = 'sc-fallback-modal-styles';
            s.textContent = `
                .sc-modal-backdrop {
                    position: fixed; inset: 0; z-index: 9997;
                    background: rgba(10,12,30,.5); backdrop-filter: blur(4px);
                    display: flex; align-items: center; justify-content: center;
                    opacity: 0; pointer-events: none; transition: opacity .2s ease;
                }
                .sc-modal-backdrop.sc-modal-open { opacity: 1; pointer-events: all; }
                .sc-modal-box {
                    background: #fff; border: 1.5px solid #e4e6f0; border-radius: 14px;
                    padding: 1.6rem; max-width: 340px; width: 90%;
                    box-shadow: 0 24px 64px rgba(0,0,0,.22);
                    transform: translateY(10px) scale(.97); transition: transform .2s ease;
                    font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
                }
                .sc-modal-backdrop.sc-modal-open .sc-modal-box { transform: translateY(0) scale(1); }
                @media (prefers-color-scheme: dark) {
                    .sc-modal-box { background: #20243a; border-color: #2c3050; color: #c4c8e8; }
                }
                .sc-modal-icon {
                    width: 44px; height: 44px; border-radius: 50%;
                    background: #fdeef2; border: 1.5px solid #f5b8c8;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 1.3rem; margin: 0 auto 1rem;
                }
                @media (prefers-color-scheme: dark) {
                    .sc-modal-icon { background: #2a0e18; border-color: #4a1828; }
                }
                .sc-modal-title   { text-align: center; font-size: 1rem; font-weight: 700; margin: 0 0 .4rem; color: inherit; }
                .sc-modal-message { text-align: center; font-size: .9rem; color: #5a6290; margin: 0 0 1.4rem; line-height: 1.55; }
                @media (prefers-color-scheme: dark) { .sc-modal-message { color: #848cb8; } }
                .sc-modal-footer  { display: flex; gap: 10px; justify-content: center; }
                .sc-modal-btn {
                    flex: 1; padding: 8px 16px; border-radius: 8px;
                    font-size: .875rem; font-weight: 600; cursor: pointer;
                    border: 1.5px solid; transition: background .12s, transform .1s;
                }
                .sc-modal-btn:active { transform: scale(.97); }
                .sc-modal-cancel  { background: #f3f5fb; border-color: #e4e6f0; color: #1e2340; }
                .sc-modal-cancel:hover  { background: #e8eaf4; }
                .sc-modal-confirm { background: #fdeef2; border-color: #f5b8c8; color: #a8203c; }
                .sc-modal-confirm:hover { background: #fbd8e0; }
                @media (prefers-color-scheme: dark) {
                    .sc-modal-cancel  { background: #20243a; border-color: #2c3050; color: #c4c8e8; }
                    .sc-modal-cancel:hover  { background: #262a44; }
                    .sc-modal-confirm { background: #2a0e18; border-color: #4a1828; color: #f090a8; }
                    .sc-modal-confirm:hover { background: #3a1022; }
                }
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
            _backdrop.setAttribute('aria-labelledby', 'sc-fb-modal-ttl');
            _backdrop.innerHTML = `
                <div class="sc-modal-box">
                    <div class="sc-modal-icon" aria-hidden="true">⚠</div>
                    <h2 class="sc-modal-title" id="sc-fb-modal-ttl">Confirm</h2>
                    <p  class="sc-modal-message">Are you sure?</p>
                    <div class="sc-modal-footer">
                        <button class="sc-modal-btn sc-modal-cancel">Cancel</button>
                        <button class="sc-modal-btn sc-modal-confirm">Confirm</button>
                    </div>
                </div>`;

            document.body.appendChild(_backdrop);

            _backdrop.querySelector('.sc-modal-cancel').addEventListener('click',  () => _close(false));
            _backdrop.querySelector('.sc-modal-confirm').addEventListener('click', () => _close(true));
            _backdrop.addEventListener('click', (e) => { if (e.target === _backdrop) _close(false); });

            _keyHandler = (e) => { if (e.key === 'Escape') _close(false); };
            document.addEventListener('keydown', _keyHandler);
        }

        function _close(confirmed) {
            if (!_backdrop) return;
            _backdrop.classList.remove('sc-modal-open');
            const r = _resolve;
            _resolve = null;
            if (r) r(confirmed);
        }

        function show({ title = 'Confirm', message = 'Are you sure?',
                        confirmLabel = 'Confirm', cancelLabel = 'Cancel', icon = '⚠' } = {}) {
            _build();
            const q = (sel) => _backdrop.querySelector(sel);
            q('.sc-modal-title').textContent   = title;
            q('.sc-modal-message').textContent = message;
            q('.sc-modal-confirm').textContent = confirmLabel;
            q('.sc-modal-cancel').textContent  = cancelLabel;
            q('.sc-modal-icon').textContent    = icon;

            return new Promise((res) => {
                _resolve = res;
                void _backdrop.offsetWidth; // force reflow for CSS transition
                _backdrop.classList.add('sc-modal-open');
                setTimeout(() => { const b = q('.sc-modal-confirm'); if (b) b.focus(); }, 60);
            });
        }

        return { show };
    })();
}

// Convenience alias — safe whether button.js is loaded before or after us
const SmartConfirmFallback = window.__SmartConfirmFallback;


/**
 * dispatchSmartConfirm(options) → Promise<boolean>
 *
 * Shared helper used by both button components. Defined on window so both
 * files can reuse it without duplication when loaded together.
 */
if (!window.__dispatchSmartConfirm) {
    window.__dispatchSmartConfirm = function dispatchSmartConfirm({
        title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', icon,
    } = {}) {
        return new Promise((resolve) => {
            const event = new CustomEvent('smart-confirm', {
                cancelable: true,
                detail: {
                    title,
                    message,
                    confirmLabel,
                    cancelLabel,
                    icon,
                    onConfirm: () => resolve(true),
                    onCancel:  () => resolve(false),
                },
            });

            const prevented = !window.dispatchEvent(event);

            if (!prevented) {
                // smart-modal NOT present — use built-in fallback
                SmartConfirmFallback.show({ title, message, confirmLabel, cancelLabel, icon })
                    .then(resolve);
            }
            // If prevented, smart-modal calls onConfirm/onCancel which resolve above
        });
    };
}

const dispatchSmartConfirm = window.__dispatchSmartConfirm;


// ─────────────────────────────────────────────────────────────────────────────
//  ButtonType enum
// ─────────────────────────────────────────────────────────────────────────────

class ButtonType {
    static DANGER    = 'danger';
    static WARNING   = 'warning';
    static SUCCESS   = 'success';
    static INFO      = 'info';
    static PRIMARY   = 'primary';
    static SECONDARY = 'secondary';
}


// ─────────────────────────────────────────────────────────────────────────────
//  <smart-button>
// ─────────────────────────────────────────────────────────────────────────────

class IconButton extends HTMLElement {
    connectedCallback() {
        const icon         = this.getAttribute('icon') || 'circle';
        const variant      = this.getAttribute('variant') || this.getAttribute('buttontype') || 'primary';
        const size         = this.getAttribute('size') || 'md';
        const disabled     = this.hasAttribute('disabled');
        const loading      = this.hasAttribute('loading');
        const iconWeight   = this.getAttribute('icon-weight') || 'regular';
        const text         = this.getAttribute('text') || this.getAttribute('label') || '';
        const tooltip      = this.getAttribute('tooltip') || '';
        const rounded      = this.getAttribute('rounded') || 'default';
        const shadow       = this.hasAttribute('shadow');
        const isGhost      = this.hasAttribute('is_ghost');
        const showSpinner  = this.getAttribute('showspinner') === 'true' || true;

        // AJAX attributes
        const formId          = this.getAttribute('form-id');
        const postUrl         = this.getAttribute('post');
        const method          = this.getAttribute('method') || 'POST';
        const target          = this.getAttribute('target');
        const successMessage  = this.getAttribute('success-message');
        const errorMessage    = this.getAttribute('error-message');

        // Confirmation attributes
        const skipConfirmation = this.getAttribute('skip-confirmation') === 'true';
        const confirmTitle     = this.getAttribute('confirm-title')   || 'Confirm Action';
        const confirmMessage   = this.getAttribute('confirm-message') || 'Are you sure you want to proceed?';
        const confirmLabel     = this.getAttribute('confirm-label')   || 'Confirm';
        const cancelLabel      = this.getAttribute('cancel-label')    || 'Cancel';
        const confirmIcon      = this.getAttribute('confirm-icon')    || '';

        // Event handler names (resolved from window scope)
        const onClickFn   = this.getAttribute('data-onclick');
        const onHoverFn   = this.getAttribute('data-onhover');
        const onFocusFn   = this.getAttribute('data-onfocus');
        const onSuccessFn = this.getAttribute('data-onsuccess');
        const onErrorFn   = this.getAttribute('data-onerror');

        const finalVariant = isGhost ? 'ghost' : variant;

        this.innerHTML = `
            <button class="icon-btn icon-btn-${finalVariant} icon-btn-${size} ${rounded !== 'default' ? `icon-btn-${rounded}` : ''} ${shadow ? 'icon-btn-shadow' : ''}"
                    ${disabled ? 'disabled' : ''}
                    ${tooltip ? `title="${tooltip}"` : ''}
                    type="button">
                <i class="ph ${loading ? 'ph-spinner' : `ph-${icon}`}"
                   data-weight="${loading ? 'bold' : iconWeight}"></i>
                ${text ? `<span class="btn-text">${text}</span>` : ''}
                ${showSpinner ? '<span class="spinner-border spinner-border-sm ms-2 d-none" role="status" aria-hidden="true"></span>' : ''}
                ${loading ? '<div class="loading-overlay"></div>' : ''}
            </button>
        `;

        const button  = this.querySelector('.icon-btn');
        const iconEl  = this.querySelector('i');
        const textEl  = this.querySelector('.btn-text');
        const spinner = this.querySelector('.spinner-border');

        this.originalText = text;
        this.originalIcon = icon;

        if (!loading) iconEl.setAttribute('data-weight', iconWeight);

        this.attachEvents(button, textEl, spinner, {
            onClickFn, onHoverFn, onFocusFn, onSuccessFn, onErrorFn,
            skipConfirmation, confirmTitle, confirmMessage, confirmLabel, cancelLabel, confirmIcon,
            formId, postUrl, method, target, successMessage, errorMessage,
        });

        this.addStyles();
        this.loadPhosphorIcons();
    }

    attachEvents(button, textEl, spinner, config) {
        const {
            onClickFn, onHoverFn, onFocusFn, onSuccessFn, onErrorFn,
            skipConfirmation, confirmTitle, confirmMessage, confirmLabel, cancelLabel, confirmIcon,
        } = config;

        button.addEventListener('click', async (e) => {
            if (button.disabled || this.hasAttribute('loading')) return;

            this.createRipple(e, button);

            // ── Confirmation gate ────────────────────────────────────────────
            // Trigger when: skip-confirmation is false AND (label/text contains
            // delete/remove/trash, OR confirm-message is explicitly set)
            const labelText  = (this.getAttribute('text') || this.getAttribute('label') || '').toLowerCase();
            const needsConfirm = !skipConfirmation && (
                labelText.includes('delete') ||
                labelText.includes('remove') ||
                labelText.includes('trash')  ||
                this.hasAttribute('confirm-message')
            );

            if (needsConfirm) {
                const confirmed = await dispatchSmartConfirm({
                    title:        confirmTitle,
                    message:      confirmMessage,
                    confirmLabel: confirmLabel,
                    cancelLabel:  cancelLabel,
                    icon:         confirmIcon || (labelText.includes('delete') || labelText.includes('trash') ? '🗑' : '⚠'),
                });
                if (!confirmed) return;
            }
            // ────────────────────────────────────────────────────────────────

            if (config.formId && config.postUrl) {
                await this.handleAjaxSubmit(button, textEl, spinner, config, onSuccessFn, onErrorFn);
            }

            if (onClickFn && window[onClickFn]) {
                window[onClickFn](e);
            }
        });

        button.addEventListener('mouseenter', (e) => {
            if (onHoverFn && window[onHoverFn]) window[onHoverFn](e);
        });

        button.addEventListener('focus', (e) => {
            if (onFocusFn && window[onFocusFn]) window[onFocusFn](e);
        });
    }

    async handleAjaxSubmit(button, textEl, spinner, config, onSuccessFn, onErrorFn) {
        const form = document.getElementById(config.formId);
        if (!form) {
            console.error(`[smart-button] Form "${config.formId}" not found.`);
            this.showError(config.errorMessage || 'Form not found');
            return;
        }

        const formData = new FormData(form);
        this.setLoadingState(true, textEl, spinner);

        try {
            const response = await fetch(config.postUrl, {
                method:  config.method.toUpperCase(),
                body:    formData,
                headers: { 'X-Requested-With': 'XMLHttpRequest' },
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const result = await response.text();
            console.log('[smart-button] AJAX success:', result);

            if (config.target) {
                const targetEl = document.querySelector(config.target);
                if (targetEl) targetEl.innerHTML = result;
            }

            if (config.successMessage) this.showSuccess(config.successMessage);
            if (onSuccessFn && window[onSuccessFn]) window[onSuccessFn](result);

        } catch (err) {
            console.error('[smart-button] AJAX failed:', err);
            if (config.errorMessage) this.showError(config.errorMessage);
            if (onErrorFn && window[onErrorFn]) window[onErrorFn](err);

        } finally {
            this.setLoadingState(false, textEl, spinner);
        }
    }

    setLoadingState(loading, textEl, spinner) {
        const button = this.querySelector('.icon-btn');
        const iconEl = this.querySelector('i');

        if (loading) {
            button.disabled = true;
            if (textEl)  textEl.textContent = 'Processing…';
            if (spinner) spinner.classList.remove('d-none');
            if (iconEl)  { iconEl.className = 'ph ph-spinner'; iconEl.setAttribute('data-weight', 'bold'); }
        } else {
            button.disabled = false;
            if (textEl)  textEl.textContent = this.originalText;
            if (spinner) spinner.classList.add('d-none');
            if (iconEl)  { iconEl.className = `ph ph-${this.originalIcon}`; iconEl.setAttribute('data-weight', this.getAttribute('icon-weight') || 'regular'); }
        }
    }

    showSuccess(message) { this.showToast(message, 'success'); }
    showError(message)   { this.showToast(message, 'error');   }

    showToast(message, type) {
        // Prefer smart-toast if available
        window.dispatchEvent(new CustomEvent('smart-toast', {
            detail: { message, type, duration: 3000 },
        }));

        // Lightweight self-contained fallback when smart-toast isn't in the DOM
        if (!document.querySelector('smart-toast')) {
            const toast = document.createElement('div');
            toast.style.cssText = [
                'position:fixed', 'top:20px', 'right:20px', 'padding:12px 20px',
                'border-radius:6px', 'color:#fff', 'font-weight:500',
                'z-index:10000', 'opacity:0', 'transform:translateX(100%)',
                'transition:all .3s ease',
                `background:${type === 'success' ? '#10b981' : '#ef4444'}`,
            ].join(';');
            toast.textContent = message;
            document.body.appendChild(toast);
            requestAnimationFrame(() => {
                toast.style.opacity   = '1';
                toast.style.transform = 'translateX(0)';
            });
            setTimeout(() => {
                toast.style.opacity   = '0';
                toast.style.transform = 'translateX(100%)';
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }
    }

    createRipple(event, button) {
        const ripple = document.createElement('span');
        const rect   = button.getBoundingClientRect();
        const size   = Math.max(rect.width, rect.height);
        ripple.style.cssText = `width:${size}px;height:${size}px;left:${event.clientX - rect.left - size / 2}px;top:${event.clientY - rect.top - size / 2}px`;
        ripple.classList.add('ripple');
        button.appendChild(ripple);
        setTimeout(() => ripple.remove(), 600);
    }

    loadPhosphorIcons() {
        if (!document.querySelector('link[href*="phosphor"]')) {
            const link = document.createElement('link');
            link.rel  = 'stylesheet';
            link.href = 'https://cdnjs.cloudflare.com/ajax/libs/phosphor-icons/2.0.2/phosphor.min.css';
            document.head.appendChild(link);
        }
    }

    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .icon-btn {
                display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem;
                border: none; cursor: pointer;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-weight: 500; text-decoration: none;
                position: relative; overflow: hidden;
                transition: all 0.2s ease-in-out; outline: none; white-space: nowrap;
            }
            .icon-btn-xs  { padding: 0.25rem;          font-size: 0.75rem;  min-width: 1.5rem; min-height: 1.5rem; }
            .icon-btn-sm  { padding: 0.375rem 0.5rem;  font-size: 0.875rem; min-width: 2rem;   min-height: 2rem;   }
            .icon-btn-md  { padding: 0.5rem 0.75rem;   font-size: 1rem;     min-width: 2.5rem; min-height: 2.5rem; }
            .icon-btn-lg  { padding: 0.75rem 1rem;     font-size: 1.125rem; min-width: 3rem;   min-height: 3rem;   }
            .icon-btn-xl  { padding: 1rem 1.25rem;     font-size: 1.25rem;  min-width: 3.5rem; min-height: 3.5rem; }

            .icon-btn-primary   { background: #3b82f6; color: #fff; border-radius: 0.375rem; }
            .icon-btn-primary:hover:not(:disabled)   { background: #2563eb; transform: translateY(-1px); }
            .icon-btn-secondary { background: #6b7280; color: #fff; border-radius: 0.375rem; }
            .icon-btn-secondary:hover:not(:disabled) { background: #4b5563; transform: translateY(-1px); }
            .icon-btn-success   { background: #10b981; color: #fff; border-radius: 0.375rem; }
            .icon-btn-success:hover:not(:disabled)   { background: #059669; transform: translateY(-1px); }
            .icon-btn-danger    { background: #ef4444; color: #fff; border-radius: 0.375rem; }
            .icon-btn-danger:hover:not(:disabled)    { background: #dc2626; transform: translateY(-1px); }
            .icon-btn-warning   { background: #f59e0b; color: #fff; border-radius: 0.375rem; }
            .icon-btn-warning:hover:not(:disabled)   { background: #d97706; transform: translateY(-1px); }
            .icon-btn-info      { background: #0ea5e9; color: #fff; border-radius: 0.375rem; }
            .icon-btn-info:hover:not(:disabled)      { background: #0284c7; transform: translateY(-1px); }
            .icon-btn-ghost   { background: transparent; color: #374151; border: 1px solid #d1d5db; border-radius: 0.375rem; }
            .icon-btn-ghost:hover:not(:disabled)  { background: #f3f4f6; border-color: #9ca3af; }
            .icon-btn-outline { background: transparent; color: #3b82f6; border: 2px solid #3b82f6; border-radius: 0.375rem; }
            .icon-btn-outline:hover:not(:disabled) { background: #3b82f6; color: #fff; }

            .icon-btn-rounded { border-radius: 0.75rem !important; }
            .icon-btn-pill    { border-radius: 9999px !important; }
            .icon-btn-square  { border-radius: 0 !important; }

            .icon-btn-shadow { box-shadow: 0 4px 6px -1px rgba(0,0,0,.1), 0 2px 4px -1px rgba(0,0,0,.06); }
            .icon-btn-shadow:hover:not(:disabled) { box-shadow: 0 10px 15px -3px rgba(0,0,0,.1), 0 4px 6px -2px rgba(0,0,0,.05); }

            .icon-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; }
            .icon-btn:has(.loading-overlay) { pointer-events: none; }
            .loading-overlay { position: absolute; inset: 0; background: rgba(255,255,255,.1); border-radius: inherit; }

            .ph-spinner { animation: sc-icon-spin 1s linear infinite; }
            @keyframes sc-icon-spin { to { transform: rotate(360deg); } }

            .spinner-border {
                display: inline-block; width: 1rem; height: 1rem; vertical-align: text-bottom;
                border: 0.125em solid currentColor; border-right-color: transparent;
                border-radius: 50%; animation: sc-spinner-border .75s linear infinite;
            }
            .spinner-border-sm { width: 0.75rem; height: 0.75rem; border-width: 0.1em; }
            @keyframes sc-spinner-border { to { transform: rotate(360deg); } }

            .icon-btn:focus-visible { outline: 2px solid #3b82f6; outline-offset: 2px; }

            .ripple {
                position: absolute; border-radius: 50%;
                background: rgba(255,255,255,.6);
                transform: scale(0); animation: sc-ripple .6s linear; pointer-events: none;
            }
            @keyframes sc-ripple { to { transform: scale(4); opacity: 0; } }

            .btn-text { line-height: 1; }
            .d-none   { display: none !important; }
            .ms-2     { margin-left: 0.5rem; }

            @media (prefers-color-scheme: dark) {
                .icon-btn-ghost { color: #f3f4f6; border-color: #4b5563; }
                .icon-btn-ghost:hover:not(:disabled) { background: #374151; border-color: #6b7280; }
            }
        `;
        this.appendChild(style);
    }

    // ── Public API ──────────────────────────────────────────────────────────

    setIcon(iconName) {
        const iconEl = this.querySelector('i');
        if (iconEl && !this.hasAttribute('loading')) {
            iconEl.className = `ph ph-${iconName}`;
            this.originalIcon = iconName;
        }
    }

    setLoading(loading) {
        this.setLoadingState(loading, this.querySelector('.btn-text'), this.querySelector('.spinner-border'));
    }

    setText(text) {
        const textEl = this.querySelector('.btn-text');
        if (textEl) {
            textEl.textContent = text;
            this.originalText  = text;
        } else if (text) {
            const span = document.createElement('span');
            span.className   = 'btn-text';
            span.textContent = text;
            this.querySelector('i').insertAdjacentElement('afterend', span);
            this.originalText = text;
        }
    }

    async submitForm() {
        this.querySelector('.icon-btn').click();
    }
}

customElements.define('smart-button', IconButton);