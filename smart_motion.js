/**
 * smart-motion.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Web Component: <smart-motion>
 * Purpose: Barba.js page transition engine with soothing, seamless transitions.
 *
 * Attributes:
 *   type="overlay | fade | slide | scale
 *         | panel-up | panel-down | panel-left | panel-right"
 *                                              — transition style (default: overlay)
 *   duration="number"                          — ms per half-transition (default: 400)
 *
 *   Note: bare type="panel" is aliased to "panel-up" for backward compat.
 *
 * Panel transitions (panel-*):
 *   Two-layer animated sweep using anime.js. A background accent layer and a
 *   main body-color layer slide in along the chosen axis, revealing the next
 *   page's title and a soft progress bar. Layers exit in reverse on enter.
 *   Falls back gracefully if anime.js is unavailable.
 *
 * Dispatched events (on window):
 *   smart-page-leave   → { namespace }
 *   smart-page-enter   → { namespace, container }
 *   smart-page-mounted → { namespace, container }
 *
 * Usage:
 *   <smart-motion type="panel-up" duration="600"></smart-motion>
 *
 * Requires: @barba/core (CDN). anime.js (CDN) recommended for panel types.
 * ─────────────────────────────────────────────────────────────────────────────
 */

class SmartMotion extends HTMLElement {

  // ── Observed attributes ────────────────────────────────────────────────────
  static get observedAttributes() {
    return ['type', 'duration'];
  }

  constructor() {
    super();

    /** @type {'overlay'|'fade'|'slide'|'scale'|'panel'|'panel-up'|'panel-down'|'panel-left'|'panel-right'} */
    this._type     = 'overlay';
    /** @type {number} */
    this._duration = 400;
    /** @type {HTMLElement|null} */
    this._overlay  = null;
    /** @type {boolean} */
    this._initialized = false;
    /** @type {Set<string>} tracks external scripts loaded this session */
    this._loadedExternalScripts = new Set();
  }

  // ── Lifecycle: connected ───────────────────────────────────────────────────
  connectedCallback() {
    this._type     = this.getAttribute('type')     || 'overlay';
    this._duration = parseInt(this.getAttribute('duration') || '400', 10);

    // Normalize bare "panel" → "panel-up" (backward-compat alias)
    if (this._type === 'panel') this._type = 'panel-up';

    // Hide the element itself — it's purely functional
    this.style.display = 'none';

    // Wait for DOM + Barba to be available
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this._init());
    } else {
      // Small rAF to let other scripts (including Barba's own init in base.html) settle
      requestAnimationFrame(() => this._init());
    }
  }

  // ── Lifecycle: attribute changed ───────────────────────────────────────────
  attributeChangedCallback(name, _old, value) {
    if (name === 'type') {
      this._type = value || 'overlay';
      if (this._type === 'panel') this._type = 'panel-up';
    }
    if (name === 'duration') this._duration = parseInt(value || '400', 10);
  }

  // ── Core init ──────────────────────────────────────────────────────────────
  _init() {
    if (this._initialized) return;

    if (typeof barba === 'undefined') {
      console.warn('[smart-motion] Barba.js not found. Make sure @barba/core is loaded.');
      return;
    }

    // Build the overlay element (used for overlay + slide type)
    this._buildOverlay();

    // Initialize Barba with our hook set
    this._initBarba();

    this._initialized = true;
    console.info(`[smart-motion] Initialized — type: ${this._type}, duration: ${this._duration}ms`);
  }

  // ── Overlay / Panel DOM element ────────────────────────────────────────────
  _buildOverlay() {
    const existing = document.getElementById('smart-motion-overlay');
    if (existing) existing.remove();
    const existingPanel = document.getElementById('smart-motion-panel');
    if (existingPanel) existingPanel.remove();

    const isPanel = this._type.startsWith('panel');

    if (isPanel) {
      // ── Two-layer animated panel (from reference animation) ─────────────────
      // Layer 1 — accent-tinted background sheet (slightly behind, arrives later)
      // Layer 2 — main body-colored sheet (foreground, has spinner + title)
      // Both layers animate in/out along the chosen axis.
      // Inject styles once
      if (!document.getElementById('sm-panel-style')) {
        const s = document.createElement('style');
        s.id = 'sm-panel-style';
        s.textContent = `
          #smart-motion-panel {
            position: fixed; top: 0; left: 0;
            width: 100%; height: 100vh;
            z-index: 99999; pointer-events: none;
            visibility: hidden;
          }
          .sm-panel-layer {
            position: absolute; inset: 0;
            will-change: transform;
          }
          .sm-panel-bg {
            background: var(--accent, var(--bs-primary, #6366f1));
            opacity: 0.13;
            z-index: 1;
          }
          .sm-panel-main {
            background: var(--bs-body-bg, #0f0f14);
            z-index: 2;
            display: flex; align-items: center;
            justify-content: center;
            box-shadow: 0 0 80px rgba(0,0,0,.4);
          }
          .sm-panel-content {
            text-align: center;
            opacity: 0;
            transform: translateY(14px);
          }
          .sm-panel-label {
            display: block;
            font-size: 1.2rem;
            font-weight: 300;
            letter-spacing: 2px;
            color: var(--bs-body-color, #e8e8f0);
            margin-bottom: 18px;
            font-family: inherit;
          }
          .sm-panel-bar-track {
            width: 140px; height: 2px;
            background: rgba(255,255,255,.1);
            border-radius: 2px;
            margin: 0 auto;
            overflow: hidden;
          }
          .sm-panel-bar-fill {
            height: 100%;
            width: 0%;
            background: var(--accent, var(--bs-primary, #6366f1));
            border-radius: 2px;
          }
          @keyframes sm-spin { to { transform: rotate(360deg); } }
        `;
        document.head.appendChild(s);
      }

      const panel = document.createElement('div');
      panel.id = 'smart-motion-panel';
      panel.innerHTML = `
        <div class="sm-panel-layer sm-panel-bg"></div>
        <div class="sm-panel-layer sm-panel-main">
          <div class="sm-panel-content">
            <span class="sm-panel-label">Loading…</span>
            <div class="sm-panel-bar-track">
              <div class="sm-panel-bar-fill"></div>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(panel);
      this._overlay = panel; // reuse _overlay ref for consistency

    } else {
      // ── Opacity overlay (overlay / fade / slide / scale types) ────────────
      const el = document.createElement('div');
      el.id = 'smart-motion-overlay';
      Object.assign(el.style, {
        position:      'fixed',
        inset:         '0',
        zIndex:        '99999',
        pointerEvents: 'none',
        opacity:       '0',
        background:    this._getOverlayColor(),
        transition:    `opacity ${this._duration}ms cubic-bezier(0.4,0,0.2,1)`,
        willChange:    'opacity',
      });
      document.body.appendChild(el);
      this._overlay = el;
    }
  }

  /** Returns a CSS color string for the overlay — respects BS dark theme */
  _getOverlayColor() {
    const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
    return isDark ? 'rgba(15, 15, 20, 0.92)' : 'rgba(255, 255, 255, 0.92)';
  }

  // ── Show / hide overlay ────────────────────────────────────────────────────
  _showOverlay() {
    if (!this._overlay) return Promise.resolve();
    this._overlay.style.pointerEvents = 'all';
    // Update color in case theme toggled
    this._overlay.style.background = this._getOverlayColor();
    this._overlay.style.opacity = '1';
    return this._wait(this._duration);
  }

  _hideOverlay() {
    if (!this._overlay) return Promise.resolve();
    this._overlay.style.opacity = '0';
    return this._wait(this._duration).then(() => {
      if (this._overlay) this._overlay.style.pointerEvents = 'none';
    });
  }

  // ── Promise-based delay ────────────────────────────────────────────────────
  _wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ── Transition hooks per type ──────────────────────────────────────────────
  /**
   * Returns { leave(data), enter(data) } promises for the current type.
   */
  _getHooks() {
    const dur = this._duration;

    const transitions = {
      // ── Overlay: block screen, swap, reveal ───────────────────────────────
      overlay: {
        leave: (data) => {
          return this._showOverlay();
        },
        enter: (data) => {
          return this._hideOverlay();
        },
      },

      // ── Fade: outgoing container fades out, incoming fades in ─────────────
      fade: {
        leave: (data) => {
          const el = data.current.container;
          el.style.transition = `opacity ${dur}ms ease`;
          el.style.opacity    = '0';
          return this._wait(dur);
        },
        enter: (data) => {
          const el = data.next.container;
          el.style.opacity    = '0';
          el.style.transition = `opacity ${dur}ms ease`;
          // Force reflow
          void el.offsetHeight;
          el.style.opacity = '1';
          return this._wait(dur);
        },
      },

      // ── Slide: outgoing slides up, incoming slides in from bottom ─────────
      slide: {
        leave: (data) => {
          this._showOverlay(); // still use overlay for polish
          const el = data.current.container;
          el.style.transition = `transform ${dur}ms cubic-bezier(0.4,0,0.2,1), opacity ${dur}ms ease`;
          el.style.transform  = 'translateY(-24px)';
          el.style.opacity    = '0';
          return this._wait(dur);
        },
        enter: (data) => {
          const el = data.next.container;
          el.style.transform  = 'translateY(24px)';
          el.style.opacity    = '0';
          el.style.transition = `transform ${dur}ms cubic-bezier(0.4,0,0.2,1), opacity ${dur}ms ease`;
          void el.offsetHeight;
          el.style.transform = 'translateY(0)';
          el.style.opacity   = '1';
          this._hideOverlay();
          return this._wait(dur);
        },
      },

      // ── Scale: zoom out on leave, zoom in on enter ────────────────────────
      scale: {
        leave: (data) => {
          const el = data.current.container;
          el.style.transformOrigin = 'center top';
          el.style.transition      = `transform ${dur}ms cubic-bezier(0.4,0,0.2,1), opacity ${dur}ms ease`;
          el.style.transform       = 'scale(0.95)';
          el.style.opacity         = '0';
          return this._wait(dur);
        },
        enter: (data) => {
          const el = data.next.container;
          el.style.transformOrigin = 'center top';
          el.style.transform       = 'scale(1.03)';
          el.style.opacity         = '0';
          el.style.transition      = `transform ${dur}ms cubic-bezier(0.4,0,0.2,1), opacity ${dur}ms ease`;
          void el.offsetHeight;
          el.style.transform = 'scale(1)';
          el.style.opacity   = '1';
          return this._wait(dur);
        },
      },

      // ── Panel variants: two-layer animated sweep, 4 directions ──────────────
      // Each variant shares the same mechanics — only the translate axis and
      // the direction the layers enter/exit changes.
      //
      // Anatomy of a panel transition:
      //   LEAVE:  bg layer slides in first (offset), main layer follows,
      //           content (title + progress bar) fades in once panels are on-screen.
      //   ENTER:  content fades out, main layer exits, bg layer exits last.
      //
      // The page title of the incoming page is shown inside the panel so the
      // user knows where they're going — informative + soothing.
      //
      // Requires: anime.js (already loaded in base.html via cdn)
      // Falls back to instant hide/show if anime is not available.
      'panel-up': this._makePanelHooks('Y', '100%', '-100%', dur),
      'panel-down': this._makePanelHooks('Y', '-100%', '100%', dur),
      'panel-left': this._makePanelHooks('X', '100%', '-100%', dur),
      'panel-right': this._makePanelHooks('X', '-100%', '100%', dur),
    };

    // All panel-* variants are created by _makePanelHooks above.
    // bare 'panel' is already aliased to 'panel-up' in connectedCallback.
    return transitions[this._type] || transitions.overlay;
  }

  // ── Shared panel hook factory ──────────────────────────────────────────────
  // axis:    'X' or 'Y'
  // inFrom:  translate value the layers start at when entering ('100%' / '-100%')
  // outTo:   translate value the layers end at when exiting
  // dur:     base duration in ms
  _makePanelHooks(axis, inFrom, outTo, dur) {
    const prop = `translate${axis}`;
    const self = this;

    return {
      // ── LEAVE: panel sweeps in, covering the outgoing page ─────────────────
      leave: (data) => {
        return new Promise(resolve => {
          const panel   = document.getElementById('smart-motion-panel');
          if (!panel) { resolve(); return; }

          const bg      = panel.querySelector('.sm-panel-bg');
          const main    = panel.querySelector('.sm-panel-main');
          const content = panel.querySelector('.sm-panel-content');
          const bar     = panel.querySelector('.sm-panel-bar-fill');
          const label   = panel.querySelector('.sm-panel-label');

          // Show next page's title inside the panel — informative
          const nextHtml = data.next?.html || '';
          const titleMatch = nextHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
          if (label && titleMatch) {
            label.textContent = titleMatch[1]
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/\s*[–—|·•]\s*.*/g, '') // strip site suffix like "— SmartComponents"
              .trim() || 'Loading…';
          }

          // Reset bar
          if (bar) bar.style.width = '0%';

          // Reset content
          if (content) {
            content.style.opacity   = '0';
            content.style.transform = `translate${axis === 'X' ? 'Y' : 'X'}(0px) translateY(14px)`;
          }

          panel.style.visibility   = 'visible';
          panel.style.pointerEvents = 'all';

          if (typeof anime !== 'undefined') {
            // Reset both layers to their off-screen start
            anime.set(bg,   { [prop]: inFrom, opacity: 0.13 });
            anime.set(main, { [prop]: inFrom });

            anime.timeline({ easing: 'easeInOutQuart' })
              // bg arrives a little after main (creates depth)
              .add({
                targets:  bg,
                [prop]:   [inFrom, '0%'],
                duration: Math.round(dur * 0.75),
                easing:   'easeOutQuart',
              }, 0)
              // main sweeps in, slightly offset behind bg
              .add({
                targets:  main,
                [prop]:   [inFrom, '0%'],
                duration: Math.round(dur * 0.9),
                easing:   'easeOutQuart',
              }, Math.round(dur * 0.1))
              // Once main is covering the screen, reveal the label + progress bar
              .add({
                targets:  content,
                opacity:  [0, 1],
                translateY: [14, 0],
                duration: 380,
                easing:   'easeOutCubic',
                begin: () => {
                  if (bar) {
                    anime({
                      targets:  bar,
                      width:    ['0%', '100%'],
                      duration: Math.round(dur * 1.4),
                      easing:   'easeOutQuint',
                    });
                  }
                },
                complete: resolve,
              }, Math.round(dur * 0.45));

          } else {
            // Fallback — no anime.js
            panel.style.visibility = 'visible';
            setTimeout(resolve, dur);
          }
        });
      },

      // ── ENTER: panel sweeps out, revealing the new page ────────────────────
      enter: (data) => {
        return new Promise(resolve => {
          const panel   = document.getElementById('smart-motion-panel');
          if (!panel) { resolve(); return; }

          const bg      = panel.querySelector('.sm-panel-bg');
          const main    = panel.querySelector('.sm-panel-main');
          const content = panel.querySelector('.sm-panel-content');

          if (typeof anime !== 'undefined') {
            anime.timeline({ easing: 'easeInOutQuart' })
              // Content fades out first
              .add({
                targets:    content,
                opacity:    [1, 0],
                translateY: [0, -10],
                duration:   260,
                easing:     'easeInCubic',
              }, 0)
              // Main exits
              .add({
                targets:  main,
                [prop]:   ['0%', outTo],
                duration: Math.round(dur * 0.85),
                easing:   'easeInOutQuart',
              }, 120)
              // bg exits last — slightly delayed for depth feel
              .add({
                targets:  bg,
                [prop]:   ['0%', outTo],
                duration: Math.round(dur * 0.7),
                easing:   'easeInQuart',
                complete: () => {
                  panel.style.visibility    = 'hidden';
                  panel.style.pointerEvents = 'none';
                  resolve();
                },
              }, Math.round(dur * 0.25));

          } else {
            panel.style.visibility    = 'hidden';
            panel.style.pointerEvents = 'none';
            resolve();
          }
        });
      },
    };
  }

  // ── Barba initialization ───────────────────────────────────────────────────
  _initBarba() {
    // Detect if Barba is already initialized by checking its internal store.
    // barba.history is an array on the CDN build — length > 0 means already inited.
    const alreadyInited = Array.isArray(barba.history)
      ? barba.history.length > 0
      : !!(barba.history && barba.history.current);

    if (alreadyInited) {
      console.info('[smart-motion] Barba already initialized elsewhere — attaching hooks only.');
      this._attachBarbaHooks();
      return;
    }

    const hooks = this._getHooks();

    barba.init({
      // ── prevent: guard against null el (popstate / programmatic navigation) ──
      prevent: ({ el, href }) => {
        // During popstate, el is null — bail early, let Barba handle it normally
        if (!el) return false;

        // Resolve href from el if not passed directly
        const rawHref = href || el.getAttribute('href') || '';
        if (!rawHref || rawHref.startsWith('#')) return true;

        // Skip data-no-barba
        if (el.hasAttribute('data-no-barba')) return true;

        try {
          const url = new URL(rawHref, location.origin);
          // Skip same-page anchors
          if (url.pathname === location.pathname && url.hash) return true;
          // Skip external links
          if (url.origin !== location.origin) return true;
        } catch (_) {
          // Malformed URL — let browser handle it
          return true;
        }

        return false;
      },

      transitions: [
        {
          name: `smart-motion-${this._type}`,

          // ── Leave ──────────────────────────────────────────────────────────
          leave: (data) => {
            const ns = data.current.namespace || '';
            window.dispatchEvent(new CustomEvent('smart-page-leave', { detail: { namespace: ns } }));
            return hooks.leave(data);
          },

          // ── Enter ──────────────────────────────────────────────────────────
          // NOTE: do NOT fire smart-page-enter here — the DOM swap isn't fully
          // committed yet. Fire it in `after` so effects run on the final DOM.
          enter: (data) => {
            return hooks.enter(data);
          },

          // ── After (DOM is final — run scripts, styles, events) ────────────
          after: (data) => {
            const ns        = data.next.namespace || '';
            const container = data.next.container;
            // Pass the raw HTML so _swapPageStyles can extract <head> styles
            const nextHtml  = data.next.html || '';
            this._onPageEnter(container, ns, nextHtml);
          },
        },
      ],
    });

    // Expose helpers so page scripts can call them manually (same API as base.html)
    window.barbaExecuteScripts = (container) => {
      this._onPageEnter(
        container || document.querySelector('[data-barba="container"]') || document,
        '',
        '' // no raw HTML available in manual calls — styles won't swap but scripts will
      );
    };
    window.barbaCleanup = (variableNames = []) => {
      variableNames.forEach(name => {
        try { delete window[name]; } catch (_) { window[name] = undefined; }
      });
    };

    // No extra afterEnter hook needed — after() above handles everything.
    // Adding one here would cause double scroll-reset and double event firing.
  }

  // ── After hook: scripts + styles + libraries + events ────────────────────
  // Called once after every navigation. Order matters — do not reorder.
  _onPageEnter(container, namespace, nextHtml) {
    // 1. Extract and inject <style> tags from the incoming page's <head>
    //    ({% block extra_head %} lives in <head>, outside the barba container)
    this._swapPageStyles(nextHtml);

    // 2. Fire DOMContentLoaded BEFORE executing scripts so that any page script
    //    that does addEventListener('DOMContentLoaded', fn) will catch it when
    //    it registers its listener inside step 3.
    document.dispatchEvent(new Event('DOMContentLoaded', {
      bubbles: true,
      cancelable: true,
    }));

    // 3. Re-run scripts found inside the new container
    this._executeScripts(container);

    // 4. Re-initialize Bootstrap + fire barba:afterEnter
    this._reinitLibraries(container);

    // 5. Scroll to top
    window.scrollTo({ top: 0, behavior: 'instant' });

    // 6. Dispatch smart-motion events (smart-effects listens to smart-page-enter)
    window.dispatchEvent(new CustomEvent('smart-page-enter', {
      detail: { namespace, container }
    }));
    window.dispatchEvent(new CustomEvent('smart-page-mounted', {
      detail: { namespace, container }
    }));
  }

  // ── Swap page-level styles from {% block extra_head %} ────────────────────
  // The styles are in <head> which Barba doesn't swap. We extract them from
  // data.next.html (the raw HTML string of the incoming page) and inject them.
  // Called with the raw HTML string from data.next.html, not the container.
  _swapPageStyles(nextHtml) {
    // Remove styles injected by the previous page
    document.querySelectorAll('style[data-barba-page], link[data-barba-page]')
      .forEach(el => el.remove());

    if (!nextHtml) return;

    // Parse the full incoming HTML to extract <head> styles
    // We only parse — we do NOT execute anything from it
    const parser = new DOMParser();
    const doc    = parser.parseFromString(nextHtml, 'text/html');

    // Grab every <style> and page-specific <link rel="stylesheet"> from <head>
    // Skip CDN links that are already globally loaded (identified by being the
    // same URLs already present in the live document head)
    const existingLinks = new Set(
      Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(l => l.href)
    );

    doc.head.querySelectorAll('style').forEach(node => {
      const clone = node.cloneNode(true);
      clone.setAttribute('data-barba-page', 'true');
      document.head.appendChild(clone);
    });

    doc.head.querySelectorAll('link[rel="stylesheet"]').forEach(node => {
      if (existingLinks.has(node.href)) return; // already loaded globally
      const clone = node.cloneNode(true);
      clone.setAttribute('data-barba-page', 'true');
      document.head.appendChild(clone);
    });
  }

  // ── Re-run <script> tags found inside the new container ───────────────────
  // Rules:
  //   CDN scripts (contain '://') → load once, never re-run (they're libraries)
  //   Local page scripts (relative or same-origin) → re-run on every navigation
  //     because they contain init logic (observers, event listeners, etc.)
  //   Inline scripts → always re-run (page-specific logic)
  _executeScripts(container) {
    this._cleanupPreviousScripts();

    container.querySelectorAll('script').forEach(script => {
      if (script.src) {
        const isCDN = /^https?:\/\/(?!(?:127\.0\.0\.1|localhost))/.test(script.src) &&
                      !script.src.includes(location.hostname);

        if (isCDN) {
          // Pure CDN library — load once, never reload
          if (!this._loadedExternalScripts.has(script.src)) {
            const el = document.createElement('script');
            el.src = script.src;
            if (script.type && script.type !== 'module') el.type = script.type;
            el.setAttribute('data-barba-added', 'true');
            document.head.appendChild(el);
            this._loadedExternalScripts.add(script.src);
          }
        } else {
          // Local/same-origin script (e.g. app.js, page-specific JS) —
          // re-execute on every navigation by appending with cache-bust
          const el = document.createElement('script');
          // Strip any existing ?v= cache bust and add a new one so the
          // browser actually re-fetches and re-executes it
          const url = new URL(script.src, location.origin);
          url.searchParams.set('_barba', Date.now());
          el.src = url.toString();
          if (script.type && script.type !== 'module') el.type = script.type;
          el.setAttribute('data-barba-added', 'true');
          document.body.appendChild(el);
        }
      } else if (script.textContent.trim()) {
        // Inline script — always re-run, wrapped in IIFE for scope isolation
        const el = document.createElement('script');
        el.setAttribute('data-barba-added', 'true');
        el.text = `(function(){\ntry{\n${script.textContent}\n}catch(e){console.warn('[smart-motion] Script error:',e);}\n})();`;
        document.body.appendChild(el);
        el.remove(); // already executed synchronously, remove the node
      }
    });
  }

  // ── Remove globals + injected script nodes from previous navigation ────────
  _cleanupPreviousScripts() {
    const commonGlobals = [
      'userScoreElement', 'globalToolbarOptions', 'quizData', 'courseData',
      'chartInstance', 'playerInstance', 'modalInstance',
    ];
    commonGlobals.forEach(name => {
      try { delete window[name]; } catch (_) { window[name] = undefined; }
    });
    document.querySelectorAll('script[data-barba-added]').forEach(s => s.remove());
    document.querySelectorAll('style[data-barba-added]').forEach(s => s.remove());
  }

  // ── Re-initialize Bootstrap + fire barba:afterEnter ───────────────────────
  _reinitLibraries(container) {
    if (typeof bootstrap !== 'undefined') {
      // Dispose stale tooltip/popover instances before re-creating
      document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => {
        bootstrap.Tooltip.getInstance(el)?.dispose();
      });
      document.querySelectorAll('[data-bs-toggle="popover"]').forEach(el => {
        bootstrap.Popover.getInstance(el)?.dispose();
      });

      // Re-init after a tick so Bootstrap finds the fully-painted DOM
      setTimeout(() => {
        document.querySelectorAll('[data-bs-toggle="tooltip"]')
          .forEach(el => { try { new bootstrap.Tooltip(el); } catch(_){} });
        document.querySelectorAll('[data-bs-toggle="popover"]')
          .forEach(el => { try { new bootstrap.Popover(el); } catch(_){} });
      }, 50);
    }

    // Fire barba:afterEnter for any page scripts that listen to it directly
    window.dispatchEvent(new CustomEvent('barba:afterEnter', {
      detail: { container }
    }));
  }

  // ── Re-init Bootstrap components after navigation (back-compat alias) ─────
  _reinitBootstrap(container) {
    this._reinitLibraries(container);
  }
}

// ── Register ───────────────────────────────────────────────────────────────
customElements.define('smart-motion', SmartMotion);