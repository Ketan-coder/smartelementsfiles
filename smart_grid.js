/**
 * SmartGrid — Layout Engine
 * Responsive, declarative dashboard grid for SmartComponents
 * Version: 1.0.0
 */

(function (global) {
  "use strict";

  // ── Utility: debounce ──────────────────────────────────────────
  function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  // ── Utility: parse px/number ───────────────────────────────────
  function px(val, fallback = "0px") {
    if (!val) return fallback;
    return isNaN(val) ? val : val + "px";
  }

  // ── Child type → default span map ─────────────────────────────
  const TYPE_DEFAULTS = {
    "smart-chart": { span: 2, rowSpan: 1 },
    "smart-table": { span: 3, rowSpan: 1 },
    "smart-kpi":   { span: 1, rowSpan: 1 },
    "smart-map":   { span: 2, rowSpan: 2 },
  };

  // ── Breakpoints ────────────────────────────────────────────────
  const BREAKPOINTS = [
    { attr: "xs", max: 480  },
    { attr: "sm", max: 640  },
    { attr: "md", max: 1024 },
    { attr: "lg", max: 1280 },
    { attr: "xl", max: Infinity },
  ];

  // ──────────────────────────────────────────────────────────────
  class SmartGrid extends HTMLElement {

    static get observedAttributes() {
      return ["columns","min","gap","row-height","masonry","draggable","resizable","persist","sm","md","lg","xs","xl"];
    }

    constructor() {
      super();
      this._resizeHandler = debounce(() => this._updateColumns(), 80);
      this._dragState = null;
      this._resizeState = null;
      this._observer = null;
      this._colCount = 0;
    }

    connectedCallback() {
      this._init();
    }

    disconnectedCallback() {
      window.removeEventListener("resize", this._resizeHandler);
      if (this._observer) this._observer.disconnect();
      this._teardownDrag();
    }

    attributeChangedCallback() {
      if (this.isConnected) this._init();
    }

    // ── Init ───────────────────────────────────────────────────
    _init() {
      this._setupBaseStyles();
      this._updateColumns();
      this._applyChildren();
      this._setupResizeListener();
      this._setupMutationObserver();
      if (this.hasAttribute("draggable")) this._setupDrag();
      if (this.hasAttribute("resizable")) this._setupResizable();
      this._restoreLayout();
    }

    // ── Base Styles ────────────────────────────────────────────
    _setupBaseStyles() {
      this.style.display = "grid";
      this.style.width = "100%";
      this.style.boxSizing = "border-box";
      const gap = this.getAttribute("gap");
      this.style.gap = gap ? px(gap) : "16px";
      const rowH = this.getAttribute("row-height");
      if (rowH) this.style.gridAutoRows = px(rowH);
      if (this.hasAttribute("masonry")) this.style.gridAutoFlow = "dense";
      this.style.transition = "grid-template-columns 0.2s ease";
    }

    // ── Column Calculation ─────────────────────────────────────
    _getResponsiveColumns() {
      const w = this.offsetWidth || window.innerWidth;
      // Check breakpoint attrs from smallest to largest
      for (const bp of BREAKPOINTS) {
        if (w <= bp.max && this.hasAttribute(bp.attr)) {
          return parseInt(this.getAttribute(bp.attr));
        }
      }
      return null;
    }

    _updateColumns() {
      const colAttr = this.getAttribute("columns");
      const minAttr = this.getAttribute("min") || "280px";
      const responsive = this._getResponsiveColumns();

      let templateCols;

      if (responsive !== null) {
        templateCols = `repeat(${responsive}, 1fr)`;
        this._colCount = responsive;
      } else if (colAttr === "auto-fit" || colAttr === "auto-fill") {
        templateCols = `repeat(${colAttr}, minmax(${px(minAttr)}, 1fr))`;
        // Estimate column count for span clamping
        const gap = parseInt(this.getAttribute("gap") || 16);
        const w = this.offsetWidth || window.innerWidth;
        const min = parseInt(minAttr);
        this._colCount = min > 0 ? Math.max(1, Math.floor((w + gap) / (min + gap))) : 4;
      } else if (colAttr) {
        const n = parseInt(colAttr);
        templateCols = `repeat(${n}, 1fr)`;
        this._colCount = n;
      } else {
        // Auto-detect from children count
        const n = this._autoColumns();
        templateCols = `repeat(${n}, 1fr)`;
        this._colCount = n;
      }

      this.style.gridTemplateColumns = templateCols;
    }

    _autoColumns() {
      const count = Array.from(this.children).filter(c => !c.classList.contains("sg-resize-handle")).length;
      if (count <= 2) return 2;
      if (count <= 4) return 2;
      if (count <= 6) return 3;
      return 4;
    }

    // ── Apply Children ─────────────────────────────────────────
    _applyChildren() {
      Array.from(this.children).forEach(child => {
        if (child.classList.contains("sg-resize-handle")) return;
        this._applySpan(child);
      });
    }

    _applySpan(child) {
      const tag = child.tagName.toLowerCase();
      const defaults = TYPE_DEFAULTS[tag] || { span: 1, rowSpan: 1 };

      const span = parseInt(child.getAttribute("span") || defaults.span);
      const rowSpan = parseInt(child.getAttribute("row-span") || defaults.rowSpan);

      // Clamp span to current column count
      const maxSpan = this._colCount > 0 ? this._colCount : span;
      const clampedSpan = Math.min(span, maxSpan);

      child.style.gridColumn = `span ${clampedSpan}`;
      if (rowSpan > 1) child.style.gridRow = `span ${rowSpan}`;
      child.style.minWidth = "0";
      child.style.minHeight = "0";
      child.style.transition = "box-shadow 0.2s, transform 0.15s";
    }

    // ── Resize Listener ────────────────────────────────────────
    _setupResizeListener() {
      window.removeEventListener("resize", this._resizeHandler);
      window.addEventListener("resize", this._resizeHandler);
    }

    // ── MutationObserver ───────────────────────────────────────
    _setupMutationObserver() {
      if (this._observer) this._observer.disconnect();
      this._observer = new MutationObserver((mutations) => {
        let changed = false;
        mutations.forEach(m => {
          m.addedNodes.forEach(n => {
            if (n.nodeType === 1 && !n.classList.contains("sg-resize-handle")) changed = true;
          });
        });
        if (changed) {
          this._updateColumns();
          this._applyChildren();
        }
      });
      this._observer.observe(this, { childList: true });
    }

    // ── Drag & Drop Reorder ────────────────────────────────────
    _setupDrag() {
      this._teardownDrag();
      this._onDragStart = (e) => this._handleDragStart(e);
      this._onDragOver  = (e) => this._handleDragOver(e);
      this._onDrop      = (e) => this._handleDrop(e);
      this._onDragEnd   = (e) => this._handleDragEnd(e);

      this.addEventListener("dragstart", this._onDragStart);
      this.addEventListener("dragover",  this._onDragOver);
      this.addEventListener("drop",      this._onDrop);
      this.addEventListener("dragend",   this._onDragEnd);

      Array.from(this.children).forEach(child => {
        if (child.classList.contains("sg-resize-handle")) return;
        child.setAttribute("draggable", "true");
        child.style.cursor = "grab";
      });
    }

    _teardownDrag() {
      if (this._onDragStart) {
        this.removeEventListener("dragstart", this._onDragStart);
        this.removeEventListener("dragover",  this._onDragOver);
        this.removeEventListener("drop",      this._onDrop);
        this.removeEventListener("dragend",   this._onDragEnd);
      }
    }

    _handleDragStart(e) {
      const child = e.target.closest(":scope > *:not(.sg-resize-handle)");
      if (!child) return;
      this._dragState = { el: child };
      child.style.opacity = "0.45";
      child.style.transform = "scale(0.97)";
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", "");
    }

    _handleDragOver(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const target = this._getDragTarget(e);
      if (!target || target === this._dragState?.el) return;
      // Visual indicator
      Array.from(this.children).forEach(c => c.classList.remove("sg-drag-over"));
      target.classList.add("sg-drag-over");
    }

    _handleDrop(e) {
      e.preventDefault();
      const target = this._getDragTarget(e);
      if (!target || !this._dragState) return;
      const { el } = this._dragState;
      if (target === el) return;

      // Determine insert position
      const rect = target.getBoundingClientRect();
      const midX = rect.left + rect.width / 2;
      if (e.clientX < midX) {
        this.insertBefore(el, target);
      } else {
        this.insertBefore(el, target.nextSibling);
      }

      Array.from(this.children).forEach(c => c.classList.remove("sg-drag-over"));
      this._saveLayout();
    }

    _handleDragEnd(e) {
      if (this._dragState?.el) {
        this._dragState.el.style.opacity = "";
        this._dragState.el.style.transform = "";
      }
      Array.from(this.children).forEach(c => c.classList.remove("sg-drag-over"));
      this._dragState = null;
    }

    _getDragTarget(e) {
      return Array.from(this.children).find(c => {
        if (c.classList.contains("sg-resize-handle")) return false;
        const r = c.getBoundingClientRect();
        return e.clientX >= r.left && e.clientX <= r.right &&
               e.clientY >= r.top  && e.clientY <= r.bottom;
      });
    }

    // ── Resizable Items ────────────────────────────────────────
    _setupResizable() {
      Array.from(this.children).forEach(child => {
        if (child.classList.contains("sg-resize-handle")) return;
        this._addResizeHandle(child);
      });
    }

    _addResizeHandle(child) {
      // Prevent duplicate
      if (child.querySelector(".sg-resize-handle-inner")) return;

      child.style.position = "relative";

      // Right handle
      const handleR = document.createElement("div");
      handleR.className = "sg-resize-handle sg-resize-handle-inner sg-resize-e";
      Object.assign(handleR.style, {
        position: "absolute", right: "0", top: "0", bottom: "0",
        width: "6px", cursor: "ew-resize", zIndex: "10",
        background: "transparent",
        transition: "background 0.15s",
      });
      handleR.addEventListener("mouseenter", () => handleR.style.background = "rgba(74,222,128,0.4)");
      handleR.addEventListener("mouseleave", () => handleR.style.background = "transparent");
      handleR.addEventListener("mousedown", (e) => this._startResize(e, child, "x"));
      child.appendChild(handleR);

      // Bottom handle
      const handleB = document.createElement("div");
      handleB.className = "sg-resize-handle sg-resize-handle-inner sg-resize-s";
      Object.assign(handleB.style, {
        position: "absolute", left: "0", right: "0", bottom: "0",
        height: "6px", cursor: "ns-resize", zIndex: "10",
        background: "transparent",
        transition: "background 0.15s",
      });
      handleB.addEventListener("mouseenter", () => handleB.style.background = "rgba(74,222,128,0.4)");
      handleB.addEventListener("mouseleave", () => handleB.style.background = "transparent");
      handleB.addEventListener("mousedown", (e) => this._startResize(e, child, "y"));
      child.appendChild(handleB);
    }

    _startResize(e, child, axis) {
      e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      const startSpan = parseInt(child.style.gridColumn?.replace("span ", "") || 1);
      const startRowSpan = parseInt(child.style.gridRow?.replace("span ", "") || 1);
      const colW = this.offsetWidth / (this._colCount || 3);
      const rowH = child.offsetHeight;

      const onMove = (ev) => {
        if (axis === "x") {
          const dx = ev.clientX - startX;
          const newSpan = Math.max(1, Math.min(this._colCount, Math.round(startSpan + dx / colW)));
          child.style.gridColumn = `span ${newSpan}`;
        } else {
          const dy = ev.clientY - startY;
          const newRowSpan = Math.max(1, Math.round(startRowSpan + dy / rowH));
          child.style.gridRow = `span ${newRowSpan}`;
        }
      };

      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        this._saveLayout();
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    }

    // ── Persist Layout ─────────────────────────────────────────
    _persistKey() {
      return this.getAttribute("persist") ? `sg:${this.getAttribute("persist")}` : null;
    }

    _saveLayout() {
      const key = this._persistKey();
      if (!key) return;
      const layout = Array.from(this.children)
        .filter(c => !c.classList.contains("sg-resize-handle"))
        .map((c, i) => ({
          index: i,
          id: c.id || c.getAttribute("data-sg-id") || i,
          gridColumn: c.style.gridColumn,
          gridRow: c.style.gridRow,
        }));
      try { localStorage.setItem(key, JSON.stringify(layout)); } catch(e) {}
    }

    _restoreLayout() {
      const key = this._persistKey();
      if (!key) return;
      let layout;
      try { layout = JSON.parse(localStorage.getItem(key)); } catch(e) { return; }
      if (!Array.isArray(layout)) return;

      const children = Array.from(this.children).filter(c => !c.classList.contains("sg-resize-handle"));

      layout.forEach((item) => {
        const child = children[item.index];
        if (!child) return;
        if (item.gridColumn) child.style.gridColumn = item.gridColumn;
        if (item.gridRow) child.style.gridRow = item.gridRow;
      });
    }

    // ── Public API ─────────────────────────────────────────────
    clearLayout() {
      const key = this._persistKey();
      if (key) try { localStorage.removeItem(key); } catch(e) {}
      this._applyChildren();
    }

    refresh() {
      this._updateColumns();
      this._applyChildren();
    }

    addItem(el, opts = {}) {
      if (opts.span) el.setAttribute("span", opts.span);
      if (opts.rowSpan) el.setAttribute("row-span", opts.rowSpan);
      this.appendChild(el);
      // Observer will trigger applyChildren
    }
  }

  // ── Register & inject styles ─────────────────────────────────
  function injectStyles() {
    if (document.getElementById("sg-styles")) return;
    const s = document.createElement("style");
    s.id = "sg-styles";
    s.textContent = `
      smart-grid {
        display: grid;
        width: 100%;
        box-sizing: border-box;
      }
      smart-grid > * {
        min-width: 0;
        min-height: 0;
      }
      .sg-drag-over {
        outline: 2px dashed rgba(74,222,128,0.6) !important;
        outline-offset: -2px;
        transform: scale(1.01) !important;
      }
      smart-grid[draggable] > *:not(.sg-resize-handle) {
        cursor: grab;
      }
      smart-grid[draggable] > *:not(.sg-resize-handle):active {
        cursor: grabbing;
      }
    `;
    document.head.appendChild(s);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectStyles);
  } else {
    injectStyles();
  }

  if (!customElements.get("smart-grid")) {
    customElements.define("smart-grid", SmartGrid);
  }

  global.SmartGrid = SmartGrid;

})(window);