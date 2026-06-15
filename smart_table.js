/**
 * smart_table.js — v2.0
 * <smart-table> — Declarative, attribute-driven data table web component.
 *
 * ── WHAT'S NEW IN v2 ─────────────────────────────────────────────────────────
 * • [data-sc-theme] integration — wires into shared SmartElement theme system.
 *   <body data-sc-theme="dark"> automatically sets data-st-theme="dark".
 *   theme="auto|light|dark" attribute also supported.
 *   MutationObserver watches body/html just like smart-input/smart-button.
 *
 * • Silent background refresh — refresh-interval="30" polls every 30s.
 *   First load (empty table) → shimmer skeleton as before.
 *   Subsequent refreshes → fetch silently in background, then diff against
 *   current rows. Changed/new rows animate in with st-row--updated flash.
 *   No shimmer, no flicker, no UX disruption.
 *
 * • CSV / JSON export — "Export" dropdown button in toolbar.
 *   Exports _filteredData (respects current search + filter state).
 *   CSV: RFC 4180 compliant, downloads as {table-id}.csv.
 *   JSON: pretty-printed, downloads as {table-id}.json.
 *
 * • Row click — row-url="/items/{id}" makes rows navigate on click.
 *   data-onclick="fnName" fires window[fnName](rowData, rowEl) instead.
 *   Rows get cursor:pointer and hover style when either is set.
 *
 * • Column visibility — "Columns" button in toolbar opens a dropdown
 *   with a checkbox per column. Toggle to show/hide. State is maintained
 *   in memory; public API: showColumn(field), hideColumn(field).
 *
 * • Row selection — selectable attribute adds a checkbox column.
 *   Header checkbox selects/deselects all visible rows.
 *   Public API: getSelectedRows(), getSelectedIds(), clearSelection().
 *   Fires rows-selected CustomEvent on change.
 *
 * • Column pinning — {"field":"name","pin":"left"} in columns JSON.
 *   Pinned columns stay sticky on horizontal scroll.
 *   Multiple columns can be pinned; they stack left-to-right.
 *
 * • Column summary footer — {"field":"amount","summary":"sum|avg|count|min|max"}
 *   Renders a sticky tfoot row with computed values from _filteredData.
 *   Updates on filter/sort/search.
 *
 * • Copy cell — right-click any cell → context menu with "Copy cell value".
 *   Dismisses on outside click or Escape.
 *
 * • Keyboard navigation — focus the table, then:
 *   ↑ ↓ to move between rows, Enter/Space to trigger row click,
 *   Escape to blur. ARIA roles set for screen readers.
 *
 * ── ATTRIBUTE REFERENCE ──────────────────────────────────────────────────────
 *   api-url="/api/items/"          fetch endpoint
 *   response-map='{"dataPath":"results","totalPath":"count"}'
 *   columns='[{"field":"name","label":"Name","type":"badge","pin":"left",
 *              "sortable":false,"hidden":false,"summary":"sum"}]'
 *   delete-api-url="/api/items"    enables delete buttons
 *   page-size="20"                 rows per page
 *   hide-id                        auto-hides id column
 *   fetch-config='{"method":"POST","headers":{"X-CSRFToken":"auto"}}'
 *   source="stateKey"              load from smartState instead of api-url
 *   state-listen="stateKey"        re-render when smartState[key] changes
 *   refresh-interval="30"          silent background poll every N seconds
 *   selectable                     adds checkbox columns
 *   row-url="/items/{id}"          makes rows clickable, navigates to URL
 *   data-onclick="fnName"          calls window[fnName](rowData, el) on row click
 *   theme="auto|light|dark"        default: auto
 *   data-st-theme="light|dark"     direct theme override (unchanged from v1)
 *
 * ── PUBLIC API ────────────────────────────────────────────────────────────────
 *   refresh()                      re-fetch / re-filter from page 1
 *   setFilters(obj)                set external filter object
 *   resetFilters()                 clear external filters
 *   clearSearch()                  clear search input
 *   getColumnOrder()               returns array of visible field names
 *   setColumnOrder(fieldArr)       reorder columns programmatically
 *   resetColumnOrder()             restore original column order
 *   showColumn(field)              make a hidden column visible
 *   hideColumn(field)              hide a column
 *   getSelectedRows()              returns array of selected row data objects
 *   getSelectedIds()               returns array of selected row id strings
 *   clearSelection()               deselects all rows
 *   exportCSV(filename?)           downloads filtered data as CSV
 *   exportJSON(filename?)          downloads filtered data as JSON
 *
 * ── EVENTS ────────────────────────────────────────────────────────────────────
 *   data-loaded       { data, total }
 *   row-deleted       { id }
 *   row-clicked       { row, element }
 *   rows-selected     { rows, ids }
 *   column-reordered  { order }
 *   column-visibility { field, hidden }
 *   st-refresh        { rowsChanged, rowsAdded, rowsRemoved }
 */

class SmartTable extends HTMLElement {
    constructor() {
        super();
        this._data             = [];
        this._filteredData     = [];
        this._columns          = [];
        this._sortField        = null;
        this._sortDir          = 'asc';
        this._page             = 1;
        this._pageSize         = 20;
        this._total            = 0;
        this._hasMore          = true;
        this._loading          = false;
        this._searchQuery      = '';
        this._searchTimer      = null;
        this._observer         = null;
        this._fetchController  = null;
        this._mode             = 'server';
        this._clientData       = [];
        this._ROW_HEIGHT       = 48;
        this._VISIBLE_ROWS     = 20;
        this._deleteRowId      = null;
        this._badgeFilters     = {};
        this._badgePalette     = {};
        this._externalFilters  = {};
        this._colOrder         = null;
        this._colOrderOriginal = null;
        this._stateUnsubs      = [];

        // v2 state
        this._selectedRows     = new Map();   // id → row data
        this._refreshTimer     = null;
        this._isFirstLoad      = true;        // shimmer only on first load
        this._contextMenu      = null;
        this._focusedRowIdx    = -1;
        this._colVisibility    = {};          // field → true means hidden
        this._colVisDropdown   = null;
        this._pinnedOffsets    = {};          // field → px offset for sticky
    }

    static get observedAttributes() {
        return ['api-url','response-map','columns','delete-api-url','page-size',
                'hide-id','fetch-config','source','state-listen','theme',
                'refresh-interval','selectable'];
    }

    // ── Theme — [data-sc-theme] integration ──────────────────────────────────

    _applyTheme() {
        // Explicit data-st-theme on this element always wins
        const explicit = this.getAttribute('data-st-theme');
        if (explicit === 'light' || explicit === 'dark') return;

        // theme= attribute on this element
        const themeAttr = (this.getAttribute('theme') || 'auto').toLowerCase();
        if (themeAttr === 'light' || themeAttr === 'dark') {
            this.setAttribute('data-st-theme', themeAttr);
            return;
        }

        // auto: check ancestor [data-sc-theme] first
        const ancestor = this.closest('[data-sc-theme]');
        if (ancestor) {
            this.setAttribute('data-st-theme', ancestor.dataset.scTheme === 'dark' ? 'dark' : 'light');
            return;
        }

        // Fallback: OS preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        this.setAttribute('data-st-theme', prefersDark ? 'dark' : 'light');
    }

    _setupThemeWatcher() {
        // Watch body and html for [data-sc-theme] changes (JS toggle)
        this._themeObserver = new MutationObserver(() => this._applyTheme());
        [document.body, document.documentElement].filter(Boolean).forEach(el => {
            this._themeObserver.observe(el, { attributes: true, attributeFilter: ['data-sc-theme', 'class'] });
        });

        // Watch this element's own data-st-theme for explicit overrides
        this._selfThemeObserver = new MutationObserver(() => {});

        // OS preference watcher
        this._mql = window.matchMedia('(prefers-color-scheme: dark)');
        this._mqlHandler = () => this._applyTheme();
        this._mql.addEventListener('change', this._mqlHandler);
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    connectedCallback() {
        this._injectStyles();
        this._applyTheme();
        this._setupThemeWatcher();

        this._filterHandler = (e) => {
            if (!e.detail || e.detail.target !== this.id) return;
            this.setFilters(e.detail.filters || {});
            this.refresh();
        };
        window.addEventListener('smart-table-filter', this._filterHandler);

        this._stateUnsubs = [];
        this._initSourceIntegration();
        this.init();
    }

    disconnectedCallback() {
        if (this._observer)       this._observer.disconnect();
        if (this._fetchController) this._fetchController.abort();
        if (this._themeObserver)  this._themeObserver.disconnect();
        if (this._mqlHandler)     this._mql?.removeEventListener('change', this._mqlHandler);
        if (this._refreshTimer)   clearInterval(this._refreshTimer);
        window.removeEventListener('smart-table-filter', this._filterHandler);
        if (this._smartDataEvtHandler) window.removeEventListener('smart-data-loaded', this._smartDataEvtHandler);
        this._stateUnsubs.forEach(fn => { try { fn(); } catch(e) {} });
        this._destroyContextMenu();
    }

    attributeChangedCallback(name) {
        if (name === 'theme') this._applyTheme();
    }

    // ── Init ─────────────────────────────────────────────────────────────────

    init() {
        if (!this.validateAttributes()) return;
        this._pageSize = parseInt(this.getAttribute('page-size') || '20', 10);
        const colAttr  = this.getAttribute('columns');
        if (colAttr) {
            try {
                const parsed = JSON.parse(colAttr);
                this._columns = parsed;
                // Apply initial hidden state from column definition
                parsed.forEach(c => {
                    if (c.hidden) this._colVisibility[c.field] = true;
                });
            } catch { console.error('[SmartTable] Invalid columns JSON'); }
        }

        this.render();
        this._setupKeyboardNav();
        this._setupRefreshInterval();

        const sourceKey = this.getAttribute('source');
        if (sourceKey) {
            if (this._sourceData != null) this._loadFromSource(this._sourceData);
            else this._showSkeleton();
            return;
        }
        this.fetchData();
    }

    // ── SmartState / Source integration (unchanged from v1) ───────────────────

    _initSourceIntegration() {
        const sourceKey = this.getAttribute('source');
        const listenKey = this.getAttribute('state-listen');

        if (sourceKey && window.smartState) {
            const existing = window.smartState.get(sourceKey);
            if (existing != null) this._sourceData = existing;
            const handler = (val) => { this._sourceData = val; this._loadFromSource(val); };
            window.smartState.subscribe(sourceKey, handler);
            this._stateUnsubs.push(() => window.smartState.unsubscribe(sourceKey, handler));
        }

        if (sourceKey) {
            this._smartDataEvtHandler = (e) => {
                if (e.detail?.key === sourceKey) {
                    this._sourceData = e.detail.data;
                    this._loadFromSource(e.detail.data);
                }
            };
            window.addEventListener('smart-data-loaded', this._smartDataEvtHandler);
        }

        if (listenKey && window.smartState) {
            const handler = () => {
                if (this.getAttribute('source')) {
                    const data = window.smartState.get(this.getAttribute('source'));
                    if (data != null) this._loadFromSource(data);
                } else {
                    this.refresh();
                }
            };
            window.smartState.subscribe(listenKey, handler);
            this._stateUnsubs.push(() => window.smartState.unsubscribe(listenKey, handler));
        }
    }

    _loadFromSource(rawData) {
        let rows = Array.isArray(rawData) ? rawData
            : rawData?.results || rawData?.data || rawData?.items || [];

        this._data = rows; this._clientData = [...rows];
        this._filteredData = [...rows]; this._total = rows.length;
        this._hasMore = false; this._mode = 'client'; this._loading = false;

        if (!this._columns.length && rows.length > 0) this._autoDetectColumns(rows[0]);
        this._buildBadgePalettes();
        this._isFirstLoad = false;
        this.renderRows();
        this._renderPagination();
        this._renderBadgeFilterBar();
        this._renderSummaryFooter();
        this.dispatchEvent(new CustomEvent('data-loaded', { detail: { data: this._data, total: this._total } }));
    }

    validateAttributes() {
        if (this.getAttribute('source')) return true;
        if (!this.getAttribute('api-url')) { console.error('[SmartTable] Required attribute "api-url" is missing.'); return false; }
        if (!this.getAttribute('response-map')) { console.error('[SmartTable] Required attribute "response-map" is missing.'); return false; }
        try { JSON.parse(this.getAttribute('response-map')); } catch { console.error('[SmartTable] "response-map" is not valid JSON.'); return false; }
        return true;
    }

    // ── Fetch ─────────────────────────────────────────────────────────────────

    async fetchData(append = false) {
        if (this._loading) return;
        this._loading = true;

        // Only show shimmer on first load — subsequent refreshes are silent
        if (this._isFirstLoad) this._showSkeleton();

        if (this._fetchController) this._fetchController.abort();
        this._fetchController = new AbortController();

        let fetchCfg = {};
        try { const r = this.getAttribute('fetch-config'); if (r) fetchCfg = JSON.parse(r); } catch {}

        const method   = (fetchCfg.method || 'GET').toUpperCase();
        const bodyMode = fetchCfg.bodyMode || 'json';
        const headers  = {};
        for (const [k, v] of Object.entries(fetchCfg.headers || {})) {
            headers[k] = (v === 'auto') ? this._readCsrf() : v;
        }

        const params = {
            page:  this._page,
            limit: this._pageSize,
            ...(this._searchQuery ? { search: this._searchQuery } : {}),
            ...(this._sortField   ? { sort: this._sortField, order: this._sortDir } : {}),
            ...(Object.keys(this._externalFilters || {}).length ? this._externalFilters : {}),
        };

        let url, fetchOptions;
        if (method === 'GET') {
            url = new URL(this.getAttribute('api-url'), location.href);
            Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
            fetchOptions = { method: 'GET', headers, signal: this._fetchController.signal };
        } else {
            url = new URL(this.getAttribute('api-url'), location.href);
            let body;
            if (bodyMode === 'form') {
                const fd = new FormData();
                Object.entries(params).forEach(([k, v]) => fd.append(k, String(v)));
                body = fd;
            } else {
                headers['Content-Type'] = 'application/json';
                body = JSON.stringify(params);
            }
            fetchOptions = { method, headers, body, signal: this._fetchController.signal };
        }

        try {
            const res  = await fetch(url.toString(), fetchOptions);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            const normalized = this.normalizeResponse(json);

            const prevData    = this._data;
            const isFirstLoad = this._isFirstLoad;

            this._data   = append ? [...this._data, ...normalized.data] : normalized.data;
            this._total  = normalized.total;
            this._hasMore = normalized.hasMore;

            if (!append) {
                if (this._total <= this._pageSize)  this._mode = 'client';
                else if (this._total <= 1000)       this._mode = 'paginated';
                else                                this._mode = 'infinite';
            }

            if (this._mode === 'client' || this._mode === 'paginated') {
                this._clientData   = [...this._data];
                this._filteredData = [...this._clientData];
            }

            if (!this._columns.length && this._data.length > 0) this._autoDetectColumns(this._data[0]);
            this._buildBadgePalettes();

            this._loading = false;
            this._isFirstLoad = false;

            if (!isFirstLoad && !append) {
                // Silent refresh — diff and animate only changed rows
                this._diffAndUpdate(prevData, this._data);
            } else {
                this.renderRows();
                this._renderPagination();
                this._renderBadgeFilterBar();
                this._renderSummaryFooter();
            }

            if (this._mode === 'infinite') this._setupInfiniteScroll();

            this.dispatchEvent(new CustomEvent('data-loaded', { detail: { data: this._data, total: this._total } }));
        } catch (err) {
            if (err.name === 'AbortError') return;
            this._loading = false;
            if (this._isFirstLoad) this._showError(err.message);
            console.error('[SmartTable] Fetch error:', err);
        }
    }

    // ── Silent refresh diff ───────────────────────────────────────────────────

    /**
     * Diffs new data against old data by row id.
     * Only re-renders rows that changed or are new. Removes rows that disappeared.
     * Animates changed/new rows with .st-row--updated flash.
     */
    _diffAndUpdate(prevData, newData) {
        const prevMap = new Map(prevData.map(r => [String(r.id ?? JSON.stringify(r)), r]));
        const newMap  = new Map(newData.map(r  => [String(r.id ?? JSON.stringify(r)), r]));

        let rowsChanged = 0, rowsAdded = 0, rowsRemoved = 0;

        // Remove rows that no longer exist
        prevMap.forEach((_, id) => {
            if (!newMap.has(id)) {
                const el = this.querySelector(`tr[data-id="${id}"]`);
                if (el) {
                    el.style.cssText += 'transition:opacity .25s,transform .25s;opacity:0;transform:translateX(-8px)';
                    setTimeout(() => el.remove(), 260);
                    rowsRemoved++;
                }
            }
        });

        const tbody = this.querySelector('.st-tbody');
        if (!tbody) return;

        newData.forEach((row, idx) => {
            const id    = String(row.id ?? JSON.stringify(row));
            const prev  = prevMap.get(id);
            const rowEl = this.querySelector(`tr[data-id="${id}"]`);

            if (!prev) {
                // New row — insert at correct position
                const newEl = this._createRowEl(row);
                newEl.classList.add('st-row--updated');
                const refEl = tbody.querySelectorAll('tr.st-row')[idx];
                if (refEl) tbody.insertBefore(newEl, refEl);
                else tbody.appendChild(newEl);
                setTimeout(() => newEl.classList.remove('st-row--updated'), 1200);
                rowsAdded++;
            } else if (JSON.stringify(prev) !== JSON.stringify(row)) {
                // Changed row — update in-place
                const updatedEl = this._createRowEl(row);
                updatedEl.classList.add('st-row--updated');
                if (rowEl) {
                    tbody.replaceChild(updatedEl, rowEl);
                } else {
                    tbody.appendChild(updatedEl);
                }
                setTimeout(() => updatedEl.classList.remove('st-row--updated'), 1200);
                rowsChanged++;
            }
            // Unchanged rows are untouched — no re-render, no flicker
        });

        this._attachDeleteListeners();
        this._attachRowClickListeners();
        this._attachCopyCellListeners();
        this._restoreSelection();
        this._renderSummaryFooter();
        this._updateCount(this._getDisplayData().length);

        this.dispatchEvent(new CustomEvent('st-refresh', {
            detail: { rowsChanged, rowsAdded, rowsRemoved },
            bubbles: true,
        }));
    }

    // Creates a detached <tr> element for a row (used by both renderRows and diff)
    _createRowEl(row) {
        const tmp = document.createElement('tbody');
        tmp.innerHTML = this._renderRow(row);
        return tmp.firstElementChild;
    }

    // ── Refresh interval ─────────────────────────────────────────────────────

    _setupRefreshInterval() {
        const secs = parseInt(this.getAttribute('refresh-interval') || '0', 10);
        if (!secs || secs < 5) return;

        this._refreshTimer = setInterval(() => {
            if (this._mode === 'client' && !this.getAttribute('source')) return; // client-only source, nothing to re-fetch
            if (this._mode === 'server' || this._mode === 'paginated' || this._mode === 'infinite') {
                this.fetchData(false); // silent — _isFirstLoad is false by now
            }
        }, secs * 1000);
    }

    // ── Export ────────────────────────────────────────────────────────────────

    // exportCSV(filename) {
    //     const cols = this._getOrderedCols();
    //     const name = filename || (this.id ? `${this.id}.csv` : 'export.csv');

    //     const escape = (v) => {
    //         const s = String(v ?? '');
    //         return s.includes(',') || s.includes('"') || s.includes('\n')
    //             ? `"${s.replace(/"/g, '""')}"`
    //             : s;
    //     };

    //     const header = cols.map(c => escape(c.label || this._formatLabel(c.field))).join(',');
    //     const rows   = this._filteredData.map(row =>
    //         cols.map(c => {
    //             const v = row[c.field];
    //             if (v == null) return '';
    //             if (typeof v === 'object') return escape(JSON.stringify(v));
    //             return escape(v);
    //         }).join(',')
    //     );

    //     const csv  = [header, ...rows].join('\r\n');
    //     const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    //     this._download(blob, name);
    // }

    // exportJSON(filename) {
    //     const name = filename || (this.id ? `${this.id}.json` : 'export.json');
    //     const cols = this._getOrderedCols().map(c => c.field);
    //     const data = this._filteredData.map(row => {
    //         const obj = {};
    //         cols.forEach(f => { obj[f] = row[f]; });
    //         return obj;
    //     });

    //     const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    //     this._download(blob, name);
    // }

    _download(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
    }

    // ── Row selection ─────────────────────────────────────────────────────────

    getSelectedRows() { return Array.from(this._selectedRows.values()); }
    getSelectedIds()  { return Array.from(this._selectedRows.keys()); }
    clearSelection()  {
        this._selectedRows.clear();
        this.querySelectorAll('.st-row-cb').forEach(cb => cb.checked = false);
        const masterCb = this.querySelector('.st-master-cb');
        if (masterCb) masterCb.checked = false;
        this.dispatchEvent(new CustomEvent('rows-selected', { detail: { rows: [], ids: [] } }));
    }

    _restoreSelection() {
        this._selectedRows.forEach((_, id) => {
            const cb = this.querySelector(`.st-row-cb[data-id="${id}"]`);
            if (cb) cb.checked = true;
        });
    }

    // ── Column visibility ─────────────────────────────────────────────────────

    showColumn(field) {
        this._colVisibility[field] = false;
        this._columns = this._columns.map(c => c.field === field ? { ...c, hidden: false } : c);
        this.renderRows();
        this._renderBadgeFilterBar();
        this._renderSummaryFooter();
        this.dispatchEvent(new CustomEvent('column-visibility', { detail: { field, hidden: false } }));
    }

    hideColumn(field) {
        this._colVisibility[field] = true;
        this._columns = this._columns.map(c => c.field === field ? { ...c, hidden: true } : c);
        this.renderRows();
        this._renderBadgeFilterBar();
        this._renderSummaryFooter();
        this.dispatchEvent(new CustomEvent('column-visibility', { detail: { field, hidden: true } }));
    }

    // ── Column order API (preserved from v1) ──────────────────────────────────

    getColumnOrder() { return this._getOrderedCols().map(c => c.field); }

    setColumnOrder(fieldOrder) {
        if (!Array.isArray(fieldOrder)) return;
        const map = new Map(this._columns.map(c => [c.field, c]));
        const ordered = [];
        fieldOrder.forEach(f => { if (map.has(f)) { ordered.push(map.get(f)); map.delete(f); } });
        map.forEach(c => ordered.push(c));
        this._columns  = ordered;
        this._colOrder = ordered.filter(c => !c.hidden).map(c => c.field);
        this.renderRows();
        this._renderBadgeFilterBar();
        this._renderSummaryFooter();
    }

    resetColumnOrder() {
        if (this._colOrderOriginal) {
            const map = new Map(this._columns.map(c => [c.field, c]));
            this._columns = this._colOrderOriginal.map(f => map.get(f)).filter(Boolean);
        }
        this._colOrder = null;
        this.renderRows();
        this._renderBadgeFilterBar();
        this._renderSummaryFooter();
    }

    // ── Public API (preserved from v1) ───────────────────────────────────────

    refresh() {
        this._page = 1;
        if (this._mode === 'server' || this._mode === 'infinite') {
            this._data = [];
            this.fetchData();
        } else {
            this._applyAllFilters();
        }
    }

    setFilters(obj)  { if (obj && typeof obj === 'object') this._externalFilters = { ...obj }; }
    resetFilters()   { this._externalFilters = {}; }
    clearSearch()    { this._searchQuery = ''; const i = this.querySelector('.st-search'); if (i) i.value = ''; this.refresh(); }

    // ── Theme ─────────────────────────────────────────────────────────────────

    // ── Column detection ──────────────────────────────────────────────────────

    _autoDetectColumns(row) {
        const hideId = this.hasAttribute('hide-id');
        this._columns = Object.keys(row)
            .filter(k => !(hideId && k === 'id'))
            .map(k => ({ field: k, label: this._formatLabel(k) }));
        if (!this._colOrderOriginal) this._colOrderOriginal = this._columns.map(c => c.field);
    }

    _getOrderedCols() {
        const visible = this._columns.filter(c => !c.hidden && !this._colVisibility[c.field]);
        if (!this._colOrder) return visible;
        const map = new Map(visible.map(c => [c.field, c]));
        const ordered = this._colOrder.map(f => map.get(f)).filter(Boolean);
        visible.forEach(c => { if (!this._colOrder.includes(c.field)) ordered.push(c); });
        return ordered;
    }

    _formatLabel(str) {
        return str.replace(/([A-Z])/g,' $1').replace(/_/g,' ').replace(/^\w/,c=>c.toUpperCase()).trim();
    }

    // ── Badge palette (unchanged from v1) ─────────────────────────────────────

    _buildBadgePalettes() {
        const source = this._clientData.length ? this._clientData : this._data;
        this._columns.filter(c => c.type === 'badge').forEach(col => {
            if (this._badgePalette[col.field]) return;
            const vals = [...new Set(source.map(r => String(r[col.field] ?? '')).filter(Boolean))].sort();
            this._badgePalette[col.field] = {};
            vals.forEach((v, i) => { this._badgePalette[col.field][v] = this._semanticBadgeClass(v, i); });
        });
    }

    _semanticBadgeClass(val, idx) {
        const v   = val.toLowerCase().replace(/[\s-]/g, '_');
        const map = { yes:1,true:1,active:1,enabled:1,success:1,approved:1,completed:1,done:1,online:1,open:1,verified:1,
                      no:2,false:2,inactive:2,disabled:2,error:2,rejected:2,failed:2,offline:2,closed:2,banned:2,blocked:2,cancelled:2,
                      pending:3,warning:3,processing:3,review:3,draft:3,partial:3,
                      info:4,new:4,scheduled:4,female:5,other:6,male:4,unknown:6,none:6,n_a:6 };
        const cls = ['yes','no','warn','info','purple','neutral'];
        if (map[v] !== undefined) return `st-badge--${cls[map[v]-1]}`;
        return `st-badge--p${idx % 8}`;
    }

    _badgeClass(field, val) {
        const s = String(val ?? '');
        return this._badgePalette[field]?.[s] || this._semanticBadgeClass(s, 0);
    }

    // ── Badge filter bar (unchanged from v1) ──────────────────────────────────

    _renderBadgeFilterBar() {
        const container = this.querySelector('.st-filter-bar');
        if (!container) return;
        container.innerHTML = '';
        const badgeCols = this._columns.filter(c => c.type === 'badge' && !c.hidden && !this._colVisibility[c.field]);
        if (!badgeCols.length) return;
        const source = this._clientData.length ? this._clientData : this._data;

        badgeCols.forEach(col => {
            const uniqueVals = [...new Set(source.map(r => String(r[col.field] ?? '')).filter(Boolean))].sort();
            if (uniqueVals.length < 2) return;
            const activeSet = this._badgeFilters[col.field] || new Set();
            const row = document.createElement('div');
            row.className = 'st-filter-row';
            const lbl = document.createElement('span');
            lbl.className = 'st-filter-label';
            lbl.textContent = (col.label || this._formatLabel(col.field)) + ':';
            row.appendChild(lbl);
            uniqueVals.forEach(val => {
                const chip = document.createElement('button');
                chip.className = `st-filter-chip st-badge ${this._badgeClass(col.field, val)}${activeSet.has(val) ? ' st-filter-chip--active' : ''}`;
                chip.textContent = val;
                chip.addEventListener('click', () => this._toggleBadgeFilter(col.field, val));
                row.appendChild(chip);
            });
            if (activeSet.size > 0) {
                const clearBtn = document.createElement('button');
                clearBtn.className = 'st-filter-clear';
                clearBtn.textContent = '✕ Clear';
                clearBtn.addEventListener('click', () => { delete this._badgeFilters[col.field]; this._applyAllFilters(); this._renderBadgeFilterBar(); });
                row.appendChild(clearBtn);
            }
            container.appendChild(row);
        });
    }

    _toggleBadgeFilter(field, val) {
        if (!this._badgeFilters[field]) this._badgeFilters[field] = new Set();
        const set = this._badgeFilters[field];
        if (set.has(val)) set.delete(val); else set.add(val);
        if (!set.size) delete this._badgeFilters[field];
        this._applyAllFilters();
        this._renderBadgeFilterBar();
    }

    _applyAllFilters() {
        this._page = 1;
        this._showSkeleton();
        requestAnimationFrame(() => {
            let result = [...this._clientData];
            if (this._searchQuery) {
                const q = this._searchQuery.toLowerCase();
                result = result.filter(row =>
                    Object.values(row).some(v =>
                        v !== null && typeof v === 'object'
                            ? Object.values(v).some(sv => String(sv).toLowerCase().includes(q))
                            : String(v).toLowerCase().includes(q)
                    )
                );
            }
            Object.entries(this._badgeFilters).forEach(([field, set]) => {
                if (!set.size) return;
                result = result.filter(r => set.has(String(r[field] ?? '')));
            });
            Object.entries(this._externalFilters || {}).forEach(([field, val]) => {
                if (val === '' || val == null) return;
                const vals = Array.isArray(val) ? val.map(String) : [String(val)];
                result = result.filter(r => vals.includes(String(r[field] ?? '')));
            });
            this._filteredData = result;
            this.renderRows();
            this._renderPagination();
            this._renderSummaryFooter();
        });
    }

    // ── Render ────────────────────────────────────────────────────────────────

    render() {
        const hasSelectable = this.hasAttribute('selectable');
        this.innerHTML = `
        <div class="st-wrapper" tabindex="0" role="grid" aria-label="Data table">
            <div class="st-toolbar">
                <div class="st-toolbar-left">
                    <div class="st-search-wrap">
                        <svg class="st-search-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                            <circle cx="8.5" cy="8.5" r="5.5"/><path d="M15 15l-3-3"/>
                        </svg>
                        <input type="search" class="st-search" placeholder="Search…" autocomplete="off" aria-label="Search table" />
                    </div>
                </div>
                <div class="st-toolbar-right">
                    <span class="st-count" aria-live="polite"></span>
                    <div class="st-col-vis-wrap" style="position:relative;">
                        <button type="button" class="st-toolbar-btn st-col-vis-btn" title="Toggle columns" aria-haspopup="true">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                <rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="18" rx="1"/>
                            </svg>
                            Columns
                        </button>
                        <div class="st-col-vis-dropdown st-hidden"></div>
                    </div>
                    <div class="st-export-wrap" style="position:relative;">
                        <button type="button" class="st-toolbar-btn st-export-btn" title="Export data" aria-haspopup="true">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                            </svg>
                            Export
                        </button>
                        <div class="st-export-dropdown st-hidden">
                            <button type="button" class="st-export-item" data-format="csv">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                Export CSV
                            </button>
                            <button type="button" class="st-export-item" data-format="json">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                Export JSON
                            </button>
                        </div>
                    </div>
                    ${hasSelectable ? `
                    <button type="button" class="st-toolbar-btn st-bulk-btn st-hidden">
                        <span class="st-bulk-count">0</span> selected
                    </button>` : ''}
                </div>
            </div>
            <div class="st-filter-bar"></div>
            <div class="st-scroll-wrap">
                <div class="st-table-container">
                    <table class="st-table" role="grid">
                        <thead class="st-thead"><tr class="st-header-row"></tr></thead>
                        <tbody class="st-tbody"></tbody>
                        <tfoot class="st-tfoot st-hidden"></tfoot>
                    </table>
                    <div class="st-sentinel"></div>
                </div>
            </div>
            <div class="st-pagination"></div>
        </div>`;

        this.querySelector('.st-search').addEventListener('input', e => this.handleSearch(e.target.value));
        this._setupExportDropdown();
        this._setupColVisDropdown();
    }

    // ── Toolbar dropdowns ─────────────────────────────────────────────────────

    _setupExportDropdown() {
        const btn      = this.querySelector('.st-export-btn');
        const dropdown = this.querySelector('.st-export-dropdown');
     
        // Override the dropdown HTML to just have format choices — the "scope"
        // dialog (selected / page / all) appears after format is chosen
        dropdown.innerHTML = `
            <button type="button" class="st-export-item" data-format="csv">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                </svg>
                Export CSV
            </button>
            <button type="button" class="st-export-item" data-format="json">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                </svg>
                Export JSON
            </button>
        `;
     
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('st-hidden');
            this.querySelector('.st-col-vis-dropdown')?.classList.add('st-hidden');
        });
     
        dropdown.querySelectorAll('.st-export-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const format = item.dataset.format;
                dropdown.classList.add('st-hidden');
                this._showExportDialog(format);
            });
        });
     
        document.addEventListener('click', () => dropdown.classList.add('st-hidden'));
    }

    // ─────────────────────────────────────────────────────────────────────────────
    //  NEW: _showExportDialog(format)
    //  Shows an inline scope-selection dialog attached to the table wrapper.
    // ─────────────────────────────────────────────────────────────────────────────
    
    _showExportDialog(format) {
        // Remove any existing dialog
        this.querySelector('.st-export-dialog')?.remove();
    
        const selectedCount = this._selectedRows.size;
        const pageData      = this._getDisplayData();
        const totalRows     = this._mode === 'server' || this._mode === 'paginated' || this._mode === 'infinite'
            ? this._total
            : this._filteredData.length;
    
        const hasSelected = this.hasAttribute('selectable') && selectedCount > 0;
    
        const dialog = document.createElement('div');
        dialog.className = 'st-export-dialog';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-label', `Export ${format.toUpperCase()}`);
    
        dialog.innerHTML = `
            <div class="st-export-dialog-box">
                <div class="st-export-dialog-header">
                    <span class="st-export-dialog-title">
                        Export ${format.toUpperCase()}
                    </span>
                    <button type="button" class="st-export-dialog-close" aria-label="Close">✕</button>
                </div>
                <p class="st-export-dialog-desc">Choose which rows to export:</p>
                <div class="st-export-dialog-options">
                    ${hasSelected ? `
                    <button type="button" class="st-export-scope-btn" data-scope="selected">
                        <span class="st-export-scope-icon">☑</span>
                        <span class="st-export-scope-label">
                            <strong>Selected rows</strong>
                            <small>${selectedCount.toLocaleString()} row${selectedCount !== 1 ? 's' : ''} checked</small>
                        </span>
                    </button>` : ''}
                    <button type="button" class="st-export-scope-btn" data-scope="page">
                        <span class="st-export-scope-icon">📄</span>
                        <span class="st-export-scope-label">
                            <strong>Current page</strong>
                            <small>${pageData.length.toLocaleString()} row${pageData.length !== 1 ? 's' : ''} visible</small>
                        </span>
                    </button>
                    <button type="button" class="st-export-scope-btn${totalRows > 5000 ? ' st-export-scope-btn--danger' : ''}" data-scope="all">
                        <span class="st-export-scope-icon">${totalRows > 5000 ? '⚠' : '📊'}</span>
                        <span class="st-export-scope-label">
                            <strong>All data</strong>
                            <small>${totalRows > 5000
                                ? `${totalRows.toLocaleString()} rows — too large, use page-by-page export`
                                : `${totalRows.toLocaleString()} row${totalRows !== 1 ? 's' : ''} total`}</small>
                        </span>
                    </button>
                </div>
            </div>
        `;
    
        this.querySelector('.st-wrapper').appendChild(dialog);
    
        // Close on backdrop click or X button
        const close = () => dialog.remove();
        dialog.addEventListener('click', (e) => { if (e.target === dialog) close(); });
        dialog.querySelector('.st-export-dialog-close').addEventListener('click', close);
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); }, { once: true });
    
        // Scope button clicks
        dialog.querySelectorAll('.st-export-scope-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const scope = btn.dataset.scope;
    
                // Guard: all data over 5000
                if (scope === 'all' && totalRows > 5000) {
                    window.dispatchEvent(new CustomEvent('smart-toast', {
                        detail: {
                            message: `Export cancelled — ${totalRows.toLocaleString()} rows exceeds the 5,000 row limit. Use page-by-page export instead.`,
                            type: 'error',
                            duration: 6000,
                        }
                    }));
                    close();
                    return;
                }
    
                close();
                await this._doExport(format, scope);
            });
        });
    
        // Focus first option for keyboard accessibility
        requestAnimationFrame(() => {
            dialog.querySelector('.st-export-scope-btn')?.focus();
        });
    }
    
    
    // ─────────────────────────────────────────────────────────────────────────────
    //  NEW: _doExport(format, scope)
    //  Resolves which rows to export, fetches if needed, then downloads.
    // ─────────────────────────────────────────────────────────────────────────────
    
    async _doExport(format, scope) {
        let rows = [];
    
        if (scope === 'selected') {
            rows = Array.from(this._selectedRows.values());
    
        } else if (scope === 'page') {
            rows = this._getDisplayData();
    
        } else if (scope === 'all') {
            const needsFetch = (this._mode === 'server' || this._mode === 'paginated' || this._mode === 'infinite')
                && this._total > this._data.length;
    
            if (needsFetch) {
                // Fetch all pages sequentially
                rows = await this._fetchAllPages();
                if (!rows) return; // aborted
            } else {
                // All data already in memory
                rows = this._filteredData.length ? this._filteredData : this._data;
            }
        }
    
        if (!rows.length) {
            window.dispatchEvent(new CustomEvent('smart-toast', {
                detail: { message: 'No data to export.', type: 'warning', duration: 3000 }
            }));
            return;
        }
    
        this._exportData(rows, format);
    }
    
    
    // ─────────────────────────────────────────────────────────────────────────────
    //  NEW: _fetchAllPages()
    //  Fetches all pages from the API sequentially.
    //  Shows a loading toast with page progress.
    //  Returns flat array of all rows, or null if aborted.
    // ─────────────────────────────────────────────────────────────────────────────
    
    async _fetchAllPages() {
        const totalRows = this._total;
        const pageSize  = this._pageSize;
        const totalPages = Math.ceil(totalRows / pageSize);
    
        // Show initial loading toast — we'll update its text as pages load
        let toastEl = null;
        window.dispatchEvent(new CustomEvent('smart-toast', {
            detail: {
                message: `Fetching page 1 of ${totalPages}…`,
                type: 'loading',
                duration: 0, // persistent
            }
        }));
    
        // Find the toast element to update its text (best effort)
        await new Promise(r => setTimeout(r, 80));
        toastEl = document.querySelector('.sc-toast-item.sc-toast-loading .sc-toast-body');
    
        const allRows = [];
        let aborted   = false;
    
        try {
            for (let page = 1; page <= totalPages; page++) {
                if (toastEl) toastEl.textContent = `Preparing export… page ${page} of ${totalPages}`;
    
                // Build fetch params same way fetchData does
                let fetchCfg = {};
                try { const r = this.getAttribute('fetch-config'); if (r) fetchCfg = JSON.parse(r); } catch {}
                const method  = (fetchCfg.method || 'GET').toUpperCase();
                const headers = {};
                for (const [k, v] of Object.entries(fetchCfg.headers || {})) {
                    headers[k] = (v === 'auto') ? this._readCsrf() : v;
                }
    
                const params = {
                    page,
                    limit: pageSize,
                    ...(this._searchQuery ? { search: this._searchQuery } : {}),
                    ...(this._sortField   ? { sort: this._sortField, order: this._sortDir } : {}),
                    ...(Object.keys(this._externalFilters || {}).length ? this._externalFilters : {}),
                };
    
                let url, fetchOptions;
                if (method === 'GET') {
                    url = new URL(this.getAttribute('api-url'), location.href);
                    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
                    fetchOptions = { method: 'GET', headers };
                } else {
                    url = new URL(this.getAttribute('api-url'), location.href);
                    headers['Content-Type'] = 'application/json';
                    fetchOptions = { method, headers, body: JSON.stringify(params) };
                }
    
                const res  = await fetch(url.toString(), fetchOptions);
                if (!res.ok) throw new Error(`HTTP ${res.status} on page ${page}`);
                const json = await res.json();
                const normalized = this.normalizeResponse(json);
                allRows.push(...normalized.data);
    
                // Small breathing room between pages to avoid rate limiting
                if (page < totalPages) await new Promise(r => setTimeout(r, 60));
            }
        } catch (err) {
            aborted = true;
            // Dismiss loading toast
            document.querySelector('.sc-toast-item.sc-toast-loading .sc-toast-close')?.click();
            window.dispatchEvent(new CustomEvent('smart-toast', {
                detail: { message: `Export failed: ${err.message}`, type: 'error', duration: 5000 }
            }));
            console.error('[SmartTable] Export fetch error:', err);
        }
    
        // Dismiss loading toast
        document.querySelector('.sc-toast-item.sc-toast-loading .sc-toast-close')?.click();
    
        if (aborted) return null;
    
        window.dispatchEvent(new CustomEvent('smart-toast', {
            detail: {
                message: `${allRows.length.toLocaleString()} rows ready — downloading…`,
                type: 'success',
                duration: 3000,
            }
        }));
    
        return allRows;
    }
    
    
    // ─────────────────────────────────────────────────────────────────────────────
    //  NEW: _exportData(rows, format)
    //  Generates and downloads CSV or JSON from an array of row objects.
    //  Uses visible column order; respects current column visibility.
    // ─────────────────────────────────────────────────────────────────────────────
    
    _exportData(rows, format) {
        const cols     = this._getOrderedCols();
        const filename = this.id ? `${this.id}` : 'export';
    
        if (format === 'csv') {
            const escape = (v) => {
                const s = String(v ?? '');
                return s.includes(',') || s.includes('"') || s.includes('\n')
                    ? `"${s.replace(/"/g, '""')}"` : s;
            };
            const header = cols.map(c => escape(c.label || this._formatLabel(c.field))).join(',');
            const body   = rows.map(row =>
                cols.map(c => {
                    const v = row[c.field];
                    if (v == null) return '';
                    if (typeof v === 'object') return escape(JSON.stringify(v));
                    return escape(v);
                }).join(',')
            );
            const blob = new Blob([[header, ...body].join('\r\n')], { type: 'text/csv;charset=utf-8;' });
            this._download(blob, `${filename}.csv`);
    
        } else if (format === 'json') {
            const data = rows.map(row => {
                const obj = {};
                cols.forEach(c => { obj[c.field] = row[c.field]; });
                return obj;
            });
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            this._download(blob, `${filename}.json`);
        }
    }

    _setupColVisDropdown() {
        const btn      = this.querySelector('.st-col-vis-btn');
        const dropdown = this.querySelector('.st-col-vis-dropdown');
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this._renderColVisDropdown();
            dropdown.classList.toggle('st-hidden');
            this.querySelector('.st-export-dropdown')?.classList.add('st-hidden');
        });
        document.addEventListener('click', () => dropdown.classList.add('st-hidden'));
    }

    _renderColVisDropdown() {
        const dropdown = this.querySelector('.st-col-vis-dropdown');
        if (!dropdown) return;
        dropdown.innerHTML = '';
        this._columns.forEach(col => {
            const isHidden = col.hidden || !!this._colVisibility[col.field];
            const item = document.createElement('label');
            item.className = 'st-col-vis-item';
            item.innerHTML = `
                <input type="checkbox" class="st-col-vis-cb" data-field="${col.field}" ${isHidden ? '' : 'checked'}>
                <span>${col.label || this._formatLabel(col.field)}</span>
            `;
            item.querySelector('input').addEventListener('change', (e) => {
                e.stopPropagation();
                if (e.target.checked) this.showColumn(col.field);
                else this.hideColumn(col.field);
            });
            dropdown.appendChild(item);
        });
    }

    // ── Header render ─────────────────────────────────────────────────────────

    renderHeader() {
        const tr          = this.querySelector('.st-header-row');
        if (!tr) return;
        const hasDelete   = !!this.getAttribute('delete-api-url');
        const hasSelect   = this.hasAttribute('selectable');
        const orderedCols = this._getOrderedCols();

        if (!this._colOrderOriginal && orderedCols.length) {
            this._colOrderOriginal = this._columns.map(c => c.field);
        }

        const grip = `<span class="st-col-grip" aria-hidden="true" title="Drag to reorder">
            <svg width="9" height="13" viewBox="0 0 9 13" fill="currentColor">
                <circle cx="2" cy="2" r="1.2"/><circle cx="7" cy="2" r="1.2"/>
                <circle cx="2" cy="6.5" r="1.2"/><circle cx="7" cy="6.5" r="1.2"/>
                <circle cx="2" cy="11" r="1.2"/><circle cx="7" cy="11" r="1.2"/>
            </svg>
        </span>`;

        // Compute sticky offsets for pinned columns
        this._computePinnedOffsets(orderedCols);

        const selectTh = hasSelect
            ? `<th class="st-th st-th-select" scope="col" role="columnheader">
                <input type="checkbox" class="st-master-cb" title="Select all" aria-label="Select all rows">
               </th>`
            : '';

        tr.innerHTML = selectTh + orderedCols.map((c, idx) => {
            const sortable  = c.sortable !== false;
            const icon      = this._sortField === c.field ? (this._sortDir === 'asc' ? '↑' : '↓') : '⇅';
            const pinClass  = c.pin === 'left' ? ' st-th-pinned' : '';
            const pinStyle  = c.pin === 'left' ? ` style="left:${this._pinnedOffsets[c.field] ?? 0}px"` : '';
            return `<th class="st-th st-th-draggable${sortable ? ' st-sortable' : ''}${pinClass}"
                data-field="${c.field}" data-col-idx="${idx}" draggable="true" scope="col" role="columnheader"
                ${pinStyle} aria-sort="${this._sortField === c.field ? (this._sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}">
                ${grip}
                <span class="st-th-label">${c.label || this._formatLabel(c.field)}</span>
                ${sortable ? `<span class="st-sort-icon" aria-hidden="true">${icon}</span>` : ''}
            </th>`;
        }).join('') + (hasDelete ? '<th class="st-th st-th-action" scope="col">Actions</th>' : '');

        tr.querySelectorAll('.st-sortable').forEach(th =>
            th.addEventListener('click', (e) => {
                if (e.target.closest('.st-col-grip')) return;
                this.handleSort(th.dataset.field);
            })
        );

        // Master checkbox
        if (hasSelect) {
            const masterCb = tr.querySelector('.st-master-cb');
            masterCb?.addEventListener('change', (e) => {
                const display = this._getDisplayData();
                if (e.target.checked) {
                    display.forEach(row => this._selectedRows.set(String(row.id ?? JSON.stringify(row)), row));
                } else {
                    display.forEach(row => this._selectedRows.delete(String(row.id ?? JSON.stringify(row))));
                }
                this.querySelectorAll('.st-row-cb').forEach(cb => cb.checked = e.target.checked);
                this._updateBulkBar();
                this.dispatchEvent(new CustomEvent('rows-selected', { detail: { rows: this.getSelectedRows(), ids: this.getSelectedIds() } }));
            });
        }

        this._setupColDrag(tr, orderedCols);
    }

    _computePinnedOffsets(orderedCols) {
        let offset = this.hasAttribute('selectable') ? 36 : 0; // account for checkbox column width
        this._pinnedOffsets = {};
        orderedCols.forEach(col => {
            if (col.pin === 'left') {
                this._pinnedOffsets[col.field] = offset;
                offset += 160; // estimate; real width set after render via ResizeObserver if needed
            }
        });
    }

    // ── Row render ────────────────────────────────────────────────────────────

    renderRows() {
        const tbody = this.querySelector('.st-tbody');
        if (!tbody) return;
        this.renderHeader();
        const displayData = this._getDisplayData();
        const visibleCols = this._getOrderedCols();
        const hasDelete   = !!this.getAttribute('delete-api-url');
        const hasSelect   = this.hasAttribute('selectable');
        const colCount    = visibleCols.length + (hasDelete ? 1 : 0) + (hasSelect ? 1 : 0);

        if (!displayData.length) {
            const hasFilters = Object.keys(this._badgeFilters).length > 0 || this._searchQuery;
            tbody.innerHTML = `<tr class="st-empty-row"><td colspan="${colCount}">
                <div class="st-empty">
                    <svg viewBox="0 0 64 64" width="38" height="38" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">
                        <circle cx="32" cy="28" r="18"/><path d="M14 50l9-9M50 50l-9-9"/>
                    </svg>
                    <span>${hasFilters ? 'No results match the current filters.' : 'No Data Available'}</span>
                </div>
            </td></tr>`;
            const c = this.querySelector('.st-count');
            if (c) c.textContent = '';
            return;
        }

        if (this._mode === 'client' && displayData.length > 1000) {
            this.handleVirtualScroll(displayData);
            return;
        }

        tbody.innerHTML = displayData.map(row => this._renderRow(row)).join('');
        this._attachDeleteListeners();
        this._attachRowClickListeners();
        this._attachCopyCellListeners();
        this._restoreSelection();
        this._updateCount(displayData.length);
    }

    _renderRow(row) {
        const deleteUrl = this.getAttribute('delete-api-url');
        const hasSelect = this.hasAttribute('selectable');
        const hasClick  = this.getAttribute('row-url') || this.getAttribute('data-onclick');
        const id        = row.id ?? JSON.stringify(row);
        const isSelected = this._selectedRows.has(String(id));

        const selectTd = hasSelect
            ? `<td class="st-td-select">
                <input type="checkbox" class="st-row-cb" data-id="${id}" ${isSelected ? 'checked' : ''} aria-label="Select row">
               </td>`
            : '';

        const cells = this._getOrderedCols().map(c => {
            let tdClass = '';
            const val = row[c.field];
            if (c.type === 'inline' && val !== null && typeof val === 'object' && !Array.isArray(val)) tdClass = 'st-td-inline';
            else if (val !== null && typeof val === 'object' && !Array.isArray(val)) tdClass = 'st-td-expand';
            const pinClass = c.pin === 'left' ? ' st-td-pinned' : '';
            const pinStyle = c.pin === 'left' ? ` style="left:${this._pinnedOffsets[c.field] ?? 0}px"` : '';
            return `<td class="${tdClass}${pinClass}" data-field="${c.field}"${pinStyle}>${this._renderCell(row, c)}</td>`;
        }).join('');

        const del = deleteUrl
            ? `<td class="st-td-action">
                <button class="st-delete-btn" data-id="${id}" aria-label="Delete row">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                        <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                    </svg>
                </button>
              </td>`
            : '';

        return `<tr class="st-row${hasClick ? ' st-row-clickable' : ''}${isSelected ? ' st-row-selected' : ''}"
            data-id="${id}" tabindex="-1" role="row">${selectTd}${cells}${del}</tr>`;
    }

    // ── Cell rendering (unchanged from v1) ────────────────────────────────────

    _renderCell(row, col) {
        const val = row[col.field];
        if (val == null) return '<span class="st-null">—</span>';
        if (col.type === 'badge')          return `<span class="st-badge ${this._badgeClass(col.field, val)}">${val}</span>`;
        if (col.type === 'date')           { try { return new Date(val).toLocaleDateString(); } catch { return String(val); } }
        if (col.type === 'dateFormatted')  return this._formatDateLong(val);
        if (col.type === 'integer')        { const n = Number(val); return isNaN(n) ? String(val) : n.toLocaleString(); }
        if (col.type === 'image')          return `<img src="${val}" alt="" class="st-cell-img" loading="lazy">`;
        if (typeof val === 'boolean')      return val ? '<span class="st-badge st-badge--yes">Yes</span>' : '<span class="st-badge st-badge--no">No</span>';
        if (col.type === 'inline' && typeof val === 'object' && val !== null && !Array.isArray(val)) return this._renderInlineObject(val);
        if (typeof val === 'object' && !Array.isArray(val)) return this._renderSubObject(val);
        if (Array.isArray(val)) {
            if (!val.length) return '<span class="st-null">—</span>';
            if (typeof val[0] !== 'object') return val.join(', ');
            return `<span class="st-badge st-badge--neutral">${val.length} item${val.length !== 1 ? 's' : ''}</span>`;
        }
        return String(val);
    }

    _formatDateLong(val) {
        try {
            if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val.trim())) {
                const [y,m,d] = val.trim().split('-').map(Number);
                const dt = new Date(Date.UTC(y,m-1,d));
                return `${String(dt.getUTCDate()).padStart(2,'0')} ${dt.toLocaleString('default',{month:'long',timeZone:'UTC'})}, ${dt.getUTCFullYear()}`;
            }
            const dt = new Date(val);
            if (isNaN(dt.getTime())) return String(val);
            return `${String(dt.getDate()).padStart(2,'0')} ${dt.toLocaleString('default',{month:'long'})}, ${dt.getFullYear()}`;
        } catch { return String(val); }
    }

    _renderSubObject(obj) {
        const rows = Object.entries(obj)
            .filter(([,v]) => v !== null && v !== undefined && typeof v !== 'object' && !Array.isArray(v))
            .map(([k,v]) => {
                const disp = typeof v === 'boolean' ? (v ? '<span class="st-badge st-badge--yes">Yes</span>' : '<span class="st-badge st-badge--no">No</span>') : String(v);
                return `<tr><td class="st-sub-key">${this._formatLabel(k)}</td><td class="st-sub-val">${disp}</td></tr>`;
            });
        if (!rows.length) return '<span class="st-null">—</span>';
        return `<table class="st-sub-table"><tbody>${rows.join('')}</tbody></table>`;
    }

    _renderInlineObject(obj) {
        const entries = Object.entries(obj).filter(([,v]) => v !== null && v !== undefined && typeof v !== 'object' && !Array.isArray(v) && String(v).trim() !== '');
        if (!entries.length) return '<span class="st-null">—</span>';
        const headers = entries.map(([k]) => `<span class="st-inline-header-cell">${this._formatLabel(k)}</span>`).join('');
        const values  = entries.map(([,v]) => `<span class="st-inline-value-cell" title="${String(v)}">${String(v)}</span>`).join('');
        return `<div class="st-inline-wrap"><div class="st-inline-header">${headers}</div><div class="st-inline-values">${values}</div></div>`;
    }

    // ── Summary footer ────────────────────────────────────────────────────────

    _renderSummaryFooter() {
        const tfoot     = this.querySelector('.st-tfoot');
        if (!tfoot) return;
        const summCols  = this._getOrderedCols().filter(c => c.summary);
        if (!summCols.length) { tfoot.classList.add('st-hidden'); return; }

        const hasDelete = !!this.getAttribute('delete-api-url');
        const hasSelect = this.hasAttribute('selectable');

        const cells = this._getOrderedCols().map(c => {
            if (!c.summary) return `<td class="st-tfoot-td"></td>`;
            const vals = this._filteredData.map(r => Number(r[c.field])).filter(n => !isNaN(n));
            let result = '';
            switch (c.summary) {
                case 'sum':   result = vals.reduce((a,b) => a+b, 0).toLocaleString(); break;
                case 'avg':   result = vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(2) : '—'; break;
                case 'count': result = this._filteredData.length.toLocaleString(); break;
                case 'min':   result = vals.length ? Math.min(...vals).toLocaleString() : '—'; break;
                case 'max':   result = vals.length ? Math.max(...vals).toLocaleString() : '—'; break;
                default:      result = '—';
            }
            return `<td class="st-tfoot-td st-tfoot-td--value" title="${c.summary}">${result}</td>`;
        }).join('');

        const selectCell = hasSelect ? '<td class="st-tfoot-td"></td>' : '';
        const deleteCell = hasDelete ? '<td class="st-tfoot-td"></td>' : '';

        tfoot.innerHTML = `<tr class="st-tfoot-row">${selectCell}${cells}${deleteCell}</tr>`;
        tfoot.classList.remove('st-hidden');
    }

    // ── Row click ─────────────────────────────────────────────────────────────

    _attachRowClickListeners() {
        const rowUrl  = this.getAttribute('row-url');
        const onClickFn = this.getAttribute('data-onclick');
        if (!rowUrl && !onClickFn) return;

        this.querySelectorAll('.st-row-clickable').forEach(tr => {
            tr.addEventListener('click', (e) => {
                // Don't trigger on checkbox, delete button, or context menu clicks
                if (e.target.closest('.st-delete-btn, .st-row-cb, .st-context-menu')) return;
                const id  = tr.dataset.id;
                const row = this._data.find(r => String(r.id ?? JSON.stringify(r)) === id) || {};

                if (onClickFn && window[onClickFn]) {
                    window[onClickFn](row, tr);
                } else if (rowUrl) {
                    const url = rowUrl.replace(/\{(\w+)\}/g, (_, k) => row[k] ?? '');
                    window.location.href = url;
                }

                this.dispatchEvent(new CustomEvent('row-clicked', { bubbles: true, detail: { row, element: tr } }));
            });
        });
    }

    // ── Copy cell context menu ────────────────────────────────────────────────

    _attachCopyCellListeners() {
        this.querySelectorAll('.st-tbody td[data-field]').forEach(td => {
            td.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this._showContextMenu(e.clientX, e.clientY, td.textContent?.trim() || '');
            });
        });
    }

    _showContextMenu(x, y, text) {
        this._destroyContextMenu();
        const menu = document.createElement('div');
        menu.className = 'st-context-menu';
        menu.innerHTML = `
            <button type="button" class="st-context-item">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                </svg>
                Copy cell value
            </button>
        `;

        document.body.appendChild(menu);
        this._contextMenu = menu;

        // Position within viewport
        const vw = window.innerWidth, vh = window.innerHeight;
        const mw = 160, mh = 40;
        menu.style.left = `${Math.min(x, vw - mw - 8)}px`;
        menu.style.top  = `${Math.min(y, vh - mh - 8)}px`;

        menu.querySelector('.st-context-item').addEventListener('click', () => {
            navigator.clipboard.writeText(text).catch(() => {
                const ta = document.createElement('textarea');
                ta.value = text; ta.style.cssText = 'position:fixed;opacity:0;';
                document.body.appendChild(ta); ta.select(); document.execCommand('copy');
                document.body.removeChild(ta);
            });
            this._destroyContextMenu();
        });

        const dismiss = (e) => {
            if (!menu.contains(e.target)) { this._destroyContextMenu(); document.removeEventListener('click', dismiss); }
        };
        setTimeout(() => document.addEventListener('click', dismiss), 0);

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this._destroyContextMenu();
        }, { once: true });
    }

    _destroyContextMenu() {
        if (this._contextMenu) { this._contextMenu.remove(); this._contextMenu = null; }
    }

    // ── Keyboard navigation ───────────────────────────────────────────────────

    _setupKeyboardNav() {
        const wrapper = this.querySelector('.st-wrapper');
        if (!wrapper) return;

        wrapper.addEventListener('keydown', (e) => {
            const rows = [...this.querySelectorAll('.st-row')];
            if (!rows.length) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this._focusedRowIdx = Math.min(this._focusedRowIdx + 1, rows.length - 1);
                rows[this._focusedRowIdx]?.focus();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this._focusedRowIdx = Math.max(this._focusedRowIdx - 1, 0);
                rows[this._focusedRowIdx]?.focus();
            } else if ((e.key === 'Enter' || e.key === ' ') && this._focusedRowIdx >= 0) {
                e.preventDefault();
                rows[this._focusedRowIdx]?.click();
            } else if (e.key === 'Escape') {
                this._focusedRowIdx = -1;
                wrapper.focus();
            }
        });
    }

    // ── Row selection event wiring ────────────────────────────────────────────

    _attachSelectListeners() {
        this.querySelectorAll('.st-row-cb').forEach(cb => {
            cb.addEventListener('change', (e) => {
                e.stopPropagation();
                const id  = cb.dataset.id;
                const row = this._data.find(r => String(r.id ?? JSON.stringify(r)) === id);
                if (e.target.checked) { if (row) this._selectedRows.set(id, row); }
                else this._selectedRows.delete(id);
                cb.closest('.st-row')?.classList.toggle('st-row-selected', e.target.checked);
                this._updateBulkBar();
                this.dispatchEvent(new CustomEvent('rows-selected', {
                    detail: { rows: this.getSelectedRows(), ids: this.getSelectedIds() }
                }));
            });
        });
    }

    _updateBulkBar() {
        const btn = this.querySelector('.st-bulk-btn');
        if (!btn) return;
        const count = this._selectedRows.size;
        btn.querySelector('.st-bulk-count').textContent = count;
        btn.classList.toggle('st-hidden', count === 0);
    }

    // ── Delete (unchanged from v1) ────────────────────────────────────────────

    _attachDeleteListeners() {
        this.querySelectorAll('.st-delete-btn').forEach(btn =>
            btn.addEventListener('click', () => this._requestDelete(btn.dataset.id))
        );
        this._attachSelectListeners();
    }

    _requestDelete(id) {
        this._deleteRowId = id;
        const evt = new CustomEvent('smart-confirm', {
            detail: {
                title: 'Delete Row?', message: 'This action cannot be undone.',
                confirmLabel: 'Delete', cancelLabel: 'Cancel',
                onConfirm: () => this._performDelete(),
                onCancel:  () => { this._deleteRowId = null; },
            },
            cancelable: true,
        });
        const notHandled = window.dispatchEvent(evt);
        if (notHandled) {
            if (window.confirm('Are you sure you want to delete this row?')) this._performDelete();
            else this._deleteRowId = null;
        }
    }

    async _performDelete() {
        if (!this._deleteRowId) return;
        const id = this._deleteRowId; this._deleteRowId = null;
        const deleteUrl = this.getAttribute('delete-api-url');
        const rowEl = this.querySelector(`tr[data-id="${id}"]`);
        if (rowEl) rowEl.style.cssText += 'transition:opacity .28s,transform .28s;opacity:0;transform:translateX(-12px)';

        try {
            let fetchCfg = {};
            try { const r = this.getAttribute('fetch-config'); if (r) fetchCfg = JSON.parse(r); } catch {}
            const headers = {};
            for (const [k, v] of Object.entries(fetchCfg.headers || {})) headers[k] = (v === 'auto') ? this._readCsrf() : v;

            const res = await fetch(`${deleteUrl}/${id}`, { method: 'DELETE', headers });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            if (rowEl) setTimeout(() => rowEl.remove(), 280);
            const rm = r => String(r.id) !== id;
            this._data = this._data.filter(rm); this._clientData = this._clientData.filter(rm); this._filteredData = this._filteredData.filter(rm);
            this._selectedRows.delete(id);

            window.dispatchEvent(new CustomEvent('smart-toast', { detail: { message: 'Row deleted successfully.', type: 'success', duration: 3000 } }));
            this.dispatchEvent(new CustomEvent('row-deleted', { detail: { id } }));
        } catch (err) {
            if (rowEl) { rowEl.style.opacity = ''; rowEl.style.transform = ''; }
            window.dispatchEvent(new CustomEvent('smart-toast', { detail: { message: `Delete failed: ${err.message}`, type: 'error', duration: 3000 } }));
            console.error('[SmartTable] Delete error:', err);
        }
    }

    // ── Column drag-to-reorder (unchanged from v1) ────────────────────────────

    _setupColDrag(tr, orderedCols) {
        const ths = [...tr.querySelectorAll('.st-th-draggable')];
        let srcIdx = null;
        const clearIndicators = () => ths.forEach(t => t.classList.remove('st-th-drop-before', 'st-th-drop-after'));

        ths.forEach((th, idx) => {
            th.addEventListener('dragstart', (e) => {
                srcIdx = idx; e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', th.dataset.field);
                requestAnimationFrame(() => th.classList.add('st-th-dragging'));
            });
            th.addEventListener('dragend', () => { th.classList.remove('st-th-dragging'); clearIndicators(); srcIdx = null; });
            th.addEventListener('dragover', (e) => {
                if (srcIdx === null || srcIdx === idx) return;
                e.preventDefault(); e.dataTransfer.dropEffect = 'move';
                clearIndicators();
                const { left, width } = th.getBoundingClientRect();
                th.classList.add(e.clientX < left + width / 2 ? 'st-th-drop-before' : 'st-th-drop-after');
            });
            th.addEventListener('dragleave', () => th.classList.remove('st-th-drop-before', 'st-th-drop-after'));
            th.addEventListener('drop', (e) => {
                e.preventDefault();
                if (srcIdx === null || srcIdx === idx) return;
                const { left, width } = th.getBoundingClientRect();
                const insertBefore = e.clientX < left + width / 2;
                const allCols = [...this._columns];
                const srcCol  = orderedCols[srcIdx], tgtCol = orderedCols[idx];
                const srcAbsIdx = allCols.findIndex(c => c.field === srcCol.field);
                allCols.splice(srcAbsIdx, 1);
                const tgtAbsIdx = allCols.findIndex(c => c.field === tgtCol.field);
                allCols.splice(insertBefore ? tgtAbsIdx : tgtAbsIdx + 1, 0, srcCol);
                this._columns  = allCols;
                this._colOrder = allCols.filter(c => !c.hidden).map(c => c.field);
                this.dispatchEvent(new CustomEvent('column-reordered', { detail: { order: this.getColumnOrder() }, bubbles: true }));
                this.renderRows();
            });
        });
    }

    // ── Display data / pagination / search / sort (unchanged from v1) ─────────

    _getDisplayData() {
        if (this._mode === 'infinite') return this._data;
        if (this._mode === 'paginated') {
            const s = (this._page - 1) * this._pageSize;
            return this._filteredData.slice(s, s + this._pageSize);
        }
        return this._filteredData;
    }

    _updateCount(shown) {
        const el = this.querySelector('.st-count');
        if (!el) return;
        const total = this._mode === 'infinite' ? this._total : this._filteredData.length;
        el.textContent = `${shown.toLocaleString()} of ${total.toLocaleString()} rows`;
    }

    _showSkeleton() {
        const tbody = this.querySelector('.st-tbody');
        if (!tbody) return;
        const cols = Math.max(this._getOrderedCols().length, 4);
        const row  = `<tr class="st-skel-row">${Array(cols).fill('<td><div class="st-skeleton"></div></td>').join('')}</tr>`;
        tbody.innerHTML = Array(5).fill(row).join('');
    }

    _showError(msg) {
        const tbody = this.querySelector('.st-tbody');
        if (!tbody) return;
        const cols = Math.max(this._getOrderedCols().length, 1);
        tbody.innerHTML = `<tr><td colspan="${cols}"><div class="st-error">⚠ Failed to load: ${msg}</div></td></tr>`;
    }

    handleSearch(val) {
        clearTimeout(this._searchTimer);
        this._searchTimer = setTimeout(() => {
            this._searchQuery = val.trim(); this._page = 1;
            if (this._mode === 'server' || this._mode === 'infinite') { this._data = []; this.fetchData(); }
            else this._applyAllFilters();
        }, 300);
    }

    handleSort(field) {
        this._sortDir   = this._sortField === field && this._sortDir === 'asc' ? 'desc' : 'asc';
        this._sortField = field; this._page = 1;
        if (this._mode === 'server' || this._mode === 'infinite') { this._data = []; this.fetchData(); return; }
        this._showSkeleton();
        requestAnimationFrame(() => {
            this._filteredData.sort((a, b) => {
                const av = a[field], bv = b[field];
                if (av == null) return 1; if (bv == null) return -1;
                const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
                return this._sortDir === 'asc' ? cmp : -cmp;
            });
            this.renderRows();
        });
    }

    handlePagination(page) {
        this._page = page; this._showSkeleton();
        requestAnimationFrame(() => {
            if (this._mode === 'server') { this.fetchData(); return; }
            this.renderRows(); this._renderPagination();
            const c = this.querySelector('.st-table-container');
            if (c) c.scrollTop = 0;
        });
    }

    _renderPagination() {
        const el = this.querySelector('.st-pagination');
        if (!el) return;
        if (this._mode === 'infinite') { el.innerHTML = ''; return; }
        const total = this._filteredData.length || this._total;
        const pages = Math.ceil(total / this._pageSize);
        if (pages <= 1) { el.innerHTML = ''; return; }
        const MAX = 7;
        let s = Math.max(1, this._page - 3), e = Math.min(pages, s + MAX - 1);
        if (e - s < MAX - 1) s = Math.max(1, e - MAX + 1);
        const btn = (p, lbl, dis, active) =>
            `<button class="st-page-btn${active?' st-page-btn--active':''}" data-page="${p}" ${dis?'disabled':''}>${lbl}</button>`;
        let html = btn(this._page-1,'‹',this._page===1,false);
        if (s > 1) html += btn(1,'1',false,false) + (s>2?'<span class="st-ellipsis">…</span>':'');
        for (let i=s; i<=e; i++) html += btn(i,i,false,i===this._page);
        if (e < pages) html += (e<pages-1?'<span class="st-ellipsis">…</span>':'') + btn(pages,pages,false,false);
        html += btn(this._page+1,'›',this._page===pages,false);
        el.innerHTML = `<div class="st-pagination-inner">${html}</div>`;
        el.querySelectorAll('.st-page-btn').forEach(b => b.addEventListener('click', () => this.handlePagination(parseInt(b.dataset.page))));
    }

    handleInfiniteScroll() {
        if (this._loading || !this._hasMore) return;
        this._page++; this.fetchData(true);
    }

    _setupInfiniteScroll() {
        if (this._observer) this._observer.disconnect();
        const sentinel = this.querySelector('.st-sentinel');
        if (!sentinel) return;
        this._observer = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting) this.handleInfiniteScroll();
        }, { root: this.querySelector('.st-table-container'), threshold: 0.1 });
        this._observer.observe(sentinel);
    }

    handleVirtualScroll(data) {
        const container = this.querySelector('.st-table-container');
        const tbody     = this.querySelector('.st-tbody');
        const paint = () => {
            const top  = container.scrollTop;
            const sIdx = Math.max(0, Math.floor(top / this._ROW_HEIGHT) - 5);
            const eIdx = Math.min(data.length, sIdx + this._VISIBLE_ROWS + 10);
            const tPad = sIdx * this._ROW_HEIGHT, bPad = (data.length - eIdx) * this._ROW_HEIGHT;
            tbody.innerHTML = `<tr style="height:${tPad}px"></tr>${data.slice(sIdx,eIdx).map(r=>this._renderRow(r)).join('')}<tr style="height:${bPad}px"></tr>`;
            this._attachDeleteListeners(); this._attachRowClickListeners(); this._attachCopyCellListeners();
            this._restoreSelection(); this._updateCount(data.length);
        };
        container.style.maxHeight = `${this._ROW_HEIGHT * this._VISIBLE_ROWS + 60}px`;
        container.addEventListener('scroll', paint, { passive: true });
        paint();
    }

    normalizeResponse(json) {
        const map    = JSON.parse(this.getAttribute('response-map'));
        const data   = this._deepGet(json, map.dataPath) || [];
        const total  = map.totalPath ? (this._deepGet(json, map.totalPath) ?? data.length) : data.length;
        const hasMore = map.hasMorePath ? !!this._deepGet(json, map.hasMorePath) : (data.length === this._pageSize);
        return { data, total: Number(total), hasMore };
    }

    _deepGet(obj, path) {
        if (!path) return obj;
        return path.split('.').reduce((acc, k) => (acc != null ? acc[k] : undefined), obj);
    }

    _readCsrf() {
        const meta = document.querySelector('meta[name="csrf-token"],meta[name="csrftoken"]');
        if (meta) return meta.getAttribute('content') || '';
        const m = document.cookie.match(/(?:^|;\s*)csrf(?:_token|token)=([^;]+)/i);
        return m ? decodeURIComponent(m[1]) : '';
    }

    // ── Styles ────────────────────────────────────────────────────────────────

    _injectStyles() {
        if (document.getElementById('smart-table-styles')) return;
        const s = document.createElement('style');
        s.id = 'smart-table-styles';
        s.textContent = `
        /* ══════════════════════════════════════════════════════
           SMART TABLE v2 — scoped CSS
           All rules prefixed with "smart-table" for specificity.
           ══════════════════════════════════════════════════════ */

        smart-table {
            display: block; width: 100%; max-width: 100%; min-width: 0;
            box-sizing: border-box;
            font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
        }

        /* ── Light tokens (default) ──────────────────────────────────────── */
        smart-table,
        smart-table[data-st-theme="light"] {
            --st-bg:         #ffffff; --st-surface:    #f7f8fc;
            --st-border:     #e4e6f0; --st-border-row: #eef0f8;
            --st-text:       #1e2340; --st-text-muted: #8890b4;
            --st-text-head:  #5a6290; --st-hover:      #f0f2fc;
            --st-stripe:     #fafbff; --st-input-bg:   #f3f5fb;
            --st-ring:       rgba(100,116,240,.18);
            --st-primary:    #6474f0; --st-primary-fg: #ffffff;
            --st-shimmer-a:  #e8eaf4; --st-shimmer-b:  #f5f6fd;
            --st-del-bg:     #fff5f8; --st-del-fg:     #c83050;
            --st-del-bd:     rgba(200,48,80,.3); --st-del-hv: #ffe0e8;
            --st-updated-bg: rgba(99,200,100,.12);
            --st-selected-bg: rgba(100,116,240,.07);
            color-scheme: light;
        }

        /* ── Dark tokens ─────────────────────────────────────────────────── */
        smart-table[data-st-theme="dark"] {
            --st-bg:         #181b2e; --st-surface:    #20243a;
            --st-border:     #2c3050; --st-border-row: #242848;
            --st-text:       #c4c8e8; --st-text-muted: #5c6488;
            --st-text-head:  #848cb8; --st-hover:      #262a44;
            --st-stripe:     #1e2236; --st-input-bg:   #20243a;
            --st-ring:       rgba(130,148,255,.22);
            --st-primary:    #818cf8; --st-primary-fg: #ffffff;
            --st-shimmer-a:  #222640; --st-shimmer-b:  #2c3050;
            --st-del-bg:     #2e1a22; --st-del-fg:     #f090a8;
            --st-del-bd:     #5a2838; --st-del-hv:     #3e1a28;
            --st-updated-bg: rgba(74,222,128,.1);
            --st-selected-bg: rgba(129,140,248,.1);
            color-scheme: dark;
        }

        /* ── Utility ─────────────────────────────────────────────────────── */
        smart-table .st-hidden { display: none !important; }

        /* ── Wrapper + toolbar ───────────────────────────────────────────── */
        smart-table .st-wrapper { position: relative; overflow: hidden; max-width: 100%; outline: none; }
        smart-table .st-toolbar {
            display: flex; align-items: center; justify-content: space-between;
            gap: 0.75rem; margin-bottom: 0.55rem; flex-wrap: wrap;
        }
        smart-table .st-toolbar-left,
        smart-table .st-toolbar-right { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }

        /* ── Search ──────────────────────────────────────────────────────── */
        smart-table .st-search-wrap { position: relative; display: inline-flex; align-items: center; }
        smart-table .st-search-icon { position:absolute;left:9px;width:14px;height:14px;color:var(--st-text-muted);pointer-events:none; }
        smart-table .st-search {
            padding: .36rem .75rem .36rem 1.9rem;
            border-radius: 9px; border: 1.5px solid var(--st-border);
            background: var(--st-input-bg); color: var(--st-text);
            font-size: .84rem; width: 230px; outline: none;
            transition: border-color .18s, box-shadow .18s;
        }
        smart-table .st-search::placeholder { color: var(--st-text-muted); }
        smart-table .st-search:focus { border-color: var(--st-primary); box-shadow: 0 0 0 3px var(--st-ring); }
        smart-table .st-count { font-size: .76rem; color: var(--st-text-muted); white-space: nowrap; }

        /* ── Toolbar buttons (export, columns) ───────────────────────────── */
        smart-table .st-toolbar-btn {
            display: inline-flex; align-items: center; gap: 0.35rem;
            padding: .32rem .7rem; border-radius: 8px;
            border: 1.5px solid var(--st-border);
            background: var(--st-input-bg); color: var(--st-text-muted);
            font-size: .78rem; font-weight: 600; cursor: pointer;
            font-family: inherit;
            transition: background .12s, color .12s, border-color .12s;
        }
        smart-table .st-toolbar-btn:hover { background: var(--st-hover); color: var(--st-text); border-color: var(--st-primary); }
        smart-table .st-bulk-btn {
            background: var(--st-primary); color: var(--st-primary-fg);
            border-color: var(--st-primary);
        }
        smart-table .st-bulk-btn:hover { filter: brightness(1.1); }

        /* ── Export dropdown ─────────────────────────────────────────────── */
        smart-table .st-export-dropdown,
        smart-table .st-col-vis-dropdown {
            position: absolute; top: calc(100% + 4px); right: 0;
            min-width: 150px; z-index: 200;
            background: var(--st-bg);
            border: 1.5px solid var(--st-border);
            border-radius: 8px;
            box-shadow: 0 8px 24px rgba(0,0,0,.12);
            padding: 0.25rem;
            animation: st-dropdown-in .15s ease;
        }
        @keyframes st-dropdown-in { from { opacity:0;transform:translateY(-6px); } to { opacity:1;transform:translateY(0); } }
        smart-table .st-export-item {
            display: flex; align-items: center; gap: 0.5rem;
            width: 100%; padding: 0.45rem 0.65rem;
            background: none; border: none;
            color: var(--st-text); font-size: .82rem;
            cursor: pointer; border-radius: 5px; font-family: inherit;
            transition: background .1s;
        }
        smart-table .st-export-item:hover { background: var(--st-hover); }

        /* ── Column visibility dropdown ──────────────────────────────────── */
        smart-table .st-col-vis-dropdown { min-width: 180px; max-height: 280px; overflow-y: auto; }
        smart-table .st-col-vis-item {
            display: flex; align-items: center; gap: 0.5rem;
            padding: 0.4rem 0.65rem; cursor: pointer; border-radius: 5px;
            color: var(--st-text); font-size: .82rem;
            transition: background .1s;
        }
        smart-table .st-col-vis-item:hover { background: var(--st-hover); }
        smart-table .st-col-vis-cb { accent-color: var(--st-primary); }

        /* ── Badge filter bar ────────────────────────────────────────────── */
        smart-table .st-filter-bar { display:flex;flex-direction:column;gap:.38rem;margin-bottom:.55rem; }
        smart-table .st-filter-row { display:flex;align-items:center;flex-wrap:wrap;gap:.3rem; }
        smart-table .st-filter-label { font-size:.69rem;font-weight:700;color:var(--st-text-muted);text-transform:uppercase;letter-spacing:.06em;margin-right:2px;white-space:nowrap; }
        smart-table .st-filter-chip { cursor:pointer;border:1.5px solid transparent;opacity:.72;transition:opacity .12s,transform .12s,box-shadow .12s;padding:2px 9px; }
        smart-table .st-filter-chip:hover { opacity:1;transform:translateY(-1px); }
        smart-table .st-filter-chip--active { opacity:1;transform:translateY(-1px);box-shadow:0 0 0 2.5px var(--st-primary); }
        smart-table .st-filter-clear { font-size:.7rem;padding:2px 8px;border-radius:6px;border:1.5px solid var(--st-border);background:transparent;color:var(--st-text-muted);cursor:pointer;transition:background .12s,color .12s; }
        smart-table .st-filter-clear:hover { background:var(--st-hover);color:var(--st-text); }

        /* ── Table scroll wrapper ────────────────────────────────────────── */
        smart-table .st-scroll-wrap {
            width:100%;overflow-x:auto;overflow-y:visible;
            -webkit-overflow-scrolling:touch;
            border-radius:12px;border:1.5px solid var(--st-border);
            background:var(--st-bg);box-sizing:border-box;
        }
        smart-table .st-table-container { overflow-y:auto;overflow-x:visible;max-height:520px;position:relative; }
        smart-table .st-table { width:max-content;min-width:100%;border-collapse:collapse;font-size:.855rem;background:var(--st-bg);table-layout:auto; }

        /* ── Header ──────────────────────────────────────────────────────── */
        smart-table .st-thead { position:sticky;top:0;z-index:3; }
        smart-table .st-th {
            font-weight:600;font-size:.71rem;text-transform:uppercase;letter-spacing:.055em;
            color:var(--st-text-head);background:var(--st-surface);
            border-bottom:2px solid var(--st-border);
            white-space:nowrap;padding:.62rem 1rem;cursor:default;user-select:none;
        }
        smart-table .st-th-action,
        smart-table .st-th-select { text-align:center;width:48px; }
        smart-table .st-sortable { cursor:pointer; }
        smart-table .st-sortable:hover { background:var(--st-hover);color:var(--st-text); }
        smart-table .st-sort-icon { margin-left:4px;opacity:.35;font-size:.63rem;vertical-align:middle; }

        /* ── Pinned columns ──────────────────────────────────────────────── */
        smart-table .st-th-pinned,
        smart-table .st-td-pinned {
            position: sticky; z-index: 2;
            background: var(--st-bg);
            box-shadow: 2px 0 4px rgba(0,0,0,.06);
        }
        smart-table .st-th-pinned { background: var(--st-surface); z-index: 4; }

        /* ── Rows ────────────────────────────────────────────────────────── */
        smart-table .st-table tbody tr { transition: background-color .1s; }
        smart-table .st-table tbody td {
            vertical-align:middle;padding:.52rem 1rem;
            border-bottom:1px solid var(--st-border-row);
            color:var(--st-text);white-space:nowrap;background:var(--st-bg);
        }
        smart-table .st-table tbody .st-row:nth-child(even) td { background:var(--st-stripe); }
        smart-table .st-table tbody .st-row:hover td           { background:var(--st-hover); }
        smart-table .st-table tbody .st-row:nth-child(even):hover td { background:var(--st-hover); }
        smart-table .st-row-clickable { cursor: pointer; }
        smart-table .st-row-selected td { background: var(--st-selected-bg) !important; }

        /* ── Row selection checkbox ───────────────────────────────────────── */
        smart-table .st-td-select,
        smart-table .st-th-select { text-align:center; }
        smart-table .st-row-cb,
        smart-table .st-master-cb { accent-color:var(--st-primary);cursor:pointer; }

        /* ── Silent refresh update animation ─────────────────────────────── */
        smart-table .st-row--updated td {
            animation: st-row-flash 1.2s ease-out;
        }
        @keyframes st-row-flash {
            0%   { background: var(--st-updated-bg); }
            100% { background: transparent; }
        }

        /* ── Summary footer ──────────────────────────────────────────────── */
        smart-table .st-tfoot-row { position: sticky; bottom: 0; z-index: 2; }
        smart-table .st-tfoot-td {
            padding: .45rem 1rem;
            background: var(--st-surface);
            border-top: 2px solid var(--st-border);
            font-size: .78rem; font-weight: 700;
            color: var(--st-text-muted);
            white-space: nowrap;
        }
        smart-table .st-tfoot-td--value { color: var(--st-primary); }

        /* ── Skeleton / shimmer ───────────────────────────────────────────── */
        smart-table .st-skel-row td { padding:.66rem 1rem;background:var(--st-bg); }
        smart-table .st-skeleton {
            height:13px;border-radius:6px;
            background:linear-gradient(90deg,var(--st-shimmer-a) 25%,var(--st-shimmer-b) 50%,var(--st-shimmer-a) 75%);
            background-size:300% 100%;
            animation:st-shimmer 1.5s ease-in-out infinite;
        }
        @keyframes st-shimmer { 0% { background-position:200% 0; } 100% { background-position:-200% 0; } }

        /* ── Empty / error ────────────────────────────────────────────────── */
        smart-table .st-empty { display:flex;flex-direction:column;align-items:center;gap:.55rem;padding:3rem 1rem;color:var(--st-text-muted);font-size:.86rem;text-align:center; }
        smart-table .st-error { padding:2.5rem 1rem;text-align:center;font-size:.86rem;color:#e07080; }

        /* ── Pagination ────────────────────────────────────────────────────── */
        smart-table .st-pagination { margin-top:.72rem; }
        smart-table .st-pagination-inner { display:flex;gap:4px;flex-wrap:wrap;align-items:center; }
        smart-table .st-page-btn { padding:3px 10px;font-size:.78rem;border-radius:7px;border:1.5px solid var(--st-border);background:var(--st-input-bg);color:var(--st-text);cursor:pointer;line-height:1.6;transition:background .12s,border-color .12s,color .12s; }
        smart-table .st-page-btn:hover:not(:disabled) { background:var(--st-hover);border-color:var(--st-primary);color:var(--st-primary); }
        smart-table .st-page-btn:disabled { opacity:.35;cursor:default; }
        smart-table .st-page-btn--active { background:var(--st-primary);border-color:var(--st-primary);color:var(--st-primary-fg);font-weight:600; }
        smart-table .st-page-btn--active:hover:not(:disabled) { background:var(--st-primary);color:var(--st-primary-fg); }
        smart-table .st-ellipsis { padding:0 5px;color:var(--st-text-muted);line-height:28px; }

        /* ── Context menu ──────────────────────────────────────────────────── */
        .st-context-menu {
            position: fixed; z-index: 9999;
            background: var(--st-bg, #fff);
            border: 1.5px solid var(--st-border, #e4e6f0);
            border-radius: 8px;
            box-shadow: 0 8px 24px rgba(0,0,0,.14);
            padding: 0.2rem;
            min-width: 150px;
            animation: st-dropdown-in .12s ease;
        }
        .st-context-item {
            display: flex; align-items: center; gap: 0.5rem;
            width: 100%; padding: 0.42rem 0.65rem;
            background: none; border: none;
            color: var(--st-text, #1e2340); font-size: .82rem;
            cursor: pointer; border-radius: 5px; font-family: inherit;
            transition: background .1s;
        }
        .st-context-item:hover { background: var(--st-hover, #f0f2fc); }

        /* ── Misc ──────────────────────────────────────────────────────────── */
        smart-table .st-sentinel { height:1px; }
        smart-table .st-td-expand { white-space:normal;min-width:180px; }
        smart-table .st-td-action { text-align:center; }
        smart-table .st-null { color:var(--st-text-muted); }
        smart-table .st-cell-img { width:34px;height:34px;object-fit:cover;border-radius:6px;border:1.5px solid var(--st-border);display:block; }

        smart-table .st-delete-btn { padding:4px 8px;border-radius:7px;border:1.5px solid var(--st-del-bd);background:var(--st-del-bg);color:var(--st-del-fg);cursor:pointer;transition:background .12s; }
        smart-table .st-delete-btn:hover { background:var(--st-del-hv); }

        /* ── Badge system (unchanged from v1) ────────────────────────────── */
        smart-table .st-badge { display:inline-flex;align-items:center;justify-content:center;padding:2px 9px;border-radius:6px;font-size:.71rem;font-weight:600;letter-spacing:.025em;white-space:nowrap;border:1px solid transparent;line-height:1.5;cursor:default; }
        smart-table .st-badge--yes     { background:#dcfce7;color:#15803d;border-color:#bbf7d0; }
        smart-table .st-badge--no      { background:#fee2e2;color:#b91c1c;border-color:#fecaca; }
        smart-table .st-badge--warn    { background:#fef9c3;color:#a16207;border-color:#fde68a; }
        smart-table .st-badge--info    { background:#dbeafe;color:#1d4ed8;border-color:#bfdbfe; }
        smart-table .st-badge--purple  { background:#f3e8ff;color:#7e22ce;border-color:#e9d5ff; }
        smart-table .st-badge--neutral { background:#f1f5f9;color:#475569;border-color:#e2e8f0; }
        smart-table .st-badge--p0 { background:#fce7f3;color:#9d174d;border-color:#fbcfe8; }
        smart-table .st-badge--p1 { background:#ffedd5;color:#c2410c;border-color:#fed7aa; }
        smart-table .st-badge--p2 { background:#ecfdf5;color:#065f46;border-color:#a7f3d0; }
        smart-table .st-badge--p3 { background:#eff6ff;color:#1e3a8a;border-color:#bfdbfe; }
        smart-table .st-badge--p4 { background:#fdf4ff;color:#7e22ce;border-color:#f0abfc; }
        smart-table .st-badge--p5 { background:#f0fdfa;color:#134e4a;border-color:#99f6e4; }
        smart-table .st-badge--p6 { background:#fff7ed;color:#9a3412;border-color:#fdba74; }
        smart-table .st-badge--p7 { background:#eef2ff;color:#3730a3;border-color:#c7d2fe; }
        smart-table[data-st-theme="dark"] .st-badge--yes     { background:#052e16;color:#4ade80;border-color:#166534; }
        smart-table[data-st-theme="dark"] .st-badge--no      { background:#2d0a0a;color:#f87171;border-color:#991b1b; }
        smart-table[data-st-theme="dark"] .st-badge--warn    { background:#1c1400;color:#fde047;border-color:#a16207; }
        smart-table[data-st-theme="dark"] .st-badge--info    { background:#060e22;color:#60a5fa;border-color:#1d4ed8; }
        smart-table[data-st-theme="dark"] .st-badge--purple  { background:#1c0a2a;color:#c084fc;border-color:#7e22ce; }
        smart-table[data-st-theme="dark"] .st-badge--neutral { background:#1a1f2e;color:#94a3b8;border-color:#334155; }
        smart-table[data-st-theme="dark"] .st-badge--p0 { background:#2d0a1e;color:#f9a8d4;border-color:#9d174d; }
        smart-table[data-st-theme="dark"] .st-badge--p1 { background:#2d1200;color:#fdba74;border-color:#c2410c; }
        smart-table[data-st-theme="dark"] .st-badge--p2 { background:#021c12;color:#34d399;border-color:#065f46; }
        smart-table[data-st-theme="dark"] .st-badge--p3 { background:#080e28;color:#93c5fd;border-color:#1e3a8a; }
        smart-table[data-st-theme="dark"] .st-badge--p4 { background:#1e0028;color:#e879f9;border-color:#7e22ce; }
        smart-table[data-st-theme="dark"] .st-badge--p5 { background:#021a18;color:#2dd4bf;border-color:#134e4a; }
        smart-table[data-st-theme="dark"] .st-badge--p6 { background:#1e0c00;color:#fb923c;border-color:#9a3412; }
        smart-table[data-st-theme="dark"] .st-badge--p7 { background:#0c0e28;color:#a5b4fc;border-color:#3730a3; }

        /* ── Column drag-to-reorder ─────────────────────────────────────── */
        smart-table .st-th-draggable { user-select:none; }
        smart-table .st-col-grip { display:inline-flex;align-items:center;opacity:0;margin-right:5px;vertical-align:middle;cursor:grab;color:var(--st-text-muted);transition:opacity .15s;flex-shrink:0; }
        smart-table .st-th-draggable:hover .st-col-grip { opacity:1; }
        smart-table .st-th-draggable:active { cursor:grabbing; }
        smart-table .st-th-dragging { opacity:.35; }
        smart-table .st-th-drop-before { box-shadow:-2.5px 0 0 0 var(--st-primary) inset !important; }
        smart-table .st-th-drop-after  { box-shadow: 2.5px 0 0 0 var(--st-primary) inset !important; }

        /* ── Inline / sub-table (unchanged) ─────────────────────────────── */
        smart-table .st-inline-wrap { display:flex;flex-direction:column;gap:0;min-width:0; }
        smart-table .st-inline-header { display:flex;gap:0;border-bottom:1.5px solid var(--st-border);margin-bottom:2px; }
        smart-table .st-inline-header-cell { flex:1 1 0;font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--st-text-muted);padding:2px 6px 3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
        smart-table .st-inline-values { display:flex;gap:0; }
        smart-table .st-inline-value-cell { flex:1 1 0;font-size:.8rem;color:var(--st-text);padding:2px 6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
        smart-table .st-td-inline { white-space:normal;min-width:280px;max-width:480px; }
        smart-table .st-sub-table { width:100%;border-collapse:collapse;font-size:.775rem;background:transparent; }
        smart-table .st-sub-table tr+tr td { border-top:1px solid var(--st-border-row); }
        smart-table .st-sub-key { color:var(--st-text-muted);font-weight:500;white-space:nowrap;padding:2px 10px 2px 0;vertical-align:top;width:1%; }
        smart-table .st-sub-val { color:var(--st-text);padding:2px 0;word-break:break-word;white-space:normal; }
        /* ── Export scope dialog ──────────────────────────────────────── */
        smart-table .st-export-dialog {
            position: absolute; inset: 0; z-index: 300;
            background: rgba(10,12,30,.45); backdrop-filter: blur(3px);
            display: flex; align-items: center; justify-content: center;
            border-radius: 12px;
            animation: st-dropdown-in .18s ease;
        }
        smart-table .st-export-dialog-box {
            background: var(--st-bg);
            border: 1.5px solid var(--st-border);
            border-radius: 12px;
            padding: 1.4rem;
            min-width: 280px; max-width: 340px; width: 90%;
            box-shadow: 0 24px 64px rgba(0,0,0,.22);
        }
        smart-table .st-export-dialog-header {
            display: flex; align-items: center; justify-content: space-between;
            margin-bottom: 0.4rem;
        }
        smart-table .st-export-dialog-title {
            font-size: .92rem; font-weight: 700; color: var(--st-text);
        }
        smart-table .st-export-dialog-close {
            background: none; border: none; cursor: pointer;
            color: var(--st-text-muted); font-size: 1rem; padding: 2px 4px;
            border-radius: 4px; transition: background .12s;
        }
        smart-table .st-export-dialog-close:hover { background: var(--st-hover); }
        smart-table .st-export-dialog-desc {
            font-size: .8rem; color: var(--st-text-muted);
            margin: 0 0 .85rem;
        }
        smart-table .st-export-dialog-options {
            display: flex; flex-direction: column; gap: .45rem;
        }
        smart-table .st-export-scope-btn {
            display: flex; align-items: center; gap: .65rem;
            width: 100%; padding: .6rem .75rem;
            background: var(--st-input-bg);
            border: 1.5px solid var(--st-border);
            border-radius: 8px; cursor: pointer;
            text-align: left; font-family: inherit;
            transition: background .12s, border-color .12s, transform .1s;
        }
        smart-table .st-export-scope-btn:hover {
            background: var(--st-hover);
            border-color: var(--st-primary);
            transform: translateY(-1px);
        }
        smart-table .st-export-scope-btn:focus {
            outline: none;
            border-color: var(--st-primary);
            box-shadow: 0 0 0 3px var(--st-ring);
        }
        smart-table .st-export-scope-btn:active { transform: translateY(0) scale(.98); }
        smart-table .st-export-scope-btn--danger {
            border-color: var(--st-del-bd);
            cursor: not-allowed;
            opacity: .75;
        }
        smart-table .st-export-scope-btn--danger:hover {
            background: var(--st-del-bg);
            border-color: var(--st-del-fg);
            transform: none;
        }
        smart-table .st-export-scope-icon {
            font-size: 1.2rem; flex-shrink: 0; line-height: 1;
        }
        smart-table .st-export-scope-label {
            display: flex; flex-direction: column; gap: 1px;
        }
        smart-table .st-export-scope-label strong {
            font-size: .84rem; font-weight: 600; color: var(--st-text);
        }
        smart-table .st-export-scope-label small {
            font-size: .74rem; color: var(--st-text-muted);
        }
        smart-table .st-export-scope-btn--danger .st-export-scope-label small {
            color: var(--st-del-fg);
        }
        `;
        document.head.appendChild(s);
    }
}

customElements.define('smart-table', SmartTable);