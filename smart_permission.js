/**
 * SmartPermission — SmartGuard Engine
 * Reactive UI control system for SmartComponents framework
 * Version: 1.0.0
 */

(function (global) {
  "use strict";

  // ─────────────────────────────────────────────
  // smartState — Reactive State Store
  // ─────────────────────────────────────────────
  const smartState = (() => {
    const store = {};
    const subscribers = {};

    function get(key) {
      return key.split(".").reduce((obj, k) => (obj != null ? obj[k] : undefined), store);
    }

    function set(key, value) {
      const keys = key.split(".");
      let obj = store;
      for (let i = 0; i < keys.length - 1; i++) {
        if (obj[keys[i]] == null || typeof obj[keys[i]] !== "object") {
          obj[keys[i]] = {};
        }
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = value;
      notify(key);
      // Also notify parent keys so nested access triggers parent watchers
      const parentKey = keys.slice(0, -1).join(".");
      if (parentKey) notify(parentKey);
    }

    function notify(key) {
      const subs = subscribers[key] || [];
      subs.forEach((fn) => fn());
      // Notify wildcard
      (subscribers["*"] || []).forEach((fn) => fn());
    }

    function subscribe(key, fn) {
      if (!subscribers[key]) subscribers[key] = [];
      subscribers[key].push(fn);
      return () => {
        subscribers[key] = subscribers[key].filter((f) => f !== fn);
      };
    }

    function getStore() {
      return store;
    }

    return { get, set, subscribe, getStore, store };
  })();

  // ─────────────────────────────────────────────
  // Expression Evaluator (no raw eval)
  // ─────────────────────────────────────────────
  function evaluateExpression(expr, state) {
    try {
      return new Function("state", `with(state) { return (${expr}); }`)(state);
    } catch (e) {
      console.warn(`[SmartGuard] Expression error: "${expr}"`, e.message);
      return false;
    }
  }

  // ─────────────────────────────────────────────
  // Dependency Extractor
  // Extracts top-level identifiers from an expression
  // ─────────────────────────────────────────────
  function extractDependencies(expr) {
    // Match identifiers (and dotted paths), skip JS keywords
    const keywords = new Set([
      "true","false","null","undefined","typeof","instanceof",
      "new","return","if","else","in","of","let","const","var",
      "function","class","this","void","delete","throw",
    ]);
    const identifiers = new Set();
    // Match word boundaries: identifiers optionally followed by .something
    const re = /\b([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*)\b/g;
    let match;
    while ((match = re.exec(expr)) !== null) {
      const full = match[1];
      const root = full.split(".")[0];
      if (!keywords.has(root)) {
        identifiers.add(root);
        // Also track dotted paths for nested subscriptions
        if (full.includes(".")) identifiers.add(full.split(".").slice(0,2).join("."));
      }
    }
    return [...identifiers];
  }

  // ─────────────────────────────────────────────
  // SmartPermissionEngine — Core Class
  // ─────────────────────────────────────────────
  class SmartPermissionEngine {
    constructor() {
      this.bindings = new Map(); // el → binding
      this._unsubscribers = new Map(); // el → [unsub fns]
      this._observer = null;
    }

    init() {
      this.scan(document.body || document.documentElement);
      this._watchDOM();
    }

    scan(root) {
      const elements = root.querySelectorAll ? root.querySelectorAll("[if]") : [];
      elements.forEach((el) => {
        if (!this.bindings.has(el)) {
          this.bindElement(el);
        }
      });
      // Also check root itself
      if (root.hasAttribute && root.hasAttribute("if") && !this.bindings.has(root)) {
        this.bindElement(root);
      }
    }

    bindElement(el) {
      const expression = el.getAttribute("if");
      if (!expression) return;

      const mode = el.getAttribute("mode") || "hide";
      const lazy = el.hasAttribute("lazy");
      const enter = el.getAttribute("enter") || null;
      const leave = el.getAttribute("leave") || null;

      // For lazy: store original HTML before removing
      let placeholder = null;
      let lazyRendered = false;

      if (lazy) {
        placeholder = document.createComment(`[SmartGuard lazy]: ${expression}`);
        el.parentNode && el.parentNode.insertBefore(placeholder, el);
        el.parentNode && el.parentNode.removeChild(el);
        lazyRendered = false;
      }

      // For "remove" mode: keep a reference placeholder
      let removedPlaceholder = null;
      let removedEl = el;

      const dependencies = extractDependencies(expression);

      const binding = {
        el,
        expression,
        dependencies,
        mode,
        lazy,
        lazyRendered,
        placeholder,
        removedPlaceholder,
        removedEl,
        enter,
        leave,
        originalDisplay: el.style.display || "",
        initialized: false,
      };

      this.bindings.set(el, binding);

      // Subscribe to each dependency
      const unsubscribers = [];
      dependencies.forEach((key) => {
        const unsub = smartState.subscribe(key, () => this._update(el));
        unsubscribers.push(unsub);
      });
      this._unsubscribers.set(el, unsubscribers);

      // Initial evaluation
      this._update(el);
      binding.initialized = true;
    }

    _update(el) {
      const binding = this.bindings.get(el);
      if (!binding) return;

      const result = !!evaluateExpression(binding.expression, smartState.store);

      if (binding.lazy) {
        this._handleLazy(binding, result);
        return;
      }

      if (result) {
        this._show(binding);
      } else {
        this._applyMode(binding);
      }
    }

    _handleLazy(binding, result) {
      if (result && !binding.lazyRendered) {
        // Insert element back before placeholder
        if (binding.placeholder && binding.placeholder.parentNode) {
          binding.placeholder.parentNode.insertBefore(binding.el, binding.placeholder);
        }
        binding.lazyRendered = true;
        this._show(binding);
      } else if (!result && binding.lazyRendered) {
        this._applyMode(binding);
      }
    }

    _show(binding) {
      const { el, mode, enter, originalDisplay } = binding;

      if (mode === "remove") {
        // Re-insert if was removed
        if (binding.removedPlaceholder && binding.removedPlaceholder.parentNode) {
          binding.removedPlaceholder.parentNode.insertBefore(
            binding.removedEl,
            binding.removedPlaceholder
          );
          binding.removedPlaceholder.parentNode.removeChild(binding.removedPlaceholder);
          binding.removedPlaceholder = null;
        }
        binding.el = binding.removedEl;
      } else if (mode === "hide") {
        el.style.display = originalDisplay || "";
      } else if (mode === "disable") {
        this._enableChildren(el);
      } else if (mode === "replace") {
        this._showMain(el);
      }

      if (enter) this._animateEnter(el, enter);
    }

    _applyMode(binding) {
      const { el, mode, leave } = binding;

      const doRemove = () => {
        if (mode === "hide") {
          el.style.display = "none";
        } else if (mode === "remove") {
          if (el.parentNode) {
            const ph = document.createComment(`[SmartGuard removed]: ${binding.expression}`);
            el.parentNode.insertBefore(ph, el);
            el.parentNode.removeChild(el);
            binding.removedPlaceholder = ph;
            binding.removedEl = el;
          }
        } else if (mode === "disable") {
          this._disableChildren(el);
        } else if (mode === "replace") {
          this._showFallback(el);
        }
      };

      if (leave) {
        this._animateLeave(el, leave, doRemove);
      } else {
        doRemove();
      }
    }

    _disableChildren(el) {
      el.setAttribute("data-sg-disabled", "true");
      el.querySelectorAll("input, button, select, textarea, a").forEach((child) => {
        child.setAttribute("data-sg-was-disabled", child.disabled ? "true" : "false");
        child.disabled = true;
        child.setAttribute("tabindex", "-1");
        child.style.pointerEvents = "none";
        child.style.opacity = "0.4";
      });
      el.style.pointerEvents = "none";
      el.style.opacity = "0.5";
      el.style.userSelect = "none";
    }

    _enableChildren(el) {
      el.removeAttribute("data-sg-disabled");
      el.querySelectorAll("input, button, select, textarea, a").forEach((child) => {
        const wasDisabled = child.getAttribute("data-sg-was-disabled") === "true";
        child.disabled = wasDisabled;
        child.removeAttribute("data-sg-was-disabled");
        child.removeAttribute("tabindex");
        child.style.pointerEvents = "";
        child.style.opacity = "";
      });
      el.style.pointerEvents = "";
      el.style.opacity = "";
      el.style.userSelect = "";
    }

    _showMain(el) {
      const fallback = el.querySelector("fallback, [slot='fallback'], .sg-fallback");
      const main = el.querySelector(":not(fallback):not([slot='fallback']):not(.sg-fallback)");
      if (fallback) fallback.style.display = "none";
      if (main) main.style.display = "";
      else {
        // Show all direct children except fallback
        Array.from(el.children).forEach((child) => {
          if (!child.matches("fallback, [slot='fallback'], .sg-fallback")) {
            child.style.display = "";
          }
        });
      }
    }

    _showFallback(el) {
      const fallback = el.querySelector("fallback, [slot='fallback'], .sg-fallback");
      // Hide all non-fallback direct children
      Array.from(el.children).forEach((child) => {
        if (child.matches("fallback, [slot='fallback'], .sg-fallback")) {
          child.style.display = "";
        } else {
          child.style.display = "none";
        }
      });
      if (!fallback) {
        el.style.display = "none";
      }
    }

    // ── Animation Hooks ──────────────────────────────────
    _animateEnter(el, effect) {
      if (global.SmartEffects && global.SmartEffects.play) {
        global.SmartEffects.play(el, effect, "enter");
        return;
      }
      // Built-in fallback animations
      el.style.animation = "none";
      el.offsetHeight; // reflow
      el.style.animation = "";
      const animations = {
        fade: `sg-fade-in 0.3s ease forwards`,
        slide: `sg-slide-in 0.35s cubic-bezier(0.4, 0, 0.2, 1) forwards`,
        scale: `sg-scale-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards`,
        "slide-up": `sg-slide-up-in 0.35s ease forwards`,
      };
      el.style.animation = animations[effect] || animations.fade;
    }

    _animateLeave(el, effect, callback) {
      if (global.SmartEffects && global.SmartEffects.play) {
        global.SmartEffects.play(el, effect, "leave", callback);
        return;
      }
      const animations = {
        fade: `sg-fade-out 0.25s ease forwards`,
        slide: `sg-slide-out 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards`,
        scale: `sg-scale-out 0.25s ease forwards`,
        "slide-up": `sg-slide-up-out 0.3s ease forwards`,
      };
      el.style.animation = animations[effect] || animations.fade;
      el.addEventListener("animationend", callback, { once: true });
    }

    // ── MutationObserver: auto-scan new nodes ─────────────
    _watchDOM() {
      this._observer = new MutationObserver((mutations) => {
        mutations.forEach((m) => {
          m.addedNodes.forEach((node) => {
            if (node.nodeType === 1) {
              // It's an element
              this.scan(node);
            }
          });
        });
      });
      this._observer.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true,
      });
    }

    // Manually trigger re-evaluation of all bindings
    refresh() {
      this.bindings.forEach((_, el) => this._update(el));
    }

    // Unbind a specific element
    unbind(el) {
      const unsubs = this._unsubscribers.get(el);
      if (unsubs) unsubs.forEach((fn) => fn());
      this.bindings.delete(el);
      this._unsubscribers.delete(el);
    }

    destroy() {
      if (this._observer) this._observer.disconnect();
      this._unsubscribers.forEach((unsubs) => unsubs.forEach((fn) => fn()));
      this.bindings.clear();
      this._unsubscribers.clear();
    }
  }

  // ─────────────────────────────────────────────
  // <smart-permission> Web Component
  // ─────────────────────────────────────────────
  class SmartPermissionElement extends HTMLElement {
    connectedCallback() {
      // The engine handles all [if] attributes including this element
      // This component is just a semantic wrapper
      if (!this.hasAttribute("if")) return;
    }
  }

  if (!customElements.get("smart-permission")) {
    customElements.define("smart-permission", SmartPermissionElement);
  }

  // ─────────────────────────────────────────────
  // Inject Built-in Keyframe Animations
  // ─────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById("sg-keyframes")) return;
    const style = document.createElement("style");
    style.id = "sg-keyframes";
    style.textContent = `
      @keyframes sg-fade-in {
        from { opacity: 0; } to { opacity: 1; }
      }
      @keyframes sg-fade-out {
        from { opacity: 1; } to { opacity: 0; }
      }
      @keyframes sg-slide-in {
        from { opacity: 0; transform: translateX(-16px); }
        to   { opacity: 1; transform: translateX(0); }
      }
      @keyframes sg-slide-out {
        from { opacity: 1; transform: translateX(0); }
        to   { opacity: 0; transform: translateX(16px); }
      }
      @keyframes sg-slide-up-in {
        from { opacity: 0; transform: translateY(12px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes sg-slide-up-out {
        from { opacity: 1; transform: translateY(0); }
        to   { opacity: 0; transform: translateY(-12px); }
      }
      @keyframes sg-scale-in {
        from { opacity: 0; transform: scale(0.9); }
        to   { opacity: 1; transform: scale(1); }
      }
      @keyframes sg-scale-out {
        from { opacity: 1; transform: scale(1); }
        to   { opacity: 0; transform: scale(0.9); }
      }
    `;
    document.head.appendChild(style);
  }

  // ─────────────────────────────────────────────
  // Bootstrap
  // ─────────────────────────────────────────────
  const engine = new SmartPermissionEngine();

  function boot() {
    injectStyles();
    engine.init();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  // ─────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────
  global.smartState = smartState;
  global.SmartGuard = engine;
  global.SmartPermissionEngine = SmartPermissionEngine;

})(window);