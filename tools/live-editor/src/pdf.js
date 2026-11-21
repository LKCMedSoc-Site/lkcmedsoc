// Save as PDF: builds a real, selectable-text PDF (A4, 11 pt Inter, 25 mm margins, page numbers) from the document, with the same numbering as the page:
// articles A., B.; clauses 1., 2.; (a); i.; (A). pdfmake and the Inter font files are fetched from jsDelivr the first time someone saves a PDF.
var PDFMAKE = 'https://cdn.jsdelivr.net/npm/pdfmake@0.2.10/build/pdfmake.min.js';
var FONT = function (w, s) { return 'https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.8/files/inter-latin-' + w + '-' + s + '.woff'; };
var loading = null;
function script(src) { return new Promise(function (ok, bad) { var el = document.createElement('script'); el.src = src; el.onload = ok; el.onerror = function () { bad(new Error('Could not load ' + src)); }; document.head.appendChild(el); }); }
function b64(buf) { var u = new Uint8Array(buf), s = '', i; for (i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }
function ready() {
  if (loading) return loading;
  loading = (async function () {
    if (!window.pdfMake) await script(PDFMAKE);
    var files = { 'Inter-Regular.woff': FONT(400, 'normal'), 'Inter-Bold.woff': FONT(700, 'normal') };   // Inter has no italic files here: italic text is set upright
    var vfs = {}; await Promise.all(Object.keys(files).map(async function (k) { var r = await fetch(files[k]); if (!r.ok) throw new Error('Could not load the font'); vfs[k] = b64(await r.arrayBuffer()); }));
    window.pdfMake.vfs = Object.assign(window.pdfMake.vfs || {}, vfs);
    window.pdfMake.fonts = { Inter: { normal: 'Inter-Regular.woff', bold: 'Inter-Bold.woff', italics: 'Inter-Regular.woff', bolditalics: 'Inter-Bold.woff' } };
  })().catch(function (e) { loading = null; throw e; });
  return loading;
}
function roman(n) { var m = [[10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']], s = ''; m.forEach(function (p) { while (n >= p[0]) { s += p[1]; n -= p[0]; } }); return s; }
function alpha(n) { return String.fromCharCode(96 + ((n - 1) % 26) + 1); }
function runs(content) {
  var out = (content || []).map(function (n) {
    if (n.type === 'hardBreak') return { text: '\n' };
    var o = { text: n.text || '' };
    (n.marks || []).forEach(function (m) { if (m.type === 'bold') o.bold = true; else if (m.type === 'italic') o.italics = true; else if (m.type === 'strike') o.decoration = 'lineThrough'; else if (m.type === 'link' && m.attrs) { o.link = m.attrs.href; o.color = '#1a56db'; o.decoration = 'underline'; } });
    return o;
  });
  return out.length ? out : [{ text: ' ' }];
}
var IND = 36;
function blocks(nodes, level) {                                                       // paragraphs, tables and lists inside a clause or sub-item
  var out = [];
  (nodes || []).forEach(function (n) {
    if (n.type === 'paragraph') out.push({ text: runs(n.content), margin: [0, 0, 0, 5], lineHeight: 1.25 });
    else if (n.type === 'orderedList' || n.type === 'bulletList') out.push(list(n, level + 1));
    else if (n.type === 'table') out.push(table(n));
  });
  return out;
}
function list(node, level) {
  var stack = [], label;
  (node.content || []).forEach(function (li, i) {
    label = node.type === 'bulletList' ? '•' : level === 1 ? (i + 1) + '.' : level === 2 ? '(' + alpha(i + 1) + ')' : level === 3 ? roman(i + 1) + '.' : '(' + alpha(i + 1).toUpperCase() + ')';
    var w = level === 1 ? IND : 30;
    stack.push({ columns: [{ width: w, text: label, bold: level === 1 && node.type !== 'bulletList' }, { width: '*', stack: blocks(li.content, level) }], columnGap: 0, margin: [0, 0, 0, level === 1 ? 8 : 5] });
  });
  return { stack: stack };
}
function table(node) {
  var rows = node.content || [], cols = 0, i;
  rows.forEach(function (r) { var c = 0; (r.content || []).forEach(function (cell) { c += (cell.attrs && cell.attrs.colspan) || 1; }); cols = Math.max(cols, c); });
  var w = node.attrs && Array.isArray(node.attrs.widths) && node.attrs.widths.length === cols ? node.attrs.widths : null;
  var body = rows.map(function (r) {
    var row = [];
    (r.content || []).forEach(function (cell) {
      var span = (cell.attrs && cell.attrs.colspan) || 1, head = cell.type === 'tableHeader';
      var stack = (cell.content || []).map(function (p) { return { text: runs(p.content), bold: head, margin: [0, 0, 0, 2] }; });
      row.push({ stack: stack, colSpan: span, fillColor: cell.attrs && cell.attrs.backgroundColor ? cell.attrs.backgroundColor : undefined, margin: [3, 3, 3, 3], fontSize: 10 });
      for (i = 1; i < span; i++) row.push({});
    });
    while (row.length < cols) row.push({});
    return row;
  });
  var widths = []; for (i = 0; i < cols; i++) widths.push(w ? w[i] / 100 : 1 / cols);
  return { table: { headerRows: 1, widths: widths.map(function (x) { return x * 100 + '%'; }), body: body }, layout: { hLineColor: function () { return '#bbbbbb'; }, vLineColor: function () { return '#bbbbbb'; }, hLineWidth: function () { return 0.6; }, vLineWidth: function () { return 0.6; } }, margin: [0, 2, 0, 8] };
}
function definition(json, meta) {
  var content = [], art = 0, MARGIN = 71;
  content.push({ text: meta.org || '', color: '#6b5a65', fontSize: 10, margin: [0, 0, 0, 6] }, { text: meta.title || '', fontSize: 24, bold: true, color: '#3a0a2e', margin: [0, 0, 0, 4] });
  if (meta.summary) content.push({ text: meta.summary, color: '#5b5057', margin: [0, 0, 0, 4] });
  content.push({ text: meta.versionLine || '', color: '#6b5a65', fontSize: 9.5, margin: [0, 0, 0, 14] });
  (json.content || []).forEach(function (n) {
    if (n.type === 'heading') {
      content.push({ columns: [{ width: IND, text: (art < 26 ? String.fromCharCode(65 + art) : art + 1) + '.', bold: true }, { width: '*', text: runs(n.content).map(function (r) { return Object.assign({}, r, { bold: true, decoration: 'underline' }); }) }], margin: [0, 14, 0, 8], pageBreak: undefined, unbreakable: false });
      art++;
    } else if (n.type === 'orderedList') content.push(list(n, 1));
    else if (n.type === 'paragraph') content.push({ text: runs(n.content), margin: [0, 0, 0, 5] });
    else if (n.type === 'table') content.push(table(n));
  });
  return {
    pageSize: 'A4', pageMargins: [MARGIN, MARGIN, MARGIN, 64], defaultStyle: { font: 'Inter', fontSize: 11, lineHeight: 1.3, color: '#1f1a1d' }, info: { title: meta.title || 'Policy', author: meta.org || '' },
    footer: function (cur, total) { return { columns: [{ text: (meta.title || '') + (meta.versionLine ? ' · ' + meta.versionLine : ''), fontSize: 8, color: '#6b5a65', margin: [MARGIN, 0, 0, 0] }, { text: 'Page ' + cur + ' of ' + total, fontSize: 8, color: '#6b5a65', alignment: 'right', margin: [0, 0, MARGIN, 0] }], margin: [0, 24, 0, 0] }; },
    content: content
  };
}
async function savePdf(json, meta, opts) {
  await ready();
  var pdf = window.pdfMake.createPdf(definition(json, meta));
  if (opts && opts.blob) return new Promise(function (ok) { pdf.getBlob(ok); });
  pdf.download((meta.filename || 'policy') + '.pdf');
}
export { savePdf };
