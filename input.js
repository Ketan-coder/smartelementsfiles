/**
 * input.js — SmartInput (<smart-input>)
 *
 * STYLING MODES
 * ─────────────────────────────────────────────────────────────────
 * Default (no attribute):
 *   Component injects its own styles. Zero CSS framework dependency.
 *   All elements carry stable `si-*` prefixed classes.
 *   Use smart-input.starter.css as a customisation base.
 *
 * styled="bootstrap":
 *   No styles injected. Bootstrap classes are used (form-control,
 *   form-label, d-none, etc). Bring your own Bootstrap import.
 *
 * THEME (only applies in default mode — ignored for bootstrap/none)
 * ─────────────────────────────────────────────────────────────────
 * theme="auto"  (default) — follows OS prefers-color-scheme
 * theme="light"           — always light, ignores OS setting
 * theme="dark"            — always dark, ignores OS setting
 *
 * The theme system is driven by [data-sc-theme] on the element itself,
 * paired with CSS variable overrides. You can change it at runtime:
 *   document.querySelector('smart-input').setAttribute('theme', 'dark')
 *
 * NEW FEATURES (v2)
 * ─────────────────────────────────────────────────────────────────
 * clearable
 *   Adds an × button inside the input to instantly clear value.
 *   Applies to: text, email, number, password, textarea, select (single), search.
 *   NOT on: radio, checkbox, switch, file, datepicker, multi-select.
 *   Usage: <smart-input type="text" clearable>
 *
 * show-count
 *   Shows a live character counter "n / max" below the input.
 *   Requires maxlength attribute to show the limit, but works without it too.
 *   Applies to: text, email, number, password, textarea.
 *   Usage: <smart-input type="textarea" maxlength="200" show-count>
 *
 * data-debounce="ms"
 *   Debounces the data-oninput callback by the given milliseconds.
 *   The input value still updates live — only the callback is delayed.
 *   Applies to: all types with text input (text, email, textarea, etc.)
 *   Usage: <smart-input data-debounce="400" data-oninput="handleSearch">
 *
 * data-validate="rules"
 *   Declarative validation rules, pipe-separated, run on blur and on validate().
 *   Built-in rules: email, url, phone, min:N, max:N, minlen:N, maxlen:N,
 *                   numeric, alpha, alphanumeric, regex:pattern
 *   Applies to: text, email, number, password, textarea.
 *   Usage: <smart-input data-validate="email|minlen:5">
 *          <smart-input data-validate="min:18|max:100" type="number">
 *
 * show-strength
 *   Renders a 4-segment password strength bar below the input.
 *   Strength levels: Weak / Fair / Good / Strong
 *   Applies to: type="password" only.
 *   Usage: <smart-input type="password" show-strength>
 *
 * copyable
 *   Adds a copy-to-clipboard icon button inside the input's right side.
 *   Shows a brief ✓ confirmation on success.
 *   Applies to: text, email, number, password, textarea.
 *   NOT on: radio, checkbox, switch, file, datepicker, select, multi-select.
 *   Usage: <smart-input type="text" copyable>
 *
 * file-style="default|modern"
 *   Controls the visual style of type="file" inputs (default mode only).
 *   default — native browser file input + file info panel (existing behaviour)
 *   modern  — dashed dropzone with upload icon + per-file pill rows with trash buttons.
 *             Supports drag-and-drop in addition to click-to-browse.
 *   Usage: <smart-input type="file" file-style="modern" clearable>
 *
 * STABLE CLASS REFERENCE  (always present, regardless of mode)
 * ─────────────────────────────────────────────────────────────────
 *  si-label              — the <label> element
 *  si-required-star      — the " * " required indicator inside label
 *  si-container          — wrapper div around the actual input
 *  si-error              — validation error message div
 *  si-hidden             — utility: hides any element (replaces d-none)
 *  si-input              — text / email / number / password / textarea / select
 *  si-clear-btn          — the × clear button (clearable, text inputs)
 *  si-file-clear-btn     — the "Clear" button for file inputs (clearable + type="file")
 *  si-dropzone           — modern dropzone container (file-style="modern")
 *  si-dropzone-icon      — upload icon inside dropzone
 *  si-dropzone-label     — "Upload File" text inside dropzone
 *  si-dropzone--over     — added on dragover
 *  si-dropzone--invalid  — shake+red flash on validation fail
 *  si-file-list          — modern per-file rows container
 *  si-modern-file-row    — single file pill row
 *  si-modern-file-name   — filename text inside pill
 *  si-modern-file-remove — purple trash button inside pill
 *  si-copy-btn           — copy-to-clipboard button (copyable)
 *  si-count              — character counter (show-count)
 *  si-strength-bar       — password strength bar wrapper (show-strength)
 *  si-strength-segment   — individual segment inside strength bar
 *  si-strength-label     — strength text label ("Weak", "Strong", etc.)
 *  si-file-help          — file upload hint text
 *  si-file-info          — selected files preview panel
 *  si-file-item          — single file row inside si-file-info
 *  si-file-details       — icon + name/size group inside si-file-item
 *  si-file-icon          — file type icon
 *  si-file-name          — filename text
 *  si-file-size          — formatted size text
 *  si-remove-file        — remove-file button
 *  si-spinner            — fetch spinner (multi-select with data-url)
 *  si-search-input       — combobox input (single select with data-url)
 *  si-search-spinner     — spinner inside combobox input
 *  si-search-dropdown    — combobox results dropdown
 *  si-search-option      — single result row
 *  si-search-option--active   — keyboard-highlighted row
 *  si-search-option--selected — currently selected row
 *  si-search-empty       — "no results" message
 *  si-check-wrapper      — wrapper div for checkbox / radio / switch
 *  si-check-input        — the <input type="checkbox|radio">
 *  si-check-label        — the <label> next to checkbox / radio / switch
 *  si-switch-wrapper     — additional class on switch wrapper
 *  si-multi-container    — multi-select outer wrapper
 *  si-multi-display      — clickable tag display area
 *  si-multi-placeholder  — placeholder text inside display
 *  si-multi-tag          — selected-value chip
 *  si-multi-tag-remove   — × button inside a chip
 *  si-multi-icon         — caret chevron
 *  si-multi-dropdown     — dropdown panel
 *  si-multi-search       — search input wrapper inside dropdown
 *  si-multi-options      — options list container
 *  si-multi-option       — single option row
 *  si-multi-option-cb    — custom checkbox square inside option
 *  si-multi-no-results   — "no results" message
 */

class SmartInput extends HTMLElement {

    // ── Base method delegation ──────────────────────────────────────────────
    // These methods delegate to SmartElement (from smart-core.js) when loaded,
    // or run their own implementation when smart-core.js is absent.
    // This avoids ES module async load-order issues with class inheritance.

    _getMode() {
        if (window.SmartElement) return SmartElement.prototype._getMode.call(this);
        const s = (this.getAttribute('styled') || '').toLowerCase().trim();
        return s === 'bootstrap' ? 'bootstrap' : 'default';
    }

    _getTheme() {
        if (window.SmartElement) return SmartElement.prototype._getTheme.call(this);
        if (this._getMode() !== 'default') return null;
        const t = (this.getAttribute('theme') || 'auto').toLowerCase().trim();
        return ['light', 'dark', 'auto'].includes(t) ? t : 'auto';
    }

    _applyTheme() {
        if (window.SmartElement) return SmartElement.prototype._applyTheme.call(this);
        if (this._getMode() !== 'default') return;
    
        if (this._scMqlHandler) {
            this._scMql?.removeEventListener('change', this._scMqlHandler);
            this._scMqlHandler = null; this._scMql = null;
        }
        if (this._scObserver) { this._scObserver.disconnect(); this._scObserver = null; }
    
        const theme = this._getTheme();
        if (theme === 'light' || theme === 'dark') {
            this.dataset.scTheme = theme;
            return;
        }
    
        const _resolve = () => {
            if (this.dataset.scTheme) return this.dataset.scTheme;
            
            const ancestor = this.closest('[data-sc-theme]');
            if (ancestor) return ancestor.dataset.scTheme || 'light';
            
            if (document.body && document.body.dataset.scTheme) {
                return document.body.dataset.scTheme;
            }
            if (document.documentElement && document.documentElement.dataset.scTheme) {
                return document.documentElement.dataset.scTheme;
            }
            if (this._scMql && this._scMql.matches) return 'dark';
            return 'light';
        };
        
        const _apply = () => { 
            const resolvedTheme = _resolve();
            this.dataset.scTheme = resolvedTheme;
        };
    
        // Always observe body+html so JS toggle is caught immediately
        const targets = [document.body, document.documentElement].filter(Boolean);
        this._scObserver = new MutationObserver(_apply);
        targets.forEach(t => {
            if (t) {
                this._scObserver.observe(t, {
                    attributes: true, 
                    attributeFilter: ['data-sc-theme']
                });
            }
        });
    
        this._scMql = window.matchMedia('(prefers-color-scheme: dark)');
        this._scMqlHandler = _apply;
        this._scMql.addEventListener('change', this._scMqlHandler);
    
        _apply();
    }

    // ── _cls helper (input-specific, not in SmartElement) ───────────────────

    /** Returns the class string to apply to a native input / select / textarea */
    _cls(siClass, bootstrapClass) {
        const mode = this._getMode();
        if (mode === 'bootstrap') return bootstrapClass;
        return `${siClass} ${bootstrapClass}`;
    }

    // ── Override _hide/_show to also handle Bootstrap d-none ────────────────

    _hide(el) {
        if (!el) return;
        el.classList.add('si-hidden', 'sc-hidden');
        if (this._getMode() === 'bootstrap') el.classList.add('d-none');
    }

    _show(el) {
        if (!el) return;
        el.classList.remove('si-hidden', 'sc-hidden');
        if (this._getMode() === 'bootstrap') el.classList.remove('d-none');
    }

    // ── Lifecycle ───────────────────────────────────────────────────────────

    connectedCallback() {
        const mode        = this._getMode();
        const type        = this.getAttribute('type') || 'text';
        const name        = this.getAttribute('name') || 'input';
        const label       = this.getAttribute('label') || '';
        const required    = this.hasAttribute('required');
        const placeholder = this.getAttribute('placeholder') || '';
        const rows        = this.getAttribute('rows') || 4;
        const multiple    = this.hasAttribute('multiple');
        const options     = this.getAttribute('data-options');
        const errorMsg    = this.getAttribute('data-error') || `Invalid ${label.toLowerCase()}`;
        const fetchUrl    = this.getAttribute('data-url');
        const responsePath = this.getAttribute('data-response-path') || '';
        const value       = this.getAttribute('value') || '';
        const noAutocomplete = this.hasAttribute('no-autocomplete');

        // Switch-specific
        const isBig     = this.hasAttribute('is-big');
        const isMedium  = this.hasAttribute('is-medium');
        const isSmall   = this.hasAttribute('is-small');
        const selectedValue = this.getAttribute('selected-value') || '';
        const switchId  = this.getAttribute('id') || `switch-${Math.random().toString(36).substr(2, 9)}`;

        // Date picker
        const minDate   = this.getAttribute('min-date') || '';
        const maxDate   = this.getAttribute('max-date') || '';

        // File upload
        const accept    = this.getAttribute('accept') || '';
        const maxSize   = this.getAttribute('max-size') || '';
        const maxFiles  = this.getAttribute('max-files') || '1';
        const allowedTypes = this.getAttribute('allowed-types') || '';
        const fileStyle = (this.getAttribute('file-style') || 'default').toLowerCase();

        // Event callbacks
        const onInputFn  = this.getAttribute('data-oninput');
        const onClickFn  = this.getAttribute('data-onclick');
        const onChangeFn = this.getAttribute('data-onchange');

        // v2 feature flags
        const clearable    = this.hasAttribute('clearable');
        const showCount    = this.hasAttribute('show-count');
        const showStrength = this.hasAttribute('show-strength') && type === 'password';
        const copyable     = this.hasAttribute('copyable');
        const debounceMs   = parseInt(this.getAttribute('data-debounce') || '0', 10);
        const validateRules = this.getAttribute('data-validate') || '';
        const maxlength    = this.getAttribute('maxlength') || '';

        // ── Skeleton HTML ────────────────────────────────────────────────────

        // Label (skip for checkbox / radio / switch — they render their own)
        const showLabel = !(type === 'checkbox' || type === 'radio' || type === 'switch');
        const labelHtml = showLabel
            ? `<label class="si-label${mode === 'bootstrap' ? ' form-label' : ''}">
                   ${label}:${required ? `<span class="si-required-star${mode === 'bootstrap' ? ' text-danger' : ''}"> * </span>` : ''}
               </label>`
            : '';

        this.innerHTML = `
            ${labelHtml}
            <div class="si-container${mode === 'bootstrap' ? ' input-container position-relative' : ''}"></div>
            <div class="si-error si-hidden${mode === 'bootstrap' ? ' invalid-feedback d-none' : ''}">${errorMsg}</div>
        `;

        const container = this.querySelector('.si-container');
        const error     = this.querySelector('.si-error');
        let input;

        // ── Input type branches ──────────────────────────────────────────────

        if (type === 'textarea') {
            input = document.createElement('textarea');
            input.name        = name;
            input.className   = this._cls('si-input', 'form-control');
            input.rows        = rows;
            input.placeholder = placeholder;
            input.value       = value;
            if (maxlength) input.maxLength = parseInt(maxlength);
            if (noAutocomplete) {
                input.setAttribute('autocomplete', 'new-' + name);
                input.setAttribute('autocorrect', 'off');
                input.setAttribute('autocapitalize', 'off');
                input.setAttribute('spellcheck', 'false');
            }
            container.appendChild(input);
        }

        else if (type === 'select') {
            if (multiple) {
                this.createMultiSelect(container, name, options, value, placeholder, fetchUrl, responsePath);
                input = container.querySelector('.si-multi-hidden');
            } else {
                input = document.createElement('select');
                input.name      = name;
                input.className = this._cls('si-input', 'form-select');
                if (noAutocomplete) input.setAttribute('autocomplete', 'off');

                if (options) {
                    try {
                        const opts = JSON.parse(options);
                        this.renderOptions(input, opts);
                        if (value) {
                            input.value = value;
                            if (input.value !== value) {
                                for (let opt of input.querySelectorAll('option')) {
                                    if (opt.textContent.toLowerCase() === value.toLowerCase() ||
                                        opt.value.toLowerCase() === value.toLowerCase()) {
                                        opt.selected = true;
                                        break;
                                    }
                                }
                            }
                        }
                    } catch (e) {
                        console.warn('[smart-input] Invalid JSON in data-options:', options);
                    }
                }

                container.appendChild(input);
                if (fetchUrl) this.createSearchBox(container, input, fetchUrl, responsePath);
            }
        }

        else if (type === 'datepicker') {
            const hiddenInput = document.createElement('input');
            hiddenInput.type  = 'hidden';
            hiddenInput.name  = name;
            hiddenInput.value = value;

            input             = document.createElement('input');
            input.type        = 'text';
            input.className   = this._cls('si-input', 'form-control');
            input.placeholder = placeholder || 'Select date...';
            input.readOnly    = true;
            input.style.cursor = 'pointer';
            if (noAutocomplete) input.setAttribute('autocomplete', 'off');

            const dateInput = document.createElement('input');
            dateInput.type  = 'date';
            dateInput.style.cssText = 'position:absolute;opacity:0;pointer-events:none;';

            if (minDate) { const m = this.convertDDMMYYYYToISO(minDate); if (m) dateInput.min = m; }
            if (maxDate) { const m = this.convertDDMMYYYYToISO(maxDate); if (m) dateInput.max = m; }

            if (value) {
                const iso = this.convertDDMMYYYYToISO(value);
                if (iso) {
                    dateInput.value  = iso;
                    input.value      = this.formatDateForDisplay(new Date(iso));
                    hiddenInput.value = value;
                }
            }

            const calIcon = document.createElement('i');
            calIcon.className = 'ph ph-calendar';
            calIcon.style.cssText = 'position:absolute;right:10px;top:50%;transform:translateY(-50%);pointer-events:none;color:#6c757d;';

            input.addEventListener('click', () => dateInput.showPicker());

            dateInput.addEventListener('change', () => {
                if (dateInput.value) {
                    const d = new Date(dateInput.value);
                    input.value       = this.formatDateForDisplay(d);
                    hiddenInput.value = this.formatDateDDMMYYYY(d);
                    this._show(error) && this._hide(error); // clear error
                    this._hide(error);
                    input.classList.remove('si-input--invalid', 'is-invalid');
                    hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });

            container.appendChild(hiddenInput);
            container.appendChild(input);
            container.appendChild(dateInput);
            container.appendChild(calIcon);

            this.inputElement = input;
            this.hiddenInput  = hiddenInput;
            this.dateInput    = dateInput;

            if (required) {
                hiddenInput.required = true;
                input.addEventListener('blur', () => {
                    if (!hiddenInput.value) {
                        error.textContent = 'Date is required';
                        this._show(error);
                        input.classList.add('si-input--invalid', 'is-invalid');
                        input.classList.add('si-shake');
                        setTimeout(() => input.classList.remove('si-shake'), 400);
                    } else {
                        this._hide(error);
                        input.classList.remove('si-input--invalid', 'is-invalid');
                    }
                });
            }
        }

        else if (type === 'file') {
            input           = document.createElement('input');
            input.type      = 'file';
            input.name      = name;
            if (parseInt(maxFiles) > 1) input.multiple = true;
            const acceptAttr = this.getFileAcceptAttribute(allowedTypes, accept);
            if (acceptAttr) input.accept = acceptAttr;

            this._clearing = false; // guard flag: prevents change listener re-firing on clear

            if (fileStyle === 'modern') {
                // ── Modern dropzone UI ─────────────────────────────────────
                input.className = 'si-hidden';
                input.style.cssText = 'position:absolute;opacity:0;pointer-events:none;';

                const isSingle = parseInt(maxFiles) <= 1;

                const dropzone = document.createElement('div');
                dropzone.className = 'si-dropzone';
                dropzone.innerHTML = `
                    <i class="ph ph-upload-simple si-dropzone-icon"></i>
                    <span class="si-dropzone-label">Upload File${!isSingle ? 's' : ''}</span>
                `;

                // Help text — same content as default UI, styled for modern
                const helpText = document.createElement('small');
                helpText.className = 'si-file-help si-file-help--modern';
                helpText.innerHTML = this.getFileUploadHelpText(allowedTypes, maxSize, maxFiles, accept);

                const fileList = document.createElement('div');
                fileList.className = 'si-file-list';

                dropzone.addEventListener('click', () => input.click());
                dropzone.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    dropzone.classList.add('si-dropzone--over');
                });
                dropzone.addEventListener('dragleave', () => dropzone.classList.remove('si-dropzone--over'));
                dropzone.addEventListener('drop', (e) => {
                    e.preventDefault();
                    dropzone.classList.remove('si-dropzone--over');
                    const dt = new DataTransfer();
                    Array.from(e.dataTransfer.files).forEach(f => dt.items.add(f));
                    input.files = dt.files;
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                });

                container.appendChild(input);
                container.appendChild(dropzone);
                container.appendChild(helpText);
                container.appendChild(fileList);

                this.inputElement  = input;
                this.fileInfo      = fileList;
                this._dropzoneEl   = dropzone;   // ref for single-file toggle
                this._helpTextEl   = helpText;   // ref for single-file toggle

                input.addEventListener('change', () => {
                    if (this._clearing) return;
                    const files = Array.from(input.files);
                    const validation = this.validateFiles(files, allowedTypes, maxSize, maxFiles);
                    if (!validation.isValid) {
                        error.textContent = validation.message;
                        this._show(error);
                        dropzone.classList.add('si-dropzone--invalid');
                        setTimeout(() => dropzone.classList.remove('si-dropzone--invalid'), 400);
                        input.value = '';
                        return;
                    }
                    this._hide(error);
                    this._renderModernFileList(files, fileList, input, allowedTypes, maxSize, maxFiles, error, isSingle);
                    // Single file: hide dropzone + help after upload
                    if (isSingle && files.length > 0) {
                        this._hide(dropzone);
                        this._hide(helpText);
                    }
                });

            } else {
                // ── Default UI ─────────────────────────────────────────────
                input.className = this._cls('si-input', 'form-control');

                const helpText = document.createElement('small');
                helpText.className = `si-file-help${mode === 'bootstrap' ? ' form-text text-muted mt-1 d-block' : ''}`;
                helpText.innerHTML = this.getFileUploadHelpText(allowedTypes, maxSize, maxFiles, accept);

                const fileInfo = document.createElement('div');
                fileInfo.className = `si-file-info si-hidden${mode === 'bootstrap' ? ' file-info mt-2 d-none' : ''}`;
                fileInfo.innerHTML = `<div class="si-selected-files${mode === 'bootstrap' ? ' selected-files' : ''}"></div>`;

                container.appendChild(input);
                container.appendChild(helpText);
                container.appendChild(fileInfo);

                this.inputElement = input;
                this.fileInfo     = fileInfo;

                input.addEventListener('change', (e) => {
                    if (this._clearing) return; // ← bug fix: skip when clear button triggered this
                    const files      = Array.from(e.target.files);
                    const validation = this.validateFiles(files, allowedTypes, maxSize, maxFiles);
                    if (validation.isValid) {
                        this.displaySelectedFiles(files, fileInfo.querySelector('.si-selected-files'));
                        this._show(fileInfo);
                        this._hide(error);
                        input.classList.remove('si-input--invalid', 'is-invalid');
                    } else {
                        error.textContent = validation.message;
                        this._show(error);
                        input.classList.add('si-input--invalid', 'is-invalid', 'si-shake');
                        setTimeout(() => input.classList.remove('si-shake'), 400);
                        input.value = '';
                        this._hide(fileInfo);
                    }
                });
            }
        }

        else if (type === 'checkbox') {
            input           = document.createElement('input');
            input.type      = 'checkbox';
            input.name      = name;
            input.checked   = value === 'true' || value === '1';
            input.className = `si-check-input${mode === 'bootstrap' ? ' form-check-input me-2' : ''}`;

            const labelEl = document.createElement('label');
            labelEl.className   = `si-check-label${mode === 'bootstrap' ? ' form-check-label' : ''}`;
            labelEl.textContent = label;

            const wrapper = document.createElement('div');
            wrapper.className = `si-check-wrapper${mode === 'bootstrap' ? ' form-check' : ''}`;
            wrapper.appendChild(input);
            wrapper.appendChild(labelEl);
            container.appendChild(wrapper);
        }

        else if (type === 'switch') {
            input      = document.createElement('input');
            input.type = 'checkbox';
            input.name = name;
            input.id   = switchId;
            input.setAttribute('role', 'switch');
            input.value   = selectedValue;
            input.checked = value === 'true' || value === '1' || selectedValue === 'true' || selectedValue === '1';

            const sizeClass = isBig ? ' si-check-input--lg' : isSmall ? ' si-check-input--sm' : '';
            input.className = `si-check-input${sizeClass}${mode === 'bootstrap'
                ? ` form-check-input${isBig ? ' form-check-input-lg' : isSmall ? ' form-check-input-sm' : ''}`
                : ''}`;

            const labelEl = document.createElement('label');
            labelEl.className   = `si-check-label${mode === 'bootstrap' ? ' form-check-label' : ''}`;
            labelEl.setAttribute('for', switchId);
            labelEl.textContent = label;
            labelEl.style.marginLeft = '10px';
            if (required) input.required = true;
            if (isBig)    labelEl.style.fontSize = '1.25rem';
            if (isMedium) labelEl.style.fontSize = '1rem';
            if (isSmall)  labelEl.style.fontSize = '0.875rem';

            const wrapperSizeClass = isBig ? ' si-switch-wrapper--lg' : isSmall ? ' si-switch-wrapper--sm' : '';
            const wrapper = document.createElement('div');
            wrapper.className = `si-check-wrapper si-switch-wrapper${wrapperSizeClass}${mode === 'bootstrap'
                ? ` form-check form-switch${isBig ? ' form-switch-lg' : isSmall ? ' form-switch-sm' : ''}`
                : ''}`;
            wrapper.appendChild(input);
            wrapper.appendChild(labelEl);
            container.appendChild(wrapper);
        }

        else if (type === 'radio') {
            if (!options) return;
            try {
                const opts = JSON.parse(options);
                opts.forEach(opt => {
                    const radio       = document.createElement('input');
                    radio.type        = 'radio';
                    radio.name        = name;
                    radio.value       = opt.id;
                    radio.className   = `si-check-input${mode === 'bootstrap' ? ' form-check-input me-2' : ''}`;
                    if (opt.id == value) radio.checked = true;

                    const labelEl     = document.createElement('label');
                    labelEl.className = `si-check-label${mode === 'bootstrap' ? ' form-check-label me-3' : ''}`;
                    labelEl.textContent = opt.name;

                    const wrapper     = document.createElement('div');
                    wrapper.className = `si-check-wrapper${mode === 'bootstrap' ? ' form-check form-check-inline' : ''}`;
                    wrapper.appendChild(radio);
                    wrapper.appendChild(labelEl);
                    container.appendChild(wrapper);

                    this.attachEvents(radio, error, onInputFn, onClickFn, onChangeFn);
                });
            } catch (e) {
                console.warn('[smart-input] Invalid JSON in data-options:', options);
            }
            // ── Inject styles + theme for radio (early-return path) ──────────
            if (mode === 'default') {
                this._injectStyles();
                this._applyTheme();
            }
            this._initStateIntegration();
            return;
        }

        else {
            input           = document.createElement('input');
            input.type      = type;
            input.name      = name;
            input.className = this._cls('si-input', 'form-control');
            input.placeholder = placeholder;
            input.value     = value;
            if (maxlength) input.maxLength = parseInt(maxlength);
            if (noAutocomplete) {
                input.setAttribute('autocomplete', 'new-' + name);
                input.setAttribute('autocorrect', 'off');
                input.setAttribute('autocapitalize', 'off');
                input.setAttribute('spellcheck', 'false');
            }
            container.appendChild(input);
        }

        // ── Post-build wiring ────────────────────────────────────────────────

        if (input && type !== 'datepicker' && type !== 'file' && !(type === 'select' && multiple)) {
            if (required) input.required = true;
            this.attachEvents(input, error, onInputFn, onClickFn, onChangeFn, debounceMs, validateRules);
        } else if (type === 'file' && input) {
            if (required) input.required = true;
            input.addEventListener('click', e => {
                if (onClickFn && window[onClickFn]) window[onClickFn](e);
            });
        }

        if (type !== 'datepicker' && !(type === 'select' && multiple)) {
            this.inputElement = input;
        }

        // ── v2: wire features that need a real input element ─────────────────
        const _isClearableType  = ['text','email','number','password','search','url','tel','file'].includes(type) || type === 'textarea';
        const _isCopyableType   = ['text','email','number','password','search','url','tel'].includes(type) || type === 'textarea';
        const _isCountableType  = ['text','email','number','password','search','url','tel'].includes(type) || type === 'textarea';

        if (clearable && _isClearableType && input) {
            this._initClearable(input, container);
        }
        if (copyable && _isCopyableType && input) {
            this._initCopyable(input, container);
        }
        if (showCount && _isCountableType && input) {
            this._initCount(input, maxlength);
        }
        if (showStrength && input) {
            this._initStrength(input);
        }

        // ── Inject styles (default mode only) ───────────────────────────────
        if (mode === 'default') {
            this._injectStyles();
            this._applyTheme();   // set [data-sc-theme] after styles are injected
        }

        // ── SmartState integration ───────────────────────────────────────────
        this._initStateIntegration();
    }

    static get observedAttributes() { return ['theme', 'styled']; }

    attributeChangedCallback(name) {
        if (name === 'theme' || name === 'styled') this._applyTheme();
    }

    // ── Style injection ──────────────────────────────────────────────────────

    _injectStyles() {
        // ── Phosphor Icons: inject only if not already in the DOM ───────────
        const phAlreadyLoaded =
            !!document.querySelector('script[src*="phosphor"]') ||
            !!document.querySelector('link[href*="phosphor"]');

        if (!phAlreadyLoaded && !document.getElementById('phosphor-icons-cdn')) {
            const base = 'https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.1/src';
            [
                { id: 'phosphor-icons-cdn',      href: `${base}/regular/style.css` },
                { id: 'phosphor-icons-cdn-fill',  href: `${base}/fill/style.css`   },
            ].forEach(({ id, href }) => {
                const link = document.createElement('link');
                link.id   = id;
                link.rel  = 'stylesheet';
                link.type = 'text/css';
                link.href = href;
                document.head.appendChild(link);
            });
        }

        // One <style> tag per page, shared across all smart-input instances
        if (document.getElementById('smart-input-styles')) return;
        const s = document.createElement('style');
        s.id = 'smart-input-styles';
        s.textContent = `
            /* ── Utility ────────────────────────────────────────────────────── */
            .si-hidden { display: none !important; }

            /* ── Layout ─────────────────────────────────────────────────────── */
            smart-input {
                display: block;
                margin-bottom: 1rem;
                font-family: var(--sc-font, system-ui, -apple-system, 'Segoe UI', sans-serif);
                font-size: var(--sc-font-size, 0.9375rem);
                color: var(--sc-text, #1a1d23);
            }
            .si-container { position: relative; }

            /* ── Label ──────────────────────────────────────────────────────── */
            .si-label {
                display: block;
                margin-bottom: 0.35rem;
                font-size: var(--sc-font-size, 0.875rem);
                font-weight: var(--sc-font-weight, 500);
                color: var(--sc-text, #374151);
            }
            .si-required-star {
                color: var(--sc-error, #dc2626);
                margin-left: 1px;
            }

            /* ── Core input / select / textarea ─────────────────────────────── */
            .si-input {
                display: block;
                width: 100%;
                padding: var(--sc-input-padding, 0.5rem 0.75rem);
                font-size: inherit;
                font-family: inherit;
                color: var(--sc-text, #1a1d23);
                background: var(--sc-bg, #ffffff);
                border: 1.5px solid var(--sc-border, #d1d5db);
                border-radius: var(--sc-radius, 0.4rem);
                outline: none;
                transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
                box-sizing: border-box;
                line-height: 1.5;
            }
            .si-input:focus {
                border-color: var(--sc-focus, #6366f1);
                box-shadow:
                    0 0 0 3px var(--sc-focus-ring, rgba(99,102,241,.18)),
                    0 0 8px 1px var(--sc-focus-ring, rgba(99,102,241,.12));
            }
            .si-input::placeholder { color: var(--sc-text-muted, #9ca3af); }
            textarea.si-input { resize: vertical; min-height: 80px; }
            select.si-input { cursor: pointer; }

            /* ── Invalid state ───────────────────────────────────────────────── */
            .si-input--invalid,
            .si-input.is-invalid {
                border-color: var(--sc-error, #dc2626) !important;
                box-shadow:
                    0 0 0 3px var(--sc-error-ring, rgba(220,38,38,.15)),
                    0 0 8px 1px var(--sc-error-ring, rgba(220,38,38,.10));
            }

            /* ── Error message ───────────────────────────────────────────────── */
            .si-error {
                margin-top: 0.3rem;
                font-size: var(--sc-font-size, 0.8125rem);
                color: var(--sc-error, #dc2626);
            }

            /* ── Shake animation ─────────────────────────────────────────────── */
            .si-shake {
                animation: si-shake 0.3s ease-in-out;
            }
            @keyframes si-shake {
                0%, 100% { transform: translateX(0); }
                25%       { transform: translateX(-5px); }
                50%       { transform: translateX(5px); }
                75%       { transform: translateX(-5px); }
            }

            /* ── Search spinner (select with data-url) ───────────────────────── */
            .si-spinner {
                position: absolute;
                right: 10px; top: 8px;
                width: 1rem; height: 1rem;
                border: 2px solid #d1d5db;
                border-top-color: #6366f1;
                border-radius: 50%;
                animation: si-spin 0.8s linear infinite;
                display: none;
            }
            @keyframes si-spin { to { transform: rotate(360deg); } }

            /* ── Checkbox / Radio / Switch ───────────────────────────────────── */
            .si-check-wrapper {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                margin-top: 0.25rem;
            }
            .si-check-input {
                width: 1rem; height: 1rem;
                cursor: pointer;
                accent-color: var(--sc-focus, #6366f1);
            }
            .si-check-label {
                cursor: pointer;
                font-size: var(--sc-font-size, 0.9375rem);
            }

            /* Switch toggle */
            .si-switch-wrapper .si-check-input {
                appearance: none; -webkit-appearance: none;
                width: 2.25rem; height: 1.25rem;
                background: var(--sc-border, #d1d5db);
                border-radius: 9999px;
                position: relative;
                transition: background 0.3s, box-shadow 0.2s;
                cursor: pointer;
                flex-shrink: 0;
                border: none;
                outline: none;
            }
            .si-switch-wrapper .si-check-input::after {
                content: '';
                position: absolute;
                top: 2px; left: 2px;
                width: calc(1.25rem - 4px); height: calc(1.25rem - 4px);
                background: #fff;
                border-radius: 50%;
                transition: transform 0.3s ease-out;
                box-shadow: 0 1px 3px rgba(0,0,0,0.12);
            }
            .si-switch-wrapper .si-check-input:checked {
                background: var(--sc-focus, #6366f1);
                box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
            }
            .si-switch-wrapper .si-check-input:checked::after {
                transform: translateX(1rem);
                background: #ffffff;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            }
            .si-switch-wrapper--lg .si-check-input { width: 3rem; height: 1.75rem; }
            .si-switch-wrapper--lg .si-check-input::after {
                width: calc(1.75rem - 4px); height: calc(1.75rem - 4px);
            }
            .si-switch-wrapper--lg .si-check-input:checked::after { transform: translateX(1.25rem); }
            .si-switch-wrapper--sm .si-check-input { width: 1.75rem; height: 1rem; }
            .si-switch-wrapper--sm .si-check-input::after {
                width: calc(1rem - 4px); height: calc(1rem - 4px);
            }
            .si-switch-wrapper--sm .si-check-input:checked::after { transform: translateX(0.75rem); }

            /* ── File upload ─────────────────────────────────────────────────── */
            .si-file-help {
                display: block;
                margin-top: 0.25rem;
                font-size: 0.8125rem;
                color: var(--sc-text-muted, #6b7280);
            }
            .si-file-info {
                margin-top: 0.5rem;
                border: 1.5px solid var(--sc-border, #d1d5db);
                border-radius: var(--sc-radius, 0.4rem);
                padding: 0.75rem;
                background: var(--sc-bg-subtle, #f9fafb);
            }
            .si-file-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 0.4rem 0;
                border-bottom: 1px solid var(--sc-border, #d1d5db);
            }
            .si-file-item:last-child { border-bottom: none; }
            .si-file-details {
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            .si-file-icon { font-size: 1.4rem; color: var(--sc-text-muted, #6b7280); }
            .si-file-name { font-weight: 500; }
            .si-file-size { font-size: 0.8125rem; color: var(--sc-text-muted, #6b7280); }
            .si-remove-file {
                background: none; border: none; cursor: pointer;
                color: var(--sc-error, #dc2626);
                padding: 0.2rem 0.35rem;
                border-radius: 0.25rem;
                font-size: 1.1rem;
                transition: background 0.12s;
            }
            .si-remove-file:hover { background: rgba(220,38,38,.1); }

            /* ── Multi-select ────────────────────────────────────────────────── */
            .si-multi-container { position: relative; width: 100%; }
            .si-multi-hidden    { position: absolute; opacity: 0; pointer-events: none; }
            .si-multi-display {
                min-height: 42px;
                padding: 0.375rem 2.25rem 0.375rem 0.75rem;
                border: 1.5px solid var(--sc-border, #d1d5db);
                border-radius: var(--sc-radius, 0.4rem);
                background: var(--sc-bg, #fff);
                cursor: pointer;
                display: flex;
                flex-wrap: wrap;
                gap: 0.35rem;
                align-items: center;
                transition: border-color 0.15s, box-shadow 0.15s;
                box-sizing: border-box;
            }
            .si-multi-display:hover,
            .si-multi-display.open {
                border-color: var(--sc-focus, #6366f1);
            }
            .si-multi-display.open {
                box-shadow:
                    0 0 0 3px var(--sc-focus-ring, rgba(99,102,241,.18)),
                    0 0 8px 1px var(--sc-focus-ring, rgba(99,102,241,.12));
            }
            .si-multi-display.si-input--invalid,
            .si-multi-display.is-invalid {
                border-color: var(--sc-error, #dc2626) !important;
                box-shadow: 0 0 0 3px var(--sc-error-ring, rgba(220,38,38,.15));
            }
            .si-multi-placeholder { color: var(--sc-text-muted, #9ca3af); }
            .si-multi-tag {
                display: inline-flex;
                align-items: center;
                gap: 0.3rem;
                padding: 0.2rem 0.45rem;
                background: var(--sc-tag-bg, #6366f1);
                color: var(--sc-tag-text, #fff);
                border-radius: 0.25rem;
                font-size: 0.8125rem;
                font-weight: 500;
                animation: si-tag-in 0.18s ease;
            }
            @keyframes si-tag-in { from { opacity:0; transform:scale(.8); } to { opacity:1; transform:scale(1); } }
            .si-multi-tag-remove {
                background: none; border: none; color: inherit;
                cursor: pointer; padding: 0; opacity: 0.75;
                display: flex; align-items: center;
                transition: opacity 0.15s;
            }
            .si-multi-tag-remove:hover { opacity: 1; }
            .si-multi-icon {
                position: absolute;
                right: 0.75rem; top: 50%;
                transform: translateY(-50%);
                pointer-events: none;
                color: var(--sc-text-muted, #6b7280);
                transition: transform 0.18s;
            }
            .si-multi-icon.open { transform: translateY(-50%) rotate(180deg); }
            .si-multi-dropdown {
                position: absolute;
                top: calc(100% + 4px); left: 0; right: 0;
                background: var(--sc-bg, #fff);
                border: 1.5px solid var(--sc-border, #d1d5db);
                border-radius: var(--sc-radius, 0.4rem);
                box-shadow: 0 8px 24px rgba(0,0,0,.12);
                max-height: 300px;
                overflow-y: auto;
                z-index: 1050;
                display: none;
                animation: si-dropdown-in 0.18s ease;
            }
            @keyframes si-dropdown-in { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }
            .si-multi-dropdown.show { display: block; }
            .si-multi-search {
                position: sticky; top: 0;
                padding: 0.5rem;
                background: var(--sc-bg, #fff);
                border-bottom: 1px solid var(--sc-border, #d1d5db);
                z-index: 1;
            }
            .si-multi-search input {
                width: 100%;
                padding: 0.4rem 0.6rem;
                border: 1.5px solid var(--sc-border, #d1d5db);
                border-radius: 0.3rem;
                font-size: 0.875rem;
                box-sizing: border-box;
                outline: none;
            }
            .si-multi-search input:focus {
                border-color: var(--sc-focus, #6366f1);
                box-shadow:
                    0 0 0 2px var(--sc-focus-ring, rgba(99,102,241,.18)),
                    0 0 6px 1px var(--sc-focus-ring, rgba(99,102,241,.10));
            }
            .si-multi-options { padding: 0.25rem 0; }
            .si-multi-option {
                padding: 0.5rem 0.75rem;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 0.5rem;
                transition: background 0.12s;
            }
            .si-multi-option:hover       { background: var(--sc-bg-subtle, #f5f5ff); }
            .si-multi-option.selected    { background: var(--sc-bg-subtle, rgba(99,102,241,.08)); font-weight: 500; }
            .si-multi-option-cb {
                width: 18px; height: 18px;
                border: 2px solid var(--sc-border, #d1d5db);
                border-radius: 0.25rem;
                display: flex; align-items: center; justify-content: center;
                flex-shrink: 0;
                transition: all 0.18s;
            }
            .si-multi-option.selected .si-multi-option-cb {
                background: var(--sc-focus, #6366f1);
                border-color: var(--sc-focus, #6366f1);
            }
            .si-multi-option-cb i { color: #fff; font-size: 12px; display: none; }
            .si-multi-option.selected .si-multi-option-cb i { display: block; }
            .si-multi-no-results {
                padding: 1rem;
                text-align: center;
                color: var(--sc-text-muted, #6b7280);
                font-size: 0.875rem;
            }

            /* ── v2: Clear button ────────────────────────────────────────────── */
            .si-clear-btn,
            .si-copy-btn {
                position: absolute;
                top: 50%; right: 0.6rem;
                transform: translateY(-50%);
                background: none; border: none;
                color: var(--sc-text-muted, #9ca3af);
                cursor: pointer;
                padding: 0.2rem 0.3rem;
                border-radius: 0.25rem;
                display: flex; align-items: center; justify-content: center;
                font-size: 0.95rem;
                transition: color 0.15s, background 0.15s;
                z-index: 2;
            }
            .si-clear-btn:hover { color: var(--sc-error, #dc2626); background: rgba(220,38,38,.08); }
            .si-copy-btn:hover  { color: var(--sc-focus, #6366f1); background: rgba(99,102,241,.08); }
            .si-copy-btn--success { color: #16a34a !important; }

            /* File clear — block-level, sits below the file info panel */
            .si-file-clear-btn {
                position: static;
                transform: none;
                display: inline-flex;
                align-items: center;
                gap: 0.35rem;
                margin-top: 0.5rem;
                padding: 0.3rem 0.75rem;
                font-size: 0.8125rem;
                font-family: inherit;
                color: var(--sc-error, #dc2626);
                background: none;
                border: 1.5px solid var(--sc-error, #dc2626);
                border-radius: var(--sc-radius, 0.4rem);
                cursor: pointer;
                transition: background 0.15s, color 0.15s;
            }
            .si-file-clear-btn:hover {
                background: var(--sc-error, #dc2626);
                color: #fff;
            }

            /* When both are present, offset copy behind clear */
            .si-container:has(.si-clear-btn:not(.si-hidden):not(.si-file-clear-btn)) .si-copy-btn { right: 2.2rem; }

            /* Textarea: position buttons at top-right, not vertically centered */
            .si-container:has(textarea) .si-clear-btn,
            .si-container:has(textarea) .si-copy-btn {
                top: 0.6rem;
                transform: none;
            }
            .si-container:has(textarea) .si-clear-btn:not(.si-hidden) + .si-copy-btn { right: 2.2rem; }

            /* ── v2: Character counter ───────────────────────────────────────── */
            .si-count {
                margin-top: 0.25rem;
                font-size: 0.78rem;
                color: var(--sc-text-muted, #9ca3af);
                text-align: right;
            }
            .si-count--near-limit { color: var(--sc-warning, #d97706); }
            .si-count--at-limit   { color: var(--sc-error, #dc2626); font-weight: 600; }

            /* ── v2: Password strength bar ───────────────────────────────────── */
            .si-strength-bar {
                margin-top: 0.4rem;
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            .si-strength-segments {
                display: flex;
                gap: 3px;
                flex: 1;
            }
            .si-strength-segment {
                height: 4px;
                flex: 1;
                border-radius: 9999px;
                background: var(--sc-border, #e5e7eb);
                transition: background 0.25s;
            }
            .si-strength--weak   .si-strength-segment.active { background: #ef4444; }
            .si-strength--fair   .si-strength-segment.active { background: #f97316; }
            .si-strength--good   .si-strength-segment.active { background: #eab308; }
            .si-strength--strong .si-strength-segment.active { background: #22c55e; }
            .si-strength-label {
                font-size: 0.78rem;
                min-width: 3.5rem;
                font-weight: 500;
                color: var(--sc-text-muted, #9ca3af);
            }
            .si-strength--weak   .si-strength-label { color: #ef4444; }
            .si-strength--fair   .si-strength-label { color: #f97316; }
            .si-strength--good   .si-strength-label { color: #eab308; }
            .si-strength--strong .si-strength-label { color: #22c55e; }

            /* ── v2: Modern file dropzone (file-style="modern") ─────────────── */
            .si-dropzone {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 0.5rem;
                padding: 2rem 1rem;
                border: 2px dashed var(--sc-focus, #6366f1);
                border-radius: var(--sc-radius, 0.75rem);
                background: var(--sc-bg-subtle, #f5f3ff);
                cursor: pointer;
                transition: background 0.15s, border-color 0.15s;
                user-select: none;
            }
            .si-dropzone:hover,
            .si-dropzone--over {
                background: var(--sc-bg-subtle, #ede9fe);
                border-color: var(--sc-focus, #7c3aed);
            }
            .si-dropzone--invalid {
                border-color: var(--sc-error, #dc2626);
                background: rgba(220,38,38,.05);
                animation: si-shake 0.3s ease-in-out;
            }
            .si-dropzone-icon {
                font-size: 2rem;
                color: var(--sc-focus, #6366f1);
            }
            .si-dropzone-label {
                font-size: 0.9375rem;
                font-weight: 500;
                color: var(--sc-focus, #6366f1);
            }

            /* Modern file list rows */
            .si-file-list {
                margin-top: 0.5rem;
                display: flex;
                flex-direction: column;
                gap: 0.4rem;
            }
            .si-modern-file-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 0.45rem 0.75rem;
                background: var(--sc-bg, #fff);
                border: 1.5px solid var(--sc-border, #e5e7eb);
                border-radius: var(--sc-radius, 0.4rem);
                font-size: 0.875rem;
                animation: si-tag-in 0.18s ease;
            }
            .si-modern-file-name {
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                flex: 1;
                color: var(--sc-text, #1a1d23);
            }
            .si-modern-file-remove {
                background: var(--sc-focus, #6366f1);
                border: none;
                border-radius: 50%;
                width: 1.6rem; height: 1.6rem;
                display: flex; align-items: center; justify-content: center;
                color: #fff;
                cursor: pointer;
                flex-shrink: 0;
                margin-left: 0.5rem;
                font-size: 0.875rem;
                transition: background 0.15s, transform 0.15s;
            }
            .si-modern-file-remove:hover {
                background: var(--sc-error, #dc2626);
                transform: scale(1.08);
            }

            /* ── Search combobox (single select with data-url) ───────────────── */
            .si-search-input { padding-right: 2.5rem; }
            .si-search-spinner {
                position: absolute;
                right: 0.7rem; top: 50%;
                transform: translateY(-50%);
                width: 1rem; height: 1rem;
                border: 2px solid var(--sc-border, #d1d5db);
                border-top-color: var(--sc-focus, #6366f1);
                border-radius: 50%;
                animation: si-spin 0.8s linear infinite;
                display: none;
                pointer-events: none;
            }
            .si-search-dropdown {
                position: absolute;
                top: calc(100% + 4px); left: 0; right: 0;
                background: var(--sc-bg, #fff);
                border: 1.5px solid var(--sc-border, #d1d5db);
                border-radius: var(--sc-radius, 0.4rem);
                box-shadow: 0 8px 24px rgba(0,0,0,.12);
                max-height: 260px;
                overflow-y: auto;
                z-index: 1050;
                display: none;
                animation: si-dropdown-in 0.15s ease;
            }
            .si-search-dropdown.show { display: block; }
            .si-search-option {
                padding: 0.55rem 0.85rem;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 0.5rem;
                font-size: 0.9rem;
                transition: background 0.1s;
                color: var(--sc-text, #1a1d23);
                border-bottom: 1px solid var(--sc-border, #f3f4f6);
            }
            .si-search-option:last-child { border-bottom: none; }
            .si-search-option:hover,
            .si-search-option--active    { background: var(--sc-bg-subtle, #f5f3ff); }
            .si-search-option--selected  {
                background: rgba(99,102,241,.08);
                font-weight: 500;
                color: var(--sc-focus, #6366f1);
            }
            .si-search-option--selected::after {
                content: '';
                display: inline-block;
                width: 7px; height: 7px;
                border-radius: 50%;
                background: var(--sc-focus, #6366f1);
                margin-left: auto;
                flex-shrink: 0;
            }
            .si-search-empty {
                padding: 1rem;
                text-align: center;
                color: var(--sc-text-muted, #9ca3af);
                font-size: 0.875rem;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 0.4rem;
            }

            /* Modern help text — sits below the dropzone */
            .si-file-help--modern {
                display: block;
                margin-top: 0.4rem;
                text-align: center;
            }

            /* Single-file reupload button */
            .si-reupload-btn {
                display: inline-flex;
                align-items: center;
                gap: 0.35rem;
                margin-top: 0.4rem;
                padding: 0.3rem 0.75rem;
                font-size: 0.8125rem;
                font-family: inherit;
                color: var(--sc-focus, #6366f1);
                background: none;
                border: 1.5px solid var(--sc-focus, #6366f1);
                border-radius: var(--sc-radius, 0.4rem);
                cursor: pointer;
                transition: background 0.15s, color 0.15s;
            }
            .si-reupload-btn:hover {
                background: var(--sc-focus, #6366f1);
                color: #fff;
            }

            /* ── Dark theme additions for v2 ─────────────────────────────────── */

            /* ── Dark theme (set via [data-sc-theme="dark"] — driven by theme attr) ── */
            smart-input[data-sc-theme="dark"] { color: var(--sc-text, #e5e7eb); }
            smart-input[data-sc-theme="dark"] .si-label   { color: var(--sc-text, #d1d5db); }
            smart-input[data-sc-theme="dark"] .si-input {
                background: var(--sc-bg, #1f2937);
                border-color: var(--sc-border, #374151);
                color: var(--sc-text, #e5e7eb);
            }
            smart-input[data-sc-theme="dark"] .si-input::placeholder { color: var(--sc-text-muted, #6b7280); }
            smart-input[data-sc-theme="dark"] .si-check-label         { color: #e5e7eb; }
            smart-input[data-sc-theme="dark"] .si-file-help           { color: #9ca3af; }
            smart-input[data-sc-theme="dark"] .si-file-info           { background: #111827; border-color: #374151; }
            smart-input[data-sc-theme="dark"] .si-file-item           { border-color: #374151; }
            smart-input[data-sc-theme="dark"] .si-file-name           { color: #e5e7eb; }
            smart-input[data-sc-theme="dark"] .si-file-size,
            smart-input[data-sc-theme="dark"] .si-file-icon           { color: #9ca3af; }
            smart-input[data-sc-theme="dark"] .si-multi-display {
                background: #1f2937;
                border-color: #374151;
                color: #e5e7eb;
            }
            smart-input[data-sc-theme="dark"] .si-multi-display:hover,
            smart-input[data-sc-theme="dark"] .si-multi-display.open  { border-color: #6366f1; }
            smart-input[data-sc-theme="dark"] .si-multi-placeholder   { color: #6b7280; }
            smart-input[data-sc-theme="dark"] .si-multi-icon          { color: #9ca3af; }
            smart-input[data-sc-theme="dark"] .si-multi-dropdown      {
                background: #1f2937;
                border-color: #374151;
                box-shadow: 0 8px 24px rgba(0,0,0,.4);
            }
            smart-input[data-sc-theme="dark"] .si-multi-search        { background: #1f2937; border-color: #374151; }
            smart-input[data-sc-theme="dark"] .si-multi-search input  { background: #111827; border-color: #374151; color: #e5e7eb; }
            smart-input[data-sc-theme="dark"] .si-multi-search input::placeholder { color: #6b7280; }
            smart-input[data-sc-theme="dark"] .si-multi-option        { color: #e5e7eb; }
            smart-input[data-sc-theme="dark"] .si-multi-option:hover  { background: #111827; }
            smart-input[data-sc-theme="dark"] .si-multi-option.selected { background: rgba(99,102,241,.15); }
            smart-input[data-sc-theme="dark"] .si-multi-option-cb     { border-color: #4b5563; }
            smart-input[data-sc-theme="dark"] .si-multi-no-results    { color: #9ca3af; }
            smart-input[data-sc-theme="dark"] .si-switch-wrapper .si-check-input { background: #374151; }
            smart-input[data-sc-theme="dark"] .si-error               { color: var(--sc-error, #f87171); }
            smart-input[data-sc-theme="dark"] .si-required-star       { color: var(--sc-error, #f87171); }
            smart-input[data-sc-theme="dark"] .si-search-dropdown {
                background: #1f2937;
                border-color: #374151;
                box-shadow: 0 8px 24px rgba(0,0,0,.4);
            }
            smart-input[data-sc-theme="dark"] .si-search-option      { color: #e5e7eb; border-color: #374151; }
            smart-input[data-sc-theme="dark"] .si-search-option:hover,
            smart-input[data-sc-theme="dark"] .si-search-option--active { background: #111827; }
            smart-input[data-sc-theme="dark"] .si-search-empty        { color: #6b7280; }
            smart-input[data-sc-theme="dark"] .si-clear-btn,
            smart-input[data-sc-theme="dark"] .si-copy-btn            { color: #6b7280; }
            smart-input[data-sc-theme="dark"] .si-count               { color: #6b7280; }
            smart-input[data-sc-theme="dark"] .si-strength-segment    { background: #374151; }
            smart-input[data-sc-theme="dark"] .si-dropzone            { background: rgba(99,102,241,.08); border-color: #6366f1; }
            smart-input[data-sc-theme="dark"] .si-dropzone:hover,
            smart-input[data-sc-theme="dark"] .si-dropzone--over      { background: rgba(99,102,241,.16); }
            smart-input[data-sc-theme="dark"] .si-modern-file-row     { background: #1f2937; border-color: #374151; }
            smart-input[data-sc-theme="dark"] .si-modern-file-name    { color: #e5e7eb; }
            smart-input[data-sc-theme="dark"] .si-reupload-btn        { color: #818cf8; border-color: #818cf8; }
            smart-input[data-sc-theme="dark"] .si-reupload-btn:hover  { background: #818cf8; color: #fff; }

            /* Enhanced Switch in dark mode */
            smart-input[data-sc-theme="dark"] .si-switch-wrapper .si-check-input:checked {
                background: var(--sc-focus, #6366f1) !important;
            }

            /* Better knob visibility */
            smart-input[data-sc-theme="dark"] .si-switch-wrapper .si-check-input:checked::after {
                background: #ffffff;
            }

            smart-input[data-sc-theme="dark"] .si-check-wrapper .si-check-label,
            smart-input[data-sc-theme="dark"] .si-check-label {
                color: #e5e7eb !important;
            }

            smart-input[data-sc-theme="dark"] .si-check-wrapper {
                color: #e5e7eb;
            }

            /* ── Fix: Radio label visibility in dark mode ── */
            smart-input .si-check-label {
                color: var(--sc-text, #1a1d23);
            }
            
            smart-input[data-sc-theme="dark"] .si-check-label {
                color: var(--sc-text, #e5e7eb) !important;
            }
            
            smart-input[data-sc-theme="dark"] .si-check-input[type="radio"] {
                border: 2px solid #6b7280;
                background-color: transparent;
                accent-color: var(--sc-focus, #6366f1);
            }
            
            smart-input[data-sc-theme="dark"] .si-check-input[type="radio"]:checked {
                background-color: var(--sc-focus, #6366f1);
                border-color: var(--sc-focus, #6366f1);
            }
            
            /* ── Fix: Remove gray background from inputs in dark mode ── */
            smart-input[data-sc-theme="dark"] .si-input {
                background: var(--sc-bg, #1f2937) !important;
                color: var(--sc-text, #e5e7eb) !important;
            }
            
            smart-input[data-sc-theme="dark"] .si-container {
                background: transparent;
            }
            
            /* ── Ensure form-control doesn't override in dark mode ── */
            smart-input[data-sc-theme="dark"] .form-control {
                background-color: var(--sc-bg, #1f2937) !important;
                color: var(--sc-text, #e5e7eb) !important;
                border-color: var(--sc-border, #374151) !important;
            }

            smart-input[data-sc-theme="dark"] .si-check-input[type="radio"]:checked {
                background-color: var(--sc-focus, #6366f1);
                border-color: var(--sc-focus, #6366f1);
            }
            smart-input {
                background-color: transparent !important;
            }
            
            smart-input[data-sc-theme="dark"] {
                background-color: transparent !important;
            }
            
            .si-container {
                background-color: transparent !important;
            }
        `;
        document.head.appendChild(s);
    }

    // ── SmartState integration ───────────────────────────────────────────────

    _initStateIntegration() {
        if (!window.smartState) return;

        const bindKey   = this.getAttribute('state-bind');
        const setKey    = this.getAttribute('state-set');
        const listenKey = this.getAttribute('state-listen') || bindKey;

        const getVal = () => {
            if (this.inputElement) return this.inputElement.value;
            const hidden = this.querySelector('.si-multi-hidden');
            if (hidden) return hidden.value;
            const ctrl = this.querySelector('input, select, textarea');
            return ctrl ? ctrl.value : '';
        };

        const setVal = (v) => {
            const val = v == null ? '' : String(v);
            if (this.inputElement) { this.inputElement.value = val; return; }
            const ctrl = this.querySelector('input:not([type=hidden]), select, textarea');
            if (ctrl) ctrl.value = val;
        };

        if (listenKey) {
            const existing = window.smartState.get(listenKey);
            if (existing != null) setVal(existing);
            const stateHandler = (newVal) => setVal(newVal);
            window.smartState.subscribe(listenKey, stateHandler);
            this._stateUnsub = () => window.smartState.unsubscribe(listenKey, stateHandler);
        }

        const writeKey = bindKey || setKey;
        if (writeKey) {
            const writeToState = () => {
                window.smartState.set(writeKey, getVal());
                this.dispatchEvent(new Event('sfb-input-change', { bubbles: true, composed: true }));
            };
            const ctrl = this.inputElement
                || this.querySelector('.si-multi-hidden')
                || this.querySelector('input, select, textarea');
            if (ctrl) {
                ctrl.addEventListener('input',  writeToState);
                ctrl.addEventListener('change', writeToState);
            }
        }
    }

    disconnectedCallback() {
        if (this._stateUnsub) {
            try { this._stateUnsub(); } catch(e) {}
            this._stateUnsub = null;
        }
        if (this._scMqlHandler) {
            this._scMql?.removeEventListener('change', this._scMqlHandler);
            this._scMqlHandler = null; this._scMql = null;
        }
        if (this._scObserver) {
            this._scObserver.disconnect();
            this._scObserver = null;
        }
    }

    // ── Validation ──────────────────────────────────────────────────────────

    attachEvents(input, error, onInputFn, onClickFn, onChangeFn, debounceMs = 0, validateRules = '') {
        input.addEventListener('blur', () => {
            const ruleError = validateRules ? this._runValidateRules(input.value, validateRules) : null;
            if (ruleError) {
                error.textContent = ruleError;
                this._show(error);
                input.classList.add('si-input--invalid', 'is-invalid', 'si-shake');
                setTimeout(() => input.classList.remove('si-shake'), 400);
            } else if (!input.checkValidity()) {
                this._show(error);
                input.classList.add('si-input--invalid', 'is-invalid', 'si-shake');
                setTimeout(() => input.classList.remove('si-shake'), 400);
            } else {
                this._hide(error);
                input.classList.remove('si-input--invalid', 'is-invalid');
            }
        });

        let _debounceTimer;
        input.addEventListener('input', e => {
            // Clear error live as user types
            this._hide(error);
            input.classList.remove('si-input--invalid', 'is-invalid');

            if (onInputFn && window[onInputFn]) {
                if (debounceMs > 0) {
                    clearTimeout(_debounceTimer);
                    _debounceTimer = setTimeout(() => window[onInputFn](e), debounceMs);
                } else {
                    window[onInputFn](e);
                }
            }
        });

        input.addEventListener('click',  e => { if (onClickFn  && window[onClickFn])  window[onClickFn](e); });
        input.addEventListener('change', e => { if (onChangeFn && window[onChangeFn]) window[onChangeFn](e); });
    }

    validate() {
        const type         = this.getAttribute('type') || 'text';
        const multiple     = this.hasAttribute('multiple');
        const error        = this.querySelector('.si-error');
        const required     = this.hasAttribute('required');
        const validateRules = this.getAttribute('data-validate') || '';

        const _markInvalid = (msg, el) => {
            if (msg) error.textContent = msg;
            this._show(error);
            el.classList.add('si-input--invalid', 'is-invalid', 'si-shake');
            setTimeout(() => el.classList.remove('si-shake'), 400);
            return false;
        };
        const _markValid = (el) => {
            this._hide(error);
            el.classList.remove('si-input--invalid', 'is-invalid');
            return true;
        };

        if (type === 'datepicker') {
            const value = this.hiddenInput ? this.hiddenInput.value : '';
            if (required && !value)                       return _markInvalid('Date is required', this.inputElement);
            if (value && !this.validateDate(value))       return _markInvalid('Invalid date format (dd-mm-yyyy)', this.inputElement);
            return _markValid(this.inputElement);
        }

        if (type === 'select' && multiple && this.multiSelectData) {
            if (required && this.multiSelectData.selectedValues.size === 0)
                return _markInvalid('Please select at least one option', this.multiSelectData.display);
            return _markValid(this.multiSelectData.display);
        }

        if (type === 'file') {
            const files = this.inputElement ? Array.from(this.inputElement.files) : [];
            if (required && files.length === 0)           return _markInvalid('File is required', this.inputElement);
            if (files.length > 0) {
                const v = this.validateFiles(files, this.getAttribute('allowed-types') || '', this.getAttribute('max-size') || '', this.getAttribute('max-files') || '1');
                if (!v.isValid)                            return _markInvalid(v.message, this.inputElement);
            }
            return _markValid(this.inputElement);
        }

        if (this.inputElement) {
            const ruleError = validateRules ? this._runValidateRules(this.inputElement.value, validateRules) : null;
            if (ruleError)                                return _markInvalid(ruleError, this.inputElement);
            if (!this.inputElement.checkValidity())       return _markInvalid(null, this.inputElement);
            return _markValid(this.inputElement);
        }

        return true;
    }

    // ── v2: Clearable ────────────────────────────────────────────────────────

    _initClearable(input, container) {
        const isFile = input.type === 'file';

        const btn = document.createElement('button');
        btn.type      = 'button';
        btn.className = isFile ? 'si-clear-btn si-file-clear-btn' : 'si-clear-btn si-hidden';
        btn.setAttribute('aria-label', 'Clear');
        btn.innerHTML = isFile
            ? '<i class="ph ph-trash"></i> Clear'   // file: labelled trash, always shown after selection
            : '<i class="ph ph-x"></i>';             // text: icon only, hidden when empty

        if (isFile) {
            // For file inputs the button lives below the input, not inside it
            // Insert after fileInfo so it sits at the bottom of the file section
            const fileInfo = this.fileInfo;
            this._hide(btn); // hidden until files are selected

            if (fileInfo && fileInfo.parentNode) {
                fileInfo.parentNode.insertBefore(btn, fileInfo.nextSibling);
            } else {
                container.appendChild(btn);
            }

            // Show clear button when files are selected, hide when cleared
            input.addEventListener('change', () => {
                if (input.files && input.files.length > 0) this._show(btn);
                else this._hide(btn);
            });

            btn.addEventListener('click', () => {
                this._clearing = true;   // ← prevent change listener re-firing

                // Reset the native file input
                input.value = '';

                // Hide the file info / modern file list and wipe contents
                if (this.fileInfo) {
                    const sel = this.fileInfo.querySelector('.si-selected-files');
                    if (sel) {
                        sel.innerHTML = ''; // default style: wipe file rows only
                    } else {
                        this.fileInfo.innerHTML = ''; // modern style: wipe pill rows
                    }
                    this._hide(this.fileInfo);
                }

                // Single-file modern: restore dropzone on clear
                if (this._dropzoneEl) this._show(this._dropzoneEl);
                if (this._helpTextEl) this._show(this._helpTextEl);

                // Clear any error state
                const error = this.querySelector('.si-error');
                if (error) {
                    this._hide(error);
                    input.classList.remove('si-input--invalid', 'is-invalid');
                }

                this._hide(btn);

                // Dispatch change so data-onchange callbacks fire, then re-arm guard
                input.dispatchEvent(new Event('change', { bubbles: true }));
                this._clearing = false;
            });

        } else {
            // Standard text-like input: icon button inside the container
            container.appendChild(btn);

            const _updatePadding = () => {
                const rightBtns = container.querySelectorAll('.si-clear-btn:not(.si-hidden), .si-copy-btn:not(.si-hidden)').length;
                input.style.paddingRight = rightBtns > 0 ? `${rightBtns * 2.2}rem` : '';
            };

            const _toggleBtn = () => {
                const hasValue = input.value.length > 0;
                btn.classList.toggle('si-hidden', !hasValue);
                _updatePadding();
            };

            input.addEventListener('input', _toggleBtn);
            input.addEventListener('change', _toggleBtn);

            btn.addEventListener('click', () => {
                input.value = '';
                input.focus();
                btn.classList.add('si-hidden');
                _updatePadding();
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
            });

            _toggleBtn(); // init with pre-filled value
        }
    }

    // ── v2: Copyable ─────────────────────────────────────────────────────────

    _initCopyable(input, container) {
        const btn = document.createElement('button');
        btn.type      = 'button';
        btn.className = 'si-copy-btn';
        btn.setAttribute('aria-label', 'Copy to clipboard');
        btn.innerHTML = '<i class="ph ph-copy"></i>';

        container.appendChild(btn);

        // Adjust padding (clearable may also be present)
        const _updatePadding = () => {
            const rightBtns = container.querySelectorAll('.si-clear-btn:not(.si-hidden), .si-copy-btn').length;
            input.style.paddingRight = `${rightBtns * 2.2}rem`;
        };
        _updatePadding();

        btn.addEventListener('click', () => {
            const text = input.value || input.textContent || '';
            if (!text) return;

            navigator.clipboard.writeText(text).then(() => {
                btn.innerHTML = '<i class="ph ph-check"></i>';
                btn.classList.add('si-copy-btn--success');
                setTimeout(() => {
                    btn.innerHTML = '<i class="ph ph-copy"></i>';
                    btn.classList.remove('si-copy-btn--success');
                }, 1800);
            }).catch(() => {
                // Fallback for older browsers / non-HTTPS
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.cssText = 'position:fixed;opacity:0;';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                btn.innerHTML = '<i class="ph ph-check"></i>';
                setTimeout(() => { btn.innerHTML = '<i class="ph ph-copy"></i>'; }, 1800);
            });
        });
    }

    // ── v2: Character counter ────────────────────────────────────────────────

    _initCount(input, maxlength) {
        const counter = document.createElement('div');
        counter.className = 'si-count';
        // Insert after the error div so it sits at the very bottom
        const error = this.querySelector('.si-error');
        if (error && error.parentNode) {
            error.parentNode.insertBefore(counter, error.nextSibling);
        } else {
            this.appendChild(counter);
        }

        const max = parseInt(maxlength) || 0;
        const _update = () => {
            const len = input.value.length;
            counter.textContent = max ? `${len} / ${max}` : `${len}`;
            counter.classList.toggle('si-count--near-limit', max > 0 && len >= max * 0.85);
            counter.classList.toggle('si-count--at-limit',   max > 0 && len >= max);
        };

        input.addEventListener('input', _update);
        _update(); // init with pre-filled value
    }

    // ── v2: Password strength ────────────────────────────────────────────────

    _initStrength(input) {
        const bar = document.createElement('div');
        bar.className = 'si-strength-bar';
        bar.innerHTML = `
            <div class="si-strength-segments">
                <div class="si-strength-segment"></div>
                <div class="si-strength-segment"></div>
                <div class="si-strength-segment"></div>
                <div class="si-strength-segment"></div>
            </div>
            <span class="si-strength-label"></span>
        `;

        // Insert right after the container, before the error
        const container = this.querySelector('.si-container');
        if (container && container.nextSibling) {
            this.insertBefore(bar, container.nextSibling);
        } else {
            this.appendChild(bar);
        }

        const segments = bar.querySelectorAll('.si-strength-segment');
        const label    = bar.querySelector('.si-strength-label');
        const levels   = [
            { text: 'Weak',   cls: 'si-strength--weak'   },
            { text: 'Fair',   cls: 'si-strength--fair'   },
            { text: 'Good',   cls: 'si-strength--good'   },
            { text: 'Strong', cls: 'si-strength--strong' },
        ];

        const _score = (pw) => {
            if (!pw) return 0;
            let score = 0;
            if (pw.length >= 8)               score++;
            if (/[A-Z]/.test(pw))             score++;
            if (/[0-9]/.test(pw))             score++;
            if (/[^A-Za-z0-9]/.test(pw))      score++;
            return score; // 0–4
        };

        const _update = () => {
            const score = _score(input.value);
            const allCls = levels.map(l => l.cls);

            bar.classList.remove(...allCls);
            segments.forEach((seg, i) => seg.classList.toggle('active', i < score));

            if (!input.value) {
                label.textContent = '';
                return;
            }
            const level = levels[Math.max(score - 1, 0)];
            bar.classList.add(level.cls);
            label.textContent = level.text;
        };

        input.addEventListener('input', _update);
        _update();
    }

    // ── v2: Declarative validation rules engine ──────────────────────────────

    /**
     * Runs pipe-separated rules against a value.
     * Returns the first error message string, or null if all pass.
     *
     * Rules:
     *   email              — valid email format
     *   url                — valid URL (http/https)
     *   phone              — digits, spaces, +, -, (), min 7 chars
     *   numeric            — digits only
     *   alpha              — letters only
     *   alphanumeric       — letters and digits only
     *   min:N              — numeric value >= N
     *   max:N              — numeric value <= N
     *   minlen:N           — string length >= N
     *   maxlen:N           — string length <= N
     *   regex:pattern      — matches the regex (no flags)
     */
    _runValidateRules(value, rules) {
        if (!value && !rules.includes('required')) return null; // empty + no required = skip

        for (const rule of rules.split('|').map(r => r.trim()).filter(Boolean)) {
            const [name, param] = rule.split(':');
            switch (name) {
                case 'email':
                    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
                        return 'Please enter a valid email address';
                    break;
                case 'url':
                    try { new URL(value); if (!/^https?:/.test(value)) throw 0; }
                    catch { return 'Please enter a valid URL (starting with http:// or https://)'; }
                    break;
                case 'phone':
                    if (!/^[+\d][\d\s\-().]{6,}$/.test(value))
                        return 'Please enter a valid phone number';
                    break;
                case 'numeric':
                    if (!/^\d+$/.test(value))
                        return 'Only numbers are allowed';
                    break;
                case 'alpha':
                    if (!/^[A-Za-z]+$/.test(value))
                        return 'Only letters are allowed';
                    break;
                case 'alphanumeric':
                    if (!/^[A-Za-z0-9]+$/.test(value))
                        return 'Only letters and numbers are allowed';
                    break;
                case 'min':
                    if (parseFloat(value) < parseFloat(param))
                        return `Value must be at least ${param}`;
                    break;
                case 'max':
                    if (parseFloat(value) > parseFloat(param))
                        return `Value must be no more than ${param}`;
                    break;
                case 'minlen':
                    if (value.length < parseInt(param))
                        return `Must be at least ${param} characters`;
                    break;
                case 'maxlen':
                    if (value.length > parseInt(param))
                        return `Must be no more than ${param} characters`;
                    break;
                case 'regex':
                    try { if (!new RegExp(param).test(value)) return 'Invalid format'; }
                    catch { console.warn(`[smart-input] Invalid regex in data-validate: ${param}`); }
                    break;
                default:
                    console.warn(`[smart-input] Unknown validate rule: "${name}"`);
            }
        }
        return null; // all passed
    }

    // ── Helpers: select options & search box ────────────────────────────────

    renderOptions(select, options) {
        options.forEach(opt => {
            const option = document.createElement('option');
            option.value       = opt.id;
            option.textContent = opt.name;
            select.appendChild(option);
        });
    }

    createSearchBox(container, select, url, responsePath) {
        // Hide the native select — it only holds the value for form submission
        select.style.cssText = 'position:absolute;opacity:0;pointer-events:none;height:0;width:0;';
        select.tabIndex = -1;

        // ── Combobox input ────────────────────────────────────────────────────
        const combobox = document.createElement('input');
        combobox.className   = this._cls('si-input si-search-input', 'form-control');
        combobox.placeholder = this.getAttribute('placeholder') || 'Type to search…';
        combobox.setAttribute('autocomplete', 'off');
        combobox.setAttribute('role', 'combobox');
        combobox.setAttribute('aria-expanded', 'false');
        combobox.setAttribute('aria-autocomplete', 'list');

        // Spinner inside the input (right side)
        const spinner = document.createElement('div');
        spinner.className = 'si-spinner si-search-spinner';

        // Clear/deselect button — shows when a value is selected
        const clearBtn = document.createElement('button');
        clearBtn.type      = 'button';
        clearBtn.className = 'si-clear-btn si-hidden';
        clearBtn.setAttribute('aria-label', 'Clear selection');
        clearBtn.innerHTML = '<i class="ph ph-x"></i>';

        // ── Dropdown panel ────────────────────────────────────────────────────
        const dropdown = document.createElement('div');
        dropdown.className = 'si-search-dropdown';
        dropdown.setAttribute('role', 'listbox');

        container.appendChild(combobox);
        container.appendChild(spinner);
        container.appendChild(clearBtn);
        container.appendChild(dropdown);

        // ── State ─────────────────────────────────────────────────────────────
        let _debounce, _selectedValue = '', _selectedLabel = '', _activeIndex = -1, _currentRows = [];

        const _open  = () => { dropdown.classList.add('show'); combobox.setAttribute('aria-expanded', 'true'); };
        const _close = () => { dropdown.classList.remove('show'); combobox.setAttribute('aria-expanded', 'false'); _activeIndex = -1; };

        const _setActive = (idx) => {
            _currentRows.forEach((r, i) => r.classList.toggle('si-search-option--active', i === idx));
            _activeIndex = idx;
        };

        const _commit = (value, label) => {
            _selectedValue = value;
            _selectedLabel = label;
            combobox.value = label;
            // Sync to native select for form submission
            let opt = select.querySelector(`option[value="${CSS.escape(value)}"]`);
            if (!opt) { opt = document.createElement('option'); opt.value = value; select.appendChild(opt); }
            opt.textContent = label;
            opt.selected    = true;
            // Show clear button, hide spinner, close dropdown
            clearBtn.classList.remove('si-hidden');
            combobox.style.paddingRight = '2.2rem';
            _close();
            // Fire change for validation + smartState
            select.dispatchEvent(new Event('change', { bubbles: true }));
            combobox.classList.remove('si-input--invalid', 'is-invalid');
            const error = this.querySelector('.si-error');
            if (error) this._hide(error);
        };

        const _clear = () => {
            _selectedValue = '';
            _selectedLabel = '';
            combobox.value = '';
            select.innerHTML = '';
            clearBtn.classList.add('si-hidden');
            combobox.style.paddingRight = '';
            dropdown.innerHTML = '';
            _close();
            combobox.focus();
        };

        const _renderRows = (rows) => {
            dropdown.innerHTML = '';
            _currentRows = [];
            _activeIndex  = -1;

            if (!rows.length) {
                dropdown.innerHTML = '<div class="si-search-empty"><i class="ph ph-magnifying-glass"></i> No results found</div>';
                _open();
                return;
            }

            rows.forEach((row, idx) => {
                const label = row.name || row.title || row.label || row.text || Object.values(row)[1] || Object.values(row)[0];
                const value = String(row.id ?? row.value ?? label);

                const el = document.createElement('div');
                el.className   = 'si-search-option';
                el.setAttribute('role', 'option');
                el.setAttribute('aria-selected', value === _selectedValue ? 'true' : 'false');
                el.innerHTML = `<span class="si-search-option-text">${label}</span>`;
                if (value === _selectedValue) el.classList.add('si-search-option--selected');

                el.addEventListener('mousedown', (e) => {
                    e.preventDefault(); // prevent combobox blur before commit
                    _commit(value, label);
                });
                el.addEventListener('mousemove', () => _setActive(idx));

                dropdown.appendChild(el);
                _currentRows.push(el);
            });

            _open();
        };

        const _fetch = (term) => {
            spinner.style.display = 'block';
            const sep = url.includes('?') ? '&' : '?';
            fetch(`${url}${sep}q=${encodeURIComponent(term)}`)
                .then(r => r.json())
                .then(data => {
                    spinner.style.display = 'none';
                    const rows = responsePath ? this.extractDataFromPath(data, responsePath) : data;
                    _renderRows(Array.isArray(rows) ? rows : []);
                })
                .catch(() => { spinner.style.display = 'none'; });
        };

        // ── Events ────────────────────────────────────────────────────────────

        combobox.addEventListener('input', () => {
            const term = combobox.value.trim();
            // If user edits after a selection, clear the committed value
            if (_selectedValue && combobox.value !== _selectedLabel) _clear();
            clearTimeout(_debounce);
            if (term.length < 2) { _close(); return; }
            _debounce = setTimeout(() => _fetch(term), 280);
        });

        combobox.addEventListener('keydown', (e) => {
            if (!dropdown.classList.contains('show')) return;
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                _setActive(Math.min(_activeIndex + 1, _currentRows.length - 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                _setActive(Math.max(_activeIndex - 1, 0));
            } else if (e.key === 'Enter' && _activeIndex >= 0) {
                e.preventDefault();
                _currentRows[_activeIndex].dispatchEvent(new MouseEvent('mousedown'));
            } else if (e.key === 'Escape') {
                _close();
            }
        });

        combobox.addEventListener('blur', () => {
            // Small delay so mousedown on an option can fire first
            setTimeout(() => {
                _close();
                // If user blurred without selecting, restore last label or clear
                if (!_selectedValue) combobox.value = '';
                else combobox.value = _selectedLabel;
            }, 150);
        });

        combobox.addEventListener('focus', () => {
            // Re-open dropdown if there's already a typed term and results
            if (combobox.value && !_selectedValue && _currentRows.length) _open();
        });

        clearBtn.addEventListener('click', () => _clear());

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) _close();
        });
    }

    // ── Helpers: multi-select ────────────────────────────────────────────────

    createMultiSelect(container, name, options, value, placeholder, fetchUrl, responsePath) {
        const wrapper = document.createElement('div');
        wrapper.className = 'si-multi-container';

        const hiddenSelect = document.createElement('select');
        hiddenSelect.name     = name;
        hiddenSelect.multiple = true;
        hiddenSelect.className = 'si-multi-hidden';

        const display = document.createElement('div');
        display.className = 'si-multi-display';
        display.innerHTML = `<span class="si-multi-placeholder">${placeholder || 'Select options...'}</span>`;

        const icon = document.createElement('i');
        icon.className = 'ph ph-caret-down si-multi-icon';

        const dropdown = document.createElement('div');
        dropdown.className = 'si-multi-dropdown';

        const searchBox = document.createElement('div');
        searchBox.className = 'si-multi-search';
        searchBox.innerHTML = '<input type="text" placeholder="Search..." autocomplete="off" />';

        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'si-multi-options';

        dropdown.appendChild(searchBox);
        dropdown.appendChild(optionsContainer);

        wrapper.appendChild(hiddenSelect);
        wrapper.appendChild(display);
        wrapper.appendChild(icon);
        wrapper.appendChild(dropdown);
        container.appendChild(wrapper);

        this.multiSelectData = {
            wrapper, display, icon, dropdown, optionsContainer,
            searchInput: searchBox.querySelector('input'),
            hiddenSelect,
            selectedValues: new Set(),
            allOptions: []
        };

        if (options) {
            try {
                const opts = JSON.parse(options);
                this.multiSelectData.allOptions = opts;
                // Populate selectedValues FIRST so renderMultiSelectOptions
                // correctly marks pre-selected options with the selected class
                if (value) {
                    value.split(',').map(v => v.trim()).filter(Boolean)
                         .forEach(v => this.multiSelectData.selectedValues.add(String(v)));
                }
                this.renderMultiSelectOptions(opts);
                if (value) this.updateMultiSelectDisplay();
            } catch (e) {
                console.warn('[smart-input] Invalid JSON in data-options:', options);
            }
        }

        display.addEventListener('click', (e) => {
            if (!e.target.closest('.si-multi-tag-remove')) this.toggleMultiSelectDropdown();
        });

        this.multiSelectData.searchInput.addEventListener('input', (e) => {
            const term     = e.target.value.toLowerCase();
            const filtered = this.multiSelectData.allOptions.filter(o => o.name.toLowerCase().includes(term));
            this.renderMultiSelectOptions(filtered);
        });

        document.addEventListener('click', (e) => {
            if (!wrapper.contains(e.target)) this.closeMultiSelectDropdown();
        });

        if (fetchUrl) this.setupMultiSelectFetch(fetchUrl, responsePath);
        this.inputElement = hiddenSelect;
    }

    renderMultiSelectOptions(options) {
        const c = this.multiSelectData.optionsContainer;
        c.innerHTML = '';
        if (options.length === 0) {
            c.innerHTML = '<div class="si-multi-no-results">No options found</div>';
            return;
        }
        options.forEach(opt => {
            const el = document.createElement('div');
            el.className     = 'si-multi-option';
            el.dataset.value = opt.id;
            if (this.multiSelectData.selectedValues.has(String(opt.id))) el.classList.add('selected');
            el.innerHTML = `<div class="si-multi-option-cb"><i class="ph ph-check"></i></div><span>${opt.name}</span>`;
            el.addEventListener('click', () => this.toggleMultiSelectOption(opt.id, opt.name));
            c.appendChild(el);
        });
    }

    toggleMultiSelectOption(value) {
        const key = String(value);
        if (this.multiSelectData.selectedValues.has(key))
            this.multiSelectData.selectedValues.delete(key);
        else
            this.multiSelectData.selectedValues.add(key);
        this.updateMultiSelectDisplay();
        this.renderMultiSelectOptions(this.multiSelectData.allOptions);
    }

    updateMultiSelectDisplay() {
        const { display, hiddenSelect, selectedValues, allOptions } = this.multiSelectData;
        const placeholderText = this.getAttribute('placeholder') || 'Select options...';
        display.innerHTML   = '';
        hiddenSelect.innerHTML = '';

        if (selectedValues.size === 0) {
            display.innerHTML = `<span class="si-multi-placeholder">${placeholderText}</span>`;
            return;
        }

        selectedValues.forEach(value => {
            const optData = allOptions.find(o => String(o.id) === String(value));
            if (!optData) return;

            const tag = document.createElement('div');
            tag.className = 'si-multi-tag';
            tag.innerHTML = `<span>${optData.name}</span>
                <button type="button" class="si-multi-tag-remove" data-value="${value}">
                    <i class="ph ph-x" style="font-size:14px;"></i>
                </button>`;
            tag.querySelector('.si-multi-tag-remove').addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleMultiSelectOption(value);
            });
            display.appendChild(tag);

            const option = document.createElement('option');
            option.value    = value;
            option.selected = true;
            hiddenSelect.appendChild(option);
        });

        hiddenSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }

    toggleMultiSelectDropdown() {
        const { dropdown, icon, display } = this.multiSelectData;
        if (dropdown.classList.contains('show')) {
            this.closeMultiSelectDropdown();
        } else {
            dropdown.classList.add('show');
            icon.classList.add('open');
            display.classList.add('open');
            this.multiSelectData.searchInput.focus();
        }
    }

    closeMultiSelectDropdown() {
        const { dropdown, icon, display, searchInput, allOptions } = this.multiSelectData;
        dropdown.classList.remove('show');
        icon.classList.remove('open');
        display.classList.remove('open');
        searchInput.value = '';
        this.renderMultiSelectOptions(allOptions);
    }

    setupMultiSelectFetch(url, responsePath) {
        let timer;
        this.multiSelectData.searchInput.addEventListener('input', (e) => {
            clearTimeout(timer);
            const term = e.target.value.trim();
            if (term.length > 1) {
                timer = setTimeout(() => {
                    fetch(`${url}?q=${term}`)
                        .then(r => r.json())
                        .then(data => {
                            const rows = responsePath ? this.extractDataFromPath(data, responsePath) : data;
                            if (Array.isArray(rows)) {
                                this.multiSelectData.allOptions = rows;
                                this.renderMultiSelectOptions(rows);
                            }
                        })
                        .catch(err => console.error(err));
                }, 300);
            }
        });
    }

    // ── Helpers: dates ───────────────────────────────────────────────────────

    convertDDMMYYYYToISO(dateStr) {
        if (!dateStr) return null;
        const [d, m, y] = dateStr.split('-');
        if (!d || !m || !y || y.length !== 4) return null;
        const dd = d.padStart(2, '0'), mm = m.padStart(2, '0');
        if (+mm < 1 || +mm > 12 || +dd < 1 || +dd > 31) return null;
        return `${y}-${mm}-${dd}`;
    }

    formatDateForDisplay(date) {
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
    }

    formatDateDDMMYYYY(date) {
        const d = String(date.getDate()).padStart(2, '0');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        return `${d}-${m}-${date.getFullYear()}`;
    }

    validateDate(dateStr) {
        const iso = this.convertDDMMYYYYToISO(dateStr);
        if (!iso) return false;
        const d = new Date(iso);
        return d instanceof Date && !isNaN(d);
    }

    // ── Helpers: files ───────────────────────────────────────────────────────

    getFileUploadHelpText(allowedTypes, maxSize, maxFiles, customAccept) {
        const parts = [];
        if (allowedTypes || customAccept) {
            parts.push(`<i class="ph ph-file-text"></i><strong>Accepted:</strong> ${this.getFileTypeDescription(allowedTypes, customAccept)}`);
        }
        if (maxSize) parts.push(`<i class="ph ph-hard-drives"></i><strong>Max size:</strong> ${maxSize}MB per file`);
        const n = parseInt(maxFiles) || 1;
        parts.push(`<i class="ph ph-${n > 1 ? 'files' : 'file'}"></i><strong>Max files:</strong> ${n > 1 ? n + ' files' : 'Single file only'}`);
        return parts.join(' <span style="margin:0 .5rem;color:#d1d5db">|</span> ');
    }

    getFileTypeDescription(allowedTypes, customAccept) {
        if (customAccept) return customAccept.split(',').map(e => e.trim().replace('.', '').toUpperCase()).join(', ');
        const map = {
            images: 'Images (JPG, PNG, GIF, etc.)', videos: 'Videos (MP4, AVI, MOV, etc.)',
            documents: 'Documents (PDF, DOC, DOCX, TXT)', spreadsheets: 'Spreadsheets (XLS, XLSX, CSV)',
            presentations: 'Presentations (PPT, PPTX)', archives: 'Archives (ZIP, RAR, 7Z, TAR)', audio: 'Audio files (MP3, WAV, etc.)'
        };
        return map[allowedTypes] || 'All files';
    }

    getFileAcceptAttribute(allowedTypes, customAccept) {
        if (customAccept) return customAccept;
        const map = {
            images: 'image/*', videos: 'video/*',
            documents: '.pdf,.doc,.docx,.txt,.rtf', spreadsheets: '.xls,.xlsx,.csv',
            presentations: '.ppt,.pptx', archives: '.zip,.rar,.7z,.tar,.gz', audio: 'audio/*'
        };
        return map[allowedTypes] || '';
    }

    validateFiles(files, allowedTypes, maxSize, maxFiles) {
        const n = parseInt(maxFiles) || 1;
        const mb = parseFloat(maxSize) || null;
        if (files.length > n) return { isValid: false, message: `Maximum ${n} file(s) allowed` };
        for (const file of files) {
            if (mb && file.size > mb * 1024 * 1024)
                return { isValid: false, message: `"${file.name}" exceeds ${mb}MB` };
            if (allowedTypes && !this.isFileTypeAllowed(file, allowedTypes))
                return { isValid: false, message: `File type not allowed for "${file.name}". Only ${allowedTypes} are accepted.` };
        }
        return { isValid: true, message: '' };
    }

    isFileTypeAllowed(file, allowedTypes) {
        const checks = {
            images:        file.type.startsWith('image/'),
            videos:        file.type.startsWith('video/'),
            audio:         file.type.startsWith('audio/'),
            documents:     ['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain','application/rtf'].includes(file.type),
            spreadsheets:  ['application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/csv'].includes(file.type),
            presentations: ['application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation'].includes(file.type),
            archives:      ['application/zip','application/x-rar-compressed','application/x-7z-compressed','application/x-tar','application/gzip'].includes(file.type),
        };
        return checks[allowedTypes] ?? true;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024, sizes = ['Bytes','KB','MB','GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    getFileIcon(file) {
        if (file.type.startsWith('image/'))   return 'ph ph-image';
        if (file.type.startsWith('video/'))   return 'ph ph-video';
        if (file.type.startsWith('audio/'))   return 'ph ph-music-note';
        if (file.type === 'application/pdf')  return 'ph ph-file-pdf';
        if (file.type.includes('word') || file.type.includes('document')) return 'ph ph-file-doc';
        if (file.type.includes('sheet') || file.type.includes('excel'))   return 'ph ph-file-xls';
        if (file.type.includes('presentation') || file.type.includes('powerpoint')) return 'ph ph-file-ppt';
        if (file.type.includes('zip') || file.type.includes('rar') || file.type.includes('archive')) return 'ph ph-file-zip';
        return 'ph ph-file';
    }

    displaySelectedFiles(files, container) {
        container.innerHTML = '';
        files.forEach((file, index) => {
            const item = document.createElement('div');
            item.className = 'si-file-item';
            item.innerHTML = `
                <div class="si-file-details">
                    <i class="${this.getFileIcon(file)} si-file-icon"></i>
                    <div>
                        <div class="si-file-name">${file.name}</div>
                        <div class="si-file-size">${this.formatFileSize(file.size)}</div>
                    </div>
                </div>
                <button type="button" class="si-remove-file" data-index="${index}" title="Remove file">
                    <i class="ph ph-x"></i>
                </button>`;
            item.querySelector('.si-remove-file').addEventListener('click', () => this.removeFile(index));
            container.appendChild(item);
        });
    }

    removeFile(index) {
        if (!this.inputElement) return;
        const dt = new DataTransfer();
        Array.from(this.inputElement.files).forEach((f, i) => { if (i !== index) dt.items.add(f); });
        this.inputElement.files = dt.files;
        const sel = this.fileInfo.querySelector('.si-selected-files');
        if (dt.files.length > 0) this.displaySelectedFiles(Array.from(dt.files), sel);
        else this._hide(this.fileInfo);
    }

    /**
     * Renders the modern per-file pill rows inside the si-file-list container.
     * Each row has the filename and a purple trash icon button (matching the design).
     * Re-renders the entire list on every change (add/remove) to stay in sync with DataTransfer.
     */
    _renderModernFileList(files, fileList, input, allowedTypes, maxSize, maxFiles, error, isSingle = false) {
        fileList.innerHTML = '';
        if (!files.length) return;

        const dt = new DataTransfer();
        files.forEach(f => dt.items.add(f));

        const _rebuild = () => {
            fileList.innerHTML = '';
            const currentFiles = Array.from(dt.files);

            if (!currentFiles.length) {
                input.files = dt.files;
                // Single file: restore dropzone when all files removed
                if (isSingle && this._dropzoneEl) {
                    this._show(this._dropzoneEl);
                    if (this._helpTextEl) this._show(this._helpTextEl);
                }
                const clearBtn = this.querySelector('.si-file-clear-btn');
                if (clearBtn) this._hide(clearBtn);
                return;
            }

            currentFiles.forEach((file, idx) => {
                const row = document.createElement('div');
                row.className = 'si-modern-file-row';
                row.innerHTML = `
                    <span class="si-modern-file-name">${file.name}</span>
                    <button type="button" class="si-modern-file-remove" aria-label="Remove ${file.name}">
                        <i class="ph ph-trash"></i>
                    </button>
                `;
                row.querySelector('.si-modern-file-remove').addEventListener('click', () => {
                    const newDt = new DataTransfer();
                    Array.from(dt.files).forEach((f, i) => { if (i !== idx) newDt.items.add(f); });
                    while (dt.items.length) dt.items.remove(0);
                    Array.from(newDt.files).forEach(f => dt.items.add(f));
                    input.files = dt.files;
                    _rebuild();
                });
                fileList.appendChild(row);
            });

            // Single-file: add "Upload Again" button below the file row
            if (isSingle) {
                const reuploadBtn = document.createElement('button');
                reuploadBtn.type      = 'button';
                reuploadBtn.className = 'si-reupload-btn';
                reuploadBtn.innerHTML = '<i class="ph ph-arrow-counter-clockwise"></i> Upload Again';
                reuploadBtn.addEventListener('click', () => {
                    // Remove existing file, restore dropzone, trigger picker
                    while (dt.items.length) dt.items.remove(0);
                    input.files = dt.files;
                    fileList.innerHTML = '';
                    if (this._dropzoneEl) this._show(this._dropzoneEl);
                    if (this._helpTextEl) this._show(this._helpTextEl);
                    const clearBtn = this.querySelector('.si-file-clear-btn');
                    if (clearBtn) this._hide(clearBtn);
                    input.value = '';
                    input.click(); // open file picker immediately
                });
                fileList.appendChild(reuploadBtn);
            }

            input.files = dt.files;
        };

        _rebuild();
    }

    // ── Helpers: misc ────────────────────────────────────────────────────────

    extractDataFromPath(response, path) {
        if (!path) return response;
        return path.split('.').reduce((obj, key) => {
            if (obj && key in obj) return obj[key];
            console.warn(`[smart-input] Path '${path}' not found in response`);
            return null;
        }, response);
    }

    // ── Public API ───────────────────────────────────────────────────────────

    get value() {
        const type     = this.getAttribute('type') || 'text';
        const multiple = this.hasAttribute('multiple');
        if (type === 'datepicker')                return this.hiddenInput ? this.hiddenInput.value : '';
        if (type === 'file')                       return this.inputElement ? this.inputElement.files : null;
        if (type === 'checkbox' || type === 'switch') return this.inputElement ? this.inputElement.checked : false;
        if (type === 'radio') {
            for (const r of this.querySelectorAll('input[type="radio"]'))
                if (r.checked) return r.value;
            return '';
        }
        if (type === 'select' && multiple && this.multiSelectData)
            return Array.from(this.multiSelectData.selectedValues).join(',');
        return this.inputElement ? this.inputElement.value : '';
    }

    set value(val) {
        const type     = this.getAttribute('type') || 'text';
        const multiple = this.hasAttribute('multiple');
        if (type === 'datepicker') {
            if (this.hiddenInput && this.inputElement && this.dateInput && val && this.validateDate(val)) {
                const iso = this.convertDDMMYYYYToISO(val);
                if (iso) { this.dateInput.value = iso; this.inputElement.value = this.formatDateForDisplay(new Date(iso)); this.hiddenInput.value = val; }
            } else if (this.hiddenInput) {
                this.dateInput.value = ''; this.inputElement.value = ''; this.hiddenInput.value = '';
            }
        } else if (type === 'file') {
            console.warn('[smart-input] File input values cannot be set programmatically');
        } else if (type === 'checkbox' || type === 'switch') {
            if (this.inputElement) this.inputElement.checked = val === 'true' || val === '1' || val === true;
        } else if (type === 'radio') {
            this.querySelectorAll('input[type="radio"]').forEach(r => r.checked = r.value == val);
        } else if (type === 'select' && multiple && this.multiSelectData) {
            this.multiSelectData.selectedValues.clear();
            if (val) val.split(',').map(v => v.trim()).filter(Boolean).forEach(v => this.multiSelectData.selectedValues.add(v));
            this.updateMultiSelectDisplay();
        } else if (type === 'select' && this.inputElement) {
            this.inputElement.value = val;
            if (this.inputElement.value !== val) {
                for (const opt of this.inputElement.querySelectorAll('option')) {
                    if (opt.textContent.toLowerCase() === String(val).toLowerCase() || opt.value.toLowerCase() === String(val).toLowerCase()) { opt.selected = true; break; }
                }
            }
        } else if (this.inputElement) {
            this.inputElement.value = val;
        }
        if (type !== 'file') super.setAttribute('value', val);
    }

    setAttribute(name, value) {
        super.setAttribute(name, value);
        if (name === 'value' && (this.inputElement || this.hiddenInput)) {
            this._updateInputValue(value);
        }
    }

    _updateInputValue(val) {
        // Delegates to the setter for DRY reuse
        this.value = val;
    }

    getInputElement() { return this.inputElement; }
    getHiddenInput()  { return this.hiddenInput; }

    focus() { if (this.inputElement) this.inputElement.focus(); }
}

customElements.define('smart-input', SmartInput);