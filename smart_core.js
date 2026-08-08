/**
 * smart-core.js — v2.0
 * Foundation layer for the SmartComponents system.
 *
 * ── WHAT'S NEW IN v2 ────────────────────────────────────────────────────────
 * • SmartElement base class — all components extend this instead of HTMLElement.
 *   Provides _getMode, _getTheme, _applyTheme, _hide, _show — written once,
 *   inherited by every component. No duplication across files.
 *
 * • Shared CSS token system — --sc-* custom properties defined once on :root.
 *   Dark mode is a single [data-sc-theme="dark"] block that flips all tokens.
 *   Every component automatically gets dark mode by using var(--sc-*).
 *
 * • theme="auto|light|dark" attribute — works on all SmartComponents.
 *   auto (default): mirrors OS prefers-color-scheme, reacts to live changes.
 *   light / dark:   forces the theme regardless of OS setting.
 *   Bootstrap / custom styled components: theme attr is ignored cleanly.
 *
 * • Phosphor Icons injected once here — no component needs to do it.
 *
 * • @media (prefers-color-scheme: dark) removed from all component CSS.
 *   Dark mode is now entirely attribute-driven, predictable, and overridable.
 *
 * ── ARCHITECTURE RULES (unchanged from v1) ──────────────────────────────────
 * • All components listen on window via CustomEvents only.
 * • No component queries another component directly.
 * • Every other module works fine when this file is NOT loaded — graceful
 *   degradation throughout. SmartElement is exported to window so other
 *   modules can extend it when smart-core.js IS present, and fall back to
 *   HTMLElement when it is not.
 * • No uncaught errors, ever.
 *
 * ── TOKEN REFERENCE (--sc-* shared, --si-* / --sb-* component-specific) ────
 *
 *  --sc-font           system-ui stack
 *  --sc-radius         border radius (0.4rem)
 *  --sc-text           primary text colour
 *  --sc-text-muted     secondary / placeholder text
 *  --sc-bg             surface background
 *  --sc-bg-subtle      slightly off-surface (hover, stripe)
 *  --sc-border         border colour
 *  --sc-focus          focus ring / accent colour (indigo)
 *  --sc-focus-ring     semi-transparent focus halo
 *  --sc-error          error / destructive colour
 *  --sc-error-ring     semi-transparent error halo
 *  --sc-warning        warning colour
 *  --sc-success        success colour
 *  --sc-shadow-sm      small shadow
 *  --sc-shadow-md      medium shadow
 */

// ─────────────────────────────────────────────────────────────────────────────
//  Shared style + token injection — runs once, safe to call multiple times
// ─────────────────────────────────────────────────────────────────────────────

function injectSharedStyles() {
    if (document.getElementById('smart-core-styles')) return;

    // ── Phosphor Icons ───────────────────────────────────────────────────────
    // Only inject if developer hasn't already loaded Phosphor themselves
    const phLoaded =
        !!document.querySelector('script[src*="phosphor"]') ||
        !!document.querySelector('link[href*="phosphor"]');

    if (!phLoaded) {
        const base = 'https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.1/src';
        [
            { id: 'sc-ph-regular', href: `${base}/regular/style.css` },
            { id: 'sc-ph-fill',    href: `${base}/fill/style.css`    },
        ].forEach(({ id, href }) => {
            if (document.getElementById(id)) return;
            const link  = document.createElement('link');
            link.id     = id;
            link.rel    = 'stylesheet';
            link.type   = 'text/css';
            link.href   = href;
            document.head.appendChild(link);
        });
    }

    // ── Styles ───────────────────────────────────────────────────────────────
    const s = document.createElement('style');
    s.id = 'smart-core-styles';
    s.textContent = `

        /* ══════════════════════════════════════════════════════════════════
           SHARED TOKEN SYSTEM
           All SmartComponents read from these --sc-* variables.
           Override any token on :root to retheme the entire system.
           Override on a specific element to retheme just that component.
        ══════════════════════════════════════════════════════════════════ */

        :root {
            /* Typography */
            --sc-font:         system-ui, -apple-system, 'Segoe UI', sans-serif;
            --sc-font-size:    0.9375rem;
            --sc-font-weight:  500;

            /* Layout */
            --sc-radius:       0.4rem;
            --sc-radius-lg:    0.75rem;
            --sc-input-padding: 0.5rem 0.75rem;

            /* Colours — light theme defaults */
            --sc-text:         #1a1d23;
            --sc-text-muted:   #6b7280;
            --sc-bg:           #ffffff;
            --sc-bg-subtle:    #f3f4f6;
            --sc-border:       #e5e7eb;

            /* Accent / focus */
            --sc-focus:        #6366f1;
            --sc-focus-ring:   rgba(99, 102, 241, 0.18);

            /* Semantic */
            --sc-error:        #dc2626;
            --sc-error-ring:   rgba(220, 38, 38, 0.15);
            --sc-warning:      #d97706;
            --sc-success:      #16a34a;

            /* Tag / badge */
            --sc-tag-bg:       #6366f1;
            --sc-tag-text:     #ffffff;

            /* Shadows */
            --sc-shadow-sm:    0 1px 4px rgba(0,0,0,.08);
            --sc-shadow-md:    0 4px 20px rgba(0,0,0,.12), 0 1px 4px rgba(0,0,0,.08);
            --sc-shadow-lg:    0 24px 64px rgba(0,0,0,.22);

            /* Toast semantic backgrounds (light) */
            --sc-toast-success-bg:     #e8faf2;
            --sc-toast-success-text:   #145c38;
            --sc-toast-success-border: #b0e8c8;
            --sc-toast-error-bg:       #fdeef2;
            --sc-toast-error-text:     #a8203c;
            --sc-toast-error-border:   #f5b8c8;
            --sc-toast-warning-bg:     #fff8e6;
            --sc-toast-warning-text:   #92600a;
            --sc-toast-warning-border: #fde68a;
            --sc-toast-info-bg:        #eef3ff;
            --sc-toast-info-text:      #2a40a0;
            --sc-toast-info-border:    #c7d2fe;
            --sc-toast-loading-bg:     #f5f6fd;
            --sc-toast-loading-text:   #444c80;
            --sc-toast-loading-border: #d0d4f0;

            /* Modal (light) */
            --sc-modal-bg:         #ffffff;
            --sc-modal-border:     #e4e6f0;
            --sc-modal-text:       #1e2340;
            --sc-modal-subtext:    #5a6290;
            --sc-modal-icon-bg:    #fdeef2;
            --sc-modal-icon-border:#f5b8c8;
            --sc-modal-cancel-bg:  #f3f5fb;
            --sc-modal-confirm-bg: #fdeef2;
            --sc-modal-confirm-text: #a8203c;
            --sc-modal-confirm-border: #f5b8c8;
        }

        /* ── Dark token overrides ─────────────────────────────────────────────
           [data-sc-theme="dark"] can be placed on:
           • <body> or <html>  — themes the entire page
           • any wrapper <div> — themes just that section
           • a component element directly — themes just that component
           CSS custom properties cascade naturally to all descendants,
           so listing component names separately is unnecessary and harmful.
        ──────────────────────────────────────────────────────────────────── */

        [data-sc-theme="dark"] {
            --sc-text:         #e5e7eb;
            --sc-text-muted:   #9ca3af;
            --sc-bg:           #1f2937;
            --sc-bg-subtle:    #374151;
            --sc-border:       #4b5563;

            --sc-focus:        #818cf8;
            --sc-focus-ring:   rgba(129, 140, 248, 0.18);

            --sc-error:        #f87171;
            --sc-error-ring:   rgba(248, 113, 113, 0.15);
            --sc-warning:      #fbbf24;
            --sc-success:      #4ade80;

            /* Tag / badge */
            --sc-tag-bg:       #4f46e5;
            --sc-tag-text:     #ffffff;

            --sc-shadow-md:    0 4px 20px rgba(0,0,0,.4), 0 1px 4px rgba(0,0,0,.2);
            --sc-shadow-lg:    0 24px 64px rgba(0,0,0,.5);

            /* Toast semantic backgrounds (dark) */
            --sc-toast-success-bg:     #0a2018;
            --sc-toast-success-text:   #6ecf98;
            --sc-toast-success-border: #1a4a30;
            --sc-toast-error-bg:       #2a0e18;
            --sc-toast-error-text:     #f090a8;
            --sc-toast-error-border:   #4a1828;
            --sc-toast-warning-bg:     #1e1200;
            --sc-toast-warning-text:   #fde047;
            --sc-toast-warning-border: #a16207;
            --sc-toast-info-bg:        #080e28;
            --sc-toast-info-text:      #93c5fd;
            --sc-toast-info-border:    #1e3a8a;
            --sc-toast-loading-bg:     #1a1e32;
            --sc-toast-loading-text:   #9aa0d0;
            --sc-toast-loading-border: #2c3050;

            /* Modal (dark) */
            --sc-modal-bg:            #20243a;
            --sc-modal-border:        #2c3050;
            --sc-modal-text:          #c4c8e8;
            --sc-modal-subtext:       #848cb8;
            --sc-modal-icon-bg:       #2a0e18;
            --sc-modal-icon-border:   #4a1828;
            --sc-modal-cancel-bg:     #20243a;
            --sc-modal-confirm-bg:    #2a0e18;
            --sc-modal-confirm-text:  #f090a8;
            --sc-modal-confirm-border:#4a1828;
        }

        /* Apply surface colour only to page-level elements (body/html), not to components */
        body[data-sc-theme="dark"],
        html[data-sc-theme="dark"] {
            background-color: var(--sc-bg);
            color: var(--sc-text);
        }

        /* ── Light token overrides ────────────────────────────────────────────
           Explicit light theme — use when you need to force light inside a
           dark ancestor, or when setting data-sc-theme="light" on body/html.
        ──────────────────────────────────────────────────────────────────── */

        [data-sc-theme="light"] {
            --sc-text:         #1a1d23;
            --sc-text-muted:   #6b7280;
            --sc-bg:           #ffffff;
            --sc-bg-subtle:    #f3f4f6;
            --sc-border:       #e5e7eb;

            --sc-focus:        #6366f1;
            --sc-focus-ring:   rgba(99, 102, 241, 0.18);

            --sc-error:        #dc2626;
            --sc-error-ring:   rgba(220, 38, 38, 0.15);
            --sc-warning:      #d97706;
            --sc-success:      #16a34a;

            --sc-tag-bg:       #6366f1;
            --sc-tag-text:     #ffffff;

            --sc-shadow-md:    0 4px 20px rgba(0,0,0,.12), 0 1px 4px rgba(0,0,0,.08);
            --sc-shadow-lg:    0 24px 64px rgba(0,0,0,.22);

            --sc-toast-success-bg:     #e8faf2;
            --sc-toast-success-text:   #145c38;
            --sc-toast-success-border: #b0e8c8;
            --sc-toast-error-bg:       #fdeef2;
            --sc-toast-error-text:     #a8203c;
            --sc-toast-error-border:   #f5b8c8;
            --sc-toast-warning-bg:     #fff8e6;
            --sc-toast-warning-text:   #92600a;
            --sc-toast-warning-border: #fde68a;
            --sc-toast-info-bg:        #eef3ff;
            --sc-toast-info-text:      #2a40a0;
            --sc-toast-info-border:    #c7d2fe;
            --sc-toast-loading-bg:     #f5f6fd;
            --sc-toast-loading-text:   #444c80;
            --sc-toast-loading-border: #d0d4f0;

            --sc-modal-bg:            #ffffff;
            --sc-modal-border:        #e4e6f0;
            --sc-modal-text:          #1e2340;
            --sc-modal-subtext:       #5a6290;
            --sc-modal-icon-bg:       #fdeef2;
            --sc-modal-icon-border:   #f5b8c8;
            --sc-modal-cancel-bg:     #f3f5fb;
            --sc-modal-confirm-bg:    #fdeef2;
            --sc-modal-confirm-text:  #a8203c;
            --sc-modal-confirm-border:#f5b8c8;
        }

        /* Apply surface colour only to page-level elements (body/html), not to components */
        body[data-sc-theme="light"],
        html[data-sc-theme="light"] {
            background-color: var(--sc-bg);
            color: var(--sc-text);
        }

        /* ── Page-level background when theme is set on body/html ───────────── */
        /* Already handled by [data-sc-theme] blocks above via cascade */

        /* ── Utility ─────────────────────────────────────────────────────────── */
        .sc-hidden { display: none !important; }

        /* ══════════════════════════════════════════════════════════════════
           SMART-TOAST
        ══════════════════════════════════════════════════════════════════ */

        smart-toast {
            position: fixed; z-index: 9999;
            display: flex; flex-direction: column; gap: 8px;
            pointer-events: none;
            max-width: 360px; width: calc(100vw - 32px);
            box-sizing: border-box;
        }
        smart-toast[position="top-right"]     { top:16px;    right:16px;  align-items:flex-end; }
        smart-toast[position="top-left"]      { top:16px;    left:16px;   align-items:flex-start; }
        smart-toast[position="top-center"]    { top:16px;    left:50%;    transform:translateX(-50%); align-items:center; }
        smart-toast[position="bottom-right"]  { bottom:16px; right:16px;  align-items:flex-end;   flex-direction:column-reverse; }
        smart-toast[position="bottom-left"]   { bottom:16px; left:16px;   align-items:flex-start; flex-direction:column-reverse; }
        smart-toast[position="bottom-center"] { bottom:16px; left:50%;    transform:translateX(-50%); align-items:center; flex-direction:column-reverse; }

        .sc-toast-item {
            pointer-events: all;
            position: relative; overflow: hidden;
            display: flex; align-items: flex-start; gap: 10px;
            padding: 11px 14px; border-radius: 10px;
            border: 1.5px solid transparent;
            font-family: var(--sc-font, system-ui, sans-serif);
            font-size: .855rem; font-weight: 500; line-height: 1.45;
            max-width: 100%;
            box-shadow: var(--sc-shadow-md);
            cursor: default;
            opacity: 0; transform: translateY(6px) scale(.97);
            transition: opacity .22s ease, transform .22s ease;
        }
        .sc-toast-item.sc-toast-visible { opacity:1; transform:translateY(0) scale(1); }
        .sc-toast-item.sc-toast-out     { opacity:0; transform:translateY(-6px) scale(.97); transition:opacity .18s ease,transform .18s ease; }

        /* Toast colours — driven entirely by CSS tokens, no @media needed */
        .sc-toast-success { background: var(--sc-toast-success-bg); color: var(--sc-toast-success-text); border-color: var(--sc-toast-success-border); }
        .sc-toast-error   { background: var(--sc-toast-error-bg);   color: var(--sc-toast-error-text);   border-color: var(--sc-toast-error-border);   }
        .sc-toast-warning { background: var(--sc-toast-warning-bg); color: var(--sc-toast-warning-text); border-color: var(--sc-toast-warning-border); }
        .sc-toast-info    { background: var(--sc-toast-info-bg);    color: var(--sc-toast-info-text);    border-color: var(--sc-toast-info-border);    }
        .sc-toast-loading { background: var(--sc-toast-loading-bg); color: var(--sc-toast-loading-text); border-color: var(--sc-toast-loading-border); }

        .sc-toast-icon  { flex-shrink:0; font-size:1rem; line-height:1; margin-top:1px; }
        .sc-toast-body  { flex:1; min-width:0; word-break:break-word; }
        .sc-toast-close { flex-shrink:0; background:none; border:none; cursor:pointer; opacity:.5; font-size:1rem; line-height:1; padding:0 2px; color:inherit; transition:opacity .12s; }
        .sc-toast-close:hover { opacity:1; }
        .sc-toast-progress { position:absolute; bottom:0; left:0; height:2px; border-radius:0 0 10px 10px; background:currentColor; opacity:.3; transform-origin:left; }

        /* ══════════════════════════════════════════════════════════════════
           SMART-LOADER
        ══════════════════════════════════════════════════════════════════ */

        smart-loader { display: none; }
        .sc-loader-overlay {
            position: fixed; inset: 0; z-index: 9998;
            background: rgba(10,12,30,.55); backdrop-filter: blur(3px);
            display: flex; align-items: center; justify-content: center;
            opacity: 0; transition: opacity .18s ease;
        }
        .sc-loader-overlay.sc-loader-visible { opacity: 1; }
        .sc-loader-overlay.sc-loader-scoped  { position: absolute; border-radius: inherit; }
        .sc-spinner {
            width: 42px; height: 42px;
            border: 3px solid rgba(255,255,255,.2);
            border-top-color: var(--sc-focus, #818cf8);
            border-radius: 50%;
            animation: sc-spin .75s linear infinite;
        }
        @keyframes sc-spin { to { transform: rotate(360deg); } }

        /* ══════════════════════════════════════════════════════════════════
           SMART-MODAL
        ══════════════════════════════════════════════════════════════════ */

        smart-modal { display: contents; }
        .sc-modal-backdrop {
            position: fixed; inset: 0; z-index: 9997;
            background: rgba(10,12,30,.5); backdrop-filter: blur(4px);
            display: flex; align-items: center; justify-content: center;
            opacity: 0; pointer-events: none; transition: opacity .2s ease;
        }
        .sc-modal-backdrop.sc-modal-open { opacity:1; pointer-events:all; }

        .sc-modal-box {
            background: var(--sc-modal-bg, #fff);
            border: 1.5px solid var(--sc-modal-border, #e4e6f0);
            border-radius: 14px;
            padding: 1.6rem; max-width: 340px; width: 90%;
            box-shadow: var(--sc-shadow-lg);
            transform: translateY(10px) scale(.97);
            transition: transform .2s ease;
            font-family: var(--sc-font, system-ui, sans-serif);
            color: var(--sc-modal-text, #1e2340);
        }
        .sc-modal-backdrop.sc-modal-open .sc-modal-box { transform: translateY(0) scale(1); }

        .sc-modal-icon {
            width:44px; height:44px; border-radius:50%;
            background: var(--sc-modal-icon-bg, #fdeef2);
            border: 1.5px solid var(--sc-modal-icon-border, #f5b8c8);
            display:flex; align-items:center; justify-content:center;
            font-size:1.3rem; margin: 0 auto 1rem;
        }
        .sc-modal-title   { text-align:center; font-size:1rem; font-weight:700; margin:0 0 .4rem; color:inherit; }
        .sc-modal-message { text-align:center; font-size:.9rem; color: var(--sc-modal-subtext, #5a6290); margin:0 0 1.4rem; line-height:1.55; }
        .sc-modal-footer  { display:flex; gap:10px; justify-content:center; }
        .sc-modal-btn {
            flex:1; padding:8px 16px; border-radius:8px;
            font-size:.875rem; font-weight:600; cursor:pointer;
            border: 1.5px solid; transition: background .12s, transform .1s;
        }
        .sc-modal-btn:active { transform: scale(.97); }
        .sc-modal-cancel {
            background: var(--sc-modal-cancel-bg, #f3f5fb);
            border-color: var(--sc-modal-border, #e4e6f0);
            color: var(--sc-modal-text, #1e2340);
        }
        .sc-modal-cancel:hover  { filter: brightness(.95); }
        .sc-modal-confirm {
            background: var(--sc-modal-confirm-bg, #fdeef2);
            border-color: var(--sc-modal-confirm-border, #f5b8c8);
            color: var(--sc-modal-confirm-text, #a8203c);
        }
        .sc-modal-confirm:hover { filter: brightness(.93); }
    `;
    document.head.appendChild(s);
}


// ─────────────────────────────────────────────────────────────────────────────
//  SmartElement — base class for all SmartComponents
//
//  Extend this instead of HTMLElement to get:
//    • _getMode()    — reads styled= attribute ('bootstrap' | 'default')
//    • _getTheme()   — reads theme= attribute ('auto' | 'light' | 'dark')
//    • _applyTheme() — sets [data-sc-theme] + wires OS matchMedia for 'auto'
//    • _hide(el)     — adds sc-hidden class
//    • _show(el)     — removes sc-hidden class
//    • observedAttributes — reacts to styled= and theme= changes at runtime
//    • disconnectedCallback — cleans up matchMedia listener automatically
//
//  Graceful fallback for components loaded WITHOUT smart-core.js:
//    const Base = window.SmartElement ?? HTMLElement;
//    class SmartInput extends Base { ... }
// ─────────────────────────────────────────────────────────────────────────────

class SmartElement extends HTMLElement {

    // ── Mode ─────────────────────────────────────────────────────────────────

    /**
     * Returns the styling mode for this element.
     * 'bootstrap' — component uses Bootstrap classes, injects no styles.
     * 'default'   — component injects its own self-contained styles (zero deps).
     */
    _getMode() {
        const s = (this.getAttribute('styled') || '').toLowerCase().trim();
        return s === 'bootstrap' ? 'bootstrap' : 'default';
    }

    // ── Theme ─────────────────────────────────────────────────────────────────

    /**
     * Returns the requested theme.
     * Only meaningful in default mode — returns null for bootstrap mode.
     */
    _getTheme() {
        if (this._getMode() !== 'default') return null;
        const t = (this.getAttribute('theme') || 'auto').toLowerCase().trim();
        return ['light', 'dark', 'auto'].includes(t) ? t : 'auto';
    }

    /**
     * Sets [data-sc-theme] on this element based on the theme= attribute.
     *   light / dark → set immediately and statically
     *   auto (default) → mirrors OS prefers-color-scheme, updates live
     *
     * Safe to call multiple times — tears down the previous listener first.
     * Noop when styled="bootstrap".
     */
    _applyTheme() {
        if (this._getMode() !== 'default') return;

        // Tear down previous listeners
        if (this._scMqlHandler) {
            this._scMql?.removeEventListener('change', this._scMqlHandler);
            this._scMqlHandler = null;
            this._scMql        = null;
        }
        if (this._scObserver) {
            this._scObserver.disconnect();
            this._scObserver = null;
        }

        const theme = this._getTheme();

        // Explicit theme attribute on this element — apply and stop
        if (theme === 'light' || theme === 'dark') {
            this.dataset.scTheme = theme;
            return;
        }

        // theme === 'auto': resolve from ancestor → OS → default light
        // Always set up a MutationObserver on body so JS changes are caught
        // regardless of which path wins right now
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
        };

        // Watch body (and html) for attribute changes — covers JS toggle
        const targets = [document.body, document.documentElement].filter(Boolean);
        this._scObserver = new MutationObserver(_apply);
        targets.forEach(t => this._scObserver.observe(t, {
            attributes: true,
            attributeFilter: ['data-sc-theme']
        }));

        // Also watch OS preference
        this._scMql = window.matchMedia('(prefers-color-scheme: dark)');
        this._scMqlHandler = _apply;
        this._scMql.addEventListener('change', this._scMqlHandler);

        // Resolve immediately
        _apply();
    }

    // ── Visibility helpers ───────────────────────────────────────────────────

    /** Hides an element using the shared sc-hidden utility class. */
    _hide(el) {
        if (!el) return;
        el.classList.add('sc-hidden');
    }

    /** Shows an element hidden by sc-hidden. */
    _show(el) {
        if (!el) return;
        el.classList.remove('sc-hidden');
    }

    // ── Lifecycle ────────────────────────────────────────────────────────────

    static get observedAttributes() {
        return ['theme', 'styled'];
    }

    attributeChangedCallback(name) {
        // Re-apply theme reactively when theme= or styled= changes after mount
        if (name === 'theme' || name === 'styled') {
            this._applyTheme();
        }
    }

    disconnectedCallback() {
        if (this._scMqlHandler) {
            this._scMql?.removeEventListener('change', this._scMqlHandler);
            this._scMqlHandler = null;
            this._scMql        = null;
        }
        if (this._scObserver) {
            this._scObserver.disconnect();
            this._scObserver = null;
        }
    }
}

// Expose on window so other component files can extend it without importing
// Usage in other files:
//   const Base = window.SmartElement ?? HTMLElement;
//   class SmartInput extends Base { ... }
window.SmartElement = SmartElement;


// ═════════════════════════════════════════════════════════════════════════════
//  <smart-toast>
// ═════════════════════════════════════════════════════════════════════════════

class SmartToast extends SmartElement {
    connectedCallback() {
        injectSharedStyles();
        this._applyTheme();
        if (!this.getAttribute('position')) this.setAttribute('position', 'bottom-right');
        this._max    = parseInt(this.getAttribute('max') || '5', 10);
        this._toasts = [];
        this._handler = (e) => this._handle(e.detail);
        window.addEventListener('smart-toast', this._handler);
    }

    disconnectedCallback() {
        super.disconnectedCallback(); // cleans up matchMedia
        window.removeEventListener('smart-toast', this._handler);
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /** SmartToast.fire({ type, message, duration }) */
    static fire(detail) {
        window.dispatchEvent(new CustomEvent('smart-toast', { detail }));
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    _handle(detail) {
        if (!detail) return;
        if (detail.promise) {
            const item = this._create(detail.loading || 'Loading…', 'loading', 0);
            Promise.resolve(detail.promise).then(
                () => this._update(item, detail.success || 'Done!',   'success'),
                () => this._update(item, detail.error   || 'Failed.', 'error')
            );
            return;
        }
        this._create(detail.message || '', detail.type || 'info', detail.duration ?? 3000);
    }

    _create(message, type, duration) {
        while (this._toasts.length >= this._max) this._dismiss(this._toasts[0]);

        const ICONS = { success:'✓', error:'✕', warning:'⚠', info:'ℹ', loading:'⟳' };
        const el = document.createElement('div');
        el.className = `sc-toast-item sc-toast-${type}`;
        el.setAttribute('role', 'alert');
        el.setAttribute('aria-live', 'assertive');
        el.innerHTML = [
            `<span class="sc-toast-icon" aria-hidden="true">${ICONS[type] || 'ℹ'}</span>`,
            `<span class="sc-toast-body">${this._esc(message)}</span>`,
            `<button class="sc-toast-close" aria-label="Dismiss">✕</button>`,
            duration > 0 ? '<div class="sc-toast-progress"></div>' : '',
        ].join('');

        el.querySelector('.sc-toast-close').addEventListener('click', () => this._dismiss(el));
        el.addEventListener('mouseenter', () => clearTimeout(el._timer));
        el.addEventListener('mouseleave', () => {
            if (duration > 0) el._timer = setTimeout(() => this._dismiss(el), 1200);
        });

        this.appendChild(el);
        this._toasts.push(el);

        requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('sc-toast-visible')));

        if (duration > 0) {
            const bar = el.querySelector('.sc-toast-progress');
            if (bar) {
                bar.style.transition = `transform ${duration}ms linear`;
                requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.transform = 'scaleX(0)'; }));
            }
            el._timer = setTimeout(() => this._dismiss(el), duration);
        }

        return el;
    }

    _update(el, message, type) {
        if (!el || !el.isConnected) return;
        const ICONS = { success:'✓', error:'✕', warning:'⚠', info:'ℹ', loading:'⟳' };
        el.className = `sc-toast-item sc-toast-visible sc-toast-${type}`;
        el.querySelector('.sc-toast-icon').textContent = ICONS[type] || 'ℹ';
        el.querySelector('.sc-toast-body').textContent = message;
        clearTimeout(el._timer);
        el._timer = setTimeout(() => this._dismiss(el), 3000);
    }

    _dismiss(el) {
        if (!el || !el.isConnected) return;
        clearTimeout(el._timer);
        el.classList.remove('sc-toast-visible');
        el.classList.add('sc-toast-out');
        const remove = () => {
            el.remove();
            this._toasts = this._toasts.filter(t => t !== el);
        };
        el.addEventListener('transitionend', remove, { once: true });
        setTimeout(remove, 400);
    }

    _esc(str) {
        return String(str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
}

customElements.define('smart-toast', SmartToast);


// ═════════════════════════════════════════════════════════════════════════════
//  <smart-loader>
// ═════════════════════════════════════════════════════════════════════════════

class SmartLoader extends SmartElement {
    constructor() {
        super();
        this._counter  = 0;
        this._overlays = new Map();
        this._timers   = new Map();
    }

    connectedCallback() {
        injectSharedStyles();
        this._applyTheme();
        this._handler = (e) => this._handle(e.detail || {});
        window.addEventListener('smart-loader', this._handler);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        window.removeEventListener('smart-loader', this._handler);
        this._overlays.forEach(ov => ov.remove());
        this._timers.forEach(t => clearTimeout(t));
    }

    _handle({ action, scope } = {}) {
        const key = scope || '__global__';

        if (action === 'show') {
            this._counter++;
            if (!this._timers.has(key)) {
                this._timers.set(key, setTimeout(() => {
                    this._timers.delete(key);
                    this._show_overlay(key, scope);
                }, 200));
            }
        } else if (action === 'hide') {
            this._counter = Math.max(0, this._counter - 1);
            const t = this._timers.get(key);
            if (t) { clearTimeout(t); this._timers.delete(key); }
            if (this._counter === 0 || scope) this._hide_overlay(key, scope);
        }
    }

    // Renamed from _show/_hide to avoid collision with SmartElement helpers
    _show_overlay(key, scope) {
        if (this._overlays.has(key)) return;

        const ov = document.createElement('div');
        ov.className = 'sc-loader-overlay';
        ov.innerHTML = '<div class="sc-spinner" role="status" aria-label="Loading"></div>';

        if (scope) {
            const target = document.getElementById(scope);
            if (!target) return;
            const pos = getComputedStyle(target).position;
            if (!['relative','absolute','fixed','sticky'].includes(pos)) {
                target.dataset.scPrevPos = target.style.position;
                target.style.position = 'relative';
            }
            ov.classList.add('sc-loader-scoped');
            target.appendChild(ov);
        } else {
            document.body.appendChild(ov);
        }

        this._overlays.set(key, ov);
        requestAnimationFrame(() => requestAnimationFrame(() => ov.classList.add('sc-loader-visible')));
    }

    _hide_overlay(key, scope) {
        const ov = this._overlays.get(key);
        if (!ov) return;

        ov.classList.remove('sc-loader-visible');
        const cleanup = () => {
            if (scope) {
                const target = document.getElementById(scope);
                if (target && target.dataset.scPrevPos !== undefined) {
                    target.style.position = target.dataset.scPrevPos;
                    delete target.dataset.scPrevPos;
                }
            }
            ov.remove();
            this._overlays.delete(key);
        };
        ov.addEventListener('transitionend', cleanup, { once: true });
        setTimeout(cleanup, 400);
    }
}

customElements.define('smart-loader', SmartLoader);


// ═════════════════════════════════════════════════════════════════════════════
//  <smart-modal>
// ═════════════════════════════════════════════════════════════════════════════

class SmartModal extends SmartElement {
    connectedCallback() {
        injectSharedStyles();
        this._applyTheme();
        this._build();
        this._handler = (e) => this._handle(e);
        window.addEventListener('smart-confirm', this._handler);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        window.removeEventListener('smart-confirm', this._handler);
        if (this._keyHandler) document.removeEventListener('keydown', this._keyHandler);
        if (this._backdrop) this._backdrop.remove();
    }

    _build() {
        this._backdrop = document.createElement('div');
        this._backdrop.className = 'sc-modal-backdrop';
        this._backdrop.setAttribute('role', 'dialog');
        this._backdrop.setAttribute('aria-modal', 'true');
        this._backdrop.setAttribute('aria-labelledby', 'sc-modal-ttl');
        this._backdrop.innerHTML = `
            <div class="sc-modal-box">
                <div class="sc-modal-icon" aria-hidden="true"></div>
                <h2 class="sc-modal-title" id="sc-modal-ttl">Confirm</h2>
                <p  class="sc-modal-message">Are you sure?</p>
                <div class="sc-modal-footer">
                    <button class="sc-modal-btn sc-modal-cancel">Cancel</button>
                    <button class="sc-modal-btn sc-modal-confirm">Delete</button>
                </div>
            </div>`;

        document.body.appendChild(this._backdrop);

        this._backdrop.querySelector('.sc-modal-cancel').addEventListener('click',  () => this._close(false));
        this._backdrop.querySelector('.sc-modal-confirm').addEventListener('click', () => this._close(true));
        this._backdrop.addEventListener('click', (e) => { if (e.target === this._backdrop) this._close(false); });

        this._keyHandler = (e) => { if (e.key === 'Escape' && this._isOpen) this._close(false); };
        document.addEventListener('keydown', this._keyHandler);
        this._isOpen = false;
    }

    _handle(event) {
        const { message, title, confirmLabel, cancelLabel, onConfirm, onCancel, icon } = event.detail || {};
        event.preventDefault();

        this._onConfirm = typeof onConfirm === 'function' ? onConfirm : null;
        this._onCancel  = typeof onCancel  === 'function' ? onCancel  : null;

        const q = (sel) => this._backdrop.querySelector(sel);
        if (q('.sc-modal-message')) q('.sc-modal-message').textContent = message      || 'Are you sure?';
        if (q('.sc-modal-title'))   q('.sc-modal-title').textContent   = title        || 'Confirm';
        if (q('.sc-modal-confirm')) q('.sc-modal-confirm').textContent = confirmLabel || 'Delete';
        if (q('.sc-modal-cancel'))  q('.sc-modal-cancel').textContent  = cancelLabel  || 'Cancel';
        if (q('.sc-modal-icon'))    q('.sc-modal-icon').textContent    = icon         || '⚠';

        this._backdrop.classList.add('sc-modal-open');
        this._isOpen = true;

        setTimeout(() => { const b = q('.sc-modal-confirm'); if (b) b.focus(); }, 60);
    }

    _close(confirmed) {
        this._backdrop.classList.remove('sc-modal-open');
        this._isOpen = false;
        if (confirmed && this._onConfirm) {
            try { this._onConfirm(); } catch(e) { console.error('[SmartModal] onConfirm error:', e); }
        } else if (!confirmed && this._onCancel) {
            try { this._onCancel(); } catch(e) { console.error('[SmartModal] onCancel error:', e); }
        }
        this._onConfirm = null;
        this._onCancel  = null;
    }
}

customElements.define('smart-modal', SmartModal);