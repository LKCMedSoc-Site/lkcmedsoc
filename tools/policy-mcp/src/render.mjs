// The "numbered view": the same document as the page shows it, with every article, clause and sub-item carrying its number,
// so a rule can be cited exactly ("3.2(a)") and found again. Articles are numbered 1, 2, 3; clauses 3.1, 3.2; sub-items (a), (b); then (i), (ii); then (A), (B).

const ROMAN = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii', 'xiii', 'xiv', 'xv', 'xvi', 'xvii', 'xviii', 'xix', 'xx'];
function label(depth, n) {
  if (depth === 1) return '(' + String.fromCharCode(96 + ((n - 1) % 26) + 1) + ')';
  if (depth === 2) return '(' + (ROMAN[n - 1] || n) + ')';
  if (depth === 3) return '(' + String.fromCharCode(64 + ((n - 1) % 26) + 1) + ')';
  return '(' + n + ')';
}

// Returns [{ kind: 'article'|'item'|'text', ref, depth, text, raw }] in reading order.
export function outline(md) {
  const rows = [];
  let art = 0, cl = 0, stack = [], clauseRef = '', lastRef = '';
  for (const raw of String(md || '').split('\n')) {
    const line = raw.replace(/\s+$/, '');
    if (!line) continue;
    let m = /^#{1,6}\s+(.*)$/.exec(line);
    if (m) { art++; cl = 0; stack = []; clauseRef = ''; lastRef = String(art); rows.push({ kind: 'article', ref: String(art), depth: -1, text: m[1].replace(/\*\*/g, ''), raw }); continue; }
    m = /^\d+\.(?:\s+(.*))?$/.exec(line);
    if (m) { cl++; stack = []; clauseRef = `${art || 1}.${cl}`; lastRef = clauseRef; rows.push({ kind: 'item', ref: clauseRef, depth: 0, text: m[1] || '', raw }); continue; }
    m = /^( +)(.*)$/.exec(line);
    if (!m) { rows.push({ kind: 'text', ref: lastRef, depth: 0, text: line, raw }); continue; }
    const indent = m[1].length, rest = m[2];
    const marker = /^(?:\d+\.|[-*+])(?:\s+(.*))?$/.exec(rest);
    if (marker) {
      while (stack.length && stack[stack.length - 1].indent > indent) stack.pop();
      if (stack.length && stack[stack.length - 1].indent === indent) stack[stack.length - 1].n++;
      else stack.push({ indent, n: 1 });
      const depth = stack.length, ref = clauseRef + stack.map((s, i) => label(i + 1, s.n)).join('');
      lastRef = ref; rows.push({ kind: 'item', ref, depth, text: marker[1] || '', raw });
    } else {
      // text or a table row: it belongs to the deepest item whose indent is shallower than this line
      const depth = stack.filter((s) => s.indent < indent).length;
      const ref = depth === 0 ? clauseRef : clauseRef + stack.slice(0, depth).map((s, i) => label(i + 1, s.n)).join('');
      rows.push({ kind: 'text', ref: ref || lastRef, depth, text: rest, raw });
    }
  }
  return rows;
}

export function numbered(md) {
  return outline(md).map((r) => {
    if (r.kind === 'article') return `\nArticle ${r.ref}. ${r.text}`;
    const pad = '    '.repeat(Math.max(r.depth, 0));
    if (r.kind === 'item') return `${pad}${r.ref}  ${r.text}`;
    return `${pad}      ${r.text}`;
  }).join('\n').replace(/^\n/, '');
}

// Plain text of a markdown line (marks removed), for matching a quote the way the page shows it.
export function plain(md) {
  return String(md || '').replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/(\*\*|__)(.+?)\1/g, '$2').replace(/(^|[^\w*])\*(?!\s)(.+?)\*(?!\w)/g, '$1$2').replace(/\s+/g, ' ').trim();
}
