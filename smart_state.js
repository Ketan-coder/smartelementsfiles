/**
 * smart-state.js — v1.1
 * LOAD AS: <script src="smart-state.js"></script>  (NOT type="module")
 * Must be loaded BEFORE smart-data.js and smart-chart.js.
 *
 * Exposes window.smartState with:
 *   set(key, value)       — store value, notify subscribers, update DOM bindings
 *   get(key)              — read value
 *   subscribe(key, fn)    — fn(value, key) called on change
 *   watch(key, fn)        — alias for subscribe
 *   unsubscribe(key, fn)  — remove subscription
 *   persist(key)          — sync to localStorage
 *   urlSync(key)          — sync to URL ?params
 *   batch(fn)             — batch multiple set()s into one DOM flush
 *   reset(key)            — delete key and notify
 *   getAll()              — snapshot of all state
 */
(function (global) {
  'use strict';

  // Idempotent — don't re-init if already loaded
  if (global.smartState) return;

  const _store       = Object.create(null);
  const _subscribers = Object.create(null);
  const _persisted   = new Set();
  const _urlSynced   = new Set();
  let _batching      = false;
  let _batchKeys     = new Set();

  // ── Notify subscribers + update DOM ──────────────────────────────────────
  function _notify(key) {
    const subs = _subscribers[key];
    if (subs) subs.forEach(fn => {
      try { fn(_store[key], key); } catch (e) { console.error('[SmartState] subscriber error:', e); }
    });
    global.dispatchEvent(new CustomEvent('smart-state-change', {
      detail: { key, value: _store[key] }
    }));
    _updateBindings(key);
  }

  function _flushBatch() {
    _batching = false;
    const keys = [..._batchKeys];
    _batchKeys.clear();
    keys.forEach(_notify);
  }

  // ── DOM binding attributes ────────────────────────────────────────────────
  const ATTRS = ['state-text','state-html','state-show','state-class',
                 'state-style','state-disabled','state-value','state-attr'];

  function _parseBinding(raw) {
    if (!raw) return null;
    const idx = raw.indexOf(':');
    return idx === -1
      ? { key: raw.trim(), arg: null }
      : { key: raw.slice(0, idx).trim(), arg: raw.slice(idx + 1).trim() };
  }

  function _applyBinding(el, attr, value) {
    try {
      switch (attr) {
        case 'state-text':     el.textContent = value == null ? '' : String(value); break;
        case 'state-html':     el.innerHTML   = value == null ? '' : String(value); break;
        case 'state-show':     el.style.display = value ? '' : 'none'; break;
        case 'state-disabled': el.disabled = !!value; break;
        case 'state-value':    if (el.value !== undefined) el.value = value == null ? '' : String(value); break;
        case 'state-class': {
          const b = _parseBinding(el.getAttribute('state-class'));
          if (b && b.arg) el.classList.toggle(b.arg, !!value);
          break;
        }
        case 'state-style': {
          const b = _parseBinding(el.getAttribute('state-style'));
          if (b && b.arg) el.style[b.arg] = value == null ? '' : String(value);
          break;
        }
        case 'state-attr': {
          const b = _parseBinding(el.getAttribute('state-attr'));
          if (!b || !b.arg) break;
          if (value == null || value === false) el.removeAttribute(b.arg);
          else el.setAttribute(b.arg, value === true ? '' : String(value));
          break;
        }
      }
    } catch (e) { console.error('[SmartState] binding error:', e); }
  }

  function _updateBindings(key) {
    ATTRS.forEach(attr => {
      document.querySelectorAll('[' + attr + ']').forEach(el => {
        const raw = el.getAttribute(attr);
        const b = _parseBinding(raw);
        if (!b) return;
        const bindKey = (attr === 'state-class' || attr === 'state-style' || attr === 'state-attr') ? b.key : raw.trim();
        if (bindKey === key) _applyBinding(el, attr, _store[key]);
      });
    });
  }

  function _initAllBindings() {
    Object.keys(_store).forEach(key => _updateBindings(key));
  }

  function _startObserver() {
    if (!global.MutationObserver) return;
    new MutationObserver(mutations => {
      mutations.forEach(m => {
        m.addedNodes.forEach(node => {
          if (node.nodeType !== 1) return;
          ATTRS.forEach(attr => {
            const check = el => {
              if (!el.getAttribute) return;
              const raw = el.getAttribute(attr);
              if (!raw) return;
              const b = _parseBinding(raw);
              if (!b) return;
              if (b.key in _store) _applyBinding(el, attr, _store[b.key]);
            };
            check(node);
            if (node.querySelectorAll) node.querySelectorAll('[' + attr + ']').forEach(check);
          });
        });
      });
    }).observe(document.body || document.documentElement, { childList: true, subtree: true });
  }

  // ── localStorage helpers ──────────────────────────────────────────────────
  const LS = 'sc_state_';
  function _loadLS(key) {
    try { const v = localStorage.getItem(LS + key); if (v !== null) _store[key] = JSON.parse(v); } catch(e) {}
  }
  function _saveLS(key, val) {
    try { localStorage.setItem(LS + key, JSON.stringify(val)); } catch(e) {}
  }

  // ── URL helpers ───────────────────────────────────────────────────────────
  function _loadURL(key) {
    try {
      const p = new URLSearchParams(global.location.search);
      if (p.has(key)) { try { _store[key] = JSON.parse(p.get(key)); } catch { _store[key] = p.get(key); } }
    } catch(e) {}
  }
  function _saveURL(key, val) {
    try {
      const u = new URL(global.location.href);
      if (val == null || val === '') u.searchParams.delete(key);
      else u.searchParams.set(key, typeof val === 'object' ? JSON.stringify(val) : String(val));
      global.history.replaceState({}, '', u.toString());
    } catch(e) {}
  }

  // ── Public API ────────────────────────────────────────────────────────────
  global.smartState = {
    set(key, value) {
      if (typeof key !== 'string' || !key) return;
      _store[key] = value;
      if (_persisted.has(key)) _saveLS(key, value);
      if (_urlSynced.has(key)) _saveURL(key, value);
      if (_batching) { _batchKeys.add(key); }
      else { _notify(key); }
    },
    get(key)          { return _store[key]; },
    getAll()          { return Object.assign(Object.create(null), _store); },
    subscribe(key, fn){ if (typeof fn !== 'function') return; if (!_subscribers[key]) _subscribers[key] = new Set(); _subscribers[key].add(fn); },
    watch(key, fn)    { return this.subscribe(key, fn); },
    unsubscribe(key, fn){ if (_subscribers[key]) _subscribers[key].delete(fn); },
    persist(key)      { _persisted.add(key); _loadLS(key); },
    urlSync(key)      { _urlSynced.add(key); _loadURL(key); },
    batch(fn)         { _batching = true; try { fn(); } catch(e) { console.error('[SmartState] batch error:', e); } finally { _flushBatch(); } },
    reset(key)        {
      if (!(key in _store)) return;
      delete _store[key];
      if (_persisted.has(key)) { try { localStorage.removeItem(LS + key); } catch(e) {} }
      if (_urlSynced.has(key)) _saveURL(key, null);
      _notify(key);
    },
  };

  // ── Boot ──────────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { _initAllBindings(); _startObserver(); });
  } else {
    _initAllBindings(); _startObserver();
  }

}(window));