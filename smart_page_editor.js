/**
 * smart_page_editor.js — SmartPageEditor v1.4
 * <smart-page-editor> — Notion-style block editor for the SmartElements ecosystem.
 *
 * ── LOAD ORDER ───────────────────────────────────────────────────────────────
 *   <script src="smart_core.js"></script>          ← required for full theme support
 *   <script src="smart_page_editor.js"></script>
 *
 * ── ATTRIBUTES ───────────────────────────────────────────────────────────────
 *   name="fieldname"          hidden input name          (default: "page")
 *   label="My Page"           optional label above editor
 *   value="[…]|<html>"        initial content — JSON block array OR HTML string
 *   placeholder="…"           shown when editor is empty
 *   required                  validation: editor must have content
 *   required-message="…"      custom validation error message
 *   readonly                  render-only, no editing
 *   theme="auto|light|dark"   default: auto
 *   styled="default|bootstrap"
 *   autosave-delay="1000"     debounce ms for autosave (0 = disabled)
 *   upload-url="/api/upload"  server upload endpoint; POST multipart/form-data with "file" field
 *   draft-recovery           auto-save draft to localStorage; shows restore banner on crash recovery
 *   highlight                enable Prism.js syntax highlighting (auto-loads from CDN if needed)
 *
 * ── PUBLIC API ────────────────────────────────────────────────────────────────
 *   editor.getJSON()           → Block[]
 *   editor.setJSON(blocks)     → void
 *   editor.getHTML()           → string (semantic HTML)
 *   editor.exportHTML()        → alias for getHTML()
 *   editor.getMarkdown()       → string (basic markdown)
 *   editor.serialize()         → JSON string  (primary storage format)
 *   editor.deserialize(str)    → void  (load from JSON string)
 *   editor.importHTML(html)    → void
 *   editor.importMarkdown(md)  → void
 *   editor.clear()             → void
 *   editor.focus()             → void
 *   editor.undo()              → void
 *   editor.redo()              → void
 *   editor.validate()          → boolean
 *   editor.checkValidity()     → boolean
 *   editor.reportValidity()    → boolean
 *   editor.isDirty()           → boolean  (unsaved changes exist)
 *   editor.clearDraft()        → void     (clear localStorage draft)
 *   editor.markClean()         → void     (call after save to reset dirty flag)
 *
 * ── EVENTS ───────────────────────────────────────────────────────────────────
 *   spe-change   detail: { json: Block[], html: string }
 *   spe-save     detail: { json: Block[], html: string }   (autosave trigger)
 *   spe-dirty    detail: { dirty: boolean }
 *
 * ── UPLOAD ADAPTER ───────────────────────────────────────────────────────────
 *   Set upload-url attribute, OR assign editor.uploadHandler = async (file) => url
 *
 * ── DJANGO INTEGRATION ───────────────────────────────────────────────────────
 *   # In your form:
 *   <smart-page-editor name="content" label="Content"></smart-page-editor>
 *
 *   # In your Django view (save):
 *   content_json = request.POST.get('content')   # JSON string
 *   instance.content = content_json              # store as TextField/JSONField
 *
 *   # In your template (load):
 *   <smart-page-editor name="content" value="{{ instance.content|escapejs }}"></smart-page-editor>
 *   # OR for JSONField (auto-serialized):
 *   <smart-page-editor name="content" value="{{ instance.content_json }}"></smart-page-editor>
 *
 *   # In your model:
 *   content = models.TextField(default='[]')  # store raw JSON
 *   # OR use JSONField (Django 3.1+):
 *   content = models.JSONField(default=list)
 *
 * ── BLOCK DATA SHAPE ─────────────────────────────────────────────────────────
 *   { id, type, content,
 *     checked?,          (todo)
 *     indent?,           (0-6)
 *     align?,            (left|center|right|full)
 *     fontSize?,         (sm|md|lg|xl)
 *     textColor?,        (css color string)
 *     bgColor?,          (css color string)
 *     src?,              (image|video)
 *     caption?,          (image|video)
 *     alt?,              (image)
 *     imgWidth?,         (sm|md|lg|full)
 *     imgAlign?,         (left|center|right)
 *     rows?              (table: string[][])
 *   }
 *
 * ── BLOCK TYPES ──────────────────────────────────────────────────────────────
 *   paragraph · heading1 · heading2 · heading3
 *   todo · quote · code · divider · callout
 *   image · video · audio · table · columns (resizable) · bookmark
 *
 * ── CHANGELOG v1.4 ───────────────────────────────────────────────────────────
 *   NEW: Draft recovery — localStorage autosave survives browser crashes
 *   NEW: Resizable 2-column layout with drag divider (ratio stored in block)
 *   NEW: Bookmark block — link preview card via microlink.io (free, no key)
 *   NEW: Syntax highlighting via Prism.js (lazy-loaded from CDN)
 *   NEW: VSCode paste — preserves colored span highlighting from clipboard
 *   FIX: Code block paste now detects VSCode HTML and keeps syntax colors
 *── CHANGELOG v1.2 (previous) ──────────────────────────────────────────────
 *   FIX: Removed duplicate blinking cursor — empty-hint only shows when truly empty
 *   FIX: YouTube Error 153 — now uses youtube-nocookie.com + handles Shorts/embed URLs
 *   FIX: Double cursor on empty editor (spe-empty-hint vs contenteditable ::before)
 *   FIX: Settings panel and popups no longer bleed outside editor on load
 *   FIX: Enter key in code/todo blocks now shows hint text for Ctrl+Enter
 *   NEW: Full serialization API: serialize(), deserialize(), getMarkdown(), importMarkdown()
 *   NEW: Autosave with configurable debounce + spe-save / spe-dirty events
 *   NEW: Image upload adapter (upload-url attr or editor.uploadHandler)
 *   NEW: Image alignment + width presets (sm/md/lg/full)
 *   NEW: YouTube Shorts + embed URL support + privacy mode (nocookie)
 *   NEW: Callout block type
 *   NEW: Duplicate block action in settings panel
 *   NEW: Code block copy button
 *   NEW: Checklist progress indicator in todo blocks
 *   NEW: Django integration docs in header
 */

// ─────────────────────────────────────────────────────────────────────────────
//  Graceful base-class fallback
// ─────────────────────────────────────────────────────────────────────────────
const SPEBase = window.SmartElement ?? HTMLElement;

// ─────────────────────────────────────────────────────────────────────────────
//  BLOCK_TYPES — single source of truth
// ─────────────────────────────────────────────────────────────────────────────
const BLOCK_TYPES = {
    paragraph: {
        tag: 'p',           label: 'Text',      icon: 'text-aa',
        isText: true,       placeholder: "Type '/' for commands…",
    },
    heading1: {
        tag: 'h1',          label: 'Heading 1', icon: 'text-h-one',
        isText: true,       placeholder: 'Heading 1',
        shortcut: /^#\s/,
    },
    heading2: {
        tag: 'h2',          label: 'Heading 2', icon: 'text-h-two',
        isText: true,       placeholder: 'Heading 2',
        shortcut: /^##\s/,
    },
    heading3: {
        tag: 'h3',          label: 'Heading 3', icon: 'text-h-three',
        isText: true,       placeholder: 'Heading 3',
        shortcut: /^###\s/,
    },
    todo: {
        tag: 'div',         label: 'Todo',      icon: 'check-square',
        isText: true,       placeholder: 'To-do',
        shortcut: /^\[\]\s/,
    },
    quote: {
        tag: 'blockquote',  label: 'Quote',     icon: 'quotes',
        isText: true,       placeholder: 'Quote…',
        shortcut: /^>\s/,
    },
    code: {
        tag: 'pre',         label: 'Code',      icon: 'code',
        isText: true,       placeholder: '// code…',
        shortcut: /^```/,
    },
    callout: {
        tag: 'div',         label: 'Callout',   icon: 'warning',
        isText: true,       placeholder: 'Callout…',
        shortcut: /^:::/,
    },
    divider: {
        tag: 'hr',          label: 'Divider',   icon: 'minus',
        isText: false,
        shortcut: /^---$/,
    },
    image: {
        tag: 'div',         label: 'Image',     icon: 'image',
        isText: false,
    },
    video: {
        tag: 'div',         label: 'Video',     icon: 'film-strip',
        isText: false,
    },
    table: {
        tag: 'div',         label: 'Table',     icon: 'table',
        isText: false,
    },
    bookmark: {
        tag: 'div',         label: 'Bookmark',  icon: 'link',
        isText: false,
    },
};

// Columns and bookmark are in BLOCK_TYPES but appended below
const BLOCK_TYPES_EXTRA = {
    columns: {
        tag: 'div', label: '2 Columns', icon: 'columns', isText: false,
    },
    bookmark: {
        tag: 'div', label: 'Bookmark',  icon: 'link',    isText: false,
    },
};
Object.assign(BLOCK_TYPES, BLOCK_TYPES_EXTRA);

const COMMAND_ORDER = [
    'paragraph','heading1','heading2','heading3',
    'todo','quote','code','callout','divider',
    'image','video','table','columns','bookmark',
];

const ALIGN_OPTIONS = [
    { value: 'left',   icon: 'text-align-left',   label: 'Align Left'   },
    { value: 'center', icon: 'text-align-center',  label: 'Align Center' },
    { value: 'right',  icon: 'text-align-right',   label: 'Align Right'  },
];

const FONTSIZE_OPTIONS = [
    { value: 'sm', label: 'Small'  },
    { value: 'md', label: 'Normal' },
    { value: 'lg', label: 'Large'  },
    { value: 'xl', label: 'Huge'   },
];

const COLOR_SWATCHES = [
    '#1a1d23','#dc2626','#d97706','#16a34a',
    '#2563eb','#7c3aed','#db2777','#6b7280',
];
const BG_SWATCHES = [
    'transparent','#fef9c3','#dcfce7','#dbeafe',
    '#fce7f3','#f3e8ff','#ffe4e6','#f3f4f6',
];

const IMG_WIDTH_OPTIONS = [
    { value: 'sm',   label: 'Small',      style: '40%'  },
    { value: 'md',   label: 'Medium',     style: '60%'  },
    { value: 'lg',   label: 'Large',      style: '80%'  },
    { value: 'full', label: 'Full Width',  style: '100%' },
];

const IMG_ALIGN_OPTIONS = [
    { value: 'left',   label: 'Left'   },
    { value: 'center', label: 'Center' },
    { value: 'right',  label: 'Right'  },
];

// ─────────────────────────────────────────────────────────────────────────────
//  HTMLImporter
// ─────────────────────────────────────────────────────────────────────────────
const HTMLImporter = {
    INLINE_ALLOWED: new Set(['B','STRONG','I','EM','U','CODE','A','BR','SPAN']),

    looksLikeJSON(str) {
        const t = (str || '').trim();
        if (!t || (t[0] !== '[' && t[0] !== '{')) return false;
        try { const p = JSON.parse(t); return Array.isArray(p) || typeof p === 'object'; }
        catch { return false; }
    },

    sanitizeInline(node) {
        const out = document.createElement('div');
        const walk = (src, dest) => {
            src.childNodes.forEach(child => {
                if (child.nodeType === Node.TEXT_NODE) {
                    dest.appendChild(document.createTextNode(child.textContent));
                    return;
                }
                if (child.nodeType !== Node.ELEMENT_NODE) return;
                const tag = child.nodeName;
                if (this.INLINE_ALLOWED.has(tag)) {
                    const norm = tag === 'STRONG' ? 'b' : tag === 'EM' ? 'i' : tag.toLowerCase();
                    const el   = document.createElement(norm);
                    if (tag === 'A') {
                        el.href   = child.getAttribute('href') || '#';
                        el.target = '_blank';
                        el.rel    = 'noopener noreferrer';
                    }
                    if (tag === 'SPAN' && child.getAttribute('style')) {
                        el.setAttribute('style', child.getAttribute('style'));
                    }
                    walk(child, el);
                    dest.appendChild(el);
                } else {
                    walk(child, dest);
                }
            });
        };
        walk(node, out);
        return out.innerHTML.trim();
    },

    htmlToBlocks(html) {
        const wrap = document.createElement('div');
        wrap.innerHTML = html || '';
        const blocks = [];
        let id = 1;
        const nid  = () => String(id++);
        const push = (type, el, extra = {}) =>
            blocks.push({ id: nid(), type, content: this.sanitizeInline(el), ...extra });
        const raw  = (el) => {
            const t = document.createElement('div');
            t.textContent = el.outerHTML;
            blocks.push({ id: nid(), type: 'code', content: t.innerHTML });
        };

        Array.from(wrap.childNodes).forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
                const t = node.textContent.trim();
                if (t) blocks.push({ id: nid(), type: 'paragraph', content: this._esc(t) });
                return;
            }
            if (node.nodeType !== Node.ELEMENT_NODE) return;
            switch (node.nodeName) {
                case 'H1': push('heading1', node); break;
                case 'H2': push('heading2', node); break;
                case 'H3': case 'H4': case 'H5': case 'H6': push('heading3', node); break;
                case 'P':  push('paragraph', node); break;
                case 'BLOCKQUOTE': push('quote', node); break;
                case 'PRE': {
                    const c = node.querySelector('code') || node;
                    blocks.push({ id: nid(), type: 'code', content: this._esc(c.textContent || '') });
                    break;
                }
                case 'HR': blocks.push({ id: nid(), type: 'divider', content: '' }); break;
                case 'UL': case 'OL': {
                    const hasCheck = node.querySelector('input[type="checkbox"]');
                    Array.from(node.children).forEach(li => {
                        if (li.nodeName !== 'LI') return;
                        const cb = li.querySelector('input[type="checkbox"]');
                        if (hasCheck && cb) {
                            const clone = li.cloneNode(true);
                            clone.querySelector('input')?.remove();
                            push('todo', clone, { checked: !!cb.checked });
                        } else { push('paragraph', li); }
                    });
                    break;
                }
                case 'DIV': case 'SECTION': case 'ARTICLE': {
                    if (!node.children.length && node.textContent.trim())
                        push('paragraph', node);
                    else if (node.children.length)
                        blocks.push(...this.htmlToBlocks(node.innerHTML));
                    break;
                }
                default: raw(node);
            }
        });
        if (!blocks.length) blocks.push({ id: nid(), type: 'paragraph', content: '' });
        return blocks;
    },

    _esc(s) {
        return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    },
};

// ─────────────────────────────────────────────────────────────────────────────
//  MarkdownImporter / Exporter
// ─────────────────────────────────────────────────────────────────────────────
const MarkdownUtils = {
    blocksToMarkdown(blocks) {
        return blocks.map(b => {
            switch (b.type) {
                case 'heading1':   return `# ${this._stripTags(b.content || '')}`;
                case 'heading2':   return `## ${this._stripTags(b.content || '')}`;
                case 'heading3':   return `### ${this._stripTags(b.content || '')}`;
                case 'quote':      return `> ${this._stripTags(b.content || '')}`;
                case 'code':       return `\`\`\`\n${this._stripTags(b.content || '')}\n\`\`\``;
                case 'divider':    return `---`;
                case 'todo':       return `- [${b.checked ? 'x' : ' '}] ${this._stripTags(b.content || '')}`;
                case 'callout':    return `> ⚠ ${this._stripTags(b.content || '')}`;
                case 'image':      return b.src ? `![${b.alt||''}](${b.src})${b.caption ? `\n*${b.caption}*` : ''}` : '';
                case 'video':      return b.src ? `[Video](${b.src})` : '';
                case 'table': {
                    if (!b.rows?.length) return '';
                    const rows = b.rows.map(r => `| ${r.join(' | ')} |`);
                    const sep  = `| ${b.rows[0].map(() => '---').join(' | ')} |`;
                    return [rows[0], sep, ...rows.slice(1)].join('\n');
                }
                default:           return this._stripTags(b.content || '');
            }
        }).filter(Boolean).join('\n\n');
    },

    markdownToBlocks(md) {
        const lines = (md || '').split('\n');
        const blocks = [];
        let id = 1;
        const nid = () => `b${id++}`;
        let i = 0;

        while (i < lines.length) {
            const line = lines[i];

            // Code fences
            if (line.startsWith('```')) {
                const codeLines = [];
                i++;
                while (i < lines.length && !lines[i].startsWith('```')) {
                    codeLines.push(lines[i]);
                    i++;
                }
                blocks.push({ id: nid(), type: 'code', content: this._esc(codeLines.join('\n')) });
                i++;
                continue;
            }

            if (/^#{1,6}\s/.test(line)) {
                const m = line.match(/^(#{1,3})\s+(.*)$/);
                if (m) {
                    const type = ['heading1','heading2','heading3'][m[1].length-1] || 'heading3';
                    blocks.push({ id: nid(), type, content: this._esc(m[2]) });
                }
                i++; continue;
            }

            if (/^---+$/.test(line.trim())) {
                blocks.push({ id: nid(), type: 'divider', content: '' });
                i++; continue;
            }

            if (line.startsWith('> ')) {
                blocks.push({ id: nid(), type: 'quote', content: this._esc(line.slice(2)) });
                i++; continue;
            }

            const todoM = line.match(/^- \[([ xX])\] (.*)/);
            if (todoM) {
                blocks.push({ id: nid(), type: 'todo', content: this._esc(todoM[2]), checked: todoM[1].toLowerCase() === 'x' });
                i++; continue;
            }

            const imgM = line.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
            if (imgM) {
                blocks.push({ id: nid(), type: 'image', content: '', src: imgM[2], alt: imgM[1] });
                i++; continue;
            }

            if (line.trim()) {
                blocks.push({ id: nid(), type: 'paragraph', content: this._esc(line) });
            }
            i++;
        }

        return blocks.length ? blocks : [{ id: nid(), type: 'paragraph', content: '' }];
    },

    _stripTags(html) {
        const d = document.createElement('div');
        d.innerHTML = html;
        return d.textContent || '';
    },
    _esc(s) {
        return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    },
};

// ─────────────────────────────────────────────────────────────────────────────
//  HistoryManager
// ─────────────────────────────────────────────────────────────────────────────
class HistoryManager {
    constructor() {
        this._past   = [];
        this._future = [];
        this._MAX    = 100;
    }

    push(snapshot) {
        this._past.push(JSON.stringify(snapshot));
        if (this._past.length > this._MAX) this._past.shift();
        this._future = [];
    }

    canUndo() { return this._past.length > 0; }
    canRedo() { return this._future.length > 0; }

    undo(current) {
        if (!this.canUndo()) return null;
        this._future.push(JSON.stringify(current));
        return JSON.parse(this._past.pop());
    }

    redo(current) {
        if (!this.canRedo()) return null;
        this._past.push(JSON.stringify(current));
        return JSON.parse(this._future.pop());
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  BlockManager
// ─────────────────────────────────────────────────────────────────────────────
class BlockManager {
    constructor(host, container) {
        this.host      = host;
        this.container = container;
        this.blocks    = [];
        this.history   = new HistoryManager();
        this._idSeq    = 1;
        this._composing = false;
    }

    _nid()         { return `b${this._idSeq++}`; }
    _idx(id)       { return this.blocks.findIndex(b => b.id === id); }
    _block(id)     { return this.blocks.find(b => b.id === id); }
    _el(id)        { return this.container.querySelector(`[data-block-id="${id}"]`); }
    _editable(id)  {
        const el = this._el(id);
        return el ? el.querySelector('.spe-editable') : null;
    }

    load(blocks, silent = false) {
        this.blocks = (Array.isArray(blocks) && blocks.length
            ? blocks : [this._emptyPara()])
            .map(b => ({ ...b, id: b.id || this._nid() }));

        this.blocks.forEach(b => {
            const n = parseInt(String(b.id).replace(/\D/g, ''), 10);
            if (!isNaN(n) && n >= this._idSeq) this._idSeq = n + 1;
        });

        this._renderAll();
        if (!silent) this.host._notifyChange();
    }

    _emptyPara() { return { id: this._nid(), type: 'paragraph', content: '' }; }

    toJSON() { return this.blocks.map(b => ({ ...b })); }

    toHTML() { return this.blocks.map(b => this._blockToHTML(b)).join('\n'); }

    _blockToHTML(b) {
        const indent = b.indent ? ` style="margin-left:${b.indent * 1.5}rem"` : '';
        if (b.type === 'divider') return `<hr${indent}>`;
        if (b.type === 'image')   return b.src ? `<figure${indent}><img src="${this._esc(b.src)}" alt="${this._esc(b.alt||'')}"><figcaption>${b.caption||''}</figcaption></figure>` : '';
        if (b.type === 'video')   return b.src ? `<figure${indent}><video src="${this._esc(b.src)}" controls><p>${this._esc(b.src)}</p></video>${b.caption?`<figcaption>${b.caption}</figcaption>`:''}</figure>` : '';
        if (b.type === 'table') {
            if (!b.rows?.length) return '';
            const rows = b.rows.map(r => `<tr>${r.map(c=>`<td>${c||''}</td>`).join('')}</tr>`).join('');
            return `<table${indent}><tbody>${rows}</tbody></table>`;
        }
        if (b.type === 'code')    return `<pre${indent}><code${b.lang && b.lang !== 'plain' ? ` class="language-${b.lang}"` : ''}>${this._stripTags(b.content||'')}</code></pre>`;
        if (b.type === 'todo')    return `<div${indent}><label><input type="checkbox" disabled${b.checked?' checked':''}> ${b.content||''}</label></div>`;
        if (b.type === 'callout') return `<div class="callout"${indent}>${b.content||''}</div>`;
        if (b.type === 'bookmark') return b.src ? `<a href="${this._esc(b.src)}" target="_blank" rel="noopener noreferrer" class="bookmark">${this._esc(b.bmTitle||b.src)}</a>` : '';
        if (b.type === 'columns') {
            if (!b.columns?.length) return '';
            const cols = b.columns.map(col => `<div class="spe-col" style="flex:1">${col.map(bl => this._blockToHTML(bl)).join('\n')}</div>`).join('');
            return `<div class="spe-columns" style="display:flex;gap:1rem"${indent}>${cols}</div>`;
        }
        const cfg = BLOCK_TYPES[b.type] || BLOCK_TYPES.paragraph;
        const styleArr = [];
        if (b.align)     styleArr.push(`text-align:${b.align}`);
        if (b.fontSize)  styleArr.push(`font-size:${{sm:'0.8rem',md:'1rem',lg:'1.25rem',xl:'1.6rem'}[b.fontSize]||'1rem'}`);
        if (b.textColor) styleArr.push(`color:${b.textColor}`);
        if (b.bgColor && b.bgColor !== 'transparent') styleArr.push(`background:${b.bgColor}`);
        const styleAttr = styleArr.length ? ` style="${styleArr.join(';')}"` : '';
        return `<${cfg.tag}${indent}${styleAttr}>${b.content||''}</${cfg.tag}>`;
    }

    _stripTags(html) {
        const d = document.createElement('div');
        d.innerHTML = html || '';
        return d.textContent || '';
    }

    _esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

    _renderAll() {
        this.container.innerHTML = '';
        this.blocks.forEach(b => this.container.appendChild(this._renderBlock(b)));
    }

    _renderBlock(block) {
        const row = document.createElement('div');
        row.className    = 'spe-block';
        row.dataset.blockId   = block.id;
        row.dataset.blockType = block.type;
        if (block.indent) row.style.marginLeft = `${block.indent * 1.5}rem`;

        const drag = document.createElement('button');
        drag.type = 'button'; drag.className = 'spe-drag-handle';
        drag.title = 'Drag to reorder'; drag.setAttribute('aria-label', 'Drag');
        drag.innerHTML = '<i class="ph ph-dots-six-vertical"></i>';
        row.appendChild(drag);

        const gear = document.createElement('button');
        gear.type = 'button'; gear.className = 'spe-gear-btn';
        gear.title = 'Block settings'; gear.setAttribute('aria-label', 'Block settings');
        gear.innerHTML = '<i class="ph ph-dots-three"></i>';
        gear.addEventListener('click', (e) => {
            e.stopPropagation();
            this.host.settingsPanel?.open(block, gear);
        });
        row.appendChild(gear);

        const content = document.createElement('div');
        content.className = 'spe-block-content';
        row.appendChild(content);

        this._renderBlockContent(block, content);
        return row;
    }

    _renderBlockContent(block, content) {
        content.innerHTML = '';

        if (block.type === 'divider') {
            content.innerHTML = '<hr class="spe-divider">';
            return;
        }
        if (block.type === 'image') {
            content.appendChild(this._renderImageBlock(block));
            return;
        }
        if (block.type === 'video') {
            content.appendChild(this._renderVideoBlock(block));
            return;
        }
        if (block.type === 'table') {
            content.appendChild(this._renderTableBlock(block));
            return;
        }
        if (block.type === 'columns') {
            content.appendChild(this._renderColumnsBlock(block));
            return;
        }
        if (block.type === 'bookmark') {
            content.appendChild(this._renderBookmarkBlock(block));
            return;
        }
        if (block.type === 'callout') {
            const wrap = document.createElement('div');
            wrap.className = 'spe-callout-wrap';
            const icon = document.createElement('span');
            icon.className = 'spe-callout-icon';
            icon.textContent = '💡';
            const ed = this._makeEditable(block);
            wrap.appendChild(icon);
            wrap.appendChild(ed);
            content.appendChild(wrap);
            return;
        }
        if (block.type === 'todo') {
            const row = document.createElement('div');
            row.className = 'spe-todo-row';

            const cb = document.createElement('button');
            cb.type = 'button';
            cb.className = 'spe-todo-check' + (block.checked ? ' spe-todo-checked' : '');
            cb.setAttribute('role', 'checkbox');
            cb.setAttribute('aria-checked', String(!!block.checked));
            cb.innerHTML = block.checked ? '<i class="ph ph-check"></i>' : '';
            cb.addEventListener('click', () => {
                this.history.push(this.toJSON());
                block.checked = !block.checked;
                cb.classList.toggle('spe-todo-checked', block.checked);
                cb.setAttribute('aria-checked', String(block.checked));
                cb.innerHTML = block.checked ? '<i class="ph ph-check"></i>' : '';
                ed.classList.toggle('spe-todo-done', block.checked);
                this.host._notifyChange();
                // Update progress indicator if any
                this.host._updateTodoProgress?.();
            });

            const ed = this._makeEditable(block);
            ed.classList.toggle('spe-todo-done', !!block.checked);
            row.appendChild(cb);
            row.appendChild(ed);
            content.appendChild(row);
            return;
        }

        // Code block: language selector + copy + syntax highlighting
        if (block.type === 'code') {
            const wrap = document.createElement('div');
            wrap.className = 'spe-code-wrap';

            // Language selector badge
            if (!this.host._isReadonly()) {
                const langSel = document.createElement('select');
                langSel.className = 'spe-lang-sel';
                langSel.setAttribute('aria-label', 'Code language');
                const LANGS = ['plain','javascript','typescript','python','html','css','bash','shell','sql','json','go','rust','java','c','cpp','csharp','php','ruby','swift','kotlin'];
                LANGS.forEach(l => {
                    const opt = document.createElement('option');
                    opt.value = l; opt.textContent = l;
                    if ((block.lang || 'plain') === l) opt.selected = true;
                    langSel.appendChild(opt);
                });
                langSel.addEventListener('change', () => {
                    block.lang = langSel.value;
                    this.host._notifyChange();
                    this._highlightCodeBlock(wrap, block);
                });
                wrap.appendChild(langSel);
            } else if (block.lang && block.lang !== 'plain') {
                const badge = document.createElement('span');
                badge.className = 'spe-lang-badge';
                badge.textContent = block.lang;
                wrap.appendChild(badge);
            }

            const ed = this._makeEditable(block);

            // If block has VSCode-pasted highlighted HTML, show a highlighted view
            if (block.highlightedHTML && !this.host._isReadonly()) {
                const hlView = document.createElement('div');
                hlView.className = 'spe-code-hl-view';
                hlView.innerHTML = block.highlightedHTML;
                hlView.addEventListener('click', () => {
                    // Switch to plain editor on click
                    hlView.style.display = 'none';
                    ed.style.display = '';
                    ed.focus();
                });
                ed.style.display = 'none';
                ed.addEventListener('blur', () => {
                    if (ed.textContent.trim()) {
                        hlView.style.display = '';
                        ed.style.display = 'none';
                    }
                });
                wrap.appendChild(ed);
                wrap.appendChild(hlView);
            } else {
                wrap.appendChild(ed);
                // Prism highlight on render if lang set
                if (block.lang && block.lang !== 'plain') {
                    requestAnimationFrame(() => this._highlightCodeBlock(wrap, block));
                }
            }

            const copyBtn = document.createElement('button');
            copyBtn.type = 'button'; copyBtn.className = 'spe-code-copy';
            copyBtn.title = 'Copy code';
            copyBtn.innerHTML = '<i class="ph ph-copy"></i>';
            copyBtn.addEventListener('click', () => {
                const text = this._stripTags(block.content || '');
                navigator.clipboard?.writeText(text).then(() => {
                    copyBtn.innerHTML = '<i class="ph ph-check"></i>';
                    setTimeout(() => { copyBtn.innerHTML = '<i class="ph ph-copy"></i>'; }, 1500);
                });
            });
            wrap.appendChild(copyBtn);
            content.appendChild(wrap);
            return;
        }

        content.appendChild(this._makeEditable(block));
    }

    // ── Image block ──────────────────────────────────────────────────────────
    _renderImageBlock(block) {
        const wrap = document.createElement('div');
        wrap.className = 'spe-media-block';

        if (block.src) {
            const widthStyle = { sm:'40%', md:'60%', lg:'80%', full:'100%' }[block.imgWidth || 'full'];
            const alignStyle = { left:'flex-start', center:'center', right:'flex-end' }[block.imgAlign || 'center'];

            wrap.innerHTML = `
                <div class="spe-media-preview" style="display:flex;justify-content:${alignStyle}">
                    <img src="${this._esc(block.src)}" alt="${this._esc(block.alt||'')}"
                         class="spe-img" style="width:${widthStyle}"
                         loading="lazy">
                </div>
                <input class="spe-caption-input" placeholder="Caption (optional)" value="${this._esc(block.caption||'')}">
            `;
            wrap.querySelector('.spe-caption-input').addEventListener('input', e => {
                block.caption = e.target.value;
                this.host._notifyChange();
            });
            if (!this.host._isReadonly()) {
                wrap.querySelector('.spe-img')?.addEventListener('dblclick', () => {
                    const a = window.prompt('Alt text:', block.alt || '');
                    if (a !== null) { block.alt = a; this.host._notifyChange(); }
                });
            }
        } else {
            wrap.innerHTML = `
                <div class="spe-media-empty spe-media-drop-zone">
                    <i class="ph ph-image"></i>
                    <span>Add an image</span>
                    <small>Drag & drop, paste, or upload</small>
                </div>
                <div class="spe-media-inputs">
                    <input class="spe-url-input" placeholder="Paste image URL…" type="url">
                    <span class="spe-media-or">or</span>
                    <label class="spe-file-btn">
                        <i class="ph ph-upload"></i> Upload
                        <input type="file" accept="image/*" class="spe-file-inp" hidden>
                    </label>
                </div>
                <div class="spe-upload-progress sc-hidden">
                    <div class="spe-progress-bar"><div class="spe-progress-fill"></div></div>
                    <span class="spe-progress-label">Uploading…</span>
                </div>
            `;
            const urlInp  = wrap.querySelector('.spe-url-input');
            const fileInp = wrap.querySelector('.spe-file-inp');
            const dropZone = wrap.querySelector('.spe-media-drop-zone');

            urlInp.addEventListener('keydown', e => {
                if (e.key !== 'Enter') return;
                const url = urlInp.value.trim();
                if (url) { this._commitMedia(block, 'image', url); }
            });

            fileInp.addEventListener('change', () => {
                const file = fileInp.files?.[0];
                if (!file) return;
                this._uploadOrReadFile(block, file, wrap);
            });

            // Drag & drop onto zone
            dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('spe-drop-active'); });
            dropZone.addEventListener('dragleave', () => dropZone.classList.remove('spe-drop-active'));
            dropZone.addEventListener('drop', e => {
                e.preventDefault();
                dropZone.classList.remove('spe-drop-active');
                const file = e.dataTransfer?.files?.[0];
                if (file && file.type.startsWith('image/')) {
                    this._uploadOrReadFile(block, file, wrap);
                } else if (e.dataTransfer?.getData('text/uri-list')) {
                    const url = e.dataTransfer.getData('text/uri-list');
                    if (url) this._commitMedia(block, 'image', url.trim());
                }
            });
        }

        return wrap;
    }

    async _uploadOrReadFile(block, file, wrap) {
        const uploadUrl = this.host.getAttribute('upload-url');
        const uploadHandler = this.host.uploadHandler;

        const progressEl = wrap.querySelector('.spe-upload-progress');
        const fillEl     = wrap.querySelector('.spe-progress-fill');
        const labelEl    = wrap.querySelector('.spe-progress-label');

        if (progressEl) progressEl.classList.remove('sc-hidden');

        try {
            if (uploadHandler || uploadUrl) {
                // Server upload
                let url;
                if (uploadHandler) {
                    url = await uploadHandler(file);
                } else {
                    const formData = new FormData();
                    formData.append('file', file);
                    if (fillEl) fillEl.style.width = '30%';
                    const resp = await fetch(uploadUrl, { method: 'POST', body: formData });
                    if (fillEl) fillEl.style.width = '80%';
                    if (!resp.ok) throw new Error(`Upload failed: ${resp.status}`);
                    const data = await resp.json();
                    url = data.url || data.file || data.src || data.path;
                    if (!url) throw new Error('Upload response missing URL');
                }
                if (fillEl) fillEl.style.width = '100%';
                this._commitMedia(block, 'image', url);
            } else {
                // Fallback: base64 (dev mode)
                if (labelEl) labelEl.textContent = 'Converting…';
                const reader = new FileReader();
                reader.onprogress = ev => {
                    if (fillEl && ev.lengthComputable) fillEl.style.width = `${(ev.loaded/ev.total*100)}%`;
                };
                reader.onload = ev => this._commitMedia(block, 'image', ev.target.result);
                reader.readAsDataURL(file);
            }
        } catch (err) {
            if (labelEl) { labelEl.textContent = `Error: ${err.message}`; labelEl.style.color = 'var(--sc-error,#dc2626)'; }
            console.error('[SmartPageEditor] Upload error:', err);
        }
    }

    // ── Video block ──────────────────────────────────────────────────────────
    _renderVideoBlock(block) {
        const wrap = document.createElement('div');
        wrap.className = 'spe-media-block';

        if (block.src) {
            const embed = this._videoEmbed(block.src);
            wrap.innerHTML = `
                <div class="spe-media-preview">${embed}</div>
                <input class="spe-caption-input" placeholder="Caption (optional)" value="${this._esc(block.caption||'')}">
            `;
            wrap.querySelector('.spe-caption-input').addEventListener('input', e => {
                block.caption = e.target.value;
                this.host._notifyChange();
            });
        } else {
            wrap.innerHTML = `
                <div class="spe-media-empty">
                    <i class="ph ph-film-strip"></i>
                    <span>Add a video</span>
                    <small>YouTube, Shorts, Vimeo, or direct URL</small>
                </div>
                <div class="spe-media-inputs">
                    <input class="spe-url-input" placeholder="Paste YouTube / Vimeo / video URL…" type="url">
                </div>
            `;
            const urlInp = wrap.querySelector('.spe-url-input');
            urlInp.addEventListener('keydown', e => {
                if (e.key !== 'Enter') return;
                const url = urlInp.value.trim();
                if (url) { this._commitMedia(block, 'video', url); }
            });
        }
        return wrap;
    }

    /**
     * _videoEmbed — FIX #2 / #15 / #16
     * ─────────────────────────────────
     * YouTube Error 153 = the video owner has disabled embedding on standard youtube.com.
     * Fix: use youtube-nocookie.com (privacy-enhanced mode) which also bypasses many
     * embedding restrictions. Also handle:
     *   • youtube.com/watch?v=ID
     *   • youtu.be/ID
     *   • youtube.com/shorts/ID
     *   • youtube.com/embed/ID
     *   • youtu.be/ID?si=…   (share links with si param)
     */
    _videoEmbed(src) {
        // YouTube: extract video ID from all URL patterns
        const ytId = this._extractYouTubeId(src);
        if (ytId) {
            return `<iframe
                src="https://www.youtube-nocookie.com/embed/${ytId}?rel=0&modestbranding=1"
                frameborder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen
                loading="lazy"
                class="spe-video-iframe"></iframe>`;
        }

        // Vimeo
        const vmMatch = src.match(/vimeo\.com\/(?:video\/)?(\d+)/);
        if (vmMatch) {
            return `<iframe
                src="https://player.vimeo.com/video/${vmMatch[1]}?dnt=1"
                frameborder="0"
                allow="autoplay; fullscreen; picture-in-picture"
                allowfullscreen
                loading="lazy"
                class="spe-video-iframe"></iframe>`;
        }

        // Native video file
        return `<video src="${this._esc(src)}" controls class="spe-video-native" loading="lazy"></video>`;
    }

    _extractYouTubeId(url) {
        if (!url) return null;
        // youtube.com/watch?v=ID or ?v=ID&...
        let m = url.match(/[?&]v=([A-Za-z0-9_-]{11})/);
        if (m) return m[1];
        // youtu.be/ID or youtu.be/ID?si=...
        m = url.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
        if (m) return m[1];
        // youtube.com/shorts/ID
        m = url.match(/\/shorts\/([A-Za-z0-9_-]{11})/);
        if (m) return m[1];
        // youtube.com/embed/ID
        m = url.match(/\/embed\/([A-Za-z0-9_-]{11})/);
        if (m) return m[1];
        // youtube.com/live/ID
        m = url.match(/\/live\/([A-Za-z0-9_-]{11})/);
        if (m) return m[1];
        return null;
    }

    _commitMedia(block, type, src) {
        this.history.push(this.toJSON());
        block.src  = src;
        block.type = type;
        const el = this._el(block.id);
        if (el) {
            const content = el.querySelector('.spe-block-content');
            if (content) this._renderBlockContent(block, content);
        }
        this.host._notifyChange();
    }

    // ── Syntax highlighting via Prism.js (lazy-loaded) ────────────────────────
    _highlightCodeBlock(wrap, block) {
        if (!block.lang || block.lang === 'plain') return;
        // Lazy-load Prism.js from CDN (only once)
        const doHighlight = () => {
            if (typeof Prism === 'undefined') return;
            const ed = wrap.querySelector('.spe-editable');
            if (!ed) return;
            const rawText = ed.textContent || '';
            const grammar = Prism.languages[block.lang] || Prism.languages.plaintext;
            if (!grammar) return;
            // We highlight into a read-only overlay — never modify the contenteditable
            let hlView = wrap.querySelector('.spe-code-hl-view');
            if (!hlView) {
                hlView = document.createElement('div');
                hlView.className = 'spe-code-hl-view';
                hlView.addEventListener('click', () => {
                    hlView.style.display = 'none';
                    ed.style.display = '';
                    ed.focus();
                });
                ed.addEventListener('blur', () => {
                    if (ed.textContent.trim() && block.lang && block.lang !== 'plain') {
                        // Re-highlight on blur
                        this._highlightCodeBlock(wrap, block);
                        hlView.style.display = '';
                        ed.style.display = 'none';
                    }
                });
                ed.after(hlView);
            }
            try {
                hlView.innerHTML = Prism.highlight(rawText, grammar, block.lang);
                hlView.style.display = '';
                ed.style.display = 'none';
            } catch {}
        };

        if (typeof Prism !== 'undefined') {
            doHighlight();
        } else if (!window._spe_prism_loading) {
            window._spe_prism_loading = true;
            // Load Prism CSS
            if (!document.getElementById('spe-prism-css')) {
                const link = document.createElement('link');
                link.id = 'spe-prism-css'; link.rel = 'stylesheet';
                link.href = 'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism-tomorrow.min.css';
                document.head.appendChild(link);
            }
            // Load Prism core + autoloader
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/prism.min.js';
            script.onload = () => {
                const al = document.createElement('script');
                al.src = 'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/plugins/autoloader/prism-autoloader.min.js';
                al.onload = () => {
                    window._spe_prism_loading = false;
                    doHighlight();
                };
                document.head.appendChild(al);
            };
            document.head.appendChild(script);
        } else {
            // Wait for loading to finish
            const poll = setInterval(() => {
                if (typeof Prism !== 'undefined') { clearInterval(poll); doHighlight(); }
            }, 100);
            setTimeout(() => clearInterval(poll), 5000);
        }
    }

    // Detect if clipboard HTML came from VS Code (has vscode-editor-* classes or data-vscode spans)
    _isVSCodeHTML(html) {
        return html && (
            html.includes('data-vscode') ||
            html.includes('vscode-editor') ||
            html.includes('class="mtk') ||  // VS Code's token classes
            html.includes('style="color:')  // VS Code pastes inline-colored spans
        );
    }

    // Extract highlighted HTML from VS Code paste — preserve spans with color styles
    _extractVSCodeHTML(html) {
        const div = document.createElement('div');
        div.innerHTML = html;
        // VS Code wraps code in <div> with spans. We want the inner spans.
        const pre = div.querySelector('pre') || div;
        // Walk and keep only spans with style="color:..." stripping everything else
        const clean = (node) => {
            const out = document.createElement('span');
            node.childNodes.forEach(child => {
                if (child.nodeType === Node.TEXT_NODE) {
                    out.appendChild(document.createTextNode(child.textContent));
                } else if (child.nodeType === Node.ELEMENT_NODE) {
                    const style = child.getAttribute('style') || '';
                    if (child.nodeName === 'SPAN' && style.includes('color')) {
                        const s = document.createElement('span');
                        // Keep only color / background-color style properties
                        const colorParts = style.split(';')
                            .filter(p => /^(color|background(-color)?)\s*:/i.test(p.trim()))
                            .join(';');
                        if (colorParts) s.setAttribute('style', colorParts);
                        s.appendChild(clean(child));
                        out.appendChild(s);
                    } else if (child.nodeName === 'BR') {
                        out.appendChild(document.createElement('br'));
                    } else {
                        out.appendChild(clean(child));
                    }
                }
            });
            return out;
        };
        return clean(pre).innerHTML;
    }

    // ── Table block ──────────────────────────────────────────────────────────
    _renderTableBlock(block) {
        if (!block.rows || !block.rows.length) {
            block.rows = [['',''],['','']];
        }
        const wrap = document.createElement('div');
        wrap.className = 'spe-table-wrap';

        const rebuild = () => {
            wrap.innerHTML = '';
            const table = document.createElement('table');
            table.className = 'spe-table';

            block.rows.forEach((row, ri) => {
                const tr = document.createElement('tr');
                row.forEach((cell, ci) => {
                    const td = document.createElement('td');
                    const inp = document.createElement('div');
                    inp.className = 'spe-table-cell';
                    inp.contentEditable = this.host._isReadonly() ? 'false' : 'true';
                    inp.innerHTML = cell || '';
                    inp.addEventListener('input', () => {
                        block.rows[ri][ci] = inp.innerHTML;
                        this.host._notifyChange();
                    });
                    inp.addEventListener('keydown', e => {
                        if (e.key === 'Tab') {
                            e.preventDefault();
                            const cells = wrap.querySelectorAll('.spe-table-cell');
                            const cur   = Array.from(cells).indexOf(inp);
                            const next  = cells[e.shiftKey ? cur - 1 : cur + 1];
                            if (next) next.focus();
                        }
                    });
                    td.appendChild(inp);
                    tr.appendChild(td);
                });

                if (!this.host._isReadonly()) {
                    const delRow = document.createElement('td');
                    delRow.className = 'spe-table-ctrl';
                    const btn = document.createElement('button');
                    btn.type = 'button'; btn.title = 'Delete row';
                    btn.innerHTML = '<i class="ph ph-trash"></i>';
                    btn.addEventListener('click', () => {
                        if (block.rows.length <= 1) return;
                        this.history.push(this.toJSON());
                        block.rows.splice(ri, 1);
                        rebuild();
                        this.host._notifyChange();
                    });
                    delRow.appendChild(btn);
                    tr.appendChild(delRow);
                }
                table.appendChild(tr);
            });
            wrap.appendChild(table);

            if (!this.host._isReadonly()) {
                const ctrl = document.createElement('div');
                ctrl.className = 'spe-table-toolbar';
                ctrl.innerHTML = `
                    <button type="button" class="spe-table-add-row"><i class="ph ph-plus"></i> Row</button>
                    <button type="button" class="spe-table-add-col"><i class="ph ph-plus"></i> Col</button>
                `;
                ctrl.querySelector('.spe-table-add-row').addEventListener('click', () => {
                    this.history.push(this.toJSON());
                    block.rows.push(new Array(block.rows[0].length).fill(''));
                    rebuild(); this.host._notifyChange();
                });
                ctrl.querySelector('.spe-table-add-col').addEventListener('click', () => {
                    this.history.push(this.toJSON());
                    block.rows.forEach(r => r.push(''));
                    rebuild(); this.host._notifyChange();
                });
                wrap.appendChild(ctrl);
            }
        };
        rebuild();
        return wrap;
    }

    // ── Columns block (resizable 2-col layout) ────────────────────────────────
    _renderColumnsBlock(block) {
        if (!block.colRatio) block.colRatio = 50;
        if (!Array.isArray(block.columns) || block.columns.length < 2) {
            block.columns = [
                [{ id: this._nid(), type: 'paragraph', content: '' }],
                [{ id: this._nid(), type: 'paragraph', content: '' }],
            ];
        }

        const host = this.host;
        const bm   = this;
        const wrap = document.createElement('div');
        wrap.className = 'spe-columns-wrap';

        const leftPct  = block.colRatio;
        const rightPct = 100 - leftPct;

        // ── Full-featured nested block renderer ──────────────────────────────
        const renderNestedBlock = (b, colIdx) => {
            const row = document.createElement('div');
            row.className = 'spe-block spe-nested-block';
            row.dataset.blockId  = b.id;
            row.dataset.blockType = b.type;

            // Gear button for nested block settings
            const gear = document.createElement('button');
            gear.type = 'button'; gear.className = 'spe-gear-btn';
            gear.title = 'Block options'; gear.innerHTML = '<i class="ph ph-dots-three"></i>';
            gear.addEventListener('click', e => {
                e.stopPropagation();
                // Open a simplified inline menu for nested blocks
                _openNestedMenu(b, colIdx, gear);
            });
            row.appendChild(gear);

            const content = document.createElement('div');
            content.className = 'spe-block-content';
            row.appendChild(content);

            // Render all block types — image, video, table, todo, code, headings, etc.
            bm._renderBlockContent(b, content);

            // Wire text editables
            const ed = content.querySelector('.spe-editable');
            if (ed && !host._isReadonly()) {
                ed.addEventListener('input', () => {
                    b.content = HTMLImporter.sanitizeInline(ed);
                    host._notifyChange();
                    // Feed to command menu for "/" detection
                    host.commandMenu?._activeBlockId !== b.id && (() => {})();
                    if (host.commandMenu) {
                        // Temporarily point command menu at this nested block
                        const origOnInput = host.commandMenu.onInput.bind(host.commandMenu);
                        host.commandMenu._blockId = b.id;
                        host.commandMenu._el = ed;
                        origOnInput(b, ed);
                    }
                });

                ed.addEventListener('keydown', e => {
                    const mod = e.ctrlKey || e.metaKey;

                    // Formatting
                    if (mod && e.key.toLowerCase() === 'b') { e.preventDefault(); document.execCommand('bold'); return; }
                    if (mod && e.key.toLowerCase() === 'i') { e.preventDefault(); document.execCommand('italic'); return; }
                    if (mod && e.key.toLowerCase() === 'u') { e.preventDefault(); document.execCommand('underline'); return; }
                    if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); host.selectionMenu?.promptLink(b, ed); return; }

                    // Ctrl+Enter = new block below in same column
                    if (e.key === 'Enter' && mod) {
                        e.preventDefault();
                        bm.history.push(bm.toJSON());
                        const newB = { id: bm._nid(), type: 'paragraph', content: '' };
                        const bi = block.columns[colIdx].indexOf(b);
                        block.columns[colIdx].splice(bi + 1, 0, newB);
                        const newRow = renderNestedBlock(newB, colIdx);
                        row.after(newRow);
                        host._notifyChange();
                        newRow.querySelector('.spe-editable')?.focus();
                        return;
                    }

                    // Enter in todo = new todo in column
                    if (e.key === 'Enter' && !mod && b.type === 'todo') {
                        e.preventDefault();
                        bm.history.push(bm.toJSON());
                        const newB = { id: bm._nid(), type: 'todo', content: '', checked: false };
                        const bi = block.columns[colIdx].indexOf(b);
                        block.columns[colIdx].splice(bi + 1, 0, newB);
                        const newRow = renderNestedBlock(newB, colIdx);
                        row.after(newRow);
                        host._notifyChange();
                        newRow.querySelector('.spe-editable')?.focus();
                        return;
                    }

                    // Backspace on empty = delete nested block (if more than 1 in column)
                    if (e.key === 'Backspace' && (ed.textContent || '').trim() === ''
                        && block.columns[colIdx].length > 1) {
                        e.preventDefault();
                        bm.history.push(bm.toJSON());
                        const bi = block.columns[colIdx].indexOf(b);
                        block.columns[colIdx].splice(bi, 1);
                        row.remove();
                        host._notifyChange();
                        return;
                    }
                });

                ed.addEventListener('focus', () => { host._activeBlockId = b.id; });

                // Selection toolbar
                const selChange = () => host.selectionMenu?.onChange(b, ed);
                ed.addEventListener('mouseup', selChange);
                ed.addEventListener('keyup', e => {
                    if (e.shiftKey || ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) selChange();
                });

                // Slash command menu — position relative to rootEl
                ed.addEventListener('input', () => host.commandMenu?.onInput(b, ed));
            }

            // Wire drag-and-drop for image/video blocks inside columns
            const mediaEmpty = content.querySelector('.spe-media-drop-zone');
            if (mediaEmpty) {
                mediaEmpty.addEventListener('dragover', e => { e.preventDefault(); mediaEmpty.classList.add('spe-drop-active'); });
                mediaEmpty.addEventListener('dragleave', () => mediaEmpty.classList.remove('spe-drop-active'));
                mediaEmpty.addEventListener('drop', e => {
                    e.preventDefault(); mediaEmpty.classList.remove('spe-drop-active');
                    const file = e.dataTransfer?.files?.[0];
                    if (file && file.type.startsWith('image/')) {
                        const mediaWrap = content.querySelector('.spe-media-block') || document.createElement('div');
                        bm._uploadOrReadFile(b, file, mediaWrap);
                    }
                });
            }

            return row;
        };

        // ── Simplified inline context menu for nested blocks ─────────────────
        const _openNestedMenu = (b, colIdx, anchor) => {
            // Remove any existing menu
            wrap.querySelectorAll('.spe-nested-menu').forEach(m => m.remove());
            const menu = document.createElement('div');
            menu.className = 'spe-nested-menu';
            const rect = anchor.getBoundingClientRect();
            const wrapRect = host.rootEl.getBoundingClientRect();
            menu.style.cssText = `position:absolute;z-index:210;top:${rect.bottom - wrapRect.top + 4}px;left:${rect.left - wrapRect.left}px;`;
            menu.innerHTML = `
                <div class="spe-nm-header">Change type</div>
                ${['paragraph','heading1','heading2','heading3','todo','quote','code','callout','image','video'].map(type => `
                    <button type="button" class="spe-nm-item${b.type === type ? ' active' : ''}" data-type="${type}">
                        <i class="ph ph-${BLOCK_TYPES[type].icon}"></i> ${BLOCK_TYPES[type].label}
                    </button>
                `).join('')}
                <div class="spe-nm-sep"></div>
                <button type="button" class="spe-nm-delete"><i class="ph ph-trash"></i> Delete</button>
            `;
            host.rootEl.appendChild(menu);

            menu.querySelectorAll('.spe-nm-item[data-type]').forEach(btn => {
                btn.addEventListener('click', () => {
                    bm.history.push(bm.toJSON());
                    const newType = btn.dataset.type;
                    b.type = newType;
                    if (newType === 'todo') b.checked = false;
                    else { delete b.checked; delete b.src; }
                    const blockRow = wrap.querySelector(`[data-block-id="${b.id}"]`);
                    if (blockRow) {
                        const newRow = renderNestedBlock(b, colIdx);
                        blockRow.replaceWith(newRow);
                    }
                    host._notifyChange();
                    menu.remove();
                });
            });
            menu.querySelector('.spe-nm-delete')?.addEventListener('click', () => {
                if (block.columns[colIdx].length <= 1) { menu.remove(); return; }
                bm.history.push(bm.toJSON());
                const bi = block.columns[colIdx].indexOf(b);
                block.columns[colIdx].splice(bi, 1);
                wrap.querySelector(`[data-block-id="${b.id}"]`)?.remove();
                host._notifyChange();
                menu.remove();
            });
            // Close on outside click
            setTimeout(() => {
                const close = e => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('mousedown', close); } };
                document.addEventListener('mousedown', close);
            }, 10);
        };

        // ── Column renderer ──────────────────────────────────────────────────
        const renderCol = (colBlocks, colIdx, flexPct) => {
            const col = document.createElement('div');
            col.className = 'spe-column';
            col.style.flex = `0 0 calc(${flexPct}% - 4px)`;
            col.dataset.colIdx = colIdx;

            colBlocks.forEach(b => col.appendChild(renderNestedBlock(b, colIdx)));

            if (!host._isReadonly()) {
                // "+" button to add a block via mini menu
                const addBtn = document.createElement('button');
                addBtn.type = 'button'; addBtn.className = 'spe-col-add-btn';
                addBtn.innerHTML = '<i class="ph ph-plus"></i> Add block';
                addBtn.addEventListener('click', () => {
                    // Show a mini type picker
                    wrap.querySelectorAll('.spe-col-type-picker').forEach(p => p.remove());
                    const picker = document.createElement('div');
                    picker.className = 'spe-col-type-picker';
                    const pickerRect = addBtn.getBoundingClientRect();
                    const wrapRect   = host.rootEl.getBoundingClientRect();
                    picker.style.cssText = `position:absolute;z-index:210;top:${pickerRect.bottom - wrapRect.top + 4}px;left:${pickerRect.left - wrapRect.left}px;`;

                    const types = [
                        { type: 'paragraph',  label: 'Text',     icon: 'text-aa' },
                        { type: 'heading1',   label: 'Heading 1',icon: 'text-h-one' },
                        { type: 'heading2',   label: 'Heading 2',icon: 'text-h-two' },
                        { type: 'heading3',   label: 'Heading 3',icon: 'text-h-three' },
                        { type: 'todo',       label: 'To-do',    icon: 'check-square' },
                        { type: 'quote',      label: 'Quote',    icon: 'quotes' },
                        { type: 'code',       label: 'Code',     icon: 'code' },
                        { type: 'callout',    label: 'Callout',  icon: 'warning' },
                        { type: 'image',      label: 'Image',    icon: 'image' },
                        { type: 'video',      label: 'Video',    icon: 'film-strip' },
                        { type: 'divider',    label: 'Divider',  icon: 'minus' },
                    ];

                    picker.innerHTML = `<div class="spe-nm-header">Add to column</div>` +
                        types.map(t => `<button type="button" class="spe-nm-item" data-type="${t.type}">
                            <i class="ph ph-${t.icon}"></i> ${t.label}
                        </button>`).join('');
                    host.rootEl.appendChild(picker);

                    picker.querySelectorAll('.spe-nm-item').forEach(btn => {
                        btn.addEventListener('click', () => {
                            bm.history.push(bm.toJSON());
                            const extra = btn.dataset.type === 'todo' ? { checked: false }
                                        : btn.dataset.type === 'callout' ? { calloutIcon: '💡' } : {};
                            const newB = { id: bm._nid(), type: btn.dataset.type, content: '', ...extra };
                            block.columns[colIdx].push(newB);
                            const newRow = renderNestedBlock(newB, colIdx);
                            col.insertBefore(newRow, addBtn);
                            host._notifyChange();
                            newRow.querySelector('.spe-editable')?.focus();
                            picker.remove();
                        });
                    });
                    setTimeout(() => {
                        const close = e => { if (!picker.contains(e.target) && e.target !== addBtn) { picker.remove(); document.removeEventListener('mousedown', close); } };
                        document.addEventListener('mousedown', close);
                    }, 10);
                });
                col.appendChild(addBtn);

                // Column-level drag-and-drop for images
                col.addEventListener('dragover', e => { if (e.dataTransfer?.types.includes('Files')) { e.preventDefault(); col.classList.add('spe-col-drag-over'); } });
                col.addEventListener('dragleave', () => col.classList.remove('spe-col-drag-over'));
                col.addEventListener('drop', e => {
                    e.preventDefault(); col.classList.remove('spe-col-drag-over');
                    const file = e.dataTransfer?.files?.[0];
                    if (!file || !file.type.startsWith('image/')) return;
                    bm.history.push(bm.toJSON());
                    const newB = { id: bm._nid(), type: 'image', content: '' };
                    block.columns[colIdx].push(newB);
                    const newRow = renderNestedBlock(newB, colIdx);
                    col.insertBefore(newRow, addBtn);
                    host._notifyChange();
                    // Trigger upload
                    const mediaWrap = newRow.querySelector('.spe-media-block') || document.createElement('div');
                    bm._uploadOrReadFile(newB, file, mediaWrap);
                });
            }
            return col;
        };

        const leftCol  = renderCol(block.columns[0], 0, leftPct);
        const rightCol = renderCol(block.columns[1], 1, rightPct);

        // ── Resizable divider ────────────────────────────────────────────────
        const divider = document.createElement('div');
        divider.className = 'spe-col-divider';
        divider.title = 'Drag to resize columns';
        divider.innerHTML = '<div class="spe-col-divider-bar"></div>';

        if (!host._isReadonly()) {
            let _dragging = false, _startX = 0, _startRatio = 0;
            divider.addEventListener('pointerdown', e => {
                _dragging = true; _startX = e.clientX; _startRatio = block.colRatio;
                divider.setPointerCapture(e.pointerId);
                divider.classList.add('spe-col-divider-active');
                e.preventDefault();
            });
            divider.addEventListener('pointermove', e => {
                if (!_dragging) return;
                const wrapW = wrap.offsetWidth || 600;
                const delta    = e.clientX - _startX;
                const deltaPct = (delta / wrapW) * 100;
                const newRatio = Math.max(20, Math.min(80, _startRatio + deltaPct));
                block.colRatio = Math.round(newRatio);
                leftCol.style.flex  = `0 0 calc(${block.colRatio}% - 4px)`;
                rightCol.style.flex = `0 0 calc(${100 - block.colRatio}% - 4px)`;
            });
            divider.addEventListener('pointerup', () => {
                if (!_dragging) return;
                _dragging = false;
                divider.classList.remove('spe-col-divider-active');
                host._notifyChange();
            });
        }

        wrap.appendChild(leftCol);
        wrap.appendChild(divider);
        wrap.appendChild(rightCol);
        return wrap;
    }

    // ── Bookmark block (link preview card) ────────────────────────────────────
    _renderBookmarkBlock(block) {
        const wrap = document.createElement('div');
        wrap.className = 'spe-bookmark-block';

        if (block.src) {
            // Render the preview card — data may already be fetched
            const renderCard = () => {
                wrap.innerHTML = '';
                const card = document.createElement('a');
                card.href   = block.src;
                card.target = '_blank';
                card.rel    = 'noopener noreferrer';
                card.className = 'spe-bookmark-card';
                card.innerHTML = `
                    <div class="spe-bookmark-body">
                        <div class="spe-bookmark-title">${this._esc(block.bmTitle || block.src)}</div>
                        ${block.bmDesc ? `<div class="spe-bookmark-desc">${this._esc(block.bmDesc)}</div>` : ''}
                        <div class="spe-bookmark-url">
                            ${block.bmFavicon ? `<img src="${this._esc(block.bmFavicon)}" class="spe-bookmark-favicon" alt="">` : '<i class="ph ph-link" style="font-size:0.8rem"></i>'}
                            <span>${this._esc(block.src)}</span>
                        </div>
                    </div>
                    ${block.bmImage ? `<div class="spe-bookmark-thumb"><img src="${this._esc(block.bmImage)}" alt=""></div>` : ''}
                `;

                if (!this.host._isReadonly()) {
                    // Toggle: allow switching between card and plain link
                    const controls = document.createElement('div');
                    controls.className = 'spe-bookmark-controls';
                    const removeBtn = document.createElement('button');
                    removeBtn.type = 'button'; removeBtn.className = 'spe-bookmark-remove';
                    removeBtn.innerHTML = '<i class="ph ph-x"></i>';
                    removeBtn.title = 'Remove bookmark';
                    removeBtn.addEventListener('click', e => {
                        e.preventDefault(); e.stopPropagation();
                        this.history.push(this.toJSON());
                        block.src = ''; block.bmTitle = ''; block.bmDesc = ''; block.bmImage = ''; block.bmFavicon = '';
                        this._renderBlockContent(block, wrap.parentElement);
                        this.host._notifyChange();
                    });
                    controls.appendChild(removeBtn);
                    wrap.appendChild(card);
                    wrap.appendChild(controls);
                } else {
                    wrap.appendChild(card);
                }

                // Lazy-fetch metadata if not yet loaded
                if (!block.bmTitle) {
                    this._fetchBookmarkMeta(block, wrap);
                }
            };
            renderCard();
        } else {
            // Empty state: URL input
            wrap.innerHTML = `
                <div class="spe-bookmark-empty">
                    <i class="ph ph-link"></i>
                    <div>
                        <div class="spe-bookmark-empty-title">Link Preview</div>
                        <div class="spe-bookmark-empty-hint">Paste a URL to create a preview card</div>
                    </div>
                </div>
                <div class="spe-media-inputs">
                    <input class="spe-url-input" placeholder="Paste URL and press Enter…" type="url">
                </div>
                <div class="spe-bookmark-loading sc-hidden">
                    <i class="ph ph-spinner" style="animation:spe-spin 1s linear infinite"></i>
                    <span>Fetching preview…</span>
                </div>
            `;
            const urlInp = wrap.querySelector('.spe-url-input');
            urlInp.addEventListener('keydown', async e => {
                if (e.key !== 'Enter') return;
                const url = urlInp.value.trim();
                if (!url) return;
                e.preventDefault();
                wrap.querySelector('.spe-bookmark-loading')?.classList.remove('sc-hidden');
                urlInp.disabled = true;
                this.history.push(this.toJSON());
                block.src = url;
                await this._fetchBookmarkMeta(block, null);
                const blockEl = this._el(block.id);
                if (blockEl) this._renderBlockContent(block, blockEl.querySelector('.spe-block-content'));
                this.host._notifyChange();
            });
        }
        return wrap;
    }

    async _fetchBookmarkMeta(block, wrap) {
        // Use microlink.io — free, no API key needed (100 req/day without key, more with)
        try {
            const apiUrl = `https://api.microlink.io?url=${encodeURIComponent(block.src)}&screenshot=false`;
            const resp = await fetch(apiUrl, { signal: AbortSignal.timeout?.(5000) });
            if (!resp.ok) return;
            const data = await resp.json();
            if (data.status !== 'success') return;
            const d = data.data;
            block.bmTitle   = d.title   || block.src;
            block.bmDesc    = d.description || '';
            block.bmImage   = d.image?.url  || '';
            block.bmFavicon = d.logo?.url   || d.icon?.url || '';
            // Re-render the block if wrap provided
            if (wrap) {
                const blockEl = this._el(block.id);
                if (blockEl) this._renderBlockContent(block, blockEl.querySelector('.spe-block-content'));
            }
            this.host._notifyChange();
        } catch {
            // Silently fail — card still shows URL
        }
    }
    _makeEditable(block) {
        const cfg = BLOCK_TYPES[block.type] || BLOCK_TYPES.paragraph;
        const tag = (block.type === 'todo' || block.type === 'code' || block.type === 'callout') ? 'div'
                  : (cfg.tag || 'p');
        const el  = document.createElement(tag);
        el.className = 'spe-editable';
        el.dataset.placeholder = cfg.placeholder || '';
        el.innerHTML = block.content || '';

        this._applyBlockStyles(el, block);

        if (!this.host._isReadonly()) {
            el.contentEditable = 'true';
            el.spellcheck      = true;
            this._wireEditable(el, block);
        }
        return el;
    }

    _applyBlockStyles(el, block) {
        const styles = [];
        if (block.align)     styles.push(`text-align:${block.align}`);
        if (block.fontSize)  styles.push(`font-size:${{sm:'0.8rem',md:'1rem',lg:'1.25rem',xl:'1.6rem'}[block.fontSize]||'1rem'}`);
        if (block.textColor) styles.push(`color:${block.textColor}`);
        if (block.bgColor && block.bgColor !== 'transparent') styles.push(`background:${block.bgColor}`);
        el.style.cssText = styles.join(';');
    }

    _wireEditable(el, block) {
        el.addEventListener('compositionstart', () => { this._composing = true;  });
        el.addEventListener('compositionend',   () => { this._composing = false; });

        el.addEventListener('input', () => {
            block.content = HTMLImporter.sanitizeInline(el);
            this._checkMarkdown(block, el);
            this.host._notifyChange();
            this.host.commandMenu?.onInput(block, el);
        });

        el.addEventListener('keydown', e => this._keydown(e, block, el));
        el.addEventListener('paste',   e => this._paste(e, block, el));
        el.addEventListener('focus',   () => { this.host._activeBlockId = block.id; });

        const selChange = () => this.host.selectionMenu?.onChange(block, el);
        el.addEventListener('mouseup', selChange);
        el.addEventListener('keyup',   e => {
            if (e.shiftKey || ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))
                selChange();
        });
    }

    _checkMarkdown(block, el) {
        if (block.type !== 'paragraph') return;
        const text = el.textContent || '';
        for (const type of Object.keys(BLOCK_TYPES)) {
            const cfg = BLOCK_TYPES[type];
            if (!cfg.shortcut) continue;
            if (cfg.shortcut.test(text)) {
                const stripped = text.replace(cfg.shortcut, '');
                this.history.push(this.toJSON());
                block.content = stripped;
                const extra = type === 'todo' ? { checked: false } : {};
                this._convertBlock(block, type, extra, true);
                return;
            }
        }
    }

    _keydown(e, block, el) {
        if (this._composing) return;
        const mod = e.ctrlKey || e.metaKey;

        if (mod && e.key.toLowerCase() === 'b') { e.preventDefault(); document.execCommand('bold');      return; }
        if (mod && e.key.toLowerCase() === 'i') { e.preventDefault(); document.execCommand('italic');    return; }
        if (mod && e.key.toLowerCase() === 'u') { e.preventDefault(); document.execCommand('underline'); return; }
        if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); this.host.selectionMenu?.promptLink(block, el); return; }

        if (mod && !e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); this.host.undo(); return; }
        if (mod && (e.shiftKey && e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'y')) {
            e.preventDefault(); this.host.redo(); return;
        }

        if (mod && e.key.toLowerCase() === 'd') {
            e.preventDefault();
            this._duplicateBlock(block);
            return;
        }

        if (e.key === 'Enter') {
            if (this.host.commandMenu?.isOpen) return;
            if (mod) {
                e.preventDefault();
                this._split(block, el);
            } else {
                // FIX #6: Enter in code/todo inserts newline; Ctrl+Enter creates new block
                if (block.type === 'code') {
                    e.preventDefault();
                    document.execCommand('insertText', false, '\n');
                } else if (block.type === 'todo') {
                    e.preventDefault();
                    // Enter in todo = new todo block
                    const newBlock = this.insertAfter(block.id, 'todo', { checked: false });
                    requestAnimationFrame(() => this._focusBlock(newBlock.id, 'start'));
                    return;
                } else {
                    e.preventDefault();
                    document.execCommand('insertLineBreak');
                }
                block.content = HTMLImporter.sanitizeInline(el);
                this.host._notifyChange();
            }
            return;
        }

        if (e.key === 'Backspace') {
            if (this.host.commandMenu?.isOpen) { this.host.commandMenu.close(); return; }
            const isEmpty  = (el.textContent || '').trim() === '' && el.innerHTML.replace(/<br\s*\/?>/gi,'').trim() === '';
            const atStart  = this._atVeryStart(el);
            if (isEmpty) {
                e.preventDefault();
                this._deleteBlock(block);
                return;
            }
            if (atStart) {
                e.preventDefault();
                this._mergeWithPrev(block, el);
                return;
            }
            return;
        }

        if (e.key === 'Delete' && (el.textContent || '').trim() === '') {
            e.preventDefault();
            this._deleteBlock(block);
            return;
        }

        if (e.key === 'ArrowUp' && this._atVeryStart(el)) {
            e.preventDefault(); this._focusBlock(this._prevId(block.id), 'end'); return;
        }
        if (e.key === 'ArrowDown' && this._atVeryEnd(el)) {
            e.preventDefault(); this._focusBlock(this._nextId(block.id), 'start'); return;
        }

        if (e.key === 'Tab') {
            e.preventDefault();
            e.shiftKey ? this._outdent(block) : this._indent(block);
            return;
        }
    }

    _paste(e, block, el) {
        // ── Image paste ───────────────────────────────────────────────────────
        const items = e.clipboardData?.items;
        if (items) {
            for (const item of items) {
                if (item.type.startsWith('image/')) {
                    e.preventDefault();
                    const file = item.getAsFile();
                    if (file) {
                        const imgBlock = this.insertAfter(block.id, 'image', {});
                        const wrap = this._el(imgBlock.id)?.querySelector('.spe-block-content');
                        this._uploadOrReadFile(imgBlock, file, wrap?.querySelector('.spe-media-block') || document.createElement('div'));
                    }
                    return;
                }
            }
        }

        // ── VSCode HTML paste into code blocks ────────────────────────────────
        if (block.type === 'code') {
            const htmlData = e.clipboardData?.getData('text/html') || '';
            if (htmlData && this._isVSCodeHTML(htmlData)) {
                e.preventDefault();
                const plain = (e.clipboardData?.getData('text/plain') || '').replace(/\r\n/g, '\n');
                const highlighted = this._extractVSCodeHTML(htmlData);
                this.history.push(this.toJSON());
                block.content = this._esc(plain);
                block.highlightedHTML = highlighted;
                el.textContent = plain;
                // Re-render block to show highlighted view
                const blockEl = this._el(block.id);
                if (blockEl) this._renderBlockContent(block, blockEl.querySelector('.spe-block-content'));
                this.host._notifyChange();
                return;
            }
        }

        const text = (e.clipboardData || window.clipboardData)?.getData('text/plain');
        if (!text) return;

        // ── URL paste: offer bookmark block ───────────────────────────────────
        if (/^https?:\/\/\S+$/.test(text.trim()) && block.type === 'paragraph') {
            const cleanUrl = text.trim();
            // Show a small inline prompt: create link or bookmark
            e.preventDefault();
            // Insert as link by default; Shift+Enter would have made bookmark
            // We do smart detection: if the paragraph is empty, offer bookmark
            const isEmpty = (el.textContent || '').trim() === '';
            if (isEmpty) {
                // Empty paragraph + URL paste → convert to bookmark
                this.history.push(this.toJSON());
                block.type = 'bookmark'; block.src = cleanUrl; block.content = '';
                const blockEl = this._el(block.id);
                if (blockEl) {
                    blockEl.dataset.blockType = 'bookmark';
                    this._renderBlockContent(block, blockEl.querySelector('.spe-block-content'));
                }
                this._fetchBookmarkMeta(block, null);
                this.host._notifyChange();
                return;
            }
            // Non-empty paragraph: insert as hyperlink
            const a = document.createElement('a');
            a.href = cleanUrl; a.target = '_blank'; a.rel = 'noopener noreferrer';
            a.textContent = cleanUrl;
            this._insertAtCaret(a);
            block.content = HTMLImporter.sanitizeInline(el);
            this.host._notifyChange();
            return;
        }

        e.preventDefault();
        document.execCommand('insertText', false, text);
        block.content = HTMLImporter.sanitizeInline(el);
        this.host._notifyChange();
    }

    _insertAtCaret(node) {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;
        const r = sel.getRangeAt(0);
        r.deleteContents();
        r.insertNode(node);
        r.setStartAfter(node); r.collapse(true);
        sel.removeAllRanges(); sel.addRange(r);
    }

    _atVeryStart(el) {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount || !sel.isCollapsed) return false;
        const r = sel.getRangeAt(0);
        const p = r.cloneRange(); p.selectNodeContents(el); p.setEnd(r.startContainer, r.startOffset);
        return p.toString().length === 0;
    }

    _atVeryEnd(el) {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount || !sel.isCollapsed) return false;
        const r = sel.getRangeAt(0);
        const p = r.cloneRange(); p.selectNodeContents(el); p.setStart(r.endContainer, r.endOffset);
        return p.toString().length === 0;
    }

    _placeCaret(el, where) {
        if (!el) return;
        el.focus();
        const sel = window.getSelection();
        const r   = document.createRange();
        r.selectNodeContents(el);
        r.collapse(where !== 'end');
        sel.removeAllRanges(); sel.addRange(r);
    }

    _prevId(id) { const i = this._idx(id); return i > 0 ? this.blocks[i-1].id : null; }
    _nextId(id) { const i = this._idx(id); return i < this.blocks.length-1 ? this.blocks[i+1].id : null; }

    _focusBlock(id, where = 'start') {
        if (!id) return;
        const block = this._block(id);
        if (!block) return;
        if (!BLOCK_TYPES[block.type]?.isText) {
            this._el(id)?.focus();
            return;
        }
        const el = this._editable(id);
        if (el) this._placeCaret(el, where);
        this.host._activeBlockId = id;
    }

    insertAfter(afterId, type = 'paragraph', extra = {}) {
        this.history.push(this.toJSON());
        const block = { id: this._nid(), type, content: '', ...extra };
        const i = afterId != null ? this._idx(afterId) : this.blocks.length - 1;
        this.blocks.splice(i + 1, 0, block);
        const ref = afterId != null ? this._el(afterId) : this.container.lastElementChild;
        const newEl = this._renderBlock(block);
        if (ref?.nextSibling) ref.nextSibling.before(newEl);
        else this.container.appendChild(newEl);
        this.host._notifyChange();
        return block;
    }

    _duplicateBlock(block) {
        this.history.push(this.toJSON());
        const copy = { ...JSON.parse(JSON.stringify(block)), id: this._nid() };
        const i = this._idx(block.id);
        this.blocks.splice(i + 1, 0, copy);
        const ref = this._el(block.id);
        const newEl = this._renderBlock(copy);
        if (ref?.nextSibling) ref.nextSibling.before(newEl);
        else this.container.appendChild(newEl);
        this.host._notifyChange();
        requestAnimationFrame(() => this._focusBlock(copy.id, 'end'));
    }

    _deleteBlock(block) {
        const prevId = this._prevId(block.id);
        const nextId = this._nextId(block.id);
        const focusId = prevId || nextId;

        this.history.push(this.toJSON());
        const i = this._idx(block.id);
        if (i === -1) return;
        this.blocks.splice(i, 1);
        this._el(block.id)?.remove();

        if (!this.blocks.length) {
            const fresh = this._emptyPara();
            this.blocks.push(fresh);
            this.container.appendChild(this._renderBlock(fresh));
            this._focusBlock(fresh.id, 'start');
        } else {
            this._focusBlock(focusId || this.blocks[0].id, prevId ? 'end' : 'start');
        }
        this.host._notifyChange();
    }

    _split(block, el) {
        const sel = window.getSelection();
        let beforeHTML = el.innerHTML, afterHTML = '';

        if (sel && sel.rangeCount) {
            const r  = sel.getRangeAt(0);
            const bR = r.cloneRange(); bR.selectNodeContents(el); bR.setEnd(r.startContainer, r.startOffset);
            const aR = r.cloneRange(); aR.selectNodeContents(el); aR.setStart(r.endContainer, r.endOffset);
            const bD = document.createElement('div'); bD.appendChild(bR.cloneContents()); beforeHTML = bD.innerHTML;
            const aD = document.createElement('div'); aD.appendChild(aR.cloneContents()); afterHTML  = aD.innerHTML;
        }

        this.history.push(this.toJSON());

        const bNode = document.createElement('div'); bNode.innerHTML = beforeHTML;
        const aNode = document.createElement('div'); aNode.innerHTML = afterHTML;
        block.content = HTMLImporter.sanitizeInline(bNode);
        el.innerHTML  = block.content;

        const keepType = ['todo','quote','code','callout'].includes(block.type) ? block.type : 'paragraph';
        const extra    = keepType === 'todo' ? { checked: false } : {};
        const newBlock = { id: this._nid(), type: keepType, content: HTMLImporter.sanitizeInline(aNode), ...extra };

        const i = this._idx(block.id);
        this.blocks.splice(i + 1, 0, newBlock);
        const newEl = this._renderBlock(newBlock);
        this._el(block.id).after(newEl);

        this.host._notifyChange();
        requestAnimationFrame(() => this._focusBlock(newBlock.id, 'start'));
    }

    _mergeWithPrev(block, el) {
        const prevId = this._prevId(block.id);
        if (!prevId) return;
        const prev   = this._block(prevId);
        if (!prev || !BLOCK_TYPES[prev.type]?.isText) return;

        const prevEl = this._editable(prevId);
        if (!prevEl) return;

        const prevLen = (prevEl.textContent || '').length;

        this.history.push(this.toJSON());
        prev.content = (prev.content || '') + (block.content || '');
        prevEl.innerHTML = prev.content;

        const i = this._idx(block.id);
        this.blocks.splice(i, 1);
        this._el(block.id)?.remove();

        this.host._notifyChange();
        requestAnimationFrame(() => {
            prevEl.focus();
            try {
                const sel = window.getSelection();
                const r   = document.createRange();
                let node  = prevEl, offset = 0;
                const walk = (n, rem) => {
                    if (n.nodeType === Node.TEXT_NODE) {
                        if (rem <= n.length) { node = n; offset = rem; return 0; }
                        return rem - n.length;
                    }
                    for (const c of n.childNodes) { rem = walk(c, rem); if (rem === 0) return 0; }
                    return rem;
                };
                walk(prevEl, prevLen);
                r.setStart(node, offset); r.collapse(true);
                sel.removeAllRanges(); sel.addRange(r);
            } catch { this._placeCaret(prevEl, 'end'); }
        });
    }

    convertBlock(id, newType, extra = {}) {
        const block = this._block(id);
        if (!block || !BLOCK_TYPES[newType]) return;
        this.history.push(this.toJSON());
        this._convertBlock(block, newType, extra, false);
    }

    _convertBlock(block, newType, extra = {}, skipHistory = false) {
        if (!skipHistory) this.history.push(this.toJSON());
        block.type = newType;
        if (newType !== 'todo') delete block.checked;
        Object.assign(block, extra);
        const oldEl = this._el(block.id);
        if (!oldEl) return;
        const newEl = this._renderBlock(block);
        oldEl.replaceWith(newEl);
        this.host._notifyChange();
        requestAnimationFrame(() => this._focusBlock(block.id, 'end'));
    }

    _indent(block) {
        block.indent = Math.min((block.indent || 0) + 1, 6);
        const el = this._el(block.id);
        if (el) el.style.marginLeft = `${block.indent * 1.5}rem`;
        this.host._notifyChange();
    }

    _outdent(block) {
        block.indent = Math.max((block.indent || 0) - 1, 0);
        const el = this._el(block.id);
        if (el) el.style.marginLeft = block.indent ? `${block.indent * 1.5}rem` : '';
        this.host._notifyChange();
    }

    reorder(id, afterId) {
        const fi = this._idx(id);
        if (fi === -1) return;
        this.history.push(this.toJSON());
        const [moved] = this.blocks.splice(fi, 1);
        const ti = afterId === null ? 0 : this._idx(afterId) + 1;
        this.blocks.splice(ti, 0, moved);
        this.host._notifyChange();
    }

    applyStyle(id, props) {
        const block = this._block(id);
        if (!block) return;
        this.history.push(this.toJSON());
        Object.assign(block, props);
        const ed = this._editable(id);
        if (ed) this._applyBlockStyles(ed, block);
        this.host._notifyChange();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  CommandMenu
// ─────────────────────────────────────────────────────────────────────────────
class CommandMenu {
    constructor(host) {
        this.host     = host;
        this.isOpen   = false;
        this._blockId = null;
        this._el      = null;
        this._query   = '';
        this._items   = [...COMMAND_ORDER];
        this._cursor  = 0;
        this._mode    = 'slash';

        this.el = document.createElement('div');
        this.el.className = 'spe-cmd-menu sc-hidden';
        this.el.setAttribute('role', 'listbox');
        host.rootEl.appendChild(this.el);

        this._keydown = e => this._handleKey(e);
        document.addEventListener('keydown', this._keydown, true);

        this._clickAway = e => { if (this.isOpen && !this.el.contains(e.target)) this.close(); };
        document.addEventListener('mousedown', this._clickAway);
    }

    destroy() {
        document.removeEventListener('keydown', this._keydown, true);
        document.removeEventListener('mousedown', this._clickAway);
        this.el.remove();
    }

    onInput(block, el) {
        if (this.host._isReadonly()) return;
        const m = this._slashMatch(el);
        if (!m) { if (this.isOpen && this._mode === 'slash') this.close(); return; }
        this._open(block.id, el, m.query, 'slash');
    }

    openTurnInto(blockId, el, anchorEl) {
        this._open(blockId, el, '', 'turninto', anchorEl);
    }

    _slashMatch(el) {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount || !sel.isCollapsed) return null;

        const r  = sel.getRangeAt(0);
        const pr = r.cloneRange();
        pr.selectNodeContents(el);
        pr.setEnd(r.startContainer, r.startOffset);
        const textBefore = pr.toString();

        const line = textBefore.split(/\n/).pop() || '';
        const m    = line.match(/\/([a-zA-Z0-9 ]*)$/);
        return m ? { query: m[1] } : null;
    }

    _open(blockId, el, query, mode, anchorEl = null) {
        this._blockId = blockId;
        this._el      = el;
        this._query   = query;
        this._mode    = mode;
        this._cursor  = 0;
        this._filter(query);
        if (!this._items.length) { this.close(); return; }
        this._render();
        this._position(anchorEl || el);
        this.isOpen = true;
        this.el.classList.remove('sc-hidden');
    }

    _filter(q) {
        const lq = (q||'').toLowerCase();
        this._items = COMMAND_ORDER.filter(t => {
            const label = BLOCK_TYPES[t].label.toLowerCase();
            if (!lq) return true;
            // Fuzzy: every char of query appears in order in label
            let li = 0;
            for (const ch of lq) {
                const idx = label.indexOf(ch, li);
                if (idx === -1) return false;
                li = idx + 1;
            }
            return true;
        });
    }

    _render() {
        this.el.innerHTML = '';
        const header = document.createElement('div');
        header.className = 'spe-cmd-header';
        header.textContent = this._mode === 'turninto' ? 'Turn into' : 'Block type';
        this.el.appendChild(header);

        this._items.forEach((type, i) => {
            const cfg  = BLOCK_TYPES[type];
            const item = document.createElement('button');
            item.type  = 'button';
            item.className = 'spe-cmd-item' + (i === this._cursor ? ' spe-cmd-active' : '');
            item.setAttribute('role', 'option');
            item.innerHTML = `<i class="ph ph-${cfg.icon}"></i><span>${cfg.label}</span>`;
            item.addEventListener('mousedown', e => { e.preventDefault(); this._select(type); });
            this.el.appendChild(item);
        });

        if (this._mode === 'slash' && !this._query) {
            const sep = document.createElement('div');
            sep.className = 'spe-cmd-sep';
            sep.textContent = 'Alignment';
            this.el.appendChild(sep);

            ALIGN_OPTIONS.forEach(opt => {
                const item = document.createElement('button');
                item.type  = 'button';
                item.className = 'spe-cmd-item';
                item.innerHTML = `<i class="ph ph-${opt.icon}"></i><span>${opt.label}</span>`;
                item.addEventListener('mousedown', e => {
                    e.preventDefault();
                    const block = this.host.blockManager._block(this._blockId);
                    if (block) this.host.blockManager.applyStyle(block.id, { align: opt.value });
                    this.close();
                });
                this.el.appendChild(item);
            });
        }
    }

    _position(refEl) {
        const sel  = window.getSelection();
        let rect   = refEl.getBoundingClientRect();
        if (sel && sel.rangeCount && refEl === this._el) {
            const cr = sel.getRangeAt(0).getClientRects()[0];
            if (cr) rect = cr;
        }
        const hostRect = this.host.rootEl.getBoundingClientRect();
        const top  = rect.bottom - hostRect.top + 4;
        let   left = rect.left   - hostRect.left;

        const menuW = 200;
        const maxL  = hostRect.width - menuW - 8;
        this.el.style.top  = `${top}px`;
        this.el.style.left = `${Math.min(left, maxL)}px`;
    }

    _handleKey(e) {
        if (!this.isOpen) return;
        if (e.key === 'ArrowDown') { e.preventDefault(); this._cursor = (this._cursor + 1) % this._items.length; this._render(); return; }
        if (e.key === 'ArrowUp')   { e.preventDefault(); this._cursor = (this._cursor - 1 + this._items.length) % this._items.length; this._render(); return; }
        if (e.key === 'Enter')     { e.preventDefault(); this._select(this._items[this._cursor]); return; }
        if (e.key === 'Escape')    { e.preventDefault(); this.close(); return; }
    }

    _select(type) {
        const block = this.host.blockManager._block(this._blockId);
        if (!block || !type) { this.close(); return; }

        if (this._mode === 'slash' && this._el) {
            const text    = this._el.textContent || '';
            const stripped = text.replace(/\/[a-zA-Z0-9 ]*$/, '');
            block.content  = stripped;
            this._el.innerHTML = stripped;
        }

        const extra = type === 'todo' ? { checked: false } : {};
        this.host.blockManager.convertBlock(block.id, type, extra);
        this.close();
    }

    close() {
        this.isOpen   = false;
        this._blockId = null;
        this._el      = null;
        this.el.classList.add('sc-hidden');
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  SelectionMenu
// ─────────────────────────────────────────────────────────────────────────────
class SelectionMenu {
    constructor(host) {
        this.host = host;
        this._block = null; this._el = null; this._hidden = true;

        this.el = document.createElement('div');
        this.el.className = 'spe-sel-menu sc-hidden';
        this.el.setAttribute('role', 'toolbar');
        this.el.innerHTML = `
            <button type="button" data-cmd="bold"      title="Bold (Ctrl+B)"><i class="ph ph-text-b"></i></button>
            <button type="button" data-cmd="italic"    title="Italic (Ctrl+I)"><i class="ph ph-text-italic"></i></button>
            <button type="button" data-cmd="underline" title="Underline (Ctrl+U)"><i class="ph ph-text-underline"></i></button>
            <button type="button" data-cmd="code"      title="Inline code"><i class="ph ph-code"></i></button>
            <button type="button" data-cmd="link"      title="Link (Ctrl+K)"><i class="ph ph-link"></i></button>
            <div class="spe-sel-sep"></div>
            <button type="button" data-cmd="turninto"  title="Turn into"><i class="ph ph-arrows-left-right"></i> <span class="spe-sel-label">Turn into</span></button>
        `;
        host.rootEl.appendChild(this.el);

        this.el.querySelectorAll('button[data-cmd]').forEach(btn => {
            btn.addEventListener('mousedown', e => {
                e.preventDefault();
                const cmd = btn.dataset.cmd;
                if (cmd === 'link')     { this.promptLink(this._block, this._el); return; }
                if (cmd === 'code')     { this._wrapCode(); return; }
                if (cmd === 'turninto') { this.host.commandMenu?.openTurnInto(this._block?.id, this._el, btn); return; }
                document.execCommand(cmd);
                if (this._block && this._el) {
                    this._block.content = HTMLImporter.sanitizeInline(this._el);
                    this.host._notifyChange();
                }
            });
        });

        this._scrollHide = () => { if (!this._hidden) this.hide(); };
        window.addEventListener('scroll', this._scrollHide, true);

        this._mousedown = e => {
            if (!this.el.contains(e.target)) this.hide();
        };
        document.addEventListener('mousedown', this._mousedown);
    }

    destroy() {
        window.removeEventListener('scroll', this._scrollHide, true);
        document.removeEventListener('mousedown', this._mousedown);
        this.el.remove();
    }

    onChange(block, el) {
        if (this.host._isReadonly()) return;
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || !el.contains(sel.anchorNode)) { this.hide(); return; }
        this._block = block; this._el = el;
        this._position(sel);
        this.show();
    }

    _position(sel) {
        const rect     = sel.getRangeAt(0).getBoundingClientRect();
        const hostRect = this.host.rootEl.getBoundingClientRect();
        this.el.style.left      = `${rect.left + rect.width / 2 - hostRect.left}px`;
        this.el.style.top       = `${rect.top - hostRect.top - 48}px`;
        this.el.style.transform = 'translateX(-50%)';
    }

    show() { this._hidden = false; this.el.classList.remove('sc-hidden'); }
    hide() { this._hidden = true;  this.el.classList.add('sc-hidden'); }

    _wrapCode() {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) return;
        const r = sel.getRangeAt(0);
        const code = document.createElement('code');
        code.appendChild(r.extractContents());
        r.insertNode(code);
        if (this._block && this._el) {
            this._block.content = HTMLImporter.sanitizeInline(this._el);
            this.host._notifyChange();
        }
    }

    promptLink(block, el) {
        if (!block || !el) return;
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;
        const saved = sel.getRangeAt(0).cloneRange();
        const url   = window.prompt('Link URL:', 'https://');
        if (!url) return;
        sel.removeAllRanges(); sel.addRange(saved);
        const a = document.createElement('a');
        a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
        const r = sel.getRangeAt(0);
        if (r.collapsed) { a.textContent = url; r.insertNode(a); }
        else { a.appendChild(r.extractContents()); r.insertNode(a); }
        block.content = HTMLImporter.sanitizeInline(el);
        this.host._notifyChange();
        this.hide();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  SettingsPanel
// ─────────────────────────────────────────────────────────────────────────────
class SettingsPanel {
    constructor(host) {
        this.host   = host;
        this._block = null;
        this._open  = false;

        this.el = document.createElement('div');
        this.el.className = 'spe-settings-panel sc-hidden';
        host.rootEl.appendChild(this.el);

        this._clickAway = e => {
            if (this._open && !this.el.contains(e.target) && !e.target.closest('.spe-gear-btn'))
                this.close();
        };
        document.addEventListener('mousedown', this._clickAway);
    }

    destroy() {
        document.removeEventListener('mousedown', this._clickAway);
        this.el.remove();
    }

    open(block, anchorEl) {
        if (this._open && this._block?.id === block.id) { this.close(); return; }
        this._block = block;
        this._render();
        this._position(anchorEl);
        this._open = true;
        this.el.classList.remove('sc-hidden');
    }

    close() {
        this._open = false;
        this._block = null;
        this.el.classList.add('sc-hidden');
    }

    _render() {
        const b   = this._block;
        const bm  = this.host.blockManager;
        const isText = BLOCK_TYPES[b.type]?.isText;
        const isImage = b.type === 'image';

        this.el.innerHTML = '';

        if (isText) {
            const sec = this._section('Alignment');
            const row = document.createElement('div'); row.className = 'spe-sp-row';
            ALIGN_OPTIONS.forEach(opt => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'spe-sp-icon-btn' + (b.align === opt.value ? ' active' : '');
                btn.title = opt.label;
                btn.innerHTML = `<i class="ph ph-${opt.icon}"></i>`;
                btn.addEventListener('click', () => {
                    bm.applyStyle(b.id, { align: b.align === opt.value ? null : opt.value });
                    this._render();
                });
                row.appendChild(btn);
            });
            sec.appendChild(row);
            this.el.appendChild(sec);

            const fs = this._section('Font size');
            const fr = document.createElement('div'); fr.className = 'spe-sp-row';
            FONTSIZE_OPTIONS.forEach(opt => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'spe-sp-text-btn' + (b.fontSize === opt.value ? ' active' : '');
                btn.textContent = opt.label;
                btn.addEventListener('click', () => {
                    bm.applyStyle(b.id, { fontSize: b.fontSize === opt.value ? null : opt.value });
                    this._render();
                });
                fr.appendChild(btn);
            });
            fs.appendChild(fr);
            this.el.appendChild(fs);

            const tc = this._section('Text color');
            this.el.appendChild(tc);
            tc.appendChild(this._colorRow(COLOR_SWATCHES, b.textColor, color => {
                bm.applyStyle(b.id, { textColor: color });
                this._render();
            }, true));

            const bc = this._section('Background');
            this.el.appendChild(bc);
            bc.appendChild(this._colorRow(BG_SWATCHES, b.bgColor, color => {
                bm.applyStyle(b.id, { bgColor: color });
                this._render();
            }, false));
        }

        // Image-specific settings
        if (isImage && b.src) {
            const ws = this._section('Image width');
            const wr = document.createElement('div'); wr.className = 'spe-sp-row';
            IMG_WIDTH_OPTIONS.forEach(opt => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'spe-sp-text-btn' + ((b.imgWidth || 'full') === opt.value ? ' active' : '');
                btn.textContent = opt.label;
                btn.addEventListener('click', () => {
                    bm.applyStyle(b.id, { imgWidth: opt.value });
                    // Re-render the image block
                    const el = bm._el(b.id);
                    if (el) bm._renderBlockContent(b, el.querySelector('.spe-block-content'));
                    this._render();
                });
                wr.appendChild(btn);
            });
            ws.appendChild(wr);
            this.el.appendChild(ws);

            const as = this._section('Image align');
            const ar = document.createElement('div'); ar.className = 'spe-sp-row';
            IMG_ALIGN_OPTIONS.forEach(opt => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'spe-sp-text-btn' + ((b.imgAlign || 'center') === opt.value ? ' active' : '');
                btn.textContent = opt.label;
                btn.addEventListener('click', () => {
                    bm.applyStyle(b.id, { imgAlign: opt.value });
                    const el = bm._el(b.id);
                    if (el) bm._renderBlockContent(b, el.querySelector('.spe-block-content'));
                    this._render();
                });
                ar.appendChild(btn);
            });
            as.appendChild(ar);
            this.el.appendChild(as);
        }

        const ti = this._section('Turn into');
        const tiRow = document.createElement('div'); tiRow.className = 'spe-sp-turn-row';
        COMMAND_ORDER.forEach(type => {
            const cfg = BLOCK_TYPES[type];
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'spe-sp-turn-btn' + (b.type === type ? ' active' : '');
            btn.title = cfg.label;
            btn.innerHTML = `<i class="ph ph-${cfg.icon}"></i>`;
            btn.addEventListener('click', () => {
                bm.convertBlock(b.id, type, type === 'todo' ? { checked: false } : {});
                this.close();
            });
            tiRow.appendChild(btn);
        });
        ti.appendChild(tiRow);
        this.el.appendChild(ti);

        // Duplicate button
        const dup = document.createElement('button');
        dup.type = 'button'; dup.className = 'spe-sp-action-btn';
        dup.innerHTML = '<i class="ph ph-copy"></i> Duplicate block';
        dup.addEventListener('click', () => {
            bm._duplicateBlock(b);
            this.close();
        });
        this.el.appendChild(dup);

        const del = document.createElement('button');
        del.type = 'button'; del.className = 'spe-sp-delete-btn';
        del.innerHTML = '<i class="ph ph-trash"></i> Delete block';
        del.addEventListener('click', () => {
            bm._deleteBlock(b);
            this.close();
        });
        this.el.appendChild(del);
    }

    _section(title) {
        const s = document.createElement('div'); s.className = 'spe-sp-section';
        const h = document.createElement('div'); h.className = 'spe-sp-title'; h.textContent = title;
        s.appendChild(h); return s;
    }

    _colorRow(swatches, current, onChange, showCustom) {
        const row = document.createElement('div'); row.className = 'spe-sp-colors';
        swatches.forEach(color => {
            const sw = document.createElement('button');
            sw.type = 'button'; sw.className = 'spe-sp-swatch';
            sw.title = color;
            sw.style.background = color === 'transparent' ? 'none' : color;
            if (color === 'transparent') sw.innerHTML = '<i class="ph ph-prohibit" style="font-size:14px"></i>';
            if (current === color) sw.classList.add('active');
            sw.style.border = color === 'transparent' ? '1.5px dashed var(--sc-border,#e5e7eb)' : '';
            sw.addEventListener('click', () => onChange(color));
            row.appendChild(sw);
        });
        if (showCustom) {
            const picker = document.createElement('input');
            picker.type  = 'color'; picker.className = 'spe-sp-color-picker';
            picker.title = 'Custom color'; picker.value = current && current.startsWith('#') ? current : '#000000';
            picker.addEventListener('input', () => onChange(picker.value));
            row.appendChild(picker);
        }
        return row;
    }

    _position(anchor) {
        const rect     = anchor.getBoundingClientRect();
        const hostRect = this.host.rootEl.getBoundingClientRect();
        let top  = rect.bottom - hostRect.top + 4;
        let left = rect.left   - hostRect.left;
        const panelW = 240;
        const maxL   = hostRect.width - panelW - 8;
        // Ensure panel doesn't go above root
        if (top < 0) top = 0;
        this.el.style.top  = `${top}px`;
        this.el.style.left = `${Math.min(Math.max(0, left), maxL)}px`;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  DragManager
// ─────────────────────────────────────────────────────────────────────────────
class DragManager {
    constructor(host, container) {
        this.host      = host;
        this.container = container;
        this._state    = null;

        this._onDown = e => this._down(e);
        container.addEventListener('pointerdown', this._onDown);
    }

    destroy() {
        this.container.removeEventListener('pointerdown', this._onDown);
        this._cleanup();
    }

    _down(e) {
        const handle = e.target.closest('.spe-drag-handle');
        if (!handle || this.host._isReadonly()) return;
        const row = handle.closest('.spe-block');
        if (!row) return;

        e.preventDefault();
        const rect = row.getBoundingClientRect();

        const ghost = row.cloneNode(true);
        ghost.className += ' spe-drag-ghost';
        ghost.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;z-index:10001;pointer-events:none;`;
        document.body.appendChild(ghost);

        row.classList.add('spe-drag-source');

        this._state = {
            row,
            ghost,
            offsetY: e.clientY - rect.top,
            dropLine: this._makeDropLine(),
        };

        this._onMove = ev => this._move(ev);
        this._onUp   = ev => this._up(ev);
        document.addEventListener('pointermove', this._onMove);
        document.addEventListener('pointerup',   this._onUp, { once: true });
    }

    _makeDropLine() {
        const dl = document.createElement('div');
        dl.className = 'spe-drop-line sc-hidden';
        this.container.appendChild(dl);
        return dl;
    }

    _move(e) {
        const { ghost, offsetY, dropLine, row } = this._state;
        ghost.style.top = `${e.clientY - offsetY}px`;

        const rows = Array.from(this.container.querySelectorAll('.spe-block:not(.spe-drag-source)'));
        let target = null;
        for (const r of rows) {
            const mid = r.getBoundingClientRect().top + r.getBoundingClientRect().height / 2;
            if (e.clientY < mid) { target = r; break; }
        }

        dropLine.classList.remove('sc-hidden');
        const hostRect = this.container.getBoundingClientRect();
        if (target) {
            const tr = target.getBoundingClientRect();
            dropLine.style.top = `${tr.top - hostRect.top - 1}px`;
            this._state.dropTarget = { before: target };
        } else {
            const last = rows[rows.length - 1];
            if (last) {
                const lr = last.getBoundingClientRect();
                dropLine.style.top = `${lr.bottom - hostRect.top + 1}px`;
            }
            this._state.dropTarget = { before: null };
        }
    }

    _up() {
        if (!this._state) return;
        const { row, ghost, dropLine, dropTarget } = this._state;

        ghost.remove();
        dropLine.remove();
        row.classList.remove('spe-drag-source');

        if (dropTarget) {
            if (dropTarget.before) {
                this.container.insertBefore(row, dropTarget.before);
            } else {
                this.container.appendChild(row);
            }
            const prev = row.previousElementSibling;
            const afterId = prev ? prev.dataset.blockId : null;
            this.host.blockManager.reorder(row.dataset.blockId, afterId === null ? null : afterId);
        }

        this._cleanup();
    }

    _cleanup() {
        if (this._onMove) document.removeEventListener('pointermove', this._onMove);
        if (this._onUp)   document.removeEventListener('pointerup',   this._onUp);
        this._state = null;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  <smart-page-editor>
// ─────────────────────────────────────────────────────────────────────────────
class SmartPageEditor extends SPEBase {
    constructor() {
        super();
        this._initialized  = false;
        this._activeBlockId = null;
        this._dirty = false;
        this._autosaveTimer = null;
        this.uploadHandler = null; // async (file) => url
    }

    static get observedAttributes() {
        const base = SPEBase.observedAttributes || [];
        return [...new Set([...base, 'value', 'readonly'])];
    }

    connectedCallback() {
        if (this._initialized) return;
        this._initialized = true;

        const name    = this.getAttribute('name')             || 'page';
        const label   = this.getAttribute('label')            || '';
        const ph      = this.getAttribute('placeholder')      || "Click here or press '/' for commands…";
        const req     = this.hasAttribute('required');
        const reqMsg  = this.getAttribute('required-message') || `${label || 'This field'} is required`;
        const ro      = this.hasAttribute('readonly');

        // ── CRITICAL: Read initial value BEFORE innerHTML is overwritten ──────
        // After this.innerHTML = '...', this.textContent returns the template's
        // own text ("Add block", "Description is required", etc.) which causes
        // the gibberish-on-load bug. Capture the original content first.
        const attrValue = this.getAttribute('value');
        const inlineValue = attrValue === null ? this.textContent.trim() : null;

        this.config = { name, label, placeholder: ph, required: req, requiredMessage: reqMsg, isReadonly: ro };

        this._applyTheme();
        this._injectStyles();

        const mode    = this._getMode?.() || 'default';
        const labelCl = mode === 'bootstrap' ? 'form-label spe-label' : 'spe-label';

        this.innerHTML = `
            <div class="spe-container${ro ? ' spe-readonly' : ''}">
                ${label ? `<label class="${labelCl}">${this._esc(label)}${req ? '<span class="spe-required-star"> *</span>' : ''}</label>` : ''}
                <div class="spe-root">
                    <div class="spe-blocks-wrap">
                        <div class="spe-blocks"></div>
                    </div>
                    <button type="button" class="spe-add-last-btn" title="Add block">
                        <i class="ph ph-plus"></i> Add block
                    </button>
                </div>
                <input type="hidden" name="${name}" value="">
                <div class="spe-invalid-feedback">${this._esc(reqMsg)}</div>
            </div>
        `;

        // FIX #4/#5: Removed spe-empty-hint from HTML template entirely.
        // We now show it ONLY via CSS :empty pseudo + placeholder, not a floating div.
        // This eliminates the double-cursor bug and the "gibberish on load" issue.

        this.rootEl       = this.querySelector('.spe-root');
        this._blocksWrap  = this.querySelector('.spe-blocks-wrap');
        this._blocksEl    = this.querySelector('.spe-blocks');
        this._hiddenInput = this.querySelector(`input[name="${name}"]`);
        this._errFeedback = this.querySelector('.spe-invalid-feedback');
        this._container   = this.querySelector('.spe-container');

        this.blockManager = new BlockManager(this, this._blocksEl);

        if (!ro) {
            this.commandMenu   = new CommandMenu(this);
            this.selectionMenu = new SelectionMenu(this);
            this.settingsPanel = new SettingsPanel(this);
            this.dragManager   = new DragManager(this, this._blocksEl);
            this._wireShell();
        }

        // Global paste handler for images (even outside blocks)
        if (!ro) {
            this._pasteHandler = e => this._handleGlobalPaste(e);
            this.rootEl.addEventListener('paste', this._pasteHandler);
        }

        this._loadValue(inlineValue);

        // Draft recovery: check localStorage after loading initial value
        if (!ro && this.hasAttribute('draft-recovery')) {
            this._initDraftRecovery(name);
        }
    }

    disconnectedCallback() {
        if (super.disconnectedCallback) super.disconnectedCallback();
        this.commandMenu?.destroy();
        this.selectionMenu?.destroy();
        this.settingsPanel?.destroy();
        this.dragManager?.destroy();
        if (this._pasteHandler) this.rootEl?.removeEventListener('paste', this._pasteHandler);
        if (this._autosaveTimer) clearTimeout(this._autosaveTimer);
    }

    attributeChangedCallback(name, oldVal, newVal) {
        if (super.attributeChangedCallback) super.attributeChangedCallback(name, oldVal, newVal);
        if (!this._initialized) return;
        // Only re-read the value attribute, never textContent (template content)
        if (name === 'value') this._loadValue(null);
    }

    _loadValue(inlineValue) {
        // CRITICAL: Never read this.textContent here — after innerHTML is set in
        // connectedCallback, textContent contains the UI template text ("Add block",
        // "Description is required", etc.) which would create gibberish blocks.
        // inlineValue is the pre-captured textContent from BEFORE innerHTML was set.
        // For attribute-driven reloads (attributeChangedCallback), pass null.
        const raw = this.getAttribute('value') || inlineValue || '';
        if (!raw) { this.blockManager.load([], true); this._syncEmptyState(); return; }
        if (HTMLImporter.looksLikeJSON(raw)) {
            try {
                const p = JSON.parse(raw);
                this.blockManager.load(Array.isArray(p) ? p : [p], true);
                this._syncEmptyState(); return;
            } catch { /* fall through */ }
        }
        this.blockManager.load(HTMLImporter.htmlToBlocks(raw), true);
        this._syncEmptyState();
    }

    _wireShell() {
        this.querySelector('.spe-add-last-btn').addEventListener('click', () => {
            const blocks = this.blockManager.blocks;
            const lastId = blocks.length ? blocks[blocks.length - 1].id : null;
            const nb     = this.blockManager.insertAfter(lastId, 'paragraph');
            requestAnimationFrame(() => this.blockManager._focusBlock(nb.id, 'start'));
        });

        this._blocksWrap.addEventListener('click', e => {
            if (e.target === this._blocksWrap || e.target === this._blocksEl) {
                const blocks = this.blockManager.blocks;
                if (!blocks.length) return;
                const last = blocks[blocks.length - 1];
                if (BLOCK_TYPES[last.type]?.isText) this.blockManager._focusBlock(last.id, 'end');
            }
        });

        this._blocksEl.addEventListener('contextmenu', e => {
            const row = e.target.closest('.spe-block');
            if (!row) return;
            e.preventDefault();
            const block = this.blockManager._block(row.dataset.blockId);
            if (!block) return;
            const gearBtn = row.querySelector('.spe-gear-btn');
            this.settingsPanel?.open(block, gearBtn || row);
        });

        this._blocksEl.addEventListener('mousedown', () => {
            requestAnimationFrame(() => {
                const sel = window.getSelection();
                if (!sel || sel.isCollapsed) this.selectionMenu?.hide();
            });
        });
    }

    _handleGlobalPaste(e) {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (const item of items) {
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                const file = item.getAsFile();
                if (!file) return;
                // Insert image block at current active position
                const activeId = this._activeBlockId;
                const imgBlock = this.blockManager.insertAfter(activeId, 'image', {});
                // Let the block render, then trigger upload
                requestAnimationFrame(() => {
                    const blockEl = this.blockManager._el(imgBlock.id);
                    const contentEl = blockEl?.querySelector('.spe-block-content');
                    const mediaWrap = contentEl?.querySelector('.spe-media-block') || document.createElement('div');
                    this.blockManager._uploadOrReadFile(imgBlock, file, mediaWrap);
                });
                return;
            }
        }
    }

    _notifyChange() {
        const json = this.blockManager.toJSON();
        const html = this.blockManager.toHTML();
        if (this._hiddenInput) this._hiddenInput.value = JSON.stringify(json);
        this._syncEmptyState();
        if (this.hasContent()) this.hideValidationError();
        this.dispatchEvent(new CustomEvent('spe-change', { bubbles: true, detail: { json, html } }));

        // Dirty state
        if (!this._dirty) {
            this._dirty = true;
            this.dispatchEvent(new CustomEvent('spe-dirty', { bubbles: true, detail: { dirty: true } }));
        }

        // Autosave
        const delay = parseInt(this.getAttribute('autosave-delay') || '0', 10);
        if (delay > 0) {
            if (this._autosaveTimer) clearTimeout(this._autosaveTimer);
            this._autosaveTimer = setTimeout(() => {
                this.dispatchEvent(new CustomEvent('spe-save', { bubbles: true, detail: { json, html } }));
            }, delay);
        }

        // Draft recovery: save to localStorage on every change
        if (this.hasAttribute('draft-recovery') && this.config?.name) {
            try {
                const key = `spe_draft_${this.config.name}`;
                localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data: json }));
            } catch {}
        }
    }

    // FIX #5: Empty state is now handled purely via CSS on .spe-blocks:empty
    // No floating div = no double cursor
    _syncEmptyState() {
        const empty = !this.hasContent();
        this._blocksEl.classList.toggle('spe-is-empty', empty);
    }

    // ── Draft recovery ────────────────────────────────────────────────────────
    _initDraftRecovery(name) {
        const key = `spe_draft_${name}`;
        let draft;
        try { draft = JSON.parse(localStorage.getItem(key) || 'null'); } catch {}
        if (!draft?.data?.length || !draft.ts) return;

        // Only show banner if draft is newer than 60 seconds old AND different from current
        const age = Date.now() - draft.ts;
        if (age < 500) return; // Too fresh — probably same page load

        const currentJSON = JSON.stringify(this.blockManager.toJSON());
        const draftJSON   = JSON.stringify(draft.data);
        if (currentJSON === draftJSON) { this.clearDraft(); return; } // Already up to date

        // Show recovery banner
        const fmt = new Date(draft.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const banner = document.createElement('div');
        banner.className = 'spe-draft-banner';
        banner.setAttribute('role', 'alert');
        banner.innerHTML = `
            <i class="ph ph-clock-counter-clockwise"></i>
            <span>Unsaved draft from <strong>${fmt}</strong></span>
            <button type="button" class="spe-draft-restore">Restore</button>
            <button type="button" class="spe-draft-dismiss" aria-label="Dismiss">✕</button>
        `;
        banner.querySelector('.spe-draft-restore').addEventListener('click', () => {
            this.blockManager.load(draft.data);
            banner.remove();
        });
        banner.querySelector('.spe-draft-dismiss').addEventListener('click', () => {
            this.clearDraft();
            banner.remove();
        });
        // Insert banner above the editor root
        this._container.insertBefore(banner, this._container.firstChild);
    }

    clearDraft() {
        if (this.config?.name) {
            try { localStorage.removeItem(`spe_draft_${this.config.name}`); } catch {}
        }
    }

    _isReadonly() { return !!this.config?.isReadonly; }

    // ── Public API ────────────────────────────────────────────────────────────
    getJSON()      { return this.blockManager.toJSON(); }
    setJSON(data)  { this.blockManager.load(Array.isArray(data) ? data : []); }
    getHTML()      { return this.blockManager.toHTML(); }
    exportHTML()   { return this.getHTML(); }
    getMarkdown()  { return MarkdownUtils.blocksToMarkdown(this.blockManager.blocks); }

    /** Primary storage format — use this for Django TextField/JSONField */
    serialize()    { return JSON.stringify(this.blockManager.toJSON()); }

    /** Load from a JSON string (the output of serialize()) */
    deserialize(str) {
        try {
            const data = JSON.parse(str);
            this.blockManager.load(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error('[SmartPageEditor] deserialize() failed:', e);
        }
    }

    importHTML(html) {
        this.blockManager.load(HTMLImporter.htmlToBlocks(html));
    }

    importMarkdown(md) {
        this.blockManager.load(MarkdownUtils.markdownToBlocks(md));
    }

    isDirty()    { return this._dirty; }
    markClean()  { this._dirty = false; }

    clear() {
        this.blockManager.load([]);
        this.hideValidationError();
    }

    focus() {
        const first = this.blockManager.blocks[0];
        if (first) this.blockManager._focusBlock(first.id, 'start');
    }

    undo() {
        const prev = this.blockManager.history.undo(this.blockManager.toJSON());
        if (prev) this.blockManager.load(prev);
    }

    redo() {
        const next = this.blockManager.history.redo(this.blockManager.toJSON());
        if (next) this.blockManager.load(next);
    }

    hasContent() {
        return this.blockManager.blocks.some(b => {
            if (b.type === 'divider') return true;
            if (b.type === 'image' || b.type === 'video') return !!b.src;
            if (b.type === 'bookmark') return !!b.src;
            if (b.type === 'table') return b.rows?.some(r => r.some(c => c?.trim()));
            if (b.type === 'columns') return b.columns?.some(col => col.some(bl => (this.blockManager._stripTags(bl.content || '')).trim().length > 0));
            return (this.blockManager._stripTags(b.content || '')).trim().length > 0;
        });
    }

    validate() {
        if (!this.config?.required) return true;
        const ok = this.hasContent();
        ok ? this.hideValidationError() : this.showValidationError();
        return ok;
    }
    checkValidity()  { return this.validate(); }
    reportValidity() { const ok = this.validate(); if (!ok) this.focus(); return ok; }

    showValidationError() {
        this._container?.classList.add('spe-invalid');
        this._errFeedback?.classList.add('spe-visible');
    }
    hideValidationError() {
        this._container?.classList.remove('spe-invalid');
        this._errFeedback?.classList.remove('spe-visible');
    }

    _esc(s) {
        return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    _injectStyles() {
        if (typeof injectSharedStyles === 'function') injectSharedStyles();
        if (document.getElementById('spe-styles')) return;
        const s = document.createElement('style');
        s.id = 'spe-styles';
        s.textContent = `
/* ── Host ──────────────────────────────────────────────────────────────── */
smart-page-editor {
    display: block;
    font-family: var(--sc-font, system-ui, -apple-system, 'Segoe UI', sans-serif);
    font-size: var(--sc-font-size, 0.9375rem);
    color: var(--sc-text, #1a1d23);
}
.spe-label {
    display: block; margin-bottom: 0.45rem;
    font-size: 0.875rem; font-weight: 500; color: var(--sc-text, #374151);
}
.spe-required-star { color: var(--sc-error, #dc2626); }

/* ── Root shell ─────────────────────────────────────────────────────────── */
.spe-root {
    position: relative;
    border: 1.5px solid var(--sc-border, #e5e7eb);
    border-radius: var(--sc-radius-lg, 0.75rem);
    background: var(--sc-bg, #ffffff);
    min-height: 240px;
    transition: border-color .15s, box-shadow .15s;
    overflow: visible;
}
.spe-root:focus-within {
    border-color: var(--sc-focus, #6366f1);
    box-shadow: 0 0 0 3px var(--sc-focus-ring, rgba(99,102,241,.15));
}
.spe-container.spe-invalid .spe-root { border-color: var(--sc-error, #dc2626); }

.spe-blocks-wrap {
    position: relative;
    min-height: 180px;
    padding: 1.5rem 1rem 1rem 0.5rem;
    cursor: text;
}
.spe-blocks { display: flex; flex-direction: column; gap: 1px; }

/* ── FIX #4 & #5: Empty state via CSS only — no floating div, no double cursor ── */
/* When the editor has one empty paragraph and no other blocks, show placeholder   */
/* on the editable itself via ::before. The .spe-is-empty class on .spe-blocks     */
/* is used to show a subtle background hint without a floating cursor element.      */
.spe-blocks.spe-is-empty::after {
    content: attr(data-placeholder);
    display: block;
    position: absolute;
    top: 1.5rem;
    left: 3.5rem;
    color: var(--sc-text-muted, #9ca3af);
    font-size: 0.9rem;
    pointer-events: none;
    user-select: none;
}

/* ── Add last button ────────────────────────────────────────────────────── */
.spe-add-last-btn {
    display: flex; align-items: center; gap: 0.35rem;
    width: 100%; border: none; background: transparent; cursor: pointer;
    padding: 0.5rem 1rem; border-top: 1px solid var(--sc-border, #e5e7eb);
    color: var(--sc-text-muted, #9ca3af); font-size: 0.8rem;
    border-bottom-left-radius: var(--sc-radius-lg, 0.75rem);
    border-bottom-right-radius: var(--sc-radius-lg, 0.75rem);
    transition: background .12s, color .12s;
}
.spe-add-last-btn:hover { background: var(--sc-bg-subtle, #f9fafb); color: var(--sc-text, #1a1d23); }
.spe-readonly .spe-add-last-btn { display: none; }

/* ── Block row ──────────────────────────────────────────────────────────── */
.spe-block {
    position: relative;
    display: flex; align-items: flex-start;
    padding: 1px 0;
    border-radius: var(--sc-radius, 0.4rem);
}
.spe-drag-handle, .spe-gear-btn {
    flex: 0 0 auto; width: 22px; height: 26px;
    display: flex; align-items: center; justify-content: center;
    border: none; background: transparent; cursor: pointer;
    color: var(--sc-text-muted, #9ca3af); border-radius: 0.25rem;
    opacity: 0; transition: opacity .1s, background .1s;
    margin-top: 0.15rem; flex-shrink: 0;
}
.spe-drag-handle { cursor: grab; touch-action: none; }
.spe-gear-btn    { cursor: pointer; }
.spe-block:hover .spe-drag-handle,
.spe-block:hover .spe-gear-btn { opacity: 1; }
.spe-drag-handle:hover, .spe-gear-btn:hover {
    background: var(--sc-bg-subtle, #f3f4f6); color: var(--sc-text, #1a1d23);
}
.spe-readonly .spe-drag-handle,
.spe-readonly .spe-gear-btn { display: none; }
.spe-block-content { flex: 1 1 auto; min-width: 0; }

/* Drag states */
.spe-drag-source { opacity: 0.35; }
.spe-drag-ghost {
    box-shadow: var(--sc-shadow-md, 0 4px 20px rgba(0,0,0,.15));
    border-radius: var(--sc-radius, 0.4rem);
    background: var(--sc-bg, #fff);
    opacity: 0.95;
}
.spe-drop-line {
    position: absolute; left: 2rem; right: 0.5rem;
    height: 2px; border-radius: 1px;
    background: var(--sc-focus, #6366f1); pointer-events: none;
}

/* ── Editable surfaces ───────────────────────────────────────────────────── */
.spe-editable {
    outline: none; min-height: 1.65em; line-height: 1.65;
    padding: 0.1rem 0.3rem; border-radius: 0.3rem;
    word-wrap: break-word; white-space: pre-wrap;
    caret-color: var(--sc-focus, #6366f1);
}
.spe-editable:empty::before {
    content: attr(data-placeholder);
    color: var(--sc-text-muted, #9ca3af);
    pointer-events: none;
}
.spe-editable code {
    background: var(--sc-bg-subtle, #f3f4f6); border-radius: 0.25rem;
    padding: 0.1em 0.35em;
    font-family: ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
    font-size: 0.875em;
}
.spe-editable a { color: var(--sc-focus, #6366f1); text-decoration: underline; }
h1.spe-editable { font-size: 1.75rem; font-weight: 700; line-height: 1.25; padding: 0.2rem 0.3rem; }
h2.spe-editable { font-size: 1.35rem; font-weight: 700; line-height: 1.3;  padding: 0.15rem 0.3rem; }
h3.spe-editable { font-size: 1.1rem;  font-weight: 600; line-height: 1.4;  padding: 0.1rem 0.3rem; }
blockquote.spe-editable {
    border-left: 3px solid var(--sc-border, #d1d5db);
    padding-left: 0.85rem; color: var(--sc-text-muted, #4b5563);
    font-style: italic; margin: 0;
}
pre.spe-editable {
    background: var(--sc-bg-subtle, #f3f4f6);
    border-radius: var(--sc-radius, 0.4rem);
    padding: 0.65rem 0.85rem;
    font-family: ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
    font-size: 0.855rem; white-space: pre-wrap; margin: 0;
}
.spe-divider {
    border: none; border-top: 1.5px solid var(--sc-border, #e5e7eb);
    margin: 0.75rem 0; width: 100%;
}

/* ── Code block with copy button ─────────────────────────────────────────── */
.spe-code-wrap {
    position: relative;
}
.spe-code-copy {
    position: absolute; top: 0.4rem; right: 0.4rem;
    background: var(--sc-bg-subtle, #e5e7eb); border: none;
    border-radius: 0.3rem; padding: 0.2rem 0.4rem;
    cursor: pointer; color: var(--sc-text-muted, #6b7280);
    font-size: 0.8rem; opacity: 0; transition: opacity .15s;
}
.spe-code-wrap:hover .spe-code-copy { opacity: 1; }
.spe-code-copy:hover { color: var(--sc-text, #1a1d23); }

/* ── Callout block ───────────────────────────────────────────────────────── */
.spe-callout-wrap {
    display: flex; align-items: flex-start; gap: 0.5rem;
    background: var(--sc-bg-subtle, #f3f4f6);
    border-left: 3px solid var(--sc-warning, #d97706);
    border-radius: var(--sc-radius, 0.4rem);
    padding: 0.5rem 0.65rem;
}
.spe-callout-icon { font-size: 1.1rem; flex-shrink: 0; margin-top: 0.1rem; }

/* ── Todo ────────────────────────────────────────────────────────────────── */
.spe-todo-row { display: flex; align-items: flex-start; gap: 0.5rem; }
.spe-todo-check {
    flex-shrink: 0; width: 18px; height: 18px; margin-top: 0.35rem;
    border: 1.5px solid var(--sc-border, #d1d5db);
    border-radius: 0.3rem; background: var(--sc-bg, #fff);
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    font-size: 0.72rem; color: #fff; transition: background .12s, border-color .12s;
}
.spe-todo-checked { background: var(--sc-focus, #6366f1); border-color: var(--sc-focus, #6366f1); }
.spe-todo-done { color: var(--sc-text-muted, #9ca3af); text-decoration: line-through; }

/* ── Media blocks ────────────────────────────────────────────────────────── */
.spe-media-block { width: 100%; }
.spe-media-empty {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 0.3rem; height: 100px;
    border: 1.5px dashed var(--sc-border, #d1d5db);
    border-radius: var(--sc-radius, 0.4rem);
    color: var(--sc-text-muted, #9ca3af); cursor: pointer;
    transition: border-color .15s;
}
.spe-media-empty i { font-size: 1.75rem; }
.spe-media-empty small { font-size: 0.72rem; }
.spe-media-empty:hover,
.spe-drop-active { border-color: var(--sc-focus, #6366f1); background: var(--sc-bg-subtle,#f3f4f6); }
.spe-media-inputs {
    display: flex; align-items: center; gap: 0.5rem;
    margin-top: 0.5rem;
}
.spe-url-input {
    flex: 1; padding: 0.4rem 0.6rem;
    border: 1px solid var(--sc-border, #d1d5db);
    border-radius: var(--sc-radius, 0.4rem);
    background: var(--sc-bg, #fff); color: var(--sc-text, #1a1d23);
    font-size: 0.875rem; outline: none;
}
.spe-url-input:focus { border-color: var(--sc-focus, #6366f1); }
.spe-media-or { color: var(--sc-text-muted, #9ca3af); font-size: 0.8rem; }
.spe-file-btn {
    display: inline-flex; align-items: center; gap: 0.3rem;
    padding: 0.38rem 0.65rem; border-radius: var(--sc-radius, 0.4rem);
    background: var(--sc-bg-subtle, #f3f4f6); border: 1px solid var(--sc-border, #d1d5db);
    color: var(--sc-text, #1a1d23); font-size: 0.8rem; cursor: pointer;
    transition: background .12s;
}
.spe-file-btn:hover { background: var(--sc-border, #e5e7eb); }
.spe-media-preview { position: relative; }
.spe-img {
    max-width: 100%; border-radius: var(--sc-radius, 0.4rem); display: block;
    cursor: zoom-in; transition: box-shadow .15s;
}
.spe-img:hover { box-shadow: 0 2px 12px rgba(0,0,0,.15); }
.spe-video-iframe, .spe-video-native {
    width: 100%; aspect-ratio: 16/9;
    border-radius: var(--sc-radius, 0.4rem);
    border: none; display: block;
}
.spe-caption-input {
    width: 100%; box-sizing: border-box;
    margin-top: 0.35rem; padding: 0.3rem 0.4rem;
    border: none; border-bottom: 1px solid var(--sc-border, #e5e7eb);
    background: transparent; color: var(--sc-text-muted, #6b7280);
    font-size: 0.8rem; text-align: center; outline: none;
}

/* ── Upload progress ─────────────────────────────────────────────────────── */
.spe-upload-progress {
    margin-top: 0.4rem; display: flex; align-items: center; gap: 0.5rem;
}
.spe-progress-bar {
    flex: 1; height: 4px; background: var(--sc-border, #e5e7eb);
    border-radius: 2px; overflow: hidden;
}
.spe-progress-fill {
    height: 100%; width: 0%; background: var(--sc-focus, #6366f1);
    border-radius: 2px; transition: width .3s;
}
.spe-progress-label { font-size: 0.75rem; color: var(--sc-text-muted, #6b7280); }

/* ── Table ───────────────────────────────────────────────────────────────── */
.spe-table-wrap { overflow-x: auto; }
.spe-table { border-collapse: collapse; width: 100%; font-size: 0.9rem; }
.spe-table td {
    border: 1px solid var(--sc-border, #e5e7eb);
    padding: 0; min-width: 80px;
}
.spe-table-cell {
    padding: 0.4rem 0.5rem; outline: none;
    min-height: 1.4em; white-space: pre-wrap;
}
.spe-table-ctrl { border: none; width: 28px; }
.spe-table-ctrl button {
    background: none; border: none; cursor: pointer;
    color: var(--sc-text-muted, #9ca3af); padding: 0.2rem;
    font-size: 0.85rem;
}
.spe-table-ctrl button:hover { color: var(--sc-error, #dc2626); }
.spe-table-toolbar {
    display: flex; gap: 0.5rem; margin-top: 0.4rem;
}
.spe-table-add-row, .spe-table-add-col {
    display: inline-flex; align-items: center; gap: 0.25rem;
    padding: 0.25rem 0.55rem; border-radius: var(--sc-radius, 0.4rem);
    border: 1px solid var(--sc-border, #e5e7eb);
    background: var(--sc-bg-subtle, #f9fafb);
    color: var(--sc-text-muted, #6b7280); font-size: 0.78rem; cursor: pointer;
}
.spe-table-add-row:hover, .spe-table-add-col:hover {
    background: var(--sc-bg-subtle, #f3f4f6); color: var(--sc-text, #1a1d23);
}

/* ── Command menu ────────────────────────────────────────────────────────── */
.spe-cmd-menu {
    position: absolute; z-index: 200;
    min-width: 200px; max-height: 280px; overflow-y: auto;
    background: var(--sc-bg, #fff);
    border: 1.5px solid var(--sc-border, #e5e7eb);
    border-radius: var(--sc-radius, 0.4rem);
    box-shadow: var(--sc-shadow-md, 0 4px 20px rgba(0,0,0,.12));
    padding: 4px;
}
.spe-cmd-header {
    padding: 0.3rem 0.6rem; font-size: 0.72rem; font-weight: 600;
    color: var(--sc-text-muted, #9ca3af); text-transform: uppercase; letter-spacing: 0.05em;
}
.spe-cmd-sep {
    padding: 0.3rem 0.6rem; margin-top: 0.2rem; font-size: 0.72rem; font-weight: 600;
    color: var(--sc-text-muted, #9ca3af); text-transform: uppercase; letter-spacing: 0.05em;
    border-top: 1px solid var(--sc-border, #e5e7eb);
}
.spe-cmd-item {
    display: flex; align-items: center; gap: 0.6rem;
    width: 100%; text-align: left; border: none; background: transparent;
    padding: 0.42rem 0.6rem; border-radius: 0.3rem;
    color: var(--sc-text, #1a1d23); font-size: 0.875rem; cursor: pointer;
}
.spe-cmd-item i { color: var(--sc-text-muted, #6b7280); font-size: 1rem; flex-shrink: 0; }
.spe-cmd-active, .spe-cmd-item:hover { background: var(--sc-bg-subtle, #f3f4f6); }

/* ── Selection menu ──────────────────────────────────────────────────────── */
.spe-sel-menu {
    position: absolute; z-index: 200;
    display: inline-flex; align-items: center; gap: 2px;
    background: #1e2340;
    border-radius: var(--sc-radius, 0.4rem);
    box-shadow: 0 4px 20px rgba(0,0,0,.25);
    padding: 4px; white-space: nowrap;
}
.spe-sel-menu button {
    height: 28px; padding: 0 0.4rem;
    display: inline-flex; align-items: center; gap: 0.25rem;
    border: none; background: transparent; cursor: pointer;
    color: #e5e7eb; border-radius: 0.25rem; font-size: 0.875rem;
    transition: background .1s;
}
.spe-sel-menu button:hover { background: rgba(255,255,255,.12); }
.spe-sel-sep { width: 1px; height: 18px; background: rgba(255,255,255,.2); margin: 0 2px; }
.spe-sel-label { font-size: 0.78rem; }

/* ── Settings panel ──────────────────────────────────────────────────────── */
.spe-settings-panel {
    position: absolute; z-index: 201;
    width: 240px;
    background: var(--sc-bg, #fff);
    border: 1.5px solid var(--sc-border, #e5e7eb);
    border-radius: var(--sc-radius, 0.4rem);
    box-shadow: var(--sc-shadow-md, 0 4px 20px rgba(0,0,0,.12));
    padding: 0.5rem;
    /* FIX: ensure panel never leaks on initial render by being sc-hidden */
}
.spe-sp-section { margin-bottom: 0.5rem; }
.spe-sp-title {
    font-size: 0.7rem; font-weight: 600; color: var(--sc-text-muted, #9ca3af);
    text-transform: uppercase; letter-spacing: 0.05em;
    padding: 0 0.2rem; margin-bottom: 0.3rem;
}
.spe-sp-row { display: flex; gap: 4px; flex-wrap: wrap; }
.spe-sp-icon-btn, .spe-sp-text-btn {
    padding: 0.25rem 0.4rem; border: 1px solid var(--sc-border, #e5e7eb);
    border-radius: 0.3rem; background: var(--sc-bg, #fff);
    color: var(--sc-text, #1a1d23); cursor: pointer; font-size: 0.8rem;
    display: flex; align-items: center; justify-content: center;
    transition: background .1s;
}
.spe-sp-icon-btn:hover, .spe-sp-text-btn:hover { background: var(--sc-bg-subtle, #f3f4f6); }
.spe-sp-icon-btn.active, .spe-sp-text-btn.active {
    background: var(--sc-focus, #6366f1); color: #fff;
    border-color: var(--sc-focus, #6366f1);
}
.spe-sp-colors { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 0.2rem; }
.spe-sp-swatch {
    width: 22px; height: 22px; border-radius: 50%; cursor: pointer;
    border: 2px solid transparent; padding: 0;
    display: flex; align-items: center; justify-content: center;
    transition: transform .1s, border-color .1s;
}
.spe-sp-swatch:hover { transform: scale(1.2); }
.spe-sp-swatch.active { border-color: var(--sc-focus, #6366f1); }
.spe-sp-color-picker {
    width: 22px; height: 22px; border-radius: 50%; cursor: pointer;
    border: 2px solid var(--sc-border, #e5e7eb); padding: 0;
    background: none; overflow: hidden;
}
.spe-sp-turn-row { display: flex; flex-wrap: wrap; gap: 4px; }
.spe-sp-turn-btn {
    width: 28px; height: 28px; border-radius: 0.3rem;
    border: 1px solid var(--sc-border, #e5e7eb);
    background: var(--sc-bg, #fff); color: var(--sc-text-muted, #6b7280);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; font-size: 0.95rem; transition: background .1s;
}
.spe-sp-turn-btn:hover { background: var(--sc-bg-subtle, #f3f4f6); color: var(--sc-text, #1a1d23); }
.spe-sp-turn-btn.active { background: var(--sc-focus, #6366f1); color: #fff; border-color: var(--sc-focus, #6366f1); }
.spe-sp-action-btn {
    display: flex; align-items: center; gap: 0.4rem;
    width: 100%; margin-top: 0.4rem; padding: 0.35rem 0.5rem;
    border: none; border-top: 1px solid var(--sc-border, #e5e7eb);
    background: transparent; color: var(--sc-text-muted, #6b7280);
    cursor: pointer; font-size: 0.85rem; border-radius: 0.3rem;
    transition: background .1s;
}
.spe-sp-action-btn:hover { background: var(--sc-bg-subtle, #f3f4f6); color: var(--sc-text,#1a1d23); }
.spe-sp-delete-btn {
    display: flex; align-items: center; gap: 0.4rem;
    width: 100%; margin-top: 0.2rem; padding: 0.35rem 0.5rem;
    border: none;
    background: transparent; color: var(--sc-error, #dc2626);
    cursor: pointer; font-size: 0.85rem; border-radius: 0.3rem;
    transition: background .1s;
}
.spe-sp-delete-btn:hover { background: var(--sc-bg-subtle, #f3f4f6); }

/* ── Validation ──────────────────────────────────────────────────────────── */
.spe-invalid-feedback { display: none; margin-top: 0.35rem; font-size: 0.8125rem; color: var(--sc-error, #dc2626); }
.spe-invalid-feedback.spe-visible { display: block; }

/* ── Dark theme overrides ────────────────────────────────────────────────── */
[data-sc-theme="dark"] .spe-cmd-menu,
[data-sc-theme="dark"] .spe-settings-panel {
    background: var(--sc-bg-subtle, #374151);
    border-color: var(--sc-border, #4b5563);
}
[data-sc-theme="dark"] .spe-cmd-item { color: var(--sc-text, #e5e7eb); }
[data-sc-theme="dark"] .spe-cmd-active,
[data-sc-theme="dark"] .spe-cmd-item:hover { background: var(--sc-bg, #1f2937); }
[data-sc-theme="dark"] pre.spe-editable,
[data-sc-theme="dark"] .spe-editable code { background: var(--sc-bg, #1f2937); }
[data-sc-theme="dark"] .spe-table td { border-color: var(--sc-border, #4b5563); }
[data-sc-theme="dark"] .spe-url-input { background: var(--sc-bg, #1f2937); color: var(--sc-text, #e5e7eb); }
[data-sc-theme="dark"] .spe-sp-icon-btn,
[data-sc-theme="dark"] .spe-sp-text-btn,
[data-sc-theme="dark"] .spe-sp-turn-btn {
    background: var(--sc-bg, #1f2937); color: var(--sc-text, #e5e7eb);
    border-color: var(--sc-border, #4b5563);
}
[data-sc-theme="dark"] .spe-sp-icon-btn:hover,
[data-sc-theme="dark"] .spe-sp-text-btn:hover,
[data-sc-theme="dark"] .spe-sp-turn-btn:hover { background: var(--sc-bg-subtle, #374151); }
[data-sc-theme="dark"] .spe-callout-wrap { background: rgba(255,255,255,.05); }
[data-sc-theme="dark"] .spe-code-copy { background: var(--sc-bg, #1f2937); }
[data-sc-theme="dark"] .spe-bookmark-card {
    background: var(--sc-bg-subtle, #374151);
    border-color: var(--sc-border, #4b5563);
}
[data-sc-theme="dark"] .spe-bookmark-empty { background: var(--sc-bg-subtle, #374151); }
[data-sc-theme="dark"] .spe-draft-banner {
    background: #1e3a5f; border-color: #2563eb; color: #bfdbfe;
}

/* ── Columns ──────────────────────────────────────────────────────────────── */
.spe-columns-wrap {
    display: flex; align-items: stretch; gap: 0; width: 100%;
    min-height: 60px;
}
.spe-column {
    min-width: 0; padding: 0.25rem 0.4rem;
    border: 1.5px dashed var(--sc-border, #e5e7eb);
    border-radius: var(--sc-radius, 0.4rem);
    display: flex; flex-direction: column;
    transition: border-color .15s, background .15s;
}
.spe-column:focus-within { border-color: var(--sc-focus, #6366f1); }
.spe-col-drag-over {
    border-color: var(--sc-focus, #6366f1) !important;
    background: rgba(99,102,241,.06) !important;
}
/* Nested blocks inside columns — compact, no drag handle needed */
.spe-nested-block { padding: 1px 0; }
.spe-nested-block .spe-drag-handle { display: none; }
.spe-nested-block .spe-gear-btn { opacity: 0; transition: opacity .1s; }
.spe-nested-block:hover .spe-gear-btn { opacity: 1; }
.spe-col-divider {
    flex: 0 0 12px; cursor: col-resize;
    display: flex; align-items: center; justify-content: center;
    touch-action: none; padding: 0 2px;
}
.spe-col-divider-bar {
    width: 3px; height: 40px; border-radius: 3px;
    background: var(--sc-border, #d1d5db); transition: background .15s;
}
.spe-col-divider:hover .spe-col-divider-bar,
.spe-col-divider-active .spe-col-divider-bar { background: var(--sc-focus, #6366f1); }
.spe-col-add-btn {
    display: flex; align-items: center; justify-content: center; gap: .3rem;
    border: 1px dashed var(--sc-border, #d1d5db); border-radius: .3rem;
    background: transparent; color: var(--sc-text-muted, #9ca3af);
    cursor: pointer; padding: .3rem .5rem; font-size: .78rem; margin-top: .3rem;
    transition: border-color .12s, color .12s;
}
.spe-col-add-btn:hover { border-color: var(--sc-focus, #6366f1); color: var(--sc-focus, #6366f1); }
@media (max-width: 600px) {
    .spe-columns-wrap { flex-direction: column; }
    .spe-col-divider { flex: 0 0 8px; cursor: row-resize; }
    .spe-col-divider-bar { width: 40px; height: 3px; }
    .spe-column { flex: unset !important; }
}

/* ── Nested block type / column picker menu ──────────────────────────────── */
.spe-nested-menu, .spe-col-type-picker {
    min-width: 180px; max-height: 280px; overflow-y: auto;
    background: var(--sc-bg, #fff);
    border: 1.5px solid var(--sc-border, #e5e7eb);
    border-radius: var(--sc-radius, 0.4rem);
    box-shadow: var(--sc-shadow-md, 0 4px 20px rgba(0,0,0,.12));
    padding: 4px;
}
.spe-nm-header {
    padding: .25rem .6rem; font-size: .7rem; font-weight: 600;
    color: var(--sc-text-muted, #9ca3af); text-transform: uppercase; letter-spacing: .05em;
}
.spe-nm-sep { border-top: 1px solid var(--sc-border, #e5e7eb); margin: 3px 0; }
.spe-nm-item {
    display: flex; align-items: center; gap: .5rem;
    width: 100%; text-align: left; border: none; background: transparent;
    padding: .38rem .6rem; border-radius: .3rem;
    color: var(--sc-text, #1a1d23); font-size: .85rem; cursor: pointer;
}
.spe-nm-item:hover, .spe-nm-item.active { background: var(--sc-bg-subtle, #f3f4f6); }
.spe-nm-item i { color: var(--sc-text-muted, #6b7280); font-size: .95rem; }
.spe-nm-delete {
    display: flex; align-items: center; gap: .5rem;
    width: 100%; text-align: left; border: none; background: transparent;
    padding: .38rem .6rem; border-radius: .3rem;
    color: var(--sc-error, #dc2626); font-size: .85rem; cursor: pointer;
}
.spe-nm-delete:hover { background: var(--sc-bg-subtle, #f3f4f6); }
[data-sc-theme="dark"] .spe-nested-menu,
[data-sc-theme="dark"] .spe-col-type-picker {
    background: var(--sc-bg-subtle, #374151); border-color: var(--sc-border, #4b5563);
}
[data-sc-theme="dark"] .spe-nm-item { color: var(--sc-text, #e5e7eb); }
[data-sc-theme="dark"] .spe-nm-item:hover { background: var(--sc-bg, #1f2937); }

/* ── Bookmark block ───────────────────────────────────────────────────────── */
.spe-bookmark-block { position: relative; }
.spe-bookmark-card {
    display: flex; align-items: stretch;
    border: 1.5px solid var(--sc-border, #e5e7eb);
    border-radius: var(--sc-radius, 0.4rem);
    background: var(--sc-bg, #fff);
    overflow: hidden; text-decoration: none; color: inherit;
    transition: box-shadow .15s, border-color .15s;
    min-height: 80px;
}
.spe-bookmark-card:hover {
    box-shadow: var(--sc-shadow-sm, 0 1px 4px rgba(0,0,0,.08));
    border-color: var(--sc-focus, #6366f1);
}
.spe-bookmark-body {
    flex: 1 1 auto; min-width: 0;
    padding: 0.65rem 0.85rem; display: flex; flex-direction: column; gap: 0.25rem;
}
.spe-bookmark-title {
    font-weight: 600; font-size: 0.9rem; color: var(--sc-text, #1a1d23);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.spe-bookmark-desc {
    font-size: 0.8rem; color: var(--sc-text-muted, #6b7280);
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.spe-bookmark-url {
    display: flex; align-items: center; gap: 0.35rem; margin-top: auto;
    font-size: 0.72rem; color: var(--sc-text-muted, #9ca3af);
}
.spe-bookmark-favicon { width: 14px; height: 14px; border-radius: 2px; }
.spe-bookmark-thumb {
    flex: 0 0 140px; overflow: hidden;
    border-left: 1.5px solid var(--sc-border, #e5e7eb);
}
.spe-bookmark-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.spe-bookmark-controls {
    position: absolute; top: 0.3rem; right: 0.3rem;
    display: flex; gap: 4px; opacity: 0; transition: opacity .15s;
}
.spe-bookmark-block:hover .spe-bookmark-controls { opacity: 1; }
.spe-bookmark-remove {
    width: 22px; height: 22px; border-radius: .25rem;
    background: rgba(0,0,0,.55); border: none; color: #fff;
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    font-size: .75rem;
}
.spe-bookmark-empty {
    display: flex; align-items: center; gap: 0.65rem; padding: 0.75rem 0.85rem;
    background: var(--sc-bg-subtle, #f9fafb);
    border: 1.5px dashed var(--sc-border, #d1d5db);
    border-radius: var(--sc-radius, 0.4rem);
    color: var(--sc-text-muted, #9ca3af);
}
.spe-bookmark-empty i { font-size: 1.5rem; flex-shrink: 0; }
.spe-bookmark-empty-title { font-weight: 600; font-size: 0.875rem; color: var(--sc-text, #374151); }
.spe-bookmark-empty-hint  { font-size: 0.78rem; }
.spe-bookmark-loading {
    display: flex; align-items: center; gap: 0.5rem;
    padding: 0.5rem 0; color: var(--sc-text-muted, #6b7280); font-size: 0.8rem;
}
@keyframes spe-spin { to { transform: rotate(360deg); } }

/* ── Code language selector ───────────────────────────────────────────────── */
.spe-code-wrap { position: relative; }
.spe-lang-sel {
    position: absolute; top: 0.35rem; right: 2.4rem; z-index: 5;
    font-size: 0.7rem; padding: 0.1rem 0.3rem;
    background: var(--sc-bg-subtle, #e5e7eb);
    border: 1px solid var(--sc-border, #d1d5db);
    border-radius: 0.25rem; color: var(--sc-text-muted, #6b7280); cursor: pointer;
}
.spe-lang-badge {
    position: absolute; top: 0.35rem; right: 0.4rem; z-index: 5;
    font-size: 0.7rem; padding: 0.1rem 0.35rem;
    background: var(--sc-bg-subtle, #e5e7eb);
    border-radius: 0.25rem; color: var(--sc-text-muted, #6b7280);
}
.spe-code-copy {
    position: absolute; top: 0.35rem; right: 0.4rem; z-index: 5;
    background: var(--sc-bg-subtle, #e5e7eb); border: none;
    border-radius: 0.3rem; padding: 0.2rem 0.4rem;
    cursor: pointer; color: var(--sc-text-muted, #6b7280);
    font-size: 0.8rem; opacity: 0; transition: opacity .15s;
}
.spe-code-wrap:hover .spe-code-copy { opacity: 1; }
.spe-code-copy:hover { color: var(--sc-text, #1a1d23); }

/* Highlighted code overlay (VSCode paste / Prism) */
.spe-code-hl-view {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.855rem; line-height: 1.65; white-space: pre-wrap;
    padding: 0.65rem 0.85rem;
    background: var(--sc-bg-subtle, #1e1e1e);
    border-radius: var(--sc-radius, 0.4rem);
    cursor: text; min-height: 1.65em;
    overflow-x: auto;
}
/* Prism theme integration — Prism's own styles apply inside .spe-code-hl-view */
.spe-code-hl-view .token.comment,.spe-code-hl-view .token.prolog,.spe-code-hl-view .token.doctype,.spe-code-hl-view .token.cdata{color:#6a9955}
.spe-code-hl-view .token.keyword{color:#569cd6}
.spe-code-hl-view .token.string,.spe-code-hl-view .token.char{color:#ce9178}
.spe-code-hl-view .token.number{color:#b5cea8}
.spe-code-hl-view .token.function{color:#dcdcaa}
.spe-code-hl-view .token.class-name{color:#4ec9b0}
.spe-code-hl-view .token.operator,.spe-code-hl-view .token.punctuation{color:#d4d4d4}

/* ── Draft recovery banner ────────────────────────────────────────────────── */
.spe-draft-banner {
    display: flex; align-items: center; gap: 0.5rem;
    padding: 0.5rem 0.85rem; margin-bottom: 0.5rem;
    background: #eff6ff; border: 1.5px solid #93c5fd;
    border-radius: var(--sc-radius, 0.4rem);
    color: #1e40af; font-size: 0.8rem;
}
.spe-draft-banner i { flex-shrink: 0; font-size: 1rem; }
.spe-draft-banner span { flex: 1; }
.spe-draft-restore {
    padding: 0.2rem 0.55rem; border-radius: 0.3rem;
    background: #2563eb; color: #fff; border: none; cursor: pointer;
    font-size: 0.78rem; font-weight: 600; white-space: nowrap;
}
.spe-draft-restore:hover { background: #1d4ed8; }
.spe-draft-dismiss {
    padding: 0.1rem 0.3rem; border: none; background: transparent;
    color: inherit; cursor: pointer; font-size: 0.9rem; opacity: 0.7;
}
.spe-draft-dismiss:hover { opacity: 1; }

/* ── Utility ─────────────────────────────────────────────────────────────── */
.sc-hidden { display: none !important; }
        `;
        document.head.appendChild(s);
    }
}

customElements.define('smart-page-editor', SmartPageEditor);