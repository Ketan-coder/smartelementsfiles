################################################################################
##  SMARTCOMPONENTS — AI CONTEXT FILE
##  Version: 1.0.0
##  Docs:    https://smartelements.in
##  GitHub:  https://github.com/Ketan-coder/
################################################################################
##
##  HOW TO USE THIS FILE
##  Paste the entire contents into any AI chat (ChatGPT, Claude, Gemini, etc.)
##  before asking questions about SmartComponents. The AI will then:
##    * Use components correctly with real attributes
##    * Prefer declarative HTML over writing JavaScript
##    * Avoid re-implementing what the framework already handles
##    * Know every public API, event, and data shape
##
################################################################################


================================================================================
SECTION 0 -- FRAMEWORK PHILOSOPHY
================================================================================

SmartComponents is a Vanilla JS Web Components library. Every component is a
custom HTML element driven entirely by attributes. The developer writes HTML.
The framework handles fetching, rendering, state, validation, and DOM updates.

CORE PRINCIPLE: If SmartComponents can do it declaratively, never write JS to
do it manually. Do not write fetch(). Do not write addEventListener for data
loading. Do not manually update the DOM. Use attributes and smartState instead.

STACK: Vanilla JS  Web Components  Bootstrap 5 / Halfmoon  Django-ready
       No npm  No build step  No framework opinion  Drop a script tag


================================================================================
SECTION 1 -- SCRIPT LOAD ORDER (CRITICAL)
================================================================================

Load in this exact order. All are type="module" EXCEPT smart-state.js,
smart-data.js, and smart-chart.js which must be plain script tags.

  <!-- 1. CDN dependencies -->
  <script src="https://cdn.jsdelivr.net/npm/@barba/core"></script>
  <script src="https://cdn.jsdelivr.net/npm/animejs@3.2.1/lib/anime.min.js"></script>
  <link  href="https://cdn.quilljs.com/1.3.6/quill.snow.css" rel="stylesheet">
  <script src="https://cdn.quilljs.com/1.3.6/quill.js"></script>

  <!-- 2. State layer -- plain scripts, must load first -->
  <script src="smart-state.js"></script>
  <script src="smart-data.js"></script>

  <!-- 3. Components -- type="module" -->
  <script type="module" src="smart-core.js"></script>
  <script type="module" src="smart-motion.js"></script>
  <script type="module" src="smart-effect.js"></script>
  <script type="module" src="input.js"></script>
  <script type="module" src="smart-search-input.js"></script>
  <script type="module" src="rich-text-input.js"></script>
  <script type="module" src="smart-button.js"></script>
  <script type="module" src="button.js"></script>
  <script type="module" src="smart-list-tile.js"></script>
  <script type="module" src="smart-image.js"></script>
  <script type="module" src="smart-filter-box.js"></script>
  <script type="module" src="smart-table.js"></script>
  <script type="module" src="smart-form.js"></script>
  <script type="module" src="smart-permission.js"></script>
  <script type="module" src="smart-grid.js"></script>

  <!-- 4. smart-chart.js -- plain script, NOT type="module" -->
  <script src="smart-chart.js"></script>

Global singletons go inside data-barba="container". Outside the container:
  <smart-motion type="panel-up" duration="400"></smart-motion>
  <smart-effects auto></smart-effects>

Inside container (one per page):
  <smart-toast position="bottom-right" max="5"></smart-toast>
  <smart-modal></smart-modal>
  <smart-loader type="overlay"></smart-loader>


================================================================================
SECTION 2 -- SMARTSTATE  (window.smartState)
================================================================================

Global reactive key-value store. Loaded via smart-state.js. Exposed on window.
Supports dot-notation for nested keys. MutationObserver auto-applies bindings
to newly added DOM nodes.

-- JS API -----------------------------------------------------------------------

  smartState.set("key", value)           // store + notify all subscribers
  smartState.set("user.role", "admin")   // dot-notation for nested paths
  smartState.get("key")                  // read value
  smartState.get("user.role")            // nested read
  smartState.getAll()                    // snapshot of entire store
  smartState.subscribe("key", fn)        // fn(value, key) called on change
  smartState.watch("key", fn)            // alias for subscribe
  smartState.unsubscribe("key", fn)      // remove listener
  smartState.persist("key")             // sync this key to localStorage
  smartState.urlSync("key")             // sync this key to URL ?params
  smartState.batch(() => { ... })        // batch multiple set()s -> one DOM flush
  smartState.reset("key")               // delete key and notify subscribers

-- DOM BINDING ATTRIBUTES -------------------------------------------------------

Add these attributes to any HTML element. They update automatically when the
referenced state key changes. No JavaScript needed.

  state-text="key"               el.textContent = value
  state-html="key"               el.innerHTML = value
  state-show="key"               display:'' when truthy, display:none when falsy
  state-disabled="key"           el.disabled = !!value
  state-value="key"              el.value = value  (inputs)
  state-class="key:className"    toggles className based on truthiness
  state-style="key:cssProperty"  sets el.style[property] = value
  state-attr="key:attrName"      sets/removes attribute based on value

-- EXAMPLES ---------------------------------------------------------------------

  <!-- Set state from Django context (recommended pattern) -->
  <script>
    smartState.set("user", { role: "{{ request.user.role }}", balance: {{ balance }} });
    smartState.set("isLoggedIn", {{ request.user.is_authenticated|lower }});
    smartState.set("features", { analytics: {{ feature_flag|lower }} });
  </script>

  <!-- DOM binding -- updates automatically -->
  <span state-text="user.role"></span>
  <div state-show="isLoggedIn">Welcome back!</div>
  <input state-value="user.role" />
  <button state-disabled="isSubmitting">Save</button>
  <div state-class="hasError:text-danger">Error message</div>
  <div state-style="primaryColor:color">Colored text</div>


================================================================================
SECTION 3 -- SMART-DATA  <smart-data>
================================================================================

Invisible data-fetching element. Fetches once and stores result in smartState
under the given key. Multiple components (smart-chart, smart-table) read from
the same key -- one fetch serves all consumers. Renders as display:none.

-- ATTRIBUTES -------------------------------------------------------------------

  key           (required)  smartState key to store result under
  api           (required)  URL to fetch (GET by default)
  refresh                   polling interval: "10s" | "1m" | "5m" | "1h"
  cache                     skip re-fetch if data loaded within window: "5s" | "1m"
  response-path             dot-path to unwrap JSON: "results" unwraps DRF pagination
  method                    HTTP method (default: GET)
  headers                   JSON object: '{"Authorization":"Bearer token"}'
  csrftoken                 explicit CSRF token (auto-read from Django cookie if omitted)

-- PUBLIC API -------------------------------------------------------------------

  el.refresh()   force re-fetch immediately (ignores cache)
  el.getData()   returns current value from smartState

-- EVENTS (dispatched on window) ------------------------------------------------

  smart-data-loading   { key }
  smart-data-loaded    { key, data }
  smart-data-error     { key, error }

-- EXAMPLE ----------------------------------------------------------------------

  <!-- One fetch, shared by chart + table + filter -->
  <smart-data
    key="salesData"
    api="/api/sales/"
    response-path="results"
    refresh="30s"
    cache="10s">
  </smart-data>

  <smart-chart source="salesData" x-field="date" y-field="amount"></smart-chart>
  <smart-table source="salesData" id="salesTable"></smart-table>


================================================================================
SECTION 4 -- SMART-TABLE  <smart-table>
================================================================================

Full data table. Sorting, search, pagination, infinite scroll, delete rows,
badge filters, column drag-to-reorder, dark/light mode. Auto-detects scroll
mode from record count. Shimmer skeleton on every load/sort/filter.

-- DATA SOURCE (pick one) -------------------------------------------------------

  api-url="..."          URL to fetch (server-side pagination)
  source="stateKey"      reads from smartState (set by smart-data)

-- REQUIRED WHEN USING api-url --------------------------------------------------

  response-map='{"dataPath":"results","totalPath":"count"}'

  response-map fields:
    dataPath     dot-path to the array in the response ("results", "data.items")
    totalPath    dot-path to total record count ("count", "meta.total")
                 omit totalPath to disable server-side pagination

-- COLUMNS -----------------------------------------------------------------------

  columns='[
    {"field":"name",   "label":"Name",   "sortable":true},
    {"field":"status", "label":"Status", "type":"badge"},
    {"field":"amount", "label":"Amount", "type":"integer"},
    {"field":"date",   "label":"Date",   "type":"date"},
    {"field":"thumb",  "label":"Photo",  "type":"image"},
    {"field":"notes",  "label":"Notes",  "type":"inline"},
    {"field":"id",     "hidden":true}
  ]'

  column.type values:
    badge         auto-coloured pill badge
    date          ISO date -> localized string
    dateFormatted formatted date
    integer       number formatting
    image         renders img tag from URL value
    inline        nested object rendered as key:value pairs
    (omit)        plain text (default)

  column fields:
    field     (required)  key in the data row
    label                 header label (auto-generated from field if omitted)
    type                  cell rendering type (see above)
    sortable              true|false, enables click-to-sort header
    hidden                true|false, hides column from display

-- ALL ATTRIBUTES ----------------------------------------------------------------

  api-url          API endpoint URL
  response-map     JSON: { dataPath, totalPath }
  columns          JSON array of column definitions
  source           smartState key (from smart-data)
  state-listen     re-render table when this smartState key changes
  delete-api-url   enables delete column; sends DELETE to url + "/" + rowId
  page-size        rows per page (default: 20)
  hide-id          hides id column from display (boolean)
  fetch-config     JSON: { headers: {}, method: "GET" }

-- SCROLL MODE AUTO-DETECTION ---------------------------------------------------

  <= page-size rows     client-side rendering (no pagination)
  <= 1000 rows          numbered pagination
  > 1000 rows           infinite scroll with IntersectionObserver

-- PUBLIC API -------------------------------------------------------------------

  el.refresh()                    re-fetch and re-render
  el.setFilters({ field: val })   apply external filters and refresh
  el.resetFilters()               clear all external filters and refresh
  el.clearSearch()                clear search input and refresh
  el.setColumnOrder([...fields])  reorder columns by field name array
  el.getColumnOrder()             returns current field order array
  el.resetColumnOrder()           restore original column order

-- EXAMPLES ---------------------------------------------------------------------

  <!-- Full-featured table -->
  <smart-table
    api-url="/api/users/"
    response-map='{"dataPath":"results","totalPath":"count"}'
    columns='[
      {"field":"name",   "label":"Name",   "sortable":true},
      {"field":"email",  "label":"Email"},
      {"field":"status", "label":"Status", "type":"badge"},
      {"field":"joined", "label":"Joined", "type":"date"}
    ]'
    delete-api-url="/api/users"
    page-size="20">
  </smart-table>

  <!-- Table from shared smart-data, re-renders when "status" filter changes -->
  <smart-data key="orders" api="/api/orders/" refresh="30s"></smart-data>
  <smart-table source="orders" state-listen="status" id="ordersTable"></smart-table>

  <!-- Programmatic filter -->
  <script>
    document.getElementById('ordersTable').setFilters({ status: 'active' });
  </script>


================================================================================
SECTION 5 -- SMART-FILTER-BAR  <smart-filter-bar>
================================================================================

Standalone filter bar. Dispatches CustomEvents to drive smart-table.
No direct DOM coupling -- works via window events. Never fetches data itself.

-- ATTRIBUTES (smart-filter-bar) ------------------------------------------------

  target        id of the smart-table to filter (required)
  auto-apply    dispatches filter on every input change (debounced 300ms)
  state-key     writes filter values to this smartState key on apply

-- CHILDREN (smart-input inside filter-bar) -------------------------------------

  <smart-input name="field" label="Label" type="text|select|date|number">

  For select type use data-options:
  <smart-input name="status" type="select"
    data-options='[{"id":"","name":"All"},{"id":"active","name":"Active"}]'>

  For action buttons inside filter-bar:
  <smart-button action="apply">Apply</smart-button>
  <smart-button action="reset">Reset</smart-button>

-- EXAMPLE ----------------------------------------------------------------------

  <smart-filter-bar target="usersTable" auto-apply state-key="userFilters">
    <smart-input name="status" label="Status" type="select"
      data-options='[{"id":"","name":"All"},{"id":"active","name":"Active"},{"id":"inactive","name":"Inactive"}]'>
    </smart-input>
    <smart-input name="q" label="Search" type="text" placeholder="Search...">
    </smart-input>
    <smart-input name="from_date" label="From" type="date"></smart-input>
  </smart-filter-bar>

  <smart-table id="usersTable" api-url="/api/users/"
    response-map='{"dataPath":"results","totalPath":"count"}'
    columns='[{"field":"name"},{"field":"status","type":"badge"}]'>
  </smart-table>


================================================================================
SECTION 6 -- SMART-FORM  <smart-form>
================================================================================

Declarative AJAX form engine. Wraps smart-input, smart-quill, smart-search-input.
Collects values via getValue(), validates, handles CSRF automatically, maps
field errors from DRF responses, fires toast, refreshes table on success.

IMPORTANT: Do NOT place custom-button post= or smart-button post= inside
smart-form. Use a plain <button type="submit"> instead.

-- ATTRIBUTES -------------------------------------------------------------------

  api-url              POST target URL (activates AJAX mode in "auto")
  action               native form action (for native mode)
  method               HTTP method (default: POST)
  mode                 "ajax" | "native" | "auto" (default: auto)
  fetch-config         JSON: { headers:{}, bodyMode:"json"|"form" }
  response-map         JSON: { successPath, messagePath, dataPath, errorsPath }
  client-validate      run client-side validate() on all fields before submit
  no-auto-reset        disable form.reset() after successful submit
  refresh-target       id of smart-table to call .refresh() on success
  redirect-on-success  URL to navigate to after success
  success-title        text shown in success card after submit
  success-subtitle     secondary text for success card
  success-template     CSS selector of a template to clone on success

-- RESPONSE-MAP -----------------------------------------------------------------

  response-map='{"successPath":"status","messagePath":"message","errorsPath":"errors"}'

  successPath    dot-path to success indicator (truthy = success)
  messagePath    dot-path to message string shown in toast
  errorsPath     dot-path to field errors object: { fieldName: ["error msg"] }
  dataPath       dot-path to returned data (in smart-form-success event)

-- EVENTS -----------------------------------------------------------------------

  smart-form-success   { message, data }    dispatched on the element
  smart-form-error     { errors, message }  dispatched on the element

-- PUBLIC API -------------------------------------------------------------------

  el.getValues()           returns { fieldName: value } from all child inputs
  el.setValues({ k: v })   sets values on child inputs by name
  el.submit()              programmatically trigger submit
  el.reset()               reset all fields

-- FIELD CONTRACT (what child inputs must implement for smart-form) --------------

  getValue()       returns the field's current value
  setValue(v)      sets the field's value
  validate()       returns true if valid, shows error if not
  clear()          resets to empty state
  name attribute OR input-name attribute  used as the payload key

-- EXAMPLE ----------------------------------------------------------------------

  <smart-form
    api-url="/api/users/"
    method="POST"
    client-validate
    response-map='{"successPath":"status","messagePath":"message","errorsPath":"errors"}'
    refresh-target="usersTable">

    <smart-input type="text"  name="full_name" label="Full Name" required></smart-input>
    <smart-input type="email" name="email"     label="Email"     required></smart-input>
    <smart-input type="select" name="role" label="Role"
      data-options='[{"id":"admin","name":"Admin"},{"id":"editor","name":"Editor"}]'>
    </smart-input>
    <smart-quill name="bio" label="Bio" placeholder="Write something..."></smart-quill>

    <button type="submit" class="btn btn-primary">Create User</button>
  </smart-form>


================================================================================
SECTION 7 -- SMART-INPUT  <smart-input>
================================================================================

Universal input element. 10 types, one API. Validates automatically.
Integrates with smart-form, smart-filter-bar. All event hooks via attributes.

-- TYPES ------------------------------------------------------------------------

  text        text input with optional validation
  email       email format validated automatically
  password    password input with show/hide toggle
  number      numeric input
  textarea    multiline text (use rows= attribute)
  select      dropdown; single or multiple with tag chips
  datepicker  date picker (min-date, max-date, date-format attributes)
  file        file upload (accept, max-size, max-files, allowed-types)
  checkbox    single checkbox
  switch      toggle switch (is-big | is-medium | is-small for size)
  radio       radio group (use data-options for options)

-- COMMON ATTRIBUTES ------------------------------------------------------------

  type                input type (see above, default: text)
  name                field name (used as FormData key and smart-form payload key)
  label               display label
  placeholder         placeholder text
  required            enables required validation
  value               initial value
  data-error          custom error message (default: "Invalid {label}")
  data-options        JSON array for select/radio: '[{"id":"val","name":"Label"}]'
  multiple            enables multi-select with tag chips (select type)
  rows                row count for textarea
  data-url            async options URL for select (fetches on connect)
  data-response-path  dot-path to extract options array from data-url response
  selected-value      pre-selected value
  no-autocomplete     disables browser autocomplete
  min-date            minimum date (datepicker)
  max-date            maximum date (datepicker)
  date-format         "dd-mm-yyyy" | "mm-dd-yyyy" | "yyyy-mm-dd"
  accept              file types: ".pdf,.docx"
  max-size            max file size in bytes
  max-files           max number of files (default: 1)
  allowed-types       "image" | "document" | "video" | "audio"
  is-big              large switch size
  is-medium           medium switch size
  is-small            small switch size
  data-oninput        JS expression called on input event
  data-onchange       JS expression called on change event
  data-onclick        JS expression called on click event

-- PUBLIC API -------------------------------------------------------------------

  el.getValue()      returns current value
                     Array for multi-select, boolean for checkbox/switch
  el.setValue(v)     sets value
  el.validate()      returns true/false, shows inline error if invalid
  el.clear()         resets to empty
  el.focus()         focuses the underlying input
  el.showError(msg)  manually show an error message

-- EXAMPLES ---------------------------------------------------------------------

  <smart-input type="text"  name="username" label="Username" required></smart-input>
  <smart-input type="email" name="email"    label="Email"    required></smart-input>

  <smart-input type="select" name="role" label="Role"
    data-options='[{"id":"admin","name":"Admin"},{"id":"user","name":"User"}]'>
  </smart-input>

  <smart-input type="select" name="tags" label="Tags" multiple
    data-options='[{"id":"js","name":"JavaScript"},{"id":"py","name":"Python"}]'>
  </smart-input>

  <smart-input type="switch" name="notifications" label="Enable Notifications" is-big>
  </smart-input>

  <smart-input type="datepicker" name="dob" label="Date of Birth"
    min-date="2000-01-01" max-date="2025-12-31">
  </smart-input>

  <smart-input type="file" name="avatar" label="Profile Photo"
    accept=".jpg,.png" max-size="2097152" allowed-types="image">
  </smart-input>

  <smart-input type="textarea" name="message" label="Message" rows="4" required>
  </smart-input>


================================================================================
SECTION 8 -- SMART-SEARCH-INPUT  <smart-search-input>
================================================================================

Async search with dropdown results, multi-select badge chips, debounce,
keyboard navigation, pagination within results.

-- ATTRIBUTES -------------------------------------------------------------------

  name               field name
  label              display label
  placeholder        input placeholder
  data-url           URL to fetch search results from
  data-response-path dot-path to extract results array
  multiple           enable multi-select (boolean)
  required           required validation
  min-chars          minimum characters before search fires (default: 1)
  items-per-page     results shown per page in dropdown (default: 10)

-- PUBLIC API -------------------------------------------------------------------

  el.getValue()               returns Array of full selected objects
  el.getSelectedIds()         returns Array of selected IDs
  el.getSelectedItems()       returns Array of selected item objects
  el.setSelectedItems(items)  pre-populate selections with array of objects
  el.clearSelected()          clear all selections
  el.validate()               returns true (extend if needed)
  el.clear()                  reset the input

-- EXAMPLE ----------------------------------------------------------------------

  <smart-search-input
    name="users"
    label="Assign Users"
    data-url="/api/users/search/"
    data-response-path="results"
    multiple
    placeholder="Search users...">
  </smart-search-input>


================================================================================
SECTION 9 -- SMART-QUILL  <smart-quill>
================================================================================

Rich text editor built on Quill.js. Loads Quill from CDN automatically.
Full smart-form integration. Returns HTML string.

-- ATTRIBUTES -------------------------------------------------------------------

  name              field name (hidden input key)
  label             display label
  placeholder       editor placeholder
  required          required validation
  required-message  custom message (default: "{label} is required")
  value             initial HTML content

-- PUBLIC API -------------------------------------------------------------------

  el.getValue()    returns HTML string (editor innerHTML)
  el.setValue(v)   sets HTML content
  el.getHTML()     alias for getValue()
  el.getText()     returns plain text (no HTML tags)
  el.getLength()   character count
  el.validate()    returns true/false, shows error if required and empty
  el.clear()       empties the editor
  el.focus()       focus editor
  el.blur()        blur editor

-- EXAMPLE ----------------------------------------------------------------------

  <smart-quill
    name="description"
    label="Description"
    placeholder="Write your content..."
    required>
  </smart-quill>


================================================================================
SECTION 10 -- SMART-CHART  <smart-chart>
================================================================================

Full charting component. Static charts use Chart.js. WebSocket live charts
use ApexCharts (loaded automatically on first WS message). Both loaded from
CDN on demand -- no manual include needed.

IMPORTANT: Load as plain <script src="smart-chart.js">, NOT type="module".
Must load AFTER smart-state.js and smart-data.js.

-- DATA SOURCE (pick one) -------------------------------------------------------

  source="key"           reads from smartState (set by smart-data)
  api="/api/sales/"      fetches directly with optional auto-refresh
  data='[10,20,30]'      inline values array; use labels='["A","B","C"]'
  websocket="wss://..."  live streaming (always use wss:// in production)

-- DATA MAPPING -----------------------------------------------------------------

  x-field="date"         key in data rows for x-axis labels
  y-field="sales"        key in data rows for single y dataset
  datasets='[
    {"field":"sales",   "label":"Sales",   "type":"bar"},
    {"field":"returns", "label":"Returns", "type":"line", "color":"#f87171"}
  ]'                     multiple series; type per series for mixed charts
  response-path="data.items"  dot-path to extract array from API response

-- APPEARANCE -------------------------------------------------------------------

  default-type="area"           bar|line|area|pie|doughnut|radar|scatter|
                                 bubble|step|horizontalBar|polarArea
  type-switcher="bar,line,area" render live type-switch buttons in header
  palette="material"            material|nord|monochrome|pastel|ocean|vivid
  title="Revenue"
  subtitle="Monthly"
  height="320"                  canvas height px (default: 320)
  tension="0.4"                 line/area curve 0-1
  point-radius="3"

-- ANNOTATIONS ------------------------------------------------------------------

  goal-line="500"                thick solid green line at y=500
  goal-label="Target (500)"     label for goal line pill
  thresholds='{"700":"orange","900":"red"}'  thin dashed warning lines

-- CONTROLS ---------------------------------------------------------------------

  ranges="7d,30d,90d,ytd,1y,all"  date range filter buttons (requires x-field)
  toolbar="refresh,fullscreen"     icon buttons in header
  export="png,csv,json"            export buttons
  refresh="30s"                    auto-poll interval (api source only)
  no-zoom                          disable drag-to-zoom (zoom is ON by default)

-- STATE INTEGRATION ------------------------------------------------------------

  state-listen="key"    re-render when this smartState key changes
  click-state="key"     write clicked point to smartState
                        value shape: { label, value, datasetIndex, index }
  sync-group="name"     sync tooltip hover across multiple charts

-- WEBSOCKET ATTRIBUTES ---------------------------------------------------------

  websocket="wss://host/ws/sales/"   WS URL (always wss:// in production)
  ws-mode="append"                   append (default) | replace
  ws-max-points="200"                rolling window size (default: 200)
  ws-show-status                     show Live / Reconnecting in subtitle

  Append message format from server:
    { "label": "14:32:07", "values": { "sales": 450 } }
    OR flat: { "date": "14:32", "sales": 450 }  (uses x-field as label key)
  Replace message: full JSON array (same shape as REST API)

-- EVENTS -----------------------------------------------------------------------

  smart-chart-loaded     { key }
  smart-chart-click      { label, value, datasetIndex, index }
  smart-chart-ws-status  { state: "live"|"reconnecting"|"closed" }

-- EXAMPLES ---------------------------------------------------------------------

  <!-- Full-featured static chart -->
  <smart-chart
    source="salesData"
    state-listen="status"
    x-field="date"
    y-field="sales"
    default-type="area"
    type-switcher="bar,line,area"
    palette="pastel"
    goal-line="500"
    goal-label="Target"
    thresholds='{"700":"orange","900":"red"}'
    ranges="7d,30d,90d,ytd,1y,all"
    toolbar="refresh,fullscreen"
    export="png,csv,json"
    title="Revenue">
  </smart-chart>

  <!-- Live WebSocket chart -->
  <smart-chart
    websocket="wss://yourdomain.com/ws/chart/sales/"
    ws-mode="append"
    ws-max-points="60"
    ws-show-status
    default-type="area"
    type-switcher="area,line,bar"
    palette="vivid"
    title="Live Sales">
  </smart-chart>

  <!-- Multi-series mixed bar + line -->
  <smart-chart
    api="/api/sales/"
    x-field="date"
    datasets='[
      {"field":"revenue", "label":"Revenue", "type":"bar"},
      {"field":"target",  "label":"Target",  "type":"line", "color":"#22d3a5"}
    ]'
    title="Revenue vs Target">
  </smart-chart>


================================================================================
SECTION 11 -- SMART-GRID  <smart-grid>
================================================================================

CSS Grid layout engine. Responsive columns, column and row spans, drag-to-
reorder, resize handles, masonry mode, localStorage persistence. Works with
any child elements.

-- SMART TYPE DEFAULTS ----------------------------------------------------------

When SmartComponents are placed directly inside smart-grid, default spans apply:
  smart-chart   span 2, rowSpan 1
  smart-table   span 3, rowSpan 1
  smart-kpi     span 1, rowSpan 1
  smart-map     span 2, rowSpan 2
  (other)       span 1, rowSpan 1

Override with explicit span= on any child.

-- GRID ATTRIBUTES --------------------------------------------------------------

  columns     "auto-fit" | "auto-fill" | number (default: auto-detect from children)
  min         minimum column width for auto-fit/fill (default: "280px")
  gap         grid gap in px or CSS length (default: "16px")
  row-height  fixed height per row track (default: auto)
  xs          column count at <= 480px
  sm          column count at <= 640px
  md          column count at <= 1024px
  lg          column count at <= 1280px
  xl          column count above lg
  draggable   enable HTML5 drag-to-reorder (boolean)
  resizable   enable edge resize handles (boolean)
  persist     localStorage key for layout persistence
  masonry     enable grid-auto-flow: dense (boolean)

-- CHILD ATTRIBUTES -------------------------------------------------------------

  span="2"       column span (clamped to grid column count on resize)
  row-span="2"   row span (works best with fixed row-height on parent)
  id             stable identifier for layout persistence

-- PUBLIC API -------------------------------------------------------------------

  el.refresh()                      recalculate columns and re-apply spans
  el.addItem(el, { span, rowSpan }) append element with optional span options
  el.clearLayout()                  remove persisted layout, revert to defaults

-- EXAMPLES ---------------------------------------------------------------------

  <!-- Responsive auto-fit dashboard -->
  <smart-grid columns="auto-fit" min="280px" gap="20"
              draggable resizable persist="myDashboard">
    <smart-chart span="2" source="salesData" x-field="date" y-field="sales"
      default-type="area" title="Revenue">
    </smart-chart>
    <div class="kpi-card">...</div>
    <smart-table span="3" source="salesData" id="salesTable"></smart-table>
  </smart-grid>

  <!-- Fixed columns with breakpoints -->
  <smart-grid columns="4" xs="1" sm="1" md="2" lg="4" gap="16">
    <div>Card 1</div>
    <div>Card 2</div>
  </smart-grid>

  <!-- Masonry with row spans -->
  <smart-grid columns="3" masonry row-height="160px" gap="16">
    <div row-span="2">Tall card</div>
    <div>Normal</div>
    <div span="2">Wide card fills gap</div>
  </smart-grid>


================================================================================
SECTION 12 -- SMART-PERMISSION  <smart-permission>  +  if="" attribute
================================================================================

Reactive UI control system (SmartGuard Engine). Add if="" to ANY HTML element.
Evaluates a JS expression against smartState on every relevant state change.
Four rendering modes. Lazy rendering. Enter/leave animations.
MutationObserver auto-binds newly added nodes.

-- ATTRIBUTES -------------------------------------------------------------------

  if="expression"   JS expression evaluated against smartState (required)
                    examples:
                      "user.role === 'admin'"
                      "isLoggedIn && user.balance > 1000"
                      "!isLoggedIn"
                      "permissions.deleteUser"
                      "['admin','editor'].includes(user.role)"
                      "features.analytics"

  mode="hide"       display:none when false (default)
  mode="remove"     physically removes from DOM; re-inserts when true
  mode="disable"    disables all input/button/select/a children; dims to 50%
  mode="replace"    hides main content; shows fallback child instead

  lazy              element never mounted until expression is first true
                    useful for heavy components (charts, editors) that
                    should not initialize when not visible

  enter="fade|slide|scale|slide-up"  animation when element becomes visible
  leave="fade|slide|scale|slide-up"  animation before element hides/removes

-- FALLBACK (for mode="replace") ------------------------------------------------

  Recognized fallback selectors (any of these work):
    <fallback>...</fallback>
    <div slot="fallback">...</div>
    <div class="sg-fallback">...</div>

-- PUBLIC JS API ----------------------------------------------------------------

  SmartGuard.refresh()        force re-evaluate all bindings
  SmartGuard.scan(rootEl)     scan subtree for new [if] elements
  SmartGuard.unbind(el)       remove bindings for specific element
  SmartGuard.destroy()        tear down engine completely

-- EXAMPLES ---------------------------------------------------------------------

  <!-- Initialize from Django context -->
  <script>
    smartState.set("user", { role: "{{ request.user.role }}" });
    smartState.set("isLoggedIn", {{ request.user.is_authenticated|lower }});
    smartState.set("permissions", {
      deleteUser: {{ perms.auth.delete_user|lower }},
      editUser:   {{ perms.auth.change_user|lower }}
    });
    smartState.set("features", { analytics: {{ feature_analytics|lower }} });
  </script>

  <!-- mode: hide (default) -->
  <div if="user.role === 'admin'">Admin Panel</div>
  <div if="isLoggedIn && user.balance > 1000">Premium Feature</div>
  <button if="!isLoggedIn">Login</button>

  <!-- mode: remove -- physically absent from DOM when false -->
  <div if="permissions.deleteUser" mode="remove">
    <button class="btn btn-danger">Delete User</button>
  </div>

  <!-- mode: disable -- all children disabled/dimmed when false -->
  <div if="permissions.editUser" mode="disable">
    <smart-input type="text" name="username" label="Username"></smart-input>
    <button type="submit">Save</button>
  </div>

  <!-- mode: replace -- shows fallback when false -->
  <smart-permission if="user.role === 'admin'" mode="replace">
    <button class="btn btn-danger">Delete Account</button>
    <fallback><span>No Access -- Admin only</span></fallback>
  </smart-permission>

  <!-- lazy -- not mounted to DOM until first true -->
  <div if="features.analytics" lazy>
    <smart-chart api="/api/analytics/" x-field="date" y-field="value">
    </smart-chart>
  </div>

  <!-- Animations -->
  <div if="isLoggedIn" enter="slide" leave="fade">
    Welcome back!
  </div>


================================================================================
SECTION 13 -- SMART-TOAST / SMART-LOADER / SMART-MODAL  (smart-core.js)
================================================================================

Global UI primitives. All three communicate via window CustomEvents only.
No component queries another directly. Graceful degradation if not loaded.

-- SMART-TOAST ------------------------------------------------------------------

  Placement (one per page, inside barba container):
    <smart-toast position="bottom-right" max="5"></smart-toast>

  position values:
    top-right | top-left | top-center | bottom-right | bottom-left | bottom-center

  Fire a toast from anywhere:
    window.dispatchEvent(new CustomEvent('smart-toast', {
      detail: { message: "Saved!", type: "success", duration: 3000 }
    }));

  type values: success | error | warning | info
  duration: milliseconds before auto-dismiss (0 = persistent)

  Promise mode (shows loading -> success/error automatically):
    window.dispatchEvent(new CustomEvent('smart-toast', {
      detail: {
        promise: fetch('/api/save'),
        loading: "Saving...",
        success: "Saved!",
        error:   "Failed."
      }
    }));

-- SMART-LOADER -----------------------------------------------------------------

  Placement:
    <smart-loader type="overlay"></smart-loader>

  Show/hide from anywhere:
    window.dispatchEvent(new CustomEvent('smart-loader', { detail: { action: 'show' } }));
    window.dispatchEvent(new CustomEvent('smart-loader', { detail: { action: 'hide' } }));

  200ms flicker prevention built-in (will not flash for fast operations).
  Concurrent-safe: tracks show/hide calls, only hides when all callers hide.

-- SMART-MODAL ------------------------------------------------------------------

  Placement:
    <smart-modal></smart-modal>

  Fire a confirmation dialog from anywhere:
    window.dispatchEvent(new CustomEvent('smart-confirm', {
      detail: {
        title:     "Delete this item?",
        message:   "This action cannot be undone.",
        onConfirm: () => { /* user confirmed */ },
        onCancel:  () => { /* user cancelled */ }
      },
      cancelable: true
    }));

  smart-modal intercepts via preventDefault(). If smart-core is not loaded,
  custom-button and smart-button fall back to their built-in styled modal.
  Native browser confirm() is NEVER used anywhere in the framework.


================================================================================
SECTION 14 -- CUSTOM-BUTTON  <custom-button>  +  SMART-BUTTON  <smart-button>
================================================================================

Two button components with identical API.
  <custom-button>  full-width button (button.js)
  <smart-button>   compact/icon button (smart-button.js)

IMPORTANT: Do NOT place inside smart-form. Use plain <button type="submit">.

-- ATTRIBUTES -------------------------------------------------------------------

  label            button text
  post             URL to POST to (activates AJAX mode)
  method           HTTP method (default: POST)
  form-id          id of a form to collect FormData from before posting
  buttontype       "primary"|"success"|"danger"|"warning"|"info"|"secondary"
  showspinner      "true" shows spinner during request
  icon             Phosphor icon name ("trash", "pencil", "check")
  icon-color       CSS color for icon
  icon-position    "start" (default) | "end"
  icon-size        icon size in px (default: 14)
  disable-auto-icon  "true" disables auto icon detection from label text
  confirm-title    title for confirmation modal (triggers modal flow)
  confirm-message  body text for confirmation modal
  confirm-label    confirm button label (default: "Delete")
  cancel-label     cancel button label (default: "Cancel")
  skip-confirmation  "true" skips confirmation even if label contains "delete"
  tooltip          tooltip text on hover

-- EXAMPLES ---------------------------------------------------------------------

  <!-- AJAX save with spinner -->
  <custom-button
    label="Save Changes"
    form-id="myForm"
    post="/api/save"
    buttontype="success"
    showspinner="true">
  </custom-button>

  <!-- Delete with confirmation modal -->
  <custom-button
    label="Delete Record"
    post="/api/records/42/delete"
    buttontype="danger"
    confirm-title="Delete this record?"
    confirm-message="This cannot be undone.">
  </custom-button>

  <!-- Compact icon button -->
  <smart-button icon="pencil" post="/api/edit/42" tooltip="Edit record">
  </smart-button>


================================================================================
SECTION 15 -- SMART-IMAGE  <smart-image>
================================================================================

Lazy-loading image. Shimmer/spinner skeleton, fallback on error with Retry,
hover zoom, click-to-preview lightbox, aspect-ratio fluid sizing.

-- ATTRIBUTES -------------------------------------------------------------------

  src            image URL (required)
  fallback-src   URL to try if src fails to load
  alt            alt text
  width          width in px (number) or CSS value
  height         height in px (number) or CSS value
  aspect-ratio   CSS aspect-ratio value: "16/9" | "4/3" | "1/1"
  fit            object-fit value (default: "cover")
  animation-type "shimmer" (default when w+h set) | "spinner"
  rounded        adds border-radius (boolean)
  circle         renders as circle (boolean)
  hover-zoom     scale on hover (boolean)
  click-preview  opens lightbox on click (boolean)
  caption        caption text below image
  lazy           lazy load via IntersectionObserver (default: true)

-- EVENTS -----------------------------------------------------------------------

  image-loaded   { src }
  image-error    { src }

-- EXAMPLES ---------------------------------------------------------------------

  <smart-image src="/media/photo.jpg" width="400" height="280" rounded></smart-image>

  <smart-image src="/media/avatar.jpg" width="64" height="64"
    animation-type="spinner" circle></smart-image>

  <smart-image
    src="/media/photo.jpg"
    fallback-src="/media/placeholder.jpg"
    width="800" height="450"
    rounded hover-zoom click-preview
    caption="Photo from the event">
  </smart-image>

  <smart-image src="/media/banner.jpg" aspect-ratio="16/9"
    style="width:100%" rounded>
  </smart-image>


================================================================================
SECTION 16 -- SMART-LIST-TILE  <smart-list-tile>
================================================================================

Interactive list item with leading/trailing icons, active state, ripple.

-- ATTRIBUTES -------------------------------------------------------------------

  title            primary text (required)
  subtitle         secondary text
  leading-icon     Phosphor icon name for left icon
  trailing-icon    Phosphor icon name for right icon
  active           active/selected state (boolean)
  active-color     "primary"|"success"|"warning"|"danger"|"info"
  clickable        enable click/hover interaction (boolean)
  disabled         disabled state (boolean)
  text-color       CSS color for text
  background-color CSS color for background
  icon-color       CSS color for icons
  border-radius    CSS border-radius value
  border           CSS border value
  max-lines        max lines before text truncates (default: 1)

-- EXAMPLE ----------------------------------------------------------------------

  <smart-list-tile
    title="Dashboard"
    subtitle="Admin panel"
    leading-icon="house"
    trailing-icon="caret-right"
    active
    active-color="primary"
    clickable>
  </smart-list-tile>


================================================================================
SECTION 17 -- SMART-EFFECTS  <smart-effects>
================================================================================

Anime.js animation engine. 17 built-in presets. 5 trigger modes.
Requires anime.js >= 3.x already loaded. Place outside barba container.

-- ATTRIBUTES -------------------------------------------------------------------

  auto                  auto-animate common elements with smart defaults
  type="preset-name"    run a specific built-in preset
  target="selector"     CSS selector of elements to animate
  trigger               page|scroll|hover|click|manual (default: page)
  delay="number"        stagger or initial delay in ms
  duration="number"     animation duration in ms
  easing="string"       Anime.js easing
  translateX="number"   from translateX value in px
  translateY="number"   from translateY value in px
  scale="number"        from scale value
  rotate="number"       from rotate value in degrees
  opacity="number"      from opacity value (0-1)

-- BUILT-IN PRESETS -------------------------------------------------------------

  card-stagger    .card elements rise and stagger in
  fade-up         generic fade-up for .fade-up-item elements
  modal-pop       modal dialogs scale in with spring
  sidebar-slide   sidebar enters from left
  table-stagger   table rows slide in from left
  button-click    .btn scale micro-interaction on click
  error-shake     .is-invalid / .form-error shake
  hero-enter      h1/hero title soft rise
  headings        h2/h3 cascade
  count-up        [data-count] numbers animate from 0 to value
  badge-pop       .badge / .tag spring in
  nav-links       navbar items drop from above
  form-fields     form groups stagger in
  alert-drop      alerts drop from above
  image-grid      images scale up from center
  timeline        .timeline-item slide from left

-- AUTO MODE --------------------------------------------------------------------

  <smart-effects auto></smart-effects>

  Automatically animates: h1, .lead, nav items, .card, table rows, badges,
  [data-count] counters, images, .reveal elements, form fields, list items,
  sidebar, section headings. Above-fold fires immediately. Below-fold uses
  IntersectionObserver. Listens to smart-page-enter from smart-motion.js.

-- PUBLIC API -------------------------------------------------------------------

  el.play(selector?)            trigger animation (manual mode)
  el.playPreset(name, target?)  play a specific preset programmatically

-- EXAMPLES ---------------------------------------------------------------------

  <!-- Auto mode -- recommended -->
  <smart-effects auto></smart-effects>

  <!-- Scroll-triggered card stagger -->
  <smart-effects type="card-stagger" trigger="scroll"></smart-effects>

  <!-- Custom animation -->
  <smart-effects target=".my-section" trigger="scroll"
    translateY="20" opacity="0" duration="600" delay="100">
  </smart-effects>

  <!-- count-up on data-count elements -->
  <smart-effects type="count-up" trigger="scroll"></smart-effects>
  <span data-count="1500">0</span>


================================================================================
SECTION 18 -- SMART-MOTION  <smart-motion>
================================================================================

Barba.js page transition engine. Place OUTSIDE the barba container.
Requires @barba/core. anime.js recommended for panel transitions.

-- ATTRIBUTES -------------------------------------------------------------------

  type      overlay|fade|slide|scale|panel-up|panel-down|panel-left|panel-right
            "panel" is aliased to "panel-up" for backward compatibility
  duration  ms per half-transition (default: 400)

-- DISPATCHED EVENTS (on window) ------------------------------------------------

  smart-page-leave    { namespace }
  smart-page-enter    { namespace, container }
  smart-page-mounted  { namespace, container }

-- WINDOW HELPERS ---------------------------------------------------------------

  window.barbaExecuteScripts(container?)   re-execute inline script tags
                                           in new page container after nav
  window.barbaCleanup(variableNames[])    cleanup global variables from old page

-- DATA ATTRIBUTES --------------------------------------------------------------

  data-no-barba                    exclude link from Barba navigation
  data-barba="wrapper"             outer wrapper (survives navigation)
  data-barba="container"           inner container (swapped on each nav)
  data-barba-namespace="pageName"  page identifier for transition targeting

-- EXAMPLE ----------------------------------------------------------------------

  <smart-motion type="panel-up" duration="500"></smart-motion>

  <div data-barba="wrapper">
    <smart-toast></smart-toast>
    <smart-modal></smart-modal>
    <smart-loader></smart-loader>
    <div data-barba="container" data-barba-namespace="home">
      {% block content %}{% endblock %}
    </div>
  </div>

  <script>
    window.addEventListener('smart-page-enter', (e) => {
      barbaExecuteScripts(e.detail.container);
    });
    window.addEventListener('smart-page-leave', () => {
      barbaCleanup(['myChart', 'myTable']);
    });
  </script>


================================================================================
SECTION 19 -- SMART-COUNTER  <smart-counter>
================================================================================

Animated counter with bounce on value change. Shadow DOM. CSS custom properties.

-- ATTRIBUTES -------------------------------------------------------------------

  value   numeric value to display
  label   label text below the number (default: "Points")

-- CSS CUSTOM PROPERTIES --------------------------------------------------------

  --counter-font-size    font size of number (default: 1.3rem)
  --counter-font-weight  font weight (default: bold)
  --label-font-size      label font size (default: 0.75rem)
  --label-color          label color (default: gray)

-- EXAMPLE ----------------------------------------------------------------------

  <smart-counter value="1500" label="Total Sales"
    style="--counter-font-size:2rem;--label-color:#6378ff;">
  </smart-counter>

  <!-- Update programmatically -- triggers bounce animation -->
  <script>
    document.querySelector('smart-counter').setAttribute('value', '1523');
  </script>


================================================================================
SECTION 20 -- COMPLETE DASHBOARD PATTERN
================================================================================

Full pattern: single smart-data feeds a chart, filter bar, and table.
Filter bar drives both chart re-render and table refresh reactively.

  {% extends 'base.html' %}
  {% block content %}

  <script>
    smartState.set("user", { role: "{{ request.user.role }}" });
    smartState.set("isLoggedIn", {{ request.user.is_authenticated|lower }});
  </script>

  <smart-data
    key="salesData"
    api="{% url 'api:sales-list' %}"
    response-path="results"
    refresh="30s"
    cache="10s">
  </smart-data>

  <smart-filter-bar target="salesTable" auto-apply state-key="salesFilters">
    <smart-input name="status" label="Status" type="select"
      data-options='[{"id":"","name":"All"},{"id":"active","name":"Active"}]'
      state-set="status">
    </smart-input>
    <smart-input name="from_date" label="From" type="date"></smart-input>
    <smart-input name="to_date"   label="To"   type="date"></smart-input>
  </smart-filter-bar>

  <smart-grid columns="auto-fit" min="300px" gap="20"
              draggable resizable persist="salesDashboard">

    <smart-chart
      span="2"
      source="salesData"
      state-listen="status"
      x-field="date"
      y-field="sales"
      default-type="area"
      type-switcher="bar,line,area"
      palette="pastel"
      goal-line="500"
      goal-label="Monthly Target"
      ranges="7d,30d,90d,ytd,all"
      toolbar="refresh,fullscreen"
      export="png,csv,json"
      title="Revenue">
    </smart-chart>

    <smart-table
      span="3"
      source="salesData"
      state-listen="status"
      id="salesTable"
      columns='[
        {"field":"id",     "hidden":true},
        {"field":"date",   "label":"Date",     "type":"date",    "sortable":true},
        {"field":"name",   "label":"Customer", "sortable":true},
        {"field":"amount", "label":"Amount",   "type":"integer", "sortable":true},
        {"field":"status", "label":"Status",   "type":"badge"}
      ]'
      delete-api-url="{% url 'api:sales-detail' pk=0 %}"
      page-size="25">
    </smart-table>

  </smart-grid>

  <div if="user.role === 'admin' || user.role === 'editor'">
    <smart-form
      api-url="{% url 'api:sales-list' %}"
      method="POST"
      client-validate
      response-map='{"successPath":"status","messagePath":"message","errorsPath":"errors"}'
      refresh-target="salesTable">

      <smart-input type="text"   name="customer" label="Customer" required></smart-input>
      <smart-input type="number" name="amount"   label="Amount"   required></smart-input>
      <smart-input type="select" name="status"   label="Status"
        data-options='[{"id":"active","name":"Active"},{"id":"pending","name":"Pending"}]'>
      </smart-input>
      <button type="submit" class="btn btn-primary">Add Sale</button>

    </smart-form>
  </div>

  {% endblock %}


================================================================================
SECTION 21 -- RULES THE AI MUST FOLLOW
================================================================================

1.  NEVER write fetch() manually if smart-chart, smart-table, or smart-data
    can handle the request declaratively.

2.  NEVER write manual DOM update logic. Use state-text, state-html, state-show
    attributes or smart-permission if="" instead.

3.  NEVER write manual event listeners for data loading or filtering. Use
    state-listen= on the component and smartState.set() from the filter.

4.  NEVER use React, Vue, or Angular patterns. No JSX. No virtual DOM.
    SmartComponents is Vanilla JS Web Components. Write HTML and attributes.

5.  ALWAYS use smart-data for shared data that multiple components consume.
    One smart-data, one fetch, many consumers.

6.  ALWAYS use smartState for UI state that multiple elements react to.
    Set state once, let DOM bindings and component state-listen handle the rest.

7.  ALWAYS use smart-form for AJAX form submission. Never wire form submit with
    addEventListener + fetch() manually.

8.  NEVER place custom-button or smart-button with post= inside smart-form.
    Use a plain <button type="submit"> inside smart-form instead.

9.  ALWAYS use wss:// (not ws://) for WebSocket URLs in production.
    Generate dynamic WebSocket URLs server-side:
      ws_scheme = 'wss' if request.is_secure() else 'ws'
      ws_url = f"{ws_scheme}://{request.get_host()}/ws/path/"

10. NEVER hardcode localhost or 127.0.0.1 in websocket= attributes.
    Always use the current domain from the Django request object.

11. smart-chart.js MUST be loaded as plain script tag, NOT type="module".

12. smart-state.js and smart-data.js MUST be loaded as plain script tags
    BEFORE all other SmartComponent script tags.

13. Global singletons (smart-toast, smart-modal, smart-loader) go INSIDE
    the data-barba="container". smart-motion and smart-effects go OUTSIDE.

14. smart-permission if="" evaluates JS expressions. Expressions reference
    smartState keys directly without any "smartState." prefix.
    Initialize state before or after elements -- MutationObserver handles both.

15. For smart-table with api-url, response-map is REQUIRED. Minimum shape:
    '{"dataPath":"results","totalPath":"count"}'

################################################################################
##  END OF SMARTCOMPONENTS AI CONTEXT FILE
##  Docs: https://smartelements.in
################################################################################