// Pure helpers (no page or network code), so they can be tested on their own.
// Dates are plain 'YYYY-MM-DD' strings and times 'HH:MM' or 'HH:MM:SS', all in Singapore time.
(function (root) {
  'use strict';

  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function ymd(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
    return m ? [+m[1], +m[2], +m[3]] : null;
  }
  function dayOfWeek(s) { var p = ymd(s); return p ? new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay() : 0; }
  function addDays(s, n) {
    var p = ymd(s); if (!p) return '';
    var d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n));
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  }
  function fmtDate(s, withYear) {
    var p = ymd(s); if (!p) return '';
    return DAYS[dayOfWeek(s)] + ' ' + p[2] + ' ' + MONTHS[p[1] - 1] + (withYear ? ' ' + p[0] : '');
  }
  function fmtTime(t) {
    var m = /^(\d{1,2}):(\d{2})/.exec(String(t || ''));
    if (!m) return '';
    var h = +m[1], ap = h >= 12 ? 'pm' : 'am';
    h = h % 12 || 12;
    return h + (m[2] === '00' ? '' : ':' + m[2]) + ' ' + ap;
  }
  // "Thu 12 Nov, 2 to 4:30 pm" and similar. ev: {start_date, end_date, start_time, end_time}
  function whenText(ev) {
    if (!ev || !ev.start_date) return 'Date to be confirmed';
    var multi = ev.end_date && ev.end_date !== ev.start_date;
    var out = fmtDate(ev.start_date) + (multi ? ' to ' + fmtDate(ev.end_date) : '');
    if (ev.start_time) {
      out += ', ' + fmtTime(ev.start_time);
      if (ev.end_time) out += ' to ' + fmtTime(ev.end_time);
    }
    return out;
  }
  // Today in Singapore as YYYY-MM-DD
  function sgToday(now) {
    var d = new Date((now ? now.getTime() : Date.now()) + 8 * 3600 * 1000);
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  }
  function daysBetween(a, b) {
    var x = ymd(a), y = ymd(b); if (!x || !y) return 0;
    return Math.round((Date.UTC(y[0], y[1] - 1, y[2]) - Date.UTC(x[0], x[1] - 1, x[2])) / 86400000);
  }

  // A timestamp as a Singapore 'YYYY-MM-DDTHH:MM' value for <input type=datetime-local>, and back
  function toSgLocalInput(iso) {
    if (!iso) return '';
    var d = new Date(new Date(iso).getTime() + 8 * 3600 * 1000);
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()) + 'T' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes());
  }
  function fromSgLocalInput(s) { return s ? s + ':00+08:00' : ''; }

  function money(n) {
    var v = Number(n || 0);
    return (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // ---------- calendar ----------
  function icsEscape(t) {
    return String(t || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  }
  function fold(line) {
    var out = [], s = line;
    while (s.length > 70) { out.push(s.slice(0, 70)); s = ' ' + s.slice(70); }
    out.push(s);
    return out.join('\r\n');
  }
  function compact(date, time) { return date.replace(/-/g, '') + 'T' + String(time).replace(/:/g, '').slice(0, 4).padEnd(4, '0') + '00'; }
  function plusHour(date, time) {   // one hour after a start time, rolling the date if needed
    var m = /^(\d{1,2}):(\d{2})/.exec(time);
    var h = +m[1] + 1;
    if (h >= 24) return [addDays(date, 1), pad(h - 24) + ':' + m[2]];
    return [date, pad(h) + ':' + m[2]];
  }
  // The start and end of an event, for calendars. All-day when there is no start time.
  function eventSpan(ev) {
    var endDate = ev.end_date || ev.start_date;
    if (!ev.start_time) return { allDay: true, start: ev.start_date, end: addDays(endDate, 1) };
    var end;
    if (ev.end_time) end = [endDate, ev.end_time];
    else end = plusHour(endDate, ev.start_time);
    return { allDay: false, start: [ev.start_date, ev.start_time], end: end };
  }
  function eventICS(ev, url, now) {
    if (!ev.start_date) return '';
    var sp = eventSpan(ev), stamp = (now || new Date()).toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//LKCMedSoc//Portal//EN', 'CALSCALE:GREGORIAN',
      'BEGIN:VTIMEZONE', 'TZID:Asia/Singapore', 'BEGIN:STANDARD', 'DTSTART:19700101T000000', 'TZOFFSETFROM:+0800',
      'TZOFFSETTO:+0800', 'TZNAME:SGT', 'END:STANDARD', 'END:VTIMEZONE',
      'BEGIN:VEVENT', 'UID:' + ev.id + '@lkcmedsoc', 'DTSTAMP:' + stamp];
    if (sp.allDay) {
      lines.push('DTSTART;VALUE=DATE:' + sp.start.replace(/-/g, ''), 'DTEND;VALUE=DATE:' + sp.end.replace(/-/g, ''));
    } else {
      lines.push('DTSTART;TZID=Asia/Singapore:' + compact(sp.start[0], sp.start[1]),
                 'DTEND;TZID=Asia/Singapore:' + compact(sp.end[0], sp.end[1]));
    }
    lines.push('SUMMARY:' + icsEscape(ev.title));
    if (ev.venue) lines.push('LOCATION:' + icsEscape(ev.venue));
    var desc = [ev.summary, ev.body ? 'Organised by ' + ev.body : '', url].filter(Boolean).join('\n\n');
    if (desc) lines.push('DESCRIPTION:' + icsEscape(desc));
    if (url) lines.push('URL:' + url);
    lines.push('END:VEVENT', 'END:VCALENDAR');
    return lines.map(fold).join('\r\n') + '\r\n';
  }
  function googleCalUrl(ev, url) {
    if (!ev.start_date) return '';
    var sp = eventSpan(ev), dates;
    if (sp.allDay) dates = sp.start.replace(/-/g, '') + '/' + sp.end.replace(/-/g, '');
    else dates = compact(sp.start[0], sp.start[1]) + '/' + compact(sp.end[0], sp.end[1]);
    var details = [ev.summary, url].filter(Boolean).join('\n\n');
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(ev.title) +
      '&dates=' + dates + '&ctz=Asia%2FSingapore&location=' + encodeURIComponent(ev.venue || '') +
      '&details=' + encodeURIComponent(details);
  }

  // ---------- CSV and routes ----------
  function csv(rows, headers) {
    function esc(v) { v = v === null || v === undefined ? '' : String(v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
    return [headers.join(',')].concat(rows.map(function (r) { return headers.map(function (k) { return esc(r[k]); }).join(','); })).join('\r\n');
  }
  // '#/e/abc?x=1' -> { path: '/e/abc', parts: ['e', 'abc'], q: { x: '1' } }
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
  function isUuid(s) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s || '')); }

  // ---------- QR codes (byte mode, versions 1 to 10, no outside library) ----------
  var ECC = {
    L: { bits: 1, v: { 1: [7, [[1, 19]]], 2: [10, [[1, 34]]], 3: [15, [[1, 55]]], 4: [20, [[1, 80]]], 5: [26, [[1, 108]]],
         6: [18, [[2, 68]]], 7: [20, [[2, 78]]], 8: [24, [[2, 97]]], 9: [30, [[2, 116]]], 10: [18, [[2, 68], [2, 69]]] } },
    M: { bits: 0, v: { 1: [10, [[1, 16]]], 2: [16, [[1, 28]]], 3: [26, [[1, 44]]], 4: [18, [[2, 32]]], 5: [24, [[2, 43]]],
         6: [16, [[4, 27]]], 7: [18, [[4, 31]]], 8: [22, [[2, 38], [2, 39]]], 9: [22, [[3, 36], [2, 37]]], 10: [26, [[4, 43], [1, 44]]] } }
  };
  var ALIGN = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50] };
  var EXP = [], LOG = [];
  (function () {
    var x = 1;
    for (var i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11D; }
    for (var j = 255; j < 512; j++) EXP[j] = EXP[j - 255];
  })();
  function gmul(a, b) { return a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]; }
  function rsGen(n) {
    var g = [1];
    for (var i = 0; i < n; i++) {
      var ng = new Array(g.length + 1).fill(0);
      for (var j = 0; j < g.length; j++) { ng[j] ^= g[j]; ng[j + 1] ^= gmul(g[j], EXP[i]); }
      g = ng;
    }
    return g.slice(1);
  }
  function rsRemainder(data, n) {
    var gen = rsGen(n), res = new Array(n).fill(0);
    data.forEach(function (b) {
      var f = b ^ res[0];
      res.shift(); res.push(0);
      for (var i = 0; i < n; i++) res[i] ^= gmul(gen[i], f);
    });
    return res;
  }
  function utf8(str) {
    var out = [], enc = unescape(encodeURIComponent(str));
    for (var i = 0; i < enc.length; i++) out.push(enc.charCodeAt(i));
    return out;
  }
  function qrMatrix(text, level, forceMask) {
    var ecl = ECC[level || 'M'], bytes = utf8(String(text));
    var v, dataCw, groups, ecPer;
    for (v = 1; v <= 10; v++) {
      groups = ecl.v[v][1]; ecPer = ecl.v[v][0];
      dataCw = groups.reduce(function (a, g) { return a + g[0] * g[1]; }, 0);
      if (4 + (v < 10 ? 8 : 16) + 8 * bytes.length <= dataCw * 8) break;
    }
    if (v > 10) throw new Error('Text too long for the QR code');
    // data bits
    var bits = [];
    function put(val, len) { for (var i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); }
    put(4, 4); put(bytes.length, v < 10 ? 8 : 16);
    bytes.forEach(function (b) { put(b, 8); });
    put(0, Math.min(4, dataCw * 8 - bits.length));
    while (bits.length % 8) bits.push(0);
    var cw = [];
    for (var i = 0; i < bits.length; i += 8) { var b = 0; for (var k = 0; k < 8; k++) b = (b << 1) | bits[i + k]; cw.push(b); }
    for (var pad = 0xEC; cw.length < dataCw; pad ^= 0xEC ^ 0x11) cw.push(pad);
    // blocks, error correction, interleave
    var blocks = [], pos = 0;
    groups.forEach(function (g) {
      for (var n = 0; n < g[0]; n++) { blocks.push(cw.slice(pos, pos + g[1])); pos += g[1]; }
    });
    var ecs = blocks.map(function (bl) { return rsRemainder(bl, ecPer); });
    var final = [], maxLen = Math.max.apply(null, blocks.map(function (b) { return b.length; }));
    for (var c = 0; c < maxLen; c++) blocks.forEach(function (bl) { if (c < bl.length) final.push(bl[c]); });
    for (var e = 0; e < ecPer; e++) ecs.forEach(function (ec) { final.push(ec[e]); });
    var stream = [];
    final.forEach(function (b) { for (var q = 7; q >= 0; q--) stream.push((b >>> q) & 1); });
    var size = 17 + 4 * v;
    var m = [], fn = [];
    for (var r = 0; r < size; r++) { m.push(new Array(size).fill(0)); fn.push(new Array(size).fill(false)); }
    function setFn(r, c, dark) { m[r][c] = dark ? 1 : 0; fn[r][c] = true; }
    function finder(r0, c0) {
      for (var dr = -1; dr <= 7; dr++) for (var dc = -1; dc <= 7; dc++) {
        var r = r0 + dr, c = c0 + dc;
        if (r < 0 || c < 0 || r >= size || c >= size) continue;
        var dark = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6 && (dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4));
        setFn(r, c, dark);
      }
    }
    finder(0, 0); finder(0, size - 7); finder(size - 7, 0);
    for (var t = 8; t < size - 8; t++) { setFn(6, t, t % 2 === 0); setFn(t, 6, t % 2 === 0); }
    var al = ALIGN[v];
    al.forEach(function (ar) { al.forEach(function (ac) {
      if ((ar === 6 && ac === 6) || (ar === 6 && ac === al[al.length - 1]) || (ac === 6 && ar === al[al.length - 1])) return;
      for (var dr = -2; dr <= 2; dr++) for (var dc = -2; dc <= 2; dc++) setFn(ar + dr, ac + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
    }); });
    function drawFormat(mask) {
      var data = (ecl.bits << 3) | mask, rem = data;
      for (var i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      var f = ((data << 10) | rem) ^ 0x5412;
      function bit(i) { return ((f >>> i) & 1) === 1; }
      for (var a = 0; a <= 5; a++) setFn(a, 8, bit(a));
      setFn(7, 8, bit(6)); setFn(8, 8, bit(7)); setFn(8, 7, bit(8));
      for (var b = 9; b < 15; b++) setFn(8, 14 - b, bit(b));
      for (var c = 0; c < 8; c++) setFn(8, size - 1 - c, bit(c));
      for (var d = 8; d < 15; d++) setFn(size - 15 + d, 8, bit(d));
      setFn(size - 8, 8, true);
    }
    drawFormat(0);   // reserve the area; redrawn below with the chosen mask
    if (v >= 7) {
      var vr = v;
      for (var i2 = 0; i2 < 12; i2++) vr = (vr << 1) ^ ((vr >>> 11) * 0x1F25);
      var vb = (v << 12) | vr;
      for (var j = 0; j < 18; j++) {
        var dark = ((vb >>> j) & 1) === 1, a2 = size - 11 + (j % 3), b2 = Math.floor(j / 3);
        setFn(b2, a2, dark); setFn(a2, b2, dark);
      }
    }
    // place data
    var idx = 0, up = true;
    for (var col = size - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      for (var n2 = 0; n2 < size; n2++) {
        var row = up ? size - 1 - n2 : n2;
        for (var k2 = 0; k2 < 2; k2++) {
          var cc = col - k2;
          if (!fn[row][cc]) { m[row][cc] = idx < stream.length ? stream[idx] : 0; idx++; }
        }
      }
      up = !up;
    }
    var MASKS = [
      function (r, c) { return (r + c) % 2 === 0; }, function (r) { return r % 2 === 0; },
      function (r, c) { return c % 3 === 0; }, function (r, c) { return (r + c) % 3 === 0; },
      function (r, c) { return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0; },
      function (r, c) { return (r * c) % 2 + (r * c) % 3 === 0; },
      function (r, c) { return ((r * c) % 2 + (r * c) % 3) % 2 === 0; },
      function (r, c) { return ((r + c) % 2 + (r * c) % 3) % 2 === 0; }
    ];
    function applyMask(mask) {
      for (var r = 0; r < size; r++) for (var c = 0; c < size; c++) if (!fn[r][c] && MASKS[mask](r, c)) m[r][c] ^= 1;
    }
    function penalty() {
      var p = 0, r, c, i;
      for (var pass = 0; pass < 2; pass++) {
        for (r = 0; r < size; r++) {
          var run = 1, hist = [];
          for (c = 1; c <= size; c++) {
            var cur = c < size ? (pass ? m[c][r] : m[r][c]) : -1, prev = pass ? m[c - 1][r] : m[r][c - 1];
            if (cur === prev) run++; else { if (run >= 5) p += 3 + (run - 5); run = 1; }
          }
          var line = [];
          for (c = 0; c < size; c++) line.push(pass ? m[c][r] : m[r][c]);
          var s = line.join('');
          var re = /1011101/g, mt;
          while ((mt = re.exec(s))) {
            var before = s.slice(Math.max(0, mt.index - 4), mt.index), after = s.slice(mt.index + 7, mt.index + 11);
            if (before === '0000' || after === '0000') p += 40;
            re.lastIndex = mt.index + 1;
          }
        }
      }
      for (r = 0; r < size - 1; r++) for (c = 0; c < size - 1; c++) {
        var x = m[r][c];
        if (x === m[r][c + 1] && x === m[r + 1][c] && x === m[r + 1][c + 1]) p += 3;
      }
      var dark = 0;
      for (r = 0; r < size; r++) for (c = 0; c < size; c++) dark += m[r][c];
      p += Math.max(0, Math.ceil(Math.abs(dark * 100 / (size * size) - 50) / 5) - 1) * 10;
      return p;
    }
    var best = 0, bestP = Infinity;
    for (var mk = 0; mk < 8; mk++) {
      applyMask(mk);
      var pp = penalty();
      if (pp < bestP) { bestP = pp; best = mk; }
      applyMask(mk);   // undo
    }
    if (forceMask !== undefined) best = forceMask;
    applyMask(best);
    drawFormat(best);
    return m;
  }
  // An SVG string with a four-module quiet zone. Only numbers and our own path data go into the markup.
  function qrSvg(text, opts) {
    opts = opts || {};
    var m = qrMatrix(text, opts.level || 'M'), n = m.length, q = 4, d = [];
    for (var r = 0; r < n; r++) {
      var c = 0;
      while (c < n) {
        if (!m[r][c]) { c++; continue; }
        var s = c;
        while (c < n && m[r][c]) c++;
        d.push('M' + (s + q) + ' ' + (r + q) + 'h' + (c - s) + 'v1h-' + (c - s) + 'z');
      }
    }
    var tot = n + 2 * q;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + tot + ' ' + tot + '" shape-rendering="crispEdges" role="img" aria-label="' +
      (opts.label || 'QR code') + '"><rect width="' + tot + '" height="' + tot + '" fill="#fff"/><path d="' + d.join('') + '" fill="#000"/></svg>';
  }

  var api = { ymd: ymd, addDays: addDays, fmtDate: fmtDate, fmtTime: fmtTime, whenText: whenText, sgToday: sgToday,
              daysBetween: daysBetween, toSgLocalInput: toSgLocalInput, fromSgLocalInput: fromSgLocalInput, money: money, eventICS: eventICS, googleCalUrl: googleCalUrl, eventSpan: eventSpan,
              csv: csv, parseHash: parseHash, isUuid: isUuid, qrMatrix: qrMatrix, qrSvg: qrSvg };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PortalLib = api;
})(typeof window !== 'undefined' ? window : globalThis);
