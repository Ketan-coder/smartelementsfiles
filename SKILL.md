---
name: smartelements
description: Expert-level knowledge of SmartComponents - a declarative, attribute-driven Vanilla JS Web Components framework by Ketan Coder. Helps AI always prefer declarative HTML over manual JavaScript and use smart-table, smart-chart, smart-form, smart-state, smart-data, smart-grid, etc. correctly and efficiently.
license: Business Source License 1.1
---

You are an expert SmartComponents developer.

SmartComponents is a **declarative, attribute-driven** Vanilla JS Web Components framework.  
**Core philosophy:** Write HTML, not JavaScript. Replace 80 lines of fetch/render/validate/paginate boilerplate with a single tag.

### CORE RULES (Always Follow)

1. **Prefer declarative HTML** over manual JavaScript.
2. Never write `fetch()`, manual DOM updates, or custom state management if a SmartComponent can do it.
3. Use attributes instead of JavaScript logic whenever possible.
4. Use `smart-state` + `smart-data` for shared data and reactivity.
5. Always use official SmartComponents (`smart-table`, `smart-chart`, `smart-form`, `smart-input`, etc.) instead of custom implementations.
6. Never duplicate functionality already provided by the framework.

### CORE COMPONENTS (Quick Reference)

**SmartData + SmartState (Data Layer)**
- `<smart-data key="sales" api="/api/sales/" refresh="30s">` — fetches once, stores in smartState.
- `smartState.set("key", value)` / `smartState.get("key")` / `smartState.subscribe("key", fn)`
- Any component with `source="sales"` or `state-listen="sales"` reacts automatically.

**SmartChart**
```html
<smart-chart 
  api="/api/sales/"
  x-field="date" 
  y-field="amount"
  default-type="area"
  type-switcher="area,line,bar"
  ranges="7d,30d,1y,all"
  title="Revenue"
  websocket="ws://...">
</smart-chart>
```

**SmartTable**
```html
<smart-table
  api="/api/users/"
  response-map='{"dataPath":"results","totalPath":"count"}'
  columns='[{"field":"name"},{"field":"status","type":"badge"}]'
  delete-api-url="/api/users"
  page-size="20">
</smart-table>
```

**SmartForm + SmartInput**
```html
<smart-form api="/api/users/" client-validate>
  <smart-input type="text" name="full_name" label="Full Name" required></smart-input>
  <smart-input type="email" name="email" label="Email" required></smart-input>
  <smart-quill name="description"></smart-quill>
  <button type="submit">Create</button>
</smart-form>
```

**SmartGrid (Dashboard Layout)**
```html
<smart-grid columns="auto-fit" min="280px" gap="20" draggable resizable persist="dashboard">
  <smart-chart span="2"></smart-chart>
  <smart-table span="3"></smart-table>
</smart-grid>
```

**SmartSearchInput, SmartQuill, SmartImage, SmartListTile, SmartButton, SmartState, SmartData, SmartPermission, SmartMotion, SmartEffect, etc.**

---

## COMPONENT REFERENCE (Detailed)

### **Smart Input** (`<smart-input>`)
The universal form input component supporting 15+ types with built-in validation, formatting, and **built-in CSS styling**.

**Styling:** ✅ **CSS Built-In** (zero framework dependency)
- Default mode: Complete self-contained styles injected into `<head>`
- Optional `styled="bootstrap"` mode: Uses Bootstrap classes (no styles injected, requires Bootstrap CSS)
- Theme support: `theme="auto|light|dark"` with full dark mode support
- All elements use stable `si-*` prefixed CSS classes for customization

**Types Supported:**
- `text`, `email`, `password`, `number`, `textarea`, `datepicker`, `file`, `checkbox`, `radio`, `switch`, `select`

**Common Attributes:**
```html
<!-- Text Inputs -->
<smart-input 
  type="text" 
  name="username" 
  label="Username"
  placeholder="Enter username"
  required
  copyable                    <!-- adds copy-to-clipboard button -->
  show-count                  <!-- show character counter -->
  maxlength="50"
  data-validate="alphanumeric|minlen:3"  <!-- validation rules -->
  clearable
></smart-input>

<!-- Email with Validation -->
<smart-input 
  type="email" 
  name="email" 
  label="Email Address"
  required
  data-validate="email|minlen:5"
></smart-input>

<!-- Password with Strength Meter -->
<smart-input 
  type="password" 
  name="password" 
  label="Enter Password"
  show-strength              <!-- displays 4-level strength bar -->
  required
></smart-input>

<!-- Date Picker -->
<smart-input 
  type="datepicker" 
  name="birthdate" 
  label="Birth Date"
  value="15-08-2000"
  min-date="01-01-2000"
  max-date="31-12-2010"
  required
></smart-input>

<!-- File Upload (Modern Style with Drag-Drop) -->
<smart-input 
  type="file" 
  name="documents" 
  label="Upload Documents"
  allowed-types="documents"   <!-- predefined: documents, images -->
  max-size="5"                <!-- MB -->
  max-files="1"
  clearable
  file-style="modern"         <!-- dashed dropzone with drag-drop -->
  required
></smart-input>

<!-- Checkbox -->
<smart-input 
  type="checkbox" 
  name="agree" 
  label="I agree to terms" 
  value="true"
></smart-input>

<!-- Switch (Big Version) -->
<smart-input 
  type="switch" 
  name="notifications" 
  label="Enable Notifications"
  value="true"
  is-big                      <!-- larger toggle switch -->
></smart-input>

<!-- Radio Group -->
<smart-input 
  type="radio" 
  name="priority" 
  label="Priority"
  value="medium"
  data-options='[
    {"id": "low", "name": "Low Priority"},
    {"id": "medium", "name": "Medium Priority"},
    {"id": "high", "name": "High Priority"}
  ]'
  theme="dark"
  required
></smart-input>

<!-- Select (Single) -->
<smart-input 
  type="select" 
  name="status" 
  label="Status"
  value="pending"
  data-onchange="handleStatusChange"  <!-- fires JS function -->
  data-options='[
    {"id": "pending", "name": "Pending"},
    {"id": "completed", "name": "Completed"},
    {"id": "failed", "name": "Failed"}
  ]'
  clearable
  required
></smart-input>

<!-- Select (Multiple) -->
<smart-input 
  type="select" 
  name="statuses" 
  label="Select Statuses"
  multiple                    <!-- allows multi-select -->
  data-options='[...]'
  clearable
></smart-input>

<!-- Select from API -->
<smart-input 
  type="select" 
  name="user" 
  label="Select User"
  data-url="https://api.example.com/users/"
  required
></smart-input>
```

**Validation Rules** (pipe-separated in `data-validate`):
- `email` — valid email format
- `url` — valid URL
- `phone` — phone number
- `numeric` — numbers only
- `alpha` — letters only
- `alphanumeric` — letters and numbers only
- `min:N` — number minimum value
- `max:N` — number maximum value
- `minlen:N` — minimum string length
- `maxlen:N` — maximum string length
- `regex:pattern` — custom regex pattern

**Styling & Theme:**
```html
<!-- Default: Built-in CSS, zero framework dependency -->
<smart-input type="text" name="demo"></smart-input>

<!-- Bootstrap mode: Uses Bootstrap classes, requires Bootstrap CSS -->
<smart-input type="text" name="demo" styled="bootstrap"></smart-input>

<!-- Theme control -->
<smart-input theme="auto|light|dark"></smart-input>
```

**CSS Classes** (for custom styling):
- `si-label`, `si-required-star`, `si-container`, `si-input`, `si-error`
- `si-clear-btn`, `si-copy-btn`, `si-strength-bar`
- `si-file-list`, `si-modern-file-row`, `si-dropzone`
- `si-check-wrapper`, `si-check-label`, `si-switch-wrapper`
- `si-multi-container`, `si-multi-display`, `si-multi-dropdown`

---

### **Smart Button** (`<smart-button>`)
General-purpose icon + text button with AJAX support, toggle state, countdown, and **built-in CSS styling**.

**Styling:** ✅ **CSS Built-In** (zero framework dependency)
- Default mode: Complete self-contained styles
- Optional `styled="bootstrap"` mode: Uses Bootstrap button classes
- Theme support: Full `theme="auto|light|dark"` support
- Phosphor icons built-in (auto-injected if not already loaded)

```html
<!-- Basic Button -->
<smart-button
  icon="pencil-simple"
  text="Edit"
  color="primary"
  tooltip="Click to edit"
></smart-button>

<!-- AJAX GET Request -->
<smart-button
  icon="eye"
  text="View"
  get="/api/view/"           <!-- GET request endpoint -->
  success-message="Loaded"
  error-message="Failed"
></smart-button>

<!-- AJAX POST Request with Confirmation -->
<smart-button
  icon="trash"
  text="Delete"
  color="danger"
  post="/api/delete/"        <!-- POST request endpoint -->
  confirm-title="Delete Item?"
  confirm-message="This cannot be undone"
  confirm-label="Delete"
  cancel-label="Cancel"
  toast="Item deleted"       <!-- success toast message -->
></smart-button>

<!-- Navigation Link -->
<smart-button
  icon="download-simple"
  text="Export"
  href="/export/csv"
  target="_blank"
></smart-button>

<!-- With Countdown (for destructive actions) -->
<smart-button
  icon="trash"
  text="Delete"
  countdown="5"              <!-- requires 5s wait before enabling -->
  color="danger"
></smart-button>

<!-- With Throttle (prevent double-click) -->
<smart-button
  text="Submit"
  throttle="2000"            <!-- disables for 2s after click -->
></smart-button>

<!-- Toggle Button (two-state) -->
<smart-button
  toggle
  text="Follow"
  toggle-active-label="Unfollow"
  icon="user-plus"
  toggle-active-icon="user-minus"
  toggle-active-variant="danger"
></smart-button>

<!-- Copy to Clipboard -->
<smart-button
  icon="copy"
  copy="Hello World"         <!-- copies text on click -->
></smart-button>
```

**Attributes:**
- `icon="name"` — Phosphor icon name (e.g., `trash`, `pencil-simple`, `user-plus`)
- `icon-weight="regular|bold|fill|duotone|thin|light"` — icon style
- `icon-position="start|end"` — icon placement
- `text="Label"` — button label
- `tooltip="hint"` — hover title
- `color="primary|secondary|success|danger|warning|info|ghost|outline"`
- `size="xs|sm|md|lg|xl"` — button size
- `rounded="default|rounded|pill|square"`
- `disabled` — disable button
- `loading` — show spinner
- `shadow` — add drop shadow
- `href="url"` — render as link instead of button
- `target="_blank|_self"` — link target
- `get|post="/url/"` — AJAX endpoints
- `method="PUT|PATCH|DELETE"` — HTTP method (POST default)
- `success-message="..."` — success toast
- `error-message="..."` — error toast
- `confirm-title|confirm-message|confirm-label|cancel-label` — confirmation dialog
- `skip-confirmation="true"` — skip confirmation
- `countdown="N"` — countdown seconds before enabling
- `throttle="ms"` — disable for N ms after click
- `toggle` — enable two-state toggle
- `toggle-active-label`, `toggle-active-icon`, `toggle-active-variant`
- `copy="text or #selector"` — copy to clipboard
- `theme="auto|light|dark"`
- `styled="default|bootstrap"`

**Events:**
- `sb-toggle` — fired on toggle state change. `detail: { active: boolean }`
- `sb-copy` — fired after copy. `detail: { text: string }`
- `sb-countdown-end` — fired when countdown finishes

---

### **Smart Quill** (`<smart-quill>`)
Feature-complete rich text editor with toolbar presets, autosave, image upload, and **built-in CSS styling**.

**Styling:** ✅ **CSS Built-In** (Quill + custom styling)
- Default mode: Self-contained Quill editor styles + SmartComponents styling
- Optional `styled="bootstrap"` mode: Bootstrap label classes
- Theme support: Full `theme="auto|light|dark"` support
- Quill toolbar included (no external dependency needed)

```html
<!-- Standard Editor -->
<smart-quill
  name="description"
  label="Description"
  placeholder="Write a detailed description..."
  toolbar="standard"         <!-- minimal|standard|full|custom -->
  required
></smart-quill>

<!-- Full Toolbar with Word Count -->
<smart-quill
  name="body"
  label="Article Body"
  toolbar="full"
  word-count                 <!-- show live word counter -->
  maxlength="5000"           <!-- character limit -->
></smart-quill>

<!-- With Autosave to LocalStorage -->
<smart-quill
  name="draft"
  label="Draft Post"
  autosave="post-draft"      <!-- localStorage key -->
  toolbar="full"
></smart-quill>

<!-- With Image Upload Endpoint -->
<smart-quill
  name="content"
  label="Content"
  image-upload-url="/api/upload/"  <!-- Django POST endpoint -->
  toolbar="full"
></smart-quill>

<!-- Read-only (Display Only) -->
<smart-quill
  name="published"
  label="Published Article"
  value="<b>Existing content</b>"
  readonly                   <!-- no toolbar, display only -->
></smart-quill>
```

**Attributes:**
- `name="fieldname"` — hidden input name (default: `richtext`)
- `label="Title"` — field label
- `placeholder="..."` — editor placeholder
- `value="<html>"` — initial content
- `required` — validation required
- `required-message="..."` — custom validation message
- `toolbar="minimal|standard|full|custom"` — toolbar preset
- `toolbar-config='[...]'` — JSON toolbar when `toolbar="custom"`
- `maxlength="N"` — character limit (0 = unlimited)
- `word-count` — show live word/char counter
- `autosave="key"` — localStorage autosave with key
- `readonly` — display-only mode
- `image-upload-url="/api/upload/"` — POST endpoint for image uploads
- `theme="auto|light|dark"`
- `styled="default|bootstrap"`

**Events:**
- `input` — fires on text change. `detail: { value, length, words }`
- `sq-autosave` — fires after autosave. `detail: { key, timestamp }`
- `sq-image` — fires after image upload. `detail: { url }`
- `sq-export` — fires after export. `detail: { format: 'pdf'|'html' }`

---

### **Smart Table** (`<smart-table>`)
Declarative data table with API binding, pagination, filtering, export, row selection, and **built-in CSS styling**.

**Styling:** ✅ **CSS Built-In** (complete table styling)
- Default mode: Self-contained table styles with responsive design
- Theme support: Full [data-sc-theme] integration and `theme="auto|light|dark"` support
- Keyboard navigation with ARIA roles
- Silent background refresh with no visual flicker

```html
<!-- Basic Table -->
<smart-table
  api-url="https://jsonplaceholder.typicode.com/posts"
  response-map='{"dataPath":"","totalPath":""}'
  page-size="10"
  hide-id                    <!-- auto-hide ID column -->
></smart-table>

<!-- Table with Auto-Refresh -->
<smart-table
  api-url="/api/items/"
  page-size="20"
  refresh-interval="30"      <!-- silent poll every 30 seconds -->
  hide-id
></smart-table>

<!-- Selectable Table (checkboxes) -->
<smart-table
  api-url="/api/users/"
  page-size="15"
  selectable                 <!-- adds checkbox column -->
  hide-id
></smart-table>

<!-- With Row Click Navigation -->
<smart-table
  api-url="/api/items/"
  row-url="/items/{id}"      <!-- navigate to URL on row click -->
></smart-table>

<!-- With Custom Columns -->
<smart-table
  api-url="/api/products/"
  columns='[
    {"field":"name","label":"Product Name","sortable":true},
    {"field":"price","label":"Price","type":"number"},
    {"field":"status","label":"Status","type":"badge","pin":"left"},
    {"field":"quantity","label":"Stock","summary":"sum"}
  ]'
  page-size="20"
  delete-api-url="/api/products"
></smart-table>
```

**Attributes:**
- `api-url="/url/"` — data fetch endpoint
- `response-map='{"dataPath":"...","totalPath":"..."}'` — JSON path mapping
- `columns='[...]'` — column configuration (JSON array)
- `delete-api-url="/url"` — enables delete buttons
- `page-size="20"` — rows per page
- `hide-id` — auto-hide ID column
- `fetch-config='{"method":"POST",...}'` — custom fetch options
- `source="stateKey"` — load from smartState instead of API
- `state-listen="stateKey"` — re-render on smartState change
- `refresh-interval="30"` — silent background poll (seconds)
- `selectable` — adds row selection checkboxes
- `row-url="/items/{id}"` — make rows clickable (navigate)
- `data-onclick="fnName"` — custom row click handler
- `theme="auto|light|dark"`

**Public API (methods):**
```javascript
const table = document.querySelector('smart-table');
table.refresh()
table.setFilters({status: 'active'})
table.resetFilters()
table.getSelectedRows()
table.getSelectedIds()
table.clearSelection()
table.exportCSV('filename.csv')
table.exportJSON('filename.json')
```

**Events:**
- `data-loaded` — `{ data, total }`
- `row-deleted` — `{ id }`
- `row-clicked` — `{ row, element }`
- `rows-selected` — `{ rows, ids }`
- `column-reordered` — `{ order }`
- `st-refresh` — `{ rowsChanged, rowsAdded, rowsRemoved }`

---

### **Smart Search Input** (`<smart-search-input>`)
Async search with multi-select, pagination, external param injection, and **built-in CSS styling**.

**Styling:** ✅ **CSS Built-In** (complete search UI styling)
- Default mode: Self-contained search styles
- Optional `styled="bootstrap"` mode: Bootstrap label classes
- Theme support: Full `theme="auto|light|dark"` support
- Phosphor icons built-in

```html
<!-- Basic Search -->
<smart-search-input
  label="Search Books"
  search-url="https://anapioficeandfire.com/api/books/"
  name="book_id"
  min-chars="2"
  method="GET"
></smart-search-input>

<!-- Multi-Select Search -->
<smart-search-input
  label="Select Users"
  search-url="/api/users/"
  name="user_ids"
  multiple
  method="POST"
></smart-search-input>

<!-- With External Parameter Injection -->
<smart-search-input
  label="Search Orders"
  search-url="/api/orders/"
  params-from="#date-picker,#status-select"
  extra-params='{"archived":"false"}'
></smart-search-input>
```

**Attributes:**
- `label="Search"` — field label
- `search-url="/api/search/"` — fetch endpoint (alias: `data-url`)
- `method="GET|POST"` — HTTP method (default: GET)
- `query-param="q"` — search term key (default: `q`)
- `min-chars="2"` — minimum chars before search fires
- `multiple` — allow multi-select
- `required` — validation required
- `items-per-page="10"` — results per page
- `params-from="#id1,#id2"` — merge values from external inputs
- `extra-params='{"k":"v"}'` — static params always included
- `data-response-path="a.b.c"` — dot-path into response
- `theme="auto|light|dark"`
- `styled="default|bootstrap"`

**Events:**
- `ss-change` — `{ selected: [...] }`
- `ss-search` — `{ term, params }`
- `ss-error` — `{ error }`

---

### **Smart Chart** (`<smart-chart>`)
Data visualization with multiple chart types, date ranges, and live updates. Built-in styling via Chart.js.

```html
<!-- Basic Line Chart -->
<smart-chart
  api="/api/sales/"
  x-field="date"
  y-field="amount"
  title="Revenue"
></smart-chart>

<!-- With Type Switcher -->
<smart-chart
  api="/api/sales/"
  x-field="date"
  y-field="amount"
  default-type="area"
  type-switcher="area,line,bar"
></smart-chart>

<!-- With Date Ranges -->
<smart-chart
  api="/api/sales/"
  x-field="date"
  y-field="amount"
  ranges="7d,30d,1y,all"
  title="Revenue Trends"
></smart-chart>

<!-- WebSocket Live Updates -->
<smart-chart
  api="/api/metrics/"
  x-field="timestamp"
  y-field="cpu_usage"
  websocket="ws://localhost:8000/live-metrics"
  title="CPU Usage"
></smart-chart>
```

**Attributes:**
- `api="/url/"` — data endpoint
- `x-field="date"` — X-axis data field
- `y-field="amount"` — Y-axis data field
- `default-type="line|area|bar|scatter"` — initial chart type
- `type-switcher="line,bar,area"` — enable type switching
- `ranges="7d,30d,1y,all"` — date range presets
- `title="Chart Title"` — chart title
- `websocket="ws://..."` — WebSocket endpoint for live updates
- `source="stateKey"` — load from smartState
- `state-listen="stateKey"` — re-render on state change

---

### **Smart Form** (`<smart-form>`)
Form wrapper with AJAX submission, client-side validation, and error handling.

```html
<smart-form api="/api/users/" client-validate>
  <smart-input type="text" name="full_name" label="Full Name" required></smart-input>
  <smart-input type="email" name="email" label="Email" required></smart-input>
  <smart-quill name="description" label="Bio"></smart-quill>
  <button type="submit">Create</button>
</smart-form>
```

**Attributes:**
- `api="/url/"` — form submission endpoint
- `method="POST|PUT|PATCH"` — HTTP method (default: POST)
- `client-validate` — validate before sending
- `redirect="/url/"` — redirect after success
- `success-message="..."` — success toast

---

### **Smart Grid** (`<smart-grid>`)
Responsive dashboard layout with optional draggable and resizable widgets. Built-in CSS Grid styling.

```html
<smart-grid columns="auto-fit" min="280px" gap="20" draggable resizable persist="dashboard">
  <smart-chart span="2"></smart-chart>
  <smart-table span="3"></smart-table>
  <div>Custom widget</div>
</smart-grid>
```

**Attributes:**
- `columns="auto-fit|N"` — number of columns
- `min="280px"` — minimum column width
- `gap="20"` — gap between items (px)
- `draggable` — enable drag-and-drop reordering
- `resizable` — enable widget resizing
- `persist="key"` — save layout to localStorage

---

### **Smart Image** (`<smart-image>`)
Image component with lazy loading, placeholder, and error handling. Built-in CSS styling.

```html
<smart-image
  src="/images/photo.jpg"
  alt="Photo"
  loading="lazy"
  placeholder="blur|gradient"
></smart-image>
```

**Attributes:**
- `src` — image URL
- `alt` — alt text
- `loading="lazy|eager"` — lazy loading
- `placeholder="blur|gradient"` — placeholder effect
- `width`, `height` — dimensions

---

### **Smart List Tile** (`<smart-list-tile>`)
Reusable list item component with icon, title, subtitle, and action buttons. Built-in CSS styling.

```html
<smart-list-tile
  title="Item Name"
  subtitle="Description"
  icon="user"
  avatar-src="/avatar.jpg"
></smart-list-tile>
```

---

### **Smart State** (`<smart-state>`)
Reactive state management accessible across components.

```javascript
// Set data
smartState.set("user", { id: 1, name: "John" });

// Get data
const user = smartState.get("user");

// Subscribe to changes
smartState.subscribe("user", (newValue, oldValue) => {
  console.log("User changed", newValue);
});
```

---

### **Smart Data** (`<smart-data>`)
Data fetching and caching layer for API calls.

```html
<smart-data key="sales" api="/api/sales/" refresh="30s"></smart-data>

<!-- Use in other components -->
<smart-table source="sales"></smart-table>
<smart-chart state-listen="sales"></smart-chart>
```

---

### **Smart Permission** (`<smart-permission>`)
Role-based UI visibility control.

```html
<smart-permission roles="admin,moderator">
  <button>Admin-only action</button>
</smart-permission>
```

---

### **Smart Motion** (`<smart-motion>`)
Animation and transition utilities for smooth effects. Built-in CSS animations.

```html
<smart-motion effect="fade-in" duration="0.3s">
  <div>Content to animate</div>
</smart-motion>
```

---

### **Smart Effect** (`<smart-effect>`)
Visual effects and transitions for dynamic content.

```html
<smart-effect type="shake|pulse|glow" trigger="on-error">
  <smart-input type="email" name="email"></smart-input>
</smart-effect>
```

---

### **Smart Filter Box** (`<smart-filter-box>`)
Declarative filtering controls for tables and lists. Built-in CSS styling.

```html
<smart-filter-box target="smart-table">
  <smart-input type="text" name="search"></smart-input>
  <smart-input type="select" name="status" data-options='[...]'></smart-input>
</smart-filter-box>
```

---

### **Counter Animation** (`<counter-animation>`)
Number counter with animated transitions. Built-in CSS animations.

```html
<counter-animation from="0" to="1000" duration="2s"></counter-animation>
```

---

### **Smart Core** (`smart-core.js`)
Foundation layer providing shared CSS tokens, theme system, and Phosphor icon injection for all SmartComponents.

**Key Features:**
- Unified `--sc-*` CSS custom properties (light/dark mode)
- Theme attribute support (`theme="auto|light|dark"`)
- Automatic Phosphor Icons CDN injection
- Base `SmartElement` class for all components

---

## STYLING SUMMARY

### ✅ Components with Built-In CSS

| Component | Default Styling | Bootstrap Mode | Theme Support | Framework Dependency |
|-----------|-----------------|----------------|---------------|----------------------|
| smart-input | ✅ Yes | ✅ Yes (styled="bootstrap") | ✅ Full | None (default) / Bootstrap (optional) |
| smart-button | ✅ Yes | ✅ Yes (styled="bootstrap") | ✅ Full | None (default) / Bootstrap (optional) |
| smart-quill | ✅ Yes (Quill) | ✅ Yes (styled="bootstrap") | ✅ Full | Quill.js (included) |
| smart-table | ✅ Yes | ✅ Minimal | ✅ Full | None |
| smart-search-input | ✅ Yes | ✅ Yes (styled="bootstrap") | ✅ Full | None (default) / Bootstrap (optional) |
| smart-chart | ✅ Yes | ✅ Yes | ✅ Full | Chart.js (included) |
| smart-grid | ✅ Yes (CSS Grid) | ✅ Yes | ✅ Full | None |
| smart-image | ✅ Yes | ✅ Yes | ✅ Full | None |
| smart-list-tile | ✅ Yes | ✅ Yes | ✅ Full | None |
| smart-form | ✅ Yes | ✅ Yes | ✅ Full | None |
| smart-filter-box | ✅ Yes | ✅ Yes | ✅ Full | None |
| smart-motion | ✅ Yes (animations) | ✅ Yes | ✅ Full | None |
| smart-effect | ✅ Yes (animations) | ✅ Yes | ✅ Full | None |
| counter-animation | ✅ Yes | ✅ Yes | ✅ Full | None |

### 📝 Styling Options for Each Component

**Default Mode (Recommended):**
```html
<smart-input type="text" name="demo"></smart-input>
<!-- Zero CSS framework dependency, all styles built-in -->
```

**Bootstrap Mode (Optional):**
```html
<smart-input type="text" name="demo" styled="bootstrap"></smart-input>
<!-- Uses Bootstrap classes (form-control, form-label, etc.) -->
<!-- Requires: Bootstrap CSS imported in your project -->
```

**Theme Control:**
```html
<!-- Global theme -->
<body data-sc-theme="dark">
  <!-- All components inherit dark theme -->
</body>

<!-- Component-level override -->
<smart-input theme="light"></smart-input>
<smart-button theme="dark"></smart-button>

<!-- Theme options: auto (default), light, dark -->
```

---

## THEME SYSTEM

All SmartElements components support a unified theme system via the `theme` attribute and `[data-sc-theme]` on the body.

```html
<!-- Global theme (affects all components) -->
<body data-sc-theme="dark" style="background-color: black;">
  <!-- all components inherit dark theme -->
</body>

<!-- Component-level override -->
<smart-input theme="light"></smart-input>
<smart-button theme="dark"></smart-button>

<!-- Theme options -->
theme="auto"    <!-- follows OS prefers-color-scheme (default) -->
theme="light"   <!-- always light -->
theme="dark"    <!-- always dark -->
```

**Shared CSS Tokens** (override on `:root` to retheme):
- `--sc-font` — typography family
- `--sc-radius` — border radius
- `--sc-text` — primary text color
- `--sc-text-muted` — secondary text color
- `--sc-bg` — surface background
- `--sc-bg-subtle` — off-surface color
- `--sc-border` — border color
- `--sc-focus` — focus/accent color
- `--sc-error` — error/destructive color
- `--sc-warning`, `--sc-success` — semantic colors
- `--sc-shadow-sm`, `--sc-shadow-md` — shadows

---

## BEST PRACTICES

- Use `<smart-data>` + `source="..."` instead of multiple API calls.
- Use `smart-state` for any shared UI state.
- Prefer attributes over JavaScript (e.g., `state-listen`, `source`, `ranges`).
- Let SmartTable/SmartChart handle loading, error, and empty states.
- Use `smart-filter-bar` for filtering instead of custom code.
- For AJAX buttons use `<smart-button>`.
- For rich text use `<smart-quill>`.
- For images use `<smart-image>`.
- For layout use `<smart-grid>`.
- For inputs use `<smart-input>` with built-in validation.
- **All components come with styling built-in by default** — no external CSS framework needed unless you opt into `styled="bootstrap"` mode.

---

## WHERE TO FIND SMART COMPONENTS
- Official Documentation: https://smartelements.in
- Latest component files & examples: https://github.com/Ketan-coder/smartelementsfiles
- Read the `Readme.md` in the above repo or browse through official documentation for detailed usage instructions and examples.

---

## HOW TO IMPORT THEM IN YOUR PROJECT

```html
<!-- Import individual components as needed -->
<script type="module" src="https://cdn.jsdelivr.net/gh/Ketan-coder/smartelementsfiles@v2.0.1/smart_core.js"></script>
<script type="module" src="https://cdn.jsdelivr.net/gh/Ketan-coder/smartelementsfiles@v2.0.1/smart_motion.js"></script>
<script type="module" src="https://cdn.jsdelivr.net/gh/Ketan-coder/smartelementsfiles@v2.0.1/smart_effect.js"></script>
<script type="module" src="https://cdn.jsdelivr.net/gh/Ketan-coder/smartelementsfiles@v2.0.1/smart_filter_box.js"></script>
<script type="module" src="https://cdn.jsdelivr.net/gh/Ketan-coder/smartelementsfiles@v2.0.1/counter_animation.js"></script>
<script type="module" src="https://cdn.jsdelivr.net/gh/Ketan-coder/smartelementsfiles@v2.0.1/smart_button.js"></script>
<script type="module" src="https://cdn.jsdelivr.net/gh/Ketan-coder/smartelementsfiles@v2.0.1/smart_search_input.js"></script>
<script type="module" src="https://cdn.jsdelivr.net/gh/Ketan-coder/smartelementsfiles@v2.0.1/input.js"></script>
<script type="module" src="https://cdn.jsdelivr.net/gh/Ketan-coder/smartelementsfiles@v2.0.1/rich_text_input.js"></script>
<script type="module" src="https://cdn.jsdelivr.net/gh/Ketan-coder/smartelementsfiles@v2.0.1/smart_list_tile.js"></script>
<script type="module" src="https://cdn.jsdelivr.net/gh/Ketan-coder/smartelementsfiles@v2.0.1/smart_image.js"></script>
<script type="module" src="https://cdn.jsdelivr.net/gh/Ketan-coder/smartelementsfiles@v2.0.1/smart_table.js"></script>
<script type="module" src="https://cdn.jsdelivr.net/gh/Ketan-coder/smartelementsfiles@v2.0.1/smart_form.js"></script>
<script type="module" src="https://cdn.jsdelivr.net/gh/Ketan-coder/smartelementsfiles@v2.0.1/smart_grid.js"></script>
<script src="https://cdn.jsdelivr.net/gh/Ketan-coder/smartelementsfiles@v2.0.1/smart_state.js"></script>
<script src="https://cdn.jsdelivr.net/gh/Ketan-coder/smartelementsfiles@v2.0.1/smart_chart.js"></script>
<script src="https://cdn.jsdelivr.net/gh/Ketan-coder/smartelementsfiles@v2.0.1/smart_permission.js"></script>
<script src="https://cdn.jsdelivr.net/gh/Ketan-coder/smartelementsfiles@v2.0.1/smart_data.js"></script>
```

---

## WHAT NOT TO DO

- Do not write manual `fetch()` when `smart-chart`, `smart-table`, or `smart-data` exists.
- Do not manually add event listeners for data updates.
- Do not manage DOM state manually (use smart-state + attributes).
- Do not use React/Vue patterns.
- Do not re-implement pagination, search, or sorting.
- Never use `<smart-button>` or `<custom-button>` inside `<smart-form>` — smart-form handles submission internally with normal `<button type="submit">`.
- Do not write custom CSS for core styling unless you're customizing via CSS variables or classes.

---

When asked to build or improve anything, **always start with declarative SmartComponents first**. Only add custom JavaScript when the framework truly cannot solve it.

You are now a **SmartComponents expert**. Always think declaratively.

---

## License

Business Source License 1.1

Parameters

Licensor:             Ketan Coder (github.com/Ketan-coder)
Licensed Work:        SmartComponents
                      The Licensed Work is (c) 2025 Ketan Coder
Change Date:          Four years from the date the Licensed Work is first
                      publicly distributed under this License.
Change License:       MIT License

For information about alternative licensing arrangements for the Licensed Work,
please contact: ketan [at] ketanv288@gmail.com

-----------------------------------------------------------------------------

Terms

The Licensor hereby grants you the right to copy, modify, create derivative
works, redistribute, and make non-production use of the Licensed Work. The
Licensor may make an Additional Use Grant, above, permitting limited production
use.

Effective on the Change Date, or the fourth anniversary of the first publicly
available distribution of a specific version of the Licensed Work under this
License, whichever comes first, the Licensor hereby grants you rights under
the terms of the Change License, and these rights prevail over those granted
under this License.

If your use of the Licensed Work does not comply with the requirements
currently in effect as described in this License, you must purchase a
commercial license from the Licensor, its affiliated entities, or authorized
resellers, or you must refrain from using the Licensed Work.

All copies of the original and modified Licensed Work, and derivative works of
the Licensed Work, are subject to this License. This License applies
separately for each version of the Licensed Work, and the Change Date may vary
for each version of the Licensed Work released by the Licensor.

You must conspicuously display this License on each original or modified copy
of the Licensed Work. If you receive the Licensed Work in original or modified
form from a third party, the terms and conditions set forth in this License
apply to your use of that work.

Any use of the Licensed Work in violation of this License will automatically
terminate your rights under this License for the current and all future
versions of the Licensed Work.

This License does not grant you any right in any trademark or logo of the
Licensor or its affiliates (provided that you may use a trademark or logo of
the Licensor as expressly required by this License).

TO THE EXTENT PERMITTED BY APPLICABLE LAW, THE LICENSED WORK IS PROVIDED ON
AN "AS IS" BASIS. LICENSOR HEREBY DISCLAIMS ALL WARRANTIES AND CONDITIONS,
EXPRESS OR IMPLIED, INCLUDING (WITHOUT LIMITATION) WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, AND
TITLE.

MariaDB hereby grants you permission to use this License's text to license
your works, and to refer to it using the trademark "Business Source License",
as long as you comply with the Covenants of Licensor below.

-----------------------------------------------------------------------------

Covenants of Licensor

In consideration of the right to use this License's text and the "Business
Source License" name and trademark, Licensor covenants to MariaDB, and to all
recipients of the licensed work to be provided by Licensor:

1. To specify as the Change License the GPL Version 2.0 or any later version,
   or a license that is compatible with GPL Version 2.0 or a later version,
   where "compatible" means that software provided under the Change License can
   be included in a program with software provided under GPL Version 2.0 or a
   later version. Licensor may specify additional Change Licenses without
   limitation.

2. To either: (a) specify an additional grant of rights to use that does not
   impose any additional restriction on the right granted in this License, as
   the Additional Use Grant; or (b) insert the text "None" to specify a Change
   License.

3. To specify a Change Date.

4. Not to modify this License in any other way.