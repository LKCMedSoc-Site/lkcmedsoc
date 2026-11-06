(function () {
  'use strict';
  var cfg = window.RECORDS_CONFIG, L = window.RecordsLib;
  var sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { db: { schema: 'records' } });

  // replaceChildren does not flatten arrays (it prints them as text), so flatten here.
  // Nested arrays and empty values (null, false) are skipped, like the h() helper below.
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
  var $tabs = document.getElementById('tabs');
  var $who = document.getElementById('who');
  var $toast = document.getElementById('toast');
  var me = null;          // whoami() result
  var tab = 'record';
  var adminTab = 'directory';
  var toastTimer;

  // ---------- helpers ----------
  function h(tag, props) {
    var el = document.createElement(tag);
    for (var k in (props || {})) {
      var v = props[k];
      if (v === null || v === undefined || v === false) continue;
      if (k.indexOf('on') === 0 && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.className = v;
      else if (k === 'value') el.value = v;
      else if (k === 'checked' || k === 'disabled' || k === 'hidden' || k === 'selected') el[k] = !!v;
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
  function show(el) { $view.replaceChildren(el); }
  function toast(msg, isErr) {
    $toast.textContent = msg; $toast.className = 'toast' + (isErr ? ' err' : ''); $toast.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { $toast.hidden = true; }, isErr ? 6000 : 2500);
  }
  function friendly(err) {
    var m = (err && (err.message || err.msg)) || String(err);
    if (/row-level security/i.test(m)) return "You don't have permission for that (or the academic year is closed).";
    if (/duplicate key/i.test(m)) return 'That entry already exists.';
    if (/foreign key/i.test(m)) return 'That refers to something that does not exist yet (student, body or year).';
    if (/JWT|not authenticated/i.test(m)) return 'Please sign in again.';
    if (/Database error saving new user|sign-in list/i.test(m)) return "That email isn't on the sign-in list. Use your NTU email, or ask an admin to add yours.";
    if (/Invalid login credentials/i.test(m)) return 'Wrong email or password.';
    if (/Email not confirmed/i.test(m)) return 'Confirm your email first: open the link we sent you.';
    if (/already registered/i.test(m)) return 'That email already has an account. Sign in, or use Forgot password.';
    return m;
  }
  async function run(fn, okMsg) {
    try { var r = await fn(); if (okMsg) toast(okMsg); return r; }
    catch (e) { toast(friendly(e), true); return undefined; }
  }
  function must(res) { if (res.error) throw res.error; return res.data; }
  async function fetchAll(make) {
    var out = [], from = 0, step = 1000;
    for (;;) {
      var data = must(await make().range(from, from + step - 1));
      out = out.concat(data);
      if (data.length < step) break;
      from += step;
    }
    return out;
  }
  function download(name, rows, headers) {
    function esc(v) { v = v === null || v === undefined ? '' : String(v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
    var csv = [headers.join(',')].concat(rows.map(function (r) { return headers.map(function (k) { return esc(r[k]); }).join(','); })).join('\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }));
    a.download = name; a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }
  function readFile(file) {
    return new Promise(function (res, rej) {
      var r = new FileReader(); r.onload = function () { res(String(r.result)); }; r.onerror = rej; r.readAsText(file);
    });
  }
  async function csvFrom(input) {
    if (!input.files || !input.files[0]) return null;
    return L.toObjects(L.parseCSV(await readFile(input.files[0]))).data;
  }
  function table(headers, rows, numCols) {
    numCols = numCols || [];
    return h('div', { class: 'scroll' }, h('table', null,
      h('thead', null, h('tr', null, headers.map(function (x, i) { return h('th', { class: numCols.indexOf(i) >= 0 ? 'num' : '' }, x); }))),
      h('tbody', null, rows.map(function (r) {
        return h('tr', null, r.map(function (c, i) { return h('td', { class: numCols.indexOf(i) >= 0 ? 'num' : '' }, c); }));
      }))));
  }
  function field(label, input) { return h('div', null, h('label', null, label), input); }
  function chunks(a, n) { var o = []; for (var i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; }
  function ayFromText(s) {
    var m = String(s || '').match(/(\d{2})\s*[\/\-]\s*(\d{2,4})/);
    return m ? 'AY' + m[1] + '/' + m[2].slice(-2) : '';
  }

  // ---------- sign-in (email + password) ----------
  var REDIRECT = location.origin + location.pathname;
  function authBox(title, children) {
    $tabs.hidden = true; $who.replaceChildren();
    show(h('div', { class: 'login card' }, h('h2', null, title), children));
  }
  function loginView(mode, note) {
    mode = mode || 'signin';
    var email = h('input', { id: 'f-email', type: 'email', placeholder: 'you@e.ntu.edu.sg', autocomplete: 'username', class: 'grow' });
    var pw = h('input', { id: 'f-pw', type: 'password', autocomplete: mode === 'signup' ? 'new-password' : 'current-password', class: 'grow', placeholder: 'Password' });
    var pw2 = h('input', { id: 'f-pw2', type: 'password', autocomplete: 'new-password', class: 'grow', placeholder: 'Repeat password' });
    var btn = h('button', { class: 'btn' }, mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Email me a reset link' : 'Sign in');
    function go() {
      var e = email.value.trim().toLowerCase();
      if (e.indexOf('@') < 0) { toast('Enter your email', true); return; }
      btn.disabled = true;
      var done = function () { btn.disabled = false; };
      if (mode === 'signin') {
        sb.auth.signInWithPassword({ email: e, password: pw.value }).then(function (r) {
          done(); if (r.error) { toast(friendly(r.error), true); return; } boot();
        });
      } else if (mode === 'signup') {
        if (pw.value.length < 8) { done(); toast('Use at least 8 characters', true); return; }
        if (pw.value !== pw2.value) { done(); toast('The two passwords differ', true); return; }
        sb.auth.signUp({ email: e, password: pw.value, options: { emailRedirectTo: REDIRECT } }).then(function (r) {
          done(); if (r.error) { toast(friendly(r.error), true); return; }
          if (r.data && r.data.session) { boot(); return; }
          loginView('signin', 'Check your email for a confirmation link. Open it, then sign in here.');
        });
      } else {
        sb.auth.resetPasswordForEmail(e, { redirectTo: REDIRECT }).then(function (r) {
          done(); if (r.error) { toast(friendly(r.error), true); return; }
          loginView('signin', 'If that email has an account, a reset link is on its way.');
        });
      }
    }
    btn.addEventListener('click', go);
    [email, pw, pw2].forEach(function (i) { i.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') go(); }); });
    var link = function (label, m) { return h('button', { class: 'ghost', onclick: function () { loginView(m); } }, label); };
    authBox(mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Reset password' : 'Sign in', [
      note ? h('p', { class: 'pill ok' }, note) : null,
      mode === 'signup' ? h('p', { class: 'muted' }, 'Use the NTU email the school has on file. We send a link to confirm it is yours.') : null,
      h('div', { class: 'row' }, email),
      mode === 'forgot' ? null : h('div', { class: 'row' }, pw),
      mode === 'signup' ? h('div', { class: 'row' }, pw2) : null,
      h('div', { class: 'row' }, btn),
      h('div', { class: 'row' },
        mode !== 'signin' ? link('Back to sign in', 'signin') : null,
        mode === 'signin' ? link('Create account', 'signup') : null,
        mode === 'signin' ? link('Forgot password', 'forgot') : null)]);
  }
  function newPasswordView() {
    var pw = h('input', { id: 'f-newpw', type: 'password', autocomplete: 'new-password', class: 'grow', placeholder: 'New password' });
    var btn = h('button', { class: 'btn', onclick: async function () {
      if (pw.value.length < 8) { toast('Use at least 8 characters', true); return; }
      btn.disabled = true;
      var r = await sb.auth.updateUser({ password: pw.value });
      btn.disabled = false;
      if (r.error) { toast(friendly(r.error), true); return; }
      toast('Password saved'); boot();
    } }, 'Save password');
    authBox('Set a new password', [h('div', { class: 'row' }, pw), h('div', { class: 'row' }, btn)]);
  }

  // ---------- shell ----------
  async function boot() {
    var s = await sb.auth.getSession();
    if (!s.data.session) { loginView(); return; }
    try { me = must(await sb.rpc('whoami')); } catch (e) { toast(friendly(e), true); loginView(); return; }
    $who.replaceChildren(h('span', null, me.name || me.email), h('button', { class: 'who-btn', onclick: newPasswordView }, 'Password'), h('button', { class: 'who-btn', onclick: async function () { await sb.auth.signOut(); me = null; loginView(); } }, 'Sign out'));
    var tabs = [['record', 'My record']];
    if (me.can_manage || me.is_admin) tabs.push(['bodies', 'My bodies'], ['pages', 'Group pages']);
    if (me.is_admin) tabs.push(['admin', 'Admin']);
    if (!tabs.some(function (t) { return t[0] === tab; })) tab = 'record';
    $tabs.hidden = false;
    $tabs.replaceChildren.apply($tabs, tabs.map(function (t) {
      return h('button', { class: t[0] === tab ? 'on' : '', onclick: function () { tab = t[0]; boot(); } }, t[1]);
    }));
    if (tab === 'record') recordView();
    else if (tab === 'bodies') rosterView();
    else if (tab === 'pages') window.GroupPages.view({ h: h, sb: sb, must: must, run: run, toast: toast, show: show, field: field, friendly: friendly });
    else adminView();
  }

  // ---------- my record ----------
  async function recordView() {
    show(h('p', { class: 'muted' }, 'Loading…'));
    var rows = await run(async function () { return must(await sb.rpc('my_record')); });
    if (!rows) return;
    var total = rows.reduce(function (a, r) { return a + (r.points || 0); }, 0);
    show(h('div', null,
      h('h2', null, 'My record'),
      me.matric ? null : h('p', { class: 'muted' }, 'Your email is not linked to a student record yet. If this is wrong, ask an admin to check the roster.'),
      h('div', { class: 'card' }, h('div', { class: 'muted' }, 'Total points'), h('div', { class: 'total' }, total)),
      rows.length ? table(['Year', 'Level', 'Body', 'Position', 'Points'], rows.map(function (r) { return [r.ay, r.level, r.body, r.title, r.points]; }), [4])
                  : h('p', { class: 'muted' }, 'No positions recorded yet.')));
  }

  // ---------- roster editor ----------
  var rs = { bodyId: null, ay: null };
  async function rosterView() {
    show(h('p', { class: 'muted' }, 'Loading…'));
    var data = await run(async function () {
      return {
        bodies: must(await sb.rpc('my_bodies')),
        years: must(await sb.from('academic_years').select('*').order('ay', { ascending: false }))
      };
    });
    if (!data) return;
    if (!data.bodies.length) { show(h('p', { class: 'muted' }, 'You are not set up to manage any body yet.')); return; }
    if (!rs.bodyId || !data.bodies.some(function (b) { return b.id === rs.bodyId; })) rs.bodyId = data.bodies[0].id;
    if (!rs.ay || !data.years.some(function (y) { return y.ay === rs.ay; })) {
      var open = data.years.filter(function (y) { return y.is_open; })[0];
      rs.ay = (open || data.years[0] || {}).ay;
    }
    var body = data.bodies.filter(function (b) { return b.id === rs.bodyId; })[0];
    var year = data.years.filter(function (y) { return y.ay === rs.ay; })[0];
    var editable = !!year && (year.is_open || me.is_admin);

    var bodySel = h('select', { class: 'grow', onchange: function () { rs.bodyId = bodySel.value; rosterView(); } },
      data.bodies.map(function (b) { return h('option', { value: b.id, selected: b.id === rs.bodyId }, b.name + ' (' + b.level + ')'); }));
    var aySel = h('select', { onchange: function () { rs.ay = aySel.value; rosterView(); } },
      data.years.map(function (y) { return h('option', { value: y.ay, selected: y.ay === rs.ay }, y.ay + (y.is_open ? '' : ' (closed)')); }));

    var holder = h('div', null, h('p', { class: 'muted' }, 'Loading roster…'));
    show(h('div', null, h('h2', null, 'My bodies'), h('div', { class: 'row' }, bodySel, aySel), holder));
    if (!year) { holder.replaceChildren(h('p', { class: 'muted' }, 'No academic years exist yet. Ask an admin to add one.')); return; }

    var res = await run(async function () {
      return {
        roster: await fetchAll(function () { return sb.from('roster_view').select('*').eq('body_id', rs.bodyId).eq('ay', rs.ay).order('points', { ascending: false }).order('full_name'); }),
        positions: must(await sb.from('positions').select('*').eq('level', body.level).order('points', { ascending: false }))
      };
    });
    if (!res) return;

    var parts = [];
    if (!editable) parts.push(h('p', { class: 'pill bad' }, year.ay + ' is closed. You can view it but not change it.'));
    parts.push(h('p', { class: 'muted' }, res.roster.length + ' on the roster. Titles and points are worked out automatically.'));
    parts.push(res.roster.length ? table(['Name', 'Matric', 'Position', 'Points', ''], res.roster.map(function (r) {
      return [r.preferred_name && r.preferred_name !== r.full_name ? r.full_name + ' (' + r.preferred_name + ')' : r.full_name, r.matric,
        r.final_title, r.points,
        editable ? h('button', { class: 'danger', onclick: async function () {
          if (!confirm('Remove ' + r.full_name + ' from this roster?')) return;
          await run(async function () {
            var d = must(await sb.from('participation').delete().eq('id', r.id).select('id'));
            if (!d.length) throw new Error("You don't have permission for that (or the academic year is closed).");
          }, 'Removed');
          rosterView();
        } }, 'Remove') : ''];
    }), [3]) : h('p', { class: 'muted' }, 'Nobody yet.'));
    if (editable) parts.push(addForms(body, res.positions));
    holder.replaceChildren.apply(holder, parts);
  }

  function addForms(body, positions) {
    var picked = null;
    var q = h('input', { class: 'grow', placeholder: 'Search name or matric…' });
    var results = h('div');
    var chosen = h('p', { class: 'muted' }, 'Nobody selected.');
    var role = h('select', null, positions.map(function (p) { return h('option', { value: p.role_tier }, p.role_tier + ' (' + p.points + ' pts)'); }));
    var custom = h('input', { class: 'grow', placeholder: 'Optional: your own wording, e.g. a vanity title' });
    var timer;
    q.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(async function () {
        if (q.value.trim().length < 2) { results.replaceChildren(); return; }
        var rows = await run(async function () { return must(await sb.rpc('search_students', { q: q.value })); });
        if (!rows) return;
        results.replaceChildren(h('div', { class: 'pick' }, rows.length ? rows.map(function (s) {
          return h('button', { onclick: function () {
            picked = s; chosen.textContent = 'Selected: ' + s.full_name + ' (' + s.matric + ')'; results.replaceChildren(); q.value = '';
          } }, s.full_name + ' · ' + s.matric + (s.house ? ' · ' + s.house : '') + (s.status === 'LOA' ? ' · LOA' : ''));
        }) : h('div', { class: 'muted', style: 'padding:8px' }, 'No match.')));
      }, 250);
    });
    var add = h('button', { class: 'btn', onclick: async function () {
      if (!picked) { toast('Pick a student first', true); return; }
      add.disabled = true;
      var ok = await run(async function () {
        must(await sb.from('participation').insert({ ay: rs.ay, body_id: rs.bodyId, matric: picked.matric, role_tier: role.value, custom_text: custom.value.trim() || null }));
        return true;
      }, 'Added');
      add.disabled = false;
      if (ok) rosterView();
    } }, 'Add to roster');

    var bulkRole = h('select', null, positions.map(function (p) { return h('option', { value: p.role_tier }, p.role_tier); }));
    var bulk = h('textarea', { placeholder: 'Paste matric numbers, one per line or separated by commas' });
    var report = h('pre', { class: 'out', hidden: true });
    var bulkBtn = h('button', { class: 'btn', onclick: async function () {
      var list = bulk.value.split(/[\s,;]+/).map(function (x) { return x.trim().toUpperCase(); }).filter(Boolean);
      list = list.filter(function (v, i) { return list.indexOf(v) === i; });
      if (!list.length) { toast('Nothing to add', true); return; }
      bulkBtn.disabled = true;
      var mk = function (m) { return { ay: rs.ay, body_id: rs.bodyId, matric: m, role_tier: bulkRole.value }; };
      var failed = [], okCount = 0;
      var r = await sb.from('participation').insert(list.map(mk));
      if (!r.error) okCount = list.length;
      else {
        for (var i = 0; i < list.length; i++) {
          var one = await sb.from('participation').insert(mk(list[i]));
          if (one.error) failed.push(list[i] + ': ' + friendly(one.error)); else okCount++;
        }
      }
      bulkBtn.disabled = false;
      report.hidden = false;
      report.textContent = 'Added ' + okCount + ' of ' + list.length + '.' + (failed.length ? '\nCould not add:\n' + failed.join('\n') : '');
      toast('Added ' + okCount, failed.length > 0);
      if (!failed.length) rosterView();
    } }, 'Add all');

    return h('div', null,
      h('h3', null, 'Add one person'),
      h('div', { class: 'card' }, h('div', { class: 'row' }, q), results, chosen,
        h('div', { class: 'row' }, field('Position', role), field('Custom wording', custom)), h('div', { class: 'row' }, add)),
      h('h3', null, 'Add many by matric number'),
      h('div', { class: 'card' }, bulk, h('div', { class: 'row' }, field('Position for all', bulkRole)), h('div', { class: 'row' }, bulkBtn), report));
  }

  // ---------- admin ----------
  var ADMIN_TABS = [['directory', 'Directory'], ['card', 'Report card'], ['years', 'Years'], ['bodies', 'Bodies'], ['positions', 'Positions'],
    ['admins', 'Admins'], ['signin', 'Sign-in list'], ['sync', 'Annual sync'], ['groups', 'Email groups'], ['import', 'Import old data']];
  function adminView() {
    var holder = h('div');
    var bar = h('div', { class: 'subtabs' }, ADMIN_TABS.map(function (t) {
      return h('button', { class: t[0] === adminTab ? 'on' : '', onclick: function () { adminTab = t[0]; adminView(); } }, t[1]);
    }));
    show(h('div', null, h('h2', null, 'Admin'), bar, holder));
    ({ directory: adminDirectory, card: adminCard, years: adminYears, bodies: adminBodies, positions: adminPositions,
       admins: adminAdmins, signin: adminSignin, sync: adminSync, groups: adminGroups, import: adminImport })[adminTab](holder);
  }
  async function yearSelect(onchange, preferOpen) {
    var years = must(await sb.from('academic_years').select('*').order('ay', { ascending: false }));
    var cur = (preferOpen && years.filter(function (y) { return y.is_open; })[0]) || years[0];
    var sel = h('select', { onchange: onchange }, years.map(function (y) { return h('option', { value: y.ay, selected: cur && y.ay === cur.ay }, y.ay); }));
    return { sel: sel, years: years };
  }

  async function adminDirectory(el) {
    var ys = await run(function () { return yearSelect(load, true); });
    if (!ys) return;
    if (!ys.years.length) { el.replaceChildren(h('p', { class: 'muted' }, 'No academic years yet. Add one under Years.')); return; }
    var out = h('div'), filter = h('input', { placeholder: 'Filter…', class: 'grow', oninput: draw }), rows = [];
    el.replaceChildren(h('div', { class: 'row' }, ys.sel, filter, h('button', { class: 'ghost', onclick: function () {
      download('participation-' + ys.sel.value.replace('/', '-') + '.csv', rows, ['ay', 'body', 'level', 'matric', 'full_name', 'house', 'role_tier', 'final_title', 'points']);
    } }, 'Export CSV')), out);
    function draw() {
      var f = filter.value.toLowerCase();
      var shown = rows.filter(function (r) { return !f || (r.full_name + ' ' + r.matric + ' ' + r.body + ' ' + r.final_title).toLowerCase().indexOf(f) >= 0; });
      out.replaceChildren(h('p', { class: 'muted' }, shown.length + ' rows'), table(['Name', 'Matric', 'Body', 'Position', 'Points'],
        shown.slice(0, 500).map(function (r) { return [r.full_name, r.matric, r.body, r.final_title, r.points]; }), [4]),
        shown.length > 500 ? h('p', { class: 'muted' }, 'Showing the first 500. Use the filter or export.') : null);
    }
    async function load() {
      out.replaceChildren(h('p', { class: 'muted' }, 'Loading…'));
      rows = await run(function () { return fetchAll(function () { return sb.from('roster_view').select('*').eq('ay', ys.sel.value).order('body').order('points', { ascending: false }).order('full_name'); }); }) || [];
      draw();
    }
    load();
  }

  function adminCard(el) {
    var m = h('input', { placeholder: 'Matric number, e.g. U2650990A', class: 'grow' });
    var out = h('div');
    el.replaceChildren(h('div', { class: 'row' }, m, h('button', { class: 'btn', onclick: async function () {
      var rows = await run(async function () { return must(await sb.rpc('admin_report_card', { m: m.value })); });
      if (!rows) return;
      if (!rows.length) { out.replaceChildren(h('p', { class: 'muted' }, 'No student with that matric.')); return; }
      var total = rows.reduce(function (a, r) { return a + (r.points || 0); }, 0);
      out.replaceChildren(h('h3', null, rows[0].full_name), h('p', { class: 'muted' }, 'Total points: ' + total),
        rows[0].ay ? table(['Year', 'Level', 'Body', 'Position', 'Points'], rows.map(function (r) { return [r.ay, r.level, r.body, r.title, r.points]; }), [4])
                   : h('p', { class: 'muted' }, 'No positions recorded.'));
    } }, 'Look up')), out);
  }

  async function adminYears(el) {
    var years = await run(async function () { return must(await sb.from('academic_years').select('*').order('ay', { ascending: false })); });
    if (!years) return;
    var ay = h('input', { placeholder: 'AY26/27' });
    el.replaceChildren(
      h('p', { class: 'muted' }, 'Leaders can only edit open years. Admins can always edit.'),
      table(['Year', 'Status', ''], years.map(function (y) {
        return [y.ay, h('span', { class: 'pill ' + (y.is_open ? 'ok' : '') }, y.is_open ? 'Open' : 'Closed'),
          h('button', { class: 'ghost', onclick: async function () {
            await run(async function () { must(await sb.from('academic_years').update({ is_open: !y.is_open }).eq('ay', y.ay)); });
            adminYears(el);
          } }, y.is_open ? 'Close' : 'Open')];
      })),
      h('h3', null, 'Add a year'),
      h('div', { class: 'row' }, ay, h('button', { class: 'btn', onclick: async function () {
        var v = ayFromText(ay.value) || ay.value.trim().toUpperCase();
        await run(async function () { must(await sb.from('academic_years').insert({ ay: v, is_open: true })); }, 'Added');
        adminYears(el);
      } }, 'Add (opens it)')));
  }

  async function adminBodies(el) {
    var data = await run(async function () {
      return { bodies: must(await sb.from('bodies').select('*').order('level').order('name')),
               levels: must(await sb.from('positions').select('level')),
               years: must(await sb.from('academic_years').select('ay').order('ay', { ascending: false })) };
    });
    if (!data) return;
    var levels = data.levels.map(function (x) { return x.level; }).filter(function (v, i, a) { return a.indexOf(v) === i; });
    var editing = null;
    var detail = h('div');
    el.replaceChildren(h('div', { class: 'row' }, h('button', { class: 'btn', onclick: function () { openEdit({ status: 'Active', level: levels[0] || '' }); } }, 'New body')),
      table(['Name', 'Level', 'Parent', 'Status', ''], data.bodies.map(function (b) {
        return [b.name, b.level, b.parent_committee || '', b.status, h('button', { class: 'ghost', onclick: function () { openEdit(b); } }, 'Edit')];
      })), detail);

    async function openEdit(b) {
      editing = b;
      var f = {
        name: h('input', { value: b.name || '' }),
        level: h('select', null, levels.map(function (l) { return h('option', { value: l, selected: l === b.level }, l); })),
        status: h('select', null, ['Active', 'Inactive'].map(function (s) { return h('option', { value: s, selected: s === b.status }, s); })),
        parent_committee: h('input', { value: b.parent_committee || '' }),
        contact_email: h('input', { value: b.contact_email || '' }),
        description: h('textarea', null, b.description || ''),
        logo_url: h('input', { value: b.logo_url || '' }), instagram: h('input', { value: b.instagram || '' }),
        website: h('input', { value: b.website || '' }), recruitment_url: h('input', { value: b.recruitment_url || '' })
      };
      f.description.value = b.description || '';
      var mgr = h('div');
      detail.replaceChildren(h('h3', null, b.id ? 'Edit ' + b.name : 'New body'),
        h('div', { class: 'card' },
          field('Name', f.name), field('Level', f.level), field('Status', f.status), field('Parent committee (for CCAs)', f.parent_committee),
          field('Official email (several allowed, comma separated)', f.contact_email), field('Description (public)', f.description),
          field('Logo URL', f.logo_url), field('Instagram', f.instagram), field('Website', f.website), field('Recruitment link', f.recruitment_url),
          h('div', { class: 'row' }, h('button', { class: 'btn', onclick: async function () {
            var rec = {};
            Object.keys(f).forEach(function (k) { rec[k] = f[k].value.trim() || null; });
            if (!rec.name) { toast('Name needed', true); return; }
            var ok = await run(async function () {
              if (b.id) must(await sb.from('bodies').update(rec).eq('id', b.id)); else must(await sb.from('bodies').insert(rec));
              return true;
            }, 'Saved');
            if (ok) adminBodies(el);
          } }, 'Save'))), mgr);
      if (b.id) managersPanel(mgr, b);
    }
    function managersPanel(box, b) {
      async function draw() {
        var ms = await run(async function () { return must(await sb.from('body_managers').select('*').eq('body_id', b.id).order('email')); });
        if (!ms) return;
        var em = h('input', { type: 'email', placeholder: 'leader@e.ntu.edu.sg', class: 'grow' });
        box.replaceChildren(h('h3', null, 'Who can edit this body'),
          h('p', { class: 'muted' }, 'Top leaders become editors when you run "Refresh managers" below. Committee managers can also edit their CCAs automatically.'),
          ms.length ? table(['Email', 'How added', ''], ms.map(function (m) {
            return [m.email, m.source, h('button', { class: 'danger', onclick: async function () {
              await run(async function () { must(await sb.from('body_managers').delete().eq('body_id', b.id).eq('email', m.email)); });
              draw();
            } }, 'Remove')];
          })) : h('p', { class: 'muted' }, 'No managers yet.'),
          h('div', { class: 'row' }, em, h('button', { class: 'btn', onclick: async function () {
            await run(async function () { must(await sb.from('body_managers').insert({ body_id: b.id, email: em.value.trim().toLowerCase(), source: 'manual' })); }, 'Added');
            draw();
          } }, 'Add manager')));
      }
      draw();
    }
    // global refresh button
    var ayS = h('select', null, data.years.map(function (y) { return h('option', { value: y.ay }, y.ay); }));
    el.appendChild(h('h3', null, 'Refresh managers from top leaders'));
    el.appendChild(h('div', { class: 'card' }, h('p', { class: 'muted' }, 'Replaces all automatic managers with the top leaders of the chosen year (committee heads, chairpersons, ExCo, year reps). Manually added managers are kept.'),
      h('div', { class: 'row' }, ayS, h('button', { class: 'btn', onclick: async function () {
        var n = await run(async function () { return must(await sb.rpc('refresh_managers', { a: ayS.value })); });
        if (n !== undefined) toast(n + ' manager links set');
      } }, 'Refresh managers'))));
  }

  async function adminPositions(el) {
    var rows = await run(async function () { return must(await sb.from('positions').select('*').order('level').order('points', { ascending: false })); });
    if (!rows) return;
    var f = { level: h('input', { placeholder: 'Level, e.g. Committee' }), role_tier: h('input', { placeholder: 'Role, e.g. Head' }),
              points: h('input', { type: 'number', value: 0, style: 'width:80px' }),
              std_template: h('input', { value: '{Body} - {Role}', class: 'grow' }), van_template: h('input', { value: '{Body} - {Role} ({Vanity})', class: 'grow' }) };
    el.replaceChildren(
      h('p', { class: 'muted' }, 'Templates can use {Body}, {Role} and {Vanity}. Saving an existing level + role updates it.'),
      table(['Level', 'Role', 'Points', 'Template', ''], rows.map(function (r) {
        return [r.level, r.role_tier, r.points, r.std_template, h('button', { class: 'ghost', onclick: function () {
          Object.keys(f).forEach(function (k) { f[k].value = r[k]; }); window.scrollTo(0, document.body.scrollHeight);
        } }, 'Edit')];
      }), [2]),
      h('h3', null, 'Add or update'),
      h('div', { class: 'card' }, h('div', { class: 'row' }, f.level, f.role_tier, field('Points', f.points)),
        field('Standard template', f.std_template), field('Template with vanity title', f.van_template),
        h('div', { class: 'row' }, h('button', { class: 'btn', onclick: async function () {
          var rec = { level: f.level.value.trim(), role_tier: f.role_tier.value.trim(), points: parseInt(f.points.value, 10) || 0,
                      std_template: f.std_template.value, van_template: f.van_template.value };
          if (!rec.level || !rec.role_tier) { toast('Level and role needed', true); return; }
          await run(async function () { must(await sb.from('positions').upsert(rec, { onConflict: 'level,role_tier' })); }, 'Saved');
          adminPositions(el);
        } }, 'Save'))));
  }

  async function adminAdmins(el) {
    var rows = await run(async function () { return must(await sb.from('admins').select('*').order('email')); });
    if (!rows) return;
    var em = h('input', { type: 'email', class: 'grow', placeholder: 'admin@e.ntu.edu.sg' });
    el.replaceChildren(table(['Admin email', ''], rows.map(function (r) {
      return [r.email, r.email === me.email ? 'You' : h('button', { class: 'danger', onclick: async function () {
        if (!confirm('Remove ' + r.email + ' as admin?')) return;
        await run(async function () { must(await sb.from('admins').delete().eq('email', r.email)); });
        adminAdmins(el);
      } }, 'Remove')];
    })), h('div', { class: 'row' }, em, h('button', { class: 'btn', onclick: async function () {
      await run(async function () { must(await sb.from('admins').insert({ email: em.value.trim().toLowerCase() })); }, 'Added');
      adminAdmins(el);
    } }, 'Add admin')));
  }

  async function adminSignin(el) {
    var rows = await run(async function () { return must(await sb.from('signin_allowlist').select('*').order('entry')); });
    if (!rows) return;
    var en = h('input', { id: 'f-allow', class: 'grow', placeholder: '@e.ntu.edu.sg  or  someone@gmail.com' });
    el.replaceChildren(
      h('p', { class: 'muted' }, 'Students on the roster, admins and body managers can already create an account. A CCA\'s own Gmail only needs adding as a manager under Bodies. Add anyone else here, such as faculty advisors.'),
      table(['Allowed', ''], rows.map(function (r) {
        return [r.entry, h('button', { class: 'danger', onclick: async function () {
          await run(async function () { must(await sb.from('signin_allowlist').delete().eq('entry', r.entry)); });
          adminSignin(el);
        } }, 'Remove')];
      })),
      h('div', { class: 'row' }, en, h('button', { class: 'btn', onclick: async function () {
        var v = en.value.trim().toLowerCase();
        if (!v) return;
        await run(async function () { must(await sb.from('signin_allowlist').insert({ entry: v })); }, 'Added');
        adminSignin(el);
      } }, 'Add')),
      h('p', { class: 'muted' }, 'This only controls who can make a new account. Seeing data still depends on the roster, manager and admin lists.'));
  }

  function adminSync(el) {
    var baseYear = h('input', { type: 'number', value: L.defaultBaseYear(), style: 'width:100px' });
    var inputs = {};
    var out = h('pre', { class: 'out', hidden: true });
    var cohortRows = ['M1', 'M2', 'M3', 'M4', 'M5'].map(function (c) {
      inputs[c] = h('input', { type: 'file', accept: '.csv,.tsv,.txt' });
      return h('div', { class: 'row' }, h('strong', null, c), inputs[c]);
    });
    var go = h('button', { class: 'btn', onclick: async function () {
      var all = [];
      for (var c in inputs) {
        var data = await run(function () { return csvFrom(inputs[c]); });
        if (!data) { toast('Choose a file for ' + c, true); return; }
        data.forEach(function (r) {
          var matric = L.pick(r, ['Matric No.', 'Matric No', 'Matric']).toUpperCase();
          if (!matric) return;
          all.push({ matric: matric, full_name: L.pick(r, ['Full Name', 'Name']), preferred_name: L.pick(r, ['Preferred Name']),
                     gender: L.pick(r, ['Gender']), house: L.pick(r, ['House']), email: L.pick(r, ['NTU Email', 'Email']), cohort: c });
        });
      }
      var by = parseInt(baseYear.value, 10);
      if (!confirm('Update the student roster for ' + L.ayLabel(by) + ' with ' + all.length + ' students? A backup of the current roster is saved first.')) return;
      go.disabled = true;
      var r = await run(async function () { return must(await sb.rpc('annual_sync', { rows: all, base_year: by })); });
      go.disabled = false;
      if (r) { out.hidden = false; out.textContent = 'Done.\nVerified: ' + r.verified + '\nMarked graduated: ' + r.graduated + '\nMarked LOA: ' + r.loa + '\nNew students added: ' + r.added; }
    } }, 'Run sync');
    el.replaceChildren(
      h('p', { class: 'muted' }, 'Upload the school list for each cohort (M1 to M5). All five are needed. Columns: Full Name, Preferred Name, Gender, Matric No., House, NTU Email.'),
      field('Academic year starts in (e.g. 2026 for AY26/27)', baseYear), cohortRows, h('div', { class: 'row' }, go), out);
  }

  async function adminGroups(el) {
    var ys = await run(function () { return yearSelect(load, true); });
    if (!ys) return;
    var out = h('div');
    el.replaceChildren(h('div', { class: 'row' }, ys.sel, h('button', { class: 'ghost', onclick: load }, 'Refresh')), out);
    async function load() {
      out.replaceChildren(h('p', { class: 'muted' }, 'Building…'));
      var d = await run(async function () {
        var people = await fetchAll(function () { return sb.from('roster_view').select('body_id,matric,full_name,role_tier,is_top').eq('ay', ys.sel.value).order('id'); });
        var bodies = await fetchAll(function () { return sb.from('bodies').select('id,name,level,status,parent_committee,contact_email').order('id'); });
        var studs = await fetchAll(function () { return sb.from('students').select('matric,email').order('matric'); });
        var map = {}; studs.forEach(function (s) { map[s.matric] = s.email; });
        return L.buildGroups(bodies, people, map);
      });
      if (!d) return;
      out.replaceChildren(
        h('p', { class: 'muted' }, 'Copy each list into the matching Google Group (Members > Add members, paste the addresses).'),
        d.groups.map(function (g) {
          return h('div', { class: 'card' }, h('div', { class: 'row' }, h('strong', null, g.name), h('span', { class: 'pill' }, g.emails.length + ' emails'),
            h('button', { class: 'ghost', onclick: function () { navigator.clipboard.writeText(g.emails.join(', ')).then(function () { toast('Copied ' + g.name); }, function () { toast('Copy failed', true); }); } }, 'Copy')));
        }),
        d.missing.length ? h('div', null, h('h3', null, 'Missing emails (' + d.missing.length + ')'),
          table(['Name', 'Matric', 'Body', 'Role'], d.missing.map(function (m) { return [m.name, m.matric, m.body, m.role]; }))) : null);
    }
    load();
  }

  // ---------- import old data ----------
  function adminImport(el) {
    var files = {};
    var steps = [['positions', 'Positions sheet (Role Tier, Governance Level, Points, templates)'],
      ['bodies', 'Bodies sheet (includes Student Leader Emails as managers)'],
      ['students', 'Master Roster sheet'], ['log', 'Participation Log sheet']];
    var out = h('pre', { class: 'out', hidden: true });
    function say(t) { out.hidden = false; out.textContent += t + '\n'; out.scrollTop = out.scrollHeight; }
    var go = h('button', { class: 'btn', onclick: async function () {
      go.disabled = true; out.textContent = '';
      try {
        if (files.positions.files[0]) await impPositions(await csvFrom(files.positions));
        if (files.bodies.files[0]) await impBodies(await csvFrom(files.bodies));
        if (files.students.files[0]) await impStudents(await csvFrom(files.students));
        if (files.log.files[0]) await impLog(await csvFrom(files.log));
        say('All done.');
      } catch (e) { say('Stopped: ' + friendly(e)); }
      go.disabled = false;
    } }, 'Run import');

    async function impPositions(rows) {
      var recs = rows.map(function (r) {
        return { level: L.pick(r, ['Governance Level']), role_tier: L.pick(r, ['Role Tier (For Points)', 'Role Tier']), points: parseInt(L.pick(r, ['Points']), 10) || 0,
                 std_template: L.pick(r, ['Standard Template']) || '{Body} - {Role}', van_template: L.pick(r, ['Vanity Template']) || '{Body} - {Role} ({Vanity})' };
      }).filter(function (r) { return r.level && r.role_tier; });
      must(await sb.from('positions').upsert(recs, { onConflict: 'level,role_tier' }));
      say('Positions: ' + recs.length);
    }
    async function impBodies(rows) {
      var recs = rows.map(function (r) {
        return { name: L.pick(r, ['Name']), level: L.pick(r, ['Governance Level']), status: L.pick(r, ['Status']).toLowerCase() === 'inactive' ? 'Inactive' : 'Active',
                 parent_committee: L.pick(r, ['Parent Committee']) || null, contact_email: L.pick(r, ['Contact Email']) || null, _leaders: L.splitEmails(L.pick(r, ['Student Leader Emails'])) };
      }).filter(function (r) { return r.name && r.level; });
      var clean = recs.map(function (r) { var c = Object.assign({}, r); delete c._leaders; return c; });
      var saved = must(await sb.from('bodies').upsert(clean, { onConflict: 'name' }).select('id,name'));
      var idByName = {}; saved.forEach(function (b) { idByName[b.name] = b.id; });
      var links = [];
      recs.forEach(function (r) { r._leaders.forEach(function (e) { links.push({ body_id: idByName[r.name], email: e, source: 'manual' }); }); });
      if (links.length) for (var c of chunks(links, 500)) must(await sb.from('body_managers').upsert(c, { onConflict: 'body_id,email' }));
      say('Bodies: ' + recs.length + ', manager links: ' + links.length);
    }
    async function impStudents(rows) {
      var recs = [], seen = {};
      rows.forEach(function (r) {
        var m = L.pick(r, ['Matric No.']).toUpperCase();
        if (!m || seen[m]) return; seen[m] = 1;
        recs.push({ matric: m, full_name: L.pick(r, ['Name', 'Full Name']), preferred_name: L.pick(r, ['Preferred Name']) || null, gender: L.pick(r, ['Gender']) || null,
                    house: L.pick(r, ['House']) || null, email: (L.pick(r, ['NTU Email']) || '').toLowerCase() || null,
                    grad_year: parseInt(L.pick(r, ['Expected Grad Year']), 10) || null, status: L.normStatus(L.pick(r, ['Status'])), notes: L.pick(r, ['System Notes']) || null });
      });
      var n = 0;
      for (var c of chunks(recs.filter(function (r) { return r.full_name; }), 500)) { must(await sb.from('students').upsert(c, { onConflict: 'matric' })); n += c.length; say('Students: ' + n + ' / ' + recs.length); }
    }
    async function impLog(rows) {
      var bodies = must(await sb.from('bodies').select('id,name'));
      var idByName = {}; bodies.forEach(function (b) { idByName[b.name.trim().toLowerCase()] = b.id; });
      var years = {}; must(await sb.from('academic_years').select('ay')).forEach(function (y) { years[y.ay] = 1; });
      var recs = [], bad = [], seen = {};
      rows.forEach(function (r, i) {
        var ay = ayFromText(L.pick(r, ['Academic Year'])), m = L.pick(r, ['Matric No.']).toUpperCase();
        var bid = idByName[L.pick(r, ['Body']).trim().toLowerCase()], role = L.pick(r, ['Role Tier']);
        if (!ay || !m || !bid || !role) { bad.push('Row ' + (i + 2) + ': ' + (!ay ? 'year' : !m ? 'matric' : !bid ? 'body "' + L.pick(r, ['Body']) + '"' : 'role') + ' not recognised'); return; }
        var key = [ay, bid, m, role].join('|'); if (seen[key]) return; seen[key] = 1;
        recs.push({ ay: ay, matric: m, body_id: bid, role_tier: role, custom_text: L.pick(r, ['Custom Text']) || null });
      });
      var newYears = Object.keys(recs.reduce(function (a, r) { if (!years[r.ay]) a[r.ay] = 1; return a; }, {}));
      if (newYears.length) { must(await sb.from('academic_years').insert(newYears.map(function (y) { return { ay: y, is_open: false }; }))); say('Added years: ' + newYears.join(', ')); }
      var done = 0;
      for (var c of chunks(recs, 200)) {
        var r = await sb.from('participation').upsert(c, { onConflict: 'ay,body_id,matric,role_tier' });
        if (!r.error) done += c.length;
        else for (var one of c) {
          var r2 = await sb.from('participation').upsert(one, { onConflict: 'ay,body_id,matric,role_tier' });
          if (r2.error) bad.push(one.ay + ' ' + one.matric + ' ' + one.role_tier + ': ' + friendly(r2.error)); else done++;
        }
        say('Participation: ' + done + ' / ' + recs.length);
      }
      if (bad.length) say('\nCould not import ' + bad.length + ' rows:\n' + bad.slice(0, 200).join('\n') + (bad.length > 200 ? '\n…' : ''));
    }

    el.replaceChildren(
      h('p', { class: 'muted' }, 'One-off move from the old Sheet. In the Sheet use File > Download > CSV for each tab. Files are read in your browser and sent straight to your database. Do them in this order; any you leave empty are skipped. Safe to re-run.'),
      steps.map(function (s) { files[s[0]] = h('input', { type: 'file', accept: '.csv,.tsv,.txt' }); return h('div', { class: 'card' }, h('label', null, s[1]), files[s[0]]); }),
      h('div', { class: 'row' }, go), out);
  }

  sb.auth.onAuthStateChange(function (ev) {
    if (ev === 'SIGNED_OUT') { me = null; loginView(); }
    else if (ev === 'PASSWORD_RECOVERY') setTimeout(newPasswordView, 0);
  });
  boot();
})();
