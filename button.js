/**
 * button.js — CustomSubmitButton (<custom-button>)
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
   Mirrors the sc-modal-* styling from smart-core so the UI stays consistent.
   ─────────────────────────────────────────────────────────────────────────── */
const SmartConfirmFallback = (() => {
    let _backdrop = null;
    let _resolve  = null;
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

    /**
     * show({ title, message, confirmLabel, cancelLabel, icon }) → Promise<boolean>
     * Returns a Promise that resolves to true (confirmed) or false (cancelled).
     */
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
            // Force reflow before adding open class so CSS transition fires
            void _backdrop.offsetWidth;
            _backdrop.classList.add('sc-modal-open');
            setTimeout(() => { const b = q('.sc-modal-confirm'); if (b) b.focus(); }, 60);
        });
    }

    return { show };
})();


/**
 * dispatchSmartConfirm(options) → Promise<boolean>
 *
 * Single entry-point used by BOTH button components:
 *  • Fires "smart-confirm" CustomEvent so <smart-modal> can intercept it.
 *  • If the event was prevented (smart-modal present) → resolves via callbacks.
 *  • If NOT prevented → shows the built-in fallback modal.
 * Guarantees exactly one dialog per call.
 */
function dispatchSmartConfirm({ title, message, confirmLabel = 'Confirm',
                                 cancelLabel = 'Cancel', icon } = {}) {
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
            // smart-modal is NOT in the DOM — use built-in fallback
            SmartConfirmFallback.show({ title, message, confirmLabel, cancelLabel, icon })
                .then(resolve);
        }
        // If prevented, smart-modal will call onConfirm/onCancel → resolves via callbacks above
    });
}


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
//  <custom-button>
// ─────────────────────────────────────────────────────────────────────────────

class CustomSubmitButton extends HTMLElement {
    connectedCallback() {
        // === Attributes ===
        const label        = this.getAttribute('label') || 'Submit';
        const formId       = this.getAttribute('form-id');
        const url          = this.getAttribute('post');
        const method       = this.getAttribute('method') || 'POST';
        const showSpinner  = this.getAttribute('showspinner') === 'true';
        const buttonType   = this.getAttribute('buttontype') || ButtonType.WARNING;

        // Confirmation settings
        const confirmMessage      = this.getAttribute('confirm-message') || 'Are you sure you want to delete this item? This action cannot be undone.';
        const confirmTitle        = this.getAttribute('confirm-title')   || 'Confirm Delete';
        const confirmLabel        = this.getAttribute('confirm-label')   || 'Delete';
        const cancelLabel         = this.getAttribute('cancel-label')    || 'Cancel';
        const skipConfirmation    = this.getAttribute('skip-confirmation') === 'true';

        // Icon settings
        const customIcon      = this.getAttribute('icon');
        const iconColor       = this.getAttribute('icon-color') || '';
        const iconPosition    = this.getAttribute('icon-position') || 'start';
        const iconSize        = this.getAttribute('icon-size') || '14';
        const disableAutoIcon = this.getAttribute('disable-auto-icon') === 'true';

        // === Build button ===
        const button = document.createElement('button');
        button.type      = 'button';
        button.className = `btn btn-${buttonType}`;

        const extraClasses = this.getAttribute('class');
        if (extraClasses) button.classList.add(...extraClasses.split(' '));

        const textSpan = document.createElement('span');
        textSpan.className = 'button-text';

        const iconName = this.getIconName(customIcon, label, disableAutoIcon);
        this.createButtonContent(textSpan, label, iconName, iconColor, iconPosition, iconSize);
        button.appendChild(textSpan);

        const spinner = document.createElement('span');
        spinner.className = 'spinner-border spinner-border-sm ms-2 d-none';
        spinner.setAttribute('role', 'status');
        spinner.setAttribute('aria-hidden', 'true');
        if (showSpinner) button.appendChild(spinner);

        this.innerHTML = '';
        this.appendChild(button);

        // Inline alignment styles
        const style = document.createElement('style');
        style.textContent = `
            .button-text {
                display: inline-flex; align-items: center; gap: 0.375rem;
            }
            .button-text i {
                display: inline-flex; align-items: center;
                vertical-align: middle; line-height: 1;
            }
        `;
        this.appendChild(style);

        // === Click handler ===
        button.addEventListener('click', async () => {
            // Only show confirmation for delete-like actions unless skipped
            const needsConfirmation = !skipConfirmation && label.toLowerCase().includes('delete');

            if (needsConfirmation) {
                // Single dialog via shared dispatcher — smart-modal or built-in fallback
                const confirmed = await dispatchSmartConfirm({
                    title:        confirmTitle,
                    message:      confirmMessage,
                    confirmLabel: confirmLabel,
                    cancelLabel:  cancelLabel,
                    icon:         '🗑',
                });
                if (!confirmed) return;
            }

            const form = document.getElementById(formId);
            if (!form) {
                console.error(`[custom-button] Form "${formId}" not found.`);
                return;
            }

            const formData = new FormData(form);
            textSpan.textContent = 'Processing…';
            spinner.classList.remove('d-none');
            button.disabled = true;

            try {
                const response = await fetch(url, {
                    method:  method.toUpperCase(),
                    body:    formData,
                    headers: { 'X-Requested-With': 'XMLHttpRequest' },
                });

                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const result = await response.text();
                console.log('[custom-button] AJAX success:', result);

                const targetSelector = this.getAttribute('target');
                if (targetSelector) {
                    const target = document.querySelector(targetSelector);
                    if (target) target.innerHTML = result;
                } else {
                    location.reload();
                }

            } catch (err) {
                console.error('[custom-button] AJAX failed:', err);
            } finally {
                textSpan.innerHTML = '';
                this.createButtonContent(textSpan, label, iconName, iconColor, iconPosition, iconSize);
                spinner.classList.add('d-none');
                button.disabled = false;
            }
        });
    }

    getIconName(customIcon, label, disableAutoIcon) {
        if (customIcon)     return customIcon;
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

    createButtonContent(container, label, iconName, iconColor, iconPosition, iconSize) {
        container.innerHTML = '';
        if (!iconName) { container.textContent = label; return; }

        const icon = document.createElement('i');
        icon.className        = `ph ph-${iconName} ph-bold p-1`;
        icon.style.fontSize   = `${iconSize}px`;
        icon.style.lineHeight = '1';
        icon.style.display    = 'inline-flex';
        icon.style.alignItems = 'center';
        if (iconColor) icon.style.color = iconColor;

        const textSpan = document.createElement('span');
        textSpan.textContent     = label;
        textSpan.style.display   = 'inline-flex';
        textSpan.style.alignItems = 'center';

        container.style.display    = 'inline-flex';
        container.style.alignItems = 'center';
        container.style.gap        = '0.375rem';

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