/**
 * SmartImage - A declarative, attribute-driven Web Component
 * Supports: lazy loading, shimmer/spinner skeleton, fallback, fade-in,
 * caption, rounded/circle/hover-zoom/click-preview, aspect-ratio, fit
 */

class SmartImage extends HTMLElement {
  constructor() {
    super();
    this._observer = null;
    this._loaded = false;
    this._failed = false;
    this._retryCount = 0;
  }

  static get observedAttributes() {
    return [
      'src', 'fallback-src', 'caption', 'alt',
      'width', 'height', 'aspect-ratio', 'fit',
      'animation-type', 'rounded', 'circle',
      'hover-zoom', 'click-preview', 'lazy'
    ];
  }

  connectedCallback() {
    this._injectStyles();
    if (!this.validateAttributes()) return;
    this._build();
  }

  disconnectedCallback() {
    if (this._observer) this._observer.disconnect();
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (oldVal !== newVal && this.isConnected) {
      this._loaded = false;
      this._failed = false;
      this._retryCount = 0;
      this._build();
    }
  }

  // ─── Validate ────────────────────────────────────────────────────────────────

  validateAttributes() {
    if (!this.getAttribute('src')) {
      console.error('[SmartImage] Required attribute "src" is missing.');
      this.innerHTML = `<div class="si-broken"><svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#adb5bd" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9l6 6M15 9l-6 6"/></svg><span>Image unavailable</span></div>`;
      return false;
    }
    return true;
  }

  // ─── Build ───────────────────────────────────────────────────────────────────

  _build() {
    const src = this.getAttribute('src');
    const width = this.getAttribute('width');
    const height = this.getAttribute('height');
    const aspectRatio = this.getAttribute('aspect-ratio');
    const fit = this.getAttribute('fit') || 'cover';
    const isCircle = this.hasAttribute('circle');
    const isRounded = this.hasAttribute('rounded');
    const hoverZoom = this.hasAttribute('hover-zoom');
    const isLazy = this.getAttribute('lazy') !== 'false'; // default true
    const animType = this.getAttribute('animation-type') ||
      ((width && height) ? 'shimmer' : 'spinner');

    this.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'si-wrapper';

    if (width) wrapper.style.width = isNaN(width) ? width : `${width}px`;
    if (height) wrapper.style.height = isNaN(height) ? height : `${height}px`;
    if (aspectRatio) wrapper.style.aspectRatio = aspectRatio;
    if (isCircle) wrapper.classList.add('si-circle');
    else if (isRounded) wrapper.classList.add('si-rounded');
    if (hoverZoom) wrapper.classList.add('si-hover-zoom');

    // Skeleton placeholder
    wrapper.appendChild(this.renderSkeleton(animType));

    this.appendChild(wrapper);
    this.renderCaption();

    if (isLazy) {
      this.setupObserver(src, wrapper, fit);
    } else {
      this.loadImage(src, wrapper, fit);
    }
  }

  // ─── Observer ────────────────────────────────────────────────────────────────

  setupObserver(src, wrapper, fit) {
    if (this._observer) this._observer.disconnect();
    this._observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        this._observer.disconnect();
        this.loadImage(src, wrapper, fit);
      }
    }, { threshold: 0.1, rootMargin: '100px' });
    this._observer.observe(wrapper);
  }

  // ─── Load Image ──────────────────────────────────────────────────────────────

  loadImage(src, wrapper, fit) {
    const img = new Image();

    img.onload = () => {
      this._loaded = true;
      this.renderImage(src, wrapper, fit);
    };

    img.onerror = () => {
      this.handleError(wrapper, fit);
    };

    img.src = src;
  }

  // ─── Error ───────────────────────────────────────────────────────────────────

  handleError(wrapper, fit) {
    this._failed = true;
    const fallback = this.getAttribute('fallback-src');

    if (fallback && this._retryCount === 0) {
      this._retryCount++;
      this.loadImage(fallback, wrapper, fit);
      return;
    }

    const skeleton = wrapper.querySelector('.si-skeleton');
    if (skeleton) skeleton.remove();

    const errorEl = document.createElement('div');
    errorEl.className = 'si-broken';
    errorEl.innerHTML = `
      <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#adb5bd" stroke-width="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <path d="M3 9l5-5 4 4 4-4 5 5"/>
        <circle cx="8.5" cy="7.5" r="1"/>
      </svg>
      <span>Image failed to load</span>
      <button class="si-retry btn btn-sm btn-outline-secondary">Retry</button>
    `;

    errorEl.querySelector('.si-retry').addEventListener('click', () => {
      this._failed = false;
      this._retryCount = 0;
      errorEl.remove();
      wrapper.appendChild(this.renderSkeleton(
        this.getAttribute('animation-type') || ((this.getAttribute('width') && this.getAttribute('height')) ? 'shimmer' : 'spinner')
      ));
      this.loadImage(this.getAttribute('src'), wrapper, fit);
    });

    wrapper.appendChild(errorEl);
    this.dispatchEvent(new CustomEvent('image-error', { detail: { src: this.getAttribute('src') } }));
  }

  // ─── Render Skeleton ─────────────────────────────────────────────────────────

  renderSkeleton(type) {
    const el = document.createElement('div');
    el.className = `si-skeleton si-skeleton-${type}`;

    if (type === 'spinner') {
      el.innerHTML = `<div class="si-spinner"></div>`;
    }

    return el;
  }

  // ─── Render Image ────────────────────────────────────────────────────────────

  renderImage(src, wrapper, fit) {
    const skeleton = wrapper.querySelector('.si-skeleton');

    const imgEl = document.createElement('img');
    imgEl.src = src;
    imgEl.alt = this.getAttribute('alt') || '';
    imgEl.className = 'si-img';
    imgEl.style.objectFit = fit;

    const clickPreview = this.hasAttribute('click-preview');
    if (clickPreview) {
      imgEl.style.cursor = 'zoom-in';
      imgEl.addEventListener('click', () => this._openPreview(src));
    }

    wrapper.appendChild(imgEl);

    // Trigger fade-in after paint
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        imgEl.classList.add('si-img-visible');
        if (skeleton) {
          skeleton.style.opacity = '0';
          setTimeout(() => skeleton.remove(), 300);
        }
      });
    });

    this.dispatchEvent(new CustomEvent('image-loaded', { detail: { src } }));
  }

  // ─── Caption ─────────────────────────────────────────────────────────────────

  renderCaption() {
    const caption = this.getAttribute('caption');
    if (!caption) return;

    const existing = this.querySelector('.si-caption');
    if (existing) existing.remove();

    const el = document.createElement('p');
    el.className = 'si-caption text-muted';
    el.textContent = caption;
    this.appendChild(el);
  }

  // ─── Click Preview Modal ─────────────────────────────────────────────────────

  _openPreview(src) {
    const existing = document.getElementById('si-preview-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'si-preview-modal';
    modal.className = 'si-preview-overlay';
    modal.innerHTML = `
      <div class="si-preview-dialog">
        <button class="si-preview-close" aria-label="Close">✕</button>
        <img src="${src}" class="si-preview-img" alt="" />
      </div>
    `;

    const close = () => {
      modal.style.opacity = '0';
      setTimeout(() => modal.remove(), 200);
    };

    modal.addEventListener('click', e => { if (e.target === modal) close(); });
    modal.querySelector('.si-preview-close').addEventListener('click', close);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); }, { once: true });

    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.style.opacity = '1');
  }

  // ─── Styles ──────────────────────────────────────────────────────────────────

  _injectStyles() {
    if (document.getElementById('smart-image-styles')) return;
    const style = document.createElement('style');
    style.id = 'smart-image-styles';
    style.textContent = `
      smart-image {
        display: inline-block;
        vertical-align: top;
      }
      .si-wrapper {
        position: relative;
        overflow: hidden;
        background: #f1f3f5;
        display: block;
        width: 100%;
        min-width: 40px;
        min-height: 40px;
      }
      .si-rounded {
        border-radius: 10px;
      }
      .si-circle {
        border-radius: 50%;
      }
      .si-hover-zoom .si-img {
        transition: transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.3s !important;
      }
      .si-hover-zoom:hover .si-img {
        transform: scale(1.07);
      }
      .si-skeleton {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: opacity 0.3s;
        z-index: 1;
      }
      .si-skeleton-shimmer {
        background: linear-gradient(90deg, #e9ecef 25%, #f8f9fa 50%, #e9ecef 75%);
        background-size: 200% 100%;
        animation: si-shimmer 1.4s infinite;
      }
      @keyframes si-shimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
      .si-skeleton-spinner {
        background: #f1f3f5;
      }
      .si-spinner {
        width: 28px;
        height: 28px;
        border: 3px solid #dee2e6;
        border-top-color: #6c757d;
        border-radius: 50%;
        animation: si-spin 0.7s linear infinite;
      }
      @keyframes si-spin {
        to { transform: rotate(360deg); }
      }
      .si-img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
        opacity: 0;
        transition: opacity 0.35s ease;
        position: relative;
        z-index: 2;
      }
      .si-img-visible {
        opacity: 1;
      }
      .si-broken {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 1.5rem;
        background: #f8f9fa;
        height: 100%;
        min-height: 100px;
        color: #6c757d;
        font-size: 0.8rem;
        text-align: center;
      }
      .si-retry {
        margin-top: 4px;
        font-size: 0.75rem;
      }
      .si-caption {
        font-size: 0.8rem;
        margin: 0.35rem 0 0;
        text-align: center;
      }
      /* Preview Modal */
      .si-preview-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.85);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        opacity: 0;
        transition: opacity 0.2s;
        cursor: zoom-out;
      }
      .si-preview-dialog {
        position: relative;
        max-width: 90vw;
        max-height: 90vh;
      }
      .si-preview-img {
        display: block;
        max-width: 90vw;
        max-height: 90vh;
        border-radius: 8px;
        box-shadow: 0 30px 80px rgba(0,0,0,0.5);
        object-fit: contain;
        cursor: default;
      }
      .si-preview-close {
        position: absolute;
        top: -14px;
        right: -14px;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: #fff;
        border: none;
        cursor: pointer;
        font-size: 0.85rem;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        z-index: 1;
        transition: background 0.15s;
      }
      .si-preview-close:hover {
        background: #f8f9fa;
      }
    `;
    document.head.appendChild(style);
  }
}

customElements.define('smart-image', SmartImage);