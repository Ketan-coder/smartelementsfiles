/**
 * SmartTable - A declarative, attribute-driven Web Component
 * v3 — Fixes: horizontal scroll, badge column filters, dark/light mode,
 *             shimmer on sort/filter/paginate, pastel badge palette
 */

class SmartTable extends HTMLElement {
  constructor() {
    super();
    this._data         = [];
    this._filteredData = [];
    this._columns      = [];
    this._sortField    = null;
    this._sortDir      = 'asc';
    this._page         = 1;
    this._pageSize     = 20;
    this._total        = 0;
    this._hasMore      = true;
    this._loading      = false;
    this._searchQuery  = '';
    this._searchTimer  = null;
    this._observer     = null;
    this._fetchController = null;
    this._mode         = 'server'; // 'server' | 'client' | 'paginated' | 'infinite'
    this._clientData   = [];
    this._ROW_HEIGHT   = 48;
    this._VISIBLE_ROWS = 20;
    this._deleteRowId  = null;
    this._toastTimer   = null;

    // Badge filter state per field: { fieldName: Set<string> }
    this._badgeFilters = {};

    // Stable colour palette per badge column: { fieldName: { value: cssClass } }
    this._badgePalette = {};

    // Dark mode media query
    this._darkMQ = window.matchMedia('(prefers-color-scheme: dark)');
    this._onSchemeChange = () => this._applyTheme();
    // External filters from setFilters() or smart-filter-bar
    this._externalFilters = {};

    // Column reorder — null means use this._columns as-is (default)
    this._colOrder         = null;  // array of field names in current display order
    this._colOrderOriginal = null;  // snapshot of original order for resetColumnOrder()
  }

  static get observedAttributes() {
    return ['api-url', 'response-map', 'columns', 'delete-api-url', 'page-size', 'hide-id', 'fetch-config', 'source', 'state-listen'];
  }

  connectedCallback() {
    this._injectStyles();
    this._applyTheme();
    this._darkMQ.addEventListener('change', this._onSchemeChange);
    // Watch for docs-page light/dark toggle (body class changes)
    this._bodyObserver = new MutationObserver(() => this._applyTheme());
    this._bodyObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    // Listen for filter events from <smart-filter-bar> or any external dispatcher.
    this._filterHandler = (e) => {
      if (!e.detail || e.detail.target !== this.id) return;
      this.setFilters(e.detail.filters || {});
      this.refresh();
    };
    window.addEventListener('smart-table-filter', this._filterHandler);

    // ── SmartState / SmartData source integration ──────────────────────────
    // `source="key"` — loads data from smartState instead of api-url.
    // `state-listen="key"` — re-renders table when smartState[key] changes.
    this._stateUnsubs = [];
    this._initSourceIntegration();

    this.init();
  }

  disconnectedCallback() {
    if (this._observer) this._observer.disconnect();
    if (this._fetchController) this._fetchController.abort();
    if (this._bodyObserver) this._bodyObserver.disconnect();
    this._darkMQ.removeEventListener('change', this._onSchemeChange);
    window.removeEventListener('smart-table-filter', this._filterHandler);
    if (this._smartDataEvtHandler) window.removeEventListener('smart-data-loaded', this._smartDataEvtHandler);
    if (this._stateUnsubs) this._stateUnsubs.forEach(fn => { try { fn(); } catch(e) {} });
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  /** Re-fetches (server mode) or re-filters (client mode) from page 1. */
  refresh() {
    this._page = 1;
    if (this._mode === 'server' || this._mode === 'infinite') {
      this._data = [];
      this.fetchData();
    } else {
      this._applyAllFilters();
    }
  }

  setFilters(filterObject) {
    if (!filterObject || typeof filterObject !== 'object') return;
    this._externalFilters = { ...filterObject };
  }

  resetFilters() {
    this._externalFilters = {};
  }

  clearSearch() {
    this._searchQuery = '';
    const inp = this.querySelector('.st-search');
    if (inp) inp.value = '';
    this.refresh();
  }

  // ─── Column Order API ────────────────────────────────────────────────────────

  /** Returns current visible column order as array of field names. */
  getColumnOrder() {
    return this._getOrderedCols().map(c => c.field);
  }

  /**
   * Programmatically reorder columns.
   * @param {string[]} fieldOrder — desired order of field names.
   *   Fields not listed are appended at the end in their original relative order.
   */
  setColumnOrder(fieldOrder) {
    if (!Array.isArray(fieldOrder)) return;
    const map     = new Map(this._columns.map(c => [c.field, c]));
    const ordered = [];
    fieldOrder.forEach(f => { if (map.has(f)) { ordered.push(map.get(f)); map.delete(f); } });
    map.forEach(c => ordered.push(c));  // append any unlisted columns
    this._columns  = ordered;
    this._colOrder = ordered.filter(c => !c.hidden).map(c => c.field);
    this.renderRows();
    this._renderBadgeFilterBar();
  }

  /** Resets column order to what it was when data first loaded. */
  resetColumnOrder() {
    if (this._colOrderOriginal) {
      const map = new Map(this._columns.map(c => [c.field, c]));
      this._columns = this._colOrderOriginal.map(f => map.get(f)).filter(Boolean);
    }
    this._colOrder = null;
    this.renderRows();
    this._renderBadgeFilterBar();
  }

  // ─── Theme ──────────────────────────────────────────────────────────────────

  _applyTheme() {
    const explicit = this.getAttribute('data-st-theme');
    if (explicit === 'light' || explicit === 'dark') return;
    const bsEl = this.closest('[data-bs-theme]');
    if (bsEl) {
      this.setAttribute('data-st-theme', bsEl.getAttribute('data-bs-theme') === 'light' ? 'light' : 'dark');
      return;
    }
    const bodyLight = document.body.classList.contains('light-mode');
    this.setAttribute('data-st-theme', bodyLight ? 'light' : 'dark');
  }

  // ─── Init ───────────────────────────────────────────────────────────────────

  init() {
    if (!this.validateAttributes()) return;
    this._pageSize = parseInt(this.getAttribute('page-size') || '20', 10);
    const colAttr = this.getAttribute('columns');
    if (colAttr) {
      try { this._columns = JSON.parse(colAttr); }
      catch { console.error('[SmartTable] Invalid columns JSON'); }
    }
    this.render();

    const sourceKey = this.getAttribute('source');
    if (sourceKey) {
      if (this._sourceData != null) {
        this._loadFromSource(this._sourceData);
      } else {
        this._showSkeleton();
      }
      return;
    }

    this.fetchData();
  }

  // ─── SmartState / SmartData Source Integration ─────────────────────────────

  _initSourceIntegration() {
    const sourceKey  = this.getAttribute('source');
    const listenKey  = this.getAttribute('state-listen');

    if (sourceKey && window.smartState) {
      const existing = window.smartState.get(sourceKey);
      if (existing != null) {
        this._sourceData = existing;
      }
      const handler = (val) => {
        this._sourceData = val;
        this._loadFromSource(val);
      };
      window.smartState.subscribe(sourceKey, handler);
      this._stateUnsubs.push(() => window.smartState.unsubscribe(sourceKey, handler));
    }

    if (sourceKey) {
      this._smartDataEvtHandler = (e) => {
        if (e.detail && e.detail.key === sourceKey) {
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
    let rows = [];
    if (Array.isArray(rawData)) {
      rows = rawData;
    } else if (rawData && typeof rawData === 'object') {
      rows = rawData.results || rawData.data || rawData.items || [];
    }

    this._data         = rows;
    this._clientData   = [...rows];
    this._filteredData = [...rows];
    this._total        = rows.length;
    this._hasMore      = false;
    this._mode         = 'client';
    this._loading      = false;

    if (!this._columns.length && rows.length > 0) {
      this._autoDetectColumns(rows[0]);
    }
    this._buildBadgePalettes();
    this.renderRows();
    this._renderPagination();
    this._renderBadgeFilterBar();

    this.dispatchEvent(new CustomEvent('data-loaded', {
      detail: { data: this._data, total: this._total },
    }));
  }

  validateAttributes() {
    const source = this.getAttribute('source');
    if (source) return true;

    if (!this.getAttribute('api-url')) {
      console.error('[SmartTable] Required attribute "api-url" is missing.');
      return false;
    }
    if (!this.getAttribute('response-map')) {
      console.error('[SmartTable] Required attribute "response-map" is missing.');
      return false;
    }
    try { JSON.parse(this.getAttribute('response-map')); }
    catch {
      console.error('[SmartTable] "response-map" is not valid JSON.');
      return false;
    }
    return true;
  }

  // ─── Data Fetching ───────────────────────────────────────────────────────────

  async fetchData(append = false) {
    if (this._loading) return;
    this._loading = true;
    this._showSkeleton();

    if (this._fetchController) this._fetchController.abort();
    this._fetchController = new AbortController();

    let fetchCfg = {};
    try {
      const raw = this.getAttribute('fetch-config');
      if (raw) fetchCfg = JSON.parse(raw);
    } catch { console.error('[SmartTable] Invalid fetch-config JSON'); }

    const method   = (fetchCfg.method || 'GET').toUpperCase();
    const bodyMode = fetchCfg.bodyMode || 'json';

    const headers = {};
    for (const [k, v] of Object.entries(fetchCfg.headers || {})) {
      headers[k] = (v === 'auto') ? this._readCsrf() : v;
    }

    const params = {
      page:  this._page,
      limit: this._pageSize,
      ...(this._searchQuery                              ? { search: this._searchQuery }                   : {}),
      ...(this._sortField                               ? { sort: this._sortField, order: this._sortDir } : {}),
      ...(Object.keys(this._externalFilters || {}).length ? this._externalFilters                          : {}),
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
      const res = await fetch(url.toString(), fetchOptions);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const normalized = this.normalizeResponse(json);

      this._data = append ? [...this._data, ...normalized.data] : normalized.data;
      this._total   = normalized.total;
      this._hasMore = normalized.hasMore;

      if (!append) {
        if (this._total <= this._pageSize)      this._mode = 'client';
        else if (this._total <= 1000)           this._mode = 'paginated';
        else                                    this._mode = 'infinite';
      }

      if (this._mode === 'client' || this._mode === 'paginated') {
        this._clientData   = [...this._data];
        this._filteredData = [...this._clientData];
      }

      if (!this._columns.length && this._data.length > 0) {
        this._autoDetectColumns(this._data[0]);
      }

      this._buildBadgePalettes();

      this._loading = false;
      this.renderRows();
      this._renderPagination();
      this._renderBadgeFilterBar();

      if (this._mode === 'infinite') this._setupInfiniteScroll();

      this.dispatchEvent(new CustomEvent('data-loaded', {
        detail: { data: this._data, total: this._total }
      }));
    } catch (err) {
      if (err.name === 'AbortError') return;
      this._loading = false;
      this._showError(err.message);
      console.error('[SmartTable] Fetch error:', err);
    }
  }

  normalizeResponse(json) {
    const map   = JSON.parse(this.getAttribute('response-map'));
    const data  = this._deepGet(json, map.dataPath) || [];
    const total = map.totalPath
      ? (this._deepGet(json, map.totalPath) ?? data.length)
      : data.length;
    const hasMore = map.hasMorePath
      ? !!this._deepGet(json, map.hasMorePath)
      : (data.length === this._pageSize);
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

  // ─── Column Detection ────────────────────────────────────────────────────────

  _autoDetectColumns(row) {
    const hideId = this.hasAttribute('hide-id');
    this._columns = Object.keys(row)
      .filter(k => !(hideId && k === 'id'))
      .map(k => ({ field: k, label: this._formatLabel(k) }));
    if (!this._colOrderOriginal) this._colOrderOriginal = this._columns.map(c => c.field);
  }

  /**
   * Returns visible columns in current display order.
   * Central method used by renderHeader, _renderRow, colCount, skeleton, error.
   * Does NOT mutate this._columns — safe to call anytime including during live feeds.
   */
  _getOrderedCols() {
    const visible = this._columns.filter(c => !c.hidden);
    if (!this._colOrder) return visible;
    const map     = new Map(visible.map(c => [c.field, c]));
    const ordered = this._colOrder.map(f => map.get(f)).filter(Boolean);
    // Append visible cols that appeared after the order was set (new fields from live data)
    visible.forEach(c => { if (!this._colOrder.includes(c.field)) ordered.push(c); });
    return ordered;
  }

  _formatLabel(str) {
    return str
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/^\w/, c => c.toUpperCase())
      .trim();
  }

  // ─── Badge Palette ───────────────────────────────────────────────────────────

  _buildBadgePalettes() {
    const source = this._clientData.length ? this._clientData : this._data;
    this._columns.filter(c => c.type === 'badge').forEach(col => {
      if (this._badgePalette[col.field]) return;
      const uniqueVals = [
        ...new Set(source.map(r => String(r[col.field] ?? '')).filter(Boolean))
      ].sort();
      this._badgePalette[col.field] = {};
      uniqueVals.forEach((val, idx) => {
        this._badgePalette[col.field][val] = this._semanticBadgeClass(val, idx);
      });
    });
  }

  _semanticBadgeClass(val, idx) {
    const v = val.toLowerCase().replace(/[\s-]/g, '_');
    const map = {
      yes:1, true:1, active:1, enabled:1, success:1, approved:1,
      completed:1, done:1, online:1, open:1, verified:1,
      no:2, false:2, inactive:2, disabled:2, error:2, rejected:2,
      failed:2, offline:2, closed:2, banned:2, blocked:2, cancelled:2,
      pending:3, warning:3, processing:3, review:3, draft:3, partial:3,
      info:4, new:4, scheduled:4,
      female:5, other:6,
      male:4,
      unknown:6, none:6, n_a:6,
    };
    const cls = ['yes','no','warn','info','purple','neutral'];
    if (map[v] !== undefined) return `st-badge--${cls[map[v] - 1]}`;
    return `st-badge--p${idx % 8}`;
  }

  _badgeClass(field, val) {
    const s = String(val ?? '');
    return (this._badgePalette[field] && this._badgePalette[field][s])
      ? this._badgePalette[field][s]
      : this._semanticBadgeClass(s, 0);
  }

  // ─── Badge Filter Bar ────────────────────────────────────────────────────────

  _renderBadgeFilterBar() {
    const container = this.querySelector('.st-filter-bar');
    if (!container) return;
    container.innerHTML = '';

    const badgeCols = this._columns.filter(c => c.type === 'badge' && !c.hidden);
    if (!badgeCols.length) return;

    const source = this._clientData.length ? this._clientData : this._data;

    badgeCols.forEach(col => {
      const uniqueVals = [
        ...new Set(source.map(r => String(r[col.field] ?? '')).filter(Boolean))
      ].sort();
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
        clearBtn.addEventListener('click', () => {
          delete this._badgeFilters[col.field];
          this._applyAllFilters();
          this._renderBadgeFilterBar();
        });
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
    });
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  render() {
    this.innerHTML = `
      <div class="st-wrapper">
        <div class="st-toolbar">
          <div class="st-search-wrap">
            <svg class="st-search-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
              <circle cx="8.5" cy="8.5" r="5.5"/><path d="M15 15l-3-3"/>
            </svg>
            <input type="search" class="st-search" placeholder="Search…" autocomplete="off" />
          </div>
          <span class="st-count"></span>
        </div>
        <div class="st-filter-bar"></div>
        <div class="st-scroll-wrap">
          <div class="st-table-container">
            <table class="st-table" role="grid">
              <thead class="st-thead"><tr class="st-header-row"></tr></thead>
              <tbody class="st-tbody"></tbody>
            </table>
            <div class="st-sentinel"></div>
          </div>
        </div>
        <div class="st-pagination"></div>
        <!-- Toast & modal handled globally by smart-core.js (optional) -->
      </div>`;

    this.querySelector('.st-search').addEventListener('input', e => this.handleSearch(e.target.value));
  }

  renderHeader() {
    const tr = this.querySelector('.st-header-row');
    if (!tr) return;
    const hasDelete   = !!this.getAttribute('delete-api-url');
    const orderedCols = this._getOrderedCols();

    // Capture original column order on very first render (from attribute or auto-detect)
    if (!this._colOrderOriginal && orderedCols.length) {
      this._colOrderOriginal = this._columns.map(c => c.field);
    }

    // 6-dot grip SVG shown on header hover
    const grip = `<span class="st-col-grip" aria-hidden="true" title="Drag to reorder column">
      <svg width="9" height="13" viewBox="0 0 9 13" fill="currentColor">
        <circle cx="2" cy="2"   r="1.2"/><circle cx="7" cy="2"   r="1.2"/>
        <circle cx="2" cy="6.5" r="1.2"/><circle cx="7" cy="6.5" r="1.2"/>
        <circle cx="2" cy="11" r="1.2"/><circle cx="7" cy="11" r="1.2"/>
      </svg>
    </span>`;

    tr.innerHTML = orderedCols.map((c, idx) => {
      const sortable = c.sortable !== false;
      const icon = this._sortField === c.field
        ? (this._sortDir === 'asc' ? '↑' : '↓') : '⇅';
      return `<th class="st-th st-th-draggable${sortable ? ' st-sortable' : ''}"
          data-field="${c.field}" data-col-idx="${idx}" draggable="true" scope="col">
        ${grip}
        <span class="st-th-label">${c.label || this._formatLabel(c.field)}</span>
        ${sortable ? `<span class="st-sort-icon" aria-hidden="true">${icon}</span>` : ''}
      </th>`;
    }).join('') + (hasDelete ? '<th class="st-th st-th-action" scope="col">Actions</th>' : '');

    // Sort on click (ignore if click was on the grip handle)
    tr.querySelectorAll('.st-sortable').forEach(th =>
      th.addEventListener('click', (e) => {
        if (e.target.closest('.st-col-grip')) return;
        this.handleSort(th.dataset.field);
      })
    );

    // Wire up drag-to-reorder
    this._setupColDrag(tr, orderedCols);
  }

  // ─── Column Drag-to-Reorder ─────────────────────────────────────────────────
  //
  // Uses native HTML5 drag-and-drop on <th> elements only.
  // Only this._columns order is mutated on drop — raw data arrays (_data,
  // _clientData, _filteredData) are never touched, so all modes (server,
  // client, paginated, infinite, virtual, live WebSocket) stay correct.

  _setupColDrag(tr, orderedCols) {
    const ths = [...tr.querySelectorAll('.st-th-draggable')];
    let srcIdx = null;

    const clearIndicators = () =>
      ths.forEach(t => t.classList.remove('st-th-drop-before', 'st-th-drop-after'));

    ths.forEach((th, idx) => {
      // ── dragstart ──────────────────────────────────────────────────────────
      th.addEventListener('dragstart', (e) => {
        srcIdx = idx;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', th.dataset.field);
        requestAnimationFrame(() => th.classList.add('st-th-dragging'));
      });

      th.addEventListener('dragend', () => {
        th.classList.remove('st-th-dragging');
        clearIndicators();
        srcIdx = null;
      });

      // ── dragover — show left/right insertion indicator ────────────────────
      th.addEventListener('dragover', (e) => {
        if (srcIdx === null || srcIdx === idx) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        clearIndicators();
        const { left, width } = th.getBoundingClientRect();
        th.classList.add(e.clientX < left + width / 2 ? 'st-th-drop-before' : 'st-th-drop-after');
      });

      th.addEventListener('dragleave', () => {
        th.classList.remove('st-th-drop-before', 'st-th-drop-after');
      });

      // ── drop — commit the new order ───────────────────────────────────────
      th.addEventListener('drop', (e) => {
        e.preventDefault();
        if (srcIdx === null || srcIdx === idx) return;

        const { left, width } = th.getBoundingClientRect();
        const insertBefore    = e.clientX < left + width / 2;

        // Work on a copy of all columns (including hidden)
        const allCols   = [...this._columns];
        const srcCol    = orderedCols[srcIdx];
        const tgtCol    = orderedCols[idx];

        // Remove src from full array
        const srcAbsIdx = allCols.findIndex(c => c.field === srcCol.field);
        allCols.splice(srcAbsIdx, 1);

        // Find target in the modified array and insert
        const tgtAbsIdx = allCols.findIndex(c => c.field === tgtCol.field);
        allCols.splice(insertBefore ? tgtAbsIdx : tgtAbsIdx + 1, 0, srcCol);

        this._columns  = allCols;
        this._colOrder = allCols.filter(c => !c.hidden).map(c => c.field);

        // Notify external code (useful for persisting order to localStorage/API)
        this.dispatchEvent(new CustomEvent('column-reordered', {
          detail: { order: this.getColumnOrder() },
          bubbles: true,
        }));

        this.renderRows();
      });
    });
  }

  renderRows() {
    const tbody = this.querySelector('.st-tbody');
    if (!tbody) return;

    this.renderHeader();
    const displayData = this._getDisplayData();
    const visibleCols = this._getOrderedCols();
    const colCount = visibleCols.length + (this.getAttribute('delete-api-url') ? 1 : 0);

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
    this._updateCount(displayData.length);
  }

  _renderRow(row) {
    const deleteUrl = this.getAttribute('delete-api-url');
    const cells = this._getOrderedCols()
      .map(c => {
        const val = row[c.field];
        let tdClass = '';
        if (c.type === 'inline' && val !== null && typeof val === 'object' && !Array.isArray(val)) {
          tdClass = 'st-td-inline';
        } else if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
          tdClass = 'st-td-expand';
        }
        return `<td class="${tdClass}">${this._renderCell(row, c)}</td>`;
      }).join('');

    const del = deleteUrl
      ? `<td class="st-td-action">
           <button class="st-delete-btn" data-id="${row.id ?? JSON.stringify(row)}" aria-label="Delete row">
             <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
               <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
               <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
             </svg>
           </button>
         </td>`
      : '';

    return `<tr class="st-row" data-id="${row.id ?? ''}">${cells}${del}</tr>`;
  }

  // ─── Cell Rendering ──────────────────────────────────────────────────────────

  _renderCell(row, col) {
    const val = row[col.field];
    if (val == null) return '<span class="st-null">—</span>';

    if (col.type === 'badge') {
      return `<span class="st-badge ${this._badgeClass(col.field, val)}">${val}</span>`;
    }
    if (col.type === 'date') {
      try { return new Date(val).toLocaleDateString(); } catch { return String(val); }
    }
    if (col.type === 'dateFormatted') {
      return this._formatDateLong(val);
    }
    if (col.type === 'integer') {
      const n = Number(val);
      return isNaN(n) ? String(val) : n.toLocaleString();
    }
    if (col.type === 'image') {
      return `<img src="${val}" alt="" class="st-cell-img" loading="lazy">`;
    }
    if (typeof val === 'boolean') {
      return val
        ? '<span class="st-badge st-badge--yes">Yes</span>'
        : '<span class="st-badge st-badge--no">No</span>';
    }
    if (col.type === 'inline') {
      if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
        return this._renderInlineObject(val);
      }
      return String(val);
    }
    if (typeof val === 'object' && !Array.isArray(val)) {
      return this._renderSubObject(val);
    }
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
        const [y, m, d] = val.trim().split('-').map(Number);
        const dt    = new Date(Date.UTC(y, m - 1, d));
        const day   = String(dt.getUTCDate()).padStart(2, '0');
        const month = dt.toLocaleString('default', { month: 'long', timeZone: 'UTC' });
        return `${day} ${month}, ${dt.getUTCFullYear()}`;
      }
      const dt = new Date(val);
      if (isNaN(dt.getTime())) return String(val);
      const day   = String(dt.getDate()).padStart(2, '0');
      const month = dt.toLocaleString('default', { month: 'long' });
      return `${day} ${month}, ${dt.getFullYear()}`;
    } catch { return String(val); }
  }

  _renderSubObject(obj) {
    const rows = Object.entries(obj)
      .filter(([, v]) => v !== null && v !== undefined && typeof v !== 'object' && !Array.isArray(v))
      .map(([k, v]) => {
        const disp = typeof v === 'boolean'
          ? (v ? '<span class="st-badge st-badge--yes">Yes</span>' : '<span class="st-badge st-badge--no">No</span>')
          : String(v);
        return `<tr><td class="st-sub-key">${this._formatLabel(k)}</td><td class="st-sub-val">${disp}</td></tr>`;
      });
    if (!rows.length) return '<span class="st-null">—</span>';
    return `<table class="st-sub-table"><tbody>${rows.join('')}</tbody></table>`;
  }

  _renderInlineObject(obj) {
    const entries = Object.entries(obj)
      .filter(([, v]) => v !== null && v !== undefined
        && typeof v !== 'object' && !Array.isArray(v)
        && String(v).trim() !== '');

    if (!entries.length) return '<span class="st-null">—</span>';

    const headers = entries
      .map(([k]) => `<span class="st-inline-header-cell">${this._formatLabel(k)}</span>`)
      .join('');
    const values = entries
      .map(([, v]) => `<span class="st-inline-value-cell" title="${String(v)}">${String(v)}</span>`)
      .join('');

    return `<div class="st-inline-wrap">
      <div class="st-inline-header">${headers}</div>
      <div class="st-inline-values">${values}</div>
    </div>`;
  }

  // ─── Display Data ────────────────────────────────────────────────────────────

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

  // ─── Skeleton ────────────────────────────────────────────────────────────────

  _showSkeleton() {
    const tbody = this.querySelector('.st-tbody');
    if (!tbody) return;
    const cols = Math.max(this._getOrderedCols().length, 4);
    const row  = `<tr class="st-skel-row">${Array(cols).fill(
      '<td><div class="st-skeleton"></div></td>'
    ).join('')}</tr>`;
    tbody.innerHTML = Array(5).fill(row).join('');
  }

  _showError(msg) {
    const tbody = this.querySelector('.st-tbody');
    if (!tbody) return;
    const cols = Math.max(this._getOrderedCols().length, 1);
    tbody.innerHTML = `<tr><td colspan="${cols}">
      <div class="st-error">⚠ Failed to load: ${msg}</div></td></tr>`;
  }

  // ─── Search ──────────────────────────────────────────────────────────────────

  handleSearch(val) {
    clearTimeout(this._searchTimer);
    this._searchTimer = setTimeout(() => {
      this._searchQuery = val.trim();
      this._page = 1;
      if (this._mode === 'server' || this._mode === 'infinite') {
        this._data = [];
        this.fetchData();
      } else {
        this._applyAllFilters();
      }
    }, 300);
  }

  // ─── Sort ────────────────────────────────────────────────────────────────────

  handleSort(field) {
    this._sortDir  = this._sortField === field && this._sortDir === 'asc' ? 'desc' : 'asc';
    this._sortField = field;
    this._page = 1;

    if (this._mode === 'server' || this._mode === 'infinite') {
      this._data = [];
      this.fetchData();
      return;
    }

    this._showSkeleton();
    requestAnimationFrame(() => {
      this._filteredData.sort((a, b) => {
        const av = a[field], bv = b[field];
        if (av == null) return 1;
        if (bv == null) return -1;
        const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
        return this._sortDir === 'asc' ? cmp : -cmp;
      });
      this.renderRows();
    });
  }

  // ─── Pagination ──────────────────────────────────────────────────────────────

  handlePagination(page) {
    this._page = page;
    this._showSkeleton();
    requestAnimationFrame(() => {
      if (this._mode === 'server') { this.fetchData(); return; }
      this.renderRows();
      this._renderPagination();
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
    let s = Math.max(1, this._page - 3);
    let e = Math.min(pages, s + MAX - 1);
    if (e - s < MAX - 1) s = Math.max(1, e - MAX + 1);

    const btn = (p, lbl, dis, active) =>
      `<button class="st-page-btn${active ? ' st-page-btn--active' : ''}" data-page="${p}" ${dis ? 'disabled' : ''}>${lbl}</button>`;

    let html = btn(this._page - 1, '‹', this._page === 1, false);
    if (s > 1) html += btn(1, '1', false, false) + (s > 2 ? '<span class="st-ellipsis">…</span>' : '');
    for (let i = s; i <= e; i++) html += btn(i, i, false, i === this._page);
    if (e < pages) html += (e < pages - 1 ? '<span class="st-ellipsis">…</span>' : '') + btn(pages, pages, false, false);
    html += btn(this._page + 1, '›', this._page === pages, false);

    el.innerHTML = `<div class="st-pagination-inner">${html}</div>`;
    el.querySelectorAll('.st-page-btn').forEach(b =>
      b.addEventListener('click', () => this.handlePagination(parseInt(b.dataset.page)))
    );
  }

  // ─── Infinite Scroll ─────────────────────────────────────────────────────────

  handleInfiniteScroll() {
    if (this._loading || !this._hasMore) return;
    this._page++;
    this.fetchData(true);
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

  // ─── Virtual Scroll ──────────────────────────────────────────────────────────

  handleVirtualScroll(data) {
    const container = this.querySelector('.st-table-container');
    const tbody     = this.querySelector('.st-tbody');

    const paint = () => {
      const top   = container.scrollTop;
      const sIdx  = Math.max(0, Math.floor(top / this._ROW_HEIGHT) - 5);
      const eIdx  = Math.min(data.length, sIdx + this._VISIBLE_ROWS + 10);
      const tPad  = sIdx * this._ROW_HEIGHT;
      const bPad  = (data.length - eIdx) * this._ROW_HEIGHT;
      tbody.innerHTML = `
        <tr style="height:${tPad}px"></tr>
        ${data.slice(sIdx, eIdx).map(r => this._renderRow(r)).join('')}
        <tr style="height:${bPad}px"></tr>`;
      this._attachDeleteListeners();
      this._updateCount(data.length);
    };

    container.style.maxHeight = `${this._ROW_HEIGHT * this._VISIBLE_ROWS + 60}px`;
    container.addEventListener('scroll', paint, { passive: true });
    paint();
  }

  // ─── Delete ──────────────────────────────────────────────────────────────────

  _attachDeleteListeners() {
    this.querySelectorAll('.st-delete-btn').forEach(btn =>
      btn.addEventListener('click', () => this._requestDelete(btn.dataset.id))
    );
  }

  _requestDelete(id) {
    this._deleteRowId = id;
    const evt = new CustomEvent('smart-confirm', {
      detail: {
        title:        'Delete Row?',
        message:      'This action cannot be undone.',
        confirmLabel: 'Delete',
        cancelLabel:  'Cancel',
        onConfirm: () => this._performDelete(),
        onCancel:  () => { this._deleteRowId = null; },
      },
      cancelable: true,
    });
    const notHandled = window.dispatchEvent(evt);
    if (notHandled) {
      if (window.confirm('Are you sure you want to delete this row?')) {
        this._performDelete();
      } else {
        this._deleteRowId = null;
      }
    }
  }

  async _performDelete() {
    if (!this._deleteRowId) return;
    const id = this._deleteRowId;
    this._deleteRowId = null;
    const deleteUrl = this.getAttribute('delete-api-url');

    const rowEl = this.querySelector(`tr[data-id="${id}"]`);
    if (rowEl) rowEl.style.cssText += 'transition:opacity .28s,transform .28s;opacity:0;transform:translateX(-12px)';

    try {
      let fetchCfg = {};
      try { const r = this.getAttribute('fetch-config'); if (r) fetchCfg = JSON.parse(r); } catch {}
      const headers = {};
      for (const [k, v] of Object.entries(fetchCfg.headers || {})) {
        headers[k] = (v === 'auto') ? this._readCsrf() : v;
      }

      const res = await fetch(`${deleteUrl}/${id}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      if (rowEl) setTimeout(() => rowEl.remove(), 280);

      const rm = r => String(r.id) !== id;
      this._data         = this._data.filter(rm);
      this._clientData   = this._clientData.filter(rm);
      this._filteredData = this._filteredData.filter(rm);

      window.dispatchEvent(new CustomEvent('smart-toast', {
        detail: { message: 'Row deleted successfully.', type: 'success', duration: 3000 }
      }));
      this.dispatchEvent(new CustomEvent('row-deleted', { detail: { id } }));

    } catch (err) {
      if (rowEl) { rowEl.style.opacity = ''; rowEl.style.transform = ''; }
      window.dispatchEvent(new CustomEvent('smart-toast', {
        detail: { message: `Delete failed: ${err.message}`, type: 'error', duration: 3000 }
      }));
      console.error('[SmartTable] Delete error:', err);
    }
  }

  _openModal()  {}
  _closeModal() {}
  deleteRow()   {}


  // ─── Styles ──────────────────────────────────────────────────────────────────

  _injectStyles() {
    if (document.getElementById('smart-table-styles')) return;
    const s = document.createElement('style');
    s.id = 'smart-table-styles';
    s.textContent = `
      /* ══════════════════════════════════════════════════════
         SMART TABLE  —  scoped CSS
         ALL rules are prefixed with "smart-table" so they
         always win over page-level Bootstrap / docs styles.
         ══════════════════════════════════════════════════════ */

      smart-table {
        display: block;
        width: 100%; max-width: 100%; min-width: 0;
        box-sizing: border-box;
        font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
      }

      smart-table,
      smart-table[data-st-theme="light"] {
        --st-bg:          #ffffff;
        --st-surface:     #f7f8fc;
        --st-border:      #e4e6f0;
        --st-border-row:  #eef0f8;
        --st-text:        #1e2340;
        --st-text-muted:  #8890b4;
        --st-text-head:   #5a6290;
        --st-hover:       #f0f2fc;
        --st-stripe:      #fafbff;
        --st-input-bg:    #f3f5fb;
        --st-ring:        rgba(100,116,240,.18);
        --st-primary:     #6474f0;
        --st-primary-fg:  #ffffff;
        --st-shimmer-a:   #e8eaf4;
        --st-shimmer-b:   #f5f6fd;
        --st-modal-bg:    #ffffff;
        --st-overlay:     rgba(30,40,120,.22);
        --st-chip-ring:   #6474f0;
        --st-del-bg:      #fff5f8; --st-del-fg: #c83050;
        --st-del-bd:      rgba(200,48,80,.3);
        --st-del-hv:      #ffe0e8;
        --st-toast-ok-bg: #e6faf0; --st-toast-ok-fg: #1a6a42; --st-toast-ok-bd: #b0e8c8;
        --st-toast-er-bg: #fdeef2; --st-toast-er-fg: #b02848; --st-toast-er-bd: #f5b8c8;
        color-scheme: light;
      }

      smart-table[data-st-theme="dark"] {
        --st-bg:          #181b2e;
        --st-surface:     #20243a;
        --st-border:      #2c3050;
        --st-border-row:  #242848;
        --st-text:        #c4c8e8;
        --st-text-muted:  #5c6488;
        --st-text-head:   #848cb8;
        --st-hover:       #262a44;
        --st-stripe:      #1e2236;
        --st-input-bg:    #20243a;
        --st-ring:        rgba(130,148,255,.22);
        --st-primary:     #818cf8;
        --st-primary-fg:  #ffffff;
        --st-shimmer-a:   #222640;
        --st-shimmer-b:   #2c3050;
        --st-modal-bg:    #20243a;
        --st-overlay:     rgba(5,8,25,.65);
        --st-chip-ring:   #818cf8;
        --st-del-bg:      #2e1a22; --st-del-fg: #f090a8;
        --st-del-bd:      #5a2838;
        --st-del-hv:      #3e1a28;
        --st-toast-ok-bg: #0a2018; --st-toast-ok-fg: #6ecf98; --st-toast-ok-bd: #1a4a30;
        --st-toast-er-bg: #2a0e18; --st-toast-er-fg: #f090a8; --st-toast-er-bd: #4a1828;
        color-scheme: dark;
      }

      smart-table .st-wrapper {
        position: relative;
        overflow: hidden;
        max-width: 100%;
      }

      smart-table .st-toolbar {
        display: flex; align-items: center;
        justify-content: space-between;
        gap: 1rem; margin-bottom: .55rem;
      }
      smart-table .st-search-wrap { position: relative; display: inline-flex; align-items: center; }
      smart-table .st-search-icon {
        position: absolute; left: 9px; width: 14px; height: 14px;
        color: var(--st-text-muted); pointer-events: none;
      }
      smart-table .st-search {
        padding: .36rem .75rem .36rem 1.9rem;
        border-radius: 9px;
        border: 1.5px solid var(--st-border);
        background: var(--st-input-bg);
        color: var(--st-text);
        font-size: .84rem; width: 230px;
        outline: none;
        transition: border-color .18s, box-shadow .18s;
      }
      smart-table .st-search::placeholder { color: var(--st-text-muted); }
      smart-table .st-search:focus { border-color: var(--st-primary); box-shadow: 0 0 0 3px var(--st-ring); }
      smart-table .st-count { font-size: .76rem; color: var(--st-text-muted); white-space: nowrap; }

      smart-table .st-filter-bar { display: flex; flex-direction: column; gap: .38rem; margin-bottom: .55rem; }
      smart-table .st-filter-row { display: flex; align-items: center; flex-wrap: wrap; gap: .3rem; }
      smart-table .st-filter-label {
        font-size: .69rem; font-weight: 700; color: var(--st-text-muted);
        text-transform: uppercase; letter-spacing: .06em;
        margin-right: 2px; white-space: nowrap;
      }
      smart-table .st-filter-chip {
        cursor: pointer; border: 1.5px solid transparent;
        opacity: .72; transition: opacity .12s, transform .12s, box-shadow .12s; padding: 2px 9px;
      }
      smart-table .st-filter-chip:hover { opacity: 1; transform: translateY(-1px); }
      smart-table .st-filter-chip--active {
        opacity: 1; transform: translateY(-1px);
        box-shadow: 0 0 0 2.5px var(--st-chip-ring);
      }
      smart-table .st-filter-clear {
        font-size: .7rem; padding: 2px 8px; border-radius: 6px;
        border: 1.5px solid var(--st-border);
        background: transparent; color: var(--st-text-muted);
        cursor: pointer; transition: background .12s, color .12s;
      }
      smart-table .st-filter-clear:hover { background: var(--st-hover); color: var(--st-text); }

      smart-table .st-scroll-wrap {
        width: 100%; overflow-x: auto; overflow-y: visible;
        -webkit-overflow-scrolling: touch;
        border-radius: 12px;
        border: 1.5px solid var(--st-border);
        background: var(--st-bg);
        box-sizing: border-box;
      }
      smart-table .st-table-container {
        overflow-y: auto; overflow-x: visible;
        max-height: 520px; position: relative;
      }
      smart-table .st-table {
        width: max-content; min-width: 100%;
        border-collapse: collapse; font-size: .855rem;
        background: var(--st-bg); table-layout: auto;
      }

      smart-table .st-thead { position: sticky; top: 0; z-index: 3; }
      smart-table .st-th {
        font-weight: 600; font-size: .71rem;
        text-transform: uppercase; letter-spacing: .055em;
        color: var(--st-text-head);
        background: var(--st-surface);
        border-bottom: 2px solid var(--st-border);
        white-space: nowrap; padding: .62rem 1rem;
        cursor: default; user-select: none;
      }
      smart-table .st-th-action { text-align: center; width: 60px; }
      smart-table .st-sortable { cursor: pointer; }
      smart-table .st-sortable:hover { background: var(--st-hover); color: var(--st-text); }
      smart-table .st-sort-icon { margin-left: 4px; opacity: .35; font-size: .63rem; vertical-align: middle; }

      smart-table .st-table tbody tr { transition: background-color .1s; }
      smart-table .st-table tbody td {
        vertical-align: middle;
        padding: .52rem 1rem;
        border-bottom: 1px solid var(--st-border-row);
        color: var(--st-text);
        white-space: nowrap;
        background: var(--st-bg);
      }
      smart-table .st-table tbody .st-row:nth-child(even) td { background: var(--st-stripe); }
      smart-table .st-table tbody .st-row:hover td            { background: var(--st-hover); }
      smart-table .st-table tbody .st-row:nth-child(even):hover td { background: var(--st-hover); }

      smart-table .st-td-expand { white-space: normal; min-width: 180px; }
      smart-table .st-td-action { text-align: center; }
      smart-table .st-null { color: var(--st-text-muted); }

      smart-table .st-skel-row td { padding: .66rem 1rem; background: var(--st-bg); }
      smart-table .st-skeleton {
        height: 13px; border-radius: 6px;
        background: linear-gradient(90deg,
          var(--st-shimmer-a) 25%, var(--st-shimmer-b) 50%, var(--st-shimmer-a) 75%);
        background-size: 300% 100%;
        animation: st-shimmer 1.5s ease-in-out infinite;
      }
      @keyframes st-shimmer {
        0%   { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }

      smart-table .st-empty {
        display: flex; flex-direction: column; align-items: center; gap: .55rem;
        padding: 3rem 1rem; color: var(--st-text-muted);
        font-size: .86rem; text-align: center;
      }
      smart-table .st-error { padding: 2.5rem 1rem; text-align: center; font-size: .86rem; color: #e07080; }

      smart-table .st-pagination { margin-top: .72rem; }
      smart-table .st-pagination-inner { display: flex; gap: 4px; flex-wrap: wrap; align-items: center; }
      smart-table .st-page-btn {
        padding: 3px 10px; font-size: .78rem; border-radius: 7px;
        border: 1.5px solid var(--st-border);
        background: var(--st-input-bg); color: var(--st-text);
        cursor: pointer; line-height: 1.6;
        transition: background .12s, border-color .12s, color .12s;
      }
      smart-table .st-page-btn:hover:not(:disabled) {
        background: var(--st-hover); border-color: var(--st-primary); color: var(--st-primary);
      }
      smart-table .st-page-btn:disabled { opacity: .35; cursor: default; }
      smart-table .st-page-btn--active {
        background: var(--st-primary); border-color: var(--st-primary);
        color: var(--st-primary-fg); font-weight: 600;
      }
      smart-table .st-page-btn--active:hover:not(:disabled) {
        background: var(--st-primary); color: var(--st-primary-fg);
      }
      smart-table .st-ellipsis { padding: 0 5px; color: var(--st-text-muted); line-height: 28px; }

      smart-table .st-sentinel { height: 1px; }
      smart-table .st-cell-img {
        width: 34px; height: 34px; object-fit: cover;
        border-radius: 6px; border: 1.5px solid var(--st-border); display: block;
      }
      smart-table .st-delete-btn {
        padding: 4px 8px; border-radius: 7px;
        border: 1.5px solid var(--st-del-bd);
        background: var(--st-del-bg); color: var(--st-del-fg);
        cursor: pointer; transition: background .12s;
      }
      smart-table .st-delete-btn:hover { background: var(--st-del-hv); }

      smart-table .st-modal-overlay {
        position: absolute; inset: 0; background: var(--st-overlay);
        display: flex; align-items: center; justify-content: center;
        z-index: 100; border-radius: 12px; backdrop-filter: blur(4px);
      }
      smart-table .st-modal {
        background: var(--st-modal-bg); border-radius: 12px; padding: 1.4rem;
        max-width: 290px; width: 90%;
        box-shadow: 0 24px 64px rgba(0,0,0,.22);
        border: 1.5px solid var(--st-border);
      }
      smart-table .st-modal-body p { margin: 0 0 1rem; font-size: .9rem; color: var(--st-text); }
      smart-table .st-modal-footer { display: flex; gap: 8px; justify-content: flex-end; }
      smart-table .st-btn {
        padding: 5px 14px; border-radius: 7px; font-size: .82rem;
        cursor: pointer; border: 1.5px solid; transition: background .12s;
      }
      smart-table .st-btn-cancel {
        border-color: var(--st-border); background: var(--st-surface); color: var(--st-text);
      }
      smart-table .st-btn-cancel:hover { background: var(--st-hover); }
      smart-table .st-btn-confirm {
        border-color: var(--st-del-bd); background: var(--st-del-bg); color: var(--st-del-fg);
      }
      smart-table .st-btn-confirm:hover { background: var(--st-del-hv); }

      smart-table .st-toast {
        position: absolute; bottom: 1rem; right: 1rem;
        padding: .4rem 1rem; border-radius: 9px;
        font-size: .82rem; font-weight: 500;
        opacity: 0; transform: translateY(8px);
        transition: opacity .22s, transform .22s;
        pointer-events: none; z-index: 200;
        max-width: 300px; border: 1.5px solid transparent;
      }
      smart-table .st-toast-show { opacity: 1; transform: translateY(0); }
      smart-table .st-toast-success {
        background: var(--st-toast-ok-bg); color: var(--st-toast-ok-fg); border-color: var(--st-toast-ok-bd);
      }
      smart-table .st-toast-danger {
        background: var(--st-toast-er-bg); color: var(--st-toast-er-fg); border-color: var(--st-toast-er-bd);
      }

      /* ── PASTEL BADGE SYSTEM ─────────────────────────────────────────────── */
      smart-table .st-badge {
        display: inline-flex; align-items: center; justify-content: center;
        padding: 2px 9px; border-radius: 6px;
        font-size: .71rem; font-weight: 600;
        letter-spacing: .025em; white-space: nowrap;
        border: 1px solid transparent; line-height: 1.5; cursor: default;
      }
      smart-table .st-badge--yes     { background:#dcfce7; color:#15803d; border-color:#bbf7d0; }
      smart-table .st-badge--no      { background:#fee2e2; color:#b91c1c; border-color:#fecaca; }
      smart-table .st-badge--warn    { background:#fef9c3; color:#a16207; border-color:#fde68a; }
      smart-table .st-badge--info    { background:#dbeafe; color:#1d4ed8; border-color:#bfdbfe; }
      smart-table .st-badge--purple  { background:#f3e8ff; color:#7e22ce; border-color:#e9d5ff; }
      smart-table .st-badge--neutral { background:#f1f5f9; color:#475569; border-color:#e2e8f0; }
      smart-table .st-badge--p0 { background:#fce7f3; color:#9d174d; border-color:#fbcfe8; }
      smart-table .st-badge--p1 { background:#ffedd5; color:#c2410c; border-color:#fed7aa; }
      smart-table .st-badge--p2 { background:#ecfdf5; color:#065f46; border-color:#a7f3d0; }
      smart-table .st-badge--p3 { background:#eff6ff; color:#1e3a8a; border-color:#bfdbfe; }
      smart-table .st-badge--p4 { background:#fdf4ff; color:#7e22ce; border-color:#f0abfc; }
      smart-table .st-badge--p5 { background:#f0fdfa; color:#134e4a; border-color:#99f6e4; }
      smart-table .st-badge--p6 { background:#fff7ed; color:#9a3412; border-color:#fdba74; }
      smart-table .st-badge--p7 { background:#eef2ff; color:#3730a3; border-color:#c7d2fe; }

      smart-table[data-st-theme="dark"] .st-badge--yes     { background:#052e16; color:#4ade80; border-color:#166534; }
      smart-table[data-st-theme="dark"] .st-badge--no      { background:#2d0a0a; color:#f87171; border-color:#991b1b; }
      smart-table[data-st-theme="dark"] .st-badge--warn    { background:#1c1400; color:#fde047; border-color:#a16207; }
      smart-table[data-st-theme="dark"] .st-badge--info    { background:#060e22; color:#60a5fa; border-color:#1d4ed8; }
      smart-table[data-st-theme="dark"] .st-badge--purple  { background:#1c0a2a; color:#c084fc; border-color:#7e22ce; }
      smart-table[data-st-theme="dark"] .st-badge--neutral { background:#1a1f2e; color:#94a3b8; border-color:#334155; }
      smart-table[data-st-theme="dark"] .st-badge--p0 { background:#2d0a1e; color:#f9a8d4; border-color:#9d174d; }
      smart-table[data-st-theme="dark"] .st-badge--p1 { background:#2d1200; color:#fdba74; border-color:#c2410c; }
      smart-table[data-st-theme="dark"] .st-badge--p2 { background:#021c12; color:#34d399; border-color:#065f46; }
      smart-table[data-st-theme="dark"] .st-badge--p3 { background:#080e28; color:#93c5fd; border-color:#1e3a8a; }
      smart-table[data-st-theme="dark"] .st-badge--p4 { background:#1e0028; color:#e879f9; border-color:#7e22ce; }
      smart-table[data-st-theme="dark"] .st-badge--p5 { background:#021a18; color:#2dd4bf; border-color:#134e4a; }
      smart-table[data-st-theme="dark"] .st-badge--p6 { background:#1e0c00; color:#fb923c; border-color:#9a3412; }
      smart-table[data-st-theme="dark"] .st-badge--p7 { background:#0c0e28; color:#a5b4fc; border-color:#3730a3; }

      /* ── type:"inline" ───────────────────────────────────────────────────── */
      smart-table .st-inline-wrap { display:flex; flex-direction:column; gap:0; min-width:0; }
      smart-table .st-inline-header { display:flex; gap:0; border-bottom:1.5px solid var(--st-border); margin-bottom:2px; }
      smart-table .st-inline-header-cell {
        flex:1 1 0; font-size:.65rem; font-weight:700;
        text-transform:uppercase; letter-spacing:.06em;
        color:var(--st-text-muted); padding:2px 6px 3px;
        white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
      }
      smart-table .st-inline-values { display:flex; gap:0; }
      smart-table .st-inline-value-cell {
        flex:1 1 0; font-size:.8rem; color:var(--st-text);
        padding:2px 6px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
      }
      smart-table .st-td-inline { white-space:normal; min-width:280px; max-width:480px; }

      /* ── Sub-table ───────────────────────────────────────────────────────── */
      smart-table .st-sub-table { width:100%; border-collapse:collapse; font-size:.775rem; background:transparent; }
      smart-table .st-sub-table tr + tr td { border-top:1px solid var(--st-border-row); }
      smart-table .st-sub-key { color:var(--st-text-muted); font-weight:500; white-space:nowrap; padding:2px 10px 2px 0; vertical-align:top; width:1%; }
      smart-table .st-sub-val { color:var(--st-text); padding:2px 0; word-break:break-word; white-space:normal; }

      /* ── Column drag-to-reorder ──────────────────────────────────────────── */
      smart-table .st-th-draggable { user-select: none; }

      /* Grip icon — hidden until header hover */
      smart-table .st-col-grip {
        display: inline-flex;
        align-items: center;
        opacity: 0;
        margin-right: 5px;
        vertical-align: middle;
        cursor: grab;
        color: var(--st-text-muted);
        transition: opacity .15s;
        flex-shrink: 0;
      }
      smart-table .st-th-draggable:hover .st-col-grip { opacity: 1; }
      smart-table .st-th-draggable:active             { cursor: grabbing; }

      /* The column being dragged fades out */
      smart-table .st-th-dragging { opacity: .35; }

      /* Insertion point indicators — coloured left/right border */
      smart-table .st-th-drop-before { box-shadow: -2.5px 0 0 0 var(--st-primary) inset !important; }
      smart-table .st-th-drop-after  { box-shadow:  2.5px 0 0 0 var(--st-primary) inset !important; }
    `;
    document.head.appendChild(s);
  }
}

customElements.define('smart-table', SmartTable);