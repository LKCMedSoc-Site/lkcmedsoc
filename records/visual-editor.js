// Visual (type-on-the-page) editor for group pages. Loaded on demand by pages.js; if it cannot load, pages.js keeps the plain markdown box.
//
// The page text stays Markdown (site/src/lib/markdown.ts). Rules that keep old pages safe:
//   - Until you change something, get() hands back the original text untouched, so merely opening and saving a page rewrites nothing.
//   - Every ::: block (callout, photos, quote, columns, toggle, button, video) is edited visually. When a block is opened, it is turned into editor
//     blocks and written back out; if that would not give exactly the same text (odd spacing, extra options, unclosed blocks), that one block stays as a
//     plain-text block (rendered preview plus an "Edit text" box) instead, so nothing is reshaped behind your back.
//   - Ordinary text (paragraphs, headings, lists, links, images, quotes, dividers) is edited on the page and written back as Markdown.
// Image size is written as ![alt](url){w=60 align=right}; the website and the preview both read it.
import { Editor, Node, mergeAttributes, createDocument } from 'https://esm.sh/@tiptap/core@2.10.3';
import HardBreak from 'https://esm.sh/@tiptap/extension-hard-break@2.10.3';
import StarterKit from 'https://esm.sh/@tiptap/starter-kit@2.10.3';
import Link from 'https://esm.sh/@tiptap/extension-link@2.10.3';
import Image from 'https://esm.sh/@tiptap/extension-image@2.10.3';

const OPENS = /^:::(callout|photos|quote|columns|toggle)(?:\s+.*)?$/;
const CLOSE = /^:::\s*$/;
const LABELS = { callout: 'Highlighted box', photos: 'Photo row', quote: 'Quote', columns: 'Columns', toggle: 'Toggle', button: 'Button', video: 'Video' };
const attr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// ---- Markdown <-> pieces -------------------------------------------------------------------------------------------------------------

/** Splits text into ordinary Markdown runs and whole ::: blocks (kept exactly as typed). */
export function segments(md) {
  const lines = String(md || '').replace(/\r/g, '').split('\n');
  const out = []; let buf = []; let i = 0;
  const flush = () => { if (buf.join('').trim()) out.push({ t: 'md', text: buf.join('\n') }); buf = []; };
  while (i < lines.length) {
    const ln = lines[i];
    if (OPENS.test(ln)) {
      flush(); const blk = [ln]; let open = 1; i++;
      while (i < lines.length) {
        const l = lines[i]; blk.push(l);
        if (CLOSE.test(l)) { open--; if (!open) { i++; break; } } else if (OPENS.test(l)) open++;
        i++;
      }
      out.push({ t: 'raw', text: blk.join('\n') }); continue;
    }
    if (/^:::(button|video)\s/.test(ln)) { flush(); out.push({ t: 'raw', text: ln.trimEnd() }); i++; continue; }
    buf.push(ln); i++;
  }
  flush();
  return out;
}

const IMG_LINE = /^!\[[^\]]*\]\([^)\s]+\)$/;
const norm = (t) => String(t).replace(/\r/g, '').split('\n').map((l) => l.replace(/\s+$/, '')).filter((l) => l.trim() !== '').join('\n');

/** One run of ordinary Markdown as HTML. Image sizes become attributes and single line breaks stay "soft" (they only look like a space on the site). */
function runHtml(text, marked) {
  return String(marked.parse(text))
    .replace(/<img ([^>]*?)\s*\/?>\{w=(\d{1,3})(?:\s+align=(left|center|right))?\}/g, (_m, a, w, al) => `<img ${a} data-w="${Math.min(100, Math.max(10, +w))}"${al ? ` data-align="${al}"` : ''}>`)
    .replace(/<p>([\s\S]*?)<\/p>/g, (_m, i) => '<p>' + i.replace(/\n/g, '<br data-soft="1">') + '</p>');
}

/** One ::: block as editor HTML, or null when it cannot be shown as blocks exactly (it then stays a text block). */
function blockHtml(text, ctx) {
  const lines = text.split('\n'), head = lines[0], kind = (/^:::(\w+)/.exec(head) || [])[1];
  if (kind === 'button') { const m = /^:::button\s+(.+?)\s*\|\s*(https?:\/\/\S+)\s*$/.exec(head); return m ? `<div data-blk="button" data-label="${attr(m[1])}" data-url="${attr(m[2])}"></div>` : null; }
  if (kind === 'video') { const m = /^:::video\s+(\S+)\s*$/.exec(head); return m ? `<div data-blk="video" data-url="${attr(m[1])}"></div>` : null; }
  if (lines.length < 2 || !CLOSE.test(lines[lines.length - 1])) return null;
  const inner = lines.slice(1, -1);
  if (kind === 'callout' || kind === 'quote') return `<div data-blk="${kind}">${mdHtml(inner.join('\n'), ctx)}</div>`;
  if (kind === 'toggle') return `<div data-blk="toggle" data-title="${attr(head.replace(/^:::toggle\s*/, '').trim())}">${mdHtml(inner.join('\n'), ctx)}</div>`;
  if (kind === 'columns') {
    const cols = [[]]; let nest = 0;
    for (const l of inner) { if (CLOSE.test(l)) nest--; else if (OPENS.test(l)) nest++; if (nest === 0 && /^\|\|\|\s*$/.test(l)) cols.push([]); else cols[cols.length - 1].push(l); }
    if (cols.length < 2 || cols.length > 4) return null;
    return `<div data-blk="columns">${cols.map((c) => `<div data-blk="column">${mdHtml(c.join('\n'), ctx) || '<p></p>'}</div>`).join('')}</div>`;
  }
  if (kind === 'photos') {
    const cols = /\bcols=([234])\b/.exec(head), shape = /\bshape=(square|round|wide)\b/.exec(head);
    const imgs = inner.filter((l) => l.trim() !== '');
    if (!imgs.length || !imgs.every((l) => IMG_LINE.test(l.trim()))) return null;
    return `<div data-blk="photos"${cols ? ` data-cols="${cols[1]}"` : ''}${shape ? ` data-shape="${shape[1]}"` : ''}>${imgs.map((l) => String(ctx.marked.parse(l.trim())).replace(/<\/?p>|\n/g, '')).join('')}</div>`;
  }
  return null;
}

const rawHtml = (text) => `<div data-raw-block="1" data-text="${attr(text)}"></div>`;

function mdHtml(md, ctx) {
  return segments(md).map((s) => {
    if (s.t === 'md') return runHtml(s.text, ctx.marked);
    const html = blockHtml(s.text, ctx);
    return html && (!ctx.verify || ctx.verify(html, s.text)) ? html : rawHtml(s.text);
  }).join('');
}

/** Markdown -> the HTML Tiptap loads. `marked` is the page's global; `verify(html, text)` says whether a block comes back out as the same text. */
export function toHtml(md, marked, verify) {
  return mdHtml(md, { marked, verify }) || '<p></p>';
}

const escText = (t) => t.replace(/[\\`*\[\]<]/g, '\\$&').replace(/(^|[^A-Za-z0-9])_|_(?=[^A-Za-z0-9]|$)/g, (m) => m.replace('_', '\\_'));
const escUrl = (u) => String(u).replace(/ /g, '%20').replace(/\)/g, '%29').replace(/\(/g, '%28');

function inline(nodes) {
  return (nodes || []).map((n) => {
    if (n.type === 'hardBreak') return n.attrs && n.attrs.soft ? '\n' : '  \n';
    const marks = (n.marks || []).map((m) => m.type); const link = (n.marks || []).find((m) => m.type === 'link');
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(n.text || '');
    if (!m[2]) return n.text || '';
    let core = marks.includes('code') ? '`' + m[2] + '`' : escText(m[2]);
    if (marks.includes('italic')) core = '*' + core + '*';
    if (marks.includes('bold')) core = '**' + core + '**';
    if (link) core = '[' + core + '](' + escUrl(link.attrs.href) + ')';
    return m[1] + core + m[3];
  }).join('');
}

const kids = (c) => c.map(block).filter((x) => x !== '').join('\n\n');
const fence = (open, inner) => open + '\n' + (inner ? inner + '\n' : '') + ':::';

function block(n) {
  const c = n.content || [];
  switch (n.type) {
    case 'paragraph': { const t = inline(c); return /^(#{1,6}\s|>|[-+*]\s|\d+[.)]\s|-{3,}|={3,}|:::)/.test(t) ? '\\' + t : t; }
    case 'heading': return '#'.repeat(n.attrs.level) + ' ' + inline(c);
    case 'bulletList': return list(c, false, 1);
    case 'orderedList': return list(c, true, n.attrs && n.attrs.start || 1);
    case 'blockquote': return c.map(block).filter(Boolean).join('\n\n').split('\n').map((l) => (l ? '> ' + l : '>')).join('\n');
    case 'horizontalRule': return '---';
    case 'codeBlock': return '```' + (n.attrs && n.attrs.language || '') + '\n' + c.map((x) => x.text || '').join('') + '\n```';
    case 'image': {
      const a = n.attrs, size = a.width && a.width < 100 ? '{w=' + a.width + (a.align && a.align !== 'left' ? ' align=' + a.align : '') + '}' : '';
      return '![' + String(a.alt || '').replace(/[\[\]]/g, '') + '](' + escUrl(a.src) + ')' + size;
    }
    case 'callout': return fence(':::callout', kids(c));
    case 'quote': return fence(':::quote', kids(c));
    case 'toggle': return fence(':::toggle' + (n.attrs.title ? ' ' + n.attrs.title : ''), kids(c));
    case 'columns': return fence(':::columns', c.map((col) => kids(col.content || [])).join('\n|||\n'));
    case 'photos': return fence(':::photos' + (n.attrs.cols ? ' cols=' + n.attrs.cols : '') + (n.attrs.shape ? ' shape=' + n.attrs.shape : ''), c.map((i) => '![' + String(i.attrs.alt || '').replace(/[\[\]]/g, '') + '](' + escUrl(i.attrs.src) + ')').join('\n'));
    case 'button': return ':::button ' + n.attrs.label + ' | ' + n.attrs.url;
    case 'video': return ':::video ' + n.attrs.url;
    case 'rawBlock': return String(n.attrs.text || '').replace(/\s+$/, '');
    default: return inline(c);
  }
}

function list(items, ordered, start) {
  return items.map((li, idx) => {
    const marker = ordered ? (start + idx) + '. ' : '- ', pad = ' '.repeat(marker.length);
    const parts = (li.content || []).map(block).filter((x) => x !== '');
    let text = parts[0] || '';
    for (let k = 1; k < parts.length; k++) text += (/^(\s*)([-*+]|\d+\.) /.test(parts[k]) ? '\n' : '\n\n') + parts[k];
    return marker + text.split('\n').map((l, j) => (j === 0 || !l ? l : pad + l)).join('\n');
  }).join('\n');
}

/** Tiptap JSON -> Markdown. */
export function toMarkdown(doc) {
  return (doc.content || []).map(block).filter((s) => s !== '').join('\n\n');
}

// ---- Editor blocks -------------------------------------------------------------------------------------------------------------------

function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function btn(label, title, fn, cls) { const b = el('button', cls || 'ghost sm', label); b.type = 'button'; b.title = title; b.addEventListener('mousedown', (e) => e.preventDefault()); b.addEventListener('click', fn); return b; }

const setAttrs = (editor, getPos, current, patch) => editor.view.dispatch(editor.state.tr.setNodeMarkup(getPos(), undefined, Object.assign({}, current.attrs, patch)));
function removeNode(editor, getPos, current) { const p = getPos(); editor.chain().focus().deleteRange({ from: p, to: p + current.nodeSize }).run(); }
function field(label, value, onInput, placeholder) {
  const wrap = el('label', 've-field'), i = el('input'); i.value = value || ''; i.placeholder = placeholder || ''; i.setAttribute('aria-label', label);
  i.addEventListener('input', () => onInput(i.value)); wrap.append(el('span', null, label), i); return { wrap, input: i };
}

/** A block that holds other blocks: a small header (name, its own controls, Remove) above editable content. */
function containerView(label, build) {
  return ({ node, getPos, editor }) => {
    let current = node;
    const dom = el('div', 've-blk'), head = el('div', 've-blk-head'), lab = el('strong', null, label), ctl = el('span', 've-blk-ctl'), body = el('div', 've-blk-body');
    dom.classList.add('ve-k-' + node.type.name); head.contentEditable = 'false';
    head.append(lab, ctl, btn('Remove', 'Delete this block', () => removeNode(editor, getPos, current), 'ghost sm'));
    dom.append(head, body);
    const extra = (build && build({ node, getPos, editor, ctl, body, dom, get: () => current })) || {};
    return {
      dom, contentDOM: body,
      stopEvent: (e) => head.contains(e.target),
      ignoreMutation: (m) => m.target !== body && !body.contains(m.target),
      update: (n) => { if (n.type !== current.type) return false; current = n; extra.update && extra.update(n); return true; },
    };
  };
}

function makeExtensions(opts) {
  const render = opts.render;
  /** A block kept as plain text: shown rendered; "Edit text" opens its Markdown. Used for anything that cannot be shown as blocks exactly. */
  const RawBlock = Node.create({
    name: 'rawBlock', group: 'block', atom: true, selectable: true, draggable: true,
    addAttributes() { return { text: { default: '', parseHTML: (e) => e.getAttribute('data-text') || '', renderHTML: (a) => ({ 'data-text': a.text }) } }; },
    parseHTML() { return [{ tag: 'div[data-raw-block]' }]; },
    renderHTML({ HTMLAttributes }) { return ['div', mergeAttributes(HTMLAttributes, { 'data-raw-block': '1' })]; },
    addNodeView() {
      return ({ node, getPos, editor }) => {
        let current = node, editing = false;
        const dom = el('div', 've-raw'); dom.contentEditable = 'false';
        const head = el('div', 've-raw-head'), label = el('strong'), actions = el('span', 've-raw-actions');
        const edit = btn('Edit text', 'Edit this block as Markdown text', () => { editing = !editing; paint(); });
        actions.append(edit, btn('Remove', 'Delete this block', () => removeNode(editor, getPos, current))); head.append(label, actions);
        const view = el('div', 've-raw-view prose'), ta = el('textarea', 've-raw-text'); ta.spellcheck = false;
        ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; setAttrs(editor, getPos, current, { text: ta.value }); });
        dom.append(head, view, ta);
        function paint() {
          const kind = /^:::(\w+)/.exec(current.attrs.text); label.textContent = (LABELS[kind && kind[1]] || 'Block') + ' (text)';
          edit.textContent = editing ? 'Done' : 'Edit text';
          view.hidden = editing; ta.hidden = !editing;
          if (!editing) view.innerHTML = render(current.attrs.text) || '';
          else { if (ta.value !== current.attrs.text) ta.value = current.attrs.text; ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; }
        }
        paint();
        return { dom, stopEvent: (e) => head.contains(e.target) || ta.contains(e.target), ignoreMutation: () => true, update: (n) => { if (n.type !== current.type) return false; current = n; if (!editing) paint(); return true; } };
      };
    },
  });

  /** An image you can drag to resize and align. Written as {w=60 align=right}; full width writes nothing. Inside a photo row the size controls are hidden. */
  const SizedImage = Image.extend({
    addAttributes() {
      return {
        ...this.parent?.(),
        width: { default: null, parseHTML: (e) => (e.getAttribute('data-w') ? Number(e.getAttribute('data-w')) : null), renderHTML: (a) => (a.width ? { 'data-w': a.width, style: 'width:' + a.width + '%' } : {}) },
        align: { default: null, parseHTML: (e) => e.getAttribute('data-align'), renderHTML: (a) => (a.align ? { 'data-align': a.align } : {}) },
      };
    },
    addNodeView() {
      return ({ node, getPos, editor }) => {
        let current = node;
        const dom = el('div', 've-img'), box = el('div', 've-img-box'), img = el('img'), handle = el('span', 've-img-handle'), bar = el('div', 've-img-bar');
        handle.title = 'Drag to resize'; handle.setAttribute('role', 'slider');
        const set = (patch) => setAttrs(editor, getPos, current, patch);
        const sz = (b) => { b.classList.add('ve-sz'); return b; };
        bar.append(
          sz(btn('Left', 'Align left', () => set({ align: null }))), sz(btn('Centre', 'Centre', () => set({ align: 'center' }))), sz(btn('Right', 'Align right', () => set({ align: 'right' }))),
          sz(btn('Full width', 'Back to full width', () => set({ width: null, align: null }))),
          btn('Alt text', 'Describe the picture for people who cannot see it', () => { const t = prompt('Describe the picture (read aloud for people who cannot see it)', current.attrs.alt || ''); if (t !== null) set({ alt: t }); }),
          btn('Remove', 'Delete this picture', () => removeNode(editor, getPos, current)));
        box.append(img, handle, bar); dom.append(box);
        function paint() {
          img.src = current.attrs.src; img.alt = current.attrs.alt || '';
          box.style.width = (current.attrs.width || 100) + '%';
          dom.dataset.align = current.attrs.align || 'left';
          handle.setAttribute('aria-valuenow', String(current.attrs.width || 100));
        }
        handle.addEventListener('pointerdown', (e) => {
          e.preventDefault(); e.stopPropagation(); handle.setPointerCapture(e.pointerId);
          const full = dom.clientWidth, x0 = e.clientX, w0 = box.getBoundingClientRect().width; let w = current.attrs.width || 100;
          const move = (ev) => { w = Math.min(100, Math.max(10, Math.round(((w0 + ev.clientX - x0) / full) * 100 / 5) * 5)); box.style.width = w + '%'; };
          const up = () => { handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', up); set({ width: w >= 100 ? null : w }); };
          handle.addEventListener('pointermove', move); handle.addEventListener('pointerup', up);
        });
        paint();
        return { dom, stopEvent: (e) => bar.contains(e.target) || e.target === handle, ignoreMutation: () => true, update: (n) => { if (n.type !== current.type) return false; current = n; paint(); return true; } };
      };
    },
  }).configure({ inline: false });

  const blk = (name, label, extra) => Node.create(Object.assign({
    name, group: 'block', content: 'block+', defining: true,
    parseHTML() { return [{ tag: `div[data-blk="${name}"]` }]; },
    renderHTML() { return ['div', { 'data-blk': name }, 0]; },
    addNodeView() { return containerView(label); },
  }, extra));

  const Callout = blk('callout', 'Highlighted box');
  const Quote = blk('quote', 'Quote');
  const Toggle = blk('toggle', 'Toggle (opens and closes)', {
    addAttributes() { return { title: { default: '', parseHTML: (e) => e.getAttribute('data-title') || '', renderHTML: (a) => ({ 'data-title': a.title }) } }; },
    addNodeView() {
      return containerView('Toggle (opens and closes)', ({ node, getPos, editor, ctl, get }) => {
        const f = field('Title', node.attrs.title, (v) => setAttrs(editor, getPos, get(), { title: v.replace(/\n/g, ' ') }), 'Question or title'); ctl.append(f.wrap);
        return { update: (n) => { if (f.input.value !== n.attrs.title) f.input.value = n.attrs.title; } };
      });
    },
  });
  const Column = Node.create({ name: 'column', content: 'block+', isolating: true, parseHTML() { return [{ tag: 'div[data-blk="column"]' }]; }, renderHTML() { return ['div', { 'data-blk': 'column', class: 've-col' }, 0]; } });
  const Columns = Node.create({
    name: 'columns', group: 'block', content: 'column{2,4}', defining: true, isolating: true,
    parseHTML() { return [{ tag: 'div[data-blk="columns"]' }]; }, renderHTML() { return ['div', { 'data-blk': 'columns', class: 've-columns' }, 0]; },
    addNodeView() {
      return containerView('Columns', ({ editor, getPos, ctl, body, get }) => {
        body.classList.add('ve-columns');
        const add = btn('+ Column', 'Add a column', () => { const n = get(); if (n.childCount < 4) editor.chain().focus().insertContentAt(getPos() + n.nodeSize - 1, { type: 'column', content: [{ type: 'paragraph' }] }).run(); });
        const less = btn('− Column', 'Remove the last column', () => {
          const n = get(); if (n.childCount <= 2) return; const last = n.lastChild;
          if (last.textContent.trim() && !confirm('Remove the last column and what is in it?')) return;
          const end = getPos() + n.nodeSize - 1; editor.chain().focus().deleteRange({ from: end - last.nodeSize, to: end }).run();
        });
        ctl.append(add, less);
        return { update: (n) => { add.disabled = n.childCount >= 4; less.disabled = n.childCount <= 2; } };
      });
    },
  });
  const Photos = Node.create({
    name: 'photos', group: 'block', content: 'image+', defining: true,
    addAttributes() {
      return {
        cols: { default: null, parseHTML: (e) => e.getAttribute('data-cols'), renderHTML: (a) => (a.cols ? { 'data-cols': a.cols } : {}) },
        shape: { default: null, parseHTML: (e) => e.getAttribute('data-shape'), renderHTML: (a) => (a.shape ? { 'data-shape': a.shape } : {}) },
      };
    },
    parseHTML() { return [{ tag: 'div[data-blk="photos"]' }]; }, renderHTML({ HTMLAttributes }) { return ['div', mergeAttributes(HTMLAttributes, { 'data-blk': 'photos' }), 0]; },
    addNodeView() {
      return containerView('Photo row', ({ node, getPos, editor, ctl, body, get }) => {
        body.classList.add('ve-photos');
        const sel = (label, choices, key) => {
          const s = el('select'); s.setAttribute('aria-label', label);
          choices.forEach(([v, t]) => s.append(new Option(t, v)));
          s.addEventListener('change', () => setAttrs(editor, getPos, get(), { [key]: s.value || null }));
          return s;
        };
        const cols = sel('Photos per row', [['', 'Photos per row: auto'], ['2', '2 per row'], ['3', '3 per row'], ['4', '4 per row']], 'cols');
        const shape = sel('Crop shape', [['', 'Crop: as uploaded'], ['square', 'Square'], ['round', 'Round'], ['wide', 'Wide (16:9)']], 'shape');
        const file = el('input'); file.type = 'file'; file.accept = 'image/*'; file.multiple = true; file.hidden = true;
        file.addEventListener('change', async () => {
          const files = [...file.files]; file.value = '';
          for (const f of files) { try { const src = await opts.upload(f); const n = get(); editor.chain().insertContentAt(getPos() + n.nodeSize - 1, { type: 'image', attrs: { src, alt: '' } }).run(); } catch (e) { opts.onError && opts.onError(e); break; } }
        });
        ctl.append(cols, shape, btn('+ Photos', 'Add photos to this row', () => file.click()), file);
        const paint = (n) => { cols.value = n.attrs.cols || ''; shape.value = n.attrs.shape || ''; body.dataset.cols = n.attrs.cols || ''; body.dataset.shape = n.attrs.shape || ''; };
        paint(node);
        return { update: paint };
      });
    },
  });
  const Button = Node.create({
    name: 'button', group: 'block', atom: true, selectable: true,
    addAttributes() { return { label: { default: 'Join us', parseHTML: (e) => e.getAttribute('data-label') }, url: { default: 'https://', parseHTML: (e) => e.getAttribute('data-url') } }; },
    parseHTML() { return [{ tag: 'div[data-blk="button"]' }]; }, renderHTML({ node }) { return ['div', { 'data-blk': 'button', 'data-label': node.attrs.label, 'data-url': node.attrs.url }]; },
    addNodeView() {
      return ({ node, getPos, editor }) => {
        let current = node;
        const dom = el('div', 've-blk ve-atom'); dom.contentEditable = 'false';
        const head = el('div', 've-blk-head'), pill = el('span', 'blk-button ve-pill'), warn = el('span', 'muted');
        const l = field('Button text', node.attrs.label, (v) => setAttrs(editor, getPos, current, { label: v.replace(/[|\n]/g, ' ') }));
        const u = field('Goes to', node.attrs.url, (v) => setAttrs(editor, getPos, current, { url: v.trim() }), 'https://…');
        head.append(el('strong', null, 'Button'), btn('Remove', 'Delete this block', () => removeNode(editor, getPos, current)));
        const fields = el('div', 've-fields'); fields.append(l.wrap, u.wrap, warn); dom.append(head, pill, fields);
        function paint() { pill.textContent = current.attrs.label || 'Button'; warn.textContent = /^https?:\/\/\S+$/.test(current.attrs.url) && current.attrs.label.trim() ? '' : 'The link must start with https:// and the button needs text, or it will not show on the website.'; }
        paint();
        return { dom, stopEvent: (e) => dom.contains(e.target), ignoreMutation: () => true, update: (n) => { if (n.type !== current.type) return false; current = n; paint(); return true; } };
      };
    },
  });
  const Video = Node.create({
    name: 'video', group: 'block', atom: true, selectable: true,
    addAttributes() { return { url: { default: '', parseHTML: (e) => e.getAttribute('data-url') } }; },
    parseHTML() { return [{ tag: 'div[data-blk="video"]' }]; }, renderHTML({ node }) { return ['div', { 'data-blk': 'video', 'data-url': node.attrs.url }]; },
    addNodeView() {
      return ({ node, getPos, editor }) => {
        let current = node;
        const dom = el('div', 've-blk ve-atom'); dom.contentEditable = 'false';
        const head = el('div', 've-blk-head'), view = el('div', 've-video');
        const u = field('Video link (YouTube or Vimeo)', node.attrs.url, (v) => setAttrs(editor, getPos, current, { url: v.trim() }), 'https://youtu.be/…');
        head.append(el('strong', null, 'Video'), btn('Remove', 'Delete this block', () => removeNode(editor, getPos, current)));
        dom.append(head, u.wrap, view);
        let shown = null;
        function paint() {
          const e = opts.videoEmbed ? opts.videoEmbed(current.attrs.url) : null;
          if (e === shown && view.firstChild) return; shown = e; view.replaceChildren();
          if (e) { const f = el('iframe'); f.src = e; f.title = 'Video preview'; f.setAttribute('allowfullscreen', ''); view.append(f); } else view.append(el('span', 'muted', 'Paste a YouTube or Vimeo link (https://…) to see the video here.'));
        }
        paint();
        return { dom, stopEvent: (e) => dom.contains(e.target), ignoreMutation: () => true, update: (n) => { if (n.type !== current.type) return false; current = n; paint(); return true; } };
      };
    },
  });
  const Breaks = HardBreak.extend({ addAttributes() { return { soft: { default: false, parseHTML: (e) => e.hasAttribute('data-soft'), renderHTML: (a) => (a.soft ? { 'data-soft': '1' } : {}) } }; } });

  return [
    StarterKit.configure({ heading: { levels: [2, 3, 4] }, strike: false, hardBreak: false }), Breaks,
    Link.configure({ openOnClick: false, autolink: false, HTMLAttributes: { rel: null, target: null } }),
    SizedImage, RawBlock, Callout, Quote, Toggle, Column, Columns, Photos, Button, Video,
  ];
}

const TEMPLATES = {
  'Join button': (u) => ':::button Join us | ' + u,
  Callout: () => ':::callout\nImportant note here.\n:::',
  Quote: () => ':::quote\n“What a memorable experience.”\n\n— Name, Year 3\n:::',
  '2 columns': () => ':::columns\n## Left column\nWrite here.\n|||\n## Right column\nWrite here.\n:::',
  '3 columns': () => ':::columns\n### One\nWrite here.\n|||\n### Two\nWrite here.\n|||\n### Three\nWrite here.\n:::',
  Toggle: () => ':::toggle Question or title\nThe answer or details go here.\n:::',
  Video: (u) => ':::video ' + u,
};

/**
 * create({ markdown, marked, render, upload, videoEmbed, onError }) -> { el, get, setMarkdown, destroy }
 *   render(md)   turns Markdown into safe HTML (the same renderer the Preview button uses)
 *   upload(file) uploads an image and resolves to its public address
 *   videoEmbed(url) gives the embed address for a YouTube or Vimeo link, or null
 */
export function create(opts) {
  const marked = opts.marked;
  const root = el('div', 've'), toolbar = el('div', 'toolbar'), page = el('div', 've-page prose');
  root.append(toolbar, page);
  let original = opts.markdown || '', changed = false;

  const editor = new Editor({
    element: page, extensions: makeExtensions(opts), content: '',
    editorProps: { attributes: { class: 've-content', 'aria-label': 'Page text' } },
    onUpdate: () => { changed = true; },
  });
  /** A block only becomes editor blocks if writing it back gives the same text (ignoring blank lines). */
  const verify = (html, text) => { try { return norm(toMarkdown(createDocument(html, editor.schema).toJSON())) === norm(text); } catch (e) { return false; } };
  // Loading is not an undo step: Undo right after opening must not empty the page.
  const load = (md) => editor.chain().setMeta('addToHistory', false).setContent(toHtml(md, marked, verify), false).run();
  load(original);

  const run = () => editor.chain().focus();
  const on = (name, a) => () => editor.isActive(name, a);
  const active = [];
  function tool(label, title, fn, isOn) { const b = btn(label, title, fn); if (isOn) active.push([b, isOn]); return b; }
  // New blocks go after the top-level block the cursor is in (or replace it if it is an empty paragraph), never inside a column or box by accident.
  const insertTop = (content) => {
    const { selection } = editor.state, $f = selection.$from;
    if ($f.depth < 1) { run().insertContent(content).run(); return; }
    const top = $f.node(1), empty = top.type.name === 'paragraph' && top.content.size === 0;
    run().insertContentAt(empty ? { from: $f.before(1), to: $f.after(1) } : selection.$to.after(1), content).run();
  };
  const insertText = (text) => insertTop(toHtml(text, marked));
  const addBlock = (name) => {
    let u = '';
    if (name === 'Join button' || name === 'Video') { u = prompt(name === 'Video' ? 'Video link (YouTube or Vimeo)' : 'Where should the button go? (https://…)'); if (!u) return; u = u.trim(); }
    insertText(TEMPLATES[name](u));
  };
  const fileIn = el('input'); fileIn.type = 'file'; fileIn.accept = 'image/*'; fileIn.hidden = true;
  const rowIn = el('input'); rowIn.type = 'file'; rowIn.accept = 'image/*'; rowIn.multiple = true; rowIn.hidden = true;
  fileIn.addEventListener('change', async () => {
    const f = fileIn.files[0]; fileIn.value = ''; if (!f) return;
    try { const src = await opts.upload(f); const alt = prompt('Describe the photo (read aloud for people who cannot see it)', '') || ''; run().setImage({ src, alt }).run(); }
    catch (e) { opts.onError && opts.onError(e); }
  });
  rowIn.addEventListener('change', async () => {
    const files = [...rowIn.files]; rowIn.value = ''; const imgs = [];
    for (const f of files) { try { imgs.push({ type: 'image', attrs: { src: await opts.upload(f), alt: '' } }); } catch (e) { opts.onError && opts.onError(e); break; } }
    if (imgs.length) insertTop({ type: 'photos', content: imgs });
  });
  const addSel = el('select', 've-add'); addSel.setAttribute('aria-label', 'Add a block');
  addSel.append(new Option('+ Add a block…', ''), new Option('Photo row', 'Photo row'), ...Object.keys(TEMPLATES).map((k) => new Option(k, k)));
  addSel.addEventListener('change', () => { const v = addSel.value; addSel.value = ''; if (v === 'Photo row') rowIn.click(); else if (v) addBlock(v); });
  toolbar.append(
    tool('H2', 'Section heading', () => run().toggleHeading({ level: 2 }).run(), on('heading', { level: 2 })),
    tool('H3', 'Smaller heading', () => run().toggleHeading({ level: 3 }).run(), on('heading', { level: 3 })),
    tool('B', 'Bold', () => run().toggleBold().run(), on('bold')),
    tool('I', 'Italic', () => run().toggleItalic().run(), on('italic')),
    tool('Link', 'Link', () => {
      const cur = editor.getAttributes('link').href || '';
      const u = prompt('Link address (starts with https://). Leave empty to remove the link.', cur); if (u === null) return;
      if (!u.trim()) run().extendMarkRange('link').unsetLink().run(); else run().extendMarkRange('link').setLink({ href: u.trim() }).run();
    }, on('link')),
    tool('• List', 'Bulleted list', () => run().toggleBulletList().run(), on('bulletList')),
    tool('1. List', 'Numbered list', () => run().toggleOrderedList().run(), on('orderedList')),
    tool('❝', 'Indented quote', () => run().toggleBlockquote().run(), on('blockquote')),
    tool('―', 'A thin line between sections', () => run().setHorizontalRule().run()),
    tool('Photo', 'Upload and insert a photo', () => fileIn.click()),
    el('span', 'sep'), addSel, el('span', 'sep'),
    tool('Undo', 'Undo', () => run().undo().run()), tool('Redo', 'Redo', () => run().redo().run()), fileIn, rowIn);
  const refresh = () => active.forEach(([b, f]) => b.setAttribute('aria-pressed', f() ? 'true' : 'false'));
  editor.on('selectionUpdate', refresh); editor.on('transaction', refresh);

  return {
    el: root, editor,
    /** The page text. Untouched pages come back exactly as they were opened. */
    get: () => (changed ? toMarkdown(editor.getJSON()) : original),
    setMarkdown(md) { original = md || ''; load(original); changed = false; },
    destroy: () => editor.destroy(),
  };
}
