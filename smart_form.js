/**
 * smart-form.js  —  SmartForm web component
 *
 * Fixes applied:
 *  1. _render() no longer uses <slot> (Light DOM only — no Shadow DOM).
 *     All developer children are moved INSIDE the real <form> element so
 *     submit buttons actually trigger form submission.
 *  2. _collectFields() now returns only the top-level custom components
 *     (smart-input, smart-quill, smart-search-input) AND bare native inputs
 *     that are NOT already inside a custom component wrapper. This prevents
 *     duplicate keys from hidden inputs inside smart-input / smart-quill.
 *  3. Extensive // console.log / console.error statements added throughout the
 *     submit flow so every step is visible in DevTools.
 *
 * Attributes:
 *   api-url              – POST target URL  (triggers ajax mode in "auto")
 *   action               – native <form> action
 *   method               – HTTP method (default: POST)
 *   mode                 – "ajax" | "native" | "auto"  (default: auto)
 *   fetch-config         – JSON: { headers, bodyMode:"json"|"form" }
 *   response-map         – JSON: { successPath, messagePath, dataPath, errorsPath }
 *   refresh-target       – id of SmartTable to call .refresh() on success
 *   redirect-on-success  – URL to navigate to after success
 *   client-validate      – enables client-side validation before submit
 *   no-auto-reset        – disables form.reset() on success
 *   success-title        – show success card on success
 *   success-subtitle     – secondary text for success card
 *   success-template     – CSS selector of a <template> to clone on success
 */
class SmartForm extends HTMLElement {

    constructor() {
        super();
        this._disabled    = false;
        this._form        = null;
        this._errorBanner = null;
    }

    // ─── Lifecycle ────────────────────────────────────────────────────────────

    connectedCallback() {
        // console.log('[SmartForm] connectedCallback — building form');
        this._render();
        this._checkForbiddenComponents();
        if (!this._disabled) {
            this._attachSubmitListener();
            // console.log('[SmartForm] Submit listener attached. Ready.');
        } else {
            console.warn('[SmartForm] Form is DISABLED due to forbidden components.');
        }
    }

    // ─── DOM construction ─────────────────────────────────────────────────────

    /**
     * Wraps all developer children inside a real <form> element.
     * Uses Light DOM (no Shadow DOM / no <slot>) so submit buttons
     * inside the form actually trigger the submit event on this._form.
     */
    _render() {
        // Snapshot children before we touch the DOM
        const children = Array.from(this.childNodes);

        // Build the <form>
        this._form           = document.createElement('form');
        this._form.className = 'sf-form';

        const action = this.getAttribute('action');
        const method = this.getAttribute('method') || 'POST';
        if (action) this._form.setAttribute('action', action);
        this._form.setAttribute('method', method);

        // Error banner — hidden until needed
        this._errorBanner           = document.createElement('div');
        this._errorBanner.className = 'sf-error-banner alert alert-danger';
        this._errorBanner.style.display = 'none';
        this._form.appendChild(this._errorBanner);

        // Move all existing children INTO the form
        children.forEach(child => this._form.appendChild(child));

        // Finally add the form to the component
        this.appendChild(this._form);

        this._injectStyles();
        // console.log('[SmartForm] DOM rendered. Children moved into <form>.');
    }

    // ─── Forbidden component guard ────────────────────────────────────────────

    _checkForbiddenComponents() {
        const forbidden = [
            ...this.querySelectorAll('custom-submit-button'),
            ...this.querySelectorAll('icon-button[post]'),
        ];
        if (forbidden.length > 0) {
            console.error(
                "[SmartForm] Error: Do not use <custom-submit-button> or <icon-button post> inside <smart-form>. Use a plain <button type='submit'>."
            );
            this._disabled = true;
        }
    }

    // ─── Submit wiring ────────────────────────────────────────────────────────

    _attachSubmitListener() {
        this._form.addEventListener('submit', (e) => {
            // console.log('[SmartForm] submit event fired');
            this._handleSubmit(e);
        });
    }

    // ─── Mode detection ───────────────────────────────────────────────────────

    _resolveMode() {
        const mode = (this.getAttribute('mode') || 'auto').toLowerCase();
        if (mode === 'ajax')   return 'ajax';
        if (mode === 'native') return 'native';
        return this.getAttribute('api-url') ? 'ajax' : 'native';
    }

    // ─── Main submit handler ──────────────────────────────────────────────────

    async _handleSubmit(e) {
        if (this._disabled) {
            console.warn('[SmartForm] Submit blocked — form is disabled.');
            e.preventDefault();
            return;
        }

        const mode = this._resolveMode();
        // console.log('[SmartForm] Resolved mode:', mode);

        // ── Native mode ───────────────────────────────────────────────────────
        if (mode === 'native') {
            if (this.hasAttribute('client-validate')) {
                const valid = this._runClientValidation();
                // console.log('[SmartForm] Native client-validate result:', valid);
                if (!valid) { e.preventDefault(); return; }
            }
            this._dispatchLoader('show');
            return; // let the browser submit normally
        }

        // ── AJAX mode ─────────────────────────────────────────────────────────
        e.preventDefault();

        if (this.hasAttribute('client-validate')) {
            const valid = this._runClientValidation();
            // console.log('[SmartForm] AJAX client-validate result:', valid);
            if (!valid) return;
        }

        const url = this.getAttribute('api-url');
        if (!url) {
            console.error('[SmartForm] AJAX mode but no api-url attribute set!');
            this._showErrorBanner('Form configuration error: api-url is missing.');
            return;
        }

        this._hideErrorBanner();
        this._dispatchLoader('show');

        const method = (this.getAttribute('method') || 'POST').toUpperCase();

        // Parse fetch-config
        let fetchConfig = {};
        try {
            const raw = this.getAttribute('fetch-config');
            if (raw) fetchConfig = JSON.parse(raw);
        } catch (err) {
            console.warn('[SmartForm] Invalid fetch-config JSON — using defaults.', err);
        }

        const bodyMode = (fetchConfig.bodyMode || 'json').toLowerCase();
        const values   = this.getValues();

        // console.log('[SmartForm] Collected values:', values);
        // console.log('[SmartForm] Body mode:', bodyMode);
        // console.log('[SmartForm] Posting to:', url, 'with method:', method);

        // Build headers
        const headers = Object.assign({}, fetchConfig.headers || {});
        headers['X-Requested-With'] = 'XMLHttpRequest';

        const csrfToken = this._getCSRFToken();
        if (csrfToken) {
            headers['X-CSRFToken'] = csrfToken;
            // console.log('[SmartForm] CSRF token attached.');
        } else {
            console.warn('[SmartForm] No CSRF token found — POST may be rejected by Django.');
        }

        let body;
        if (bodyMode === 'form') {
            const fd = new FormData();
            Object.entries(values).forEach(([k, v]) => {
                if (Array.isArray(v)) {
                    v.forEach(item => fd.append(k, item));
                } else if (v !== null && v !== undefined) {
                    fd.append(k, v);
                }
            });
            body = fd;
            // console.log('[SmartForm] Using FormData body.');
        } else {
            headers['Content-Type'] = 'application/json';
            body = JSON.stringify(values);
            // console.log('[SmartForm] Using JSON body:', body);
        }

        try {
            // console.log('[SmartForm] Sending fetch request…');
            const response = await fetch(url, { method, headers, body });

            // console.log('[SmartForm] Response received. Status:', response.status, response.statusText);

            const contentType = response.headers.get('Content-Type') || '';
            let data = null;
            if (contentType.includes('application/json')) {
                data = await response.json();
                // console.log('[SmartForm] Response JSON:', data);
            } else {
                data = await response.text();
                // console.log('[SmartForm] Response text:', data);
            }

            this._dispatchLoader('hide');
            this._handleResponse(response, data);

        } catch (err) {
            this._dispatchLoader('hide');
            console.error('[SmartForm] Fetch failed with network error:', err);
            this._showErrorBanner('Network error: ' + err.message);
        }
    }

    // ─── Response parsing ─────────────────────────────────────────────────────

    _handleResponse(response, data) {
        let responseMap = {};
        try {
            const raw = this.getAttribute('response-map');
            if (raw) responseMap = JSON.parse(raw);
        } catch (err) {
            console.warn('[SmartForm] Invalid response-map JSON:', err);
        }

        const successPath = responseMap.successPath || 'status';
        const messagePath = responseMap.messagePath || 'message';
        const errorsPath  = responseMap.errorsPath  || 'errors';

        // console.log('[SmartForm] Parsing response with map:', responseMap);

        // Start with HTTP status
        let isSuccess = response.ok;

        // Override with application-level success flag if present
        if (data && typeof data === 'object') {
            const statusVal = this._getPath(data, successPath);
            if (statusVal !== undefined) {
                isSuccess = (statusVal === true || statusVal === 'success' || statusVal === 'ok' || statusVal === 1);
                // console.log(`[SmartForm] App-level success flag "${successPath}" =`, statusVal, '→ isSuccess:', isSuccess);
            }
        }

        if (isSuccess) {
            const message = (data && typeof data === 'object')
                ? (this._getPath(data, messagePath) || 'Saved successfully')
                : 'Saved successfully';
            // console.log('[SmartForm] ✅ Success. Message:', message);
            this._onSuccess(message, data);
        } else {
            const errors = (data && typeof data === 'object')
                ? (this._getPath(data, errorsPath) || {})
                : {};
            const message = (data && typeof data === 'object')
                ? (this._getPath(data, messagePath) || 'An error occurred')
                : 'An error occurred';
            console.warn('[SmartForm] ❌ Error. Message:', message, 'Errors:', errors);
            this._onError(errors, message);
        }
    }

    // ─── Success flow ─────────────────────────────────────────────────────────

    _onSuccess(message, data) {
        this._dispatchToast(message, 'success');

        if (!this.hasAttribute('no-auto-reset')) {
            // console.log('[SmartForm] Auto-resetting form.');
            this.reset();
        }

        const refreshTarget = this.getAttribute('refresh-target');
        if (refreshTarget) {
            const table = document.getElementById(refreshTarget);
            if (table && typeof table.refresh === 'function') {
                // console.log('[SmartForm] Refreshing target:', refreshTarget);
                table.refresh();
            } else {
                console.warn('[SmartForm] refresh-target element not found or has no refresh():', refreshTarget);
            }
        }

        const successTemplate = this.getAttribute('success-template');
        const successTitle    = this.getAttribute('success-title');
        const successSubtitle = this.getAttribute('success-subtitle');

        if (successTemplate) {
            const tmpl = document.querySelector(successTemplate);
            if (tmpl && tmpl.content) {
                this._replaceFormWith(tmpl.content.cloneNode(true));
            } else {
                console.warn('[SmartForm] success-template not found:', successTemplate);
            }
        } else if (successTitle) {
            const card       = document.createElement('div');
            card.className   = 'smart-form-success alert alert-success text-center';
            card.innerHTML   = `<h4>${successTitle}</h4>${successSubtitle ? `<p>${successSubtitle}</p>` : ''}`;
            this._replaceFormWith(card);
        }

        const redirect = this.getAttribute('redirect-on-success');
        if (redirect) {
            // console.log('[SmartForm] Redirecting to:', redirect);
            window.location.href = redirect;
        }

        this.dispatchEvent(new CustomEvent('smart-form-success', { bubbles: true, detail: { message, data } }));
    }

    // ─── Error flow ───────────────────────────────────────────────────────────

    _onError(errors, fallbackMessage) {
        let hasFieldErrors = false;

        if (errors && typeof errors === 'object') {
            Object.entries(errors).forEach(([fieldName, errorMsg]) => {
                const el = this._findField(fieldName);
                if (el) {
                    // console.log(`[SmartForm] Showing field error on "${fieldName}":`, errorMsg);
                    this._showFieldError(el, errorMsg);
                    hasFieldErrors = true;
                } else {
                    console.warn(`[SmartForm] Field "${fieldName}" not found — showing in banner.`);
                    this._showErrorBanner(`${fieldName}: ${errorMsg}`);
                }
            });
        }

        if (!hasFieldErrors) {
            this._showErrorBanner(fallbackMessage);
        }

        this.dispatchEvent(new CustomEvent('smart-form-error', { bubbles: true, detail: { errors, message: fallbackMessage } }));
    }

    // ─── Client validation ────────────────────────────────────────────────────

    _runClientValidation() {
        let allValid = true;
        const fields = this._collectFields();
        // console.log('[SmartForm] Running client validation on', fields.length, 'fields.');

        fields.forEach(el => {
            let valid = true;
            const name = el.getAttribute('name') || el.getAttribute('input-name') || el.name || el.tagName;
            if (typeof el.validate === 'function') {
                valid = el.validate();
                // console.log(`[SmartForm] validate() on "${name}":`, valid);
            } else if (typeof el.checkValidity === 'function') {
                valid = el.checkValidity();
                if (!valid && typeof el.reportValidity === 'function') el.reportValidity();
                // console.log(`[SmartForm] checkValidity() on "${name}":`, valid);
            }
            if (!valid) allValid = false;
        });

        return allValid;
    }

    // ─── Value collection ─────────────────────────────────────────────────────

    /**
     * Returns { fieldName: value } for every named field in the form.
     *
     * Collection strategy (avoids duplicates):
     *  1. Custom components (smart-input, smart-quill, smart-search-input, any
     *     element with a getValue() method) are collected by their `name` /
     *     `input-name` attribute.
     *  2. Native inputs that are NOT inside a custom component wrapper are also
     *     included (e.g. a plain <input name="x"> directly inside smart-form).
     *  3. Hidden inputs that live *inside* a custom component are intentionally
     *     skipped — the custom component's getValue() already covers them.
     */
    getValues() {
        const values = {};

        // ── Step 1: custom components ─────────────────────────────────────────
        const customWrappers = Array.from(
            this.querySelectorAll('smart-input, smart-quill, smart-search-input')
        );

        customWrappers.forEach(el => {
            const name = el.getAttribute('name') || el.getAttribute('input-name');
            if (!name) return;

            let value;
            if (typeof el.getValue === 'function') {
                value = el.getValue();
            } else {
                value = el.value;
            }

            // console.log(`[SmartForm] getValues — custom "${name}":`, value);
            values[name] = value !== undefined ? value : null;
        });

        // ── Step 2: also pick up any element with getValue() that isn't one of the above ──
        const allWithGetValue = Array.from(this.querySelectorAll('*')).filter(el => {
            if (customWrappers.includes(el)) return false; // already handled
            return typeof el.getValue === 'function' &&
                   (el.getAttribute('name') || el.getAttribute('input-name'));
        });

        allWithGetValue.forEach(el => {
            const name  = el.getAttribute('name') || el.getAttribute('input-name');
            const value = el.getValue();
            // console.log(`[SmartForm] getValues — custom (other) "${name}":`, value);
            values[name] = value !== undefined ? value : null;
        });

        // ── Step 3: bare native inputs NOT inside a known custom wrapper ──────
        const nativeInputs = Array.from(
            this.querySelectorAll('input, select, textarea')
        ).filter(el => {
            const name = el.name;
            if (!name) return false;
            if (el.type === 'hidden') return false; // hidden fields inside custom components
            // Skip if ancestor is a custom component
            const insideCustom = el.closest('smart-input, smart-quill, smart-search-input');
            return !insideCustom;
        });

        nativeInputs.forEach(el => {
            const name = el.name;
            let value;
            if (el.type === 'checkbox') {
                value = el.checked;
            } else if (el.type === 'file') {
                value = el.files;
            } else {
                value = el.value;
            }
            // console.log(`[SmartForm] getValues — native "${name}":`, value);
            values[name] = value;
        });

        // console.log('[SmartForm] Final collected values:', values);
        return values;
    }

    /**
     * Programmatically populate field values.
     * @param {Object} obj
     */
    setValues(obj) {
        if (!obj || typeof obj !== 'object') return;
        Object.entries(obj).forEach(([fieldName, value]) => {
            const el = this._findField(fieldName);
            if (!el) {
                console.warn('[SmartForm] setValues — field not found:', fieldName);
                return;
            }
            if (typeof el.setValue === 'function') {
                el.setValue(value);
            } else if ('value' in el) {
                el.value = value;
            }
        });
    }

    /** Programmatic submit */
    submit() {
        // console.log('[SmartForm] .submit() called programmatically.');
        if (this._form) {
            this._form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        }
    }

    /** Reset form + clear all custom components */
    reset() {
        if (this._form) this._form.reset();
        this._collectFields().forEach(el => {
            if (typeof el.clear === 'function') el.clear();
        });
    }

    // ─── Field helpers ────────────────────────────────────────────────────────

    /**
     * Collect fields for validation purposes.
     * Returns custom component wrappers + bare native inputs outside them.
     */
    _collectFields() {
        const customWrappers = Array.from(
            this.querySelectorAll('smart-input, smart-quill, smart-search-input')
        );

        // Also any element with a validate() that isn't one of the above
        const otherCustom = Array.from(this.querySelectorAll('*')).filter(el => {
            if (customWrappers.includes(el)) return false;
            return typeof el.validate === 'function' || typeof el.getValue === 'function';
        });

        const nativeInputs = Array.from(
            this.querySelectorAll('input, select, textarea')
        ).filter(el => {
            if (!el.name) return false;
            if (el.type === 'hidden') return false;
            return !el.closest('smart-input, smart-quill, smart-search-input');
        });

        return [...customWrappers, ...otherCustom, ...nativeInputs];
    }

    _findField(fieldName) {
        return (
            this.querySelector(`[name="${fieldName}"]`) ||
            this.querySelector(`[input-name="${fieldName}"]`)
        );
    }

    _showFieldError(el, message) {
        if (typeof el.showError === 'function') { el.showError(message); return; }

        // Walk up to the nearest custom-component container or parent
        const wrapper = el.closest('smart-input, smart-quill, smart-search-input') || el.parentElement;
        if (!wrapper) return;

        const feedback = wrapper.querySelector('.invalid-feedback, .sq-invalid-feedback');
        if (feedback) {
            feedback.textContent = message;
            // Support both Bootstrap class and our custom sq-visible class
            feedback.classList.remove('d-none');
            feedback.classList.add('sq-visible');
            feedback.style.display = 'block';
        }

        const target = wrapper.querySelector('input:not([type=hidden]), select, textarea, .quill-container, .multi-select-display');
        if (target) target.classList.add('is-invalid');
    }

    // ─── Error banner ─────────────────────────────────────────────────────────

    _showErrorBanner(message) {
        if (!this._errorBanner) return;
        this._errorBanner.textContent = message;
        this._errorBanner.style.display = 'block';
    }

    _hideErrorBanner() {
        if (!this._errorBanner) return;
        this._errorBanner.style.display = 'none';
        this._errorBanner.textContent = '';
    }

    _replaceFormWith(node) {
        if (this._form) {
            this._form.replaceWith(node);
            this._form        = null;
            this._errorBanner = null;
        }
    }

    // ─── Event helpers ────────────────────────────────────────────────────────

    _dispatchLoader(action) {
        try {
            window.dispatchEvent(new CustomEvent('smart-loader', { detail: { action } }));
        } catch (e) { /* safe */ }
    }

    _dispatchToast(message, type = 'success') {
        try {
            window.dispatchEvent(new CustomEvent('smart-toast', { detail: { message, type } }));
            // console.log('[SmartForm] Toast dispatched:', message, type);
        } catch (e) { /* safe */ }
    }

    // ─── Utilities ────────────────────────────────────────────────────────────

    _getPath(obj, path) {
        if (!path) return undefined;
        return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
    }

    _getCSRFToken() {
        const match = document.cookie.match(/csrftoken=([^;]+)/);
        if (match) return decodeURIComponent(match[1]);
        const meta = document.querySelector('meta[name="csrf-token"]');
        if (meta) return meta.getAttribute('content');
        return null;
    }

    // ─── Styles ───────────────────────────────────────────────────────────────

    _injectStyles() {
        if (document.getElementById('smart-form-styles')) return;
        const style = document.createElement('style');
        style.id    = 'smart-form-styles';
        style.textContent = `
            smart-form { display: block; }

            .sf-form { width: 100%; }

            .sf-error-banner {
                margin-bottom: 1rem;
                border-radius: 0.375rem;
            }

            .smart-form-success {
                border-radius: 0.5rem;
                padding: 2rem;
            }
            .smart-form-success h4 {
                font-weight: 600;
                margin-bottom: 0.5rem;
            }
            .smart-form-success p {
                margin-bottom: 0;
                color: #155724;
            }
        `;
        document.head.appendChild(style);
    }
}

customElements.define('smart-form', SmartForm);