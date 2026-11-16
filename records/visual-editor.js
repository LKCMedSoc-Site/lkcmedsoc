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

/** Ordinary Markdown split at blank lines (code fences stay whole), so one table or odd paragraph does not freeze the text around it. */
export function chunks(text) {
  const out = []; let buf = [], fence = false;
  for (const l of String(text).split('\n')) {
    const edge = /^\s*(```|~~~)/.test(l);
    if (edge) fence = !fence;
    if (!fence && !edge && !/\S/.test(l)) { if (buf.length) { out.push(buf.join('\n')); buf = []; } } else buf.push(l);
  }
  if (buf.length) out.push(buf.join('\n'));
  return out;
}

function mdHtml(md, ctx) {
  return segments(md).map((s) => {
    if (s.t === 'md') return chunks(s.text).map((c) => { const html = runHtml(c, ctx.marked); return !ctx.verifyMd || ctx.verifyMd(html, c) ? html : rawHtml(c); }).join('');
    const html = blockHtml(s.text, ctx);
    return html && (!ctx.verify || ctx.verify(html, s.text)) ? html : rawHtml(s.text);
  }).join('');
}

/** Markdown -> the HTML Tiptap loads. `marked` is the page's global; `verify(html, text)` says whether a ::: block comes back out as the same text,
 *  and `verifyMd(html, text)` whether an ordinary paragraph, list, heading... comes back out looking the same on the page. Anything that does not stays text. */
export function toHtml(md, marked, verify, verifyMd) {
  return mdHtml(md, { marked, verify, verifyMd }) || '<p></p>';
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

// Small icons for the toolbar (24x24 paths).
const ICONS = {
  undo: 'M12.5 8c-2.65 0-5.05 1-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z',
  redo: 'M18.4 10.6C16.55 9 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z',
  bullets: 'M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z',
  numbers: 'M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z',
  link: 'M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z',
  quote: 'M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z',
  image: 'M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z',
  plus: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
  caret: 'M10 17l5-5-5-5v10z',
};
function icon(name) { return '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="' + ICONS[name] + '"/></svg>'; }

/** A small pop-up list under a button (the Insert and Photo menus). Closes on a click elsewhere, on Escape or on choosing an item. */
let openMenu = null;
function closeMenu() { if (openMenu) { openMenu.remove(); openMenu = null; document.removeEventListener('mousedown', outside, true); document.removeEventListener('keydown', esc, true); } }
function outside(e) { if (openMenu && !openMenu.contains(e.target) && !e.target.closest('[data-menu-anchor]')) closeMenu(); }
function esc(e) { if (e.key === 'Escape') closeMenu(); }
function showMenu(anchor, items) {
  const was = openMenu && openMenu.dataset.for === anchor.title; closeMenu(); if (was) return;
  const m = el('div', 've-menu'); m.setAttribute('role', 'menu'); m.dataset.for = anchor.title;
  items.forEach((it) => {
    if (it === '-') { m.append(el('hr')); return; }
    const b = el('button'); b.type = 'button'; b.setAttribute('role', 'menuitem'); b.append(el('strong', null, it.label)); if (it.hint) b.append(el('span', null, it.hint));
    b.addEventListener('mousedown', (e) => e.preventDefault()); b.addEventListener('click', () => { closeMenu(); it.run(); }); m.append(b);
  });
  const r = anchor.getBoundingClientRect(); m.style.top = r.bottom + 4 + 'px'; m.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 280)) + 'px';
  document.body.append(m); openMenu = m;
  document.addEventListener('mousedown', outside, true); document.addEventListener('keydown', esc, true);
}

const setAttrs = (editor, getPos, current, patch) => editor.view.dispatch(editor.state.tr.setNodeMarkup(getPos(), undefined, Object.assign({}, current.attrs, patch)));
function removeNode(editor, getPos, current) { const p = getPos(); editor.chain().focus().deleteRange({ from: p, to: p + current.nodeSize }).run(); }
function field(label, value, onInput, placeholder) {
  const wrap = el('label', 've-field'), i = el('input'); i.value = value || ''; i.placeholder = placeholder || ''; i.setAttribute('aria-label', label);
  i.addEventListener('input', () => onInput(i.value)); wrap.append(el('span', null, label), i); return { wrap, input: i };
}

/** A block that holds other blocks. It looks like the page; its name, controls and Remove appear as a small bar when you point at it or click inside it. */
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
          const kind = /^:::(\w+)/.exec(current.attrs.text); label.textContent = kind ? (LABELS[kind[1]] || 'Block') + ' (kept as text)' : 'Kept exactly as written (the page editor cannot show this part)';
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

  /** An image you can drag to resize and align (or drag, as a whole, into another place or into a gallery). Written as {w=60 align=right}; full width writes nothing. */
  const SizedImage = Image.extend({
    draggable: true,
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
        handle.title = 'Drag to resize'; handle.setAttribute('role', 'slider'); img.draggable = false;
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
  const Quote = blk('quote', 'Pull quote');
  /** A collapsible section, drawn like Notion's and Google Docs': an arrow and the title on one line, the content indented below. The arrow folds it here too. */
  const Toggle = blk('toggle', 'Collapsible section', {
    addAttributes() { return { title: { default: '', parseHTML: (e) => e.getAttribute('data-title') || '', renderHTML: (a) => ({ 'data-title': a.title }) } }; },
    addNodeView() {
      return ({ node, getPos, editor }) => {
        let current = node;
        const dom = el('div', 've-toggle'), head = el('div', 've-toggle-head'), caret = el('button', 've-caret'), title = el('input', 've-toggle-title'), body = el('div', 've-toggle-body');
        head.contentEditable = 'false'; caret.type = 'button'; caret.title = 'Fold or unfold'; caret.innerHTML = icon('caret'); caret.setAttribute('aria-expanded', 'true');
        caret.addEventListener('mousedown', (e) => e.preventDefault());
        caret.addEventListener('click', () => { const folded = dom.classList.toggle('folded'); caret.setAttribute('aria-expanded', String(!folded)); });
        title.value = node.attrs.title || ''; title.placeholder = 'Section title (people click it to open)'; title.setAttribute('aria-label', 'Section title');
        title.addEventListener('input', () => setAttrs(editor, getPos, current, { title: title.value.replace(/\n/g, ' ') }));
        head.append(caret, title, btn('Remove', 'Delete this section', () => removeNode(editor, getPos, current), 'ghost sm ve-rm'));
        dom.append(head, body);
        return {
          dom, contentDOM: body,
          stopEvent: (e) => head.contains(e.target),
          ignoreMutation: (m) => m.target !== body && !body.contains(m.target),
          update: (n) => { if (n.type !== current.type) return false; current = n; if (title.value !== n.attrs.title && document.activeElement !== title) title.value = n.attrs.title || ''; return true; },
        };
      };
    },
  });
  const Column = Node.create({ name: 'column', content: 'block+', isolating: true, parseHTML() { return [{ tag: 'div[data-blk="column"]' }]; }, renderHTML() { return ['div', { 'data-blk': 'column', class: 've-col' }, 0]; } });
  const Columns = Node.create({
    name: 'columns', group: 'block', content: 'column{2,4}', defining: true, isolating: true,
    parseHTML() { return [{ tag: 'div[data-blk="columns"]' }]; }, renderHTML() { return ['div', { 'data-blk': 'columns', class: 've-columns' }, 0]; },
    addNodeView() {
      return containerView('Columns', ({ editor, getPos, ctl, body, get }) => {
        body.classList.add('ve-columns');
        const add = btn('Add a column', 'Add a column on the right (up to 4)', () => { const n = get(); if (n.childCount < 4) editor.chain().focus().insertContentAt(getPos() + n.nodeSize - 1, { type: 'column', content: [{ type: 'paragraph' }] }).run(); });
        const less = btn('Remove last column', 'Remove the right-most column', () => {
          const n = get(); if (n.childCount <= 2) return; const last = n.lastChild;
          if (last.textContent.trim() && !confirm('Remove the last column and what is in it?')) return;
          const end = getPos() + n.nodeSize - 1; editor.chain().focus().deleteRange({ from: end - last.nodeSize, to: end }).run();
        });
        ctl.append(add, less);
        return { update: (n) => { add.disabled = n.childCount >= 4; less.disabled = n.childCount <= 2; body.dataset.n = String(n.childCount); } };
      });
    },
  });
  /** A gallery: photos laid out like a masonry wall (each keeps its own shape). Drop picture files on it, or drag a picture in, to add to it. */
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
      return containerView('Gallery', ({ node, getPos, editor, ctl, body, get }) => {
        body.classList.add('ve-photos');
        const sel = (label, choices, key) => {
          const s = el('select'); s.setAttribute('aria-label', label); s.title = label;
          choices.forEach(([v, t]) => s.append(new Option(t, v)));
          s.addEventListener('change', () => setAttrs(editor, getPos, get(), { [key]: s.value || null }));
          return s;
        };
        const shape = sel('How the photos are laid out', [['', 'Layout: masonry (natural shapes)'], ['square', 'Layout: squares'], ['wide', 'Layout: wide (16:9)'], ['round', 'Layout: circles']], 'shape');
        const cols = sel('Photos per row', [['', 'Columns: automatic'], ['2', '2 columns'], ['3', '3 columns'], ['4', '4 columns']], 'cols');
        const file = el('input'); file.type = 'file'; file.accept = 'image/*'; file.multiple = true; file.hidden = true;
        file.addEventListener('change', async () => { const files = [...file.files]; file.value = ''; opts.addFiles && opts.addFiles(files, getPos() + get().nodeSize - 1); });
        ctl.append(btn('Add photos', 'Add more photos to this gallery (or drag picture files onto it)', () => file.click()), shape, cols, file);
        const paint = (n) => { shape.value = n.attrs.shape || ''; cols.value = n.attrs.cols || ''; body.dataset.cols = n.attrs.cols || ''; body.dataset.shape = n.attrs.shape || ''; };
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
  const root = el('div', 've'), toolbar = el('div', 'toolbar ve-toolbar'), page = el('div', 've-page prose');
  root.append(toolbar, page);
  let original = opts.markdown || '', changed = false;

  /** Uploads picture files and adds them: into the gallery they were dropped on, else as one picture (or, for several files, a new gallery) after the block at `pos` (or the cursor). */
  async function addFiles(files, pos) {
    const imgs = [...files].filter((f) => /^image\//.test(f.type)); if (!imgs.length) return;
    const nodes = [];
    for (const f of imgs) { try { nodes.push({ type: 'image', attrs: { src: await opts.upload(f), alt: '' } }); } catch (e) { opts.onError && opts.onError(e); break; } }
    if (!nodes.length) return;
    const doc = editor.state.doc, at = pos == null ? editor.state.selection.from : Math.min(Math.max(pos, 0), doc.content.size), $p = doc.resolve(at);
    for (let d = $p.depth; d >= 0; d--) if ($p.node(d).type.name === 'photos') { editor.chain().insertContentAt($p.after(d) - 1, nodes).run(); return; }
    insertTop(nodes.length > 1 ? { type: 'photos', content: nodes } : nodes[0], pos);
  }

  const editor = new Editor({
    element: page, extensions: makeExtensions(Object.assign({}, opts, { addFiles })), content: '',
    editorProps: {
      attributes: { class: 've-content', 'aria-label': 'Page text' },
      // Picture files dragged onto the page or pasted in are uploaded and placed where they were dropped.
      handleDrop: (view, ev) => {
        const files = ev.dataTransfer && ev.dataTransfer.files; if (!files || !files.length || ![...files].some((f) => /^image\//.test(f.type))) return false;
        ev.preventDefault(); const at = view.posAtCoords({ left: ev.clientX, top: ev.clientY }); addFiles(files, at ? at.pos : null); return true;
      },
      handlePaste: (view, ev) => {
        const files = ev.clipboardData && ev.clipboardData.files; if (!files || !files.length || ![...files].some((f) => /^image\//.test(f.type))) return false;
        ev.preventDefault(); addFiles(files, null); return true;
      },
    },
    onUpdate: () => { changed = true; tidy(); },
  });
  /** A gallery with no pictures left (the last one was dragged out) is removed. */
  function tidy() {
    const gone = []; editor.state.doc.descendants((n, pos) => { if (n.type.name === 'photos' && !n.content.content.some((c) => c.attrs.src)) gone.push([pos, pos + n.nodeSize]); });
    if (gone.length) { const tr = editor.state.tr; gone.reverse().forEach(([a, b]) => tr.delete(a, b)); editor.view.dispatch(tr); }
  }
  /** A block only becomes editor blocks if writing it back gives the same text (ignoring blank lines). */
  const verify = (html, text) => { try { return norm(toMarkdown(createDocument(html, editor.schema).toJSON())) === norm(text); } catch (e) { return false; } };
  // Ordinary text is safe if writing it back gives something that looks the same on the page (a table, a "# " title, crossed-out text or HTML tags do not, so they stay as text).
  const canon = (t) => String(marked.parse(norm(t))).replace(/\s+/g, ' ').trim();
  const verifyMd = (html, text) => { try { return canon(toMarkdown(createDocument(html, editor.schema).toJSON())) === canon(text); } catch (e) { return false; } };
  // Loading is not an undo step: Undo right after opening must not empty the page.
  const load = (md) => editor.chain().setMeta('addToHistory', false).setContent(toHtml(md, marked, verify, verifyMd), false).run();
  load(original);

  const run = () => editor.chain().focus();
  // New blocks go after the top-level block the cursor is in (or replace it if it is an empty paragraph), never inside a column or box by accident.
  function insertTop(content, pos) {
    const { selection } = editor.state, $f = typeof pos === 'number' ? editor.state.doc.resolve(Math.min(pos, editor.state.doc.content.size)) : selection.$from;
    if ($f.depth < 1) { run().insertContent(content).run(); return; }
    const top = $f.node(1), empty = top.type.name === 'paragraph' && top.content.size === 0;
    run().insertContentAt(empty ? { from: $f.before(1), to: $f.after(1) } : $f.after(1), content).run();
  }
  const insertText = (text) => insertTop(toHtml(text, marked));
  const addBlock = (name) => {
    let u = '';
    if (name === 'Join button' || name === 'Video') { u = prompt(name === 'Video' ? 'Video link (YouTube or Vimeo)' : 'Where should the button go? (https://…)'); if (!u) return; u = u.trim(); }
    insertText(TEMPLATES[name](u));
  };

  // ---- Toolbar, laid out like Google Docs: undo/redo, text style, bold/italic/link, lists, then Photo and Insert menus ----
  const fileIn = el('input'); fileIn.type = 'file'; fileIn.accept = 'image/*'; fileIn.hidden = true;
  const rowIn = el('input'); rowIn.type = 'file'; rowIn.accept = 'image/*'; rowIn.multiple = true; rowIn.hidden = true;
  fileIn.addEventListener('change', () => { const f = fileIn.files[0]; fileIn.value = ''; if (f) addFiles([f], null); });
  rowIn.addEventListener('change', async () => {
    const files = [...rowIn.files].filter((f) => /^image\//.test(f.type)); rowIn.value = ''; const nodes = [];
    for (const f of files) { try { nodes.push({ type: 'image', attrs: { src: await opts.upload(f), alt: '' } }); } catch (e) { opts.onError && opts.onError(e); break; } }
    if (nodes.length) insertTop({ type: 'photos', content: nodes });
  });
  const active = [];
  function tool(content, title, fn, isOn) { const b = el('button', 've-tb'); b.type = 'button'; b.title = title; b.setAttribute('aria-label', title); b.innerHTML = content; b.addEventListener('mousedown', (e) => e.preventDefault()); b.addEventListener('click', fn); if (isOn) active.push([b, isOn]); return b; }
  const on = (name, a) => () => editor.isActive(name, a);
  const sep = () => el('span', 'sep');
  const styleSel = el('select', 've-style'); styleSel.title = 'Text style'; styleSel.setAttribute('aria-label', 'Text style');
  [['p', 'Normal text'], ['2', 'Heading'], ['3', 'Subheading'], ['4', 'Small heading']].forEach(([v, t]) => styleSel.append(new Option(t, v)));
  styleSel.addEventListener('change', () => { const v = styleSel.value; if (v === 'p') run().setParagraph().run(); else run().setHeading({ level: Number(v) }).run(); });
  const photoBtn = tool(icon('image') + '<span>Photo</span>', 'Add a photo', () => showMenu(photoBtn, [
    { label: 'One photo', hint: 'A single picture you can resize', run: () => fileIn.click() },
    { label: 'Gallery of photos', hint: 'Choose several. Drag more in later to grow it', run: () => rowIn.click() },
  ]));
  photoBtn.setAttribute('data-menu-anchor', '1');
  const insertBtn = tool(icon('plus') + '<span>Insert</span>', 'Insert something', () => showMenu(insertBtn, [
    { label: 'Two columns', hint: 'Text side by side', run: () => addBlock('2 columns') },
    { label: 'Three columns', hint: 'Text side by side', run: () => addBlock('3 columns') },
    { label: 'Highlighted box', hint: 'A tinted box for something important', run: () => addBlock('Callout') },
    { label: 'Pull quote', hint: 'A big quote with a name under it', run: () => addBlock('Quote') },
    { label: 'Collapsible section', hint: 'A title people click to open', run: () => addBlock('Toggle') },
    { label: 'Button', hint: 'A link shown as a button, such as Join us', run: () => addBlock('Join button') },
    { label: 'Video', hint: 'A YouTube or Vimeo link', run: () => addBlock('Video') },
    '-',
    { label: 'Divider line', hint: 'A thin line between sections', run: () => run().setHorizontalRule().run() },
  ]));
  insertBtn.setAttribute('data-menu-anchor', '1');
  toolbar.append(
    tool(icon('undo'), 'Undo', () => run().undo().run()), tool(icon('redo'), 'Redo', () => run().redo().run()), sep(),
    styleSel, sep(),
    tool('<b>B</b>', 'Bold', () => run().toggleBold().run(), on('bold')),
    tool('<i>I</i>', 'Italic', () => run().toggleItalic().run(), on('italic')),
    tool(icon('link'), 'Link', () => {
      const cur = editor.getAttributes('link').href || '';
      const u = prompt('Link address (starts with https://). Leave empty to remove the link.', cur); if (u === null) return;
      if (!u.trim()) run().extendMarkRange('link').unsetLink().run(); else run().extendMarkRange('link').setLink({ href: u.trim() }).run();
    }, on('link')), sep(),
    tool(icon('bullets'), 'Bulleted list', () => run().toggleBulletList().run(), on('bulletList')),
    tool(icon('numbers'), 'Numbered list', () => run().toggleOrderedList().run(), on('orderedList')),
    tool(icon('quote'), 'Indented quote', () => run().toggleBlockquote().run(), on('blockquote')), sep(),
    photoBtn, insertBtn, fileIn, rowIn);
  const refresh = () => {
    active.forEach(([b, f]) => b.setAttribute('aria-pressed', f() ? 'true' : 'false'));
    const lvl = [2, 3, 4].find((l) => editor.isActive('heading', { level: l })); styleSel.value = lvl ? String(lvl) : 'p';
  };
  editor.on('selectionUpdate', refresh); editor.on('transaction', refresh);

  return {
    el: root, editor,
    /** The page text. Untouched pages come back exactly as they were opened. */
    get: () => (changed ? toMarkdown(editor.getJSON()) : original),
    setMarkdown(md) { original = md || ''; load(original); changed = false; },
    destroy: () => { closeMenu(); editor.destroy(); },
  };
}
