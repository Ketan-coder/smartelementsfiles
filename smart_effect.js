/**
 * smart-effects.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Web Component: <smart-effects>
 * Purpose: Anime.js animation engine — presets, auto-mode, scroll triggers,
 *          custom attribute-driven animations.
 *
 * Attributes:
 *   auto                  — auto-animate common elements with scroll observers
 *   type="preset-name"    — run a built-in preset (see PRESETS below)
 *   target="selector"     — CSS selector to animate
 *   trigger="page|scroll|hover|click|manual"  — when to fire (default: page)
 *   delay="number"        — stagger or initial delay in ms
 *   duration="number"     — animation duration in ms
 *   easing="string"       — Anime.js easing string
 *   translateX="number"   — from value (px)
 *   translateY="number"   — from value (px)
 *   scale="number"        — from value
 *   rotate="number"       — from value (deg)
 *   opacity="number"      — from value (0–1)
 *
 * Built-in presets:
 *   card-stagger  — cards rise and stagger in
 *   fade-up       — generic fade-up for any selector
 *   modal-pop     — modal dialogs scale in with spring
 *   sidebar-slide — sidebar enters from left
 *   table-stagger — table rows slide in from left
 *   button-click  — button scale micro-interaction
 *   input-focus   — focus ring pulse
 *   error-shake   — invalid field shake
 *   hero-enter    — h1/hero title soft rise
 *   headings      — h2/h3 cascade
 *   count-up      — [data-count] numbers animate to value
 *   badge-pop     — .badge/.tag spring in
 *   nav-links     — navbar items drop from above
 *   form-fields   — form groups stagger in
 *   alert-drop    — alerts drop from above
 *   image-grid    — images scale up from center
 *   timeline      — .timeline-item slide from left
 *
 * Auto mode (recommended — add just this one attribute):
 *   <smart-effects auto></smart-effects>
 *   Animates: h1, .lead, nav items, .card, table rows, badges, counters,
 *   images, .reveal, form fields, list items, sidebar, section headings.
 *   Above-fold items fire immediately; below-fold items use IntersectionObserver.
 *   Also wires click micro-feedback on .btn and .nav-link.
 *
 * Integration:
 *   - Listens to "smart-page-enter" from smart-motion.js
 *   - Works standalone if smart-motion is not loaded
 *
 * Requires: animejs ≥ 3.x (already loaded in base.html)
 * ─────────────────────────────────────────────────────────────────────────────
 */

class SmartEffects extends HTMLElement {

  // ── Observed attributes ────────────────────────────────────────────────────
  static get observedAttributes() {
    return [
      'auto', 'type', 'target', 'trigger',
      'delay', 'duration', 'easing',
      'translateX', 'translateY', 'scale', 'rotate', 'opacity',
    ];
  }

  // ── Built-in presets ───────────────────────────────────────────────────────
  /**
   * Presets return a function(scope) → anime config object or calls anime().
   * `scope` is the root element to search within (document or barba container).
   */
  static get PRESETS() {
    return {

      // Cards pop in with stagger
      'card-stagger': (scope) => ({
        targets: scope.querySelectorAll('.card:not([data-smart-animated])'),
        translateY: [40, 0],
        opacity: [0, 1],
        delay: anime.stagger(80, { start: 60 }),
        easing: 'easeOutCubic',
        duration: 700,
      }),

      // Generic fade-up (works on any selector passed via target attr)
      'fade-up': (scope, target = '.fade-up-item') => ({
        targets: scope.querySelectorAll(`${target}:not([data-smart-animated])`),
        translateY: [32, 0],
        opacity: [0, 1],
        delay: anime.stagger(70),
        easing: 'easeOutExpo',
        duration: 650,
      }),

      // Modal entrance
      'modal-pop': (scope) => ({
        targets: scope.querySelectorAll('.modal.show .modal-dialog, .modal-dialog:not([data-smart-animated])'),
        scale: [0.88, 1],
        opacity: [0, 1],
        easing: 'easeOutBack',
        duration: 380,
      }),

      // Sidebar slides in from the left
      'sidebar-slide': (scope) => ({
        targets: scope.querySelectorAll('.sidebar:not([data-smart-animated])'),
        translateX: [-300, 0],
        opacity: [0, 1],
        easing: 'easeOutBack',
        duration: 500,
      }),

      // Table rows stagger in
      'table-stagger': (scope) => ({
        targets: scope.querySelectorAll('table tr:not([data-smart-animated])'),
        translateX: [-16, 0],
        opacity: [0, 1],
        delay: anime.stagger(40),
        easing: 'easeOutQuad',
        duration: 500,
      }),

      // Button micro-interaction (call manually or via click trigger)
      'button-click': (scope, target = '.btn') => ({
        targets: target,
        scale: [1, 1.08, 1],
        duration: 280,
        easing: 'easeOutQuad',
      }),

      // Input focus pulse
      'input-focus': (scope, target = 'input, textarea, select') => ({
        targets: scope.querySelectorAll(target),
        boxShadow: [
          '0 0 0 0px rgba(66,153,225,0)',
          '0 0 0 3px rgba(66,153,225,0.35)',
        ],
        duration: 300,
        easing: 'easeOutSine',
      }),

      // Error shake
      'error-shake': (scope, target = '.is-invalid, .form-error') => ({
        targets: scope.querySelectorAll(target),
        translateX: [
          { value: -8 }, { value: 8 },
          { value: -5 }, { value: 5 },
          { value: 0  },
        ],
        duration: 400,
        easing: 'easeInOutSine',
      }),

      // ── New presets ────────────────────────────────────────────────────────

      // Hero / page title — soft rise with gentle blur-in feel
      'hero-enter': (scope) => ({
        targets: scope.querySelectorAll('h1:not([data-smart-animated]), .hero-title:not([data-smart-animated]), .page-title:not([data-smart-animated])'),
        translateY: [28, 0],
        opacity: [0, 1],
        delay: anime.stagger(60, { start: 0 }),
        easing: 'easeOutExpo',
        duration: 900,
      }),

      // Section headings cascade in
      'headings': (scope) => ({
        targets: scope.querySelectorAll('h2:not([data-smart-animated]), h3:not([data-smart-animated]), .section-title:not([data-smart-animated])'),
        translateY: [20, 0],
        opacity: [0, 1],
        delay: anime.stagger(55, { start: 80 }),
        easing: 'easeOutQuart',
        duration: 700,
      }),

      // Stat / counter numbers count up from 0
      'count-up': (scope) => {
        const els = scope.querySelectorAll('[data-count]:not([data-smart-animated])');
        if (!els.length) return null;
        els.forEach(el => {
          const target = parseFloat(el.dataset.count) || 0;
          const decimals = (String(target).split('.')[1] || '').length;
          anime({
            targets: el,
            innerHTML: [0, target],
            round: decimals ? Math.pow(10, decimals) : 1,
            easing: 'easeOutExpo',
            duration: 1400,
            delay: 200,
            update: (anim) => {
              if (decimals) {
                el.textContent = parseFloat(el.innerHTML).toFixed(decimals);
              }
            },
          });
          el.setAttribute('data-smart-animated', 'true');
        });
        return null; // anime() already called per element above
      },

      // Badge / pill tags pop in with springy stagger
      'badge-pop': (scope) => ({
        targets: scope.querySelectorAll('.badge:not([data-smart-animated]), .tag:not([data-smart-animated]), .chip:not([data-smart-animated])'),
        scale:   [0.6, 1],
        opacity: [0, 1],
        delay:   anime.stagger(35, { start: 100 }),
        easing:  'easeOutBack',
        duration: 420,
      }),

      // Nav links slide down softly from above
      'nav-links': (scope) => ({
        targets: scope.querySelectorAll('.nav-link:not([data-smart-animated]), .navbar-nav .nav-item:not([data-smart-animated])'),
        translateY: [-12, 0],
        opacity:    [0, 1],
        delay:      anime.stagger(45, { start: 40 }),
        easing:     'easeOutQuart',
        duration:   520,
      }),

      // Form fields reveal with stagger — works well on settings/edit pages
      'form-fields': (scope) => ({
        targets: scope.querySelectorAll('.form-group:not([data-smart-animated]), .mb-3:not([data-smart-animated]), .form-field:not([data-smart-animated])'),
        translateY: [18, 0],
        opacity:    [0, 1],
        delay:      anime.stagger(60, { start: 50 }),
        easing:     'easeOutCubic',
        duration:   550,
      }),

      // Alert / notification banners drop in
      'alert-drop': (scope) => ({
        targets: scope.querySelectorAll('.alert:not([data-smart-animated])'),
        translateY: [-20, 0],
        opacity:    [0, 1],
        delay:      anime.stagger(70),
        easing:     'easeOutBounce',
        duration:   600,
      }),

      // Image grid / thumbnails scale up with stagger
      'image-grid': (scope) => ({
        targets: scope.querySelectorAll('img:not([data-smart-animated]), .thumbnail:not([data-smart-animated]), .smart-image:not([data-smart-animated])'),
        scale:   [0.92, 1],
        opacity: [0, 1],
        delay:   anime.stagger(55, { grid: [3, 3], from: 'center' }),
        easing:  'easeOutQuart',
        duration: 650,
      }),

      // Timeline / step items draw in from the side
      'timeline': (scope) => ({
        targets: scope.querySelectorAll('.timeline-item:not([data-smart-animated]), .step:not([data-smart-animated])'),
        translateX: [-30, 0],
        opacity:    [0, 1],
        delay:      anime.stagger(90, { start: 60 }),
        easing:     'easeOutQuart',
        duration:   600,
      }),
    };
  }

  constructor() {
    super();
    this._observers   = []; // IntersectionObservers to clean up
    this._listeners   = []; // {el, type, fn} to clean up
    this._initialized = false;
  }

  // ── Lifecycle: connected ───────────────────────────────────────────────────
  connectedCallback() {
    this.style.display = 'none';

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this._boot());
    } else {
      requestAnimationFrame(() => this._boot());
    }

    // ── Listen for smart-page-enter (from smart-motion) ──────────────────────
    const onPageEnter = (e) => {
      // smart-motion now passes container in detail — use it directly.
      // Fallback to querySelector only if not provided.
      const container = e.detail?.container
        || document.querySelector('[data-barba="container"]')
        || document;

      // Clear animated flags so elements re-animate on the new page
      this._clearAnimatedFlags(container);

      const trigger = this.getAttribute('trigger') || 'page';

      // For scroll/hover/click triggers, we must re-wire listeners on the new
      // container's DOM — the old listeners were attached to elements that no
      // longer exist after the Barba swap.
      if (trigger === 'scroll') {
        // Disconnect old observers before creating new ones for this page
        this._observers.forEach(ob => ob.disconnect());
        this._observers = [];
        this._initScrollTriggers(container);
      } else if (trigger === 'hover') {
        this._initHoverTriggers(container);
      } else if (trigger === 'click') {
        this._initClickTriggers(container);
      } else {
        // page / manual — just re-run animations on the new container
        requestAnimationFrame(() => this._run(container));
      }

      // Auto mode re-wires on every navigation too
      if (this.hasAttribute('auto')) {
        this._runAutoMode(container);
      }
    };

    window.addEventListener('smart-page-enter', onPageEnter);
    this._listeners.push({ el: window, type: 'smart-page-enter', fn: onPageEnter });
  }

  // ── Lifecycle: disconnected ────────────────────────────────────────────────
  disconnectedCallback() {
    // Clean up observers
    this._observers.forEach(ob => ob.disconnect());
    this._observers = [];
    // Clean up event listeners
    this._listeners.forEach(({ el, type, fn }) => el.removeEventListener(type, fn));
    this._listeners = [];
  }

  // ── Boot ───────────────────────────────────────────────────────────────────
  _boot() {
    if (this._initialized) return;
    this._initialized = true;

    if (typeof anime === 'undefined') {
      console.warn('[smart-effects] anime.js not found. Make sure animejs is loaded.');
      return;
    }

    const trigger = this.getAttribute('trigger') || 'page';
    const scope   = document.querySelector('[data-barba="container"]') || document;

    if (trigger === 'scroll') {
      this._initScrollTriggers(scope);
    } else if (trigger === 'hover') {
      this._initHoverTriggers(scope);
    } else if (trigger === 'click') {
      this._initClickTriggers(scope);
    } else if (trigger === 'page') {
      // Fire on initial load
      this._run(scope);
    }
    // trigger === 'manual' → user calls smartEffectsEl.play() themselves

    // Auto mode wires up everything regardless of preset
    if (this.hasAttribute('auto')) {
      this._runAutoMode(scope);
    }
  }

  // ── Main run ───────────────────────────────────────────────────────────────
  /**
   * Resolves what to animate and fires it.
   * @param {Document|Element} scope
   */
  _run(scope = document) {
    const type   = this.getAttribute('type');
    const target = this.getAttribute('target');

    if (type && SmartEffects.PRESETS[type]) {
      this._runPreset(type, scope, target);
    } else if (target) {
      this._runCustom(scope);
    } else if (this.hasAttribute('auto')) {
      this._runAutoMode(scope);
    }
  }

  // ── Run preset ─────────────────────────────────────────────────────────────
  _runPreset(name, scope, target) {
    const presetFn = SmartEffects.PRESETS[name];
    if (!presetFn) {
      console.warn(`[smart-effects] Unknown preset: "${name}"`);
      return;
    }
    const config = presetFn(scope, target);
    if (!config || !config.targets) return;

    // Filter out already-animated targets
    const els = this._filterUnanimated(config.targets);
    if (!els.length) return;

    config.targets = els;
    config.begin   = (anim) => this._markAnimated(anim.animatables.map(a => a.target));

    anime(config);
  }

  // ── Run custom attribute-driven animation ──────────────────────────────────
  _runCustom(scope) {
    const targetSel = this.getAttribute('target');
    if (!targetSel) return;

    const els = this._filterUnanimated(scope.querySelectorAll(targetSel));
    if (!els.length) return;

    const config = this._buildConfigFromAttrs(els);
    config.begin = (anim) => this._markAnimated(anim.animatables.map(a => a.target));
    anime(config);
  }

  // ── Build anime config from element attributes ─────────────────────────────
  _buildConfigFromAttrs(targets) {
    const get   = (attr) => this.getAttribute(attr);
    const getN  = (attr, fallback) => parseFloat(get(attr) ?? fallback);
    const getS  = (attr, fallback) => get(attr) ?? fallback;

    const config = {
      targets,
      duration: getN('duration', 700),
      easing:   getS('easing', 'easeOutCubic'),
      delay:    getN('delay', 0),
    };

    // Build from→to pairs for each transform attribute present
    if (get('translateX') !== null) config.translateX = [getN('translateX', 0), 0];
    if (get('translateY') !== null) config.translateY = [getN('translateY', 0), 0];
    if (get('scale')      !== null) config.scale      = [getN('scale', 1), 1];
    if (get('rotate')     !== null) config.rotate     = [getN('rotate', 0), 0];
    if (get('opacity')    !== null) config.opacity    = [getN('opacity', 0), 1];

    // If nothing was set, default to a simple fade-up
    if (!config.translateX && !config.translateY && !config.scale && !config.rotate && !config.opacity) {
      config.translateY = [24, 0];
      config.opacity    = [0, 1];
    }

    return config;
  }

  // ── Auto mode ──────────────────────────────────────────────────────────────
  /**
   * Automatically animate standard elements on the page.
   * Groups are animated in visual reading order with staggered timing so the
   * page feels alive but never overwhelming. All animations are soft and brief.
   *
   * Elements that need to be visible above the fold are animated immediately
   * (page trigger). Elements that may be off-screen use IntersectionObserver.
   */
  _runAutoMode(scope) {
    if (typeof anime === 'undefined') return;

    // ── Immediate (above-fold) groups — fire right away ─────────────────────
    // Each group gets a delay offset so they cascade naturally top-to-bottom.
    const IMMEDIATE = [

      // 1. Hero / page title — biggest element, first to animate
      {
        sel: 'h1, .hero-title, .page-title, .section-title:first-of-type, .display-1, .display-2, .display-3',
        cfg: { translateY: [22, 0], opacity: [0, 1], duration: 850, easing: 'easeOutExpo', delay: 0 },
      },

      // 2. Subtitle / lead text — immediately follows h1
      {
        sel: '.lead, .subtitle, .hero-sub, .section-sub, p.intro',
        cfg: { translateY: [16, 0], opacity: [0, 1], duration: 700, easing: 'easeOutQuart', delay: 80 },
      },

      // 3. Nav links — slide down softly
      {
        sel: '.navbar-nav .nav-item, .nav-link, .sidebar .nav-item',
        cfg: {
          translateY: [-10, 0], opacity: [0, 1],
          delay: anime.stagger(35, { start: 40 }),
          easing: 'easeOutQuart', duration: 480,
        },
      },

      // 4. Section labels / eyebrow text
      {
        sel: '.section-label, .eyebrow, .overline, .badge-label',
        cfg: { translateY: [10, 0], opacity: [0, 1], duration: 500, easing: 'easeOutCubic', delay: 60 },
      },

      // 5. Alerts / banners — drop in from above
      {
        sel: '.alert',
        cfg: { translateY: [-16, 0], opacity: [0, 1], duration: 520, easing: 'easeOutQuart', delay: anime.stagger(50) },
      },
    ];

    IMMEDIATE.forEach(({ sel, cfg }) => {
      const els = this._filterUnanimated(scope.querySelectorAll(sel));
      if (!els.length) return;
      anime({ ...cfg, targets: els, begin: (a) => this._markAnimated(a.animatables.map(x => x.target)) });
    });

    // ── Scroll-triggered groups — animate when entering viewport ─────────────
    // These cover content that is typically below the fold on first paint.
    const SCROLL_GROUPS = [

      // Cards with gentle rise + stagger
      {
        sel: '.card, .component-card',
        fn: (els) => anime({
          targets: els, translateY: [36, 0], opacity: [0, 1],
          delay: anime.stagger(65, { start: 30 }),
          easing: 'easeOutCubic', duration: 680,
          begin: (a) => this._markAnimated(a.animatables.map(x => x.target)),
        }),
      },

      // Table rows (each row slides in from left)
      {
        sel: 'table tbody tr',
        fn: (els) => anime({
          targets: els, translateX: [-14, 0], opacity: [0, 1],
          delay: anime.stagger(30, { start: 0 }),
          easing: 'easeOutQuad', duration: 420,
          begin: (a) => this._markAnimated(a.animatables.map(x => x.target)),
        }),
      },

      // List group items
      {
        sel: '.list-group-item',
        fn: (els) => anime({
          targets: els, translateX: [-10, 0], opacity: [0, 1],
          delay: anime.stagger(40),
          easing: 'easeOutQuad', duration: 420,
          begin: (a) => this._markAnimated(a.animatables.map(x => x.target)),
        }),
      },

      // Sidebar
      {
        sel: '.sidebar',
        fn: (els) => anime({
          targets: els, translateX: [-260, 0], opacity: [0, 1],
          easing: 'easeOutQuart', duration: 600,
          begin: (a) => this._markAnimated(a.animatables.map(x => x.target)),
        }),
      },

      // Section headings (h2 / h3) below fold
      {
        sel: 'h2, h3, .section-title',
        fn: (els) => anime({
          targets: els, translateY: [18, 0], opacity: [0, 1],
          delay: anime.stagger(45, { start: 30 }),
          easing: 'easeOutQuart', duration: 620,
          begin: (a) => this._markAnimated(a.animatables.map(x => x.target)),
        }),
      },

      // Badges / tags / pills — springy pop
      {
        sel: '.badge, .tag, .chip, .filter-tab',
        fn: (els) => anime({
          targets: els, scale: [0.65, 1], opacity: [0, 1],
          delay: anime.stagger(30, { start: 50 }),
          easing: 'easeOutBack', duration: 400,
          begin: (a) => this._markAnimated(a.animatables.map(x => x.target)),
        }),
      },

      // Stat / counter numbers
      {
        sel: '[data-count]',
        fn: (els) => els.forEach(el => {
          const target   = parseFloat(el.dataset.count) || 0;
          const decimals = (String(target).split('.')[1] || '').length;
          anime({
            targets: el, innerHTML: [0, target],
            round: decimals ? Math.pow(10, decimals) : 1,
            easing: 'easeOutExpo', duration: 1400, delay: 100,
            update: () => {
              if (decimals) el.textContent = parseFloat(el.innerHTML).toFixed(decimals);
            },
          });
          this._markAnimated([el]);
        }),
      },

      // Images / smart-image — scale up from slightly small
      {
        sel: 'img:not(.navbar-brand img):not(.avatar), smart-image',
        fn: (els) => anime({
          targets: els, scale: [0.94, 1], opacity: [0, 1],
          delay: anime.stagger(50, { start: 20 }),
          easing: 'easeOutQuart', duration: 600,
          begin: (a) => this._markAnimated(a.animatables.map(x => x.target)),
        }),
      },

      // Form groups / fields
      {
        sel: '.form-group, .mb-3:has(input,select,textarea), .form-field',
        fn: (els) => anime({
          targets: els, translateY: [14, 0], opacity: [0, 1],
          delay: anime.stagger(50, { start: 30 }),
          easing: 'easeOutCubic', duration: 520,
          begin: (a) => this._markAnimated(a.animatables.map(x => x.target)),
        }),
      },

      // Generic .reveal class (for pages that want opt-in scroll reveals)
      {
        sel: '.reveal',
        fn: (els) => anime({
          targets: els, translateY: [28, 0], opacity: [0, 1],
          delay: anime.stagger(70, { start: 0 }),
          easing: 'easeOutExpo', duration: 720,
          begin: (a) => this._markAnimated(a.animatables.map(x => x.target)),
        }),
      },
    ];

    // Wire each scroll group through IntersectionObserver
    SCROLL_GROUPS.forEach(({ sel, fn }) => {
      const els = this._filterUnanimated(scope.querySelectorAll(sel));
      if (!els.length) return;

      // Pre-hide so they don't flash at full opacity before animating
      els.forEach(el => {
        el.style.opacity = '0';
        el.setAttribute('data-smart-scroll-pending', 'true');
      });

      // Batch: fire the group animation once the first element is visible
      let fired = false;
      const observer = new IntersectionObserver(
        (entries) => {
          const visible = entries.filter(e => e.isIntersecting);
          if (!visible.length || fired) return;
          fired = true;

          // Reset opacity before animating so anime controls it
          const toAnimate = this._filterUnanimated(els);
          toAnimate.forEach(el => {
            el.style.opacity = '';
            el.removeAttribute('data-smart-scroll-pending');
          });

          if (toAnimate.length) fn(toAnimate);
          observer.disconnect();
        },
        { threshold: 0.08, rootMargin: '0px 0px -30px 0px' }
      );

      els.forEach(el => observer.observe(el));
      this._observers.push(observer);
    });

    // ── Nav link click pulse ─────────────────────────────────────────────────
    scope.querySelectorAll('.nav-link').forEach(link => {
      const fn = () => anime({ targets: link, scale: [1, 1.08, 1], duration: 240, easing: 'easeOutQuad' });
      link.addEventListener('click', fn);
      this._listeners.push({ el: link, type: 'click', fn });
    });

    // ── Button press micro-feedback ──────────────────────────────────────────
    scope.querySelectorAll('.btn:not([data-smart-btn-wired])').forEach(btn => {
      btn.setAttribute('data-smart-btn-wired', '1');
      const fn = () => anime({ targets: btn, scale: [1, 0.95, 1], duration: 200, easing: 'easeOutQuad' });
      btn.addEventListener('click', fn);
      this._listeners.push({ el: btn, type: 'click', fn });
    });
  }

  // ── Scroll trigger mode ────────────────────────────────────────────────────
  /**
   * Uses IntersectionObserver to trigger animations when elements enter viewport.
   */
  _initScrollTriggers(scope) {
    const target  = this.getAttribute('target') || '.card, table tr, .list-group-item, .fade-up-item';
    const type    = this.getAttribute('type');
    const elements = Array.from(scope.querySelectorAll(target));

    if (!elements.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          if (entry.target.hasAttribute('data-smart-animated')) return;

          // Mark immediately to prevent re-fire, clear pending flag
          this._markAnimated([entry.target]);
          entry.target.removeAttribute('data-smart-scroll-pending');

          if (type && SmartEffects.PRESETS[type]) {
            const config = SmartEffects.PRESETS[type](scope, entry.target);
            if (config) {
              config.targets = entry.target;
              anime(config);
            }
          } else {
            // Fall back to attribute-driven or default fade-up
            const config = this._buildConfigFromAttrs([entry.target]);
            anime(config);
          }

          observer.unobserve(entry.target);
        });
      },
      {
        threshold:  0.12,
        rootMargin: '0px 0px -40px 0px',
      }
    );

    elements.forEach(el => {
      // Pre-hide and mark so _clearAnimatedFlags can reset if page navigates
      // away before this element scrolls into view
      el.style.opacity = '0';
      el.setAttribute('data-smart-scroll-pending', 'true');
      observer.observe(el);
    });

    this._observers.push(observer);
  }

  // ── Hover trigger mode ─────────────────────────────────────────────────────
  _initHoverTriggers(scope) {
    const sel = this.getAttribute('target');
    if (!sel) return;

    scope.querySelectorAll(sel).forEach(el => {
      const fn = () => {
        const config = this._buildConfigFromAttrs([el]);
        anime(config);
      };
      el.addEventListener('mouseenter', fn);
      this._listeners.push({ el, type: 'mouseenter', fn });
    });
  }

  // ── Click trigger mode ─────────────────────────────────────────────────────
  _initClickTriggers(scope) {
    const sel  = this.getAttribute('target') || '.btn';
    const type = this.getAttribute('type');

    scope.querySelectorAll(sel).forEach(el => {
      const fn = () => {
        if (type && SmartEffects.PRESETS[type]) {
          const config = SmartEffects.PRESETS[type](scope, el);
          if (config) { config.targets = el; anime(config); }
        } else {
          anime(this._buildConfigFromAttrs([el]));
        }
      };
      el.addEventListener('click', fn);
      this._listeners.push({ el, type: 'click', fn });
    });
  }

  // ── Public API: play ───────────────────────────────────────────────────────
  /**
   * Manually trigger the animation. Use when trigger="manual".
   * @param {string} [selector] — override target selector
   */
  play(selector) {
    if (selector) this.setAttribute('target', selector);
    const scope = document.querySelector('[data-barba="container"]') || document;
    this._run(scope);
  }

  /**
   * Run a specific preset by name programmatically.
   * @param {string} presetName
   * @param {string} [targetOverride] — optional CSS selector
   */
  playPreset(presetName, targetOverride) {
    const scope = document.querySelector('[data-barba="container"]') || document;
    this._runPreset(presetName, scope, targetOverride);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Filter out elements that have already been animated.
   * @param {NodeList|Element[]} nodeListOrArray
   * @returns {Element[]}
   */
  _filterUnanimated(nodeListOrArray) {
    return Array.from(nodeListOrArray || []).filter(
      el => !el.hasAttribute('data-smart-animated')
    );
  }

  /**
   * Mark elements as animated to prevent re-running.
   * @param {Element[]} els
   */
  _markAnimated(els) {
    (els || []).forEach(el => {
      if (el && el.setAttribute) el.setAttribute('data-smart-animated', 'true');
    });
  }

  /**
   * Remove animated flags — called after page transition so elements re-animate.
   * Also clears the inline opacity:0 that scroll-trigger pre-applies, so elements
   * don't stay invisible if the page is revisited before they scrolled into view.
   * @param {Document|Element} scope
   */
  _clearAnimatedFlags(scope) {
    (scope || document).querySelectorAll('[data-smart-animated]').forEach(el => {
      el.removeAttribute('data-smart-animated');
    });
    // Reset any opacity:0 pre-set by scroll trigger setup on the previous visit
    (scope || document).querySelectorAll('[data-smart-scroll-pending]').forEach(el => {
      el.style.opacity = '';
      el.removeAttribute('data-smart-scroll-pending');
    });
  }
}

// ── Register ───────────────────────────────────────────────────────────────
customElements.define('smart-effects', SmartEffects);