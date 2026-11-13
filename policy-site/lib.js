// Small helpers with no page or network code: the address parser the router needs, and a word-by-word text comparison.
(function (root) {
  'use strict';
  function parseHash(hash) {
    var s = String(hash || '').replace(/^#/, '');
    var qi = s.indexOf('?'), path = qi >= 0 ? s.slice(0, qi) : s, q = {};
    if (qi >= 0) s.slice(qi + 1).split('&').forEach(function (kv) {
      if (!kv) return;
      var i = kv.indexOf('='), k = i >= 0 ? kv.slice(0, i) : kv, v = i >= 0 ? kv.slice(i + 1) : '';
      try { q[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' ')); } catch (e) { q[k] = v; }
    });
    if (!path || path[0] !== '/') path = '/' + path;
    return { path: path, parts: path.split('/').filter(Boolean), q: q };
  }
  // Compare two texts word by word. Returns [{t:'same'|'del'|'ins', s:'...'}], with runs merged.
  function wordDiff(a, b) {
    var x = String(a || '').split(/(\s+)/).filter(Boolean), y = String(b || '').split(/(\s+)/).filter(Boolean);
    var n = x.length, m = y.length, i, j;
    if (n * m > 4000000) return [{ t: 'del', s: a || '' }, { t: 'ins', s: b || '' }];   // very long text: show it as replaced
    var L = []; for (i = 0; i <= n; i++) { L.push(new Uint16Array(m + 1)); }
    for (i = n - 1; i >= 0; i--) for (j = m - 1; j >= 0; j--) L[i][j] = x[i] === y[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    var out = []; i = 0; j = 0;
    function push(t, s) { var l = out[out.length - 1]; if (l && l.t === t) l.s += s; else out.push({ t: t, s: s }); }
    while (i < n && j < m) {
      if (x[i] === y[j]) { push('same', x[i]); i++; j++; }
      else if (L[i + 1][j] >= L[i][j + 1]) { push('del', x[i]); i++; }
      else { push('ins', y[j]); j++; }
    }
    while (i < n) push('del', x[i++]);
    while (j < m) push('ins', y[j++]);
    return out;
  }
  var api = { parseHash: parseHash, wordDiff: wordDiff };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PortalLib = api;
})(typeof window !== 'undefined' ? window : globalThis);
