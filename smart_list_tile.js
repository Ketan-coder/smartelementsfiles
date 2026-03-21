class SmartListTile extends HTMLElement {
    constructor() {
        super();
        this._isActive = false;
        this._rendered = false;
        this._injectStyles();
    }

    static get observedAttributes() {
        return [
            'leading-icon', 'title', 'subtitle', 'trailing-icon', 
            'max-lines', 'active', 'active-color', 'clickable', 'disabled',
            'text-color', 'background-color', 'icon-color', 'border-radius', 'border', 'scale'
        ];
    }

    // Inject CSS styles into the document head
    _injectStyles() {
        if (document.getElementById('smart-list-tile-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'smart-list-tile-styles';
        styles.textContent = `
            smart-list-tile {
                display: block;
                transform-origin: top left;
                transition: transform 0.2s ease;
            }

            .smart-list-tile-inner {
                display: flex;
                align-items: center;
                padding: 1rem;
                border-bottom: 1px solid var(--bs-border-color, #dee2e6);
                cursor: pointer;
                transition: all 0.2s ease;
                background: var(--bs-body-bg, #fff);
                text-decoration: none;
                color: inherit;
                position: relative;
                overflow: hidden;
                border-radius: 0;
                border: none;
            }

            .smart-list-tile-inner.custom-border {
                border-bottom: none;
            }

            .smart-list-tile-inner:hover {
                background-color: var(--bs-gray-100, #f8f9fa);
                transform: translateY(-1px);
            }

            .smart-list-tile-inner:active {
                transform: translateY(0);
            }

            .smart-list-tile-inner.active {
                background-color: var(--bs-primary, #0d6efd);
                color: white;
            }

            .smart-list-tile-inner.active-success {
                background-color: var(--bs-success, #198754);
                color: white;
            }

            .smart-list-tile-inner.active-warning {
                background-color: var(--bs-warning, #ffc107);
                color: var(--bs-gray-900, #212529);
            }

            .smart-list-tile-inner.active-danger {
                background-color: var(--bs-danger, #dc3545);
                color: white;
            }

            .smart-list-tile-inner.active-info {
                background-color: var(--bs-info, #0dcaf0);
                color: white;
            }

            .smart-list-tile-inner.disabled {
                opacity: 0.6;
                cursor: not-allowed;
            }

            .smart-list-tile-inner.disabled:hover {
                background-color: var(--bs-body-bg, #fff);
                transform: none;
            }

            smart-list-tile:last-child .smart-list-tile-inner {
                border-bottom: none;
            }

            .list-tile-leading {
                flex-shrink: 0;
                margin-right: 1rem;
                width: 40px;
                height: 40px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                background-color: var(--bs-gray-100, #f8f9fa);
                color: var(--bs-gray-600, #6c757d);
                font-size: 1.2rem;
            }

            .smart-list-tile-inner.active .list-tile-leading,
            .smart-list-tile-inner.active-success .list-tile-leading,
            .smart-list-tile-inner.active-danger .list-tile-leading,
            .smart-list-tile-inner.active-info .list-tile-leading {
                background-color: rgba(255, 255, 255, 0.2);
                color: white;
            }

            .smart-list-tile-inner.active-warning .list-tile-leading {
                background-color: rgba(0, 0, 0, 0.1);
                color: var(--bs-gray-800, #343a40);
            }

            .list-tile-content {
                flex: 1;
                min-width: 0;
            }

            .list-tile-title {
                font-weight: 600;
                font-size: 1rem;
                margin: 0 0 0.25rem 0;
                color: var(--bs-gray-900, #212529);
                line-height: 1.4;
            }

            .smart-list-tile-inner.active .list-tile-title,
            .smart-list-tile-inner.active-success .list-tile-title,
            .smart-list-tile-inner.active-danger .list-tile-title,
            .smart-list-tile-inner.active-info .list-tile-title {
                color: white;
            }

            .smart-list-tile-inner.active-warning .list-tile-title {
                color: var(--bs-gray-900, #212529);
            }

            .list-tile-subtitle {
                font-size: 0.875rem;
                color: var(--bs-gray-600, #6c757d);
                margin: 0;
                line-height: 1.4;
                display: -webkit-box;
                -webkit-box-orient: vertical;
                overflow: hidden;
            }

            .smart-list-tile-inner.active .list-tile-subtitle,
            .smart-list-tile-inner.active-success .list-tile-subtitle,
            .smart-list-tile-inner.active-danger .list-tile-subtitle,
            .smart-list-tile-inner.active-info .list-tile-subtitle {
                color: rgba(255, 255, 255, 0.8);
            }

            .smart-list-tile-inner.active-warning .list-tile-subtitle {
                color: var(--bs-gray-700, #495057);
            }

            .list-tile-subtitle.max-lines-1 {
                -webkit-line-clamp: 1;
            }

            .list-tile-subtitle.max-lines-2 {
                -webkit-line-clamp: 2;
            }

            .list-tile-subtitle.max-lines-3 {
                -webkit-line-clamp: 3;
            }

            .list-tile-trailing {
                flex-shrink: 0;
                margin-left: 1rem;
                color: var(--bs-gray-500, #adb5bd);
                font-size: 1rem;
            }

            .smart-list-tile-inner.active .list-tile-trailing,
            .smart-list-tile-inner.active-success .list-tile-trailing,
            .smart-list-tile-inner.active-danger .list-tile-trailing,
            .smart-list-tile-inner.active-info .list-tile-trailing {
                color: rgba(255, 255, 255, 0.8);
            }

            .smart-list-tile-inner.active-warning .list-tile-trailing {
                color: var(--bs-gray-700, #495057);
            }
        `;
        document.head.appendChild(styles);
    }

    // Getters and Setters
    get active() {
        return this._isActive;
    }

    set active(value) {
        const wasActive = this._isActive;
        this._isActive = Boolean(value);
        
        if (this._rendered) {
            this._updateActiveState();
            
            if (wasActive !== this._isActive) {
                this.dispatchEvent(new CustomEvent(this._isActive ? 'tile-activate' : 'tile-deactivate', {
                    bubbles: true,
                    detail: { tile: this }
                }));
            }
        }
    }

    get leadingIcon() {
        return this.getAttribute('leading-icon') || '';
    }

    set leadingIcon(value) {
        this.setAttribute('leading-icon', value);
    }

    get title() {
        return this.getAttribute('title') || '';
    }

    set title(value) {
        this.setAttribute('title', value);
    }

    get subtitle() {
        return this.getAttribute('subtitle') || '';
    }

    set subtitle(value) {
        this.setAttribute('subtitle', value);
    }

    get trailingIcon() {
        return this.getAttribute('trailing-icon') || '';
    }

    set trailingIcon(value) {
        this.setAttribute('trailing-icon', value);
    }

    get maxLines() {
        return parseInt(this.getAttribute('max-lines')) || 1;
    }

    set maxLines(value) {
        this.setAttribute('max-lines', value.toString());
    }

    get activeColor() {
        return this.getAttribute('active-color') || 'primary';
    }

    set activeColor(value) {
        this.setAttribute('active-color', value);
    }

    get clickable() {
        return this.hasAttribute('clickable');
    }

    set clickable(value) {
        if (value) {
            this.setAttribute('clickable', '');
        } else {
            this.removeAttribute('clickable');
        }
    }

    get disabled() {
        return this.hasAttribute('disabled');
    }

    set disabled(value) {
        if (value) {
            this.setAttribute('disabled', '');
        } else {
            this.removeAttribute('disabled');
        }
    }

    get textColor() {
        return this.getAttribute('text-color') || '';
    }

    set textColor(value) {
        if (value) {
            this.setAttribute('text-color', value);
        } else {
            this.removeAttribute('text-color');
        }
    }

    get backgroundColor() {
        return this.getAttribute('background-color') || '';
    }

    set backgroundColor(value) {
        if (value) {
            this.setAttribute('background-color', value);
        } else {
            this.removeAttribute('background-color');
        }
    }

    get iconColor() {
        return this.getAttribute('icon-color') || '';
    }

    set iconColor(value) {
        if (value) {
            this.setAttribute('icon-color', value);  
        } else {
            this.removeAttribute('icon-color');
        }
    }

    get borderRadius() {
        return this.getAttribute('border-radius') || '';
    }

    set borderRadius(value) {
        if (value) {
            this.setAttribute('border-radius', value);
        } else {
            this.removeAttribute('border-radius');
        }
    }

    get border() {
        return this.getAttribute('border') || '';
    }

    set border(value) {
        if (value) {
            this.setAttribute('border', value);
        } else {
            this.removeAttribute('border');
        }
    }

    get scale() {
        return parseFloat(this.getAttribute('scale')) || 1;
    }

    set scale(value) {
        const scaleValue = parseFloat(value) || 1;
        this.setAttribute('scale', scaleValue.toString());
    }

    connectedCallback() {
        this._render();
        this._attachEventListeners();
        this._rendered = true;
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (!this._rendered) return;

        switch (name) {
            case 'leading-icon':
                this._updateLeadingIcon();
                break;
            case 'title':
                this._updateTitle();
                break;
            case 'subtitle':
                this._updateSubtitle();
                break;
            case 'trailing-icon':
                this._updateTrailingIcon();
                break;
            case 'max-lines':
                this._updateMaxLines();
                break;
            case 'active':
                this.active = newValue !== null;
                break;
            case 'active-color':
            case 'clickable':
            case 'disabled':
            case 'text-color':
            case 'background-color':
            case 'icon-color':
            case 'border-radius':
            case 'border':
            case 'scale':
                this._updateStyles();
                this._reattachEventListeners();
                break;
        }
    }

    _render() {
        const leadingIcon = this.getAttribute('leading-icon') || 'fas fa-circle';
        const title = this.getAttribute('title') || 'List Item';
        const subtitle = this.getAttribute('subtitle') || '';
        const trailingIcon = this.getAttribute('trailing-icon') || '';
        const maxLines = this.getAttribute('max-lines') || '1';
        const isActive = this.hasAttribute('active');
        const activeColor = this.getAttribute('active-color') || 'primary';
        const isDisabled = this.hasAttribute('disabled');
        const hasBorder = this.getAttribute('border');
        const OpenModalButton = this.hasAttribute('data-qr-modal');
        const ButtonTitle = this.getAttribute('data-qr-title');
    
        this._isActive = isActive;
    
        const activeClass = isActive ? (activeColor === 'primary' ? 'active' : `active-${activeColor}`) : '';
        const disabledClass = isDisabled ? 'disabled' : '';
        const borderClass = hasBorder ? 'custom-border' : '';
    
        this.innerHTML = `
            <div class="smart-list-tile-inner ${activeClass} ${disabledClass} ${borderClass}">
                <div class="list-tile-leading">
                    <i class="${leadingIcon}" style="${leadingIcon.includes('check') ? 'font-size: 2em; font-weight: bold' : ''}"></i>
                </div>
                <div class="list-tile-content">
                    <h4 class="list-tile-title">${title}</h4>
                    ${subtitle ? `<p class="list-tile-subtitle max-lines-${maxLines}">${subtitle}</p>` : ''}
                </div>
                <div class="list-tile-trailing">
                    <!--${trailingIcon ? `<i class="${trailingIcon}"></i>` : ''}-->
                    ${OpenModalButton ? `<button class="btn qr-btn btn-sm btn-outline-primary">${ButtonTitle ? ButtonTitle : 'QR Code'}</button>` : `${trailingIcon ? `<i class="${trailingIcon}"></i>` : ''}`}
                </div>
            </div>
        `;
    
        this._updateStyles();
        this._attachQRButtonHandler();
    }
    
    _attachQRButtonHandler() {
        const btn = this.querySelector('.qr-btn');
        if (!btn) return;
    
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // prevent tile click event
            this._openModal();
        });
    }

    _openModal() {
        let modal = document.getElementById(`qr-modal-${this.getAttribute("data-qr-url")}`);
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'qr-modal';
            modal.style.position = 'fixed';
            modal.style.top = '0';
            modal.style.left = '0';
            modal.style.width = '100%';
            modal.style.height = '100%';
            modal.style.backgroundColor = 'rgba(0,0,0,0.6)';
            modal.style.display = 'flex';
            modal.style.justifyContent = 'center';
            modal.style.alignItems = 'center';
            modal.innerHTML = `
                <div style="background:white; padding:20px; border-radius:10px; max-width:400px; text-align:center;">
                    <h3 style="color:#000;">QR Code</h3>
                    <img src="${this.getAttribute('data-qr-url')}" alt="QR Code" />
                    <br/><br/>
                    <button id="close-qr-btn" class="btn btn-danger">Close</button>
                </div>
            `;
            document.body.appendChild(modal);
    
            // Close handler
            modal.querySelector('#close-qr-btn').addEventListener('click', () => {
                modal.remove();
            });
        }
    }
    
    

    _attachEventListeners() {
        const inner = this.querySelector('.smart-list-tile-inner');
        if (inner && this.hasAttribute('clickable')) {
            this._clickHandler = (e) => {
                if (this.hasAttribute('disabled')) return;
    
                const url = this.getAttribute('data-url');
                if (url) {
                    window.open(url, "_blank"); // opens external links properly
                }
    
                this.dispatchEvent(new CustomEvent('tile-click', {
                    bubbles: true,
                    detail: { 
                        tile: this,
                        originalEvent: e
                    }
                }));
            };
            inner.addEventListener('click', this._clickHandler);
        }
    }    

    _reattachEventListeners() {
        const inner = this.querySelector('.smart-list-tile-inner');
        if (inner && this._clickHandler) {
            inner.removeEventListener('click', this._clickHandler);
        }
        this._attachEventListeners();
    }

    _updateLeadingIcon() {
        const icon = this.querySelector('.list-tile-leading i');
        if (icon) {
            icon.className = this.getAttribute('leading-icon') || 'fas fa-circle';
        }
    }

    _updateTitle() {
        const title = this.querySelector('.list-tile-title');
        if (title) {
            title.textContent = this.getAttribute('title') || 'List Item';
        }
    }

    _updateSubtitle() {
        const subtitle = this.querySelector('.list-tile-subtitle');
        const newSubtitle = this.getAttribute('subtitle') || '';
        
        if (newSubtitle && !subtitle) {
            // Add subtitle if it doesn't exist
            const content = this.querySelector('.list-tile-content');
            const maxLines = this.getAttribute('max-lines') || '1';
            content.innerHTML += `<p class="list-tile-subtitle max-lines-${maxLines}">${newSubtitle}</p>`;
        } else if (subtitle) {
            if (newSubtitle) {
                subtitle.textContent = newSubtitle;
            } else {
                subtitle.remove();
            }
        }
    }

    _updateTrailingIcon() {
        const trailing = this.querySelector('.list-tile-trailing');
        const newIcon = this.getAttribute('trailing-icon');
        
        if (newIcon && !trailing) {
            // Add trailing if it doesn't exist
            const inner = this.querySelector('.smart-list-tile-inner');
            inner.innerHTML += `<div class="list-tile-trailing"><i class="${newIcon}"></i></div>`;
        } else if (trailing) {
            if (newIcon) {
                const icon = trailing.querySelector('i');
                if (icon) {
                    icon.className = newIcon;
                }
            } else {
                trailing.remove();
            }
        }
    }

    _updateMaxLines() {
        const subtitle = this.querySelector('.list-tile-subtitle');
        if (subtitle) {
            // Remove existing max-lines classes
            subtitle.classList.remove('max-lines-1', 'max-lines-2', 'max-lines-3');
            // Add new max-lines class
            const maxLines = this.getAttribute('max-lines') || '1';
            subtitle.classList.add(`max-lines-${maxLines}`);
        }
    }

    _updateActiveState() {
        const inner = this.querySelector('.smart-list-tile-inner');
        if (!inner) return;

        // Remove all active and state classes
        inner.classList.remove('active', 'active-success', 'active-warning', 'active-danger', 'active-info', 'disabled');
        
        // Add disabled class if needed
        if (this.hasAttribute('disabled')) {
            inner.classList.add('disabled');
        }
        
        // Add active class if needed
        if (this._isActive) {
            const activeColor = this.getAttribute('active-color') || 'primary';
            const activeClass = activeColor === 'primary' ? 'active' : `active-${activeColor}`;
            inner.classList.add(activeClass);
        }

        // Update custom styles
        this._updateStyles();
    }

    _updateStyles() {
        const inner = this.querySelector('.smart-list-tile-inner');
        const leading = this.querySelector('.list-tile-leading');
        const title = this.querySelector('.list-tile-title');
        const subtitle = this.querySelector('.list-tile-subtitle');
        const trailing = this.querySelector('.list-tile-trailing');
        
        if (!inner) return;

        // Apply custom colors
        const textColor = this.getAttribute('text-color');
        const backgroundColor = this.getAttribute('background-color');
        const iconColor = this.getAttribute('icon-color');
        const borderRadius = this.getAttribute('border-radius');
        const border = this.getAttribute('border');
        const scale = this.getAttribute('scale');

        // Reset inline styles first
        inner.style.backgroundColor = '';
        inner.style.color = '';
        inner.style.borderRadius = '';
        inner.style.border = '';
        this.style.transform = '';
        
        if (leading) {
            leading.style.color = '';
            leading.style.backgroundColor = '';
        }
        
        if (title) title.style.color = '';
        if (subtitle) subtitle.style.color = '';
        if (trailing) trailing.style.color = '';

        // Apply scale transform
        if (scale && scale !== '1') {
            const scaleValue = parseFloat(scale);
            if (!isNaN(scaleValue) && scaleValue > 0) {
                this.style.transform = `scale(${scaleValue})`;
                
                // Adjust margin to prevent overlap when scaling down
                if (scaleValue < 1) {
                    const marginAdjustment = (1 - scaleValue) * 50; // Percentage reduction
                    this.style.marginBottom = `-${marginAdjustment}%`;
                } else if (scaleValue > 1) {
                    // Add extra margin when scaling up
                    const marginAdjustment = (scaleValue - 1) * 20;
                    this.style.marginBottom = `${marginAdjustment}px`;
                } else {
                    this.style.marginBottom = '';
                }
            }
        } else {
            this.style.marginBottom = '';
        }

        // Apply custom styles only if not in active state or if custom colors override active state
        const isActiveWithBuiltInColor = this._isActive && !textColor && !backgroundColor && !iconColor;

        if (!isActiveWithBuiltInColor) {
            if (backgroundColor) {
                inner.style.backgroundColor = backgroundColor;
            }
            
            if (textColor) {
                inner.style.color = textColor;
                if (title) title.style.color = textColor;
                if (subtitle) {
                    // Make subtitle slightly more transparent
                    const isRgb = textColor.startsWith('rgb');
                    const isHex = textColor.startsWith('#');
                    if (isRgb || isHex) {
                        subtitle.style.color = textColor;
                        subtitle.style.opacity = '0.8';
                    } else {
                        subtitle.style.color = textColor;
                    }
                }
            }
            
            if (iconColor) {
                if (leading) {
                    const leadingIcon = leading.querySelector('i');
                    if (leadingIcon) leadingIcon.style.color = iconColor;
                }
                if (trailing) {
                    const trailingIcon = trailing.querySelector('i');
                    if (trailingIcon) trailingIcon.style.color = iconColor;
                }
            }
        }

        // Apply border radius
        if (borderRadius) {
            inner.style.borderRadius = borderRadius;
        }

        // Apply border
        if (border) {
            inner.style.border = border;
            inner.classList.add('custom-border');
        } else {
            inner.classList.remove('custom-border');
        }
    }

    // Public Methods
    toggle() {
        this.active = !this.active;
        return this;
    }

    activate() {
        this.active = true;
        return this;
    }

    deactivate() {
        this.active = false;
        return this;
    }

    setIcon(leading, trailing) {
        if (leading !== undefined) this.leadingIcon = leading;
        if (trailing !== undefined) this.trailingIcon = trailing;
        return this;
    }

    setText(title, subtitle) {
        if (title !== undefined) this.title = title;
        if (subtitle !== undefined) this.subtitle = subtitle;
        return this;
    }

    setActiveColor(color) {
        this.activeColor = color;
        return this;
    }

    setMaxLines(lines) {
        this.maxLines = lines;
        return this;
    }

    setColors(textColor, backgroundColor, iconColor) {
        if (textColor !== undefined) this.textColor = textColor;
        if (backgroundColor !== undefined) this.backgroundColor = backgroundColor;
        if (iconColor !== undefined) this.iconColor = iconColor;
        return this;
    }

    setBorder(border, borderRadius) {
        if (border !== undefined) this.border = border;
        if (borderRadius !== undefined) this.borderRadius = borderRadius;
        return this;
    }

    setScale(scale) {
        this.scale = scale;
        return this;
    }

    scaleUp(factor = 0.1) {
        const currentScale = this.scale;
        this.scale = currentScale + factor;
        return this;
    }

    scaleDown(factor = 0.1) {
        const currentScale = this.scale;
        const newScale = Math.max(0.1, currentScale - factor); // Minimum scale of 0.1
        this.scale = newScale;
        return this;
    }

    resetScale() {
        this.scale = 1;
        return this;
    }

    enable() {
        this.disabled = false;
        return this;
    }

    disable() {
        this.disabled = true;
        return this;
    }

    // Static helper method to create tiles programmatically
    static create(options = {}) {
        const tile = document.createElement('smart-list-tile');
        
        if (options.leadingIcon) tile.setAttribute('leading-icon', options.leadingIcon);
        if (options.title) tile.setAttribute('title', options.title);
        if (options.subtitle) tile.setAttribute('subtitle', options.subtitle);
        if (options.trailingIcon) tile.setAttribute('trailing-icon', options.trailingIcon);
        if (options.maxLines) tile.setAttribute('max-lines', options.maxLines.toString());
        if (options.active) tile.setAttribute('active', '');
        if (options.activeColor) tile.setAttribute('active-color', options.activeColor);
        if (options.clickable) tile.setAttribute('clickable', '');
        if (options.disabled) tile.setAttribute('disabled', '');
        if (options.textColor) tile.setAttribute('text-color', options.textColor);
        if (options.backgroundColor) tile.setAttribute('background-color', options.backgroundColor);
        if (options.iconColor) tile.setAttribute('icon-color', options.iconColor);
        if (options.borderRadius) tile.setAttribute('border-radius', options.borderRadius);
        if (options.border) tile.setAttribute('border', options.border);
        if (options.scale) tile.setAttribute('scale', options.scale.toString());
        
        return tile;
    }
}

// Register the custom element
customElements.define('smart-list-tile', SmartListTile);

// Export for modules (optional)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SmartListTile;
}