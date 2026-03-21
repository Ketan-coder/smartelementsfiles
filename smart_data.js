/**
 * smart-data.js — v1.1
 * LOAD AS: <script src="smart-data.js"></script>  (NOT type="module")
 * Must be loaded AFTER smart-state.js.
 *
 * <smart-data key="sales" api="/api/sales/" refresh="30s" cache="5m"></smart-data>
 *
 * ATTRIBUTES
 *   key           — smartState key to store result under (required)
 *   api           — URL to fetch (required)
 *   refresh       — polling interval: "10s", "1m", "5m", "1h"
 *   cache         — skip re-fetch if data was loaded within this window
 *   response-path — dot-path into JSON: "results" unwraps DRF pagination
 *   method        — HTTP method (default: GET)
 *   headers       — JSON object of extra request headers
 *   csrftoken     — explicit CSRF token; auto-read from Django cookie if omitted
 *
 * EVENTS (dispatched on window)
 *   smart-data-loading  { key }
 *   smart-data-loaded   { key, data }
 *   smart-data-error    { key, error }
 */
(function () {
  'use strict';

  // Guard: define only once even if script is re-evaluated
  if (customElements.get('smart-data')) return;

  function parseMs(raw) {
    if (!raw) return 0;
    const m = String(raw).trim().match(/^(\d+(?:\.\d+)?)(s|m|h)?$/i);
    if (!m) return 0;
    return Math.round(parseFloat(m[1]) * ({ s: 1000, m: 60000, h: 3600000 }[( m[2] || 's').toLowerCase()] || 1000));
  }

  function dotGet(obj, path) {
    if (!path || obj == null) return obj;
    return path.split('.').reduce((a, p) => a == null ? null : a[p], obj);
  }

  class SmartData extends HTMLElement {
    static get observedAttributes() {
      return ['api', 'key', 'refresh', 'cache', 'response-path', 'method', 'headers'];
    }

    connectedCallback() {
      this.style.display = 'none';
      this._boot();
    }

    disconnectedCallback() {
      this._teardown();
    }

    attributeChangedCallback() {
      if (this.isConnected) { this._teardown(); this._boot(); }
    }

    _boot() {
      this._key     = this.getAttribute('key') || '';
      this._api     = this.getAttribute('api') || '';
      this._refreshMs = parseMs(this.getAttribute('refresh'));
      this._cacheMs   = parseMs(this.getAttribute('cache'));
      this._responsePath = this.getAttribute('response-path') || '';
      this._lastFetch = 0;
      this._pollTimer = null;
      this._ctrl      = null;

      if (!this._key) { console.warn('[SmartData] Missing "key" attribute.'); return; }
      if (!this._api) { console.warn('[SmartData] Missing "api" attribute.'); return; }

      this._fetch();
      if (this._refreshMs > 0) {
        this._pollTimer = setInterval(() => this._fetch(), this._refreshMs);
      }
    }

    _teardown() {
      if (this._pollTimer) { clearInterval(this._pollTimer); this._pollTimer = null; }
      if (this._ctrl) { this._ctrl.abort(); this._ctrl = null; }
    }

    refresh() { this._lastFetch = 0; this._fetch(); }
    getData()  { return window.smartState ? window.smartState.get(this._key) : null; }

    async _fetch() {
      if (this._cacheMs > 0 && this._lastFetch > 0 && (Date.now() - this._lastFetch) < this._cacheMs) return;

      if (this._ctrl) this._ctrl.abort();
      this._ctrl = new AbortController();

      this._emit('smart-data-loading', { key: this._key });

      try {
        const method = (this.getAttribute('method') || 'GET').toUpperCase();
        const extraHeaders = (() => { try { return JSON.parse(this.getAttribute('headers') || '{}'); } catch { return {}; } })();
        const opts = {
          method,
          signal: this._ctrl.signal,
          headers: { 'Accept': 'application/json', ...extraHeaders },
        };

        if (!['GET', 'HEAD'].includes(method)) {
          const csrf = this.getAttribute('csrftoken') || this._readCsrf();
          if (csrf) opts.headers['X-CSRFToken'] = csrf;
        }

        const res = await fetch(this._api, opts);
        if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + res.statusText);

        let data = await res.json();
        if (this._responsePath) data = dotGet(data, this._responsePath);

        this._lastFetch = Date.now();

        // Push to smartState — this is what smart-chart and smart-table subscribe to
        if (window.smartState) {
          window.smartState.set(this._key, data);
          window.smartState.set(this._key + '__meta', { loading: false, error: null, timestamp: this._lastFetch });
        }

        this._emit('smart-data-loaded', { key: this._key, data });

      } catch (err) {
        if (err.name === 'AbortError') return;
        if (window.smartState) {
          window.smartState.set(this._key + '__meta', { loading: false, error: err.message, timestamp: Date.now() });
        }
        this._emit('smart-data-error', { key: this._key, error: err.message });
        console.error('[SmartData key="' + this._key + '"] fetch failed:', err);
      }
    }

    _emit(type, detail) { window.dispatchEvent(new CustomEvent(type, { detail })); }

    _readCsrf() {
      try { const m = document.cookie.match(/csrftoken=([^;]+)/); return m ? m[1] : ''; } catch { return ''; }
    }
  }

  customElements.define('smart-data', SmartData);
}());