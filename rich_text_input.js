/**
 * rich_text_input.js  —  SmartQuill web component
 *
 * Fixes applied:
 *  1. addStyles() / _injectStyles() now injects ONE scoped <style> into <head>
 *     using "smart-quill ..." selectors — no global bleed into Bootstrap classes.
 *  2. loadQuillStyles() now returns a Promise and defers editor init until
 *     both CSS + JS assets are fully loaded — no manual <script> tag required.
 *  3. connectedCallback() calls loadQuillStyles().then(_initEditor) so Quill
 *     is always available when the editor is created.
 */


class SmartQuill extends HTMLElement {
    constructor() {
        super();
        this.editor = null;
        this._initialized = false;
    }

    static get observedAttributes() {
        return ['value'];
    }

    get value() {
        return this.editor ? this.editor.root.innerHTML : '';
    }

    set value(newValue) {
        if (this.editor && newValue !== this.editor.root.innerHTML) {
            this.editor.root.innerHTML = newValue;
            const hiddenInput = this.querySelector(`input[name="${this.getAttribute('name') || 'richtext'}"]`);
            if (hiddenInput) hiddenInput.value = newValue;
        }
    }

    // ─── Lifecycle ────────────────────────────────────────────────────────────

    connectedCallback() {
        if (this._initialized) return; // guard against double-call
        this._initialized = true;

        const name            = this.getAttribute('name') || 'richtext';
        const label           = this.getAttribute('label') || 'Description';
        const placeholder     = this.getAttribute('placeholder') || '';
        const required        = this.hasAttribute('required');
        const requiredMessage = this.getAttribute('required-message') || `${label} is required`;
        const content         = this.getAttribute('value') || this.textContent.trim();

        // Store config before innerHTML wipe
        this.config = { name, label, placeholder, required, requiredMessage };

        // Inject scoped styles (once per page)
        this._injectStyles();

        // Build skeleton HTML
        this.innerHTML = `
            <div class="smart-quill-container">
                <label class="form-label smart-quill-label">
                    ${label}${required ? '<span class="text-danger"> *</span>' : ''}
                </label>
                <div class="quill-container">
                    <div class="quill-editor"></div>
                    <input type="hidden" name="${name}" />
                </div>
                <div class="sq-invalid-feedback">${requiredMessage}</div>
            </div>
        `;

        this.errorFeedback  = this.querySelector('.sq-invalid-feedback');
        this.container      = this.querySelector('.smart-quill-container');
        this.quillContainer = this.querySelector('.quill-container');

        // Load Quill assets then initialise the editor
        this._loadQuill().then(() => {
            this._initEditor(content);
        });
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'value' && this.editor) {
            this.value = newValue;
        }
    }

    // ─── Asset loading ────────────────────────────────────────────────────────

    /**
     * Returns a singleton Promise that resolves once Quill JS + CSS are ready.
     * Multiple instances share the same Promise — assets are only injected once.
     */
    _loadQuill() {
        if (SmartQuill._quillReady) return SmartQuill._quillReady;

        SmartQuill._quillReady = new Promise((resolve) => {
            // ── CSS (non-blocking, best-effort) ──────────────────────────────
            if (!document.querySelector('link[href*="quill"]')) {
                const link = document.createElement('link');
                link.rel  = 'stylesheet';
                link.href = 'https://cdnjs.cloudflare.com/ajax/libs/quill/1.3.7/quill.snow.min.css';
                document.head.appendChild(link);
            }

            // ── JS ────────────────────────────────────────────────────────────
            if (typeof Quill !== 'undefined') {
                // Developer already imported Quill manually — nothing to do
                console.log('[SmartQuill] Quill already present on page, skipping CDN load.');
                resolve();
                return;
            }

            // If a script tag was already added by another instance, wait for it
            const existing = document.querySelector('script[src*="quill"]');
            if (existing) {
                console.log('[SmartQuill] Quill script tag found, waiting for load…');
                existing.addEventListener('load',  resolve, { once: true });
                existing.addEventListener('error', () => {
                    console.error('[SmartQuill] Existing Quill script failed to load.');
                    resolve();
                }, { once: true });
                return;
            }

            console.log('[SmartQuill] Injecting Quill from CDN…');
            const script  = document.createElement('script');
            script.src    = 'https://cdnjs.cloudflare.com/ajax/libs/quill/1.3.7/quill.min.js';
            script.onload = () => {
                console.log('[SmartQuill] Quill loaded successfully from CDN.');
                resolve();
            };
            script.onerror = () => {
                console.error('[SmartQuill] Failed to load Quill from CDN. Add it manually.');
                resolve(); // resolve anyway so we don't hang; _initEditor will warn
            };
            document.head.appendChild(script);
        });

        return SmartQuill._quillReady;
    }

    // Legacy public alias (keep existing callers working)
    loadQuillStyles() {
        return this._loadQuill();
    }

    // ─── Editor initialisation ────────────────────────────────────────────────

    _initEditor(content) {
        if (typeof Quill === 'undefined') {
            console.error('[SmartQuill] Quill is not defined — editor cannot be initialised.');
            return;
        }

        const editorContainer = this.querySelector('.quill-editor');
        const hiddenInput     = this.querySelector(`input[name="${this.config.name}"]`);

        if (!editorContainer || !hiddenInput) {
            console.error('[SmartQuill] Editor container or hidden input not found in DOM.');
            return;
        }

        console.log('[SmartQuill] Initialising editor for field:', this.config.name);

        this.editor = new Quill(editorContainer, {
            theme: 'snow',
            placeholder: this.config.placeholder,
            modules: {
                toolbar: [
                    ['bold', 'italic', 'underline', 'strike'],
                    ['blockquote', 'code-block'],
                    ['link', 'image', 'video', 'formula'],
                    [{ header: 1 }, { header: 2 }],
                    [{ list: 'ordered' }, { list: 'bullet' }, { list: 'check' }],
                    [{ script: 'sub' }, { script: 'super' }],
                    [{ indent: '-1' }, { indent: '+1' }],
                    [{ direction: 'rtl' }],
                    [{ size: ['small', false, 'large', 'huge'] }],
                    [{ header: [1, 2, 3, 4, 5, 6, false] }],
                    [{ color: [] }, { background: [] }],
                    [{ font: [] }],
                    [{ align: [] }],
                    ['code-block'],
                    ['clean'],
                ],
                history: { delay: 1000, maxStack: 500, userOnly: true },
            },
        });

        if (content) {
            this.editor.root.innerHTML = content;
            hiddenInput.value = content;
        }

        // Sync hidden input on every text change
        this.editor.on('text-change', () => {
            const html = this.editor.root.innerHTML;
            hiddenInput.value = html;
            if (this.hasContent()) this.hideValidationError();
            this.dispatchEvent(new CustomEvent('input', { bubbles: true, detail: { value: html } }));
        });

        // Validate on blur when required
        this.editor.on('selection-change', (range) => {
            if (range === null && this.config.required) {
                setTimeout(() => this.validate(), 100);
            }
        });

        console.log('[SmartQuill] Editor ready for field:', this.config.name);
    }

    // ─── Content helpers ──────────────────────────────────────────────────────

    hasContent() {
        if (!this.editor) return false;
        const text = this.editor.getText().trim();
        const html = this.editor.root.innerHTML;
        return text.length > 0 && html !== '<p><br></p>' && html !== '<p></p>';
    }

    // ─── Validation ───────────────────────────────────────────────────────────

    validate() {
        if (!this.config || !this.config.required) return true;
        const isValid = this.hasContent();
        isValid ? this.hideValidationError() : this.showValidationError();
        return isValid;
    }

    showValidationError() {
        if (this.quillContainer) this.quillContainer.classList.add('is-invalid');
        if (this.errorFeedback)  this.errorFeedback.classList.add('sq-visible');
        if (this.container) {
            this.container.classList.add('sq-shake');
            setTimeout(() => this.container.classList.remove('sq-shake'), 500);
        }
    }

    hideValidationError() {
        if (this.quillContainer) this.quillContainer.classList.remove('is-invalid');
        if (this.errorFeedback)  this.errorFeedback.classList.remove('sq-visible');
    }

    checkValidity()  { return this.validate(); }
    reportValidity() {
        const ok = this.validate();
        if (!ok && this.editor) this.editor.focus();
        return ok;
    }

    // ─── Public API ───────────────────────────────────────────────────────────

    /** SmartForm integration — returns HTML string */
    getValue() { return this.value; }

    /** SmartForm integration — sets value */
    setValue(val) { this.value = val; }

    focus()  { if (this.editor) this.editor.focus(); }
    blur()   { if (this.editor) this.editor.blur();  }

    clear() {
        if (this.editor) {
            this.editor.setText('');
            this.hideValidationError();
        }
    }

    getLength() { return this.editor ? this.editor.getLength() : 0; }
    getText()   { return this.editor ? this.editor.getText()   : ''; }
    getHTML()   { return this.editor ? this.editor.root.innerHTML : ''; }

    // ─── Scoped styles ────────────────────────────────────────────────────────

    /**
     * Injects ONE <style> block into <head> with all selectors prefixed by
     * "smart-quill" so nothing leaks into Bootstrap or other components.
     */
    _injectStyles() {
        if (document.getElementById('smart-quill-styles')) return;

        const style = document.createElement('style');
        style.id    = 'smart-quill-styles';
        style.textContent = `
            smart-quill { display: block; }

            smart-quill .smart-quill-container { position: relative; }

            smart-quill .smart-quill-label {
                font-weight: 500;
                margin-bottom: 0.5rem;
                color: #374151;
            }

            smart-quill .quill-container { position: relative; }

            smart-quill .quill-container.is-invalid .ql-container {
                border-color: #dc3545 !important;
                box-shadow: 0 0 0 0.2rem rgba(220,53,69,.25) !important;
            }

            smart-quill .quill-container.is-invalid .ql-toolbar {
                border-color: #dc3545 !important;
            }

            /* Scoped error feedback — sq- prefix avoids Bootstrap .invalid-feedback conflict */
            smart-quill .sq-invalid-feedback {
                display: none;
                width: 100%;
                margin-top: 0.25rem;
                font-size: 0.875rem;
                color: #dc3545;
            }
            smart-quill .sq-invalid-feedback.sq-visible { display: block; }

            /* Scoped shake — sq-shake / sq-shake keyframe */
            smart-quill .sq-shake { animation: sq-shake 0.5s ease-in-out; }

            @keyframes sq-shake {
                0%,100%          { transform: translateX(0);  }
                10%,30%,50%,70%,90% { transform: translateX(-5px); }
                20%,40%,60%,80%    { transform: translateX( 5px); }
            }

            smart-quill .ql-container {
                font-size: 14px;
                border-bottom-left-radius: 0.375rem;
                border-bottom-right-radius: 0.375rem;
            }

            smart-quill .ql-toolbar {
                border-top-left-radius: 0.375rem;
                border-top-right-radius: 0.375rem;
                background: #f8f9fa;
            }

            smart-quill .ql-editor {
                min-height: 150px;
                max-height: 400px;
                overflow-y: auto;
            }

            smart-quill .ql-editor.ql-blank::before {
                font-style: italic;
                color: #6b7280;
            }

            @media (prefers-color-scheme: dark) {
                smart-quill .smart-quill-label        { color: #f3f4f6; }
                smart-quill .ql-toolbar               { border-color: #4b5563; }
                smart-quill .ql-container             { border-color: #4b5563; }
                smart-quill .ql-editor                { color: #f3f4f6; }
                smart-quill .ql-editor.ql-blank::before { color: #9ca3af; }
            }
        `;
        document.head.appendChild(style);
    }

    // Legacy alias so existing code calling addStyles() still works
    addStyles() { this._injectStyles(); }
}


// Module-level singleton Promise — shared across all instances
SmartQuill._quillReady = null;

customElements.define('smart-quill', SmartQuill);