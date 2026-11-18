(function () {
  'use strict';
  var cfg = window.RECORDS_CONFIG, L = window.RecordsLib;
  var sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { db: { schema: 'records' }, auth: { storage: window.LKCSession.storage } });

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
  // The sign-in lightbox is shared by every LKCMedSoc site (shared/signin.js). The page behind it only says to sign in.
  function loginView(note) {
    $tabs.hidden = true; $who.replaceChildren();
    show(h('div', { class: 'card' }, h('p', { class: 'muted' }, 'Sign in with your NTU email to continue.'),
      h('div', { class: 'row' }, h('button', { class: 'btn', onclick: function () { loginView(); } }, 'Sign in'))));
    window.LKCSignIn.open({ sb: sb, redirect: REDIRECT, friendly: friendly, note: note, onSignedIn: boot });
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
    if (me.can_manage || me.is_admin) tabs.push(['manage', 'Manage body']);
    if (me.is_admin) tabs.push(['admin', 'Admin']);
    if (!tabs.some(function (t) { return t[0] === tab; })) tab = 'record';
    $tabs.hidden = false;
    $tabs.replaceChildren.apply($tabs, tabs.map(function (t) {
      return h('button', { class: t[0] === tab ? 'on' : '', onclick: function () { tab = t[0]; boot(); } }, t[1]);
    }));
    if (tab === 'record') recordView();
    else if (tab === 'manage') {
      var kit = { h: h, sb: sb, must: must, run: run, toast: toast, show: show, field: field, friendly: friendly, table: table, me: me,
        roster: rosterInto, pageEditor: function (slot, body) { window.GroupPages.edit(kit, body, slot); } };
      window.ManageBody.view(kit);
    }
    else adminView();
  }


  // ---------- my photo (ExCo, committee heads, year and house reps, group chairs and vice-chairs; who is allowed is decided in sql/photo_access.sql) ----------
  var PHOTO_BUCKET = 'leader-photos';
  // Crop picker: the chosen photo sits in the round frame; drag to move it, slide or scroll to zoom. What is inside the circle is exactly what is saved
  // (a square of it, shrunk to at most 600 px, since the website shows it round or square).
  function cropPhoto(file) {
    return new Promise(function (resolve, reject) {
      createImageBitmap(file).then(function (bmp) {
        var F = 280, D = Math.round(F * (window.devicePixelRatio > 1 ? 2 : 1));
        var base = F / Math.min(bmp.width, bmp.height), zoom = 1, cx = bmp.width / 2, cy = bmp.height / 2;
        var canvas = h('canvas', { class: 'cropcanvas', width: D, height: D, tabindex: 0, 'aria-label': 'Photo crop. Drag to move, plus and minus to zoom.' });
        canvas.style.width = F + 'px'; canvas.style.height = F + 'px';
        var ctx = canvas.getContext('2d');
        var slider = h('input', { type: 'range', min: 1, max: 4, step: 0.01, value: 1, 'aria-label': 'Zoom' });
        function half() { return F / (2 * base * zoom); }
        function clamp() { var k = half(); cx = Math.min(bmp.width - k, Math.max(k, cx)); cy = Math.min(bmp.height - k, Math.max(k, cy)); }
        function draw() { clamp(); var k = half(); ctx.clearRect(0, 0, D, D); ctx.drawImage(bmp, cx - k, cy - k, 2 * k, 2 * k, 0, 0, D, D); }
        function setZoom(z) { zoom = Math.min(4, Math.max(1, z)); slider.value = zoom; draw(); }
        slider.addEventListener('input', function () { setZoom(parseFloat(slider.value)); });
        canvas.addEventListener('wheel', function (e) { e.preventDefault(); setZoom(zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08)); }, { passive: false });
        var pts = {}, pinch = 0;
        canvas.addEventListener('pointerdown', function (e) { canvas.setPointerCapture(e.pointerId); pts[e.pointerId] = [e.clientX, e.clientY]; pinch = 0; });
        canvas.addEventListener('pointermove', function (e) {
          var p = pts[e.pointerId]; if (!p) return;
          var ids = Object.keys(pts);
          if (ids.length === 2) {
            var o = pts[ids.filter(function (i) { return +i !== e.pointerId; })[0]]; pts[e.pointerId] = [e.clientX, e.clientY];
            var d = Math.hypot(e.clientX - o[0], e.clientY - o[1]); if (pinch) setZoom(zoom * d / pinch); pinch = d; return;
          }
          var s = base * zoom; cx -= (e.clientX - p[0]) / s; cy -= (e.clientY - p[1]) / s; pts[e.pointerId] = [e.clientX, e.clientY]; draw();
        });
        function up(e) { delete pts[e.pointerId]; pinch = 0; }
        canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
        canvas.addEventListener('keydown', function (e) {
          var step = 12 / (base * zoom), moved = true;
          if (e.key === 'ArrowLeft') cx -= step; else if (e.key === 'ArrowRight') cx += step; else if (e.key === 'ArrowUp') cy -= step; else if (e.key === 'ArrowDown') cy += step;
          else if (e.key === '+' || e.key === '=') setZoom(zoom * 1.1); else if (e.key === '-') setZoom(zoom / 1.1); else moved = false;
          if (moved) { e.preventDefault(); draw(); }
        });
        function close(v, err) { bg.remove(); document.removeEventListener('keydown', esc); if (err) reject(err); else resolve(v); }
        function esc(e) { if (e.key === 'Escape') close(null); }
        var ok = h('button', { class: 'btn', type: 'button', onclick: function () {
          clamp(); var k = half(), size = Math.max(1, Math.min(600, Math.floor(2 * k))), c = document.createElement('canvas'); c.width = size; c.height = size;
          c.getContext('2d').drawImage(bmp, cx - k, cy - k, 2 * k, 2 * k, 0, 0, size, size);
          c.toBlob(function (b) { b ? close(b) : close(null, new Error('Could not prepare the photo.')); }, 'image/webp', 0.88);
        } }, 'Use this crop');
        var bg = h('div', { class: 'cropbg', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Crop your photo' },
          h('div', { class: 'cropbox' }, h('strong', null, 'Crop your photo'), h('p', { class: 'muted' }, 'Drag the photo to move it. Slide or scroll to zoom. What you see in the circle is what is saved.'),
            h('div', { class: 'cropframe' }, canvas), h('div', { class: 'row' }, h('span', { class: 'muted' }, 'Zoom'), slider),
            h('div', { class: 'row' }, ok, h('button', { class: 'ghost', type: 'button', onclick: function () { close(null); } }, 'Cancel'))));
        document.body.appendChild(bg); document.addEventListener('keydown', esc); draw(); canvas.focus();
      }).catch(reject);
    });
  }
  function photoPath(url) { var i = url ? url.indexOf('/' + PHOTO_BUCKET + '/') : -1; return i < 0 ? null : url.slice(i + PHOTO_BUCKET.length + 2); }
  async function photoCard() {
    var res = await sb.rpc('my_photo');
    var row = !res.error && res.data && res.data[0];
    if (!row || !row.eligible) return null;
    var url = row.photo_url || '', pending = false;
    var prev = h('div', { class: 'imgprev round' });
    var show = h('input', { type: 'checkbox', checked: !!row.show_photo });
    var msg = h('span', { class: 'muted' });
    var file = h('input', { type: 'file', accept: 'image/*', hidden: true });
    function paint() { prev.replaceChildren(url ? h('img', { src: url, alt: 'Your photo' }) : h('span', { class: 'muted' }, 'No photo yet')); rm.hidden = !url; }
    var rm = h('button', { class: 'danger', type: 'button', onclick: async function () {
      if (!confirm('Remove your photo? It will disappear from the website.')) return;
      var old = photoPath(url);
      var ok = await run(async function () {
        must(await sb.rpc('save_my_photo', { p_url: null, p_show: false }));
        if (old) await sb.storage.from(PHOTO_BUCKET).remove([old]);
      }, 'Photo removed');
      if (ok !== undefined) { url = ''; show.checked = false; pending = false; msg.textContent = ''; paint(); }
    } }, 'Remove my photo');
    var pick = h('button', { class: 'btn', type: 'button', onclick: function () { file.click(); } }, 'Upload a photo');
    file.addEventListener('change', async function () {
      var f = file.files[0]; if (!f) return;
      if (!/^image\//.test(f.type)) { toast('Please choose an image file', true); file.value = ''; return; }
      pick.disabled = true; msg.textContent = 'Choose how it is cropped…';
      try {
        var blob = await cropPhoto(f);
        if (!blob) { msg.textContent = ''; pick.disabled = false; file.value = ''; return; }
        msg.textContent = 'Uploading…';
        var path = me.matric + '/' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + '.webp';
        var up = await sb.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: 'image/webp', cacheControl: '31536000' });
        if (up.error) throw up.error;
        url = sb.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl; pending = true;
        msg.textContent = 'Uploaded. Press Save to keep it.'; paint();
      } catch (e) { msg.textContent = ''; toast(friendly(e), true); }
      pick.disabled = false; file.value = '';
    });
    var save = h('button', { class: 'btn', type: 'button', onclick: async function () {
      var old = row.photo_url && row.photo_url !== url ? photoPath(row.photo_url) : null;
      var ok = await run(async function () {
        must(await sb.rpc('save_my_photo', { p_url: url || null, p_show: show.checked }));
        if (old) await sb.storage.from(PHOTO_BUCKET).remove([old]);
      }, 'Saved');
      if (ok !== undefined) { row.photo_url = url; pending = false; msg.textContent = ''; }
    } }, 'Save');
    paint();
    return h('div', { class: 'card' }, h('strong', null, 'My photo'),
      h('p', { class: 'muted' }, 'Photos are for ExCo members, committee heads, year and house representatives, and chairs and vice-chairs of student groups. Yours appears on the LKCMedSoc website (Meet the Team and your committee page) only if you tick the box below. You can change or remove it any time.'),
      prev, h('div', { class: 'row' }, pick, rm, msg), file,
      h('label', { class: 'check' }, show, ' Show my photo on the LKCMedSoc website'),
      h('div', { class: 'row' }, save));
  }

  // ---------- my record ----------
  async function recordView() {
    show(h('p', { class: 'muted' }, 'Loading…'));
    var rows = await run(async function () { return must(await sb.rpc('my_record')); });
    if (!rows) return;
    var total = rows.reduce(function (a, r) { return a + (r.points || 0); }, 0);
    var photo = await photoCard();
    show(h('div', null,
      h('h2', null, 'My record'),
      me.matric ? null : h('p', { class: 'muted' }, 'Your email is not linked to a student record yet. If this is wrong, ask an admin to check the roster.'),
      h('div', { class: 'card' }, h('div', { class: 'muted' }, 'Total points'), h('div', { class: 'total' }, total)),
      photo,
      rows.length ? table(['Year', 'Level', 'Body', 'Position', 'Points'], rows.map(function (r) { return [r.ay, r.level, r.body, r.title, r.points]; }), [4])
                  : h('p', { class: 'muted' }, 'No positions recorded yet.')));
  }

  // ---------- roster editor (the Team section of Manage body) ----------
  var rs = { ay: null };
  async function rosterInto(holder, body) {
    holder.replaceChildren(h('p', { class: 'muted' }, 'Loading…'));
    var years = await run(async function () { return must(await sb.from('academic_years').select('*').order('ay', { ascending: false })); });
    if (!years) return;
    if (!rs.ay || !years.some(function (y) { return y.ay === rs.ay; })) {
      var open = years.filter(function (y) { return y.is_open; })[0];
      rs.ay = (open || years[0] || {}).ay;
    }
    var year = years.filter(function (y) { return y.ay === rs.ay; })[0];
    var editable = !!year && (year.is_open || me.is_admin);
    var aySel = h('select', { onchange: function () { rs.ay = aySel.value; rosterInto(holder, body); } },
      years.map(function (y) { return h('option', { value: y.ay, selected: y.ay === rs.ay }, y.ay + (y.is_open ? '' : ' (closed)')); }));
    var inner = h('div', null, h('p', { class: 'muted' }, 'Loading roster…'));
    holder.replaceChildren(h('div', { class: 'row' }, aySel), inner);
    if (!year) { inner.replaceChildren(h('p', { class: 'muted' }, 'No academic years exist yet. Ask an admin to add one.')); return; }

    var res = await run(async function () {
      return {
        roster: await fetchAll(function () { return sb.from('roster_view').select('*').eq('body_id', body.id).eq('ay', rs.ay).order('points', { ascending: false }).order('full_name'); }),
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
          rosterInto(holder, body);
        } }, 'Remove') : ''];
    }), [3]) : h('p', { class: 'muted' }, 'Nobody yet.'));
    if (editable) parts.push(addForms(body, res.positions, function () { rosterInto(holder, body); }));
    inner.replaceChildren.apply(inner, parts);
  }

  function addForms(body, positions, reload) {
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
        must(await sb.from('participation').insert({ ay: rs.ay, body_id: body.id, matric: picked.matric, role_tier: role.value, custom_text: custom.value.trim() || null }));
        return true;
      }, 'Added');
      add.disabled = false;
      if (ok) reload();
    } }, 'Add to roster');

    var bulkRole = h('select', null, positions.map(function (p) { return h('option', { value: p.role_tier }, p.role_tier); }));
    var bulk = h('textarea', { placeholder: 'Paste matric numbers, one per line or separated by commas' });
    var report = h('pre', { class: 'out', hidden: true });
    var bulkBtn = h('button', { class: 'btn', onclick: async function () {
      var list = bulk.value.split(/[\s,;]+/).map(function (x) { return x.trim().toUpperCase(); }).filter(Boolean);
      list = list.filter(function (v, i) { return list.indexOf(v) === i; });
      if (!list.length) { toast('Nothing to add', true); return; }
      bulkBtn.disabled = true;
      var mk = function (m) { return { ay: rs.ay, body_id: body.id, matric: m, role_tier: bulkRole.value }; };
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
      if (!failed.length) reload();
    } }, 'Add all');

    return h('div', null,
      h('h3', null, 'Add one person'),
      h('div', { class: 'card' }, h('div', { class: 'row' }, q), results, chosen,
        h('div', { class: 'row' }, field('Position', role), field('Custom wording', custom)), h('div', { class: 'row' }, add)),
      h('h3', null, 'Add many by matric number'),
      h('div', { class: 'card' }, bulk, h('div', { class: 'row' }, field('Position for all', bulkRole)), h('div', { class: 'row' }, bulkBtn), report));
  }

  // ---------- admin ----------
  var ADMIN_TABS = [['directory', 'Directory'], ['card', 'Report card'], ['years', 'Years'], ['positions', 'Positions'],
    ['admins', 'Admins'], ['signin', 'Sign-in list'], ['sync', 'Annual sync'], ['groups', 'Email groups'], ['import', 'Import old data']];
  function adminView() {
    var holder = h('div');
    var bar = h('div', { class: 'subtabs' }, ADMIN_TABS.map(function (t) {
      return h('button', { class: t[0] === adminTab ? 'on' : '', onclick: function () { adminTab = t[0]; adminView(); } }, t[1]);
    }));
    show(h('div', null, h('h2', null, 'Admin'), bar, holder));
    ({ directory: adminDirectory, card: adminCard, years: adminYears, positions: adminPositions,
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
