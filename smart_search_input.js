class SmartSearchInput extends HTMLElement {
    connectedCallback() {
        const name = this.getAttribute('name') || 'search-input';
        const label = this.getAttribute('label') || 'Search';
        const placeholder = this.getAttribute('placeholder') || 'Search...';
        const fetchUrl = this.getAttribute('data-url') || '';
        const responsePath = this.getAttribute('data-response-path') || '';
        const multiple = this.hasAttribute('multiple');
        const required = this.hasAttribute('required');
        const minChars = parseInt(this.getAttribute('min-chars')) || 1; // Changed from 2 to 1
        const itemsPerPage = parseInt(this.getAttribute('items-per-page')) || 10;
        
        // State management
        this.state = {
            allResults: [],
            filteredResults: [],
            selectedItems: new Map(),
            currentPage: 1,
            itemsPerPage: itemsPerPage,
            isLoading: false,
            searchTerm: ''
        };

        this.innerHTML = `
            <div class=\"smart-search-wrapper\">
                <label class=\"smart-search-label\">${label}${required ? '<span class=\"text-danger\"> *</span>' : ''}</label>
                
                <div class=\"smart-search-input-container\">
                    <i class=\"ph ph-magnifying-glass search-icon\"></i>
                    <input 
                        type=\"text\" 
                        class=\"smart-search-input\" 
                        placeholder=\"${placeholder}\"
                        autocomplete=\"off\"
                        autocorrect=\"off\"
                        autocapitalize=\"off\"
                        spellcheck=\"false\"
                    />
                    <div class=\"search-spinner\" style=\"display: none;\">
                        <i class=\"ph ph-circle-notch spin-animation\"></i>
                    </div>
                </div>

                <!-- Selected Items (hidden by default) -->
                <div class=\"smart-search-selected-items\" style=\"display: none;\">
                    <div class=\"selected-items-header\">
                        <span class=\"selected-count\">0 items selected</span>
                        <button type=\"button\" class=\"clear-all-btn\">
                            <i class=\"ph ph-x\"></i> Clear all
                        </button>
                    </div>
                    <div class=\"selected-items-list\"></div>
                </div>

                <!-- Dropdown Results -->
                <div class=\"smart-search-dropdown\" style=\"display: none;\">
                    <div class=\"smart-search-results\"></div>
                    <div class=\"smart-search-no-results\" style=\"display: none;\">
                        <i class=\"ph ph-magnifying-glass\"></i>
                        <p>No results found</p>
                    </div>
                    <div class=\"smart-search-pagination\" style=\"display: none;\">
                        <button type=\"button\" class=\"pagination-info\">
                            <i class=\"ph ph-arrows-down-up\"></i> Scroll for more
                        </button>
                    </div>
                </div>

                <!-- Hidden input for form submission -->
                <input type=\"hidden\" name=\"${name}\" class=\"smart-search-hidden-input\" />
            </div>
        `;

        // Store references
        this.elements = {
            input: this.querySelector('.smart-search-input'),
            dropdown: this.querySelector('.smart-search-dropdown'),
            results: this.querySelector('.smart-search-results'),
            noResults: this.querySelector('.smart-search-no-results'),
            spinner: this.querySelector('.search-spinner'),
            selectedContainer: this.querySelector('.smart-search-selected-items'),
            selectedList: this.querySelector('.selected-items-list'),
            selectedCount: this.querySelector('.selected-count'),
            clearAllBtn: this.querySelector('.clear-all-btn'),
            hiddenInput: this.querySelector('.smart-search-hidden-input'),
            pagination: this.querySelector('.smart-search-pagination')
        };

        this.config = {
            fetchUrl,
            responsePath,
            multiple,
            minChars
        };

        // Event listeners
        this.setupEventListeners();
        
        // Infinite scroll setup
        this.setupInfiniteScroll();

        // Add styles
        this.addStyles();

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.contains(e.target)) {
                this.closeDropdown();
            }
        });
    }

    setupEventListeners() {
        // Search input
        let debounceTimer;
        this.elements.input.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            const term = e.target.value.trim();
            this.state.searchTerm = term;

            if (term.length >= this.config.minChars) {
                debounceTimer = setTimeout(() => {
                    this.performSearch(term);
                }, 300);
            } else {
                this.closeDropdown();
            }
        });

        // Focus input
        this.elements.input.addEventListener('focus', () => {
            if (this.state.searchTerm.length >= this.config.minChars) {
                this.openDropdown();
            }
        });

        // Clear all button
        this.elements.clearAllBtn.addEventListener('click', () => {
            this.clearAllSelections();
        });
    }

    setupInfiniteScroll() {
        this.elements.results.addEventListener('scroll', () => {
            const { scrollTop, scrollHeight, clientHeight } = this.elements.results;
            
            // Check if scrolled to bottom (with 50px threshold)
            if (scrollTop + clientHeight >= scrollHeight - 50) {
                this.loadMoreResults();
            }
        });
    }

    async performSearch(term) {
        if (!this.config.fetchUrl) {
            console.warn('No data-url provided for smart-search-input');
            return;
        }

        this.state.isLoading = true;
        this.showSpinner();

        try {
            const response = await fetch(`${this.config.fetchUrl}?q=${encodeURIComponent(term)}`);
            const data = await response.json();
            
            // Extract data from nested path if specified
            const results = this.config.responsePath 
                ? this.extractDataFromPath(data, this.config.responsePath) 
                : data;

            if (Array.isArray(results)) {
                this.state.allResults = results;
                this.state.filteredResults = results;
                this.state.currentPage = 1;
                this.renderResults();
            } else {
                console.warn('Search results is not an array:', results);
                this.showNoResults();
            }
        } catch (error) {
            console.error('Search error:', error);
            this.showNoResults();
        } finally {
            this.state.isLoading = false;
            this.hideSpinner();
        }
    }

    renderResults() {
        const startIndex = 0;
        const endIndex = this.state.currentPage * this.state.itemsPerPage;
        const paginatedResults = this.state.filteredResults.slice(startIndex, endIndex);

        if (paginatedResults.length === 0) {
            this.showNoResults();
            return;
        }

        this.elements.results.innerHTML = '';
        this.elements.noResults.style.display = 'none';

        paginatedResults.forEach(item => {
            const resultItem = this.createResultItem(item);
            this.elements.results.appendChild(resultItem);
        });

        // Show pagination indicator if there are more results
        if (endIndex < this.state.filteredResults.length) {
            this.elements.pagination.style.display = 'block';
        } else {
            this.elements.pagination.style.display = 'none';
        }

        this.openDropdown();
    }

    loadMoreResults() {
        const totalPages = Math.ceil(this.state.filteredResults.length / this.state.itemsPerPage);
        
        if (this.state.currentPage < totalPages && !this.state.isLoading) {
            this.state.currentPage++;
            
            const startIndex = (this.state.currentPage - 1) * this.state.itemsPerPage;
            const endIndex = this.state.currentPage * this.state.itemsPerPage;
            const newResults = this.state.filteredResults.slice(startIndex, endIndex);

            newResults.forEach(item => {
                const resultItem = this.createResultItem(item);
                this.elements.results.appendChild(resultItem);
            });

            // Hide pagination if no more results
            if (endIndex >= this.state.filteredResults.length) {
                this.elements.pagination.style.display = 'none';
            }
        }
    }

    createResultItem(item) {
        const div = document.createElement('div');
        div.className = 'search-result-item';
        
        const isSelected = this.state.selectedItems.has(item.id);
        if (isSelected) {
            div.classList.add('selected');
        }

        div.innerHTML = `
            <div class=\"result-item-content\">
                <div class=\"result-item-icon ${isSelected ? 'selected' : ''}\">
                    <i class=\"ph ${isSelected ? 'ph-check-circle' : 'ph-plus-circle'}\"></i>
                </div>
                <div class=\"result-item-text\">
                    <div class=\"result-item-name\">${item.name || item.title || 'Unnamed'}</div>
                    ${item.description ? `<div class=\"result-item-description\">${item.description}</div>` : ''}
                </div>
            </div>
        `;

        div.addEventListener('click', () => {
            this.toggleSelection(item, div);
        });

        return div;
    }

    toggleSelection(item, element) {
        if (this.state.selectedItems.has(item.id)) {
            // Deselect
            this.state.selectedItems.delete(item.id);
            element.classList.remove('selected');
            element.querySelector('.result-item-icon').classList.remove('selected');
            element.querySelector('.result-item-icon i').className = 'ph ph-plus-circle';
        } else {
            // Select
            if (!this.config.multiple) {
                // Clear previous selections if not multiple
                this.state.selectedItems.clear();
                this.elements.results.querySelectorAll('.search-result-item').forEach(el => {
                    el.classList.remove('selected');
                    el.querySelector('.result-item-icon').classList.remove('selected');
                    el.querySelector('.result-item-icon i').className = 'ph ph-plus-circle';
                });
            }
            
            this.state.selectedItems.set(item.id, item);
            element.classList.add('selected');
            element.querySelector('.result-item-icon').classList.add('selected');
            element.querySelector('.result-item-icon i').className = 'ph ph-check-circle';
        }

        this.updateSelectedItemsDisplay();
        this.updateHiddenInput();

        // Close dropdown if single selection
        if (!this.config.multiple) {
            this.closeDropdown();
            this.elements.input.value = item.name || item.title || '';
        }
    }

    updateSelectedItemsDisplay() {
        const count = this.state.selectedItems.size;

        if (count === 0) {
            // Hide the selected items container when empty
            this.elements.selectedContainer.style.display = 'none';
            return;
        }

        // Show the selected items container
        this.elements.selectedContainer.style.display = 'block';
        this.elements.selectedCount.textContent = `${count} item${count !== 1 ? 's' : ''} selected`;
        
        this.elements.selectedList.innerHTML = '';
        
        this.state.selectedItems.forEach((item, id) => {
            const tag = document.createElement('div');
            tag.className = 'selected-tag';
            tag.innerHTML = `
                <span class=\"selected-tag-name\">${item.name || item.title || 'Unnamed'}</span>
                <button type=\"button\" class=\"selected-tag-remove\">
                    <i class=\"ph ph-x\"></i>
                </button>
            `;

            const removeBtn = tag.querySelector('.selected-tag-remove');
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeSelection(id);
            });

            this.elements.selectedList.appendChild(tag);
        });
    }

    removeSelection(id) {
        this.state.selectedItems.delete(id);
        
        // Update the result item if visible
        const resultItems = this.elements.results.querySelectorAll('.search-result-item');
        resultItems.forEach(item => {
            const itemData = this.state.filteredResults.find(r => r.id === id);
            if (itemData) {
                item.classList.remove('selected');
                item.querySelector('.result-item-icon').classList.remove('selected');
                item.querySelector('.result-item-icon i').className = 'ph ph-plus-circle';
            }
        });

        this.updateSelectedItemsDisplay();
        this.updateHiddenInput();
    }

    clearAllSelections() {
        this.state.selectedItems.clear();
        
        // Update all result items
        this.elements.results.querySelectorAll('.search-result-item').forEach(item => {
            item.classList.remove('selected');
            item.querySelector('.result-item-icon').classList.remove('selected');
            item.querySelector('.result-item-icon i').className = 'ph ph-plus-circle';
        });

        this.updateSelectedItemsDisplay();
        this.updateHiddenInput();
        this.elements.input.value = '';
    }

    updateHiddenInput() {
        const values = Array.from(this.state.selectedItems.keys()).join(',');
        this.elements.hiddenInput.value = values;
        
        // Dispatch change event
        this.elements.hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
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

    showSpinner() {
        this.elements.spinner.style.display = 'flex';
    }

    hideSpinner() {
        this.elements.spinner.style.display = 'none';
    }

    showNoResults() {
        this.elements.results.innerHTML = '';
        this.elements.noResults.style.display = 'flex';
        this.elements.pagination.style.display = 'none';
        this.openDropdown();
    }

    openDropdown() {
        this.elements.dropdown.style.display = 'block';
    }

    closeDropdown() {
        this.elements.dropdown.style.display = 'none';
    }

    // Public API
    getSelectedItems() {
        return Array.from(this.state.selectedItems.values());
    }

    getSelectedIds() {
        return Array.from(this.state.selectedItems.keys());
    }

    setSelectedItems(items) {
        this.state.selectedItems.clear();
        items.forEach(item => {
            this.state.selectedItems.set(item.id, item);
        });
        this.updateSelectedItemsDisplay();
        this.updateHiddenInput();
    }

    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* Base Styles */
            .smart-search-wrapper {
                position: relative;
                width: 100%;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            }

            .smart-search-label {
                display: block;
                margin-bottom: 0.5rem;
                font-weight: 500;
                font-size: 0.875rem;
                color: #212529;
            }

            .smart-search-input-container {
                position: relative;
                width: 100%;
            }

            .search-icon {
                position: absolute;
                left: 0.75rem;
                top: 50%;
                transform: translateY(-50%);
                color: #6c757d;
                font-size: 1.125rem;
                pointer-events: none;
                z-index: 1;
            }

            .smart-search-input {
                width: 100%;
                padding: 0.625rem 2.5rem 0.625rem 2.5rem;
                font-size: 1rem;
                line-height: 1.5;
                color: #212529;
                background-color: #fff;
                border: 1px solid #dee2e6;
                border-radius: 0.375rem;
                transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
            }

            .smart-search-input:focus {
                outline: none;
                border-color: #86b7fe;
                box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.25);
            }

            .search-spinner {
                position: absolute;
                right: 0.75rem;
                top: 50%;
                transform: translateY(-50%);
                display: none;
                align-items: center;
                justify-content: center;
                color: #6c757d;
            }

            .spin-animation {
                animation: spin 1s linear infinite;
                font-size: 1.125rem;
            }

            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }

            /* Selected Items Container */
            .smart-search-selected-items {
                margin-top: 0.75rem;
                padding: 0.75rem;
                background: linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%);
                border: 1px solid #e7e9fc;
                border-radius: 0.375rem;
            }

            .selected-items-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 0.5rem;
                padding-bottom: 0.5rem;
                border-bottom: 1px solid #e7e9fc;
            }

            .selected-count {
                font-size: 0.875rem;
                font-weight: 600;
                color: #667eea;
            }

            .clear-all-btn {
                background: none;
                border: none;
                color: #dc3545;
                font-size: 0.8125rem;
                font-weight: 500;
                cursor: pointer;
                padding: 0.25rem 0.5rem;
                border-radius: 0.25rem;
                display: flex;
                align-items: center;
                gap: 0.25rem;
                transition: background-color 0.15s;
            }

            .clear-all-btn:hover {
                background-color: rgba(220, 53, 69, 0.1);
            }

            .selected-items-list {
                display: flex;
                flex-wrap: wrap;
                gap: 0.5rem;
            }

            .selected-tag {
                display: inline-flex;
                align-items: center;
                gap: 0.375rem;
                padding: 0.375rem 0.625rem;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: #fff;
                border-radius: 0.25rem;
                font-size: 0.875rem;
                font-weight: 500;
                animation: tagFadeIn 0.2s ease-out;
            }

            @keyframes tagFadeIn {
                from {
                    opacity: 0;
                    transform: scale(0.9);
                }
                to {
                    opacity: 1;
                    transform: scale(1);
                }
            }

            .selected-tag-name {
                max-width: 200px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .selected-tag-remove {
                background: none;
                border: none;
                color: #fff;
                cursor: pointer;
                padding: 0;
                display: flex;
                align-items: center;
                opacity: 0.8;
                transition: opacity 0.15s;
                font-size: 1rem;
            }

            .selected-tag-remove:hover {
                opacity: 1;
            }

            /* Dropdown */
            .smart-search-dropdown {
                position: absolute;
                top: calc(100% + 0.25rem);
                left: 0;
                right: 0;
                background: #fff;
                border: 1px solid #dee2e6;
                border-radius: 0.375rem;
                box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15);
                z-index: 1050;
                max-height: 400px;
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

            .smart-search-results {
                max-height: 350px;
                overflow-y: auto;
                padding: 0.25rem 0;
            }

            /* Custom Scrollbar */
            .smart-search-results::-webkit-scrollbar {
                width: 8px;
            }

            .smart-search-results::-webkit-scrollbar-track {
                background: #f1f3f5;
                border-radius: 4px;
            }

            .smart-search-results::-webkit-scrollbar-thumb {
                background: #adb5bd;
                border-radius: 4px;
            }

            .smart-search-results::-webkit-scrollbar-thumb:hover {
                background: #6c757d;
            }

            /* Result Item - Mobile Optimized */
            .search-result-item {
                padding: 0.875rem;
                cursor: pointer;
                transition: background-color 0.15s;
                border-bottom: 1px solid #f1f3f5;
                min-height: 60px;
            }

            .search-result-item:last-child {
                border-bottom: none;
            }

            .search-result-item:hover {
                background-color: #f8f9fa;
            }

            .search-result-item.selected {
                background: linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%);
            }

            .result-item-content {
                display: flex;
                align-items: flex-start;
                gap: 0.75rem;
            }

            .result-item-icon {
                flex-shrink: 0;
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                background-color: #f1f3f5;
                color: #6c757d;
                font-size: 1.25rem;
                transition: all 0.2s;
                margin-top: 2px;
            }

            .result-item-icon.selected {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: #fff;
            }

            .result-item-text {
                flex: 1;
                min-width: 0;
            }

            .result-item-name {
                font-size: 1rem;
                font-weight: 500;
                color: #212529;
                line-height: 1.4;
                margin-bottom: 0.25rem;
                
                /* Two-line ellipsis */
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
                overflow: hidden;
                text-overflow: ellipsis;
                word-break: break-word;
            }

            .result-item-description {
                font-size: 0.875rem;
                color: #6c757d;
                line-height: 1.3;
                
                /* Single line ellipsis */
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            /* No Results */
            .smart-search-no-results {
                display: none;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 2rem 1rem;
                color: #6c757d;
            }

            .smart-search-no-results i {
                font-size: 3rem;
                margin-bottom: 0.5rem;
                opacity: 0.5;
            }

            .smart-search-no-results p {
                margin: 0;
                font-size: 0.875rem;
            }

            /* Pagination Info */
            .smart-search-pagination {
                padding: 0.75rem;
                text-align: center;
                border-top: 1px solid #dee2e6;
                background-color: #f8f9fa;
                border-radius: 0 0 0.375rem 0.375rem;
            }

            .pagination-info {
                background: none;
                border: none;
                color: #667eea;
                font-size: 0.8125rem;
                font-weight: 500;
                display: inline-flex;
                align-items: center;
                gap: 0.375rem;
                cursor: default;
            }

            .pagination-info i {
                animation: bounce 2s infinite;
            }

            @keyframes bounce {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-4px); }
            }

            /* Mobile Optimizations */
            @media (max-width: 768px) {
                .smart-search-input {
                    font-size: 16px; /* Prevents zoom on iOS */
                    padding: 0.75rem 2.5rem 0.75rem 2.5rem;
                }

                .search-result-item {
                    padding: 1rem;
                    min-height: 68px;
                }

                .result-item-icon {
                    width: 36px;
                    height: 36px;
                    font-size: 1.375rem;
                }

                .result-item-name {
                    font-size: 1.0625rem;
                }

                .smart-search-dropdown {
                    max-height: 70vh;
                }

                .smart-search-results {
                    max-height: calc(70vh - 50px);
                }
            }

            /* Dark Mode Support */
            @media (prefers-color-scheme: dark) {
                .smart-search-label {
                    color: #f8f9fa;
                }

                .smart-search-input {
                    color: #f8f9fa;
                    background-color: #2b3035;
                    border-color: #495057;
                }

                .smart-search-input:focus {
                    border-color: #6c757d;
                    box-shadow: 0 0 0 0.25rem rgba(108, 117, 125, 0.25);
                }

                .smart-search-input::placeholder {
                    color: #6c757d;
                }

                .search-icon,
                .search-spinner {
                    color: #adb5bd;
                }

                .smart-search-selected-items {
                    background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
                    border-color: #495057;
                }

                .selected-items-header {
                    border-bottom-color: #495057;
                }

                .selected-count {
                    color: #a8b4ff;
                }

                .clear-all-btn {
                    color: #ff6b6b;
                }

                .clear-all-btn:hover {
                    background-color: rgba(255, 107, 107, 0.1);
                }

                .smart-search-dropdown {
                    background: #2b3035;
                    border-color: #495057;
                    box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.5);
                }

                .smart-search-results::-webkit-scrollbar-track {
                    background: #1a1d20;
                }

                .smart-search-results::-webkit-scrollbar-thumb {
                    background: #495057;
                }

                .smart-search-results::-webkit-scrollbar-thumb:hover {
                    background: #6c757d;
                }

                .search-result-item {
                    border-bottom-color: #343a40;
                }

                .search-result-item:hover {
                    background-color: #1a1d20;
                }

                .search-result-item.selected {
                    background: linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%);
                }

                .result-item-icon {
                    background-color: #343a40;
                    color: #adb5bd;
                }

                .result-item-name {
                    color: #f8f9fa;
                }

                .result-item-description {
                    color: #adb5bd;
                }

                .smart-search-no-results {
                    color: #adb5bd;
                }

                .smart-search-pagination {
                    background-color: #1a1d20;
                    border-top-color: #495057;
                }

                .pagination-info {
                    color: #a8b4ff;
                }
            }

            /* Accessibility */
            .smart-search-input:focus-visible,
            .search-result-item:focus-visible,
            .selected-tag-remove:focus-visible,
            .clear-all-btn:focus-visible {
                outline: 2px solid #667eea;
                outline-offset: 2px;
            }
        `;
        this.appendChild(style);
    }
}

customElements.define('smart-search-input', SmartSearchInput);