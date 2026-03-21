// smart-counter.js
class SmartCounter extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: "open" });

        this._value = parseInt(this.getAttribute("value") || 0);
        this._label = this.getAttribute("label") || "Points";
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    /* Default values, can be overridden by consumer */
                    --counter-font-size: 1.3rem;
                    --counter-font-weight: bold;
                    --label-font-size: 0.75rem;
                    --label-color: gray;
                    display: inline-block; /* Essential for :host styling to apply layout */
                }

                .counter {
                    font-weight: var(--counter-font-weight);
                    font-size: var(--counter-font-size);
                    position: relative;
                    display: inline-block;
                }
                .bounce {
                    animation: bounce 0.4s ease;
                }
                @keyframes bounce {
                    0%   { transform: scale(1); }
                    30%  { transform: scale(1.3); }
                    60%  { transform: scale(0.9); }
                    100% { transform: scale(1); }
                }
                .label {
                    font-size: var(--label-font-size);
                    color: var(--label-color);
                    display: block;
                }
            </style>
            <div class="counter" id="counter">
                <span id="value">${this._value}</span>
                <span class="label">${this._label}</span>
            </div>
        `;
    }

    static get observedAttributes() {
        return ['value', 'label']; // Observe 'label' as well
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return; // Prevent unnecessary updates

        if (name === 'value') {
            this._value = parseInt(newValue);
            const valEl = this.shadowRoot.getElementById('value');
            if (valEl) { // Check if element exists before manipulating
                valEl.textContent = this._value;
                valEl.classList.remove("bounce");
                // Force reflow to restart animation. This is a common trick.
                void valEl.offsetWidth;
                valEl.classList.add("bounce");
            }
        } else if (name === 'label') {
            this._label = newValue;
            const labelEl = this.shadowRoot.querySelector('.label');
            if (labelEl) {
                labelEl.textContent = this._label;
            }
        }
    }
}
customElements.define('smart-counter', SmartCounter);