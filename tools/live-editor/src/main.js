// Live collaborative editor for the Policy site: TipTap (ProseMirror) + Yjs. Built into policy-site/live-editor.js by `npm run build`.
import * as Y from 'yjs';
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate, removeAwarenessStates } from 'y-protocols/awareness';
import { prosemirrorToYXmlFragment } from 'y-prosemirror';
import { Editor, Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import { Markdown } from 'tiptap-markdown';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Fragment } from '@tiptap/pm/model';

function b64(u8) { var s = '', i; for (i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
function unb64(s) { var bin = atob(s), u = new Uint8Array(bin.length), i; for (i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }

// ---- the structure rules (same meaning as enforceStructure / numberAfterSubitems in policy.js, applied to the document tree) ----
// Document = articles (heading level 2) and clauses (items of a numbered list). A clause = first line, then lead-in text and tables, then sub-items (lists).
// Loose content after an article heading becomes a new clause; loose content after a clause joins it; text or tables after the first sub-item become a NEW clause.
var TABLE_LEAD = 'Add a line here to introduce this table.';
function isList(n) { return n.type.name === 'orderedList' || n.type.name === 'bulletList'; }
function fixStructure(state) {
  var doc = state.doc, schema = state.schema, T = schema.nodes, tr = null;
  function mk() { return tr || (tr = state.tr); }
  var n = doc.childCount;
  // 1. article titles are all level 2
  doc.forEach(function (node, pos) { if (node.type === T.heading && node.attrs.level !== 2) mk().setNodeMarkup(pos, null, Object.assign({}, node.attrs, { level: 2 })); });
  if (tr) return tr;
  // 2. a stray block straight at the top level
  var kids = []; doc.forEach(function (node, pos) { kids.push({ node: node, pos: pos }); });
  // two clause lists in a row (Enter at the end of an article title makes one) are one list: join them so the clauses number on and Backspace can reach across
  for (var m = 1; m < kids.length; m++) if (kids[m].node.type === T.orderedList && kids[m - 1].node.type === T.orderedList) return state.tr.join(kids[m].pos);
  for (var i = 0; i < kids.length; i++) {
    var k = kids[i], node = k.node, prev = i ? kids[i - 1].node : null;
    if (node.type === T.heading || node.type === T.orderedList) continue;
    if (i === 0) {                                                                   // nothing before the first article: give it one
      if (node.type === T.paragraph && node.content.size === 0 && kids.length === 1) {   // an empty document is never blank: it begins as one article, with the cursor in its title
        var te = state.tr.replaceWith(0, node.nodeSize, T.heading.create({ level: 2 })); te.setSelection(TextSelection.near(te.doc.resolve(1), 1)); return te;
      }
      return state.tr.insert(0, T.heading.create({ level: 2 }, schema.text('Untitled article')));
    }
    var isTable = node.type === T.table;
    if (prev && prev.type === T.orderedList) {                                       // after a clause: joins the last clause, unless that clause already has sub-items
      var last = prev.lastChild, hasSub = false; last.forEach(function (c) { if (isList(c)) hasSub = true; });
      if (!hasSub) { var end = kids[i - 1].pos + prev.nodeSize - 2 - 1; var t0 = state.tr.delete(k.pos, k.pos + node.nodeSize); return t0.insert(end, node); }
    }
    var clause = T.listItem.create(null, isTable ? [T.paragraph.create(null, schema.text(TABLE_LEAD)), node] : [node]);
    var item = prev && prev.type === T.orderedList ? null : T.orderedList.create(null, clause);
    if (item) return state.tr.replaceWith(k.pos, k.pos + node.nodeSize, item);
    var t1 = state.tr.delete(k.pos, k.pos + node.nodeSize); return t1.insert(kids[i - 1].pos + prev.nodeSize - 1, clause);
  }
  // 3. text or a table after the first sub-item of a clause becomes a new clause straight after it
  for (var j = 0; j < kids.length; j++) {
    var list = kids[j].node; if (list.type !== T.orderedList) continue;
    var ipos = kids[j].pos + 1, found = null;
    list.forEach(function (item, off) {
      if (found) return;
      var seenList = false, cpos = ipos + off + 1;
      item.forEach(function (c, coff) { if (found) return; if (isList(c)) seenList = true; else if (seenList) found = { itemPos: ipos + off, item: item, at: cpos + coff }; });
    });
    if (found) {
      var rest = []; found.item.forEach(function (c, coff) { if (found.at <= found.itemPos + 1 + coff) rest.push(c); });
      var kept = []; found.item.forEach(function (c, coff) { if (found.itemPos + 1 + coff < found.at) kept.push(c); });
      if (rest[0].type === T.table) rest.unshift(T.paragraph.create(null, schema.text(TABLE_LEAD)));
      var ni = T.listItem.create(null, rest), oi = T.listItem.create(null, kept);
      return state.tr.replaceWith(found.itemPos, found.itemPos + found.item.nodeSize, Fragment.fromArray([oi, ni]));
    }
  }
  return null;
}
var Structure = Extension.create({
  name: 'policyStructure',
  addProseMirrorPlugins: function () {
    return [new Plugin({ key: new PluginKey('policyStructure'), appendTransaction: function (trs, oldS, newS) {
      if (!trs.some(function (t) { return t.docChanged; })) return null;
      if (trs.some(function (t) { var m = t.getMeta('y-sync$'); return m && m.isChangeOrigin; })) return null;   // someone else's edit: their own page fixes it, so two pages never fix the same thing twice
      // ProseMirror does not call a plugin again for a transaction it appended itself, so keep fixing until nothing is left to fix and hand back all the steps at once
      var acc = null, st = newS;
      for (var g = 0; g < 30; g++) { var t = fixStructure(st); if (!t) break; st = st.applyInner(t);   // applyInner: state.apply would run this plugin again inside and the steps would be lost
       if (!acc) acc = t; else t.steps.forEach(function (stp) { acc.step(stp); }); }
      return acc;
    } })];
  }
});


// Backspace at the very start of a clause moves its text into the clause above as a new line of that same clause (like Shift+Enter). A clause cannot be un-numbered, so the default
// "lift out of the list" would only be put back by the structure rules (and threw the cursor to the next clause). Sub-items, tables and lead-in text follow the text up.
var ClauseBackspace = Extension.create({
  name: 'clauseBackspace', priority: 1000,
  addKeyboardShortcuts: function () {
    return { Backspace: function (ctx) {
      var ed = ctx.editor, st = ed.state, sel = st.selection;
      if (!sel.empty) return false;
      var $f = sel.$from, d = $f.depth;
      if (d < 3 || $f.parentOffset !== 0 || $f.parent.type.name !== 'paragraph') return false;
      if ($f.node(d - 1).type.name !== 'listItem' || !isList($f.node(d - 2)) || $f.index(d - 1) !== 0) return false;
      var list = $f.node(d - 2), idx = $f.index(d - 2), item = $f.node(d - 1), itemPos = $f.before(d - 1), clause = d === 3;
      if (clause && list.type.name !== 'orderedList') return false;
      var rest = []; item.forEach(function (c, off, i) { if (i > 0) rest.push(c); });
      var hb = st.schema.nodes.hardBreak, tr = st.tr;
      var empty = item.childCount === 1 && $f.parent.content.size === 0;
      if (idx === 0) {                                                    // the first item of a list
        if (empty && list.childCount > 1) {                                // an empty first item with another after it: remove it, the cursor goes to the next one
          var t2 = st.tr.delete(itemPos, itemPos + item.nodeSize); t2.setSelection(TextSelection.near(t2.doc.resolve(itemPos + 2), 1));
          ed.view.dispatch(t2.scrollIntoView()); return true;
        }
        var pItem = null, tgt = -1;
        if (clause) {                                                     // the first clause of an article joins the article's title, as the first (a) joins its clause
          var hi = $f.index(0), hPrev = hi > 0 ? st.doc.child(hi - 1) : null;
          if (!hPrev || hPrev.type.name !== 'heading') return true;
          tgt = $f.before(1) - 1;                                         // the end of the title text
        } else { pItem = $f.node(d - 3); if (pItem.type.name !== 'listItem') return true; }
        var promoted = [], ok = rest.every(function (c) { if (!isList(c) || c.type !== list.type) return false; c.forEach(function (x) { promoted.push(x); }); return true; });
        if (rest.length && !ok) return true;                              // something other than deeper items hangs under it: leave it alone
        if (!clause) {
          var pStart = $f.before(d - 3), li = $f.index(d - 3);
          pItem.forEach(function (c, off, i) { if (i < li && c.type.name === 'paragraph') tgt = pStart + 1 + off + c.nodeSize - 1; });   // the clause's own line, above its sub-items
        }
        if (tgt < 0) return true;
        if (rest.length) tr.replaceWith(itemPos, itemPos + item.nodeSize, Fragment.fromArray(promoted));    // its deeper items take its place in the list
        else if (list.childCount === 1) tr.delete($f.before(d - 2), $f.after(d - 2)); else tr.delete(itemPos, itemPos + item.nodeSize);
        if (empty) { tr.setSelection(TextSelection.near(tr.doc.resolve(tgt), -1)); ed.view.dispatch(tr.scrollIntoView()); return true; }   // a lone empty sub-item just goes, leaving the cursor at the end of the clause's line
        tr.insert(tgt, Fragment.from(hb.create()).append($f.parent.content));
        tr.setSelection(TextSelection.near(tr.doc.resolve(tgt + 1), 1));
        ed.view.dispatch(tr.scrollIntoView()); return true;
      }
      var prev = list.child(idx - 1), prevStart = itemPos - prev.nodeSize, target = -1, seenList = false;
      if (prev.childCount === 1 && prev.firstChild.type.name === 'paragraph' && prev.firstChild.content.size === 0) {     // the item above is empty: this one simply takes its place
        var tr0 = st.tr.delete(prevStart, itemPos);
        tr0.setSelection(TextSelection.near(tr0.doc.resolve(prevStart + 2), 1));
        ed.view.dispatch(tr0.scrollIntoView()); return true;
      }
      prev.forEach(function (c, off) { if (isList(c)) seenList = true; if (!seenList && c.type.name === 'paragraph') target = prevStart + 1 + off + c.nodeSize - 1; });   // its own last paragraph, before any sub-items
      if (target < 0) return true;
      tr.delete(itemPos, itemPos + item.nodeSize);
      var itemEnd = prevStart + prev.nodeSize - 1;
      if (rest.length && prev.lastChild && isList(prev.lastChild) && prev.childCount > 1 && isList(rest[0]) && rest[0].type === prev.lastChild.type) {   // two lists in a row would show a, b, c then a, b: join them
        if (rest.length > 1) tr.insert(itemEnd, Fragment.fromArray(rest.slice(1)));
        tr.insert(itemEnd - 1, rest[0].content);
      } else if (rest.length) tr.insert(itemEnd, Fragment.fromArray(rest));
      tr.insert(target, Fragment.from(hb.create()).append($f.parent.content));   // the text carries on in the same item, on a new line (like Shift+Enter)
      tr.setSelection(TextSelection.near(tr.doc.resolve(target + 1), 1));
      ed.view.dispatch(tr.scrollIntoView());
      return true;
    } };
  }
});


// Tab on an article title tucks the article under the one above: the title becomes the last clause of that article and its clauses become that clause's sub-items,
// everything one level deeper. Refused when that would make a fifth level.
function listLevels(node) { var m = 0; node.forEach(function (c) { if (isList(c)) { m = Math.max(m, 1 + listLevels(c)); } else if (c.childCount) { m = Math.max(m, listLevels(c)); } }); return m; }
function demoteArticle(ed) {
  var st = ed.state, sel = st.selection, $f = sel.$from, T = st.schema.nodes, doc = st.doc;
  var idx = $f.index(0), h = doc.child(idx), hPos = $f.before(1);
  var prevIdx = -1; for (var i = idx - 1; i >= 0; i--) if (doc.child(i).type === T.heading) { prevIdx = i; break; }
  if (prevIdx < 0) return;                                                         // nothing above to go under
  var kids = [], end = hPos + h.nodeSize, j; for (j = idx + 1; j < doc.childCount && doc.child(j).type !== T.heading; j++) { kids.push(doc.child(j)); end += doc.child(j).nodeSize; }
  var subItems = []; kids.forEach(function (k) { if (k.type === T.orderedList) k.forEach(function (it) { subItems.push(it); }); });
  if (kids.some(function (k) { return k.type !== T.orderedList; })) return;        // loose content: leave it for the structure rules
  var depth = 0; kids.forEach(function (k) { depth = Math.max(depth, 1 + listLevels(k)); });
  if (depth > 3) return;                                                           // would pass four levels
  var para = T.paragraph.create(null, h.content), clause = T.listItem.create(null, subItems.length ? [para, T.orderedList.create(null, subItems)] : [para]);
  var tr = st.tr.delete(hPos, end), at, last = doc.child(idx - 1);
  if (idx - 1 > prevIdx && last.type === T.orderedList) { at = hPos - 1; tr.insert(at, clause); }                   // the end of the clause list above
  else { at = hPos; tr.insert(at, T.orderedList.create(null, clause)); at += 1; }                                 // the article above has no clauses yet
  tr.setSelection(TextSelection.near(tr.doc.resolve(at + 2 + Math.min($f.parentOffset, h.content.size)), 1));
  ed.view.dispatch(tr.scrollIntoView());
}

// Four levels at most under an article: clause 1.1, (a), (i), (A). Tab and the indent button stop there.
function listDepth($p) { var n = 0; for (var d = $p.depth; d > 0; d--) if (isList($p.node(d))) n++; return n; }
function canIndent(ed) { return listDepth(ed.state.selection.$from) < 4; }
var IndentCap = Extension.create({
  name: 'indentCap', priority: 1000,
  addKeyboardShortcuts: function () {
    return {
      // inside a list Tab never leaves the editor: it indents when it can and otherwise does nothing (the first item of a list has nothing above to go under; four levels is the most)
      Tab: function (ctx) { var ed = ctx.editor, $s = ed.state.selection.$from, d = listDepth($s); if (d === 0 && $s.depth === 1 && $s.parent.type.name === 'heading') { demoteArticle(ed); return true; }  if (d === 0) return false; return !(canIndent(ed) && ed.can().sinkListItem('listItem')); },
      // a clause cannot be un-numbered, so Shift+Tab on one does nothing; on a sub-item it moves it out one level
      'Shift-Tab': function (ctx) { return listDepth(ctx.editor.state.selection.$from) === 1; }
    };
  }
});

// Enter at the end of an article title starts a new article (Enter makes another of the same kind, like Enter in a clause makes another clause). Shift+Enter is left alone: it is a line break, as everywhere else.
// It goes straight below the title.
var ArticleEnter = Extension.create({
  name: 'articleEnter', priority: 1000,
  addKeyboardShortcuts: function () {
    return { Enter: function (ctx) {
      var ed = ctx.editor, st = ed.state, sel = st.selection;
      if (!sel.empty) return false;
      var $f = sel.$from;
      // Enter straight after a line break (Backspace leaves the cursor there): the break goes, so the clause above does not keep a blank last line
      if ($f.nodeBefore && $f.nodeBefore.type.name === 'hardBreak' && listDepth($f) > 0) return ed.chain().command(function (c) { c.tr.delete(sel.from - 1, sel.from); return true; }).splitListItem('listItem').run();
      // Enter right after a line break in an article title undoes what Backspace did: the text after the break goes back to being the article's first clause
      if ($f.depth === 1 && $f.parent.type.name === 'heading' && $f.nodeBefore && $f.nodeBefore.type.name === 'hardBreak') {
        var T0 = st.schema.nodes, rest = $f.parent.content.cut($f.parentOffset), delta = $f.end() - (sel.from - 1), afterPos = $f.after(1) - delta, next = st.doc.maybeChild($f.index(0) + 1);
        var item0 = T0.listItem.create(null, T0.paragraph.create(null, rest)), tr1 = st.tr.delete(sel.from - 1, $f.end()), cur;
        if (next && next.type === T0.orderedList) { tr1.insert(afterPos + 1, item0); cur = afterPos + 3; } else { tr1.insert(afterPos, T0.orderedList.create(null, item0)); cur = afterPos + 3; }
        tr1.setSelection(TextSelection.near(tr1.doc.resolve(cur), 1)); ed.view.dispatch(tr1.scrollIntoView()); return true;
      }
      // Enter on an empty clause starts a new article there (the clauses after it go under the new title); on an empty sub-item it goes out one level
      // without taking the items after it along.
      if ($f.parent.type.name === 'paragraph' && $f.parent.content.size === 0 && listDepth($f) > 0 && $f.node($f.depth - 1).childCount === 1) {
        var dd = $f.depth, lst = $f.node(dd - 2), ix = $f.index(dd - 2), itm = $f.node(dd - 1), itmPos = $f.before(dd - 1), TT = st.schema.nodes, trE = st.tr;
        if (dd === 3 && lst.type === TT.orderedList) {
          var lp = $f.before(dd - 2), bef = [], aft = [], frag = [];
          lst.forEach(function (it, o, i) { if (i < ix) bef.push(it); else if (i > ix) aft.push(it); });
          if (bef.length) frag.push(lst.type.create(lst.attrs, bef)); frag.push(TT.heading.create({ level: 2 })); if (aft.length) frag.push(lst.type.create(lst.attrs, aft));
          trE.replaceWith(lp, lp + lst.nodeSize, Fragment.fromArray(frag));
          trE.setSelection(TextSelection.near(trE.doc.resolve(lp + (bef.length ? frag[0].nodeSize : 0) + 1), 1)); ed.view.dispatch(trE.scrollIntoView()); return true;
        }
        var par = $f.node(dd - 3);
        if (dd > 3 && par.type === TT.listItem) {
          var pp = $f.before(dd - 3), gone = lst.childCount === 1 ? lst.nodeSize : itm.nodeSize;
          trE.delete(lst.childCount === 1 ? $f.before(dd - 2) : itmPos, (lst.childCount === 1 ? $f.before(dd - 2) : itmPos) + gone);
          var ins = pp + par.nodeSize - gone; trE.insert(ins, TT.listItem.create(null, TT.paragraph.create()));
          trE.setSelection(TextSelection.near(trE.doc.resolve(ins + 2), 1)); ed.view.dispatch(trE.scrollIntoView()); return true;
        }
      }
      // an empty title stays as it is: Enter must not pile up empty articles
      if ($f.depth === 1 && $f.parent.type.name === 'heading' && $f.parent.content.size === 0) return true;
      // Enter at the very start of a title puts a new empty article above it (the default left a blank paragraph at the end of the clause above)
      if ($f.depth === 1 && $f.parent.type.name === 'heading' && $f.parentOffset === 0 && $f.parent.content.size > 0) {
        var at0 = $f.before(1), tr0 = st.tr.insert(at0, st.schema.nodes.heading.create({ level: 2 }));
        tr0.setSelection(TextSelection.near(tr0.doc.resolve(at0 + 3), 1)); ed.view.dispatch(tr0.scrollIntoView()); return true;
      }
      if ($f.depth !== 1 || $f.parent.type.name !== 'heading' || $f.parentOffset !== $f.parent.content.size) return false;
      var at = $f.after(1);                                              // straight below the title; any clauses under it follow the new title
      var tr = st.tr.insert(at, st.schema.nodes.heading.create({ level: 2 }));
      tr.setSelection(TextSelection.near(tr.doc.resolve(at + 1), 1));
      ed.view.dispatch(tr.scrollIntoView());
      return true;
    } };
  }
});

// ---- comment highlights, anchored by quoted text like policy_notes ----
var cmKey = new PluginKey('policyComments');
function docText(doc) { var parts = [], map = []; doc.descendants(function (node, pos) { if (node.isText) { for (var i = 0; i < node.text.length; i++) map.push(pos + i); parts.push(node.text); } else if (node.isBlock && parts.length) { parts.push('\n'); map.push(-1); } return true; }); return { text: parts.join(''), map: map }; }
function findAnchor(t, quote, prefix) {
  if (!quote) return -1; var from = 0, best = -1, i;
  while ((i = t.indexOf(quote, from)) >= 0) { if (best < 0) best = i; if (!prefix || t.slice(Math.max(0, i - prefix.length), i).endsWith(prefix)) return i; from = i + 1; }
  return best;
}
var Comments = Extension.create({
  name: 'policyComments',
  addOptions: function () { return { onClick: null }; },
  addProseMirrorPlugins: function () {
    var opts = this.options;
    return [new Plugin({ key: cmKey,
      state: { init: function () { return { notes: [], active: null, deco: DecorationSet.empty }; },
        apply: function (tr, st, o, n) {
          var meta = tr.getMeta(cmKey), notes = meta && meta.notes ? meta.notes : st.notes, active = meta && 'active' in meta ? meta.active : st.active;
          if (!meta && !tr.docChanged) return st;
          var dt = docText(n.doc), decos = [];
          notes.forEach(function (c) { var i = findAnchor(dt.text, c.quote, c.prefix); if (i < 0) return; var a = dt.map[i], b = dt.map[i + c.quote.length - 1]; if (a == null || b == null || a < 0 || b < 0) return;
            decos.push(Decoration.inline(a, b + 1, { class: 'lv-cm' + (c.id === active ? ' on' : ''), 'data-note': c.id })); });
          return { notes: notes, active: active, deco: DecorationSet.create(n.doc, decos) };
        } },
      props: { decorations: function (s) { return cmKey.getState(s).deco; },
        handleClick: function (v, pos, ev) { var el = ev.target.closest && ev.target.closest('[data-note]'); if (el && opts.onClick) opts.onClick(el.getAttribute('data-note')); return false; } } })];
  }
});

// ---- tables: they always take the full width of the level they sit at (a clause, a sub-item, ...). Only the column widths can change, by dragging a column border:
// the two columns either side of it trade width, so the total never changes, and no column goes below MIN_COL percent. The widths are kept as percentages on the table.
var MIN_COL = 10;
function colCount(node) { var max = 0; node.forEach(function (row) { var n = 0; row.forEach(function (cell) { n += cell.attrs.colspan || 1; }); max = Math.max(max, n); }); return max; }
function normWidths(node) {
  var n = colCount(node) || 1, w = node.attrs.widths;
  if (Array.isArray(w) && w.length === n && w.every(function (x) { return typeof x === 'number' && x > 0; })) { var sum = w.reduce(function (a, b) { return a + b; }, 0); return w.map(function (x) { return x * 100 / sum; }); }
  var out = []; for (var i = 0; i < n; i++) out.push(100 / n); return out;
}
var PolicyTable = Table.extend({
  addAttributes: function () {
    return Object.assign({}, this.parent ? this.parent() : {}, { widths: { default: null,
      parseHTML: function (el) { try { return JSON.parse(el.getAttribute('data-widths') || 'null'); } catch (e) { return null; } },
      renderHTML: function (a) { return a.widths ? { 'data-widths': JSON.stringify(a.widths) } : {}; } } });
  },
  addNodeView: function () {
    return function (props) {
      var wrap = document.createElement('div'), table = document.createElement('table'), colgroup = document.createElement('colgroup'), tbody = document.createElement('tbody'), cur = props.node;
      wrap.className = 'tableWrapper'; table.appendChild(colgroup); table.appendChild(tbody); wrap.appendChild(table);
      function paint(w) { while (colgroup.firstChild) colgroup.removeChild(colgroup.firstChild); w.forEach(function (x) { var c = document.createElement('col'); c.style.width = x + '%'; colgroup.appendChild(c); }); }
      paint(normWidths(cur));
      return { dom: wrap, contentDOM: tbody,
        update: function (n) { if (n.type !== cur.type) return false; cur = n; paint(normWidths(n)); return true; },
        ignoreMutation: function (m) { return m.type !== 'selection' && (m.target === wrap || m.target === table || m.target === colgroup || colgroup.contains(m.target)); } };
    };
  }
});
var TableResize = Extension.create({
  name: 'tableResize',
  addProseMirrorPlugins: function () {
    var dragging = false;
    function boundary(tableEl, x) {                                     // the index of the column border within 5 px of x, or -1
      var cols = tableEl.querySelectorAll(':scope > colgroup > col'), r = tableEl.getBoundingClientRect(), acc = 0;
      for (var i = 0; i < cols.length - 1; i++) { acc += parseFloat(cols[i].style.width) || 0; if (Math.abs(x - (r.left + r.width * acc / 100)) <= 5) return i + 1; }
      return -1;
    }
    function mark(tableEl, i) {
      var w = tableEl.parentElement, cols = tableEl.querySelectorAll(':scope > colgroup > col'), acc = 0, k;
      for (k = 0; k < i; k++) acc += parseFloat(cols[k].style.width) || 0;
      if (i > 0) { w.style.setProperty('--lv-hit', 'calc(' + acc + '% - 1.5px)'); w.classList.add('lv-hit'); } else w.classList.remove('lv-hit');
    }
    return [new Plugin({ key: new PluginKey('tableResize'), props: { handleDOMEvents: {
      mousemove: function (view, ev) {
        if (dragging) return false;
        var t = ev.target && ev.target.closest ? ev.target.closest('table') : null;
        view.dom.querySelectorAll('.tableWrapper.lv-hit').forEach(function (w) { w.classList.remove('lv-hit'); });
        if (!t || !view.editable) return false;
        mark(t, boundary(t, ev.clientX)); return false;
      },
      mousedown: function (view, ev) {
        var t = ev.target && ev.target.closest ? ev.target.closest('table') : null; if (!t || !view.editable || ev.button !== 0) return false;
        var i = boundary(t, ev.clientX); if (i < 0) return false;
        ev.preventDefault(); dragging = true;
        var cols = [].slice.call(t.querySelectorAll(':scope > colgroup > col')), w0 = cols.map(function (c) { return parseFloat(c.style.width) || 0; }), x0 = ev.clientX, width = t.getBoundingClientRect().width, cur = w0.slice();
        var pair = w0[i - 1] + w0[i];
        function move(e) {
          var left = Math.min(pair - MIN_COL, Math.max(MIN_COL, w0[i - 1] + (e.clientX - x0) / width * 100));
          cur = w0.slice(); cur[i - 1] = left; cur[i] = pair - left; cols[i - 1].style.width = cur[i - 1] + '%'; cols[i].style.width = cur[i] + '%'; mark(t, i);
        }
        function up() {
          document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); dragging = false;
          var pos; try { pos = view.posAtDOM(t, 0); } catch (err) { return; }
          var $p = view.state.doc.resolve(pos), d; for (d = $p.depth; d > 0; d--) if ($p.node(d).type.name === 'table') break;
          if (d === 0 && $p.nodeAfter && $p.nodeAfter.type.name === 'table') { var node0 = $p.nodeAfter; view.dispatch(view.state.tr.setNodeMarkup(pos, null, Object.assign({}, node0.attrs, { widths: cur }))); return; }
          if (d > 0) view.dispatch(view.state.tr.setNodeMarkup($p.before(d), null, Object.assign({}, $p.node(d).attrs, { widths: cur })));
        }
        document.addEventListener('mousemove', move); document.addEventListener('mouseup', up); return true;
      }
    } } })];
  }
});

// ---- cell colours: a background colour on any table cell (none by default), set for the selected cells from the toolbar ----
var cellBg = { default: null,
  parseHTML: function (el) { return el.getAttribute('data-bg') || el.style.backgroundColor || null; },
  renderHTML: function (a) { return a.backgroundColor ? { 'data-bg': a.backgroundColor, style: 'background-color:' + a.backgroundColor } : {}; } };
var PolicyCell = TableCell.extend({ addAttributes: function () { return Object.assign({}, this.parent ? this.parent() : {}, { backgroundColor: cellBg }); } });
var PolicyHeader = TableHeader.extend({ addAttributes: function () { return Object.assign({}, this.parent ? this.parent() : {}, { backgroundColor: cellBg }); } });
function setCellColor(ed, color) { return ed.chain().focus().setCellAttribute('backgroundColor', color || null).run(); }
function inTable(ed) { return ed.isActive('table'); }

// ---- Shift+Enter in a table adds a row below and moves into it; right-click a table for the options menu (built by the page: it gets onTableMenu({x, y})) ----
function resetTableWidths(ed) {
  var $f = ed.state.selection.$from, d; for (d = $f.depth; d > 0; d--) if ($f.node(d).type.name === 'table') break; if (!d) return false;
  ed.view.dispatch(ed.state.tr.setNodeMarkup($f.before(d), null, Object.assign({}, $f.node(d).attrs, { widths: null }))); return true;
}
var TableKeys = Extension.create({
  name: 'tableKeys', priority: 1000,
  addOptions: function () { return { onTableMenu: null }; },
  addKeyboardShortcuts: function () {
    return { 'Shift-Enter': function (ctx) {
      var ed = ctx.editor; if (!ed.isActive('table')) return false;
      var $f = ed.state.selection.$from, d; for (d = $f.depth; d > 0; d--) { var nm = $f.node(d).type.name; if (nm === 'tableCell' || nm === 'tableHeader') break; } if (!d) return false;
      var tablePos = $f.before(d - 2), rowIdx = $f.index(d - 2), cellIdx = $f.index(d - 1);
      if (!ed.chain().addRowAfter().run()) return true;
      var table = ed.state.doc.nodeAt(tablePos), pos = tablePos + 1, i, row; for (i = 0; i <= rowIdx; i++) pos += table.child(i).nodeSize;
      row = table.child(rowIdx + 1); pos += 1; for (i = 0; i < Math.min(cellIdx, row.childCount - 1); i++) pos += row.child(i).nodeSize;
      ed.commands.setTextSelection(pos + 2); return true;
    } };
  },
  addProseMirrorPlugins: function () {
    var opts = this.options;
    function inSelection(view, ev) {                                       // is the pointer inside the block of selected cells?
      var sel = view.state.selection; if (!sel.$anchorCell) return false;
      var hit = view.posAtCoords({ left: ev.clientX, top: ev.clientY }); if (!hit) return false;
      return sel.ranges.some(function (r) { return hit.pos >= r.$from.pos && hit.pos <= r.$to.pos; });
    }
    return [new Plugin({ key: new PluginKey('tableMenu'), props: { handleDOMEvents: {
      // a right-click (or Ctrl+click on a Mac) inside selected cells must not touch the selection: the browser would select a word and the cell selection would be lost
      mousedown: function (view, ev) { if (view.editable && (ev.button === 2 || (ev.button === 0 && ev.ctrlKey)) && inSelection(view, ev)) { ev.preventDefault(); return true; } return false; },
      contextmenu: function (view, ev) {
      var cell = ev.target && ev.target.closest ? ev.target.closest('td, th') : null; if (!cell || !view.editable || !opts.onTableMenu) return false;
      var sel = view.state.selection, onCell = !!sel.$anchorCell;   // only a block of selected cells has $anchorCell (not the class name: the build shortens it); it stays selected when you right-click inside it
      var hit = view.posAtCoords({ left: ev.clientX, top: ev.clientY });
      if (hit) { var inSel = sel.ranges && sel.ranges.some(function (r) { return hit.pos >= r.$from.pos && hit.pos <= r.$to.pos; }); if (!(onCell && inSel)) view.dispatch(view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(hit.pos), 1))); }
      ev.preventDefault(); opts.onTableMenu({ x: ev.clientX, y: ev.clientY }); return true;
    } } } })];
  }
});

// ---- collapse: a small arrow in the margin folds an article (everything under its title) or a clause or sub-item (everything under its first line). It is a view setting for
// whoever clicks it, not part of the document, so it is never saved or shown to anyone else. Alt+click folds or unfolds every article. Putting the cursor inside folded text opens it.
var foldKey = new PluginKey('policyFold');
function foldRange(doc, p) {                                                      // the hidden stretch for the folded node starting at p, or null
  var n = doc.nodeAt(p); if (!n) return null;
  if (n.type.name === 'heading') { var end = p + n.nodeSize, i = doc.resolve(p).index(0) + 1; for (; i < doc.childCount && doc.child(i).type.name !== 'heading'; i++) end += doc.child(i).nodeSize; return end > p + n.nodeSize ? [p + n.nodeSize, end] : null; }
  if (n.type.name === 'listItem' && n.childCount > 1) return [p + 1 + n.firstChild.nodeSize, p + n.nodeSize - 1];
  return null;
}
var chevronSvg = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
var Fold = Extension.create({
  name: 'policyFold',
  addProseMirrorPlugins: function () {
    return [new Plugin({ key: foldKey,
      state: { init: function () { return { folded: [] }; },
        apply: function (tr, st, oldS, newS) {
          var folded = st.folded.map(function (p) { return tr.mapping.map(p, 1); }), m = tr.getMeta(foldKey);
          if (m && m.toggle != null) { var i = folded.indexOf(m.toggle); if (i >= 0) folded.splice(i, 1); else folded.push(m.toggle); }
          if (m && m.all) { var heads = []; newS.doc.forEach(function (n, off) { if (n.type.name === 'heading' && foldRange(newS.doc, off)) heads.push(off); }); folded = m.all === 'fold' ? heads.concat(folded.filter(function (p) { return heads.indexOf(p) < 0; })) : folded.filter(function (p) { return heads.indexOf(p) < 0; }); }
          folded = folded.filter(function (p, i, a) { return a.indexOf(p) === i && foldRange(newS.doc, p); });
          if (tr.selectionSet || tr.docChanged) { var f = newS.selection.from, t = newS.selection.to; folded = folded.filter(function (p) { var r = foldRange(newS.doc, p); return !(r && f >= r[0] && t <= r[1]); }); }
          return { folded: folded };
        } },
      props: { decorations: function (state) {
        var doc = state.doc, folded = foldKey.getState(state).folded, set = {}, decos = [];
        folded.forEach(function (p) { set[p] = true; });
        function btn(pos, isF) {
          return Decoration.widget(pos + 1, function (view) {
            var b = document.createElement('button'); b.type = 'button'; b.className = 'lv-fold' + (isF ? ' on' : ''); b.contentEditable = 'false'; b.setAttribute('aria-label', isF ? 'Expand' : 'Collapse'); b.title = isF ? 'Expand' : 'Collapse (Alt+click: all articles)'; b.innerHTML = chevronSvg;
            b.addEventListener('mousedown', function (ev) { ev.preventDefault(); });
            b.addEventListener('click', function (ev) { ev.preventDefault(); var n = view.state.doc.nodeAt(pos), all = ev.altKey && n && n.type.name === 'heading'; view.dispatch(view.state.tr.setMeta(foldKey, all ? { all: isF ? 'unfold' : 'fold' } : { toggle: pos })); });
            return b;
          }, { side: -1, key: 'fold' + pos + (isF ? 'f' : 'o') });
        }
        doc.descendants(function (n, pos) {
          var r = foldRange(doc, pos); if (!r) return true;
          var isF = !!set[pos]; decos.push(btn(pos, isF));
          if (isF) {
            decos.push(Decoration.node(pos, pos + n.nodeSize, { class: 'lv-folded' }));
            if (n.type.name === 'heading') { var q = pos + n.nodeSize, d = doc.resolve(pos).index(0) + 1; for (; d < doc.childCount && doc.child(d).type.name !== 'heading'; d++) { var c = doc.child(d); decos.push(Decoration.node(q, q + c.nodeSize, { class: 'lv-hidden' })); q += c.nodeSize; } }
            else { var o = pos + 1 + n.firstChild.nodeSize; for (var k = 1; k < n.childCount; k++) { var ch = n.child(k); decos.push(Decoration.node(o, o + ch.nodeSize, { class: 'lv-hidden' })); o += ch.nodeSize; } }
          }
          return !isF;                                                            // inside a folded node there is nothing to show
        });
        return DecorationSet.create(doc, decos);
      } } })];
  }
});

function extensions() {
  return [StarterKit.configure({ history: false, heading: { levels: [2] }, blockquote: false, codeBlock: false, code: false, horizontalRule: false }),
    PolicyTable.configure({ resizable: false }), TableRow, PolicyHeader, PolicyCell, Markdown.configure({ html: false, tightLists: true, bulletListMarker: '-' })];
}
function seed(ydoc, markdown) {                       // turn markdown into the shared document, once, when nothing has been shared yet
  var ed = new Editor({ element: document.createElement('div'), extensions: extensions(), content: markdown || '' });
  prosemirrorToYXmlFragment(ed.state.doc, ydoc.getXmlFragment('default')); ed.destroy();
}
function create(o) {
  var ed = new Editor({ element: o.element, editable: o.editable !== false,
    extensions: extensions().concat([Collaboration.configure({ document: o.ydoc }), CollaborationCursor.configure({ provider: { awareness: o.awareness }, user: o.user }), Structure, ClauseBackspace, IndentCap, ArticleEnter, TableResize, Fold, TableKeys.configure({ onTableMenu: o.onTableMenu }), Comments.configure({ onClick: o.onNoteClick })]),
    onUpdate: o.onUpdate || function () {}, onSelectionUpdate: o.onSelection || function () {} });
  if (o.editable !== false && ed.state.doc.childCount === 1 && ed.state.doc.textContent === '') { var t0 = fixStructure(ed.state); if (t0) ed.view.dispatch(t0); }   // opening a blank document gives it its first article
  return ed;
}
function setNotes(ed, notes, active) { ed.view.dispatch(ed.state.tr.setMeta(cmKey, { notes: notes, active: active })); }
function selectionQuote(ed) {
  var s = ed.state.selection; if (s.empty) return null; var dt = docText(ed.state.doc), a = dt.map.indexOf(s.from), q = ed.state.doc.textBetween(s.from, s.to, '\n').slice(0, 400);
  var i = dt.text.indexOf(q, Math.max(0, a - 1)); i = a >= 0 ? a : i; return { quote: q, prefix: i > 0 ? dt.text.slice(Math.max(0, i - 80), i) : '' };
}
function preview(el, md) { return new Editor({ element: el, editable: false, extensions: extensions(), content: md || '' }); }
// A title can have a line break in the editor (Shift+Enter) but a markdown title is one line, so in the saved/published text the lines of a title are joined with a space.
function markdownOf(ed) { var md = ed.storage.markdown.getMarkdown(), re = /^(#{1,6} [^\n]*?)\\\n([^\n]+)/m; while (re.test(md)) md = md.replace(re, '$1 $2'); return md; }
window.LiveEditor = { Y: Y, Awareness: Awareness, applyAwarenessUpdate: applyAwarenessUpdate, encodeAwarenessUpdate: encodeAwarenessUpdate, removeAwarenessStates: removeAwarenessStates,
  b64: b64, unb64: unb64, seed: seed, create: create, setNotes: setNotes, selectionQuote: selectionQuote, markdownOf: markdownOf, canIndent: canIndent, setCellColor: setCellColor, resetTableWidths: resetTableWidths, inTable: inTable, preview: preview, fixStructure: fixStructure };
