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
      if (node.type === T.paragraph && node.content.size === 0 && kids.length === 1) return null;   // a brand-new empty document
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
        if (clause) return true;                                          // the first clause of an article has nothing above it to join
        var pItem = $f.node(d - 3); if (pItem.type.name !== 'listItem') return true;
        var promoted = [], ok = rest.every(function (c) { if (!isList(c) || c.type !== list.type) return false; c.forEach(function (x) { promoted.push(x); }); return true; });
        if (rest.length && !ok) return true;                              // something other than deeper items hangs under it: leave it alone
        var pStart = $f.before(d - 3), li = $f.index(d - 3), tgt = -1;
        pItem.forEach(function (c, off, i) { if (i < li && c.type.name === 'paragraph') tgt = pStart + 1 + off + c.nodeSize - 1; });   // the clause's own line, above its sub-items
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


// Four levels at most under an article: clause 1.1, (a), (i), (A). Tab and the indent button stop there.
function listDepth($p) { var n = 0; for (var d = $p.depth; d > 0; d--) if (isList($p.node(d))) n++; return n; }
function canIndent(ed) { return listDepth(ed.state.selection.$from) < 4; }
var IndentCap = Extension.create({
  name: 'indentCap', priority: 1000,
  addKeyboardShortcuts: function () { return { Tab: function (ctx) { return !canIndent(ctx.editor) && listDepth(ctx.editor.state.selection.$from) > 0; } }; }
});

// Enter at the end of an article title starts a new article (Enter makes another of the same kind, like Enter in a clause makes another clause).
// It goes after the last clause of this article, or straight below the title when the article has no clauses yet.
var ArticleEnter = Extension.create({
  name: 'articleEnter', priority: 1000,
  addKeyboardShortcuts: function () {
    return { Enter: function (ctx) {
      var ed = ctx.editor, st = ed.state, sel = st.selection;
      if (!sel.empty) return false;
      var $f = sel.$from;
      if ($f.depth !== 1 || $f.parent.type.name !== 'heading' || $f.parentOffset !== $f.parent.content.size) return false;
      var idx = $f.index(0), doc = st.doc, at = $f.after(1);
      for (var i = idx + 1; i < doc.childCount && doc.child(i).type.name !== 'heading'; i++) at += doc.child(i).nodeSize;
      var tr = st.tr.insert(at, st.schema.nodes.heading.create({ level: 2 }));
      tr.setSelection(TextSelection.near(tr.doc.resolve(at + 1), 1));
      ed.view.dispatch(tr.scrollIntoView());
      return true;
    }, 'Shift-Enter': function (ctx) {                                      // Shift+Enter at the end of a title starts that article's first clause
      var ed = ctx.editor, st = ed.state, sel = st.selection, $f = sel.$from;
      if (!sel.empty || $f.depth !== 1 || $f.parent.type.name !== 'heading' || $f.parentOffset !== $f.parent.content.size) return false;
      var T = st.schema.nodes, after = $f.after(1), next = st.doc.maybeChild($f.index(0) + 1), tr = st.tr, item = T.listItem.create(null, T.paragraph.create());
      if (next && next.type === T.orderedList) { tr.insert(after + 1, item); tr.setSelection(TextSelection.near(tr.doc.resolve(after + 3), 1)); }
      else { tr.insert(after, T.orderedList.create(null, item)); tr.setSelection(TextSelection.near(tr.doc.resolve(after + 3), 1)); }
      ed.view.dispatch(tr.scrollIntoView()); return true;
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

function extensions() {
  return [StarterKit.configure({ history: false, heading: { levels: [2] }, blockquote: false, codeBlock: false, code: false, horizontalRule: false }),
    Table.configure({ resizable: true }), TableRow, TableHeader, TableCell, Markdown.configure({ html: false, tightLists: true, bulletListMarker: '-' })];
}
function seed(ydoc, markdown) {                       // turn markdown into the shared document, once, when nothing has been shared yet
  var ed = new Editor({ element: document.createElement('div'), extensions: extensions(), content: markdown || '' });
  prosemirrorToYXmlFragment(ed.state.doc, ydoc.getXmlFragment('default')); ed.destroy();
}
function create(o) {
  var ed = new Editor({ element: o.element, editable: o.editable !== false,
    extensions: extensions().concat([Collaboration.configure({ document: o.ydoc }), CollaborationCursor.configure({ provider: { awareness: o.awareness }, user: o.user }), Structure, ClauseBackspace, IndentCap, ArticleEnter, Comments.configure({ onClick: o.onNoteClick })]),
    onUpdate: o.onUpdate || function () {}, onSelectionUpdate: o.onSelection || function () {} });
  return ed;
}
function setNotes(ed, notes, active) { ed.view.dispatch(ed.state.tr.setMeta(cmKey, { notes: notes, active: active })); }
function selectionQuote(ed) {
  var s = ed.state.selection; if (s.empty) return null; var dt = docText(ed.state.doc), a = dt.map.indexOf(s.from), q = ed.state.doc.textBetween(s.from, s.to, '\n').slice(0, 400);
  var i = dt.text.indexOf(q, Math.max(0, a - 1)); i = a >= 0 ? a : i; return { quote: q, prefix: i > 0 ? dt.text.slice(Math.max(0, i - 80), i) : '' };
}
function preview(el, md) { return new Editor({ element: el, editable: false, extensions: extensions(), content: md || '' }); }
function markdownOf(ed) { return ed.storage.markdown.getMarkdown(); }
window.LiveEditor = { Y: Y, Awareness: Awareness, applyAwarenessUpdate: applyAwarenessUpdate, encodeAwarenessUpdate: encodeAwarenessUpdate, removeAwarenessStates: removeAwarenessStates,
  b64: b64, unb64: unb64, seed: seed, create: create, setNotes: setNotes, selectionQuote: selectionQuote, markdownOf: markdownOf, canIndent: canIndent, preview: preview, fixStructure: fixStructure };
