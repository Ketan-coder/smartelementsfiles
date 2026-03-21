/**
 * smart-filter-bar.js  — v1.0
 *
 * A declarative, standalone filter bar that dispatches CustomEvents to
 * communicate with <smart-table> (or any listener) — no direct DOM coupling.
 *
 * ARCHITECTURE RULES
 * ─────────────────────────────────────────────────────────────────
 * • Works completely independently — no dependency on SmartTable.
 * • Never fetches data itself — only dispatches events.
 * • Does not reference any other custom element directly.
 * • Safe to load in any order; no uncaught errors.
 *
 * USAGE
 * ─────────────────────────────────────────────────────────────────
 * <smart-filter-bar target="myTable" auto-apply>
 *
 *   <!-- Date input -->
 *   <smart-input name="from_date" label="From" type="date"></smart-input>
 *
 *   <!-- Select input (options via JSON attribute) -->
 *   <smart-input name="status" label="Status" type="select"
 *     options='[{"value":"","label":"All"},{"value":"active","label":"Active"}]'>
 *   </smart-input>
 *
 *   <!-- Text search -->
 *   <smart-input name="q" label="Search" type="text"></smart-input>
 *
 *   <smart-button action="apply">Apply</smart-button>
 *   <smart-button action="reset">Reset</smart-button>
 *
 * </smart-filter-bar>
 *
 * ATTRIBUTES (smart-filter-bar)
 *   target      — id of the <smart-table> to filter (required)
 *   auto-apply  — if present, dispatches on every input change (debounced 300ms)
 *
 * ATTRIBUTES (smart-input)
 *   name        — field name (used as key in the filter object)
 *   label       — display label
 *   type        — text (default) | date | select | number | email
 *   placeholder — input placeholder
 *   options     — JSON array of {value, label} objects (select only)
 *   value       — initial value
 *
 * ATTRIBUTES (smart-button)
 *   action      — "apply" | "reset"
 */

// ─────────────────────────────────────────────────────────────────────────────
// Style injection — runs once
// ─────────────────────────────────────────────────────────────────────────────
function injectFilterBarStyles() {
  if (document.getElementById('smart-filter-bar-styles')) return;
  const s = document.createElement('style');
  s.id = 'smart-filter-bar-styles';
  s.textContent = `
    /* ── Host ──────────────────────────────────────────────────────── */
    smart-filter-bar {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 12px;
      padding: 14px 16px;
      background: var(--sfb-bg, #f7f8fc);
      border: 1.5px solid var(--sfb-border, #e4e6f0);
      border-radius: 12px;
      font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
      box-sizing: border-box;
    }
    @media (prefers-color-scheme: dark) {
      smart-filter-bar {
        --sfb-bg:      #20243a;
        --sfb-border:  #2c3050;
        --sfb-text:    #c4c8e8;
        --sfb-muted:   #848cb8;
        --sfb-input-bg:#181b2e;
        --sfb-ring:    rgba(130,148,255,.22);
        --sfb-primary: #818cf8;
      }
    }
    smart-filter-bar[data-theme="dark"] {
      --sfb-bg:      #20243a;
      --sfb-border:  #2c3050;
      --sfb-text:    #c4c8e8;
      --sfb-muted:   #848cb8;
      --sfb-input-bg:#181b2e;
      --sfb-ring:    rgba(130,148,255,.22);
      --sfb-primary: #818cf8;
    }
    smart-filter-bar[data-theme="light"] {
      --sfb-bg:      #f7f8fc;
      --sfb-border:  #e4e6f0;
      --sfb-text:    #1e2340;
      --sfb-muted:   #8890b4;
      --sfb-input-bg:#ffffff;
      --sfb-ring:    rgba(100,116,240,.18);
      --sfb-primary: #6474f0;
    }

    /* ── smart-input ───────────────────────────────────────────────── */
    smart-input {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 140px;
      flex: 1 1 140px;
      max-width: 260px;
    }
    smart-input .sfb-label {
      font-size: .69rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .06em;
      color: var(--sfb-muted, #8890b4);
      user-select: none;
    }
    smart-input .sfb-control {
      width: 100%;
      padding: .35rem .65rem;
      border-radius: 8px;
      border: 1.5px solid var(--sfb-border, #e4e6f0);
      background: var(--sfb-input-bg, #fff);
      color: var(--sfb-text, #1e2340);
      font-size: .84rem;
      font-family: inherit;
      outline: none;
      box-sizing: border-box;
      transition: border-color .18s, box-shadow .18s;
      appearance: auto;
    }
    smart-input .sfb-control:focus {
      border-color: var(--sfb-primary, #6474f0);
      box-shadow: 0 0 0 3px var(--sfb-ring, rgba(100,116,240,.18));
    }
    smart-input .sfb-control::placeholder { color: var(--sfb-muted, #8890b4); }

    /* ── smart-button ──────────────────────────────────────────────── */
    smart-button {
      display: inline-flex;
      align-items: flex-end;
    }
    smart-button .sfb-btn {
      padding: .38rem 1.1rem;
      border-radius: 8px;
      border: 1.5px solid;
      font-size: .84rem;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      line-height: 1.5;
      transition: background .12s, transform .1s, box-shadow .12s;
      white-space: nowrap;
    }
    smart-button .sfb-btn:active { transform: scale(.97); }
    smart-button[action="apply"] .sfb-btn {
      background: var(--sfb-primary, #6474f0);
      border-color: var(--sfb-primary, #6474f0);
      color: #fff;
      box-shadow: 0 2px 8px rgba(100,116,240,.25);
    }
    smart-button[action="apply"] .sfb-btn:hover {
      filter: brightness(1.1);
      box-shadow: 0 4px 12px rgba(100,116,240,.35);
    }
    smart-button[action="reset"] .sfb-btn {
      background: transparent;
      border-color: var(--sfb-border, #e4e6f0);
      color: var(--sfb-muted, #8890b4);
    }
    smart-button[action="reset"] .sfb-btn:hover {
      background: var(--sfb-border, #e4e6f0);
      color: var(--sfb-text, #1e2340);
    }
  `;
  document.head.appendChild(s);
}


// ═════════════════════════════════════════════════════════════════════════════
//  <smart-input>
//  Renders a labelled input or select inside the filter bar.
// ═════════════════════════════════════════════════════════════════════════════

// class SmartInput extends HTMLElement {
//   static get observedAttributes() {
//     return ['name', 'label', 'type', 'placeholder', 'options', 'value'];
//   }

//   connectedCallback() {
//     injectFilterBarStyles();
//     this._render();
//     this._syncTheme();
//   }

//   attributeChangedCallback() {
//     if (this.isConnected) this._render();
//   }

//   /** Returns current value of the internal control */
//   get value() {
//     const ctrl = this.querySelector('.sfb-control');
//     return ctrl ? ctrl.value : '';
//   }

//   /** Programmatically set the value */
//   set value(v) {
//     const ctrl = this.querySelector('.sfb-control');
//     if (ctrl) ctrl.value = v;
//   }

//   /** Resets value to empty string */
//   reset() { this.value = ''; }

//   _render() {
//     const name        = this.getAttribute('name') || '';
//     const label       = this.getAttribute('label') || name;
//     const type        = this.getAttribute('type')  || 'text';
//     const placeholder = this.getAttribute('placeholder') || '';
//     const initVal     = this.getAttribute('value') || '';

//     let controlHTML;
//     if (type === 'select') {
//       let opts = [];
//       try { opts = JSON.parse(this.getAttribute('options') || '[]'); } catch {}
//       const optsHTML = opts.map(o =>
//         `<option value="${this._esc(o.value)}"${o.value === initVal ? ' selected' : ''}>${this._esc(o.label)}</option>`
//       ).join('');
//       controlHTML = `<select class="sfb-control" name="${this._esc(name)}">${optsHTML}</select>`;
//     } else {
//       controlHTML = `<input class="sfb-control" type="${this._esc(type)}"
//         name="${this._esc(name)}"
//         placeholder="${this._esc(placeholder)}"
//         value="${this._esc(initVal)}" />`;
//     }

//     this.innerHTML = `
//       ${label ? `<span class="sfb-label">${this._esc(label)}</span>` : ''}
//       ${controlHTML}
//     `;

//     // Bubble 'change' event upward so <smart-filter-bar> can catch it for auto-apply
//     const ctrl = this.querySelector('.sfb-control');
//     if (ctrl) {
//       ctrl.addEventListener('input',  () => this._bubble());
//       ctrl.addEventListener('change', () => this._bubble());
//     }
//   }

//   _bubble() {
//     this.dispatchEvent(new Event('sfb-input-change', { bubbles: true, composed: true }));
//   }

//   _syncTheme() {
//     // Inherit theme from parent filter bar if set
//     const bar = this.closest('smart-filter-bar');
//     if (bar && bar.dataset.theme) this.dataset.theme = bar.dataset.theme;
//   }

//   _esc(str) {
//     return String(str || '')
//       .replace(/&/g,'&amp;').replace(/</g,'&lt;')
//       .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
//   }
// }

// customElements.define('smart-input', SmartInput);


// ═════════════════════════════════════════════════════════════════════════════
//  <smart-button>
//  Renders an action button inside the filter bar.
// ═════════════════════════════════════════════════════════════════════════════

// class SmartButton extends HTMLElement {
//   connectedCallback() {
//     injectFilterBarStyles();
//     this._render();
//   }

//   _render() {
//     const label = this.textContent.trim() || (this.getAttribute('action') === 'apply' ? 'Apply' : 'Reset');
//     // Preserve slot text but wrap in our styled button
//     this.innerHTML = `<button class="sfb-btn" type="button">${label}</button>`;
//     this.querySelector('.sfb-btn').addEventListener('click', () => {
//       // Dispatch a bubbling action event that <smart-filter-bar> catches
//       this.dispatchEvent(new CustomEvent('sfb-action', {
//         detail: { action: this.getAttribute('action') },
//         bubbles: true,
//         composed: true,
//       }));
//     });
//   }
// }

// customElements.define('smart-button', SmartButton);


// ═════════════════════════════════════════════════════════════════════════════
//  <smart-filter-bar>
// ═════════════════════════════════════════════════════════════════════════════

class SmartFilterBar extends HTMLElement {
  static get observedAttributes() { return ['target', 'auto-apply']; }

  connectedCallback() {
    injectFilterBarStyles();
    this._debounceTimer = null;
    this._syncTheme();

    // Listen for input changes from child smart-inputs (for auto-apply)
    this.addEventListener('sfb-input-change', () => {
      if (!this.hasAttribute('auto-apply')) return;
      clearTimeout(this._debounceTimer);
      this._debounceTimer = setTimeout(() => this._dispatch(), 300);
    });

    // Listen for button actions (apply / reset)
    this.addEventListener('sfb-action', (e) => {
      const action = e.detail && e.detail.action;
      if (action === 'apply') this._dispatch();
      if (action === 'reset') this._reset();
    });

    // Watch body class changes to sync theme (docs-page dark/light toggle)
    this._bodyObserver = new MutationObserver(() => this._syncTheme());
    this._bodyObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  disconnectedCallback() {
    clearTimeout(this._debounceTimer);
    if (this._bodyObserver) this._bodyObserver.disconnect();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Returns collected filter values as a plain object */
  getValues() {
    const result = {};
    this.querySelectorAll('smart-input').forEach(input => {
      const name = input.getAttribute('name');
      if (!name) return;
      const val = input.value;
      // Only include non-empty values — empty string means "no filter"
      result[name] = val;
    });
    return result;
  }

  /** Programmatically trigger the filter dispatch */
  apply() { this._dispatch(); }

  /** Programmatically reset all inputs */
  reset() { this._reset(); }

  // ── Internal ───────────────────────────────────────────────────────────────

  _dispatch() {
    const target = this.getAttribute('target');
    if (!target) {
      console.error('[SmartFilterBar] Required attribute "target" is missing.');
      return;
    }

    const filters = this.getValues();

    // ── SmartState integration ──────────────────────────────────────────────
    // Each filter value is also pushed into smartState so other components
    // (e.g. <smart-chart state-listen="status">) can react to filter changes.
    if (window.smartState) {
      const stateKey = this.getAttribute('state-key');

      if (stateKey) {
        // Option A: write the entire filter object under a single key
        window.smartState.set(stateKey, filters);
      } else {
        // Option B (default): write each filter field individually
        // e.g. smartState.set("status", "active"), smartState.set("q", "foo")
        window.smartState.batch(() => {
          Object.entries(filters).forEach(([k, v]) => window.smartState.set(k, v));
        });
      }
    }

    // Guard: if the target table doesn't exist, do nothing (no error)
    // The event still dispatches — it's just not handled if no listener matches.
    window.dispatchEvent(new CustomEvent('smart-table-filter', {
      detail: { target, filters },
    }));
  }

  _reset() {
    // Reset all child inputs to empty
    this.querySelectorAll('smart-input').forEach(input => input.reset());

    // Dispatch with all-empty filters to clear the table filter
    const target = this.getAttribute('target');
    if (!target) return;

    const emptyFilters = {};
    this.querySelectorAll('smart-input').forEach(input => {
      const name = input.getAttribute('name');
      if (name) emptyFilters[name] = '';
    });

    // ── SmartState reset ────────────────────────────────────────────────────
    if (window.smartState) {
      const stateKey = this.getAttribute('state-key');
      if (stateKey) {
        window.smartState.set(stateKey, emptyFilters);
      } else {
        window.smartState.batch(() => {
          Object.keys(emptyFilters).forEach(k => window.smartState.set(k, ''));
        });
      }
    }

    window.dispatchEvent(new CustomEvent('smart-table-filter', {
      detail: { target, filters: emptyFilters },
    }));
  }

  _syncTheme() {
    // Mirror the docs-page theme toggle onto the filter bar and its children
    const bodyLight = document.body.classList.contains('light-mode');
    const theme = bodyLight ? 'light' : 'dark';
    this.dataset.theme = theme;
    this.querySelectorAll('smart-input').forEach(el => { el.dataset.theme = theme; });
  }
}

customElements.define('smart-filter-bar', SmartFilterBar);