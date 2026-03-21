# SmartComponents

> Drop-in Web Components for Django (and any HTML backend).  
> Tables. Forms. Charts. Inputs. Animations. Grids. Permissions.  
> All declarative. All attribute-driven. Zero build step.

🌐 **[smartelements.in](https://smartelements.in)** — Live docs, demos, and playground

**Author:** Ketan Coder — [github.com/Ketan-coder](https://github.com/Ketan-coder)  
**License:** [Business Source License 1.1](./LICENSE) — free for personal & non-commercial use  
**Version:** 1.0.0  
**Stack:** Vanilla JS · Web Components · Bootstrap 5 / Halfmoon · Django-ready

---

## What is this?

SmartComponents is a library of HTML Web Components that replace the boilerplate you rewrite on every project. Instead of wiring up 80 lines of fetch + render + validate + paginate JavaScript, you write a single HTML tag.

```html
<!-- Before: ~95 lines of fetch + render + sort + paginate JS -->

<!-- After: -->
<smart-table
  api-url="/api/users/"
  response-map='{"dataPath":"results","totalPath":"count"}'
  columns='[{"field":"name"},{"field":"status","type":"badge"}]'
  delete-api-url="/api/users"
  page-size="20">
</smart-table>
```

That one tag gives you: shimmer skeleton on load · click-to-sort headers · live search with debounce · auto scroll mode detection · delete confirm modal + row fade-out + toast · empty + error states · responsive overflow.

---

## Components

| Component | File | Docs | Description |
|-----------|------|------|-------------|
| `<smart-table>` | `smart_table.js` | [→ Docs](https://smartelements.in/smart-table/) | Sortable, searchable, paginated data table with auto scroll mode detection |
| `<smart-input>` | `input.js` | [→ Docs](https://smartelements.in/smart-input/) | Universal input — text, email, password, select, datepicker, file, checkbox, switch, radio, textarea |
| `<smart-search-input>` | `smart_search_input.js` | [→ Docs](https://smartelements.in/smart-search-input/) | Async search with multi-select badges, debounce, keyboard navigation |
| `<smart-image>` | `smart_image.js` | [→ Docs](https://smartelements.in/smart-image/) | Lazy load, shimmer/spinner skeleton, fallback, hover-zoom, click-preview lightbox |
| `<smart-form>` | `smart_form.js` | [→ Docs](https://smartelements.in/smart-form/) | Declarative AJAX form engine — collects values, validates, handles CSRF, maps field errors |
| `<smart-chart>` | `smart_chart.js` | [→ Docs](https://smartelements.in/smart-chart/) | Charting on Chart.js + ApexCharts. 10+ types, WebSocket live streaming, drag-to-zoom, export |
| `<smart-grid>` | `smart_grid.js` | [→ Docs](https://smartelements.in/smart-grid/) | Dashboard layout engine — auto-fit columns, spans, drag-to-reorder, resize, persist |
| `<smart-permission>` | `smart_permission.js` | [→ Docs](https://smartelements.in/smart-permissions/) | Reactive UI control via `if=""` — hide, remove, disable, or replace based on live state |
| `<smart-motion>` | `smart_motion.js` | [→ Docs](https://smartelements.in/smart-motions/) | Barba.js page transitions — overlay, fade, slide, scale, panel |
| `<smart-effects>` | `smart_effect.js` | [→ Docs](https://smartelements.in/smart-motions/) | Anime.js animation engine — 8 presets, scroll/hover/click triggers, auto mode |
| `<smart-toast>` | `smart_core.js` | [→ Docs](https://smartelements.in/smart-core/#toast-overview) | Stacked auto-dismissing toasts — fire with one `dispatchEvent()` call |
| `<smart-loader>` | `smart_core.js` | [→ Docs](https://smartelements.in/smart-core/#loader-overview) | Full-page or scoped overlay loader with flicker prevention |
| `<smart-modal>` | `smart_core.js` | [→ Docs](https://smartelements.in/smart-core/#modal-overview) | Branded confirmation dialog — replaces `window.confirm()` |
| `<smart-filter-bar>` | `smart_filter_box.js` | [→ Docs](https://smartelements.in/smart-table/#filter-bar) | Declarative filter bar that drives `<smart-table>` via CustomEvents |
| `<smart-quill>` | `rich_text_input.js` | [→ Docs](https://smartelements.in/smart-quill/) | Rich text editor wrapping Quill.js with validation and form integration |
| `<smart-list-tile>` | `smart_list_tile.js` | [→ Docs](https://smartelements.in/smart-list-tile/) | Interactive list tile with icons, active states, ripple, AJAX actions |
| `<custom-button>` | `smart_button.js` | [→ Docs](https://smartelements.in/smart-button/) | AJAX button with spinner, styled confirm modal, toast feedback |
| `<icon-button>` | `button.js` | [→ Docs](https://smartelements.in/smart-button/) | Compact icon-only button with ripple, AJAX, auto icon detection |

---

## Documentation

Full documentation, live demos, and interactive playgrounds are available at **[smartelements.in](https://smartelements.in)**.

| Section | URL |
|---------|-----|
| Home & Overview | [smartelements.in](https://smartelements.in) |
| All Components | [smartelements.in/components](https://smartelements.in/components/) |
| Starter Template | [smartelements.in/starter-page](https://smartelements.in/starter-page/) |
| SmartTable | [smartelements.in/smart-table](https://smartelements.in/smart-table/) |
| SmartInput | [smartelements.in/smart-input](https://smartelements.in/smart-input/) |
| SmartForm | [smartelements.in/smart-form](https://smartelements.in/smart-form/) |
| SmartChart | [smartelements.in/smart-chart](https://smartelements.in/smart-chart/) |
| SmartGrid | [smartelements.in/smart-grid](https://smartelements.in/smart-grid/) |
| SmartPermission | [smartelements.in/smart-permissions](https://smartelements.in/smart-permissions/) |
| Animations (Motion + Effects) | [smartelements.in/smart-motions](https://smartelements.in/smart-motions/) |
| Core (Toast + Loader + Modal) | [smartelements.in/smart-core](https://smartelements.in/smart-core/) |
| SmartImage | [smartelements.in/smart-image](https://smartelements.in/smart-image/) |
| SmartSearchInput | [smartelements.in/smart-search-input](https://smartelements.in/smart-search-input/) |
| SmartQuill | [smartelements.in/smart-quill](https://smartelements.in/smart-quill/) |
| SmartListTile | [smartelements.in/smart-list-tile](https://smartelements.in/smart-list-tile/) |
| Buttons | [smartelements.in/smart-button](https://smartelements.in/smart-button/) |

---

## Quick Start

### 1. Copy the JS files into your Django project

```
your_project/
  static/
    resources/
      js/
        components/
          smart_table.js
          input.js
          smart_form.js
          smart_chart.js
          smart_grid.js
          smart_permission.js
          smart_core.js
          smart_motion.js
          smart_effect.js
          smart_filter_box.js
          rich_text_input.js
          smart_list_tile.js
          smart_search_input.js
          smart_button.js
          button.js
          smart_image.js
```

### 2. Load in your base template

```html
{% load static %}

<!-- CDN dependencies (load before components) -->
<script src="https://cdn.jsdelivr.net/npm/@barba/core"></script>
<script src="https://cdn.jsdelivr.net/npm/animejs@3.2.1/lib/anime.min.js"></script>
<link href="https://cdn.quilljs.com/1.3.6/quill.snow.css" rel="stylesheet">
<script src="https://cdn.quilljs.com/1.3.6/quill.js"></script>

<!-- SmartComponents (in this order) -->
<script type="module" src="{% static 'resources/js/components/smart_core.js' %}"></script>
<script type="module" src="{% static 'resources/js/components/smart_motion.js' %}"></script>
<script type="module" src="{% static 'resources/js/components/smart_effect.js' %}"></script>
<script type="module" src="{% static 'resources/js/components/input.js' %}"></script>
<script type="module" src="{% static 'resources/js/components/smart_search_input.js' %}"></script>
<script type="module" src="{% static 'resources/js/components/rich_text_input.js' %}"></script>
<script type="module" src="{% static 'resources/js/components/smart_button.js' %}"></script>
<script type="module" src="{% static 'resources/js/components/button.js' %}"></script>
<script type="module" src="{% static 'resources/js/components/smart_list_tile.js' %}"></script>
<script type="module" src="{% static 'resources/js/components/smart_image.js' %}"></script>
<script type="module" src="{% static 'resources/js/components/smart_filter_box.js' %}"></script>
<script type="module" src="{% static 'resources/js/components/smart_table.js' %}"></script>
<script type="module" src="{% static 'resources/js/components/smart_form.js' %}"></script>
<script src="{% static 'resources/js/components/smart_chart.js' %}"></script>
<script type="module" src="{% static 'resources/js/components/smart_grid.js' %}"></script>
<script type="module" src="{% static 'resources/js/components/smart_permission.js' %}"></script>

<!-- Global singletons — once in base.html, inside data-barba="container" -->
<smart-toast position="top-right" max="5"></smart-toast>
<smart-modal></smart-modal>
<smart-loader type="overlay"></smart-loader>

<!-- Page transitions + animations — outside the barba container -->
<smart-motion type="panel" duration="400"></smart-motion>
<smart-effects auto></smart-effects>
```

> **Note:** `smart-chart.js` is loaded as a regular `<script>` (not `type="module"`) because it uses an IIFE wrapper pattern that needs to register on `window` before Chart.js callbacks fire.

### 3. Use in any Django template

```html
{% extends 'base.html' %}
{% block content %}

<smart-table
  api-url="{% url 'api:users-list' %}"
  response-map='{"dataPath":"results","totalPath":"count"}'
  columns='[
    {"field":"name",   "label":"Name"},
    {"field":"email",  "label":"Email"},
    {"field":"status", "label":"Status", "type":"badge"}
  ]'
  delete-api-url="{% url 'api:users-detail' pk=0 %}"
  page-size="20">
</smart-table>

{% endblock %}
```

---

## Examples

### Data Table — full features in one tag

```html
<smart-table
  api-url="/api/orders/"
  response-map='{"dataPath":"results","totalPath":"count"}'
  columns='[
    {"field":"id",     "label":"#",       "hidden":true},
    {"field":"name",   "label":"Customer","sortable":true},
    {"field":"amount", "label":"Amount",  "type":"number"},
    {"field":"status", "label":"Status",  "type":"badge"},
    {"field":"date",   "label":"Date",    "type":"date"}
  ]'
  delete-api-url="/api/orders"
  page-size="25">
</smart-table>
```

### Form with validation + AJAX submit

```html
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
  <button type="submit">Create User</button>

</smart-form>
```

### Dashboard grid — drag, resize, persist

```html
<smart-grid
  columns="auto-fit"
  min="280px"
  gap="20"
  draggable
  resizable
  persist="my-dashboard">

  <smart-chart span="2" api="/api/revenue/" x-field="date" y-field="amount"
    default-type="area" ranges="7d,30d,1y,all" toolbar="fullscreen" export="png,csv">
  </smart-chart>

  <div class="kpi-card" id="users-kpi">...</div>

  <smart-table span="3" source="salesData" id="salesTable"></smart-table>

</smart-grid>
```

### Reactive permissions

```html
<script>
  smartState.set("user", { role: "{{ request.user.role }}" });
  smartState.set("permissions", {
    deleteUser: {{ request.user.has_perm|lower }},
  });
</script>

<!-- Visible only to admins -->
<div if="user.role === 'admin'">
  <smart-chart api="/api/admin-metrics/" ...></smart-chart>
</div>

<!-- Physically removed from DOM when false -->
<div if="permissions.deleteUser" mode="remove">
  <button>Delete User</button>
</div>

<!-- Shows fallback for non-admins -->
<smart-permission if="user.role === 'admin'" mode="replace">
  <button class="btn btn-danger">Delete Account</button>
  <fallback><span>⛔ Admin only</span></fallback>
</smart-permission>
```

### Live WebSocket chart

```html
<smart-chart
  websocket="ws://localhost:8000/ws/chart/sales/"
  ws-mode="append"
  ws-max-points="60"
  ws-show-status
  default-type="area"
  type-switcher="area,line,bar"
  palette="vivid"
  title="Live Sales">
</smart-chart>
```

```python
# Django Channels consumer
async def websocket_connect(self, event):
    await self.accept()
    while True:
        await self.send(json.dumps({
            "label": datetime.now().strftime("%H:%M:%S"),
            "values": {"sales": random.randint(200, 900)}
        }))
        await asyncio.sleep(1)
```

---

## Project Structure

```
SmartComponents/
├── input.js                 # <smart-input> — 8+ input types
├── smart_table.js           # <smart-table> — full data table
├── smart_image.js           # <smart-image> — lazy load + lightbox
├── smart_search_input.js    # <smart-search-input> — async multi-select
├── smart_button.js          # <custom-button> — AJAX button
├── button.js                # <icon-button> — icon-only variant
├── smart_list_tile.js       # <smart-list-tile> — list items
├── rich_text_input.js       # <smart-quill> — rich text editor
├── smart_core.js            # <smart-toast> <smart-loader> <smart-modal>
├── smart_filter_box.js      # <smart-filter-bar> — filter bar
├── smart_form.js            # <smart-form> — AJAX form engine
├── smart_chart.js           # <smart-chart> — Chart.js + ApexCharts
├── smart_grid.js            # <smart-grid> — dashboard layout engine
├── smart_permission.js      # <smart-permission> + if="" — reactive UI control
├── smart_motion.js          # <smart-motion> — Barba.js page transitions
├── smart_effect.js          # <smart-effects> — Anime.js animations
├── README.md
└── LICENSE
```

---

## Requirements

- Any HTML backend (Django, Flask, Rails, plain HTML — no build step needed)
- Bootstrap 5 or Halfmoon for base styling (smart components do not depend on it for core functionality)
- CDN dependencies loaded before components (listed above)

### Tested with

- Django 4.x / 5.x
- Python 3.10+
- Bootstrap 5.3
- Chrome 100+ · Firefox 110+ · Safari 16+ · Edge 100+

---

## Contributing

Contributions require **explicit written approval** from the author before being merged.

This project is authored and maintained solely by **Ketan Coder**. All decisions about direction, features, and what gets merged flow through the author.

To propose a contribution:

1. **Open an Issue first** — describe what you want to change and why. Do not open a PR without a prior approved issue.
2. **Wait for a response.** Issues without explicit approval from `@Ketan-coder` will have their PRs closed without review.
3. **Follow the existing code style** — Vanilla JS, no transpilation, no bundlers, no TypeScript. Each component is one self-contained file.
4. **One component per PR.** Do not bundle unrelated changes.
5. **Sign your commits.** Include your GitHub handle in the commit message.

> **Note on forks:** You are welcome to fork this project for personal or non-commercial use under the terms of the [LICENSE](./LICENSE). Forks that re-publish modified versions as a competing library are not permitted without written permission.

### What I'm looking for

- Bug fixes with a clear reproduction case
- Accessibility improvements (ARIA attributes, keyboard navigation)
- New SmartComponent ideas — open an issue with a use-case description first
- Documentation improvements
- Django-specific integration examples

### What I'm not looking for (at this stage)

- NPM package / build tooling
- TypeScript port
- React / Vue wrappers
- Breaking API changes

---

## License

**Business Source License 1.1**

- ✅ Free for personal projects
- ✅ Free for non-commercial use
- ✅ Free to read, fork, and learn from
- ✅ Free for open-source projects that do not compete with this library
- ❌ Not free for commercial products/SaaS without a commercial license
- ❌ Cannot be re-published as a competing component library
- ⏳ Converts to MIT License 4 years from the first public release date

For commercial licensing, contact: ketan [at] ketanv289@outlook.com

See [LICENSE](./LICENSE) for full terms.

---

## Author

**Ketan Coder**  
Mumbai, India  
[github.com/Ketan-coder](https://github.com/Ketan-coder) · [smartelements.in](https://smartelements.in)

Backend: Python / Django · Frontend: Vanilla JS, Flutter · ~2 years building production web apps

> Built SmartComponents because I was tired of writing the same 80-line fetch + render + validate + paginate boilerplate on every single project.

---

## Acknowledgements

SmartComponents is built on top of these excellent open-source libraries:

- [Chart.js](https://www.chartjs.org/) — static charts
- [ApexCharts](https://apexcharts.com/) — live WebSocket charts
- [Barba.js](https://barba.js.org/) — page transitions (via smart-motion)
- [Anime.js](https://animejs.com/) — animations (via smart-effects)
- [Quill.js](https://quilljs.com/) — rich text editor (via smart-quill)
- [Bootstrap 5](https://getbootstrap.com/) — base component styling
- [Phosphor Icons](https://phosphoricons.com/) — icon set

Each of these libraries retains its own license.