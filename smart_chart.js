/**
 * smart-chart.js v3.3
 * Load as: <script src="smart-chart.js"></script>  (NOT type="module")
 * Load AFTER smart-state.js and smart-data.js.
 *
 * NEW IN v2.0
 *   • Fullscreen: true full-viewport overlay with proper canvas resize
 *   • type-switcher="bar,line,area,pie" — renders icon buttons to switch chart type live
 *   • default-type="line" — initial chart type (separate from type-switcher list)
 *   • Local date-range filtering — ranges like "7d,30d,90d,1y" filter in-memory
 *     when x-field is a date string; "Clear" button resets to full data
 *   • Modern design: gradient fills, smooth curves, refined grid, rich tooltips
 *
 * DATA SOURCES (pick one)
 *   source="key"           reads from smartState / listens for smart-data-loaded
 *   api="/api/sales/"      fetches directly
 *   data="[10,20,30]"      inline values; use labels='["A","B","C"]' for x-axis
 *
 * DATA MAPPING
 *   x-field="date"         key in each object → x-axis label (REQUIRED for date filtering)
 *   y-field="sales"        key in each object → single y dataset
 *   datasets='[{"label":"Sales","field":"sales"}]'
 *
 * APPEARANCE
 *   default-type="line"    initial chart type: bar|line|area|pie|doughnut|radar
 *   type-switcher="bar,line,area" icon buttons to switch type live
 *   palette="material"     material|nord|monochrome|pastel|ocean|vivid
 *   title="Revenue"
 *   height="320"           canvas height px (default: 320)
 *   tension="0.4"          line/area curve 0–1
 *   point-radius="3"
 *   thresholds='{"700":"orange","900":"red"}'
 *   goal-line="500"
 *   goal-label="Target"
 *
 * CONTROLS
 *   ranges="7d,30d,90d,1y,all"  local date-filter buttons (x-field must be date)
 *   toolbar="refresh,fullscreen" icon buttons
 *   export="png,csv,json"
 *   refresh="30s"               auto-poll (api source only)
 *   state-listen="key"
 *   click-state="key"
 *   sync-group="name"
 *
 * LIVE DATA — WEBSOCKET
 *   websocket="ws://host/ws/sales/"  WS URL for live streaming data
 *   ws-mode="append"                 append (default) | replace
 *   ws-max-points="200"              max data points to keep (default: 200)
 *   ws-show-status                   show ⬤ Live / ↺ Reconnecting in subtitle
 *
 *   Append msg (server → browser):
 *     { "label": "14:32", "values": { "sales": 450 } }
 *     or flat: { "date": "2026-03-17", "sales": 450 }
 *   Replace msg: full JSON array (same shape as your REST API)
 */
(function (global) {
  'use strict';
  if (customElements.get('smart-chart')) return;

  /* ─── Chart.js + plugin loader ─────────────────────────────────────────── */
  var _cjsPromise = null;
  function _loadCjs() {
    if (_cjsPromise) return _cjsPromise;

    /* Load a script once; resolve immediately if already registered */
    function _loadScript(src, checkFn) {
      return new Promise(function(res) {
        try { if (checkFn && checkFn()) { res(); return; } } catch(e){}
        var s = document.createElement('script');
        s.src = src; s.onload = res; s.onerror = res;
        document.head.appendChild(s);
      });
    }

    function _loadAllPlugins() {
      /* annotation plugin only — zoom is handled natively by SmartZoom */
      return _loadScript(
        'https://cdn.jsdelivr.net/npm/chartjs-plugin-annotation@3/dist/chartjs-plugin-annotation.min.js',
        function(){ return _pluginOk('annotation'); }
      );
    }

    if (global.Chart) {
      _cjsPromise = _loadAllPlugins().then(function(){ return global.Chart; });
      return _cjsPromise;
    }
    _cjsPromise = new Promise(function(resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js';
      s.onload = function(){ _loadAllPlugins().then(function(){ resolve(global.Chart); }); };
      s.onerror = reject;
      document.head.appendChild(s);
    });
    return _cjsPromise;
  }
  function _pluginOk(id) {
    try {
      if (!global.Chart||!global.Chart.registry||!global.Chart.registry._plugins) return false;
      var vals = global.Chart.registry._plugins.values
        ? Array.from(global.Chart.registry._plugins.values())
        : Object.values(global.Chart.registry._plugins);
      return vals.some(function(p){return p.id===id;});
    } catch(e){ return false; }
  }
  function _annoOk(){ return _pluginOk('annotation'); }

  /* ══════════════════════════════════════════════════════════════════════════
     SmartZoom — native canvas drag-to-zoom. Zero external dependencies.
     Identical UX to ApexCharts zoom: drag a selection on the x-axis to zoom,
     double-click or "Reset Zoom" button to restore the full view.

     Attribute: zoom-enabled (boolean, default true)
       • Present on <smart-chart>  → zoom active
       • Absent                    → zoom disabled (pass zoom-enabled="false" or
                                     omit the attribute and use no-zoom attr)
     Attribute: no-zoom (boolean)
       • Present → zoom disabled entirely
  ══════════════════════════════════════════════════════════════════════════ */
  function SmartZoom(chartInst, containerDiv, onZoomCb, onResetCb) {
    this._chart     = chartInst;
    this._container = containerDiv;   // position:relative div wrapping the canvas
    this._onZoom    = onZoomCb  || function(){};
    this._onReset   = onResetCb || function(){};
    this._dragging  = false;
    this._startX    = 0;
    this._lastX     = 0;
    this._fullLabels = null;   // snapshot before first zoom
    this._fullData   = null;   // per-dataset snapshots
    this._isZoomed   = false;
    this._ov         = null;   // transparent event-capture overlay div
    this._sel        = null;   // blue selection-rectangle div
    this._init();
  }

  SmartZoom.prototype._init = function () {
    var z = this, c = this._chart, wrap = this._container;
    if (!c || !wrap) return;

    /* Snapshot the full dataset immediately */
    z._snapshotFull();

    /* ── Event-capture overlay ── */
    /* Sits on top of the canvas; cursor:crosshair signals draggability */
    var ov = document.createElement('div');
    ov.style.cssText = 'position:absolute;inset:0;z-index:3;'
      + 'cursor:crosshair;user-select:none;-webkit-user-select:none;';
    wrap.style.position = 'relative';
    wrap.appendChild(ov);
    z._ov = ov;

    /* ── Selection rectangle ── */
    var sel = document.createElement('div');
    sel.style.cssText = 'position:absolute;top:0;bottom:0;z-index:4;'
      + 'display:none;pointer-events:none;'
      + 'background:rgba(100,116,240,.15);'
      + 'border-left:2px solid rgba(100,116,240,.75);'
      + 'border-right:2px solid rgba(100,116,240,.75);';
    wrap.appendChild(sel);
    z._sel = sel;

    /* ── Mouse events ── */
    ov.addEventListener('mousedown',  function(e){ z._onDown(e); });
    ov.addEventListener('mousemove',  function(e){ z._onMove(e); });
    ov.addEventListener('mouseup',    function(e){ z._onUp(e); });
    ov.addEventListener('mouseleave', function(e){ z._onLeave(e); });
    ov.addEventListener('dblclick',   function()  { z.reset(); });

    /* ── Touch events (mobile) ── */
    ov.addEventListener('touchstart', function(e){
      if (e.touches.length !== 1) return;
      e.preventDefault();
      z._onDown({ clientX: e.touches[0].clientX });
    }, { passive: false });
    ov.addEventListener('touchmove', function(e){
      if (e.touches.length !== 1) return;
      e.preventDefault();
      z._onMove({ clientX: e.touches[0].clientX });
    }, { passive: false });
    ov.addEventListener('touchend', function(e){
      e.preventDefault();
      var cx = e.changedTouches.length ? e.changedTouches[0].clientX : z._lastX;
      z._onUp({ clientX: cx });
    }, { passive: false });
  };

  SmartZoom.prototype._snapshotFull = function () {
    var c = this._chart;
    if (!c) return;
    this._fullLabels = (c.data.labels || []).slice();
    this._fullData   = (c.data.datasets || []).map(function(ds){
      return { data: (ds.data || []).slice() };
    });
    this._isZoomed = false;
  };

  /* Convert an x-pixel (relative to overlay) to nearest data index */
  SmartZoom.prototype._pxToIdx = function (px) {
    var area = this._chart && this._chart.chartArea;
    var n    = (this._chart && this._chart.data.labels || []).length;
    if (!area || !n) return 0;
    var t = (px - area.left) / (area.right - area.left);
    t = Math.max(0, Math.min(1, t));
    return Math.round(t * (n - 1));
  };

  /* x-pixel relative to the overlay div */
  SmartZoom.prototype._rx = function (e) {
    var rect = this._ov.getBoundingClientRect();
    return (e.clientX || 0) - rect.left;
  };

  SmartZoom.prototype._onDown = function (e) {
    var area = this._chart && this._chart.chartArea;
    if (!area) return;
    var x = this._rx(e);
    /* Only start if click is inside the chart plot area */
    if (x < area.left || x > area.right) return;
    this._dragging = true;
    this._startX   = x;
    this._lastX    = x;
    this._sel.style.left    = x + 'px';
    this._sel.style.width   = '0px';
    this._sel.style.display = 'block';
  };

  SmartZoom.prototype._onMove = function (e) {
    if (this._dragging) {
      /* Active drag — update selection rectangle only */
      var x    = this._rx(e);
      this._lastX = x;
      var area = this._chart && this._chart.chartArea;
      var left = area ? area.left  : 0;
      var right= area ? area.right : 99999;
      var x1   = Math.max(left,  Math.min(this._startX, x));
      var x2   = Math.min(right, Math.max(this._startX, x));
      this._sel.style.left  = x1 + 'px';
      this._sel.style.width = (x2 - x1) + 'px';
    } else {
      /* Hover — forward the event to the canvas so Chart.js can show its tooltip */
      this._fwdToCanvas(e, 'mousemove');
    }
  };

  /* Forward a mouse event to the underlying canvas element.
     Chart.js listens on the canvas directly; synthesising a new event on it
     triggers its internal event system (tooltip, hover highlight etc.) */
  SmartZoom.prototype._fwdToCanvas = function (e, type) {
    var canvas = this._container && this._container.querySelector('canvas');
    if (!canvas) return;
    try {
      var synth = new MouseEvent(type, {
        bubbles:    false,
        cancelable: true,
        clientX:    e.clientX,
        clientY:    e.clientY,
        screenX:    e.screenX,
        screenY:    e.screenY,
        buttons:    e.buttons,
      });
      canvas.dispatchEvent(synth);
    } catch (ex) { /* safety — old browsers */ }
  };

  SmartZoom.prototype._onLeave = function (e) {
    /* Cancel any active drag and tell Chart.js the mouse has left */
    this._cancel();
    this._fwdToCanvas(e, 'mouseleave');
    this._fwdToCanvas(e, 'mouseout');
  };

  SmartZoom.prototype._onUp = function (e) {
    if (!this._dragging) return;
    this._dragging          = false;
    this._sel.style.display = 'none';

    var x1 = this._startX;
    var x2 = (e && e.clientX) ? this._rx(e) : this._lastX;
    /* Ignore tiny accidental drags (< 8 px) */
    if (Math.abs(x2 - x1) < 8) return;

    var i0 = this._pxToIdx(Math.min(x1, x2));
    var i1 = this._pxToIdx(Math.max(x1, x2));
    if (i0 >= i1) return;

    this._zoomToRange(i0, i1);
  };

  SmartZoom.prototype._cancel = function () {
    if (!this._dragging) return;
    this._dragging          = false;
    this._sel.style.display = 'none';
  };

  SmartZoom.prototype._zoomToRange = function (i0, i1) {
    var c = this._chart;
    if (!c) return;

    /* Snapshot full data on first zoom (so reset always returns here) */
    if (!this._isZoomed) this._snapshotFull();
    this._isZoomed = true;

    var fl = this._fullLabels;
    var fd = this._fullData;
    c.data.labels = fl.slice(i0, i1 + 1);
    c.data.datasets.forEach(function(ds, di){
      if (fd[di]) ds.data = fd[di].data.slice(i0, i1 + 1);
    });
    c.update('active');
    this._onZoom();
  };

  SmartZoom.prototype.reset = function () {
    var c  = this._chart;
    var fl = this._fullLabels;
    var fd = this._fullData;
    if (!c || !fl || !this._isZoomed) return;
    c.data.labels = fl.slice();
    c.data.datasets.forEach(function(ds, di){
      if (fd[di]) ds.data = fd[di].data.slice();
    });
    c.update('active');
    this._isZoomed = false;
    this._onReset();
  };

  /* Call when new data arrives (range filter change, poll refresh etc.)
     so reset() restores the current filtered view, not stale data */
  SmartZoom.prototype.updateSnapshot = function (labels, datasets) {
    this._fullLabels = (labels || []).slice();
    this._fullData   = (datasets || []).map(function(ds){
      return { data: (ds.data || []).slice() };
    });
    this._isZoomed = false;
  };

  SmartZoom.prototype.destroy = function () {
    if (this._ov  && this._ov.parentNode)  this._ov.parentNode.removeChild(this._ov);
    if (this._sel && this._sel.parentNode) this._sel.parentNode.removeChild(this._sel);
    this._ov = null; this._sel = null; this._chart = null;
  };


  /* ─── Palettes ─────────────────────────────────────────────────────────── */
  var PALETTES = {
    material:   ['#4285f4','#ea4335','#fbbc04','#34a853','#ff6d00','#46bdc6','#7b61ff','#e91e63'],
    nord:       ['#5e81ac','#bf616a','#ebcb8b','#a3be8c','#b48ead','#88c0d0','#d08770','#81a1c1'],
    monochrome: ['#6474f0','#818cf8','#a5b4fc','#c7d2fe','#4a5296','#2d3561','#e0e7ff','#eef2ff'],
    pastel:     ['#ffb3ba','#ffdfba','#ffffba','#baffc9','#bae1ff','#d4b3ff','#ffb3f0','#b3fff0'],
    ocean:      ['#0077b6','#00b4d8','#48cae4','#90e0ef','#023e8a','#0096c7','#ade8f4','#caf0f8'],
    vivid:      ['#f72585','#7209b7','#3a0ca3','#4361ee','#4cc9f0','#06d6a0','#ffd166','#ef233c'],
  };
  function _pal(name, n) {
    var base = PALETTES[name] || PALETTES.material, out = [];
    for (var i=0;i<n;i++) out.push(base[i%base.length]);
    return out;
  }
  function _rgba(hex, a) {
    var r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
    return 'rgba('+r+','+g+','+b+','+(a||0.15)+')';
  }

  /* ─── Utilities ────────────────────────────────────────────────────────── */
  function _num(v) { if(v===null||v===undefined||v==='')return null; var n=Number(v); return isNaN(n)?null:n; }
  function _json(s,fb){ if(!s)return fb; try{return JSON.parse(s);}catch(e){return fb;} }
  function _dotGet(obj,path){ if(!path||obj==null)return obj; return path.split('.').reduce(function(a,p){return a==null?null:a[p];},obj); }
  function _ms(raw){ if(!raw)return 0; var m=String(raw).trim().match(/^(\d+(?:\.\d+)?)(s|m|h)?$/i); if(!m)return 0; return Math.round(parseFloat(m[1])*({s:1000,m:60000,h:3600000}[(m[2]||'s').toLowerCase()]||1000)); }
  function _esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  /* Human-readable label for a range code */
  function _rangeLabel(r) {
    if (!r||r==='all'||r==='max') return 'All';
    if (r.toLowerCase()==='ytd') return 'YTD';
    var re=/^([0-9]+)(d|w|m|y)$/i, m=re.exec(r);
    if (!m) return r.toUpperCase();
    var n=m[1], u=m[2].toLowerCase();
    var uname={d:'day',w:'week',m:'month',y:'year'}[u]||u;
    return 'Last '+n+' '+(parseInt(n)===1?uname:uname+'s');
  }

  /* Returns cutoff Date anchored to the newest point in data, not Date.now() */
  function _rangeCutoff(range, anchor) {
    if (!range||range==='all'||range==='max') return null;
    var ref=(anchor instanceof Date&&!isNaN(anchor))?new Date(anchor):new Date();
    ref.setHours(23,59,59,999);
    if (String(range).toLowerCase()==='ytd') return new Date(ref.getFullYear(),0,1);
    var re=/^([0-9]+)(d|w|m|y)$/i, m=re.exec(String(range));
    if (!m) return null;
    var n=parseInt(m[1]), u=m[2].toLowerCase(), d=new Date(ref);
    if      (u==='d') d.setDate(d.getDate()-n);
    else if (u==='w') d.setDate(d.getDate()-n*7);
    else if (u==='m') d.setMonth(d.getMonth()-n);
    else if (u==='y') d.setFullYear(d.getFullYear()-n);
    return d;
  }

  /* Find the newest date in an object array */
  function _maxDate(rawData, xField) {
    if (!Array.isArray(rawData)||!xField) return null;
    var max=null;
    for (var i=0;i<rawData.length;i++){
      var v=rawData[i][xField]; if(!v) continue;
      var d=new Date(v); if(!isNaN(d)&&(max===null||d>max)) max=d;
    }
    return max;
  }

  /* Filter to rows >= cutoff, anchored to the newest data point */
  function _filterByRange(rawData, xField, range) {
    if (!range||range==='all'||range==='max'||!xField||!Array.isArray(rawData)) return rawData;
    var anchor=_maxDate(rawData,xField);
    var cutoff=_rangeCutoff(range, anchor);
    if (!cutoff) return rawData;
    return rawData.filter(function(row){
      var v=row[xField]; if(!v) return true;
      var d=new Date(v); return !isNaN(d)&&d>=cutoff;
    });
  }

  /* ─── Sync groups ──────────────────────────────────────────────────────── */
  var _syncGroups = Object.create(null);

  /* ─── Type switcher icons ───────────────────────────────────────────────── */
  var TYPE_ICONS = {
    bar:          '<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="1" y="5" width="3" height="8"/><rect x="5.5" y="2" width="3" height="11"/><rect x="10" y="7" width="3" height="6"/></svg>',
    line:         '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="1,10 4,6 7,8 10,3 13,5"/></svg>',
    area:         '<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" opacity=".8"><path d="M1,10 4,6 7,8 10,3 13,5 13,13 1,13Z"/></svg>',
    pie:          '<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M7,7 L7,1 A6,6 0 0,1 13,7 Z" opacity=".9"/><path d="M7,7 L13,7 A6,6 0 0,1 1.8,10.5 Z" opacity=".7"/><path d="M7,7 L1.8,10.5 A6,6 0 0,1 7,1 Z" opacity=".5"/></svg>',
    doughnut:     '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="3"><circle cx="7" cy="7" r="4"/></svg>',
    radar:        '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="7,1 13,5 11,12 3,12 1,5"/><polygon points="7,3.5 10.5,6 9.5,9.5 4.5,9.5 3.5,6"/></svg>',
    scatter:      '<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><circle cx="3" cy="10" r="1.5"/><circle cx="6" cy="5" r="1.5"/><circle cx="9" cy="8" r="1.5"/><circle cx="12" cy="3" r="1.5"/></svg>',
    bubble:       '<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" opacity=".85"><circle cx="4" cy="9" r="2.5"/><circle cx="10" cy="5" r="3.5"/></svg>',
    step:         '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="1,10 4,10 4,6 7,6 7,8 10,8 10,3 13,3"/></svg>',
    horizontalBar:'<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="1" y="2" width="8" height="3"/><rect x="1" y="5.5" width="11" height="3"/><rect x="1" y="9" width="6" height="3"/></svg>',
    polarArea:    '<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M7,7 L7,1.5 A5.5,5.5 0 0,1 12.5,7 Z" opacity=".9"/><path d="M7,7 L12.5,7 A5.5,5.5 0 0,1 4,11.5 Z" opacity=".65"/><path d="M7,7 L4,11.5 A5.5,5.5 0 0,1 7,1.5 Z" opacity=".4"/></svg>',
  };

  /* ─── Styles ───────────────────────────────────────────────────────────── */
  function _styles() {
    if (document.getElementById('sc-chart-css')) return;
    var s = document.createElement('style'); s.id='sc-chart-css';
    s.textContent = `
smart-chart{display:block;box-sizing:border-box;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}

/* ── Card wrapper ── */
.sc-cw{
  position:relative;
  background:var(--sc-bg,#ffffff);
  border:1px solid var(--sc-border,rgba(0,0,0,.08));
  border-radius:16px;
  overflow:hidden;
  box-shadow:0 1px 3px rgba(0,0,0,.05),0 8px 24px rgba(0,0,0,.06);
  transition:box-shadow .2s;
}
.sc-cw:hover{ box-shadow:0 1px 3px rgba(0,0,0,.05),0 12px 32px rgba(0,0,0,.1); }

/* ── Dark theme ── */
@media(prefers-color-scheme:dark){.sc-cw{--sc-bg:#1a1d2e;--sc-border:rgba(255,255,255,.07);--sc-text:#d4d8f0;--sc-muted:#6b7194;--sc-grid:rgba(255,255,255,.05);}}
smart-chart[data-theme=dark] .sc-cw{--sc-bg:#1a1d2e;--sc-border:rgba(255,255,255,.07);--sc-text:#d4d8f0;--sc-muted:#6b7194;--sc-grid:rgba(255,255,255,.05);}
smart-chart[data-theme=light] .sc-cw{--sc-bg:#ffffff;--sc-border:rgba(0,0,0,.08);--sc-text:#1a1d38;--sc-muted:#8890b4;--sc-grid:rgba(0,0,0,.06);}

/* ── Header ── */
.sc-hd{
  display:flex;align-items:center;justify-content:space-between;
  padding:16px 18px 0;gap:10px;flex-wrap:wrap;
}
.sc-title-wrap{ display:flex;flex-direction:column;gap:2px;min-width:0; }
.sc-title{font-size:.95rem;font-weight:700;color:var(--sc-text,#1a1d38);margin:0;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.sc-subtitle{font-size:.73rem;color:var(--sc-muted,#8890b4);margin:0;}

/* ── Controls row ── */
.sc-ctrl{
  display:flex;align-items:center;gap:6px;flex-wrap:wrap;
}

/* ── Range / type switcher buttons ── */
.sc-rbtn{
  padding:3px 9px;border-radius:6px;
  border:1px solid var(--sc-border,rgba(0,0,0,.1));
  background:transparent;color:var(--sc-muted,#8890b4);
  font-size:.72rem;font-weight:600;cursor:pointer;
  transition:all .15s;font-family:inherit;white-space:nowrap;
  display:inline-flex;align-items:center;gap:4px;
}
.sc-rbtn:hover{background:var(--sc-border,rgba(0,0,0,.06));color:var(--sc-text,#1a1d38);}
.sc-rbtn.active{
  background:linear-gradient(135deg,#6474f0,#818cf8);
  border-color:transparent;color:#fff;
  box-shadow:0 2px 8px rgba(100,116,240,.35);
}
.sc-rbtn.sc-clear{
  color:var(--sc-muted);border-color:transparent;
  background:rgba(248,113,113,.1);color:#f87171;
}
.sc-rbtn.sc-clear:hover{background:rgba(248,113,113,.2);}

/* ── Divider between control groups ── */
.sc-div{width:1px;height:18px;background:var(--sc-border,rgba(0,0,0,.1));margin:0 2px;flex-shrink:0;}

/* ── Toolbar icon buttons ── */
.sc-btn{
  padding:4px 8px;border-radius:7px;
  border:1px solid var(--sc-border,rgba(0,0,0,.1));
  background:transparent;color:var(--sc-muted,#8890b4);
  font-size:.74rem;cursor:pointer;
  display:inline-flex;align-items:center;gap:4px;
  transition:all .15s;white-space:nowrap;font-family:inherit;
}
.sc-btn:hover{background:var(--sc-border,rgba(0,0,0,.06));color:var(--sc-text,#1a1d38);}
.sc-btn.sc-active{background:linear-gradient(135deg,#6474f0,#818cf8);border-color:transparent;color:#fff;}

/* ── Filter badge ── */
.sc-filter-badge{
  display:inline-flex;align-items:center;gap:4px;
  padding:3px 8px;border-radius:20px;
  background:linear-gradient(135deg,rgba(100,116,240,.15),rgba(129,140,248,.1));
  border:1px solid rgba(100,116,240,.25);
  font-size:.7rem;font-weight:600;color:#818cf8;
  letter-spacing:.02em;
}

/* ── Canvas wrapper ── */
.sc-canv{position:relative;padding:8px 16px 16px;}

/* ── Skeleton loader ── */
.sc-skel{
  border-radius:10px;
  background:linear-gradient(90deg,
    var(--sc-border,#eef0f8) 25%,
    rgba(255,255,255,.6) 50%,
    var(--sc-border,#eef0f8) 75%);
  background-size:200% 100%;
  animation:sc-sh 1.6s ease-in-out infinite;
}
@keyframes sc-sh{0%{background-position:200% 0}100%{background-position:-200% 0}}

/* ── Error state ── */
.sc-err{
  padding:32px 18px;text-align:center;font-size:.85rem;
  color:#f87171;display:flex;flex-direction:column;align-items:center;gap:8px;
}
.sc-err-icon{font-size:1.6rem;}

/* ── Fullscreen overlay ── */
.sc-fs-overlay{
  position:fixed;inset:0;z-index:9998;
  background:rgba(0,0,0,.55);
  backdrop-filter:blur(4px);
  display:flex;align-items:center;justify-content:center;
  padding:20px;
  box-sizing:border-box;
  animation:sc-fsin .18s ease;
}
@keyframes sc-fsin{from{opacity:0}to{opacity:1}}
.sc-fs-box{
  background:var(--sc-fs-bg,#1a1d2e);
  border-radius:16px;
  border:1px solid rgba(255,255,255,.1);
  box-shadow:0 32px 80px rgba(0,0,0,.5);
  width:100%;height:100%;
  max-width:1400px;max-height:900px;
  display:flex;flex-direction:column;
  overflow:hidden;
  animation:sc-fsbox .2s cubic-bezier(.34,1.56,.64,1);
}
@keyframes sc-fsbox{from{transform:scale(.96);opacity:0}to{transform:scale(1);opacity:1}}
.sc-fs-box.light{--sc-fs-bg:#ffffff;}
.sc-fs-head{
  display:flex;align-items:center;justify-content:space-between;
  padding:14px 20px;
  border-bottom:1px solid rgba(255,255,255,.08);
  flex-shrink:0;
  gap:12px;flex-wrap:wrap;
}
.sc-fs-head.light{border-bottom-color:rgba(0,0,0,.08);}
.sc-fs-title{
  font-size:1rem;font-weight:700;letter-spacing:-.01em;
  color:#e4e8ff;margin:0;
}
.sc-fs-title.light{color:#1a1d38;}
.sc-fs-ctrl{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}
.sc-fs-body{flex:1;position:relative;padding:16px 20px 20px;min-height:0;}
.sc-fs-close{
  width:28px;height:28px;border-radius:50%;
  background:rgba(255,255,255,.08);border:none;
  color:#e4e8ff;font-size:1rem;cursor:pointer;
  display:flex;align-items:center;justify-content:center;
  transition:background .15s;flex-shrink:0;
}
.sc-fs-close:hover{background:rgba(255,255,255,.16);}
.sc-fs-close.light{background:rgba(0,0,0,.06);color:#1a1d38;}
.sc-fs-close.light:hover{background:rgba(0,0,0,.12);}
    `;
    document.head.appendChild(s);
  }

  /* ─── SmartChart ────────────────────────────────────────────────────────── */
  class SmartChart extends HTMLElement {
    static get observedAttributes() {
      return ['type','default-type','type-switcher','api','source','data','labels',
        'x-field','y-field','datasets','palette','title','subtitle','height',
        'fill','tension','point-radius','thresholds','goal-line','goal-label',
        'ranges','toolbar','export','refresh','loading','state-listen',
        'click-state','sync-group','response-path','no-zoom',
        'websocket','ws-mode','ws-max-points'];
    }

    constructor() {
      super();
      this._chart      = null;  this._fsChart   = null;
      this._poll       = null;  this._ctrl      = null;
      this._unsubs     = [];    this._rawData   = null;
      this._range      = null;  this._slUnsub   = null;
      this._obs        = null;  this._activeType= null;
      this._fsOverlay  = null;
      this._zoom       = null;   /* SmartZoom for inline chart */
      this._fsZoom     = null;   /* SmartZoom for fullscreen chart */
      this._ws         = null;   /* WebSocket instance */
      this._apexChart  = null;   /* ApexCharts live chart instance */
      this._apexP      = null;   /* ApexCharts load promise */
      this._wsStatsBar = null;   /* live stats bar element */
      this._wsPaused   = false;  /* true when tab is hidden */
      this._visHandler = null;   /* visibility change listener */
      this._wsXMin     = undefined; /* live scroll window minimum label */
      this._wsState    = null;      /* 'live'|'reconnecting'|'closed' */
    }

    connectedCallback() {
      _styles();
      this._chart = null; this._fsChart = null; this._poll = null; this._ctrl = null;
      this._unsubs = []; this._rawData = null; this._range = null; this._fsOverlay = null;
      this._zoom = null; this._fsZoom = null; this._ws = null; this._wsXMin = undefined; this._wsState = null; this._apexChart = null;
      this._activeType = this.getAttribute('default-type') || this.getAttribute('type') || 'bar';
      this._syncTheme();
      this._buildShell();
      this._initData();
      this._initStateListen();
      this._initSyncGroup();
      this._obs = new MutationObserver(this._syncTheme.bind(this));
      this._obs.observe(document.body, { attributes:true, attributeFilter:['class'] });
    }

    disconnectedCallback() {
      this._cleanup(true);
      if (this._obs) this._obs.disconnect();
      this._removeSyncGroup();
      this._closeFs();
    }

    attributeChangedCallback() {
      if (!this.isConnected || !this._unsubs) return;
      var newType = this.getAttribute('default-type') || this.getAttribute('type') || 'bar';
      if (!this._activeType) this._activeType = newType;
      this._cleanup(false);
      this._syncTheme();
      /* For live WS charts: don't re-call _initData (would re-open WS).
         Just rebuild the shell and re-render apex with buffered data. */
      if (this.getAttribute('websocket') && (this._ws || this._apexChart)) {
        this._buildShell();
        this._rebuildApexFromBuffer();
        this._initStateListen();
        return;
      }
      this._buildShell(); this._initData(); this._initStateListen();
    }

    /* ── Shell ─────────────────────────────────────────────────────────────── */
    _buildShell() {
      var title    = this.getAttribute('title')    || '';
      var subtitle = this.getAttribute('subtitle') || '';
      var height   = parseInt(this.getAttribute('height') || '320', 10);
      var ranges   = (this.getAttribute('ranges')       ||'').split(',').map(function(r){return r.trim();}).filter(Boolean);
      var tbItems  = (this.getAttribute('toolbar')      ||'').split(',').map(function(t){return t.trim();}).filter(Boolean);
      var expItems = (this.getAttribute('export')       ||'').split(',').map(function(e){return e.trim();}).filter(Boolean);
      var switcher = (this.getAttribute('type-switcher')||'').split(',').map(function(t){return t.trim();}).filter(Boolean);

      var ICONS = { download:'↓', fullscreen:'⛶', refresh:'↺', png:'PNG', csv:'CSV', json:'JSON', 'reset-zoom':'⊖ Zoom' };

      /* Range buttons */
      var rangeH = '';
      if (ranges.length) {
        var self0=this;
        rangeH = '<div style="display:flex;gap:3px;align-items:center;flex-wrap:wrap">'
          + ranges.map(function(r){
              var isActive=(r==='all'&&!self0._range)||(r===self0._range);
              return '<button class="sc-rbtn'+(isActive?' active':'')+'" data-range="'+_esc(r)+'">'+_esc(_rangeLabel(r))+'</button>';
            }).join('')
          + (this._range&&this._range!=='all'?'<button class="sc-rbtn sc-clear" data-range="__clear__">✕ Clear</button>':'')
          +'</div>';
      }

      /* Type switcher */
      var switchH = '';
      if (switcher.length) {
        switchH = '<div style="display:flex;gap:3px;align-items:center">'
          + switcher.map(function(t){
              var ic = TYPE_ICONS[t] || t;
              var isActive = t === this._activeType ? ' active' : '';
              return '<button class="sc-rbtn'+isActive+'" data-type-switch="'+_esc(t)+'" title="'+_esc(t)+'">'+ic+'</button>';
            }, this).join('')
          +'</div>';
      }

      /* Toolbar */
      var tbH = tbItems.map(function(t){
        return '<button class="sc-btn" data-action="'+_esc(t)+'">'+(ICONS[t]||t)+'</button>';
      }).join('') + expItems.map(function(e){
        return '<button class="sc-btn" data-action="export:'+_esc(e)+'">'+(ICONS[e]||e)+'</button>';
      }).join('')
      + (this.hasAttribute('no-zoom')
          ? ''
          : '<button class="sc-btn sc-zoom-reset" data-action="reset-zoom"'
            +' style="display:none;color:#818cf8;border-color:rgba(129,140,248,.35);">'
            +'&#8854; Reset zoom</button>');

      /* Filter badge */
      var badgeH = (this._range && this._range!=='all')
        ? '<span class="sc-filter-badge">⊙ '+_esc(_rangeLabel(this._range))+'</span>' : '';

      var hasControls = title||subtitle||ranges.length||tbItems.length||expItems.length||switcher.length;
      var ctrlSection = (ranges.length||switcher.length||tbItems.length||expItems.length)
        ? '<div class="sc-ctrl">'
            +(rangeH&&switchH?rangeH+'<div class="sc-div"></div>'+switchH : rangeH+switchH)
            +(tbH?'<div class="sc-div"></div>'+tbH:'')
          +'</div>'
        : '';

      var hdH = hasControls
        ? '<div class="sc-hd">'
            +'<div class="sc-title-wrap">'
              +(title?'<h3 class="sc-title">'+_esc(title)+(badgeH?' '+badgeH:'')+'</h3>':'')
              +(subtitle?'<p class="sc-subtitle">'+_esc(subtitle)+'</p>':'')
            +'</div>'
            +ctrlSection
          +'</div>'
        : '';

      var skelH = '<div class="sc-skel" style="height:'+height+'px;border-radius:10px;"></div>';
      this.innerHTML = '<div class="sc-cw">'+hdH+'<div class="sc-canv">'+skelH+'</div></div>';
      this._wrap = this.querySelector('.sc-canv');

      /* Restore live/reconnecting label if WS is active */
      if (this.hasAttribute('ws-show-status') && this._wsState) {
        this._applyWsStatusLabel();
      }

      var self = this;

      /* Range buttons */
      this.querySelectorAll('.sc-rbtn[data-range]').forEach(function(btn){
        btn.addEventListener('click', function(){
          var r = btn.dataset.range;
          if (r==='__clear__') { self._range=null; } else { self._range=(r==='all'?null:r); }
          self._rebuildShellAndRender();
        });
      });

      /* Type switcher buttons */
      this.querySelectorAll('.sc-rbtn[data-type-switch]').forEach(function(btn){
        btn.addEventListener('click', function(){
          self._activeType = btn.dataset.typeSwitch;
          self._rebuildShellAndRender();
        });
      });

      /* Toolbar buttons */
      this.querySelectorAll('.sc-btn[data-action]').forEach(function(btn){
        btn.addEventListener('click', function(){ self._handleToolbar(btn.dataset.action); });
      });
    }

    /* Rebuild header (to update active states) then re-render chart */
    _rebuildShellAndRender() {
      if (this._zoom)  { this._zoom.destroy();  this._zoom=null; }
      if (this._chart) { try{this._chart.destroy();}catch(e){} this._chart=null; }

      /* For live WS charts: destroy apex instance before wiping innerHTML */
      if (this._apexChart) {
        try { this._apexChart.destroy(); } catch(e) {}
        this._apexChart = null;
      }

      this._buildShell();

      /* Live WS chart — re-render ApexCharts with existing buffered data */
      if (this.getAttribute('websocket')) {
        this._rebuildApexFromBuffer();
        return;
      }

      if (this._rawData) this._render(this._rawData);
    }

    /* Re-create the ApexCharts instance using the buffered rawData after a
       type-switch or range change. The WS stays connected throughout. */
    _rebuildApexFromBuffer() {
      var self = this;
      if (!self._rawData || !self._rawData.length) return;

      var xField  = self.getAttribute('x-field')  || '__t__';
      var yField  = self.getAttribute('y-field')  || '';
      var dsConf  = _json(self.getAttribute('datasets') || '', null);
      var palette = self.getAttribute('palette')   || 'material';

      /* Re-resolve fieldKeys from existing rawData */
      var firstRow = self._rawData[0] || {};
      var fieldKeys;
      if (dsConf && dsConf.length) {
        fieldKeys = dsConf.map(function(d){ return d.field; });
      } else if (yField) {
        fieldKeys = [yField];
      } else {
        var lk = xField || Object.keys(firstRow)[0];
        fieldKeys = Object.keys(firstRow).filter(function(k){
          return k !== lk && _num(firstRow[k]) !== null;
        });
      }
      if (!fieldKeys.length) return;

      self._loadApex().then(function() {
        /* Build new instance — _buildApexChart wipes _wrap and creates fresh container */
        self._apexChart = self._buildApexChart(fieldKeys, palette);
        if (!self._apexChart) return;

        /* Populate with existing buffered data */
        var lk2 = xField || '__t__';
        var series = fieldKeys.map(function(fk) {
          return {
            name: fk,
            data: self._rawData.map(function(r){ return { x: String(r[lk2] || ''), y: _num(r[fk]) }; }),
          };
        });
        self._apexChart.updateSeries(series, true);
      });
    }

    /* ── Data init ──────────────────────────────────────────────────────────── */
    _initData() {
      var inlineData = this.getAttribute('data');
      if (inlineData) {
        this._rawData = { values:_json(inlineData,[]), labels:_json(this.getAttribute('labels'),[]) };
        this._render(this._rawData); return;
      }
      var source = this.getAttribute('source');
      if (source) { this._subSource(source); }
      else {
        var api = this.getAttribute('api');
        if (api) { this._fetchApi(api); this._startPoll(); }
        else if (!this.getAttribute('websocket')) { this._showErr('No data source.'); return; }
      }
      /* WebSocket runs alongside any source as a live-update layer */
      var wsUrl = this.getAttribute('websocket');
      if (wsUrl) this._initWs(wsUrl);
    }

    _subSource(key) {
      this._clearUnsubs();
      var self = this;
      if (global.smartState) {
        var existing = global.smartState.get(key);
        if (existing!=null) { self._rawData=existing; self._render(existing); }
        var stH = function(val){ self._rawData=val; self._render(val); };
        global.smartState.subscribe(key, stH);
        self._unsubs.push(function(){ global.smartState.unsubscribe(key, stH); });
      }
      var evH = function(e){ if(e.detail&&e.detail.key===key){ self._rawData=e.detail.data; self._render(e.detail.data); } };
      global.addEventListener('smart-data-loaded', evH);
      self._unsubs.push(function(){ global.removeEventListener('smart-data-loaded', evH); });
    }

        /* ── WebSocket live data (powered by ApexCharts) ────────────────────────
       ApexCharts has native built-in streaming with smooth entry/exit animation,
       autoScaleYaxis, proper right-to-left scrolling, and reliable annotations.
       Chart.js is still used for all static (REST/source/inline) charts.

       websocket="ws://host/ws/sales/"   WS URL
       ws-mode="append"                  append (default) | replace
       ws-max-points="200"               rolling window size (default 200)
       ws-show-status                     show ⬤ Live / ↺ Reconnecting

       Append message format:
         { "label": "14:32:07", "values": { "sales": 450 } }
         or flat: { "date": "2026-03-17", "sales": 450 }
    ─────────────────────────────────────────────────────────────────────── */

    /* ── ApexCharts loader (singleton promise) ── */
    _loadApex() {
      if (global.ApexCharts) return Promise.resolve(global.ApexCharts);
      if (this._apexP) return this._apexP;
      this._apexP = new Promise(function(resolve, reject) {
        var s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/apexcharts@3/dist/apexcharts.min.js';
        s.onload = function(){ resolve(global.ApexCharts); };
        s.onerror = reject;
        document.head.appendChild(s);
      });
      return this._apexP;
    }

    /* ── Build the live ApexCharts instance ── */
    _buildApexChart(fieldKeys, palette) {
      var self      = this;
      var isDark    = this.dataset.theme === 'dark' || (!this.dataset.theme && global.matchMedia && global.matchMedia('(prefers-color-scheme:dark)').matches);
      var maxPts    = parseInt(this.getAttribute('ws-max-points') || '200', 10);
      var logType   = this._activeType || 'area';
      /* Multi-series always uses line — area fills overlap badly with 2+ series */
      var apexType  = fieldKeys.length > 1 ? 'line'
                    : (logType === 'bar') ? 'bar'
                    : (logType === 'line') ? 'line' : 'area';
      var colors    = _pal(palette || 'material', fieldKeys.length);
      var height    = parseInt(self.getAttribute('height') || '320', 10);
      var axisColor = isDark ? '#6b7194' : '#9398b8';
      var lblColor  = isDark ? '#d4d8f0' : '#1a1d38';
      var bgCard    = isDark ? 'rgba(20,23,40,.96)' : 'rgba(255,255,255,.97)';
      var bdCard    = isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.08)';

      /* ── Threshold + goal annotations ── */
      var yAnno = [];
      var thrAttr = this.getAttribute('thresholds');
      if (thrAttr) {
        var thr = _json(thrAttr, {});
        for (var tv in thr) {
          if (!Object.prototype.hasOwnProperty.call(thr, tv)) continue;
          var tc = thr[tv];
          var pc = tc.startsWith('#') ? _rgba(tc, .7) : tc;
          yAnno.push({ y: +tv, borderColor: pc, borderWidth: 1, strokeDashArray: 6,
            label: { text: String(tv), position: 'right',
              style: { color: '#fff', background: pc, fontSize: '10px', fontWeight: 500, padding: { top:2,bottom:2,left:5,right:5 } } } });
        }
      }
      var gv = this.getAttribute('goal-line');
      if (gv && !isNaN(+gv)) {
        yAnno.push({ y: +gv, borderColor: '#22c55e', borderWidth: 3, strokeDashArray: 0,
          label: { text: this.getAttribute('goal-label') || ('Goal: ' + gv), position: 'left',
            style: { color: '#fff', background: 'rgba(34,197,94,.85)', fontSize: '11px', fontWeight: 700,
              padding: { top:4,bottom:4,left:8,right:8 } } } });
      }

      /* ── Smart features: velocity and trend state ── */
      self._wsVelocity = 0;   /* rate of change per second */
      self._wsPrev     = null; /* previous value (first series) for delta */

      /* ── Destroy existing before wiping DOM ── */
      if (self._apexChart) { try { self._apexChart.destroy(); } catch(e) {} self._apexChart = null; }

      var wrap = self._wrap;
      if (!wrap) return null;
      wrap.innerHTML = '';

      /* ── Stats bar (Feature 2 + 4a: latest value readout + trend) ── */
      var statsBar = document.createElement('div');
      statsBar.className = 'sc-live-stats';
      statsBar.style.cssText = [
        'display:flex;align-items:center;gap:16px;flex-wrap:wrap;',
        'padding:0 4px 10px;',
      ].join('');
      wrap.appendChild(statsBar);
      self._wsStatsBar = statsBar;

      /* Initialise stat chips — one per series */
      fieldKeys.forEach(function(fk, i) {
        var chip = document.createElement('div');
        chip.dataset.field = fk;
        chip.style.cssText = 'display:flex;flex-direction:column;gap:1px;min-width:80px;';
        chip.innerHTML =
          '<span style="font-size:.68rem;font-weight:500;color:' + colors[i] + ';letter-spacing:.05em;text-transform:uppercase;">'
            + _esc(fk) + '</span>'
          + '<div style="display:flex;align-items:baseline;gap:5px;">'
            + '<span class="sc-live-val" style="font-size:1.5rem;font-weight:700;color:' + lblColor + ';line-height:1;">—</span>'
            + '<span class="sc-live-delta" style="font-size:.72rem;font-weight:600;"></span>'
          + '</div>'
          + '<span class="sc-live-vel" style="font-size:.65rem;color:' + axisColor + ';"></span>';
        statsBar.appendChild(chip);
      });

      /* ── Chart container ── */
      var container = document.createElement('div');
      container.style.cssText = 'width:100%;height:' + height + 'px;';
      wrap.appendChild(container);

      /* ── Custom tooltip matching static chart style ── */
      var customTooltip = function(opts2) {
        var dps  = opts2.dataPointIndex;
        var sIdx = opts2.seriesIndex;
        var series2 = opts2.w.globals.initialSeries;
        var label = (opts2.w.globals.labels || [])[dps] || '';

        var html = '<div style="'
          + 'background:' + bgCard + ';'
          + 'border:1px solid ' + bdCard + ';'
          + 'border-radius:12px;padding:10px 14px;min-width:120px;'
          + 'box-shadow:0 8px 24px rgba(0,0,0,.18);'
          + 'font-family:system-ui,-apple-system,\"Segoe UI\",sans-serif;">';

        /* Date/time label — small muted */
        html += '<div style="font-size:11px;font-weight:400;color:'
          + (isDark ? 'rgba(212,216,240,.5)' : 'rgba(26,29,56,.4)')
          + ';margin-bottom:6px;letter-spacing:.02em;">' + _esc(String(label)) + '</div>';

        /* One row per series */
        series2.forEach(function(s, i) {
          var v = s.data && s.data[dps] !== undefined ? s.data[dps].y : null;
          if (v == null) return;
          var fmt = typeof v === 'number'
            ? (v >= 1000 ? v.toLocaleString() : parseFloat(v.toFixed(2)).toString())
            : String(v);
          var c = (opts2.w.globals.colors || colors)[i] || colors[i % colors.length];
          html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">'
            + '<span style="width:8px;height:8px;border-radius:50%;background:' + c + ';display:inline-block;flex-shrink:0;"></span>'
            + '<span style="font-size:11px;font-weight:500;color:'
            + (isDark ? 'rgba(212,216,240,.65)' : 'rgba(26,29,56,.55)') + ';">'
            + _esc(String(s.name || '')) + '</span></div>'
            + '<div style="font-size:22px;font-weight:700;color:' + lblColor
            + ';line-height:1.1;margin-bottom:4px;padding-left:14px;">' + _esc(fmt) + '</div>';
        });
        html += '</div>';
        return html;
      };

      var opts = {
        series: fieldKeys.map(function(fk){ return { name: fk, data: [] }; }),
        chart: {
          type: apexType,
          height: height,
          animations: { enabled: true, easing: 'linear', dynamicAnimation: { speed: 800 } },
          toolbar: { show: false },
          zoom:    { enabled: false },
          background: 'transparent',
          foreColor: axisColor,
          events: {
            /* Feature 4c: auto-pause when page hidden, resume on visible */
            mounted: function(chartCtx) {
              if (self._visHandler) document.removeEventListener('visibilitychange', self._visHandler);
              self._visHandler = function() {
                if (!self._ws) return;
                /* We can't pause the WS itself, but we can pause ApexCharts updates */
                self._wsPaused = document.hidden;
              };
              document.addEventListener('visibilitychange', self._visHandler);
            },
          },
        },
        dataLabels: {
          /* Feature 2: show value label only on the very last (newest) point */
          enabled: true,
          enabledOnSeries: fieldKeys.map(function(_, i){ return i; }),
          formatter: function(val, opts3) {
            /* Only render the label for the rightmost point */
            var totalPts = opts3.w.globals.dataPoints;
            if (opts3.dataPointIndex !== totalPts - 1) return '';
            if (val == null) return '';
            return typeof val === 'number'
              ? (val >= 1000 ? val.toLocaleString() : parseFloat(val.toFixed(2)).toString())
              : String(val);
          },
          background: {
            enabled: true,
            foreColor: isDark ? '#1a1d2e' : '#fff',
            borderRadius: 6,
            padding: 4,
            opacity: 0.92,
            borderWidth: 0,
          },
          style: { fontSize: '11px', fontWeight: '700', colors: colors },
          offsetY: -8,
        },
        stroke: { curve: 'smooth', width: fieldKeys.map(function(){ return 2; }) },
        fill: apexType === 'area' ? {
          type: 'gradient',
          gradient: { shadeIntensity: 1, inverseColors: false, opacityFrom: 0.45, opacityTo: 0.02, stops: [0, 85, 100] },
        } : { opacity: apexType === 'bar' ? 0.7 : 1 },
        colors: colors,
        markers: { size: 0, hover: { size: 5 } },
        xaxis: {
          type: 'category', tickAmount: 8,
          labels: { rotate: 0, style: { fontSize: '11px', colors: axisColor } },
          axisBorder: { show: false }, axisTicks: { show: false },
        },
        yaxis: {
          forceNiceScale: true,
          labels: {
            style: { fontSize: '11px', colors: axisColor },
            formatter: function(v) {
              return typeof v === 'number' && v >= 1000 ? v.toLocaleString()
                : (v != null ? parseFloat(v.toFixed(2)).toString() : '');
            },
          },
        },
        grid: { borderColor: isDark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.06)', strokeDashArray: 4 },
        legend: {
          show: fieldKeys.length > 1,
          labels: { colors: lblColor },
          markers: { width: 8, height: 8, radius: 4 },
        },
        tooltip: { custom: customTooltip },
        annotations: { yaxis: yAnno },
        theme: { mode: isDark ? 'dark' : 'light' },
      };

      var apx = new global.ApexCharts(container, opts);
      apx.render();
      return apx;
    }

    /* ── Update the live stats bar (Feature 2 + 4) after each new data point ── */
    _updateWsStats(fieldKeys, vals, colors, isDark) {
      var bar = this._wsStatsBar;
      if (!bar) return;
      var lblColor = isDark ? '#d4d8f0' : '#1a1d38';
      var axisColor = isDark ? '#6b7194' : '#9398b8';
      var rd = this._rawData || [];

      fieldKeys.forEach(function(fk, i) {
        var chip = bar.querySelector('[data-field="' + fk + '"]');
        if (!chip) return;
        var v = _num(vals[fk]);
        if (v == null) return;

        /* Latest value */
        var valEl = chip.querySelector('.sc-live-val');
        if (valEl) {
          valEl.textContent = v >= 1000 ? v.toLocaleString() : parseFloat(v.toFixed(2)).toString();
        }

        /* Feature 4a: Trend delta (change from previous point) */
        if (i === 0 && rd.length >= 2) {
          var prev = _num(rd[rd.length - 2][fk]);
          var deltaEl = chip.querySelector('.sc-live-delta');
          if (deltaEl && prev != null && prev !== 0) {
            var delta = v - prev;
            var pct   = ((delta / Math.abs(prev)) * 100).toFixed(1);
            var up    = delta >= 0;
            deltaEl.textContent = (up ? '▲ +' : '▼ ') + pct + '%';
            deltaEl.style.color = up ? '#22c55e' : '#f87171';
          }
        }

        /* Feature 4b: Velocity (change per second, shown for first series) */
        if (i === 0 && rd.length >= 2) {
          var vel = _num(rd[rd.length - 1][fk]) - _num(rd[rd.length - 2][fk]);
          var velEl = chip.querySelector('.sc-live-vel');
          if (velEl) {
            velEl.textContent = 'Δ ' + (vel >= 0 ? '+' : '') + parseFloat(vel.toFixed(2)).toString() + ' / tick';
          }
        }
      });
    }

    _initWs(url) {
      this._closeWs();
      var self    = this;
      var mode    = (this.getAttribute('ws-mode') || 'append').toLowerCase();
      var maxPts  = parseInt(this.getAttribute('ws-max-points') || '200', 10);
      var palette = this.getAttribute('palette') || 'material';
      var delay   = 1000, maxDelay = 30000, stopped = false;

      /* Resolve field keys from attributes (read once; re-read on each message for replace mode) */
      var xField   = this.getAttribute('x-field')  || '';
      var yField   = this.getAttribute('y-field')  || '';
      var dsConf   = _json(this.getAttribute('datasets') || '', null);
      var fieldKeys = null; /* resolved from first message */

      /* Load ApexCharts, then open WebSocket */
      self._loadApex().then(function() {
        function connect() {
          if (stopped) return;
          var ws;
          try { ws = new WebSocket(url); } catch(e) { console.error('[SmartChart WS]', e); return; }
          self._ws = ws;

          ws.onopen = function() { delay = 1000; self._wsStatus('live'); };

          ws.onmessage = function(evt) {
            var msg; try { msg = JSON.parse(evt.data); } catch(e) { return; }
          
            if (mode === 'replace') {
              var d = Array.isArray(msg) ? msg : (msg.results || msg.data || msg);
              if (Array.isArray(d)) { self._rawData = d; self._render(d); }
              return;
            }
          
            /* ── Normalise message ── */
            var labelStr, vals;
            if (msg.label !== undefined && msg.values !== undefined) {
              labelStr = String(msg.label); vals = msg.values;
            } else {
              labelStr = xField && msg[xField] !== undefined ? String(msg[xField]) : new Date().toLocaleTimeString();
              vals = msg;
            }
          
            /* ── Resolve field keys from first message ── */
            if (!fieldKeys) {
              if (dsConf && dsConf.length) {
                fieldKeys = dsConf.map(function(d){ return d.field; });
              } else if (yField) {
                fieldKeys = [yField];
              } else {
                fieldKeys = Object.keys(vals).filter(function(k){
                  return k !== xField && _num(vals[k]) !== null;
                });
              }
              if (!fieldKeys.length) {
                console.warn('[SmartChart WS] No plottable fields. Set y-field= on the element. vals:', vals);
                return;
              }
            }
          
            /* ── Build ApexCharts instance on first message ── */
            if (!self._apexChart) {
              self._apexChart = self._buildApexChart(fieldKeys, palette);
              if (!self._apexChart) return;
              /* Disable zoom overlay since it's a live chart */
              self._zoom = null;
            }
          
            /* ── Append new point ── */
            var newPt = fieldKeys.map(function(fk) {
              return { x: labelStr, y: _num(vals[fk]) };
            });
          
            /* Keep rawData in sync for export */
            if (!self._rawData) self._rawData = [];
            var row = {}; row[xField || '__t__'] = labelStr;
            fieldKeys.forEach(function(fk){ row[fk] = _num(vals[fk]); });
            self._rawData.push(row);
            if (self._rawData.length > maxPts) self._rawData.shift();
          
            /* Feature 4d: skip render when tab is hidden — saves CPU */
            if (self._wsPaused) return;
          
            /* appendData adds to the right with built-in slide-in animation */
            self._apexChart.appendData(
              fieldKeys.map(function(fk) {
                return { data: [{ x: labelStr, y: _num(vals[fk]) }] };
              })
            );
          
            /* Update stat strip + newest-point annotation - FIXED: changed _updateApexExtras to _updateWsStats */
            self._updateWsStats(fieldKeys, vals, _pal(palette || 'material', fieldKeys.length), 
              self.dataset.theme === 'dark' || (!self.dataset.theme && global.matchMedia && global.matchMedia('(prefers-color-scheme:dark)').matches));
          
            /* Once over limit: rebuild full series so oldest point is dropped.
               ApexCharts animates the entry; updateSeries redraws the trimmed
               window cleanly. The oldest point has already scrolled off the
               visible left edge so its removal is invisible. */
            if (self._rawData.length > maxPts) {
              self._rawData.shift();
              var lk2 = xField || '__t__';
              var trimmed = fieldKeys.map(function(fk) {
                return {
                  name: fk,
                  data: self._rawData.map(function(r){ return { x: String(r[lk2]), y: _num(r[fk]) }; }),
                };
              });
              /* animate:false keeps the trim instant so it doesn't fight the entry */
              self._apexChart.updateSeries(trimmed, false);
            }
          };

          ws.onerror = function(e) { console.warn('[SmartChart WS] error', e); };
          ws.onclose = function() {
            self._wsStatus('reconnecting');
            if (stopped) return;
            setTimeout(connect, delay);
            delay = Math.min(delay * 2, maxDelay);
          };
        }
        connect();
      }).catch(function(e){ console.error('[SmartChart WS] ApexCharts load failed:', e); });

      this._wsStop = function() { stopped = true; };
    }

    /* ApexCharts instance is stored separately from _chart (Chart.js) */
    _wsAppend(msg, xField, yField, dsConf, maxPts) {
      /* No-op — live append is handled entirely inside _initWs via ApexCharts */
    }

    _wsStatus(state){
      this.dispatchEvent(new CustomEvent('smart-chart-ws-status',
        {bubbles:true,detail:{state:state}}));
      /* Store current WS state so _buildShell can restore it after a rebuild */
      this._wsState = state;
      if(this.hasAttribute('ws-show-status')){
        this._applyWsStatusLabel();
      }
    }

    _applyWsStatusLabel(){
      var state = this._wsState;
      if (!state || state === 'closed') return;
      /* Find or create the subtitle element */
      var el = this.querySelector('.sc-subtitle');
      if (!el) {
        /* No subtitle attr set — inject one into the title-wrap */
        var wrap = this.querySelector('.sc-title-wrap');
        if (!wrap) return;
        el = document.createElement('p');
        el.className = 'sc-subtitle';
        wrap.appendChild(el);
      }
      el.textContent = state === 'live' ? '⬤ Live' : '↺ Reconnecting…';
      el.style.color  = state === 'live' ? '#22c55e'   : '#f59e0b';
      el.style.fontWeight = '600';
    }

    _closeWs(){
      if(this._wsStop){this._wsStop();this._wsStop=null;}
      if(this._ws){try{this._ws.close(1000);}catch(e){}this._ws=null;}
      if(this._apexChart){try{this._apexChart.destroy();}catch(e){}this._apexChart=null;}
      if(this._visHandler){document.removeEventListener('visibilitychange',this._visHandler);this._visHandler=null;}
      this._wsPaused=false;
      this._wsStatsBar=null;
      this._wsStatus('closed');
    }

    _clearUnsubs() { if(this._unsubs){this._unsubs.forEach(function(fn){try{fn();}catch(e){}});} this._unsubs=[]; }

    async _fetchApi(url) {
      if (this._ctrl) this._ctrl.abort();
      this._ctrl = new AbortController();
      var fetchUrl = url + (this._range&&this._range!=='all' ? (url.includes('?')?'&':'?')+'range='+this._range : '');
      try {
        var res = await fetch(fetchUrl, {signal:this._ctrl.signal, headers:{'Accept':'application/json'}});
        if (!res.ok) throw new Error('HTTP '+res.status);
        var data = await res.json();
        var path = this.getAttribute('response-path');
        if (path) data = _dotGet(data, path);
        this._rawData = data; this._render(data);
      } catch(err) { if(err.name==='AbortError')return; this._showErr('Fetch failed: '+err.message); }
    }

    _startPoll() {
      if (this._poll){clearInterval(this._poll);this._poll=null;}
      var ms=_ms(this.getAttribute('refresh')); if(!ms)return;
      var self=this;
      this._poll=setInterval(function(){var api=self.getAttribute('api');if(api)self._fetchApi(api);},ms);
    }

    _initStateListen() {
      if(this._slUnsub){try{this._slUnsub();}catch(e){}this._slUnsub=null;}
      var key=this.getAttribute('state-listen');
      if(!key||!global.smartState)return;
      var self=this;
      var h=function(){
        var source=self.getAttribute('source');
        var api=self.getAttribute('api');
        if(source){
          var latest=global.smartState?global.smartState.get(source):null;
          if(latest!=null) self._rawData=latest;
          if(self._rawData) self._render(self._rawData);
        } else if(api){
          self._fetchApi(api);
        } else if(self._rawData){
          self._render(self._rawData);
        }
      };
      global.smartState.subscribe(key,h);
      this._slUnsub=function(){global.smartState.unsubscribe(key,h);};
    }

    _initSyncGroup() { var g=this.getAttribute('sync-group');if(!g)return;if(!_syncGroups[g])_syncGroups[g]=new Set();_syncGroups[g].add(this); }
    _removeSyncGroup() { var g=this.getAttribute('sync-group');if(g&&_syncGroups[g])_syncGroups[g].delete(this); }

    /* ── Render ──────────────────────────────────────────────────────────────── */
    async _render(rawData) {
      try {
        var Chart = await _loadCjs();
        this._clearSkel();

        /* Apply local date-range filter when we have x-field */
        var xField   = this.getAttribute('x-field') || '';
        var filtered = (this._range && this._range!=='all' && xField)
          ? _filterByRange(rawData, xField, this._range)
          : rawData;

        var mapped = this._mapData(filtered);
        var config = this._buildConfig(mapped.labels, mapped.datasets);

        if (this._chart) {
          this._chart.data.labels   = config.data.labels;
          this._chart.data.datasets = config.data.datasets;
          if (config.options.plugins&&config.options.plugins.annotation)
            this._chart.options.plugins.annotation=config.options.plugins.annotation;
          this._chart.update('active');
          /* Keep SmartZoom snapshot current so reset returns to this filtered view */
          if (this._zoom) this._zoom.updateSnapshot(config.data.labels, config.data.datasets);
        } else {
          this._buildCanvas();
          var canvas = this._wrap&&this._wrap.querySelector('canvas');
          if (!canvas){this._showErr('Canvas build failed.');return;}
          this._chart = new Chart(canvas, config);
          /* Attach native drag-to-zoom immediately after Chart.js init */
          var wrapDiv   = this._wrap && this._wrap.querySelector('div');
          var resetBtn  = this._wrap && this._wrap.closest('.sc-cw') &&
                          this._wrap.closest('.sc-cw').querySelector('.sc-zoom-reset');
          if (this._zoom) { this._zoom.destroy(); this._zoom = null; }
          this._zoom = this._attachZoom(this._chart, wrapDiv, resetBtn);
        }

        this.dispatchEvent(new CustomEvent('smart-chart-loaded',{bubbles:true,detail:{key:this.getAttribute('source')||this.getAttribute('api')||''}}));
      } catch(err){ console.error('[SmartChart] render error:',err); this._showErr('Render failed: '+err.message); }
    }

    _clearSkel() { if(!this._wrap)return; var s=this._wrap.querySelector('.sc-skel');if(s)s.remove(); }

    _buildCanvas() {
      if (!this._wrap) return;
      var height = parseInt(this.getAttribute('height')||'320',10);
      this._wrap.innerHTML='';
      var div=document.createElement('div');
      div.style.cssText='position:relative;width:100%;height:'+height+'px;';
      div.appendChild(document.createElement('canvas'));
      this._wrap.appendChild(div);
    }

    /* Create a SmartZoom instance for a chart + its container div.
       Returns null when zoom is disabled:
         • no-zoom attribute set explicitly
         • websocket attribute set (live charts — zoom makes no sense on streaming data)
         • polar/pie chart types */
    _attachZoom(chartInst, wrapDiv, resetBtnEl) {
      if (this.hasAttribute('no-zoom')) return null;
      /* Disable drag-zoom on live WebSocket charts — data is constantly moving */
      if (this.getAttribute('websocket')) return null;
      var t = this._activeType === 'area' ? 'line' : (this._activeType || 'bar');
      var noscale = ['pie','doughnut','radar','polarArea'].indexOf(t) !== -1;
      if (noscale) return null;
      return new SmartZoom(
        chartInst,
        wrapDiv,
        /* onZoom  */ function(){ if(resetBtnEl) resetBtnEl.style.display=''; },
        /* onReset */ function(){ if(resetBtnEl) resetBtnEl.style.display='none'; }
      );
    }

    /* ── Data mapping ──────────────────────────────────────────────────────── */
    _mapData(rawData) {
      var xField  = this.getAttribute('x-field')     || '';
      var yField  = this.getAttribute('y-field')     || '';
      var dsAttr  = this.getAttribute('datasets')    || '';
      var palette = this.getAttribute('palette')     || 'material';
      /* Resolve logical type exactly as _buildConfig does */
      var logicalType = this._activeType || 'bar';
      var fill    = logicalType==='area';
      var isArea  = logicalType==='area';
      var tension = parseFloat(this.getAttribute('tension')||'0.4');
      var ptR     = parseFloat(this.getAttribute('point-radius')||'3');
      var baseT   = isArea ? 'line'
                  : logicalType==='step' ? 'line'
                  : logicalType==='horizontalBar' ? 'bar'
                  : logicalType;
      var dsConf  = _json(dsAttr,null);
      var labels=[],datasets=[];

      /* Gradient fill builder — returns a stable scriptable function.
         Chart.js calls this once per render; the gradient is recreated only
         when the chart area changes (resize), not on every data update. */
      var self = this;
      function _gradFill(color) {
        if (!fill) return _rgba(color, .65);
        var _cachedGrad = null, _cachedH = -1;
        return function(context) {
          var chart = context.chart, ctx = chart.ctx, area = chart.chartArea;
          if (!area) return _rgba(color, .4);
          var h = area.bottom - area.top;
          /* Recreate gradient only when height changes (resize / first render) */
          if (!_cachedGrad || Math.abs(h - _cachedH) > 1) {
            _cachedH    = h;
            _cachedGrad = ctx.createLinearGradient(0, area.top, 0, area.bottom);
            _cachedGrad.addColorStop(0,   _rgba(color, .5));
            _cachedGrad.addColorStop(0.45, _rgba(color, .18));
            _cachedGrad.addColorStop(1,   _rgba(color, .01));
          }
          return _cachedGrad;
        };
      }

      /* Live WS charts: hide individual dots, use monotone curve for smoothness */
      var isLive = !!self.getAttribute('websocket');

      function _makeDs(label, data, color, dsType) {
        var isBar2 = dsType==='bar';
        var useFill = fill && !isBar2;
        return {
          label: label,
          data: data,
          type: dsType,
          backgroundColor: isBar2 ? _rgba(color,.7) : _gradFill(color),
          borderColor: color,
          borderWidth: isBar2 ? 0 : 2,
          borderRadius: isBar2 ? 4 : 0,
          fill: useFill,
          tension: isLive ? 0.5 : tension,
          cubicInterpolationMode: isLive ? 'monotone' : 'default',
          /* Stepped line (staircase) */
          stepped: (logicalType==='step') ? 'before' : undefined,
          spanGaps: true,
          /* Allow the line to draw slightly outside the chart area — this makes
             the exit of old points invisible (they slide off past the y-axis)
             rather than being hard-clipped with a visible cut */
          clip: isLive ? false : undefined,
          /* Live charts: no dots per-point (too noisy), only show on hover */
          pointRadius:          isLive ? 0   : ptR,
          pointHoverRadius:     isLive ? 5   : ptR+2,
          pointHoverBorderWidth:isLive ? 2   : 1.5,
          pointBackgroundColor: color,
          pointBorderColor: '#fff',
          pointBorderWidth: 1.5,
        };
      }

      /* inline { values, labels } */
      if (rawData&&!Array.isArray(rawData)&&rawData.values!==undefined) {
        var c0=_pal(palette,1)[0];
        return {labels:rawData.labels||[], datasets:[_makeDs(this.getAttribute('title')||'Data',rawData.values,c0,baseT)]};
      }
      /* already Chart.js format */
      if (rawData&&!Array.isArray(rawData)&&rawData.labels&&rawData.datasets)
        return {labels:rawData.labels,datasets:rawData.datasets};

      if (Array.isArray(rawData)) {
        /* A: explicit datasets */
        if (dsConf&&dsConf.length>0) {
          var colors=_pal(palette,dsConf.length);
          labels=rawData.map(function(row){return xField?String(row[xField]!=null?row[xField]:''):'';});
          datasets=dsConf.map(function(ds,i){
            var c=ds.color||colors[i], dsT=ds.type||(fill?'line':baseT);
            return _makeDs(ds.label||ds.field||('S'+(i+1)), rawData.map(function(row){return _num(row[ds.field]);}), c, dsT);
          });
        /* B: x-field + y-field */
        } else if (xField&&yField) {
          var c1=_pal(palette,1)[0];
          labels=rawData.map(function(row){return String(row[xField]!=null?row[xField]:'');});
          datasets=[_makeDs(this.getAttribute('title')||yField, rawData.map(function(row){return _num(row[yField]);}), c1, baseT)];
        /* C: auto-detect */
        } else if (rawData.length>0&&typeof rawData[0]==='object'&&rawData[0]!==null) {
          var keys=Object.keys(rawData[0]), lKey=xField||keys[0];
          var vKeys=yField?[yField]:keys.filter(function(k){
            if(k===lKey)return false;
            for(var i=0;i<rawData.length;i++){if(rawData[i][k]!==null&&rawData[i][k]!==undefined)return _num(rawData[i][k])!==null;}
            return false;
          });
          if(!vKeys.length){console.warn('[SmartChart] Auto-detect: no numeric fields. Add x-field + y-field.');return{labels:[],datasets:[]};}
          var colors2=_pal(palette,vKeys.length);
          labels=rawData.map(function(row){return String(row[lKey]!=null?row[lKey]:'');});
          datasets=vKeys.map(function(k,i){return _makeDs(k,rawData.map(function(row){return _num(row[k]);}),colors2[i],baseT);});
        /* D: flat array */
        } else {
          var c3=_pal(palette,1)[0];
          labels=rawData.map(function(_,i){return String(i+1);});
          datasets=[_makeDs(this.getAttribute('title')||'Data',rawData.map(function(v){return _num(v);}),c3,baseT)];
        }
        return {labels:labels,datasets:datasets};
      }
      return {labels:[],datasets:[]};
    }

    /* ── Chart.js config ────────────────────────────────────────────────────── */
    _buildConfig(labels, datasets) {
      /* Resolve logical type → Chart.js type + options */
      var logicalType = this._activeType || 'bar';
      var baseT = logicalType==='area'?'line'
                : logicalType==='step'?'line'
                : logicalType==='horizontalBar'?'bar'
                : logicalType;
      var isStepped      = logicalType==='step';
      var isHorizontal   = logicalType==='horizontalBar';
      var isDark = this.dataset.theme==='dark'||(!this.dataset.theme&&global.matchMedia&&global.matchMedia('(prefers-color-scheme:dark)').matches);
      var grid   = isDark?'rgba(255,255,255,.05)':'rgba(0,0,0,.06)';
      var text   = isDark?'#6b7194':'#9398b8';
      var lbl    = isDark?'#d4d8f0':'#1a1d38';
      var tooltipBg   = isDark?'rgba(20,23,40,.95)':'rgba(255,255,255,.97)';
      var tooltipBorder= isDark?'rgba(255,255,255,.08)':'rgba(0,0,0,.08)';
      var tooltipText = isDark?'#d4d8f0':'#1a1d38';

      /* ── Annotations ───────────────────────────────────────────────────────
         Threshold lines: thin (1px), long-dash, muted/semi-transparent colour,
                          text-only label — reads as a subtle warning band
         Goal line:       thick (3px), solid with tiny tick marks, vivid green,
                          pill label with background — reads as a clear target
      ─────────────────────────────────────────────────────────────────────── */
      var annotations={}, thrAttr=this.getAttribute('thresholds'), ai=0;
      if (thrAttr) {
        var thr=_json(thrAttr,{});
        for(var val in thr){if(!Object.prototype.hasOwnProperty.call(thr,val))continue;
          var tColor=thr[val];
          var parsedColor=tColor.startsWith('#')?_rgba(tColor,.6):tColor;
          annotations['thr'+ai]={
            type:'line', yMin:+val, yMax:+val,
            borderColor:parsedColor, borderWidth:1, borderDash:[8,5],
            label:{
              display:true,
              content:String(val),
              position:'end',
              color:'#fff',
              font:{size:10,weight:'500'},
              backgroundColor:parsedColor,
              padding:{x:4,y:2},
            },
          };ai++;}
      }
      var gv=this.getAttribute('goal-line');
      if(gv&&!isNaN(+gv)){
        var goalLabel=this.getAttribute('goal-label')||'Goal: '+gv;
        annotations.goal={
          type:'line', yMin:+gv, yMax:+gv,
          /* Thick solid line — the primary target, visually dominant */
          borderColor:'#22c55e', borderWidth:3, borderDash:[],
          label:{
            display:true,
            content:goalLabel,
            position:'start',
            /* Vivid green pill with opaque background — unmistakable */
            color:'#fff',
            font:{size:11,weight:'700'},
            backgroundColor:'rgba(34,197,94,.85)',
            padding:{x:8,y:4},
            borderRadius:6,
          },
        };
      }

      var hasAnno=Object.keys(annotations).length>0;
      var noScale=['pie','doughnut','radar','polarArea'].indexOf(baseT)!==-1;
      var isScatter=logicalType==='scatter'||logicalType==='bubble';
      var self=this;

      return {
        type: baseT,
        data: {labels:labels,datasets:datasets},
        options: {
          responsive:true, maintainAspectRatio:false,
          /* indexAxis:'y' turns bar chart horizontal */
          indexAxis: isHorizontal ? 'y' : 'x',
          animation:{ duration:450, easing:'easeOutCubic' },

          interaction:{mode:'index',intersect:false},
          plugins: Object.assign({
            legend:{
              display: datasets.length>1,
              labels:{
                color:lbl,
                font:{size:12,family:"system-ui,-apple-system,'Segoe UI',sans-serif",weight:'500'},
                boxWidth:10,boxHeight:10,borderRadius:3,padding:16,
                usePointStyle:true,pointStyleWidth:10,
              },
            },
            tooltip:{
              enabled: false,
              external: function(context) {
                var chart   = context.chart;
                var tooltip = context.tooltip;

                /* Store tooltip div ON the chart instance — never getElementById.
                   This guarantees complete isolation between charts on the page.
                   A global lookup by ID breaks when two charts share the same
                   auto-generated canvas id or when the id is an empty string. */
                var tt = chart._scTt;
                if (!tt) {
                  tt = document.createElement('div');
                  tt.style.cssText = [
                    'position:absolute;pointer-events:none;opacity:0;',
                    'background:' + tooltipBg + ';',
                    'border:1px solid ' + tooltipBorder + ';',
                    'border-radius:12px;padding:10px 14px;min-width:120px;',
                    'box-shadow:0 8px 24px rgba(0,0,0,.18);',
                    'transition:opacity .15s ease;',
                    "font-family:system-ui,-apple-system,'Segoe UI',sans-serif;",
                    'z-index:100;',
                  ].join('');
                  var wrap = chart.canvas.parentNode;
                  wrap.style.position = 'relative';
                  wrap.style.overflow = 'visible';
                  wrap.appendChild(tt);
                  chart._scTt = tt;  /* attach to this chart instance only */
                }

                if (tooltip.opacity === 0) { tt.style.opacity = '0'; return; }
                tt.style.opacity = '1';

                /* ── Build inner HTML ── */
                var html = '';
                /* Date/time label — small, muted */
                if (tooltip.title && tooltip.title[0]) {
                  html += '<div style="font-size:11px;font-weight:400;color:'
                    + (isDark ? 'rgba(212,216,240,.5)' : 'rgba(26,29,56,.4)')
                    + ';margin-bottom:6px;letter-spacing:.02em;">'
                    + _esc(String(tooltip.title[0])) + '</div>';
                }
                /* One row per dataset */
                (tooltip.dataPoints || []).forEach(function(dp) {
                  var v = dp.parsed.y;
                  if (v == null) return;
                  var formatted = typeof v === 'number'
                    ? (v >= 1000 ? v.toLocaleString() : parseFloat(v.toFixed(2)).toString())
                    : String(v);
                  var color = dp.dataset.borderColor || '#6474f0';
                  /* Dataset name line */
                  html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">'
                    + '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;'
                    +   'background:' + color + ';flex-shrink:0;"></span>'
                    + '<span style="font-size:11px;font-weight:500;color:'
                    +   (isDark ? 'rgba(212,216,240,.65)' : 'rgba(26,29,56,.55)') + ';">'
                    + _esc(String(dp.dataset.label || '')) + '</span>'
                    + '</div>';
                  /* Value line — large, bold, full colour */
                  html += '<div style="font-size:22px;font-weight:700;color:' + lbl
                    + ';line-height:1.1;margin-bottom:4px;padding-left:14px;">'
                    + _esc(formatted) + '</div>';
                });
                tt.innerHTML = html;

                /* ── Position tooltip ── */
                var canvasRect = chart.canvas.getBoundingClientRect();
                var wrapRect   = chart.canvas.parentNode.getBoundingClientRect();
                var tx = tooltip.caretX + 12;
                var ty = tooltip.caretY - tt.offsetHeight / 2;
                /* Flip left if overflowing right */
                if (tx + tt.offsetWidth > wrapRect.width - 8)
                  tx = tooltip.caretX - tt.offsetWidth - 12;
                /* Clamp top */
                ty = Math.max(4, Math.min(ty, wrapRect.height - tt.offsetHeight - 4));
                tt.style.left = tx + 'px';
                tt.style.top  = ty + 'px';
              },
            },
          },
          /* Always pass annotation config — Chart.js silently ignores it if plugin not loaded */
          hasAnno?{annotation:{annotations:annotations}}:{}
          ),
          scales: noScale ? {} : {
            x:{
              /* category labels; Chart.js auto-ranges to the data */
              ticks:{
                color:text,
                font:{size:11,family:"system-ui,-apple-system,'Segoe UI',sans-serif"},
                maxRotation:0,
                autoSkip:true,
                maxTicksLimit:10,
              },
              grid:{color:grid,drawBorder:false},
              border:{dash:[4,4],color:'transparent'},
            },
            y:{
              /* Auto-scale from data min — grace prevents the line touching edges */
              grace: '8%',
              /* Smooth y-scale rescaling — Chart.js 4 respects this per-axis */
              ticks:{
                color:text,
                font:{size:11,family:"system-ui,-apple-system,'Segoe UI',sans-serif"},
                padding:8,
                maxTicksLimit:6,
                callback:function(v){ return typeof v==='number'&&v>=1000?v.toLocaleString():v; },
              },
              grid:{color:grid,drawBorder:false},
              border:{dash:[4,4],color:'transparent'},
            },
          },
          onClick:function(evt,els){
            if(!els.length)return;
            var el=els[0],lbl2=labels[el.index],val=datasets[el.datasetIndex]&&datasets[el.datasetIndex].data[el.index];
            var det={label:lbl2,value:val,datasetIndex:el.datasetIndex,index:el.index};
            var ck=self.getAttribute('click-state');if(ck&&global.smartState)global.smartState.set(ck,det);
            self.dispatchEvent(new CustomEvent('smart-chart-click',{bubbles:true,detail:det}));
            var grp=self.getAttribute('sync-group');
            if(grp&&_syncGroups[grp])_syncGroups[grp].forEach(function(peer){
              if(peer!==self&&peer._chart)try{peer._chart.tooltip.setActiveElements([{datasetIndex:0,index:el.index}],{x:0,y:0});peer._chart.update('none');}catch(e){}
            });
          },
        },
      };
    }

    /* ── Fullscreen overlay ──────────────────────────────────────────────────── */
    _openFs() {
      if (this._fsOverlay) return;
      var self     = this;
      var isDark   = this.dataset.theme === 'dark';
      var title    = this.getAttribute('title') || '';
      var ranges   = (this.getAttribute('ranges')||'').split(',').map(function(r){return r.trim();}).filter(Boolean);
      var switcher = (this.getAttribute('type-switcher')||'').split(',').map(function(t){return t.trim();}).filter(Boolean);

      /* Build range buttons for FS header */
      var fsRangeH = ranges.map(function(r){
        var isActive=(r==='all'&&!self._range)||(r===self._range);
        return '<button class="sc-rbtn'+(isActive?' active':'')+'" data-fs-range="'+_esc(r)+'">'+_esc(_rangeLabel(r))+'</button>';
      }).join('') + (this._range&&this._range!=='all'?'<button class="sc-rbtn sc-clear" data-fs-range="__clear__">✕</button>':'');

      /* Build type switcher for FS header */
      var fsSwH = switcher.map(function(t){
        var ic=TYPE_ICONS[t]||t;
        return '<button class="sc-rbtn'+(t===self._activeType?' active':'')+'" data-fs-type="'+_esc(t)+'" title="'+_esc(t)+'">'+ic+'</button>';
      }).join('');

      var overlay = document.createElement('div');
      overlay.className = 'sc-fs-overlay';
      overlay.innerHTML =
        '<div class="sc-fs-box'+(isDark?'':' light')+'">'
          +'<div class="sc-fs-head'+(isDark?'':' light')+'">'
            +'<h3 class="sc-fs-title'+(isDark?'':' light')+'">'+_esc(title)+'</h3>'
            +'<div class="sc-fs-ctrl">'
              +(fsRangeH?'<div style="display:flex;gap:3px">'+fsRangeH+'</div>':'')
              +(fsSwH&&fsRangeH?'<div style="width:1px;height:18px;background:rgba(255,255,255,.1);margin:0 2px"></div>':'')
              +(fsSwH?'<div style="display:flex;gap:3px">'+fsSwH+'</div>':'')
              +'<button class="sc-btn" data-fs-reset style="display:none">&#8854; Reset Zoom</button>'
            +'</div>'
            +'<button class="sc-fs-close'+(isDark?'':' light')+'" data-fs-close>✕</button>'
          +'</div>'
          +'<div class="sc-fs-body"></div>'
        +'</div>';

      document.body.appendChild(overlay);
      this._fsOverlay = overlay;

      /* Bind close */
      overlay.querySelector('[data-fs-close]').addEventListener('click', function(){ self._closeFs(); });
      overlay.addEventListener('click', function(e){ if(e.target===overlay) self._closeFs(); });
      document.addEventListener('keydown', this._onFsKey = function(e){ if(e.key==='Escape') self._closeFs(); });

      /* Update FS chart in-place — no close/reopen flash */
      function _updateFsChart() {
        if (!self._fsChart||!self._rawData) return;
        var xF=self.getAttribute('x-field')||'';
        var filtered=(self._range&&self._range!=='all'&&xF)
          ?_filterByRange(self._rawData,xF,self._range)
          :self._rawData;
        var mapped=self._mapData(filtered);
        self._fsChart.data.labels=mapped.labels;
        self._fsChart.data.datasets=mapped.datasets;
        self._fsChart.update('active');
        /* Sync range button active states */
        overlay.querySelectorAll('[data-fs-range]').forEach(function(b){
          var r=b.dataset.fsRange;
          b.classList.toggle('active',(r==='all'&&!self._range)||(r===self._range));
        });
        /* Sync type button active states */
        overlay.querySelectorAll('[data-fs-type]').forEach(function(b){
          b.classList.toggle('active',b.dataset.fsType===self._activeType);
        });
        /* Reset SmartZoom when range changes */
        if (self._fsZoom) self._fsZoom.reset();
        if (self._fsZoom) self._fsZoom.updateSnapshot(mapped.labels, mapped.datasets);
        if (fsReset) fsReset.style.display='none';
        /* Sync inline chart too */
        self._rebuildShellAndRender();
      }

      /* Bind FS range buttons */
      overlay.querySelectorAll('[data-fs-range]').forEach(function(btn){
        btn.addEventListener('click', function(){
          var r=btn.dataset.fsRange;
          self._range=(r==='__clear__'||r==='all')?null:r;
          _updateFsChart();
        });
      });

      /* Bind FS type buttons */
      overlay.querySelectorAll('[data-fs-type]').forEach(function(btn){
        btn.addEventListener('click', function(){
          self._activeType=btn.dataset.fsType;
          if (self._fsChart) {
            /* Rebuild FS chart with new type */
            var xF=self.getAttribute('x-field')||'';
            var filtered=(self._range&&self._range!=='all'&&xF)
              ?_filterByRange(self._rawData||[],xF,self._range)
              :(self._rawData||[]);
            var mapped=self._mapData(filtered);
            var cfg=self._buildConfig(mapped.labels,mapped.datasets);
            if (self._fsZoom) { self._fsZoom.destroy(); self._fsZoom = null; }
            self._fsChart.destroy(); self._fsChart=null;
            /* Reuse existing canvas */
            var cv=body.querySelector('canvas');
            if(cv&&global.Chart){
              self._fsChart=new global.Chart(cv,cfg);
              var fsdiv=body.querySelector('div');
              self._fsZoom=self._attachZoom(self._fsChart, fsdiv, fsReset);
            }
            /* Sync active state */
            overlay.querySelectorAll('[data-fs-type]').forEach(function(b){
              b.classList.toggle('active',b.dataset.fsType===self._activeType);
            });
            self._rebuildShellAndRender();
          }
        });
      });

      /* Build canvas in FS body and render */
      var body = overlay.querySelector('.sc-fs-body');
      var div  = document.createElement('div');
      div.style.cssText='position:relative;width:100%;height:100%;';
      var canvas=document.createElement('canvas');
      div.appendChild(canvas); body.appendChild(div);

      var fsReset = overlay.querySelector('[data-fs-reset]');
      if (fsReset) {
        fsReset.addEventListener('click', function(){
          if (self._fsZoom) self._fsZoom.reset();
          fsReset.style.display='none';
        });
      }

      /* Drag-to-zoom hint toast (fades after 3 s) */
      if (!self.hasAttribute('no-zoom')) {
        var hint=document.createElement('div');
        hint.style.cssText='position:absolute;bottom:24px;left:50%;transform:translateX(-50%);'
          +'background:rgba(0,0,0,.65);color:rgba(255,255,255,.9);'
          +'padding:5px 14px;border-radius:20px;font-size:.72rem;pointer-events:none;'
          +'opacity:1;transition:opacity 1.4s ease;z-index:5;white-space:nowrap;'
          +'border:1px solid rgba(100,116,240,.3);';
        hint.textContent='\u2922 Drag to zoom in  \u00b7  Double-click to reset';
        body.style.position='relative';
        body.appendChild(hint);
        setTimeout(function(){hint.style.opacity='0';},2600);
        setTimeout(function(){if(hint.parentNode)hint.remove();},4000);
      }

      _loadCjs().then(function(Chart){
        if (!self._fsOverlay) return;
        var xField   = self.getAttribute('x-field')||'';
        var filtered = (self._range&&self._range!=='all'&&xField)
          ? _filterByRange(self._rawData||[], xField, self._range)
          : (self._rawData||[]);
        var mapped = self._mapData(filtered);
        var config = self._buildConfig(mapped.labels, mapped.datasets);
        if (config.options&&config.options.plugins&&config.options.plugins.zoom&&config.options.plugins.zoom.zoom) {
          config.options.plugins.zoom.zoom.onZoomComplete = function(){
            if(fsReset) fsReset.style.display='';
          };
        }
        self._fsChart = new Chart(canvas, config);
        /* Attach SmartZoom to the fullscreen chart */
        if (self._fsZoom) { self._fsZoom.destroy(); self._fsZoom = null; }
        self._fsZoom = self._attachZoom(self._fsChart, div, fsReset);
      });
    }

    _closeFs() {
      if (this._fsZoom)  { try{this._fsZoom.destroy();}catch(e){}  this._fsZoom=null; }
      if (this._fsChart) { try{this._fsChart.destroy();}catch(e){} this._fsChart=null; }
      if (this._fsOverlay){ try{this._fsOverlay.remove();}catch(e){} this._fsOverlay=null; }
      if (this._onFsKey) { document.removeEventListener('keydown',this._onFsKey); this._onFsKey=null; }
    }

    _resetZoom() {
      if (this._zoom)   this._zoom.reset();
      if (this._fsZoom) this._fsZoom.reset();
    }

    /* ── Toolbar ────────────────────────────────────────────────────────────── */
    _handleToolbar(action) {
      if (!action) return;
      if (action==='refresh')    { var api=this.getAttribute('api');if(api){this._fetchApi(api);return;} var src=this.getAttribute('source');if(src){this._subSource(src);return;} return; }
      if (action==='fullscreen') { this._openFs(); return; }
      if (action==='reset-zoom'){ this._resetZoom(); return; }
      if (action==='download'||action==='export:png') { this._expPng(); return; }
      if (action==='export:csv')  { this._expCsv(); return; }
      if (action==='export:json') { this._expJson(); return; }
    }

    _expPng(){ if(!this._chart)return; var a=document.createElement('a');a.href=this._chart.toBase64Image();a.download=(this.getAttribute('title')||'chart')+'.png';a.click(); }
    _expCsv(){
      if(!this._chart)return;
      var l=this._chart.data.labels,d=this._chart.data.datasets;
      var h=['Label'].concat(d.map(function(x){return x.label||'';})).join(',');
      var r=l.map(function(lb,i){return [lb].concat(d.map(function(x){return x.data[i]!=null?x.data[i]:''})).join(',');});
      this._dl([h].concat(r).join('\n'),'text/csv',(this.getAttribute('title')||'chart')+'.csv');
    }
    _expJson(){ if(!this._rawData)return; this._dl(JSON.stringify(this._rawData,null,2),'application/json',(this.getAttribute('title')||'chart')+'.json'); }
    _dl(c,m,n){ var b=new Blob([c],{type:m}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=n;a.click();URL.revokeObjectURL(a.href); }

    /* ── Helpers ────────────────────────────────────────────────────────────── */
    _showErr(msg){ if(this._wrap)this._wrap.innerHTML='<div class="sc-err"><span class="sc-err-icon">⚠</span>'+_esc(msg)+'</div>'; }
    _syncTheme(){ this.dataset.theme=document.body.classList.contains('light-mode')?'light':'dark'; }

    _cleanup(dom) {
      /* dom=true  → full teardown (element disconnected from page)
         dom=false → partial reset for type/range change; keep WS + apex alive */
      if (dom) {
        /* Full teardown: close WS, destroy apex, remove everything */
        this._closeWs();
        if(this._apexChart){try{this._apexChart.destroy();}catch(e){}this._apexChart=null;}
      }
      /* Always clean up Chart.js instance and zoom */
      if(this._zoom)    {try{this._zoom.destroy();}catch(e){}this._zoom=null;}
      if(this._chart)   {try{this._chart.destroy();}catch(e){}this._chart=null;}
      if(this._poll)    {clearInterval(this._poll);this._poll=null;}
      if(this._ctrl)    {try{this._ctrl.abort();}catch(e){}this._ctrl=null;}
      if(this._slUnsub) {try{this._slUnsub();}catch(e){}this._slUnsub=null;}
      this._clearUnsubs();
      this._closeFs();
      if(dom) this.innerHTML='';
    }
  }

  customElements.define('smart-chart', SmartChart);

}(window));