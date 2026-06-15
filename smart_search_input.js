/**
 * smart_search_input.js — v2.0
 * <smart-search-input> — Async search input with multi-select, pagination,
 * external param injection, POST support, and full token-based theming.
 *
 * ── WHAT'S NEW IN v2 ─────────────────────────────────────────────────────────
 * • Token system + theme="auto|light|dark" — [data-sc-theme] driven.
 *   styled="bootstrap" keeps Bootstrap label classes.
 * • method="GET|POST" — POST sends JSON body; GET appends query params.
 *   CSRF token auto-detected (cookie → meta → hidden input) for POST.
 * • params-from="#id1,#id2,.selector" — merges values from external inputs
 *   (date pickers, selects, smart-inputs) into every request. Watches those
 *   inputs for change events and re-runs the last search automatically.
 * • extra-params='{"key":"value"}' — static extra params always sent.
 * • query-param="q" — the key used for the search term (default: q).
 * • search-url alias — works identically to data-url, whichever you prefer.
 * • Style injection into <head> once (not per-instance).
 * • Phosphor Icons injected once if not already loaded.
 * • No @media dark mode — all [data-sc-theme] driven.
 *
 * ── ATTRIBUTE REFERENCE ──────────────────────────────────────────────────────
 *   name="field"               hidden input name (default: search-input)
 *   label="Search"             label text
 *   placeholder="Search…"      input placeholder
 *   data-url="/api/search/"    fetch endpoint (alias: search-url)
 *   search-url="/api/search/"  alias for data-url
 *   method="GET|POST"          default: GET
 *   query-param="q"            search term key in request (default: q)
 *   data-response-path="a.b"   dot-path into JSON response
 *   multiple                   allow multiple selections
 *   required                   validation required
 *   min-chars="1"              minimum chars before search fires
 *   items-per-page="10"        results per page for infinite scroll
 *   params-from="#id1,#id2"    CSS selectors of external inputs to merge
 *   extra-params='{"k":"v"}'   static extra params always included
 *   styled="default|bootstrap" default: default (self-contained styles)
 *   theme="auto|light|dark"    default: auto
 *
 * ── EVENTS ───────────────────────────────────────────────────────────────────
 *   ss-change     — fires when selection changes. detail: { selected: [...] }
 *   ss-search     — fires before each request.  detail: { term, params }
 *   ss-error      — fires on fetch error.       detail: { error }
 *
 * ── STABLE CLASS REFERENCE ───────────────────────────────────────────────────
 *   .ss-wrapper          outer container
 *   .ss-label            label element
 *   .ss-required-star    * required indicator
 *   .ss-input-container  search input + icon + spinner wrapper
 *   .ss-input            the text input
 *   .ss-search-icon      magnifying glass icon
 *   .ss-spinner          loading spinner
 *   .ss-selected         selected items container
 *   .ss-selected-header  count + clear-all row
 *   .ss-selected-count   "N items selected" text
 *   .ss-clear-all        clear all button
 *   .ss-selected-list    flex wrap tag container
 *   .ss-tag              individual selection chip
 *   .ss-tag-name         text inside chip
 *   .ss-tag-remove       × button inside chip
 *   .ss-dropdown         results dropdown panel
 *   .ss-results          scrollable results list
 *   .ss-result-item      single result row
 *   .ss-result-item--selected  added when item is selected
 *   .ss-result-icon      circle icon inside result row
 *   .ss-result-icon--selected  added when selected
 *   .ss-result-name      primary result text
 *   .ss-result-desc      secondary result text
 *   .ss-no-results       "no results" empty state
 *   .ss-pagination       "scroll for more" footer
 *   .ss-hidden           display:none utility
 */

// ─────────────────────────────────────────────────────────────────────────────
//  Style + Phosphor injection — once per page
// ─────────────────────────────────────────────────────────────────────────────

function injectSearchStyles() {
    if (document.getElementById('smart-search-input-styles')) return;

    // Phosphor Icons
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
    s.id = 'smart-search-input-styles';
    s.textContent = `

        /* ── Host ─────────────────────────────────────────────────────────── */
        smart-search-input {
            display: block;
            font-family: var(--sc-font, system-ui, -apple-system, 'Segoe UI', sans-serif);
            font-size: var(--sc-font-size, 0.9375rem);
            color: var(--sc-text, #1a1d23);
        }

        /* ── Utility ─────────────────────────────────────────────────────── */
        .ss-hidden { display: none !important; }

        /* ── Label ───────────────────────────────────────────────────────── */
        .ss-label {
            display: block;
            margin-bottom: 0.4rem;
            font-size: 0.875rem;
            font-weight: 500;
            color: var(--sc-text, #374151);
        }
        .ss-required-star { color: var(--sc-error, #dc2626); margin-left: 1px; }

        /* ── Input container ─────────────────────────────────────────────── */
        .ss-input-container {
            position: relative;
            width: 100%;
        }
        .ss-search-icon {
            position: absolute;
            left: 0.75rem; top: 50%;
            transform: translateY(-50%);
            color: var(--sc-text-muted, #9ca3af);
            font-size: 1.1rem;
            pointer-events: none;
            z-index: 1;
        }
        .ss-input {
            width: 100%;
            padding: 0.55rem 2.5rem 0.55rem 2.5rem;
            font-size: inherit;
            font-family: inherit;
            color: var(--sc-text, #1a1d23);
            background: var(--sc-bg, #ffffff);
            border: 1.5px solid var(--sc-border, #d1d5db);
            border-radius: var(--sc-radius, 0.4rem);
            outline: none;
            box-sizing: border-box;
            transition: border-color 0.2s, box-shadow 0.2s;
        }
        .ss-input:focus {
            border-color: var(--sc-focus, #6366f1);
            box-shadow:
                0 0 0 3px var(--sc-focus-ring, rgba(99,102,241,.18)),
                0 0 8px 1px var(--sc-focus-ring, rgba(99,102,241,.10));
        }
        .ss-input::placeholder { color: var(--sc-text-muted, #9ca3af); }

        /* ── Spinner ─────────────────────────────────────────────────────── */
        .ss-spinner {
            position: absolute;
            right: 0.75rem; top: 50%;
            transform: translateY(-50%);
            color: var(--sc-text-muted, #9ca3af);
            font-size: 1.1rem;
            display: none;
            align-items: center;
            justify-content: center;
        }
        .ss-spinner i { animation: ss-spin 0.9s linear infinite; display: block; }
        @keyframes ss-spin { to { transform: rotate(360deg); } }

        /* ── Selected items ──────────────────────────────────────────────── */
        .ss-selected {
            margin-top: 0.6rem;
            padding: 0.65rem 0.75rem;
            background: var(--sc-bg-subtle, #f3f4f6);
            border: 1.5px solid var(--sc-border, #e5e7eb);
            border-radius: var(--sc-radius, 0.4rem);
        }
        .ss-selected-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0.45rem;
            padding-bottom: 0.45rem;
            border-bottom: 1px solid var(--sc-border, #e5e7eb);
        }
        .ss-selected-count {
            font-size: 0.8125rem;
            font-weight: 600;
            color: var(--sc-focus, #6366f1);
        }
        .ss-clear-all {
            background: none; border: none;
            color: var(--sc-error, #dc2626);
            font-size: 0.8125rem; font-weight: 500;
            cursor: pointer;
            padding: 0.2rem 0.4rem;
            border-radius: 0.25rem;
            display: flex; align-items: center; gap: 0.25rem;
            font-family: inherit;
            transition: background 0.15s;
        }
        .ss-clear-all:hover { background: rgba(220,38,38,.08); }
        .ss-selected-list {
            display: flex; flex-wrap: wrap; gap: 0.4rem;
        }

        /* ── Selection chip / tag ────────────────────────────────────────── */
        .ss-tag {
            display: inline-flex; align-items: center; gap: 0.3rem;
            padding: 0.25rem 0.5rem;
            background: var(--sc-tag-bg, #6366f1);
            color: var(--sc-tag-text, #fff);
            border-radius: 0.25rem;
            font-size: 0.8125rem; font-weight: 500;
            animation: ss-tag-in 0.18s ease;
        }
        @keyframes ss-tag-in { from { opacity:0; transform:scale(.85); } to { opacity:1; transform:scale(1); } }
        .ss-tag-name {
            max-width: 180px;
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .ss-tag-remove {
            background: none; border: none; color: inherit;
            cursor: pointer; padding: 0; opacity: 0.75;
            display: flex; align-items: center;
            transition: opacity 0.15s; font-size: 0.9rem;
        }
        .ss-tag-remove:hover { opacity: 1; }

        /* ── Dropdown ────────────────────────────────────────────────────── */
        .ss-dropdown {
            position: absolute;
            top: calc(100% + 4px); left: 0; right: 0;
            background: var(--sc-bg, #ffffff);
            border: 1.5px solid var(--sc-border, #d1d5db);
            border-radius: var(--sc-radius, 0.4rem);
            box-shadow: var(--sc-shadow-md, 0 8px 24px rgba(0,0,0,.12));
            z-index: 1050;
            display: none;
            animation: ss-dropdown-in 0.18s ease;
            max-height: 400px;
        }
        @keyframes ss-dropdown-in { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }
        .ss-dropdown.show { display: block; }

        /* ── Results list ────────────────────────────────────────────────── */
        .ss-results {
            max-height: 350px;
            overflow-y: auto;
            padding: 0.25rem 0;
            scroll-behavior: smooth;
        }
        /* Scrollbar */
        .ss-results::-webkit-scrollbar { width: 6px; }
        .ss-results::-webkit-scrollbar-track { background: var(--sc-bg-subtle, #f3f4f6); border-radius: 3px; }
        .ss-results::-webkit-scrollbar-thumb { background: var(--sc-border, #d1d5db); border-radius: 3px; }
        .ss-results::-webkit-scrollbar-thumb:hover { background: var(--sc-text-muted, #9ca3af); }

        /* ── Result item ─────────────────────────────────────────────────── */
        .ss-result-item {
            padding: 0.65rem 0.85rem;
            cursor: pointer;
            display: flex; align-items: center; gap: 0.65rem;
            border-bottom: 1px solid var(--sc-bg-subtle, #f3f4f6);
            transition: background 0.12s;
            min-height: 48px;
        }
        .ss-result-item:last-child { border-bottom: none; }
        .ss-result-item:hover { background: var(--sc-bg-subtle, #f3f4f6); }
        .ss-result-item--selected {
            background: rgba(99,102,241,.06);
        }
        .ss-result-icon {
            flex-shrink: 0;
            width: 30px; height: 30px;
            display: flex; align-items: center; justify-content: center;
            border-radius: 50%;
            background: var(--sc-bg-subtle, #f3f4f6);
            color: var(--sc-text-muted, #9ca3af);
            font-size: 1.1rem;
            transition: background 0.18s, color 0.18s;
        }
        .ss-result-icon--selected {
            background: var(--sc-focus, #6366f1);
            color: #fff;
        }
        .ss-result-name {
            font-size: 0.9rem; font-weight: 500;
            color: var(--sc-text, #1a1d23);
            line-height: 1.4;
            overflow: hidden;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            text-overflow: ellipsis;
            word-break: break-word;
        }
        .ss-result-desc {
            font-size: 0.8125rem;
            color: var(--sc-text-muted, #6b7280);
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
            margin-top: 0.15rem;
        }

        /* ── Empty state ─────────────────────────────────────────────────── */
        .ss-no-results {
            display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            padding: 2rem 1rem;
            color: var(--sc-text-muted, #9ca3af);
            gap: 0.4rem;
        }
        .ss-no-results i { font-size: 2.2rem; opacity: 0.5; }
        .ss-no-results p { margin: 0; font-size: 0.875rem; }

        /* ── Pagination footer ───────────────────────────────────────────── */
        .ss-pagination {
            padding: 0.6rem;
            text-align: center;
            border-top: 1px solid var(--sc-border, #e5e7eb);
            background: var(--sc-bg-subtle, #f9fafb);
            border-radius: 0 0 var(--sc-radius, 0.4rem) var(--sc-radius, 0.4rem);
            font-size: 0.8125rem;
            color: var(--sc-focus, #6366f1);
            font-weight: 500;
            display: flex; align-items: center; justify-content: center; gap: 0.35rem;
        }
        .ss-pagination i { animation: ss-bounce 2s infinite; display: inline-block; }
        @keyframes ss-bounce { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-4px); } }

        /* ── Dark theme ──────────────────────────────────────────────────── */
        [data-sc-theme="dark"] smart-search-input .ss-label,
        smart-search-input[data-sc-theme="dark"] .ss-label { color: var(--sc-text, #e5e7eb); }

        [data-sc-theme="dark"] smart-search-input .ss-input,
        smart-search-input[data-sc-theme="dark"] .ss-input {
            background: var(--sc-bg, #1f2937);
            border-color: var(--sc-border, #4b5563);
            color: var(--sc-text, #e5e7eb);
        }
        [data-sc-theme="dark"] smart-search-input .ss-input::placeholder,
        smart-search-input[data-sc-theme="dark"] .ss-input::placeholder { color: var(--sc-text-muted, #6b7280); }

        [data-sc-theme="dark"] smart-search-input .ss-selected,
        smart-search-input[data-sc-theme="dark"] .ss-selected {
            background: var(--sc-bg-subtle, #374151);
            border-color: var(--sc-border, #4b5563);
        }
        [data-sc-theme="dark"] smart-search-input .ss-selected-header,
        smart-search-input[data-sc-theme="dark"] .ss-selected-header { border-color: var(--sc-border, #4b5563); }

        [data-sc-theme="dark"] smart-search-input .ss-dropdown,
        smart-search-input[data-sc-theme="dark"] .ss-dropdown {
            background: var(--sc-bg, #1f2937);
            border-color: var(--sc-border, #4b5563);
            box-shadow: 0 8px 24px rgba(0,0,0,.4);
        }
        [data-sc-theme="dark"] smart-search-input .ss-result-item,
        smart-search-input[data-sc-theme="dark"] .ss-result-item { border-color: var(--sc-bg-subtle, #374151); }

        [data-sc-theme="dark"] smart-search-input .ss-result-item:hover,
        smart-search-input[data-sc-theme="dark"] .ss-result-item:hover { background: var(--sc-bg-subtle, #374151); }

        [data-sc-theme="dark"] smart-search-input .ss-result-name,
        smart-search-input[data-sc-theme="dark"] .ss-result-name { color: var(--sc-text, #e5e7eb); }

        [data-sc-theme="dark"] smart-search-input .ss-result-icon,
        smart-search-input[data-sc-theme="dark"] .ss-result-icon {
            background: var(--sc-bg-subtle, #374151);
            color: var(--sc-text-muted, #9ca3af);
        }
        [data-sc-theme="dark"] smart-search-input .ss-no-results,
        smart-search-input[data-sc-theme="dark"] .ss-no-results { color: var(--sc-text-muted, #9ca3af); }

        [data-sc-theme="dark"] smart-search-input .ss-pagination,
        smart-search-input[data-sc-theme="dark"] .ss-pagination {
            background: var(--sc-bg-subtle, #374151);
            border-color: var(--sc-border, #4b5563);
        }
        [data-sc-theme="dark"] smart-search-input .ss-results::-webkit-scrollbar-track,
        smart-search-input[data-sc-theme="dark"] .ss-results::-webkit-scrollbar-track { background: var(--sc-bg, #1f2937); }
        [data-sc-theme="dark"] smart-search-input .ss-results::-webkit-scrollbar-thumb,
        smart-search-input[data-sc-theme="dark"] .ss-results::-webkit-scrollbar-thumb { background: var(--sc-border, #4b5563); }

        /* ── Mobile ──────────────────────────────────────────────────────── */
        @media (max-width: 768px) {
            .ss-input { font-size: 16px; } /* prevents iOS zoom */
            .ss-result-item { min-height: 56px; }
            .ss-dropdown { max-height: 70vh; }
            .ss-results { max-height: calc(70vh - 60px); }
        }
    `;
    document.head.appendChild(s);
}


// ═════════════════════════════════════════════════════════════════════════════
//  <smart-search-input>
// ═════════════════════════════════════════════════════════════════════════════

class SmartSearchInput extends HTMLElement {

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

    // ── Lifecycle ────────────────────────────────────────────────────────────

    connectedCallback() {
        injectSearchStyles();
        this._applyTheme();

        const name         = this.getAttribute('name')              || 'search-input';
        const label        = this.getAttribute('label')             || 'Search';
        const placeholder  = this.getAttribute('placeholder')       || 'Type to search…';
        const required     = this.hasAttribute('required');
        const multiple     = this.hasAttribute('multiple');
        const minChars     = parseInt(this.getAttribute('min-chars')     || '1', 10);
        const itemsPerPage = parseInt(this.getAttribute('items-per-page') || '10', 10);
        const method       = (this.getAttribute('method') || 'GET').toUpperCase();
        const queryParam   = this.getAttribute('query-param')       || 'q';
        const responsePath = this.getAttribute('data-response-path') || '';
        const paramsFrom   = this.getAttribute('params-from')       || '';
        const mode         = this._getMode();

        // data-url and search-url are identical — use whichever
        const fetchUrl = this.getAttribute('data-url') ||
                         this.getAttribute('search-url') || '';

        // Static extra params
        let extraParams = {};
        try {
            const raw = this.getAttribute('extra-params') || '{}';
            extraParams = JSON.parse(raw);
        } catch { console.warn('[smart-search-input] Invalid extra-params JSON'); }

        // State
        this._state = {
            allResults:    [],
            filteredResults: [],
            selectedItems: new Map(),
            currentPage:   1,
            itemsPerPage,
            isLoading:     false,
            searchTerm:    '',
            lastTerm:      '',
        };

        this._config = {
            fetchUrl, method, queryParam, responsePath,
            multiple, minChars, extraParams, paramsFrom,
            name,
        };

        // Label class respects styled= mode
        const labelCl = mode === 'bootstrap' ? 'form-label ss-label' : 'ss-label';

        this.innerHTML = `
            <div class="ss-wrapper" style="position:relative;">
                <label class="${labelCl}">
                    ${label}${required ? '<span class="ss-required-star"> * </span>' : ''}
                </label>
                <div class="ss-input-container">
                    <i class="ph ph-magnifying-glass ss-search-icon"></i>
                    <input
                        type="text"
                        class="ss-input"
                        placeholder="${this._esc(placeholder)}"
                        autocomplete="off" autocorrect="off"
                        autocapitalize="off" spellcheck="false"
                    />
                    <div class="ss-spinner">
                        <i class="ph ph-circle-notch"></i>
                    </div>
                </div>

                <div class="ss-selected ss-hidden">
                    <div class="ss-selected-header">
                        <span class="ss-selected-count">0 selected</span>
                        <button type="button" class="ss-clear-all">
                            <i class="ph ph-x"></i> Clear all
                        </button>
                    </div>
                    <div class="ss-selected-list"></div>
                </div>

                <div class="ss-dropdown">
                    <div class="ss-results"></div>
                    <div class="ss-no-results ss-hidden">
                        <i class="ph ph-magnifying-glass"></i>
                        <p>No results found</p>
                    </div>
                    <div class="ss-pagination ss-hidden">
                        <i class="ph ph-arrows-down-up"></i> Scroll for more
                    </div>
                </div>

                <input type="hidden" name="${this._esc(name)}" class="ss-hidden-input" />
            </div>
        `;

        // Element refs
        this._el = {
            input:      this.querySelector('.ss-input'),
            dropdown:   this.querySelector('.ss-dropdown'),
            results:    this.querySelector('.ss-results'),
            noResults:  this.querySelector('.ss-no-results'),
            spinner:    this.querySelector('.ss-spinner'),
            selected:   this.querySelector('.ss-selected'),
            selList:    this.querySelector('.ss-selected-list'),
            selCount:   this.querySelector('.ss-selected-count'),
            clearAll:   this.querySelector('.ss-clear-all'),
            hidden:     this.querySelector('.ss-hidden-input'),
            pagination: this.querySelector('.ss-pagination'),
        };

        this._setupEvents();
        this._setupInfiniteScroll();
        this._setupExternalParams(paramsFrom);

        document.addEventListener('click', this._outsideClick = (e) => {
            if (!this.contains(e.target)) this._closeDropdown();
        });
    }

    disconnectedCallback() {
        document.removeEventListener('click', this._outsideClick);
        if (this._scMqlHandler) {
            this._scMql?.removeEventListener('change', this._scMqlHandler);
        }
        if (this._scObserver) this._scObserver.disconnect();
        this._externalCleanup?.forEach(fn => fn());
    }

    // ── External param sources ───────────────────────────────────────────────

    /**
     * Watches external inputs (date pickers, selects, smart-inputs) whose
     * values should be merged into every request.
     * paramsFrom is a comma-separated list of CSS selectors.
     */
    _setupExternalParams(paramsFrom) {
        if (!paramsFrom) return;
        this._externalCleanup = [];

        const selectors = paramsFrom.split(',').map(s => s.trim()).filter(Boolean);

        selectors.forEach(selector => {
            const els = document.querySelectorAll(selector);
            els.forEach(el => {
                const handler = () => {
                    // Re-run the last search with updated params
                    if (this._state.lastTerm.length >= this._config.minChars) {
                        this._performSearch(this._state.lastTerm);
                    }
                };
                // smart-input fires 'change' on its hidden input; native inputs fire 'change' or 'input'
                el.addEventListener('change', handler);
                el.addEventListener('input',  handler);
                // Also listen on smart-input's hidden input
                const hidden = el.querySelector ? el.querySelector('input[type="hidden"]') : null;
                if (hidden) hidden.addEventListener('change', handler);

                this._externalCleanup.push(() => {
                    el.removeEventListener('change', handler);
                    el.removeEventListener('input',  handler);
                    if (hidden) hidden.removeEventListener('change', handler);
                });
            });
        });
    }

    /**
     * Collects current values from external param sources.
     * Returns a plain object { fieldname: value }.
     */
    _collectExternalParams() {
        const params = {};
        if (!this._config.paramsFrom) return params;

        const selectors = this._config.paramsFrom.split(',').map(s => s.trim()).filter(Boolean);
        selectors.forEach(selector => {
            const els = document.querySelectorAll(selector);
            els.forEach(el => {
                // smart-search-input
                if (el.tagName === 'SMART-SEARCH-INPUT') {
                    const ids = el.getSelectedIds();
                    const name = el.getAttribute('name');
                    if (name && ids.length) params[name] = ids.join(',');
                    return;
                }
                // smart-input — read hidden input
                if (el.tagName === 'SMART-INPUT') {
                    const hidden = el.querySelector('input[type="hidden"], input:not([type="text"]):not([type="search"])');
                    const name   = el.getAttribute('name');
                    if (name && hidden?.value) params[name] = hidden.value;
                    else if (name && el.value) params[name] = el.value;
                    return;
                }
                // Native inputs, selects, textareas
                const name = el.getAttribute('name') || el.id;
                if (name && el.value) params[name] = el.value;
            });
        });
        return params;
    }

    // ── Fetch ────────────────────────────────────────────────────────────────

    async _performSearch(term) {
        if (!this._config.fetchUrl) {
            console.warn('[smart-search-input] No data-url or search-url provided.');
            return;
        }

        this._state.isLoading = true;
        this._state.lastTerm  = term;
        this._el.spinner.style.display = 'flex';

        // Merge: extra-params + external params + search term
        const mergedParams = {
            ...this._config.extraParams,
            ...this._collectExternalParams(),
            [this._config.queryParam]: term,
        };

        this.dispatchEvent(new CustomEvent('ss-search', {
            bubbles: true,
            detail: { term, params: mergedParams },
        }));

        try {
            let response;

            if (this._config.method === 'POST') {
                const headers = {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                };
                const csrf = this._getCsrfToken();
                if (csrf) headers['X-CSRFToken'] = csrf;

                response = await fetch(this._config.fetchUrl, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(mergedParams),
                });
            } else {
                // GET — append as query string
                const qs  = new URLSearchParams(mergedParams).toString();
                const url = this._config.fetchUrl.includes('?')
                    ? `${this._config.fetchUrl}&${qs}`
                    : `${this._config.fetchUrl}?${qs}`;

                response = await fetch(url, {
                    headers: { 'X-Requested-With': 'XMLHttpRequest' },
                });
            }

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data    = await response.json();
            const results = this._config.responsePath
                ? this._extractPath(data, this._config.responsePath)
                : data;

            if (Array.isArray(results)) {
                this._state.allResults      = results;
                this._state.filteredResults = results;
                this._state.currentPage     = 1;
                this._renderResults();
            } else {
                console.warn('[smart-search-input] Response is not an array:', results);
                this._showEmpty();
            }

        } catch (err) {
            console.error('[smart-search-input] Fetch error:', err);
            this._showEmpty();
            this.dispatchEvent(new CustomEvent('ss-error', { bubbles: true, detail: { error: err } }));
        } finally {
            this._state.isLoading = false;
            this._el.spinner.style.display = 'none';
        }
    }

    _getCsrfToken() {
        // Django: cookie → meta → hidden input
        const cookie = document.cookie.split(';')
            .map(c => c.trim())
            .find(c => c.startsWith('csrftoken='));
        if (cookie) return cookie.split('=')[1];

        const meta = document.querySelector('meta[name="csrf-token"], meta[name="csrf_token"]');
        if (meta) return meta.getAttribute('content');

        const input = document.querySelector('input[name="csrfmiddlewaretoken"]');
        if (input) return input.value;

        return null;
    }

    _extractPath(obj, path) {
        return path.split('.').reduce((acc, key) => {
            if (acc && typeof acc === 'object' && key in acc) return acc[key];
            console.warn(`[smart-search-input] Path '${path}' not found in response`);
            return null;
        }, obj);
    }

    // ── Render ───────────────────────────────────────────────────────────────

    _renderResults() {
        const end        = this._state.currentPage * this._state.itemsPerPage;
        const pageSlice  = this._state.filteredResults.slice(0, end);

        if (!pageSlice.length) { this._showEmpty(); return; }

        this._el.results.innerHTML = '';
        this._el.noResults.classList.add('ss-hidden');

        pageSlice.forEach(item => {
            this._el.results.appendChild(this._buildResultItem(item));
        });

        // Pagination indicator
        if (end < this._state.filteredResults.length) {
            this._el.pagination.classList.remove('ss-hidden');
        } else {
            this._el.pagination.classList.add('ss-hidden');
        }

        this._openDropdown();
    }

    _buildResultItem(item) {
        const id         = item.id ?? item.value ?? item.name;
        const label      = item.name || item.title || item.label || String(id);
        const desc       = item.description || item.subtitle || item.desc || '';
        const isSelected = this._state.selectedItems.has(String(id));

        const el = document.createElement('div');
        el.className = `ss-result-item${isSelected ? ' ss-result-item--selected' : ''}`;
        el.innerHTML = `
            <div class="ss-result-icon${isSelected ? ' ss-result-icon--selected' : ''}">
                <i class="ph ${isSelected ? 'ph-check-circle' : 'ph-plus-circle'}"></i>
            </div>
            <div style="flex:1;min-width:0;">
                <div class="ss-result-name">${this._esc(label)}</div>
                ${desc ? `<div class="ss-result-desc">${this._esc(desc)}</div>` : ''}
            </div>
        `;

        el.addEventListener('click', () => this._toggleItem(item, el));
        return el;
    }

    _showEmpty() {
        this._el.results.innerHTML = '';
        this._el.noResults.classList.remove('ss-hidden');
        this._el.pagination.classList.add('ss-hidden');
        this._openDropdown();
    }

    // ── Infinite scroll ──────────────────────────────────────────────────────

    _setupInfiniteScroll() {
        this._el.results.addEventListener('scroll', () => {
            const { scrollTop, scrollHeight, clientHeight } = this._el.results;
            if (scrollTop + clientHeight >= scrollHeight - 50) {
                this._loadMore();
            }
        });
    }

    _loadMore() {
        const total = this._state.filteredResults.length;
        const pages = Math.ceil(total / this._state.itemsPerPage);

        if (this._state.currentPage < pages && !this._state.isLoading) {
            this._state.currentPage++;
            const start = (this._state.currentPage - 1) * this._state.itemsPerPage;
            const end   = this._state.currentPage * this._state.itemsPerPage;

            this._state.filteredResults.slice(start, end).forEach(item => {
                this._el.results.appendChild(this._buildResultItem(item));
            });

            if (end >= total) this._el.pagination.classList.add('ss-hidden');
        }
    }

    // ── Selection ────────────────────────────────────────────────────────────

    _toggleItem(item, el) {
        const id = String(item.id ?? item.value ?? item.name);

        if (this._state.selectedItems.has(id)) {
            this._state.selectedItems.delete(id);
        } else {
            if (!this._config.multiple) {
                this._state.selectedItems.clear();
                // Reset all visible result items
                this._el.results.querySelectorAll('.ss-result-item').forEach(r => {
                    r.classList.remove('ss-result-item--selected');
                    const icon = r.querySelector('.ss-result-icon');
                    const i    = r.querySelector('i');
                    if (icon) icon.classList.remove('ss-result-icon--selected');
                    if (i)    i.className = 'ph ph-plus-circle';
                });
            }
            this._state.selectedItems.set(id, item);
        }

        // Update the clicked item's appearance
        const isNowSelected = this._state.selectedItems.has(id);
        el.classList.toggle('ss-result-item--selected', isNowSelected);
        const icon = el.querySelector('.ss-result-icon');
        const i    = el.querySelector('i');
        if (icon) icon.classList.toggle('ss-result-icon--selected', isNowSelected);
        if (i)    i.className = `ph ${isNowSelected ? 'ph-check-circle' : 'ph-plus-circle'}`;

        this._updateSelectionDisplay();
        this._updateHiddenInput();

        // Single select: close + fill input
        if (!this._config.multiple) {
            this._closeDropdown();
            const label = item.name || item.title || item.label || '';
            this._el.input.value = isNowSelected ? label : '';
        }
    }

    _removeSelection(id) {
        this._state.selectedItems.delete(id);

        // Also update any visible result item
        this._el.results.querySelectorAll('.ss-result-item').forEach(el => {
            const nameEl = el.querySelector('.ss-result-name');
            const item   = this._state.filteredResults.find(r => String(r.id ?? r.value ?? r.name) === id);
            if (!item) return;
            const elLabel = nameEl?.textContent?.trim();
            const itLabel = item.name || item.title || '';
            if (elLabel === itLabel) {
                el.classList.remove('ss-result-item--selected');
                const icon = el.querySelector('.ss-result-icon');
                const i    = el.querySelector('i');
                if (icon) icon.classList.remove('ss-result-icon--selected');
                if (i)    i.className = 'ph ph-plus-circle';
            }
        });

        this._updateSelectionDisplay();
        this._updateHiddenInput();
    }

    _updateSelectionDisplay() {
        const count = this._state.selectedItems.size;

        if (count === 0) {
            this._el.selected.classList.add('ss-hidden');
            return;
        }

        this._el.selected.classList.remove('ss-hidden');
        this._el.selCount.textContent = `${count} item${count !== 1 ? 's' : ''} selected`;
        this._el.selList.innerHTML    = '';

        this._state.selectedItems.forEach((item, id) => {
            const label = item.name || item.title || item.label || id;
            const tag   = document.createElement('div');
            tag.className = 'ss-tag';
            tag.innerHTML = `
                <span class="ss-tag-name">${this._esc(label)}</span>
                <button type="button" class="ss-tag-remove" aria-label="Remove ${this._esc(label)}">
                    <i class="ph ph-x"></i>
                </button>
            `;
            tag.querySelector('.ss-tag-remove').addEventListener('click', (e) => {
                e.stopPropagation();
                this._removeSelection(id);
            });
            this._el.selList.appendChild(tag);
        });
    }

    _updateHiddenInput() {
        this._el.hidden.value = Array.from(this._state.selectedItems.keys()).join(',');
        this._el.hidden.dispatchEvent(new Event('change', { bubbles: true }));
        this.dispatchEvent(new CustomEvent('ss-change', {
            bubbles: true,
            detail: { selected: this.getSelectedItems() },
        }));
    }

    // ── Events setup ─────────────────────────────────────────────────────────

    _setupEvents() {
        let debounce;

        this._el.input.addEventListener('input', (e) => {
            clearTimeout(debounce);
            const term = e.target.value.trim();
            this._state.searchTerm = term;

            if (term.length >= this._config.minChars) {
                debounce = setTimeout(() => this._performSearch(term), 300);
            } else {
                this._closeDropdown();
            }
        });

        this._el.input.addEventListener('focus', () => {
            if (this._state.searchTerm.length >= this._config.minChars) {
                this._openDropdown();
            }
        });

        this._el.clearAll.addEventListener('click', () => {
            this._state.selectedItems.clear();
            this._el.results.querySelectorAll('.ss-result-item').forEach(el => {
                el.classList.remove('ss-result-item--selected');
                const icon = el.querySelector('.ss-result-icon');
                const i    = el.querySelector('i');
                if (icon) icon.classList.remove('ss-result-icon--selected');
                if (i)    i.className = 'ph ph-plus-circle';
            });
            this._updateSelectionDisplay();
            this._updateHiddenInput();
            this._el.input.value = '';
        });
    }

    _openDropdown()  { this._el.dropdown.classList.add('show'); }
    _closeDropdown() { this._el.dropdown.classList.remove('show'); }

    // ── Public API ───────────────────────────────────────────────────────────

    getSelectedItems() { return Array.from(this._state.selectedItems.values()); }
    getSelectedIds()   { return Array.from(this._state.selectedItems.keys()); }

    setSelectedItems(items) {
        this._state.selectedItems.clear();
        items.forEach(item => {
            this._state.selectedItems.set(String(item.id ?? item.value ?? item.name), item);
        });
        this._updateSelectionDisplay();
        this._updateHiddenInput();
    }

    clearSelection() {
        this._state.selectedItems.clear();
        this._updateSelectionDisplay();
        this._updateHiddenInput();
        this._el.input.value = '';
    }

    /** Programmatically trigger a search */
    search(term) {
        this._el.input.value = term;
        this._state.searchTerm = term;
        this._performSearch(term);
    }

    /** v1 alias — kept for backwards compat */
    get value() {
        return this._el?.hidden?.value || '';
    }

    reset() { this.clearSelection(); }

    // ── Helpers ──────────────────────────────────────────────────────────────

    _esc(str) {
        return String(str || '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
}

customElements.define('smart-search-input', SmartSearchInput);