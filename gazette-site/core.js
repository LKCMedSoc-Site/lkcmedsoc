// Shared page helpers, the database clients and the router. Screens register themselves on window.P.
(function () {
  'use strict';
  var cfg = window.PORTAL_CONFIG, L = window.PortalLib;
  var sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { auth: { storage: window.LKCSession.storage } });
  var P = window.P = {
    cfg: cfg, L: L, sb: sb, act: sb.schema('activities'), rec: sb.schema('records'),
    me: null,          // whoami() result when signed in
    exco: false,       // is_exco() when signed in
    routes: [], current: null, timers: [], cleanups: []
  };

  // replaceChildren does not flatten arrays (it prints them as text), so flatten here.
  (function () {
    var orig = Element.prototype.replaceChildren;
    Element.prototype.replaceChildren = function () {
      var flat = [];
      (function add(list) {
        for (var i = 0; i < list.length; i++) {
          var c = list[i];
          if (c === null || c === undefined || c === false) continue;
          if (Array.isArray(c)) add(c); else flat.push(c);
        }
      })(arguments);
      return orig.apply(this, flat);
    };
  })();

  var $view = document.getElementById('view');
  var $toast = document.getElementById('toast');
  var toastTimer;

  function h(tag, props) {
    var el = document.createElement(tag);
    for (var k in (props || {})) {
      var v = props[k];
      if (v === null || v === undefined || v === false) continue;
      if (k.indexOf('on') === 0 && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.className = v;
      else if (k === 'value') el.value = v;
      else if (k === 'checked' || k === 'disabled' || k === 'hidden' || k === 'selected' || k === 'multiple') el[k] = !!v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    function add(c) {
      if (c === null || c === undefined || c === false) return;
      if (Array.isArray(c)) { c.forEach(add); return; }
      el.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
    }
    for (var i = 2; i < arguments.length; i++) add(arguments[i]);
    return el;
  }
  P.h = h;
  P.show = function (el) { clearTimers(); $view.replaceChildren(el); window.scrollTo(0, 0); };
  P.loading = function () { P.show(h('p', { class: 'muted' }, 'Loading…')); };
  function clearTimers() {
    P.timers.forEach(function (t) { clearInterval(t); clearTimeout(t); }); P.timers = [];
    P.cleanups.forEach(function (f) { try { f(); } catch (e) { /* ignore */ } }); P.cleanups = [];
  }
  P.onLeave = function (fn) { P.cleanups.push(fn); };
  P.every = function (ms, fn) { var t = setInterval(fn, ms); P.timers.push(t); return t; };
  P.stopTimers = clearTimers;

  P.toast = function (msg, isErr) {
    $toast.textContent = msg; $toast.className = 'toast' + (isErr ? ' err' : ''); $toast.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { $toast.hidden = true; }, isErr ? 7000 : 2500);
  };
  P.friendly = function (err) {
    var m = (err && (err.message || err.msg)) || String(err);
    if (/row-level security/i.test(m)) return "You don't have permission for that, or it is locked at this stage.";
    if (/permission denied/i.test(m)) return "You don't have permission for that.";
    if (/duplicate key|unique constraint/i.test(m)) return 'That already exists.';
    if (/foreign key/i.test(m)) return 'That refers to something that does not exist.';
    if (/check constraint/i.test(m)) return 'One of the values is not allowed. Check the numbers and options.';
    if (/JWT|not authenticated/i.test(m)) return 'Please sign in again.';
    if (/Database error saving new user|sign-in list/i.test(m)) return "That email isn't on the sign-in list. Use your NTU email, or ask an admin to add yours.";
    if (/Invalid login credentials/i.test(m)) return 'Wrong email or password.';
    if (/Email not confirmed/i.test(m)) return 'Confirm your email first: open the link we sent you.';
    if (/already registered/i.test(m)) return 'That email already has an account. Sign in, or use Forgot password.';
    return m;
  };
  P.run = async function (fn, okMsg) {
    try { var r = await fn(); if (okMsg) P.toast(okMsg); return r === undefined ? true : r; }
    catch (e) { P.toast(P.friendly(e), true); return undefined; }
  };
  P.must = function (res) { if (res.error) throw res.error; return res.data; };
  P.fetchAll = async function (make) {
    var out = [], from = 0, step = 1000;
    for (;;) {
      var data = P.must(await make().range(from, from + step - 1));
      out = out.concat(data);
      if (data.length < step) break;
      from += step;
    }
    return out;
  };
  P.download = function (name, text, type) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/csv' }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  };
  P.copy = async function (text) {
    try { await navigator.clipboard.writeText(text); P.toast('Copied'); }
    catch (e) {
      var t = h('textarea', { style: 'position:fixed;opacity:0' }, text); document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); P.toast('Copied'); } catch (e2) { P.toast('Copy failed. Select the link and copy it.', true); }
      t.remove();
    }
  };

  // ---------- small builders ----------
  P.field = function (label, input, hint) { return h('div', null, h('label', null, label), input, hint ? h('div', { class: 'sub' }, hint) : null); };
  P.select = function (options, value, attrs) {
    return h('select', attrs || {}, options.map(function (o) {
      var v = Array.isArray(o) ? o[0] : o, t = Array.isArray(o) ? o[1] : o;
      return h('option', { value: v, selected: String(v) === String(value) }, t);
    }));
  };
  P.table = function (headers, rows, numCols) {
    numCols = numCols || [];
    return h('div', { class: 'scroll' }, h('table', null,
      h('thead', null, h('tr', null, headers.map(function (x, i) { return h('th', { class: numCols.indexOf(i) >= 0 ? 'num' : '' }, x); }))),
      h('tbody', null, rows.map(function (r) {
        return h('tr', null, r.map(function (c, i) { return h('td', { class: numCols.indexOf(i) >= 0 ? 'num' : '' }, c); }));
      }))));
  };
  P.pill = function (text, kind) { return h('span', { class: 'pill' + (kind ? ' ' + kind : '') }, text); };
  P.statusPill = function (s) {
    var k = { Approved: 'ok', Completed: 'ok', Rejected: 'bad', Cancelled: 'bad', 'Changes requested': 'warn', Submitted: 'dark' }[s];
    return P.pill(s, k);
  };
  P.qr = function (text, big) {
    var box = h('span', { class: 'qr' + (big ? ' big' : '') });
    try { box.innerHTML = L.qrSvg(text); } catch (e) { box.textContent = 'QR unavailable: ' + e.message; }
    return box;
  };
  P.eventUrl = function (id) { return location.origin + location.pathname + '#/e/' + id; };
  P.checkinUrl = function (id, code) { return location.origin + location.pathname + '#/checkin/' + id + '/' + code; };
  P.link = function (href, label, cls) { return h('a', { href: href, class: cls || '' }, label); };
  P.nav = function (hash) { if (location.hash === hash) P.dispatch(); else location.hash = hash; };
  P.num = function (v) { return v === '' || v === null || v === undefined ? null : Number(v); };
  P.blank = function (v) { v = String(v === null || v === undefined ? '' : v).trim(); return v === '' ? null : v; };
  P.prefs = {
    get: function (k) { try { return localStorage.getItem('portal_' + k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem('portal_' + k, v); } catch (e) { /* private window */ } },
    del: function (k) { try { localStorage.removeItem('portal_' + k); } catch (e) { /* ignore */ } }
  };

  // ---------- router ----------
  // P.route('/a/:id/:tab?', { public: false, fn: function (params, query) {...}, nav: 'activities' })
  P.route = function (pattern, opts) {
    var names = [];
    var re = new RegExp('^' + pattern.replace(/\/:(\w+)(\?)?/g, function (_, n, opt) {
      names.push(n); return opt ? '(?:/([^/]+))?' : '/([^/]+)';
    }) + '/?$');
    P.routes.push({ re: re, names: names, opts: opts });
  };
  P.dispatch = function () {
    var ph = L.parseHash(location.hash), path = ph.path;
    for (var i = 0; i < P.routes.length; i++) {
      var m = P.routes[i].re.exec(path);
      if (!m) continue;
      var params = {};
      P.routes[i].names.forEach(function (n, k) { params[n] = m[k + 1] ? decodeURIComponent(m[k + 1]) : undefined; });
      var r = P.routes[i];
      P.current = { path: path, opts: r.opts };
      if (P.onRoute) P.onRoute(r.opts);
      if (!r.opts.public && !P.me) { P.askSignIn(); return; }
      if (r.opts.exco && !P.exco) { P.show(h('p', { class: 'muted' }, 'This section is for ExCo.')); return; }
      Promise.resolve(r.opts.fn(params, ph.q)).catch(function (e) { P.show(h('p', { class: 'pill bad' }, P.friendly(e))); });
      return;
    }
    P.nav('#/');
  };
})();
