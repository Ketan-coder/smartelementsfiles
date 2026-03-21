class SmartInput extends HTMLElement {
    connectedCallback() {
        const type = this.getAttribute('type') || 'text';
        const name = this.getAttribute('name') || 'input';
        const label = this.getAttribute('label') || '';
        const required = this.hasAttribute('required');
        const placeholder = this.getAttribute('placeholder') || '';
        const rows = this.getAttribute('rows') || 4;
        const multiple = this.hasAttribute('multiple');
        const options = this.getAttribute('data-options');
        const errorMsg = this.getAttribute('data-error') || `Invalid ${label.toLowerCase()}`;
        const fetchUrl = this.getAttribute('data-url');
        const responsePath = this.getAttribute('data-response-path') || '';
        const value = this.getAttribute('value') || '';
        
        // NEW: Autocomplete control
        const noAutocomplete = this.hasAttribute('no-autocomplete');

        // Switch-specific attributes
        const isBig = this.hasAttribute('is-big');
        const isMedium = this.hasAttribute('is-medium');
        const isSmall = this.hasAttribute('is-small');
        const selectedValue = this.getAttribute('selected-value') || '';
        const switchId = this.getAttribute('id') || `switch-${Math.random().toString(36).substr(2, 9)}`;

        // Date picker specific attributes
        const minDate = this.getAttribute('min-date') || '';
        const maxDate = this.getAttribute('max-date') || '';
        const dateFormat = this.getAttribute('date-format') || 'dd-mm-yyyy';

        // File upload specific attributes
        const accept = this.getAttribute('accept') || '';
        const maxSize = this.getAttribute('max-size') || '';
        const maxFiles = this.getAttribute('max-files') || '1';
        const allowedTypes = this.getAttribute('allowed-types') || '';

        const onInputFn = this.getAttribute('data-oninput');
        const onClickFn = this.getAttribute('data-onclick');
        const onChangeFn = this.getAttribute('data-onchange');

        this.innerHTML = `
            ${type === 'checkbox' || type === 'radio' || type === 'switch' ? '' : `<label class="form-label">${label}:${required ? '<span class="text-danger"> * </span>' : ''} </label>`}
            <div class="input-container position-relative"></div>
            <div class="invalid-feedback d-none">${errorMsg}</div>
        `;

        const container = this.querySelector('.input-container');
        const error = this.querySelector('.invalid-feedback');
        let input;

        if (type === 'textarea') {
            input = document.createElement('textarea');
            input.name = name;
            input.className = 'form-control';
            input.rows = rows;
            input.placeholder = placeholder;
            input.value = value;
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
                input = container.querySelector('.multi-select-hidden');
            } else {
                input = document.createElement('select');
                input.name = name;
                input.className = 'form-select';
                if (noAutocomplete) input.setAttribute('autocomplete', 'off');
            
                if (options) {
                    try {
                        const opts = JSON.parse(options);
                        this.renderOptions(input, opts);
                        if (value) {
                            input.value = value;
                            if (input.value !== value) {
                                const optionElements = input.querySelectorAll('option');
                                for (let opt of optionElements) {
                                    if (opt.textContent.toLowerCase() === value.toLowerCase() || 
                                        opt.value.toLowerCase() === value.toLowerCase()) {
                                        opt.selected = true;
                                        break;
                                    }
                                }
                            }
                        }
                    } catch (e) {
                        console.warn('Invalid JSON in data-options:', options);
                    }
                }
            
                container.appendChild(input);
            
                if (fetchUrl) this.createSearchBox(container, input, fetchUrl, responsePath);
            }
        }

        else if (type === 'datepicker') {
            const hiddenInput = document.createElement('input');
            hiddenInput.type = 'hidden';
            hiddenInput.name = name;
            hiddenInput.value = value;

            input = document.createElement('input');
            input.type = 'text';
            input.className = 'form-control';
            input.placeholder = placeholder || 'Select date...';
            input.readonly = true;
            input.style.cursor = 'pointer';
            if (noAutocomplete) input.setAttribute('autocomplete', 'off');

            const dateInput = document.createElement('input');
            dateInput.type = 'date';
            dateInput.style.position = 'absolute';
            dateInput.style.opacity = '0';
            dateInput.style.pointerEvents = 'none';

            if (minDate) {
                const minDateISO = this.convertDDMMYYYYToISO(minDate);
                if (minDateISO) dateInput.min = minDateISO;
            }
            if (maxDate) {
                const maxDateISO = this.convertDDMMYYYYToISO(maxDate);
                if (maxDateISO) dateInput.max = maxDateISO;
            }

            if (value) {
                const isoDate = this.convertDDMMYYYYToISO(value);
                if (isoDate) {
                    dateInput.value = isoDate;
                    input.value = this.formatDateForDisplay(new Date(isoDate));
                    hiddenInput.value = value;
                }
            }

            const calendarIcon = document.createElement('i');
            calendarIcon.className = 'ph ph-calendar';
            calendarIcon.style.position = 'absolute';
            calendarIcon.style.right = '10px';
            calendarIcon.style.top = '50%';
            calendarIcon.style.transform = 'translateY(-50%)';
            calendarIcon.style.pointerEvents = 'none';
            calendarIcon.style.color = '#6c757d';

            input.addEventListener('click', () => {
                dateInput.showPicker();
            });

            dateInput.addEventListener('change', () => {
                if (dateInput.value) {
                    const selectedDate = new Date(dateInput.value);
                    input.value = this.formatDateForDisplay(selectedDate);
                    hiddenInput.value = this.formatDateDDMMYYYY(selectedDate);
                    
                    error.classList.add('d-none');
                    input.classList.remove('is-invalid');
                    
                    hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });

            container.appendChild(hiddenInput);
            container.appendChild(input);
            container.appendChild(dateInput);
            container.appendChild(calendarIcon);

            this.inputElement = input;
            this.hiddenInput = hiddenInput;
            this.dateInput = dateInput;

            if (required) {
                hiddenInput.required = true;
                input.addEventListener('blur', () => {
                    if (required && !hiddenInput.value) {
                        error.textContent = 'Date is required';
                        error.classList.remove('d-none');
                        input.classList.add('is-invalid');
                        input.classList.add('shake');
                        setTimeout(() => input.classList.remove('shake'), 400);
                    } else {
                        error.classList.add('d-none');
                        input.classList.remove('is-invalid');
                    }
                });
            }
        }

        else if (type === 'file') {
            input = document.createElement('input');
            input.type = 'file';
            input.name = name;
            input.className = 'form-control';
            
            if (parseInt(maxFiles) > 1) {
                input.multiple = true;
            }
            
            const acceptAttr = this.getFileAcceptAttribute(allowedTypes, accept);
            if (acceptAttr) {
                input.accept = acceptAttr;
            }

            // NEW: File upload help text
            const helpText = document.createElement('small');
            helpText.className = 'form-text text-muted mt-1 d-block file-upload-help';
            helpText.innerHTML = this.getFileUploadHelpText(allowedTypes, maxSize, maxFiles, accept);

            const fileInfo = document.createElement('div');
            fileInfo.className = 'file-info mt-2 d-none';
            fileInfo.innerHTML = `
                <div class="selected-files"></div>
            `;

            container.appendChild(input);
            container.appendChild(helpText); // Add help text
            container.appendChild(fileInfo);

            this.inputElement = input;
            this.fileInfo = fileInfo;

            input.addEventListener('change', (e) => {
                const files = Array.from(e.target.files);
                const validation = this.validateFiles(files, allowedTypes, maxSize, maxFiles);
                
                if (validation.isValid) {
                    this.displaySelectedFiles(files, fileInfo.querySelector('.selected-files'));
                    fileInfo.classList.remove('d-none');
                    error.classList.add('d-none');
                    input.classList.remove('is-invalid');
                } else {
                    error.textContent = validation.message;
                    error.classList.remove('d-none');
                    input.classList.add('is-invalid');
                    input.classList.add('shake');
                    setTimeout(() => input.classList.remove('shake'), 400);
                    input.value = '';
                    fileInfo.classList.add('d-none');
                }
            });
        }

        else if (type === 'checkbox') {
            input = document.createElement('input');
            input.type = 'checkbox';
            input.name = name;
            input.checked = value === 'true' || value === '1';
            input.className = 'form-check-input me-2';

            const labelEl = document.createElement('label');
            labelEl.className = 'form-check-label';
            labelEl.textContent = label;

            const wrapper = document.createElement('div');
            wrapper.className = 'form-check';
            wrapper.appendChild(input);
            wrapper.appendChild(labelEl);
            container.appendChild(wrapper);
        }

        else if (type === 'switch') {
            input = document.createElement('input');
            input.type = 'checkbox';
            input.name = name;
            input.id = switchId;
            input.setAttribute('role', 'switch');
            input.value = selectedValue;
            
            input.checked = value === 'true' || value === '1' || selectedValue === 'true' || selectedValue === '1';
            
            let inputClasses = ['form-check-input'];
            if (isBig) inputClasses.push('form-check-input-lg');
            else if (isSmall) inputClasses.push('form-check-input-sm');
            
            input.className = inputClasses.join(' ');

            const labelEl = document.createElement('label');
            labelEl.className = 'form-check-label';
            labelEl.setAttribute('for', switchId);
            labelEl.textContent = label;
            labelEl.style.marginLeft = '10px';
            if (required) input.required = true;
            if (isBig) labelEl.style.fontSize = '1.25rem';
            if (isMedium) labelEl.style.fontSize = '1rem';
            if (isSmall) labelEl.style.fontSize = '0.875rem';

            const wrapper = document.createElement('div');
            let wrapperClasses = ['form-check', 'form-switch'];
            if (isBig) wrapperClasses.push('form-switch-lg');
            else if (isSmall) wrapperClasses.push('form-switch-sm');
            
            wrapper.className = wrapperClasses.join(' ');
            wrapper.appendChild(input);
            wrapper.appendChild(labelEl);
            container.appendChild(wrapper);
        }

        else if (type === 'radio') {
            if (!options) return;
            try {
                const opts = JSON.parse(options);
                opts.forEach(opt => {
                    const radio = document.createElement('input');
                    radio.type = 'radio';
                    radio.name = name;
                    radio.value = opt.id;
                    radio.className = 'form-check-input me-2';
                    if (opt.id == value) radio.checked = true;

                    const labelEl = document.createElement('label');
                    labelEl.className = 'form-check-label me-3';
                    labelEl.textContent = opt.name;

                    const wrapper = document.createElement('div');
                    wrapper.className = 'form-check form-check-inline';
                    wrapper.appendChild(radio);
                    wrapper.appendChild(labelEl);
                    container.appendChild(wrapper);

                    this.attachEvents(radio, error, onInputFn, onClickFn, onChangeFn);
                });
            } catch (e) {
                console.warn('Invalid JSON in data-options:', options);
            }
            return;
        }

        else {
            input = document.createElement('input');
            input.type = type;
            input.name = name;
            input.className = 'form-control';
            input.placeholder = placeholder;
            input.value = value;
            if (noAutocomplete) {
                input.setAttribute('autocomplete', 'new-' + name);
                input.setAttribute('autocorrect', 'off');
                input.setAttribute('autocapitalize', 'off');
                input.setAttribute('spellcheck', 'false');
            }
            container.appendChild(input);
        }

        if (input && type !== 'datepicker' && type !== 'file' && !(type === 'select' && multiple)) {
            if (required) input.required = true;
            this.attachEvents(input, error, onInputFn, onClickFn, onChangeFn);
        } else if (type === 'file' && input) {
            if (required) input.required = true;
            input.addEventListener('click', e => {
                if (onClickFn && window[onClickFn]) window[onClickFn](e);
            });
        }

        if (type !== 'datepicker' && !(type === 'select' && multiple)) {
            this.inputElement = input;
        }

        const style = document.createElement('style');
        style.textContent = `
            .shake {
                animation: shake 0.3s ease-in-out;
            }
            @keyframes shake {
                0%, 100% { transform: translateX(0); }
                25% { transform: translateX(-5px); }
                50% { transform: translateX(5px); }
                75% { transform: translateX(-5px); }
            }
            
            /* FIX 1: Red border on invalid input */
            .form-control.is-invalid,
            .form-select.is-invalid {
                border-color: #dc3545 !important;
                padding-right: calc(1.5em + 0.75rem);
                background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12' width='12' height='12' fill='none' stroke='%23dc3545'%3e%3ccircle cx='6' cy='6' r='4.5'/%3e%3cpath stroke-linejoin='round' d='M5.8 3.6h.4L6 6.5z'/%3e%3ccircle cx='6' cy='8.2' r='.6' fill='%23dc3545' stroke='none'/%3e%3c/svg%3e");
                background-repeat: no-repeat;
                background-position: right calc(0.375em + 0.1875rem) center;
                background-size: calc(0.75em + 0.375rem) calc(0.75em + 0.375rem);
            }
            
            .spinner {
                position: absolute;
                right: 10px;
                top: 8px;
                width: 1rem;
                height: 1rem;
                border: 2px solid #ccc;
                border-top: 2px solid #333;
                border-radius: 50%;
                animation: spin 0.8s linear infinite;
                display: none;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            .form-switch-lg .form-check-input-lg {
                width: 3em;
                height: 1.75em;
            }
            .form-switch-sm .form-check-input-sm {
                width: 1.75em;
                height: 1em;
            }
            
            .input-container {
                position: relative;
            }
            
            /* FIX 4: File upload help text styling */
            .file-upload-help {
                font-size: 0.875rem;
                color: #6c757d;
                margin-top: 0.25rem;
            }
            .file-upload-help i {
                margin-right: 0.25rem;
            }
            
            .file-info {
                border: 1px solid #dee2e6;
                border-radius: 0.375rem;
                padding: 0.75rem;
                background-color: #f8f9fa;
            }
            .selected-files {
                margin-bottom: 0;
            }
            .file-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 0.5rem;
                border-bottom: 1px solid #dee2e6;
                margin-bottom: 0.5rem;
            }
            .file-item:last-child {
                border-bottom: none;
                margin-bottom: 0;
            }
            .file-details {
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            .file-icon {
                font-size: 1.5rem;
                color: #6c757d;
            }
            .file-name {
                font-weight: 500;
            }
            .file-size {
                color: #6c757d;
                font-size: 0.875rem;
            }
            .remove-file {
                background: none;
                border: none;
                color: #dc3545;
                cursor: pointer;
                padding: 0.25rem;
                border-radius: 0.25rem;
                font-size: 1.2rem;
            }
            .remove-file:hover {
                background-color: #f5c6cb;
            }
            
            /* Multi-select tag-based styling */
            .multi-select-container {
                position: relative;
                width: 100%;
            }
            .multi-select-display {
                min-height: 42px;
                padding: 0.375rem 2.25rem 0.375rem 0.75rem;
                border: 1px solid #dee2e6;
                border-radius: 0.375rem;
                background-color: #fff;
                cursor: pointer;
                display: flex;
                flex-wrap: wrap;
                gap: 0.375rem;
                align-items: center;
                transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
            }
            .multi-select-display:hover {
                border-color: #86b7fe;
            }
            .multi-select-display.open {
                border-color: #86b7fe;
                box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.25);
            }
            
            /* FIX 1: Red border for invalid multi-select */
            .multi-select-display.is-invalid {
                border-color: #dc3545 !important;
                box-shadow: 0 0 0 0.25rem rgba(220, 53, 69, 0.25);
            }
            
            .multi-select-placeholder {
                color: #6c757d;
                font-size: 1rem;
            }
            .multi-select-tag {
                display: inline-flex;
                align-items: center;
                gap: 0.375rem;
                padding: 0.25rem 0.5rem;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: #fff;
                border-radius: 0.25rem;
                font-size: 0.875rem;
                font-weight: 500;
                animation: tagFadeIn 0.2s ease-in-out;
            }
            @keyframes tagFadeIn {
                from {
                    opacity: 0;
                    transform: scale(0.8);
                }
                to {
                    opacity: 1;
                    transform: scale(1);
                }
            }
            .multi-select-tag-remove {
                background: none;
                border: none;
                color: #fff;
                cursor: pointer;
                padding: 0;
                display: flex;
                align-items: center;
                opacity: 0.8;
                transition: opacity 0.2s;
            }
            .multi-select-tag-remove:hover {
                opacity: 1;
            }
            .multi-select-icon {
                position: absolute;
                right: 0.75rem;
                top: 50%;
                transform: translateY(-50%);
                pointer-events: none;
                color: #6c757d;
                transition: transform 0.2s;
            }
            .multi-select-icon.open {
                transform: translateY(-50%) rotate(180deg);
            }
            .multi-select-dropdown {
                position: absolute;
                top: 100%;
                left: 0;
                right: 0;
                margin-top: 0.25rem;
                background: #fff;
                border: 1px solid #dee2e6;
                border-radius: 0.375rem;
                box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15);
                max-height: 300px;
                overflow-y: auto;
                z-index: 1050;
                display: none;
                animation: dropdownSlideIn 0.2s ease-out;
            }
            @keyframes dropdownSlideIn {
                from {
                    opacity: 0;
                    transform: translateY(-10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            .multi-select-dropdown.show {
                display: block;
            }
            .multi-select-search {
                position: sticky;
                top: 0;
                padding: 0.5rem;
                background: #fff;
                border-bottom: 1px solid #dee2e6;
                z-index: 1;
            }
            .multi-select-search input {
                width: 100%;
                padding: 0.5rem;
                border: 1px solid #dee2e6;
                border-radius: 0.25rem;
                font-size: 0.875rem;
            }
            .multi-select-search input:focus {
                outline: none;
                border-color: #86b7fe;
                box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.25);
            }
            .multi-select-options {
                padding: 0.25rem 0;
            }
            .multi-select-option {
                padding: 0.5rem 0.75rem;
                cursor: pointer;
                transition: background-color 0.15s;
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            .multi-select-option:hover {
                background-color: #f8f9fa;
            }
            .multi-select-option.selected {
                background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
                font-weight: 500;
            }
            .multi-select-option-checkbox {
                width: 18px;
                height: 18px;
                border: 2px solid #dee2e6;
                border-radius: 0.25rem;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                transition: all 0.2s;
            }
            .multi-select-option.selected .multi-select-option-checkbox {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-color: #667eea;
            }
            .multi-select-option-checkbox i {
                color: #fff;
                font-size: 12px;
                display: none;
            }
            .multi-select-option.selected .multi-select-option-checkbox i {
                display: block;
            }
            .multi-select-no-results {
                padding: 1rem;
                text-align: center;
                color: #6c757d;
                font-size: 0.875rem;
            }
            .multi-select-hidden {
                position: absolute;
                opacity: 0;
                pointer-events: none;
            }
            
            /* FIX 2: Dark mode support for multi-select */
            @media (prefers-color-scheme: dark) {
                .multi-select-display {
                    background-color: #2b3035;
                    border-color: #495057;
                    color: #f8f9fa;
                }
                .multi-select-display:hover {
                    border-color: #6c757d;
                }
                .multi-select-display.open {
                    border-color: #6c757d;
                    box-shadow: 0 0 0 0.25rem rgba(108, 117, 125, 0.25);
                }
                .multi-select-placeholder {
                    color: #adb5bd;
                }
                .multi-select-icon {
                    color: #adb5bd;
                }
                .multi-select-dropdown {
                    background: #2b3035;
                    border-color: #495057;
                    box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.5);
                }
                .multi-select-search {
                    background: #2b3035;
                    border-bottom-color: #495057;
                }
                .multi-select-search input {
                    background-color: #1a1d20;
                    border-color: #495057;
                    color: #f8f9fa;
                }
                .multi-select-search input::placeholder {
                    color: #6c757d;
                }
                .multi-select-search input:focus {
                    border-color: #6c757d;
                    box-shadow: 0 0 0 0.25rem rgba(108, 117, 125, 0.25);
                }
                .multi-select-option {
                    color: #f8f9fa;
                }
                .multi-select-option:hover {
                    background-color: #1a1d20;
                }
                .multi-select-option.selected {
                    background: linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%);
                }
                .multi-select-option-checkbox {
                    border-color: #6c757d;
                }
                .multi-select-no-results {
                    color: #adb5bd;
                }
                .file-info {
                    background-color: #2b3035;
                    border-color: #495057;
                }
                .file-item {
                    border-bottom-color: #495057;
                }
                .file-name {
                    color: #f8f9fa;
                }
                .file-size,
                .file-icon {
                    color: #adb5bd;
                }
                .file-upload-help {
                    color: #adb5bd;
                }
            }
        `;
        this.appendChild(style);

        // ── SmartState integration ──────────────────────────────────────────
        // Runs after DOM is built so `this.inputElement` is already set.
        this._initStateIntegration();
    }

    /**
     * SmartState integration for <smart-input>.
     *
     * Supported attributes:
     *   state-bind   — two-way sync: input value ↔ smartState[key]
     *   state-set    — on change: write value to smartState[key] (write-only)
     *   state-listen — on smartState[key] change: update input value (read-only)
     *
     * Example:
     *   <smart-input name="search" state-bind="searchTerm"></smart-input>
     *   <smart-input name="filter" state-set="filterValue"></smart-input>
     *   <smart-input name="display" state-listen="serverValue"></smart-input>
     */
    _initStateIntegration() {
        if (!window.smartState) return;

        const bindKey   = this.getAttribute('state-bind');
        const setKey    = this.getAttribute('state-set');
        const listenKey = this.getAttribute('state-listen') || bindKey;

        // Helper: get the current value from the real input element
        const getVal = () => {
            if (this.inputElement) return this.inputElement.value;
            // multi-select stores value differently
            const hidden = this.querySelector('.multi-select-hidden');
            if (hidden) return hidden.value;
            const ctrl = this.querySelector('input, select, textarea');
            return ctrl ? ctrl.value : '';
        };

        // Helper: set value on the real input element
        const setVal = (v) => {
            const val = v == null ? '' : String(v);
            if (this.inputElement) {
                this.inputElement.value = val;
                return;
            }
            const ctrl = this.querySelector('input:not([type=hidden]), select, textarea');
            if (ctrl) ctrl.value = val;
        };

        // ── Read: listen to smartState changes and update input ──
        if (listenKey) {
            const existing = window.smartState.get(listenKey);
            if (existing != null) setVal(existing);

            const stateHandler = (newVal) => setVal(newVal);
            window.smartState.subscribe(listenKey, stateHandler);
            // Store unsub ref for disconnectedCallback
            this._stateUnsub = () => window.smartState.unsubscribe(listenKey, stateHandler);
        }

        // ── Write: push input changes to smartState ──
        const writeKey = bindKey || setKey;
        if (writeKey) {
            const writeToState = () => {
                window.smartState.set(writeKey, getVal());
                // Bubble a custom event so <smart-filter-bar> auto-apply works
                this.dispatchEvent(new Event('sfb-input-change', { bubbles: true, composed: true }));
            };

            const ctrl = this.inputElement
                || this.querySelector('.multi-select-hidden')
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
    }

    // NEW METHOD: Generate file upload help text
    getFileUploadHelpText(allowedTypes, maxSize, maxFiles, customAccept) {
        const parts = [];
        
        // Accepted file types
        if (allowedTypes || customAccept) {
            const typeText = this.getFileTypeDescription(allowedTypes, customAccept);
            parts.push(`<i class="ph ph-file-text"></i><strong>Accepted:</strong> ${typeText}`);
        }
        
        // Max file size
        if (maxSize) {
            parts.push(`<i class="ph ph-hard-drives"></i><strong>Max size:</strong> ${maxSize}MB per file`);
        }
        
        // Max files
        const maxFilesNum = parseInt(maxFiles) || 1;
        if (maxFilesNum > 1) {
            parts.push(`<i class="ph ph-files"></i><strong>Max files:</strong> ${maxFilesNum} files`);
        } else {
            parts.push(`<i class="ph ph-file"></i><strong>Max files:</strong> Single file only`);
        }
        
        return parts.length > 0 ? parts.join(' <span style="margin: 0 0.5rem; color: #dee2e6;">|</span> ') : '';
    }

    // NEW METHOD: Get human-readable file type description
    getFileTypeDescription(allowedTypes, customAccept) {
        if (customAccept) {
            // Parse custom accept string
            const extensions = customAccept.split(',').map(ext => ext.trim().replace('.', '').toUpperCase());
            return extensions.join(', ');
        }
        
        const typeDescriptions = {
            'images': 'Images (JPG, PNG, GIF, etc.)',
            'videos': 'Videos (MP4, AVI, MOV, etc.)',
            'documents': 'Documents (PDF, DOC, DOCX, TXT)',
            'spreadsheets': 'Spreadsheets (XLS, XLSX, CSV)',
            'presentations': 'Presentations (PPT, PPTX)',
            'archives': 'Archives (ZIP, RAR, 7Z, TAR)',
            'audio': 'Audio files (MP3, WAV, etc.)'
        };
        
        return typeDescriptions[allowedTypes] || 'All files';
    }

    createMultiSelect(container, name, options, value, placeholder, fetchUrl, responsePath) {
        const wrapper = document.createElement('div');
        wrapper.className = 'multi-select-container';

        const hiddenSelect = document.createElement('select');
        hiddenSelect.name = name;
        hiddenSelect.multiple = true;
        hiddenSelect.className = 'multi-select-hidden';

        const display = document.createElement('div');
        display.className = 'multi-select-display';
        display.innerHTML = `<span class="multi-select-placeholder">${placeholder || 'Select options...'}</span>`;

        const icon = document.createElement('i');
        icon.className = 'ph ph-caret-down multi-select-icon';

        const dropdown = document.createElement('div');
        dropdown.className = 'multi-select-dropdown';

        const searchBox = document.createElement('div');
        searchBox.className = 'multi-select-search';
        searchBox.innerHTML = '<input type="text" placeholder="Search..." autocomplete="off" />';

        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'multi-select-options';

        dropdown.appendChild(searchBox);
        dropdown.appendChild(optionsContainer);

        wrapper.appendChild(hiddenSelect);
        wrapper.appendChild(display);
        wrapper.appendChild(icon);
        wrapper.appendChild(dropdown);
        container.appendChild(wrapper);

        this.multiSelectData = {
            wrapper,
            display,
            icon,
            dropdown,
            optionsContainer,
            searchInput: searchBox.querySelector('input'),
            hiddenSelect,
            selectedValues: new Set(),
            allOptions: []
        };

        if (options) {
            try {
                const opts = JSON.parse(options);
                this.multiSelectData.allOptions = opts;
                this.renderMultiSelectOptions(opts);

                if (value) {
                    const values = value.split(',').map(v => v.trim());
                    values.forEach(v => {
                        if (v) {
                            this.multiSelectData.selectedValues.add(v);
                        }
                    });
                    this.updateMultiSelectDisplay();
                }
            } catch (e) {
                console.warn('Invalid JSON in data-options:', options);
            }
        }

        display.addEventListener('click', (e) => {
            if (!e.target.closest('.multi-select-tag-remove')) {
                this.toggleMultiSelectDropdown();
            }
        });

        this.multiSelectData.searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const filtered = this.multiSelectData.allOptions.filter(opt =>
                opt.name.toLowerCase().includes(searchTerm)
            );
            this.renderMultiSelectOptions(filtered);
        });

        document.addEventListener('click', (e) => {
            if (!wrapper.contains(e.target)) {
                this.closeMultiSelectDropdown();
            }
        });

        if (fetchUrl) {
            this.setupMultiSelectFetch(fetchUrl, responsePath);
        }

        this.inputElement = hiddenSelect;
    }

    renderMultiSelectOptions(options) {
        const container = this.multiSelectData.optionsContainer;
        container.innerHTML = '';

        if (options.length === 0) {
            container.innerHTML = '<div class="multi-select-no-results">No options found</div>';
            return;
        }

        options.forEach(opt => {
            const option = document.createElement('div');
            option.className = 'multi-select-option';
            option.dataset.value = opt.id;
            
            if (this.multiSelectData.selectedValues.has(opt.id)) {
                option.classList.add('selected');
            }

            option.innerHTML = `
                <div class="multi-select-option-checkbox">
                    <i class="ph ph-check"></i>
                </div>
                <span>${opt.name}</span>
            `;

            option.addEventListener('click', () => {
                this.toggleMultiSelectOption(opt.id, opt.name);
            });

            container.appendChild(option);
        });
    }

    toggleMultiSelectOption(value, name) {
        if (this.multiSelectData.selectedValues.has(value)) {
            this.multiSelectData.selectedValues.delete(value);
        } else {
            this.multiSelectData.selectedValues.add(value);
        }

        this.updateMultiSelectDisplay();
        this.renderMultiSelectOptions(this.multiSelectData.allOptions);
    }

    updateMultiSelectDisplay() {
        const display = this.multiSelectData.display;
        const hiddenSelect = this.multiSelectData.hiddenSelect;
        const placeholderText = this.getAttribute('placeholder') || 'Select options...';

        display.innerHTML = '';
        hiddenSelect.innerHTML = '';

        if (this.multiSelectData.selectedValues.size === 0) {
            display.innerHTML = `<span class="multi-select-placeholder">${placeholderText}</span>`;
            return;
        }

        this.multiSelectData.selectedValues.forEach(value => {
            const optData = this.multiSelectData.allOptions.find(opt => opt.id === value);
            if (optData) {
                const tag = document.createElement('div');
                tag.className = 'multi-select-tag';
                tag.innerHTML = `
                    <span>${optData.name}</span>
                    <button type="button" class="multi-select-tag-remove" data-value="${value}">
                        <i class="ph ph-x" style="font-size: 14px;"></i>
                    </button>
                `;

                const removeBtn = tag.querySelector('.multi-select-tag-remove');
                removeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleMultiSelectOption(value, optData.name);
                });

                display.appendChild(tag);

                const option = document.createElement('option');
                option.value = value;
                option.selected = true;
                hiddenSelect.appendChild(option);
            }
        });

        hiddenSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }

    toggleMultiSelectDropdown() {
        const dropdown = this.multiSelectData.dropdown;
        const icon = this.multiSelectData.icon;
        const display = this.multiSelectData.display;

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
        const dropdown = this.multiSelectData.dropdown;
        const icon = this.multiSelectData.icon;
        const display = this.multiSelectData.display;

        dropdown.classList.remove('show');
        icon.classList.remove('open');
        display.classList.remove('open');
        this.multiSelectData.searchInput.value = '';
        this.renderMultiSelectOptions(this.multiSelectData.allOptions);
    }

    setupMultiSelectFetch(url, responsePath) {
        const searchInput = this.multiSelectData.searchInput;
        let debounceTimer;

        searchInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            const term = e.target.value.trim();

            if (term.length > 1) {
                debounceTimer = setTimeout(() => {
                    fetch(`${url}?q=${term}`)
                        .then(res => res.json())
                        .then(responseData => {
                            const data = responsePath ? this.extractDataFromPath(responseData, responsePath) : responseData;

                            if (data && Array.isArray(data)) {
                                this.multiSelectData.allOptions = data;
                                this.renderMultiSelectOptions(data);
                            } else {
                                console.warn('Response data is not an array or path is invalid:', data);
                            }
                        })
                        .catch(err => {
                            console.error(err);
                        });
                }, 300);
            }
        });
    }

    convertDDMMYYYYToISO(dateStr) {
        if (!dateStr) return null;
        const parts = dateStr.split('-');
        if (parts.length !== 3) return null;
        
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2];
        
        if (year.length !== 4 || isNaN(day) || isNaN(month) || isNaN(year)) return null;
        if (parseInt(month) < 1 || parseInt(month) > 12) return null;
        if (parseInt(day) < 1 || parseInt(day) > 31) return null;
        
        return `${year}-${month}-${day}`;
    }

    formatDateForDisplay(date) {
        const options = { 
            day: '2-digit', 
            month: 'long', 
            year: 'numeric' 
        };
        return date.toLocaleDateString('en-GB', options);
    }

    formatDateDDMMYYYY(date) {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${day}-${month}-${year}`;
    }

    validateDate(dateStr) {
        if (!dateStr) return false;
        
        const isoDate = this.convertDDMMYYYYToISO(dateStr);
        if (!isoDate) return false;
        
        const date = new Date(isoDate);
        return date instanceof Date && !isNaN(date);
    }

    extractDataFromPath(response, path) {
        if (!path) return response;
        
        const keys = path.split('.');
        let data = response;
        
        for (let key of keys) {
            if (data && typeof data === 'object' && key in data) {
                data = data[key];
            } else {
                console.warn(`Path '${path}' not found in response`);
                return null;
            }
        }
        
        return data;
    }

    getFileAcceptAttribute(allowedTypes, customAccept) {
        if (customAccept) return customAccept;
        
        const typeMap = {
            'images': 'image/*',
            'videos': 'video/*',
            'documents': '.pdf,.doc,.docx,.txt,.rtf',
            'spreadsheets': '.xls,.xlsx,.csv',
            'presentations': '.ppt,.pptx',
            'archives': '.zip,.rar,.7z,.tar,.gz',
            'audio': 'audio/*'
        };
        
        return typeMap[allowedTypes] || '';
    }

    validateFiles(files, allowedTypes, maxSize, maxFiles) {
        const maxFilesNum = parseInt(maxFiles) || 1;
        const maxSizeMB = parseFloat(maxSize) || null;
        
        if (files.length > maxFilesNum) {
            return {
                isValid: false,
                message: `Maximum ${maxFilesNum} file(s) allowed`
            };
        }
        
        for (let file of files) {
            if (maxSizeMB && file.size > maxSizeMB * 1024 * 1024) {
                return {
                    isValid: false,
                    message: `File "${file.name}" exceeds maximum size of ${maxSizeMB}MB`
                };
            }
            
            if (allowedTypes && !this.isFileTypeAllowed(file, allowedTypes)) {
                return {
                    isValid: false,
                    message: `File type not allowed for "${file.name}". Only ${allowedTypes} are allowed.`
                };
            }
        }
        
        return { isValid: true, message: '' };
    }

    isFileTypeAllowed(file, allowedTypes) {
        const typeChecks = {
            'images': file.type.startsWith('image/'),
            'videos': file.type.startsWith('video/'),
            'documents': [
                'application/pdf',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'text/plain',
                'application/rtf'
            ].includes(file.type),
            'spreadsheets': [
                'application/vnd.ms-excel',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'text/csv'
            ].includes(file.type),
            'presentations': [
                'application/vnd.ms-powerpoint',
                'application/vnd.openxmlformats-officedocument.presentationml.presentation'
            ].includes(file.type),
            'archives': [
                'application/zip',
                'application/x-rar-compressed',
                'application/x-7z-compressed',
                'application/x-tar',
                'application/gzip'
            ].includes(file.type),
            'audio': file.type.startsWith('audio/')
        };
        
        return typeChecks[allowedTypes] || true;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    getFileIcon(file) {
        if (file.type.startsWith('image/')) return 'ph ph-image';
        if (file.type.startsWith('video/')) return 'ph ph-video';
        if (file.type.startsWith('audio/')) return 'ph ph-music-note';
        if (file.type === 'application/pdf') return 'ph ph-file-pdf';
        if (file.type.includes('word') || file.type.includes('document')) return 'ph ph-file-doc';
        if (file.type.includes('sheet') || file.type.includes('excel')) return 'ph ph-file-xls';
        if (file.type.includes('presentation') || file.type.includes('powerpoint')) return 'ph ph-file-ppt';
        if (file.type.includes('zip') || file.type.includes('rar') || file.type.includes('archive')) return 'ph ph-file-zip';
        return 'ph ph-file';
    }

    displaySelectedFiles(files, container) {
        container.innerHTML = '';
        
        files.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            
            fileItem.innerHTML = `
                <div class="file-details">
                    <i class="${this.getFileIcon(file)} file-icon"></i>
                    <div>
                        <div class="file-name">${file.name}</div>
                        <div class="file-size">${this.formatFileSize(file.size)}</div>
                    </div>
                </div>
                <button type="button" class="remove-file" data-index="${index}" title="Remove file">
                    <i class="ph ph-x"></i>
                </button>
            `;
            
            const removeBtn = fileItem.querySelector('.remove-file');
            removeBtn.addEventListener('click', () => {
                this.removeFile(index);
            });
            
            container.appendChild(fileItem);
        });
    }

    removeFile(index) {
        if (!this.inputElement) return;
        
        const dt = new DataTransfer();
        const files = Array.from(this.inputElement.files);
        
        files.forEach((file, i) => {
            if (i !== index) {
                dt.items.add(file);
            }
        });
        
        this.inputElement.files = dt.files;
        
        if (dt.files.length > 0) {
            this.displaySelectedFiles(Array.from(dt.files), this.fileInfo.querySelector('.selected-files'));
        } else {
            this.fileInfo.classList.add('d-none');
        }
    }

    get value() {
        const type = this.getAttribute('type') || 'text';
        const multiple = this.hasAttribute('multiple');
        
        if (type === 'datepicker') {
            return this.hiddenInput ? this.hiddenInput.value : '';
        } else if (type === 'file') {
            return this.inputElement ? this.inputElement.files : null;
        } else if (type === 'checkbox' || type === 'switch') {
            return this.inputElement ? this.inputElement.checked : false;
        } else if (type === 'radio') {
            const radios = this.querySelectorAll('input[type="radio"]');
            for (let radio of radios) {
                if (radio.checked) return radio.value;
            }
            return '';
        } else if (type === 'select' && multiple && this.multiSelectData) {
            return Array.from(this.multiSelectData.selectedValues).join(',');
        }
        return this.inputElement ? this.inputElement.value : '';
    }

    set value(val) {
        const type = this.getAttribute('type') || 'text';
        const multiple = this.hasAttribute('multiple');
        
        if (type === 'datepicker') {
            if (this.hiddenInput && this.inputElement && this.dateInput) {
                if (val && this.validateDate(val)) {
                    const isoDate = this.convertDDMMYYYYToISO(val);
                    if (isoDate) {
                        this.dateInput.value = isoDate;
                        this.inputElement.value = this.formatDateForDisplay(new Date(isoDate));
                        this.hiddenInput.value = val;
                    }
                } else {
                    this.dateInput.value = '';
                    this.inputElement.value = '';
                    this.hiddenInput.value = '';
                }
            }
        } else if (type === 'file') {
            console.warn('File input values cannot be set programmatically');
        } else if (type === 'checkbox' || type === 'switch') {
            if (this.inputElement) {
                this.inputElement.checked = val === 'true' || val === '1' || val === true;
            }
        } else if (type === 'radio') {
            const radios = this.querySelectorAll('input[type="radio"]');
            radios.forEach(radio => {
                radio.checked = radio.value == val;
            });
        } else if (type === 'select' && multiple && this.multiSelectData) {
            this.multiSelectData.selectedValues.clear();
            if (val) {
                const values = val.split(',').map(v => v.trim());
                values.forEach(v => {
                    if (v) {
                        this.multiSelectData.selectedValues.add(v);
                    }
                });
            }
            this.updateMultiSelectDisplay();
        } else if (type === 'select') {
            if (this.inputElement) {
                this.inputElement.value = val;
                if (this.inputElement.value !== val) {
                    const optionElements = this.inputElement.querySelectorAll('option');
                    for (let opt of optionElements) {
                        if (opt.textContent.toLowerCase() === val.toLowerCase() || 
                            opt.value.toLowerCase() === val.toLowerCase()) {
                            opt.selected = true;
                            break;
                        }
                    }
                }
            }
        } else if (this.inputElement) {
            this.inputElement.value = val;
        }
        
        if (type !== 'file') {
            super.setAttribute('value', val);
        }
    }

    setAttribute(name, value) {
        super.setAttribute(name, value);
        if (name === 'value' && (this.inputElement || this.hiddenInput)) {
            this._updateInputValue(value);
        }
    }

    _updateInputValue(val) {
        const type = this.getAttribute('type') || 'text';
        const multiple = this.hasAttribute('multiple');
        
        if (type === 'datepicker') {
            if (this.hiddenInput && this.inputElement && this.dateInput) {
                if (val && this.validateDate(val)) {
                    const isoDate = this.convertDDMMYYYYToISO(val);
                    if (isoDate) {
                        this.dateInput.value = isoDate;
                        this.inputElement.value = this.formatDateForDisplay(new Date(isoDate));
                        this.hiddenInput.value = val;
                    }
                }
            }
        } else if (type === 'checkbox' || type === 'switch') {
            if (this.inputElement) {
                this.inputElement.checked = val === 'true' || val === '1' || val === true;
            }
        } else if (type === 'radio') {
            const radios = this.querySelectorAll('input[type="radio"]');
            radios.forEach(radio => {
                radio.checked = radio.value == val;
            });
        } else if (type === 'select' && multiple && this.multiSelectData) {
            this.multiSelectData.selectedValues.clear();
            if (val) {
                const values = val.split(',').map(v => v.trim());
                values.forEach(v => {
                    if (v) {
                        this.multiSelectData.selectedValues.add(v);
                    }
                });
            }
            this.updateMultiSelectDisplay();
        } else if (type === 'select') {
            if (this.inputElement) {
                this.inputElement.value = val;
                if (this.inputElement.value !== val) {
                    const optionElements = this.inputElement.querySelectorAll('option');
                    for (let opt of optionElements) {
                        if (opt.textContent.toLowerCase() === val.toLowerCase() || 
                            opt.value.toLowerCase() === val.toLowerCase()) {
                            opt.selected = true;
                            break;
                        }
                    }
                }
            }
        } else if (this.inputElement) {
            this.inputElement.value = val;
        }
    }

    getInputElement() {
        return this.inputElement;
    }

    getHiddenInput() {
        return this.hiddenInput;
    }

    focus() {
        if (this.inputElement) {
            this.inputElement.focus();
        }
    }

    validate() {
        const type = this.getAttribute('type') || 'text';
        const multiple = this.hasAttribute('multiple');
        const error = this.querySelector('.invalid-feedback');
        const required = this.hasAttribute('required');
        
        if (type === 'datepicker') {
            const value = this.hiddenInput ? this.hiddenInput.value : '';
            
            if (required && !value) {
                error.textContent = 'Date is required';
                error.classList.remove('d-none');
                this.inputElement.classList.add('is-invalid');
                this.inputElement.classList.add('shake');
                setTimeout(() => this.inputElement.classList.remove('shake'), 400);
                return false;
            } else if (value && !this.validateDate(value)) {
                error.textContent = 'Invalid date format (dd-mm-yyyy)';
                error.classList.remove('d-none');
                this.inputElement.classList.add('is-invalid');
                this.inputElement.classList.add('shake');
                setTimeout(() => this.inputElement.classList.remove('shake'), 400);
                return false;
            } else {
                error.classList.add('d-none');
                this.inputElement.classList.remove('is-invalid');
                return true;
            }
        } else if (type === 'select' && multiple && this.multiSelectData) {
            if (required && this.multiSelectData.selectedValues.size === 0) {
                error.textContent = 'Please select at least one option';
                error.classList.remove('d-none');
                this.multiSelectData.display.classList.add('is-invalid');
                this.multiSelectData.display.classList.add('shake');
                setTimeout(() => this.multiSelectData.display.classList.remove('shake'), 400);
                return false;
            } else {
                error.classList.add('d-none');
                this.multiSelectData.display.classList.remove('is-invalid');
                return true;
            }
        } else if (type === 'file') {
            const files = this.inputElement ? Array.from(this.inputElement.files) : [];
            
            if (required && files.length === 0) {
                error.textContent = 'File is required';
                error.classList.remove('d-none');
                this.inputElement.classList.add('is-invalid');
                this.inputElement.classList.add('shake');
                setTimeout(() => this.inputElement.classList.remove('shake'), 400);
                return false;
            } else if (files.length > 0) {
                const allowedTypes = this.getAttribute('allowed-types') || '';
                const maxSize = this.getAttribute('max-size') || '';
                const maxFiles = this.getAttribute('max-files') || '1';
                
                const validation = this.validateFiles(files, allowedTypes, maxSize, maxFiles);
                if (!validation.isValid) {
                    error.textContent = validation.message;
                    error.classList.remove('d-none');
                    this.inputElement.classList.add('is-invalid');
                    this.inputElement.classList.add('shake');
                    setTimeout(() => this.inputElement.classList.remove('shake'), 400);
                    return false;
                }
            }
            
            error.classList.add('d-none');
            this.inputElement.classList.remove('is-invalid');
            return true;
        } else if (this.inputElement) {
            if (!this.inputElement.checkValidity()) {
                error.classList.remove('d-none');
                this.inputElement.classList.add('is-invalid');
                this.inputElement.classList.add('shake');
                setTimeout(() => this.inputElement.classList.remove('shake'), 400);
                return false;
            } else {
                error.classList.add('d-none');
                this.inputElement.classList.remove('is-invalid');
                return true;
            }
        }
        return true;
    }

    attachEvents(input, error, onInputFn, onClickFn, onChangeFn) {
        input.addEventListener('blur', () => {
            if (!input.checkValidity()) {
                error.classList.remove('d-none');
                input.classList.add('is-invalid');
                input.classList.add('shake');
                setTimeout(() => input.classList.remove('shake'), 400);
            } else {
                error.classList.add('d-none');
                input.classList.remove('is-invalid');
            }
        });

        input.addEventListener('input', e => {
            error.classList.add('d-none');
            input.classList.remove('is-invalid');
            if (onInputFn && window[onInputFn]) window[onInputFn](e);
        });

        input.addEventListener('click', e => {
            if (onClickFn && window[onClickFn]) window[onClickFn](e);
        });

        input.addEventListener('change', e => {
            if (onChangeFn && window[onChangeFn]) window[onChangeFn](e);
        });
    }

    renderOptions(select, options) {
        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.id;
            option.textContent = opt.name;
            select.appendChild(option);
        });
    }

    createSearchBox(container, select, url, responsePath) {
        const inputBox = document.createElement('input');
        inputBox.className = 'form-control mb-1';
        inputBox.placeholder = 'Search...';
        inputBox.setAttribute('autocomplete', 'off');
    
        const spinner = document.createElement('div');
        spinner.className = 'spinner';
        
        container.insertBefore(spinner, select);
        container.insertBefore(inputBox, spinner);
    
        inputBox.addEventListener('input', () => {
            const term = inputBox.value.trim();
            if (term.length > 1) {
                spinner.style.display = 'inline-block';
                fetch(`${url}?q=${term}`)
                    .then(res => res.json())
                    .then(responseData => {
                        select.innerHTML = '';
                        
                        const data = responsePath ? this.extractDataFromPath(responseData, responsePath) : responseData;
                        
                        if (data && Array.isArray(data)) {
                            this.renderOptions(select, data);
                        } else {
                            console.warn('Response data is not an array or path is invalid:', data);
                        }
                        
                        spinner.style.display = 'none';
                    }).catch(err => {
                        console.error(err);
                        spinner.style.display = 'none';
                    });
            }
        });
    }
}

customElements.define('smart-input', SmartInput);