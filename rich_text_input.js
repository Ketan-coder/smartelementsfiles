/**
 * rich_text_input.js — SmartQuill v2.0
 * <smart-quill> web component — feature-complete rich text editor.
 *
 * ── WHAT'S NEW IN v2 ────────────────────────────────────────────────────────
 * • Token system + theme="auto|light|dark" — [data-sc-theme] driven, same
 *   pattern as smart-input / smart-button. styled="bootstrap" keeps Bootstrap
 *   label class.
 * • toolbar="minimal|standard|full|custom" — declarative toolbar presets.
 *   custom: pass JSON array as toolbar-config attribute.
 * • maxlength="N" — character limit with live counter. Blocks input at limit.
 * • word-count — live word counter alongside character count.
 * • autosave="key" — saves to localStorage every 2s, restores on mount,
 *   shows subtle "Draft saved · {time}" indicator.
 * • readonly — renders formatted HTML without toolbar. No Quill init needed.
 * • image-upload-url="/api/upload/" — intercepts Quill base64 embedding,
 *   POSTs file to Django endpoint, inserts returned URL instead.
 * • Paste sanitisation — strips Word/Google Docs junk on paste, keeps only
 *   semantic tags (b, i, u, a, p, ul, ol, li, h1–h6, blockquote, code, pre).
 * • Export — export-pdf and export-html toolbar buttons. PDF uses print
 *   dialog (no external dep). HTML downloads a .html file.
 * • fullscreen — toolbar button to expand the editor into a full
 *   viewport overlay (not native Fullscreen API), with a close (✕) button
 *   and Escape-to-close. Theme-aware in both states.
 *
 * ── BACKWARDS COMPATIBILITY ───────────────────────────────────────────────
 * All v1 attributes, methods, and events preserved.
 * addStyles(), loadQuillStyles() aliases kept.
 * SmartQuill._quillReady singleton preserved.
 *
 * ── ATTRIBUTE REFERENCE ──────────────────────────────────────────────────────
 *   name="fieldname"             hidden input name (default: richtext)
 *   label="Description"          label text
 *   placeholder="Type here…"     editor placeholder
 *   required                     validation required
 *   required-message="…"         custom validation message
 *   value="<p>Hello</p>"         initial HTML content
 *   styled="bootstrap|default"   default=default
 *   theme="auto|light|dark"      default=auto
 *   toolbar="minimal|standard|full|custom"  default=standard
 *   toolbar-config='[…]'         JSON toolbar array when toolbar="custom"
 *   maxlength="500"              character limit (0 = unlimited)
 *   word-count                   show live word count
 *   autosave="draft-key"         localStorage key for autosave
 *   readonly                     display-only, no editing
 *   image-upload-url="/api/…"    POST endpoint for image uploads
 *   no-fullscreen                opt out of the fullscreen toolbar button
 *
 * ── EVENTS ───────────────────────────────────────────────────────────────────
 *   input          — fires on every text change. detail: { value, length, words }
 *   sq-autosave    — fires after autosave. detail: { key, timestamp }
 *   sq-image       — fires after image upload. detail: { url }
 *   sq-export      — fires after export. detail: { format: 'pdf'|'html' }
 *   sq-fullscreen  — fires on enter/exit. detail: { fullscreen: true|false }
 *
 * ── STABLE CLASS REFERENCE ───────────────────────────────────────────────────
 *   .sq-container        outer wrapper
 *   .sq-label            the <label> element
 *   .sq-toolbar-extra    container for export buttons appended after Quill toolbar
 *   .sq-counter          character / word count bar
 *   .sq-counter-chars    character count span
 *   .sq-counter-words    word count span
 *   .sq-autosave-badge   "Draft saved" indicator
 *   .sq-readonly         added to container when readonly
 *   .sq-invalid-feedback validation error message
 *   .sq-visible          utility: makes hidden elements visible
 *   .sq-shake            validation shake animation class
 *   .sq-fullscreen-overlay  the full-viewport overlay element
 *   .sq-fullscreen-active  added to <html> while fullscreen is open
 */

class SmartQuill extends HTMLElement {
    constructor() {
        super();
        this.editor        = null;
        this._initialized  = false;
        this._autosaveTimer = null;
        this._isFullscreen  = false;
    }

    static get observedAttributes() {
        return ['value', 'theme', 'styled'];
    }

    // ── Value getter / setter ────────────────────────────────────────────────

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

    // ── Lifecycle ────────────────────────────────────────────────────────────

    connectedCallback() {
        // Re-parenting this element (body.appendChild(this) / placeholder.after(this))
        // for fullscreen fires disconnectedCallback then connectedCallback per spec,
        // even though nothing actually needs re-initialising — same node, same Quill
        // instance, just relocated. _fsMoving is set for the duration of that single
        // synchronous move so this callback can no-op cleanly.
        if (this._fsMoving) return;
        if (this._initialized) return;
        this._initialized = true;

        const name            = this.getAttribute('name')             || 'richtext';
        const label           = this.getAttribute('label')            || 'Description';
        const placeholder     = this.getAttribute('placeholder')      || '';
        const required        = this.hasAttribute('required');
        const requiredMessage = this.getAttribute('required-message') || `${label} is required`;
        const content         = this.getAttribute('value')            || this.textContent.trim();
        const isReadonly      = this.hasAttribute('readonly');
        const autosaveKey     = this.getAttribute('autosave')         || '';
        const maxlength       = parseInt(this.getAttribute('maxlength') || '0', 10);
        const showWordCount   = this.hasAttribute('word-count');
        const allowFullscreen = !this.hasAttribute('no-fullscreen');

        this.config = { name, label, placeholder, required, requiredMessage,
                        isReadonly, autosaveKey, maxlength, showWordCount, allowFullscreen };

        // ── THEME FIX: resolve + apply theme BEFORE injecting any styles ─────
        // This guarantees this.dataset.scTheme is correct (read from the
        // closest [data-sc-theme] ancestor, an explicit attribute, or OS
        // preference) before _injectStyles()/_injectThemeStyles() ever runs.
        this._applyTheme();
        this._injectStyles();

        // ── Build skeleton ───────────────────────────────────────────────────
        const mode    = this._getMode();
        const labelCl = mode === 'bootstrap' ? 'form-label sq-label' : 'sq-label';

        this.innerHTML = `
            <div class="sq-container${isReadonly ? ' sq-readonly' : ''}">
                <label class="${labelCl}">
                    ${label}${required ? `<span class="sq-required-star"> * </span>` : ''}
                </label>
                <div class="sq-quill-wrap">
                    ${isReadonly
                        ? `<div class="sq-readonly-content">${content || ''}</div>`
                        : `<div class="sq-editor"></div>`}
                    <input type="hidden" name="${name}" value="${this._esc(content)}" />
                </div>
                ${!isReadonly ? `
                <div class="sq-counter${!maxlength && !showWordCount ? ' sq-hidden' : ''}">
                    ${maxlength || !showWordCount
                        ? `<span class="sq-counter-chars">0${maxlength ? ` / ${maxlength}` : ''}</span>`
                        : ''}
                    ${showWordCount ? `<span class="sq-counter-words">0 words</span>` : ''}
                </div>
                <div class="sq-autosave-badge sq-hidden"></div>
                <div class="sq-invalid-feedback">${requiredMessage}</div>
                ` : ''}
            </div>
        `;

        this._errorFeedback  = this.querySelector('.sq-invalid-feedback');
        this._container      = this.querySelector('.sq-container');
        this._quillWrap       = this.querySelector('.sq-quill-wrap');
        this._counterEl      = this.querySelector('.sq-counter');
        this._counterChars   = this.querySelector('.sq-counter-chars');
        this._counterWords   = this.querySelector('.sq-counter-words');
        this._autosaveBadge  = this.querySelector('.sq-autosave-badge');

        if (isReadonly) {
            return; // readonly just renders HTML, no Quill needed
        }

        this._loadQuill().then(() => {
            this._initEditor(content);
            // Re-apply theme after Quill builds its toolbar DOM. This is
            // NOT a timing hack — _applyTheme() is synchronous and idempotent,
            // it just re-confirms dataset.scTheme and re-injects the
            // stylesheet so toolbar elements created by Quill are covered too.
            this._applyTheme();
        });
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'value' && this.editor) { this.value = newValue; return; }
        if (name === 'theme' || name === 'styled') {
            console.log(`[SmartQuill] attributeChangedCallback: ${name} changed → re-applying theme`);
            this._applyTheme();
        }
    }

    disconnectedCallback() {
        // Same fullscreen-move guard as connectedCallback (see note there) —
        // the move from in-page to overlay (or back) is not a real removal,
        // so skip teardown of autosave/theme listeners and don't treat this
        // as "the component left the page".
        if (this._fsMoving) return;
        if (this._autosaveTimer) clearInterval(this._autosaveTimer);
        if (this._scMqlHandler) {
            this._scMql?.removeEventListener('change', this._scMqlHandler);
            this._scMqlHandler = null; this._scMql = null;
        }
        if (this._scObserver) { this._scObserver.disconnect(); this._scObserver = null; }
        // Make sure we don't leave the page stuck with a fullscreen overlay
        // and a locked scrollbar if the component gets removed mid-fullscreen
        // by something OTHER than our own toggle (e.g. an ancestor being
        // removed from the DOM while fullscreen is open).
        if (this._isFullscreen) this._exitFullscreen({ skipRestoreFocus: true });
    }

    // ── Theme (SmartElement delegation pattern) ──────────────────────────────

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

    /**
     * Resolves and sets this.dataset.scTheme, then ALWAYS re-injects the
     * Quill-specific theme stylesheet (_injectThemeStyles) so the two never
     * drift out of sync. This method is intentionally idempotent and safe
     * to call multiple times (on mount, after Quill init, on attribute
     * change, on ancestor mutation, on OS preference change).
     */
    _applyTheme() {

        if (window.SmartElement) {
            SmartElement.prototype._applyTheme.call(this);
            console.log(`[SmartQuill] theme resolved via SmartElement → ${this.dataset.scTheme}`);
            this._injectThemeStyles();
            this._syncFullscreenTheme();
            return;
        }

        // ── Fallback logic (only runs if smart_core.js / SmartElement is NOT loaded) ──
        if (this._getMode() !== 'default') {
            return;
        }

        if (this._scMqlHandler) {
            this._scMql?.removeEventListener('change', this._scMqlHandler);
            this._scMqlHandler = null;
        }
        if (this._scObserver) {
            this._scObserver.disconnect();
            this._scObserver = null;
        }

        const explicitTheme = this._getTheme(); // reads theme= attribute, normalized

        if (explicitTheme === 'light' || explicitTheme === 'dark') {
            this.dataset.scTheme = explicitTheme;
            this._injectThemeStyles();
            this._syncFullscreenTheme();
            return;
        }

        // theme === 'auto': resolve from ancestor → OS → default light
        const _resolve = () => {
            const ancestor = this.closest('[data-sc-theme]');
            if (ancestor && ancestor !== this) {
                return ancestor.dataset.scTheme || 'light';
            }
            if (this._scMql) return this._scMql.matches ? 'dark' : 'light';
            return 'light';
        };

        const _apply = () => {
            this.dataset.scTheme = _resolve();
            console.log(`[SmartQuill] auto theme resolved → ${this.dataset.scTheme}`);
            this._injectThemeStyles();
            this._syncFullscreenTheme();
        };

        const targets = [document.body, document.documentElement].filter(Boolean);
        this._scObserver = new MutationObserver(_apply);
        targets.forEach(t => this._scObserver.observe(t, {
            attributes: true,
            attributeFilter: ['data-sc-theme']
        }));

        this._scMql = window.matchMedia('(prefers-color-scheme: dark)');
        this._scMqlHandler = _apply;
        this._scMql.addEventListener('change', this._scMqlHandler);

        _apply();
    }

    /**
     * Keeps the fullscreen overlay (when open) tagged with the same
     * data-sc-theme as the component itself. The overlay lives on
     * document.body (outside this element's normal subtree) purely for
     * stacking/positioning reasons, so it can't inherit dataset.scTheme via
     * the DOM cascade the way a normal descendant would — this keeps the
     * two perfectly in sync any time _applyTheme() runs.
     */
    _syncFullscreenTheme() {
        if (this._fsOverlay) {
            this._fsOverlay.dataset.scTheme = this.dataset.scTheme || 'light';
        }
    }

    // ── Asset loading ────────────────────────────────────────────────────────

    _loadQuill() {
        if (SmartQuill._quillReady) return SmartQuill._quillReady;

        SmartQuill._quillReady = new Promise(resolve => {
            if (!document.querySelector('link[href*="quill"]')) {
                const link = document.createElement('link');
                link.rel  = 'stylesheet';
                link.href = 'https://cdn.jsdelivr.net/npm/quill@1.3.7/dist/quill.snow.css';
                document.head.appendChild(link);
            }

            if (typeof Quill !== 'undefined') { resolve(); return; }

            const existing = document.querySelector('script[src*="quill"]');
            if (existing) {
                existing.addEventListener('load',  resolve, { once: true });
                existing.addEventListener('error', resolve, { once: true });
                return;
            }

            const script  = document.createElement('script');
            script.src    = 'https://cdn.jsdelivr.net/npm/quill@1.3.7/dist/quill.min.js';
            script.onload = resolve;
            script.onerror = () => { console.error('[SmartQuill] Failed to load Quill from CDN.'); resolve(); };
            document.head.appendChild(script);
        });

        return SmartQuill._quillReady;
    }

    // Legacy alias
    loadQuillStyles() { return this._loadQuill(); }

    // ── Editor initialisation ────────────────────────────────────────────────

    _initEditor(content) {
        if (typeof Quill === 'undefined') {
            console.error('[SmartQuill] Quill not available.');
            return;
        }

        const editorEl   = this.querySelector('.sq-editor');
        const hiddenInput = this.querySelector(`input[name="${this.config.name}"]`);
        if (!editorEl || !hiddenInput) return;

        const imageUploadUrl = this.getAttribute('image-upload-url') || '';

        this.editor = new Quill(editorEl, {
            theme: 'snow',
            placeholder: this.config.placeholder,
            modules: {
                toolbar:  this._buildToolbar(),
                history:  { delay: 1000, maxStack: 500, userOnly: true },
                keyboard: this.config.maxlength
                    ? { bindings: { tab: false } }
                    : undefined,
            },
        });

        // Restore autosave draft if present
        if (this.config.autosaveKey) {
            const draft = this._autosaveLoad();
            if (draft) {
                content = draft;
                if (this._autosaveBadge) {
                    this._autosaveBadge.textContent = 'Draft restored';
                    this._autosaveBadge.classList.remove('sq-hidden');
                    setTimeout(() => this._autosaveBadge?.classList.add('sq-hidden'), 3000);
                }
            }
        }

        if (content) {
            this.editor.root.innerHTML = content;
            hiddenInput.value = content;
        }

        // Initialise counter display
        this._updateCounter();

        // Image upload handler
        if (imageUploadUrl) this._initImageUpload(imageUploadUrl);

        // Paste sanitisation
        this._initPasteSanitise();

        // Export buttons
        this._initExportButtons();

        // Fullscreen button
        if (this.config.allowFullscreen) this._initFullscreenButton();

        // ── Text-change handler ──────────────────────────────────────────────
        this.editor.on('text-change', (delta, old, source) => {
            // Maxlength enforcement
            if (this.config.maxlength) {
                const len = this._charCount();
                if (len > this.config.maxlength && source === 'user') {
                    this.editor.history.undo();
                    return;
                }
            }

            const html = this.editor.root.innerHTML;
            hiddenInput.value = html;
            this._updateCounter();

            if (this.hasContent()) this.hideValidationError();

            // Autosave
            if (this.config.autosaveKey) this._autosaveDebounce(html);

            this.dispatchEvent(new CustomEvent('input', {
                bubbles: true,
                detail: {
                    value:  html,
                    length: this._charCount(),
                    words:  this._wordCount(),
                },
            }));
        });

        // Validate on blur
        this.editor.on('selection-change', range => {
            if (range === null && this.config.required) {
                setTimeout(() => this.validate(), 100);
            }
        });

        // Start autosave interval
        if (this.config.autosaveKey) {
            this._autosaveTimer = setInterval(() => {
                if (this.hasContent()) this._autosaveSave(this.editor.root.innerHTML);
            }, 2000);
        }
    }

    // ── Toolbar presets ──────────────────────────────────────────────────────

    _buildToolbar() {
        const preset = (this.getAttribute('toolbar') || 'standard').toLowerCase();
        const custom  = this.getAttribute('toolbar-config') || '';

        if (preset === 'custom' && custom) {
            try { return { container: JSON.parse(custom) }; }
            catch (e) { console.warn('[SmartQuill] Invalid toolbar-config JSON, falling back to standard.'); }
        }

        const PRESETS = {
            minimal: [
                ['bold', 'italic', 'underline'],
                ['link'],
                ['clean'],
            ],
            standard: [
                ['bold', 'italic', 'underline', 'strike'],
                ['blockquote', 'code-block'],
                ['link', 'image'],
                [{ header: [1, 2, 3, false] }],
                [{ list: 'ordered' }, { list: 'bullet' }],
                [{ color: [] }, { background: [] }],
                ['clean'],
            ],
            full: [
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
                ['clean'],
            ],
        };

        return { container: PRESETS[preset] || PRESETS.standard };
    }

    // ── Image upload handler ─────────────────────────────────────────────────

    _initImageUpload(uploadUrl) {
        const toolbar = this.editor.getModule('toolbar');
        toolbar.addHandler('image', () => {
            const input = document.createElement('input');
            input.type   = 'file';
            input.accept = 'image/*';
            input.click();

            input.addEventListener('change', async () => {
                const file = input.files?.[0];
                if (!file) return;

                const formData = new FormData();
                formData.append('image', file);

                // Show placeholder while uploading
                const range = this.editor.getSelection(true);
                this.editor.insertText(range.index, '⏳ Uploading image…', 'user');

                try {
                    const csrfToken = this._getCsrfToken();
                    const response  = await fetch(uploadUrl, {
                        method:  'POST',
                        body:    formData,
                        headers: csrfToken
                            ? { 'X-CSRFToken': csrfToken, 'X-Requested-With': 'XMLHttpRequest' }
                            : { 'X-Requested-With': 'XMLHttpRequest' },
                    });

                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    const data = await response.json();
                    const url  = data.url || data.image_url || data.src || Object.values(data)[0];

                    // Remove placeholder, insert image
                    this.editor.deleteText(range.index, '⏳ Uploading image…'.length);
                    this.editor.insertEmbed(range.index, 'image', url, 'user');
                    this.editor.setSelection(range.index + 1, 'user');

                    this.dispatchEvent(new CustomEvent('sq-image', { bubbles: true, detail: { url } }));

                } catch (err) {
                    this.editor.deleteText(range.index, '⏳ Uploading image…'.length);
                    console.error('[SmartQuill] Image upload failed:', err);
                    window.dispatchEvent(new CustomEvent('smart-toast', {
                        detail: { message: 'Image upload failed. Please try again.', type: 'error', duration: 4000 }
                    }));
                }
            });
        });
    }

    _getCsrfToken() {
        // Django CSRF token — cookie first, then meta tag, then hidden input
        const cookie = document.cookie.split(';')
            .map(c => c.trim())
            .find(c => c.startsWith('csrftoken='));
        if (cookie) return cookie.split('=')[1];

        const meta = document.querySelector('meta[name="csrf-token"]');
        if (meta) return meta.content;

        const input = document.querySelector('input[name="csrfmiddlewaretoken"]');
        if (input) return input.value;

        return null;
    }

    // ── Paste sanitisation ───────────────────────────────────────────────────

    _initPasteSanitise() {
        const editor = this.editor;

        editor.clipboard.addMatcher(Node.ELEMENT_NODE, (node, delta) => {
            // Allowed tags — strip everything else, keep semantic content
            const ALLOWED = new Set([
                'B','STRONG','I','EM','U','S','DEL','STRIKE',
                'P','BR','DIV','SPAN',
                'H1','H2','H3','H4','H5','H6',
                'UL','OL','LI',
                'BLOCKQUOTE','PRE','CODE',
                'A','IMG',
                'TABLE','THEAD','TBODY','TR','TH','TD',
            ]);

            if (!ALLOWED.has(node.nodeName)) {
                // Strip the node but keep its text content
                return new window.Delta().insert(node.textContent || '');
            }

            // Strip all style/class/id attributes from allowed nodes
            // to avoid Word/Google Docs inline style bleed
            if (node.nodeType === Node.ELEMENT_NODE) {
                ['style', 'class', 'id', 'lang', 'xml:lang', 'data-mce-style'].forEach(attr => {
                    node.removeAttribute(attr);
                });
                // Keep href for links, src for images
            }

            return delta;
        });

        // Extra: strip span wrappers that are empty after attribute removal
        editor.clipboard.addMatcher('SPAN', (node, delta) => {
            return new window.Delta().insert(node.textContent || '');
        });
    }

    // ── Export ───────────────────────────────────────────────────────────────

    _initExportButtons() {
        const toolbarEl = this.querySelector('.ql-toolbar');
        if (!toolbarEl) return;

        const wrap = document.createElement('div');
        wrap.className = 'sq-toolbar-extra';
        wrap.innerHTML = `
            <button type="button" class="sq-export-btn sq-export-html" title="Export as HTML">
                <i class="ph ph-code"></i>
            </button>
            <button type="button" class="sq-export-btn sq-export-pdf" title="Export as PDF / Print">
                <i class="ph ph-printer"></i>
            </button>
        `;

        toolbarEl.appendChild(wrap);

        wrap.querySelector('.sq-export-html').addEventListener('click', () => this._exportHTML());
        wrap.querySelector('.sq-export-pdf').addEventListener('click',  () => this._exportPDF());

        // Stash a reference so the fullscreen button can be appended into
        // the SAME extras cluster regardless of init order.
        this._toolbarExtra = wrap;
    }

    _exportHTML() {
        if (!this.editor) return;
        const html    = this.editor.root.innerHTML;
        const name    = this.config.name || 'document';
        const blob    = new Blob([`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${name}</title></head><body>${html}</body></html>`], { type: 'text/html' });
        const url     = URL.createObjectURL(blob);
        const a       = document.createElement('a');
        a.href        = url;
        a.download    = `${name}.html`;
        a.click();
        URL.revokeObjectURL(url);
        this.dispatchEvent(new CustomEvent('sq-export', { bubbles: true, detail: { format: 'html' } }));
    }

    _exportPDF() {
        if (!this.editor) return;
        const html  = this.editor.root.innerHTML;
        const name  = this.config.name || 'document';
        const win   = window.open('', '_blank');
        if (!win) { console.warn('[SmartQuill] Popup blocked — allow popups for PDF export.'); return; }
        win.document.write(`
            <!DOCTYPE html><html>
            <head>
                <meta charset="UTF-8">
                <title>${name}</title>
                <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/quill@1.3.7/dist/quill.snow.css">
                <style>
                    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; }
                    @media print { body { margin: 0; } }
                </style>
            </head>
            <body class="ql-editor">${html}</body>
            </html>
        `);
        win.document.close();
        win.addEventListener('load', () => { win.print(); });
        this.dispatchEvent(new CustomEvent('sq-export', { bubbles: true, detail: { format: 'pdf' } }));
    }

    // ── Fullscreen ───────────────────────────────────────────────────────────
    //
    // Design notes:
    // • This is NOT the native Fullscreen API (no requestFullscreen()/zen
    //   mode). It's a fixed, full-viewport overlay appended to <body>.
    // • CRITICAL: every CSS rule in this file that styles Quill internals
    //   (.ql-toolbar, .ql-editor, .ql-stroke, .ql-fill, .sq-label, etc.) is
    //   scoped with the ancestor selector `smart-quill .ql-toolbar { ... }`.
    //   Those rules ONLY match while an actual <smart-quill> element is an
    //   ancestor of the node in the live DOM. An earlier version of this
    //   feature re-parented just the inner .sq-quill-wrap into the overlay,
    //   which left .ql-toolbar/.ql-editor with no <smart-quill> ancestor at
    //   all — every scoped rule silently stopped matching, which is why
    //   toolbar icons and editor text broke in fullscreen while the layout
    //   and theme background still looked right (the unscoped overlay rules
    //   continued to apply).
    //   FIX: re-parent the whole host element (`this`, the <smart-quill>
    //   custom element) into the overlay body instead. The element is still
    //   <smart-quill>, so every `smart-quill ...`-scoped rule keeps matching
    //   exactly as before — nothing in the stylesheet needed to change.
    // • Moving (not cloning) `this` means the live Quill instance, its
    //   bound toolbar handlers, undo history, and current selection all
    //   keep working unchanged — it's the same DOM node, just relocated.
    // • _fsPlaceholder is a zero-size marker left behind in the original
    //   position so _exitFullscreen() knows exactly where to put `this`
    //   back, regardless of other sibling markup around it.
    // • Theme: the overlay is given its own [data-sc-theme] attribute kept
    //   in lockstep with the host element via _syncFullscreenTheme(),
    //   called from every path that resolves a new theme. The host element
    //   itself already carries the correct dataset.scTheme (set by
    //   _applyTheme()) regardless of where it's physically parented, so its
    //   own internals always theme correctly; the overlay's copy is purely
    //   so the chrome around it (header bar, backdrop) matches too.
    // • Escape key and a dedicated ✕ button both close it. Body scroll is
    //   locked while open and restored exactly on exit.

    _initFullscreenButton() {
        // Re-use the same toolbar-extra cluster export buttons sit in, so
        // there's a single consistent "extra controls" group per editor.
        let wrap = this._toolbarExtra;
        if (!wrap) {
            const toolbarEl = this.querySelector('.ql-toolbar');
            if (!toolbarEl) return;
            wrap = document.createElement('div');
            wrap.className = 'sq-toolbar-extra';
            toolbarEl.appendChild(wrap);
            this._toolbarExtra = wrap;
        }

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sq-export-btn sq-fullscreen-toggle';
        btn.title = 'Open fullscreen';
        btn.setAttribute('aria-label', 'Open fullscreen');
        btn.innerHTML = '<i class="ph ph-arrows-out"></i>';
        btn.addEventListener('click', () => this.toggleFullscreen());

        wrap.appendChild(btn);
        this._fsToggleBtn = btn;
    }

    _updateFullscreenButtonIcon() {
        if (!this._fsToggleBtn) return;
        const icon = this._fsToggleBtn.querySelector('i');
        if (this._isFullscreen) {
            if (icon) icon.className = 'ph ph-arrows-in';
            this._fsToggleBtn.title = 'Exit fullscreen';
            this._fsToggleBtn.setAttribute('aria-label', 'Exit fullscreen');
        } else {
            if (icon) icon.className = 'ph ph-arrows-out';
            this._fsToggleBtn.title = 'Open fullscreen';
            this._fsToggleBtn.setAttribute('aria-label', 'Open fullscreen');
        }
    }

    toggleFullscreen() {
        this._isFullscreen ? this._exitFullscreen() : this._enterFullscreen();
    }

    _enterFullscreen() {
        if (this._isFullscreen) return;
        this._isFullscreen = true;

        // Leave a marker exactly where this <smart-quill> element currently
        // lives in its parent's markup, so _exitFullscreen() can put it back
        // precisely afterwards.
        const placeholder = document.createComment('sq-fullscreen-placeholder');
        this.before(placeholder);
        this._fsPlaceholder = placeholder;

        const overlay = document.createElement('div');
        overlay.className = 'sq-fullscreen-overlay';
        overlay.dataset.scTheme = this.dataset.scTheme || 'light';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', this.config?.label || 'Rich text editor, fullscreen');

        const header = document.createElement('div');
        header.className = 'sq-fullscreen-header';
        header.innerHTML = `
            <span class="sq-fullscreen-title">${this._esc(this.config?.label || 'Editor')}</span>
            <button type="button" class="sq-fullscreen-close" title="Close fullscreen" aria-label="Close fullscreen">
                <i class="ph ph-x"></i>
            </button>
        `;

        const body = document.createElement('div');
        body.className = 'sq-fullscreen-body';

        overlay.appendChild(header);
        overlay.appendChild(body);
        document.body.appendChild(overlay);

        // Re-parent the LIVE <smart-quill> host element (this) into the
        // overlay body. Same custom element, same Quill instance — nothing
        // is reinitialised, and every `smart-quill ...`-scoped style rule
        // keeps matching because the ancestor tag is still present.
        // _fsMoving suppresses the disconnect/reconnect lifecycle callbacks
        // that this synchronous move otherwise triggers (see connectedCallback
        // / disconnectedCallback notes).
        this._fsMoving = true;
        body.appendChild(this);
        this._fsMoving = false;
        this.classList.add('sq-in-fullscreen');

        this._fsOverlay = overlay;
        this._fsPrevBodyOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        document.documentElement.classList.add('sq-fullscreen-active');

        header.querySelector('.sq-fullscreen-close').addEventListener('click', () => this._exitFullscreen());

        this._fsKeyHandler = (e) => {
            if (e.key === 'Escape') this._exitFullscreen();
        };
        document.addEventListener('keydown', this._fsKeyHandler);

        overlay.addEventListener('mousedown', (e) => {
            if (e.target === overlay) e.preventDefault(); // no click-outside-to-close: avoid accidental data loss
        });

        this._updateFullscreenButtonIcon();
        requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('sq-fullscreen-visible')));

        if (this.editor) setTimeout(() => this.editor.focus(), 50);

        this.dispatchEvent(new CustomEvent('sq-fullscreen', { bubbles: true, detail: { fullscreen: true } }));
    }

    _exitFullscreen(opts = {}) {
        if (!this._isFullscreen) return;
        this._isFullscreen = false;

        if (this._fsKeyHandler) {
            document.removeEventListener('keydown', this._fsKeyHandler);
            this._fsKeyHandler = null;
        }

        // Move this <smart-quill> element back to its original spot before
        // tearing down the overlay. Same _fsMoving guard as on the way in.
        if (this._fsPlaceholder && this._fsPlaceholder.parentNode) {
            this._fsMoving = true;
            this._fsPlaceholder.after(this);
            this._fsMoving = false;
            this._fsPlaceholder.remove();
            this._fsPlaceholder = null;
        }
        this.classList.remove('sq-in-fullscreen');

        document.body.style.overflow = this._fsPrevBodyOverflow || '';
        document.documentElement.classList.remove('sq-fullscreen-active');

        const overlay = this._fsOverlay;
        this._fsOverlay = null;
        if (overlay) {
            overlay.classList.remove('sq-fullscreen-visible');
            const remove = () => overlay.remove();
            overlay.addEventListener('transitionend', remove, { once: true });
            setTimeout(remove, 300);
        }

        this._updateFullscreenButtonIcon();

        if (!opts.skipRestoreFocus && this.editor) {
            setTimeout(() => this.editor.focus(), 50);
        }

        this.dispatchEvent(new CustomEvent('sq-fullscreen', { bubbles: true, detail: { fullscreen: false } }));
    }

    /** Public API */
    enterFullscreen() { this._enterFullscreen(); }
    exitFullscreen()  { this._exitFullscreen(); }
    isFullscreen()    { return this._isFullscreen; }

    // ── Counter ──────────────────────────────────────────────────────────────

    _charCount() {
        if (!this.editor) return 0;
        // Quill's getLength includes trailing newline — subtract 1
        return Math.max(0, this.editor.getLength() - 1);
    }

    _wordCount() {
        if (!this.editor) return 0;
        const text = this.editor.getText().trim();
        return text ? text.split(/\s+/).filter(Boolean).length : 0;
    }

    _updateCounter() {
        if (!this._counterEl) return;
        const chars = this._charCount();
        const words = this._wordCount();
        const max   = this.config.maxlength;

        if (this._counterChars) {
            this._counterChars.textContent = max ? `${chars} / ${max}` : `${chars}`;
            this._counterChars.classList.toggle('sq-counter--near',  max > 0 && chars >= max * 0.85);
            this._counterChars.classList.toggle('sq-counter--limit', max > 0 && chars >= max);
        }
        if (this._counterWords) {
            this._counterWords.textContent = `${words} word${words !== 1 ? 's' : ''}`;
        }
    }

    // ── Autosave ─────────────────────────────────────────────────────────────

    _autosaveKey() { return `sq_autosave_${this.config.autosaveKey}`; }

    _autosaveSave(html) {
        try {
            localStorage.setItem(this._autosaveKey(), JSON.stringify({
                html, ts: Date.now()
            }));
            if (this._autosaveBadge) {
                const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                this._autosaveBadge.textContent = `Draft saved · ${time}`;
                this._autosaveBadge.classList.remove('sq-hidden');
            }
            this.dispatchEvent(new CustomEvent('sq-autosave', {
                bubbles: true,
                detail: { key: this._autosaveKey(), timestamp: Date.now() }
            }));
        } catch (e) { /* localStorage unavailable */ }
    }

    _autosaveLoad() {
        try {
            const raw = localStorage.getItem(this._autosaveKey());
            if (!raw) return null;
            const { html } = JSON.parse(raw);
            return html || null;
        } catch { return null; }
    }

    _autosaveClear() {
        try { localStorage.removeItem(this._autosaveKey()); } catch {}
        if (this._autosaveBadge) this._autosaveBadge.classList.add('sq-hidden');
    }

    _autosaveDebounce(html) {
        if (this._autosaveDebTimer) clearTimeout(this._autosaveDebTimer);
        this._autosaveDebTimer = setTimeout(() => this._autosaveSave(html), 1500);
    }

    // ── Content helpers ──────────────────────────────────────────────────────

    hasContent() {
        if (!this.editor) return false;
        const text = this.editor.getText().trim();
        const html = this.editor.root.innerHTML;
        return text.length > 0 && html !== '<p><br></p>' && html !== '<p></p>';
    }

    // ── Validation ───────────────────────────────────────────────────────────

    validate() {
        if (!this.config || !this.config.required) return true;
        const isValid = this.hasContent();
        isValid ? this.hideValidationError() : this.showValidationError();
        return isValid;
    }

    showValidationError() {
        const wrap = this.querySelector('.sq-quill-wrap');
        if (wrap) wrap.classList.add('sq-invalid');
        if (this._errorFeedback) this._errorFeedback.classList.add('sq-visible');
        if (this._container) {
            this._container.classList.add('sq-shake');
            setTimeout(() => this._container?.classList.remove('sq-shake'), 500);
        }
    }

    hideValidationError() {
        const wrap = this.querySelector('.sq-quill-wrap');
        if (wrap) wrap.classList.remove('sq-invalid');
        if (this._errorFeedback) this._errorFeedback.classList.remove('sq-visible');
    }

    checkValidity()  { return this.validate(); }
    reportValidity() { const ok = this.validate(); if (!ok && this.editor) this.editor.focus(); return ok; }

    // ── Public API ───────────────────────────────────────────────────────────

    getValue()     { return this.value; }
    setValue(val)  { this.value = val; }
    focus()        { if (this.editor) this.editor.focus(); }
    blur()         { if (this.editor) this.editor.blur(); }
    getLength()    { return this._charCount(); }
    getText()      { return this.editor ? this.editor.getText() : ''; }
    getHTML()      { return this.editor ? this.editor.root.innerHTML : ''; }
    getWordCount() { return this._wordCount(); }

    clear() {
        if (this.editor) {
            this.editor.setText('');
            this.hideValidationError();
            if (this.config.autosaveKey) this._autosaveClear();
        }
    }

    /** Export programmatically */
    exportHTML() { this._exportHTML(); }
    exportPDF()  { this._exportPDF(); }

    /** Clear saved draft */
    clearDraft() { this._autosaveClear(); }

    // ── Utility ──────────────────────────────────────────────────────────────

    _esc(str) {
        return String(str || '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // ── Styles ───────────────────────────────────────────────────────────────

    /**
     * Injects the common (theme-agnostic) stylesheet ONLY. Theme-specific
     * styles are owned entirely by _injectThemeStyles(), which is called
     * exclusively from _applyTheme() — never from here. This separation is
     * what fixes the original race: theme resolution always happens before
     * theme styles are written, because _applyTheme() runs first in
     * connectedCallback() and calls _injectThemeStyles() itself.
     */
    _injectStyles() {
        if (!document.getElementById('smart-quill-common')) {
            const common = document.createElement('style');
            common.id = 'smart-quill-common';
            common.textContent = `
                smart-quill {
                    display: block;
                    font-family: var(--sc-font, system-ui, -apple-system, 'Segoe UI', sans-serif);
                    font-size: var(--sc-font-size, 0.9375rem);
                }

                .sq-hidden  { display: none !important; }

                .sq-label {
                    display: block; margin-bottom: 0.4rem;
                    font-size: 0.875rem; font-weight: 500;
                    color: var(--sc-text, #374151);
                }
                .sq-required-star { color: var(--sc-error, #dc2626); margin-left: 1px; }

                /* Core Quill structure */
                smart-quill .ql-toolbar {
                    border-top-left-radius: var(--sc-radius, 0.4rem);
                    border-top-right-radius: var(--sc-radius, 0.4rem);
                    display: flex; align-items: center; flex-wrap: wrap; gap: 2px;
                }
                smart-quill .ql-container {
                    border-bottom-left-radius: var(--sc-radius, 0.4rem);
                    border-bottom-right-radius: var(--sc-radius, 0.4rem);
                    font-size: var(--sc-font-size, 0.9375rem);
                    font-family: var(--sc-font, system-ui, sans-serif);
                    transition: border-color 0.2s, box-shadow 0.2s;
                }
                smart-quill .ql-editor {
                    min-height: 150px; max-height: 400px; overflow-y: auto;
                }

                /* Content inheritance */
                smart-quill .ql-editor p:not([style*="color"]),
                smart-quill .ql-editor h1:not([style*="color"]),
                smart-quill .ql-editor h2:not([style*="color"]),
                smart-quill .ql-editor h3:not([style*="color"]),
                smart-quill .ql-editor h4:not([style*="color"]),
                smart-quill .ql-editor h5:not([style*="color"]),
                smart-quill .ql-editor h6:not([style*="color"]),
                smart-quill .ql-editor li:not([style*="color"]),
                smart-quill .ql-editor td:not([style*="color"]),
                smart-quill .ql-editor th:not([style*="color"]),
                smart-quill .ql-editor blockquote:not([style*="color"]),
                smart-quill .ql-editor pre:not([style*="color"]),
                smart-quill .ql-editor span:not([class*="ql-"]):not([style*="color"]),
                smart-quill .ql-editor ol:not([style*="color"]),
                smart-quill .ql-editor ul:not([style*="color"]) {
                    color: inherit !important;
                }

                smart-quill .ql-editor:focus { outline: none; }

                smart-quill .sq-quill-wrap:focus-within .ql-container {
                    border-color: var(--sc-focus, #6366f1);
                    box-shadow: 0 0 0 3px var(--sc-focus-ring, rgba(99,102,241,.18)),
                                0 0 8px 1px var(--sc-focus-ring, rgba(99,102,241,.10));
                }
                smart-quill .sq-quill-wrap:focus-within .ql-toolbar {
                    border-color: var(--sc-focus, #6366f1);
                }

                smart-quill .ql-editor.ql-blank::before {
                    color: var(--sc-text-muted, #9ca3af);
                    font-style: italic;
                }

                /* Toolbar icons (theme-agnostic default — overridden per-theme below) */
                smart-quill .ql-stroke { stroke: var(--sc-text, #374151) !important; }
                smart-quill .ql-fill   { fill:   var(--sc-text, #374151) !important; }
                smart-quill .ql-picker-label { color: var(--sc-text, #374151) !important; }

                /* Invalid state */
                smart-quill .sq-quill-wrap.sq-invalid .ql-container,
                smart-quill .sq-quill-wrap.sq-invalid .ql-toolbar {
                    border-color: var(--sc-error, #dc2626) !important;
                }

                /* UI elements */
                .sq-invalid-feedback { display: none; margin-top: 0.3rem; font-size: 0.8125rem; color: var(--sc-error, #dc2626); }
                .sq-invalid-feedback.sq-visible { display: block; }

                .sq-counter { display: flex; justify-content: flex-end; gap: 1rem; margin-top: 0.25rem; font-size: 0.78rem; color: var(--sc-text-muted, #9ca3af); }
                .sq-counter--near  { color: var(--sc-warning, #d97706); }
                .sq-counter--limit { color: var(--sc-error, #dc2626); font-weight: 600; }

                .sq-autosave-badge {
                    margin-top: 0.2rem; font-size: 0.75rem; color: var(--sc-success, #16a34a);
                    display: flex; align-items: center; gap: 0.3rem;
                }
                .sq-autosave-badge::before { content: '✓'; font-weight: 700; }

                .sq-toolbar-extra { display: inline-flex; align-items: center; gap: 2px; margin-left: auto; padding-left: 0.5rem; border-left: 1px solid var(--sc-border, #d1d5db); }
                .sq-export-btn { background: none; border: none; cursor: pointer; padding: 0.25rem 0.35rem; border-radius: 0.25rem; color: var(--sc-text-muted, #6b7280); }
                .sq-export-btn:hover { color: var(--sc-text, #1a1d23); background: var(--sc-bg-subtle, #f3f4f6); }

                .sq-readonly-content {
                    padding: 0.75rem; border: 1.5px solid var(--sc-border, #d1d5db);
                    border-radius: var(--sc-radius, 0.4rem); background: var(--sc-bg-subtle, #f9fafb);
                    color: var(--sc-text, #1a1d23);
                }

                /* ── Fullscreen overlay ──────────────────────────────────────── */
                html.sq-fullscreen-active { overflow: hidden; }

                .sq-fullscreen-overlay {
                    position: fixed; inset: 0; z-index: 10000;
                    display: flex; flex-direction: column;
                    background: var(--sc-bg, #ffffff);
                    opacity: 0;
                    transition: opacity .18s ease;
                    font-family: var(--sc-font, system-ui, sans-serif);
                }
                .sq-fullscreen-overlay.sq-fullscreen-visible { opacity: 1; }

                .sq-fullscreen-header {
                    flex: 0 0 auto;
                    display: flex; align-items: center; justify-content: space-between;
                    padding: 0.65rem 1rem;
                    border-bottom: 1px solid var(--sc-border, #e5e7eb);
                    background: var(--sc-bg-subtle, #f9fafb);
                }
                .sq-fullscreen-title {
                    font-size: 0.9rem; font-weight: 600;
                    color: var(--sc-text, #1a1d23);
                }
                .sq-fullscreen-close {
                    display: inline-flex; align-items: center; justify-content: center;
                    width: 32px; height: 32px;
                    border: none; border-radius: 0.4rem; cursor: pointer;
                    background: transparent; color: var(--sc-text-muted, #6b7280);
                    font-size: 1.1rem; transition: background .12s, color .12s;
                }
                .sq-fullscreen-close:hover {
                    background: var(--sc-bg, #ffffff);
                    color: var(--sc-error, #dc2626);
                }

                .sq-fullscreen-body {
                    flex: 1 1 auto;
                    display: flex; flex-direction: column;
                    padding: 1rem 1.25rem 1.25rem;
                    overflow-y: auto;
                    min-height: 0;
                }

                /* The whole <smart-quill> host element is what gets moved into
                   the overlay (see _enterFullscreen) — so it, not just its
                   inner .sq-quill-wrap, needs to stretch to fill the overlay
                   body. Counter / autosave badge come along for free since
                   they're its descendants. */
                smart-quill.sq-in-fullscreen {
                    flex: 1 1 auto;
                    display: flex; flex-direction: column;
                    min-height: 0;
                }
                smart-quill.sq-in-fullscreen .sq-container {
                    flex: 1 1 auto;
                    display: flex; flex-direction: column;
                    min-height: 0;
                }
                smart-quill.sq-in-fullscreen .sq-quill-wrap {
                    flex: 1 1 auto;
                    display: flex; flex-direction: column;
                    min-height: 0;
                }
                smart-quill.sq-in-fullscreen .ql-container {
                    flex: 1 1 auto;
                    min-height: 0;
                }
                smart-quill.sq-in-fullscreen .ql-editor {
                    height: 100%;
                    max-height: none;
                }
                /* Hide the inline label inside fullscreen — the overlay header
                   already shows the same title, so we avoid a duplicate. */
                smart-quill.sq-in-fullscreen .sq-label {
                    display: none;
                }

                .sq-fullscreen-toggle i { font-size: 1rem; }
            `;
            document.head.appendChild(common);
        }
    }

    /**
     * Writes/replaces the <style id="smart-quill-theme"> block based on
     * this.dataset.scTheme. Always reflects whatever _applyTheme() most
     * recently resolved — never called on its own as a guess.
     */
    _injectThemeStyles() {
        const old = document.getElementById('smart-quill-theme');
        if (old) old.remove();

        const themeStyle = document.createElement('style');
        themeStyle.id = 'smart-quill-theme';

        const isDark = this.dataset.scTheme === 'dark';

        if (isDark) {
            themeStyle.textContent = `
                smart-quill .ql-toolbar,
                [data-sc-theme="dark"] smart-quill .ql-toolbar {
                    background: var(--sc-bg-subtle, #374151) !important;
                    border-color: var(--sc-border, #4b5563) !important;
                }
                smart-quill .ql-container,
                [data-sc-theme="dark"] smart-quill .ql-container {
                    border-color: var(--sc-border, #4b5563) !important;
                }
                smart-quill .ql-editor,
                [data-sc-theme="dark"] smart-quill .ql-editor {
                    background: var(--sc-bg, #1f2937) !important;
                    color: var(--sc-text, #e5e7eb) !important;
                }
                smart-quill .ql-editor p:not([style*="color"]),
                smart-quill .ql-editor h1:not([style*="color"]),
                smart-quill .ql-editor h2:not([style*="color"]),
                smart-quill .ql-editor h3:not([style*="color"]),
                smart-quill .ql-editor h4:not([style*="color"]),
                smart-quill .ql-editor h5:not([style*="color"]),
                smart-quill .ql-editor h6:not([style*="color"]),
                smart-quill .ql-editor li:not([style*="color"]),
                smart-quill .ql-editor td:not([style*="color"]),
                smart-quill .ql-editor th:not([style*="color"]),
                smart-quill .ql-editor blockquote:not([style*="color"]),
                smart-quill .ql-editor pre:not([style*="color"]),
                smart-quill .ql-editor span:not([class*="ql-"]):not([style*="color"]),
                smart-quill .ql-editor ol:not([style*="color"]),
                smart-quill .ql-editor ul:not([style*="color"]) {
                    color: var(--sc-text, #e5e7eb) !important;
                }
                smart-quill .ql-stroke {
                    stroke: var(--sc-text-muted, #9ca3af) !important;
                }
                smart-quill .ql-fill {
                    fill: var(--sc-text-muted, #9ca3af) !important;
                }
                smart-quill .ql-picker-label {
                    color: var(--sc-text-muted, #9ca3af) !important;
                }
                smart-quill .ql-picker-options {
                    background: var(--sc-bg-subtle, #374151) !important;
                    border-color: var(--sc-border, #4b5563) !important;
                }
                smart-quill .ql-picker-item {
                    color: var(--sc-text, #e5e7eb) !important;
                }
                smart-quill .ql-picker-item.ql-selected,
                smart-quill .ql-picker-item:hover {
                    background: var(--sc-bg, #1f2937) !important;
                    color: var(--sc-focus, #818cf8) !important;
                }
                smart-quill .sq-label {
                    color: var(--sc-text, #e5e7eb) !important;
                }
                smart-quill .sq-readonly-content {
                    background: var(--sc-bg-subtle, #374151) !important;
                    border-color: var(--sc-border, #4b5563) !important;
                    color: var(--sc-text, #e5e7eb) !important;
                }
                smart-quill .ql-editor.ql-blank::before {
                    color: var(--sc-text-muted, #9ca3af) !important;
                }
                smart-quill .sq-quill-wrap:focus-within .ql-container {
                    border-color: var(--sc-focus, #818cf8) !important;
                    box-shadow: 0 0 0 3px var(--sc-focus-ring, rgba(129,140,248,.18)),
                                0 0 8px 1px var(--sc-focus-ring, rgba(129,140,248,.10)) !important;
                }
                smart-quill .sq-quill-wrap:focus-within .ql-toolbar {
                    border-color: var(--sc-focus, #818cf8) !important;
                }

                /* Fullscreen overlay — dark */
                .sq-fullscreen-overlay[data-sc-theme="dark"] {
                    background: var(--sc-bg, #1f2937) !important;
                }
                .sq-fullscreen-overlay[data-sc-theme="dark"] .sq-fullscreen-header {
                    background: var(--sc-bg-subtle, #374151) !important;
                    border-color: var(--sc-border, #4b5563) !important;
                }
                .sq-fullscreen-overlay[data-sc-theme="dark"] .sq-fullscreen-title {
                    color: var(--sc-text, #e5e7eb) !important;
                }
                .sq-fullscreen-overlay[data-sc-theme="dark"] .sq-fullscreen-close {
                    color: var(--sc-text-muted, #9ca3af) !important;
                }
                .sq-fullscreen-overlay[data-sc-theme="dark"] .sq-fullscreen-close:hover {
                    background: var(--sc-bg, #1f2937) !important;
                    color: var(--sc-error, #f87171) !important;
                }
            `;
        } else {
            themeStyle.textContent = `
                smart-quill .ql-toolbar,
                [data-sc-theme="light"] smart-quill .ql-toolbar {
                    background: var(--sc-bg-subtle, #f3f4f6) !important;
                    border-color: var(--sc-border, #d1d5db) !important;
                }
                smart-quill .ql-container,
                [data-sc-theme="light"] smart-quill .ql-container {
                    border-color: var(--sc-border, #d1d5db) !important;
                }
                smart-quill .ql-editor,
                [data-sc-theme="light"] smart-quill .ql-editor {
                    background: var(--sc-bg, #ffffff) !important;
                    color: var(--sc-text, #1a1d23) !important;
                }
                smart-quill .sq-readonly-content {
                    background: var(--sc-bg-subtle, #f9fafb) !important;
                    color: var(--sc-text, #1a1d23) !important;
                }

                /* Fullscreen overlay — light */
                .sq-fullscreen-overlay[data-sc-theme="light"] {
                    background: var(--sc-bg, #ffffff) !important;
                }
                .sq-fullscreen-overlay[data-sc-theme="light"] .sq-fullscreen-header {
                    background: var(--sc-bg-subtle, #f9fafb) !important;
                    border-color: var(--sc-border, #e5e7eb) !important;
                }
            `;
        }

        document.head.appendChild(themeStyle);
    }

    // Legacy alias
    addStyles() { this._injectStyles(); }
}

// Module-level singleton Promise — shared across all instances
SmartQuill._quillReady = null;

customElements.define('smart-quill', SmartQuill);