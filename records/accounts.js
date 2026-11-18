// LKCMedSoc Records: the People tab (ExCo only). A table of everyone approved to sign up; click a person to manage their record
// (name, house, graduation year, status, type, end date, notes, email) and their account (send a reset code, change email, delete).
// Also adds students by hand (exchange students) and marks graduates as alumni. The database functions (sql/accounts_admin.sql) check
// that the caller is ExCo on every call, so hiding the tab is only a courtesy.
(function () {
  'use strict';
  var FILTERS = [['all', 'Everyone'], ['in', 'Signed up'], ['out', 'Not signed up yet'], ['odd', 'Not on the list'], ['loa', 'LOA'], ['special', 'Exchange / retainee'], ['alumni', 'Alumni']];
  var STATUSES = [['Active', 'Active'], ['LOA', 'Leave of absence'], ['Graduated', 'Alumni'], ['Dropped Out', 'Dropped out']];
  var KINDS = [['Regular', 'Regular'], ['Retainee', 'Retainee'], ['Exchange', 'Exchange']];
  var SHOW = 300;
  var st = { q: '', f: 'all' };

  function view(kit) {
    var h = kit.h, sb = kit.sb, must = kit.must, run = kit.run, toast = kit.toast;
    var rows = [];
    var holder = h('div');
    var panel = null, onKey = null;
    kit.show(h('div', null, h('h2', null, 'People'), holder));
    load();

    // ---------- helpers ----------
    var fullEmail = function (v) { v = String(v || '').trim().toLowerCase(); return v && v.indexOf('@') < 0 ? v + '@e.ntu.edu.sg' : v; };
    var date = function (s) { return s ? new Date(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : ''; };
    var who = function (r) { return r.name || r.email; };
    var select = function (list, value) { return h('select', null, list.map(function (o) { return h('option', { value: o[0], selected: o[0] === value }, o[1]); })); };
    var field = function (name, input) { return h('label', { class: 'pp-field' }, h('span', null, name), input); };
    async function load(reopen) {
      var r = await run(async function () { return must(await sb.rpc('accounts_list')); });
      if (!r) { holder.replaceChildren(h('p', { class: 'muted' }, 'Could not load the people. Has sql/accounts_admin.sql been run?')); return; }
      rows = r; draw();
      if (reopen) { var again = rows.filter(function (x) { return (reopen.matric && x.matric === reopen.matric) || x.email === reopen.email; })[0]; if (again) openPanel(again); else closePanel(); }
    }

    // ---------- table ----------
    function match(r) {
      if (st.f === 'in' && !r.signed_up) return false;
      if (st.f === 'out' && (r.signed_up || r.alumni || !r.approved)) return false;
      if (st.f === 'odd' && !(r.signed_up && !r.approved)) return false;
      if (st.f === 'loa' && r.status !== 'LOA') return false;
      if (st.f === 'special' && !(r.kind && r.kind !== 'Regular')) return false;
      if (st.f === 'alumni' && !(r.alumni || r.alumni_due)) return false;
      var q = st.q.trim().toLowerCase();
      return !q || (r.email + ' ' + (r.name || '') + ' ' + (r.matric || '')).toLowerCase().indexOf(q) >= 0;
    }
    function statusCell(r) {
      return h('span', null,
        r.alumni ? h('span', { class: 'pill' }, 'Alumni') : r.alumni_due ? h('span', { class: 'pill bad', title: 'Graduation year or end date has passed' }, 'Alumni due')
          : r.status === 'LOA' ? h('span', { class: 'pill' }, 'LOA') : (r.status || ''),
        r.kind && r.kind !== 'Regular' ? [' ', h('span', { class: 'pill' }, r.kind)] : null,
        (r.roles || []).filter(function (x) { return x === 'admin' || x === 'manager'; }).map(function (x) { return [' ', h('span', { class: 'pill' }, x)]; }));
    }
    function accountCell(r) {
      if (!r.signed_up) return h('span', { class: 'muted' }, r.alumni ? '' : 'Not yet');
      return h('span', null,
        !r.approved ? h('span', { class: 'pill bad' }, 'Not on the list') : r.confirmed ? h('span', { class: 'pill ok' }, 'Signed up') : h('span', { class: 'pill' }, 'Not confirmed'),
        h('span', { class: 'acct-sub' }, r.last_sign_in ? 'Last in ' + date(r.last_sign_in) : 'Never signed in'));
    }
    function draw() {
      var approved = rows.filter(function (r) { return r.approved && !r.alumni; });
      var signedUp = approved.filter(function (r) { return r.signed_up; }).length;
      var odd = rows.filter(function (r) { return r.signed_up && !r.approved; }).length;
      var due = rows.filter(function (r) { return r.alumni_due; });
      var next = rows.filter(function (r) { return r.status === 'Active' && r.kind !== 'Exchange' && r.grad_year && !r.alumni_due; }).map(function (r) { return r.grad_year; }).sort()[0];
      var search = h('input', { class: 'grow', placeholder: 'Search name, email or matric', value: st.q, oninput: function () { st.q = search.value; drawTable(); } });
      var tableHolder = h('div');
      function drawTable() {
        var l = rows.filter(match), s = l.slice(0, SHOW);
        tableHolder.replaceChildren(h('div', null,
          l.length ? tbl(s) : h('p', { class: 'muted' }, 'Nobody matches.'),
          l.length > SHOW ? h('p', { class: 'muted' }, 'Showing the first ' + SHOW + ' of ' + l.length + '. Search to narrow it down.') : null));
      }
      function tbl(list) {
        return h('div', { class: 'scroll' }, h('table', { class: 'pp-table' },
          h('thead', null, h('tr', null, ['Person', 'Year', 'Status', 'Account'].map(function (x) { return h('th', null, x); }))),
          h('tbody', null, list.map(function (r) {
            return h('tr', { tabindex: '0', onclick: function () { openPanel(r); }, onkeydown: function (e) { if (e.key === 'Enter') openPanel(r); } },
              h('td', null, h('strong', null, who(r)), h('span', { class: 'acct-sub' }, r.email)),
              h('td', null, r.grad_year || ''), h('td', null, statusCell(r)), h('td', null, accountCell(r)));
          }))));
      }
      holder.replaceChildren(
        h('p', { class: 'muted' }, 'Everyone approved to sign up, and whether they have an account. Click a person to manage their record and account. ExCo only.'),
        h('p', null, h('strong', null, signedUp), ' of ', approved.length, ' approved people have signed up',
          odd ? [' · ', h('span', { class: 'pill bad' }, odd + ' account' + (odd === 1 ? '' : 's') + ' not on the list')] : null),
        h('div', { class: 'row' },
          due.length ? h('button', { class: 'btn', onclick: function () { markAlumni(due.length); } }, 'Mark ' + due.length + ' as alumni')
            : h('span', { class: 'muted' }, next ? 'No one is due to become alumni yet. Next graduating year: ' + next + ' (from 1 July).' : 'No one is due to become alumni.'),
          h('button', { class: 'ghost', onclick: function () { openAdd(); } }, 'Add a student')),
        h('div', { class: 'subtabs' }, FILTERS.map(function (f) {
          return h('button', { class: f[0] === st.f ? 'on' : '', onclick: function () { st.f = f[0]; draw(); } }, f[1]);
        })),
        h('div', { class: 'row' }, search),
        tableHolder);
      drawTable();
    }
    async function markAlumni(n) {
      if (!confirm('Mark ' + n + ' as alumni?\n\nStudents whose graduation year has passed, and exchange students whose end date has passed. They keep any account they already have, but cannot create a new one.')) return;
      var c = await run(async function () { return must(await sb.rpc('accounts_mark_alumni')); });
      if (c !== undefined) { toast(c + ' marked as alumni'); load(); }
    }

    // ---------- the side panel ----------
    function closePanel() {
      if (!panel) return;
      panel.remove(); panel = null; document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    }
    function shell(title, sub) {
      closePanel();
      var body = h('div', { class: 'pp-body' });
      var x = h('button', { class: 'pp-x', type: 'button', 'aria-label': 'Close', onclick: closePanel }, '×');
      var box = h('aside', { class: 'pp-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
        h('div', { class: 'pp-head' }, h('div', null, h('h3', null, title), sub ? h('span', { class: 'acct-sub' }, sub) : null), x), body);
      panel = h('div', { class: 'pp-back', onmousedown: function (e) { if (e.target === panel) closePanel(); } }, box);
      onKey = function (e) { if (e.key === 'Escape') closePanel(); };
      window.addEventListener('keydown', onKey);
      document.body.style.overflow = 'hidden';
      document.body.appendChild(panel);
      return body;
    }

    function openPanel(r) {
      var body = shell(who(r), r.email);
      if (r.matric) body.appendChild(recordSection(r));
      body.appendChild(accountSection(r));
      if (r.matric) {
        var extra = h('div', null, h('p', { class: 'muted' }, 'Loading positions…'));
        body.appendChild(extra);
        sb.rpc('student_get', { p_matric: r.matric }).then(function (x) {
          if (x.error || !panel) { extra.replaceChildren(h('p', { class: 'muted' }, 'Could not load positions.')); return; }
          var d = x.data;
          extra.replaceChildren(
            h('h4', null, 'Positions held'),
            d.positions.length ? h('ul', { class: 'pp-list' }, d.positions.map(function (p) { return h('li', null, h('strong', null, p.ay), ' · ', p.body, ' · ', p.title || '', ' · ', p.points + ' pts'); }))
              : h('p', { class: 'muted' }, 'None recorded.'),
            h('h4', null, 'Recent changes'),
            d.changes.length ? h('ul', { class: 'pp-list' }, d.changes.map(function (c) {
              var keys = Object.keys((c.change && (c.change.after || c.change.added)) || {});
              return h('li', null, date(c.at), ' · ', c.by || '', h('span', { class: 'acct-sub' }, c.change && c.change.added ? 'Added by hand' : 'Changed: ' + keys.join(', ')));
            })) : h('p', { class: 'muted' }, 'No changes made here yet.'));
        });
      }
    }

    function recordSection(r) {
      var prefNow = r.name && r.name !== r.email ? r.name : '';
      var s = { pref: h('input', { value: prefNow }), house: h('input', { value: r.house || '' }),
        year: h('input', { type: 'number', value: r.grad_year || '' }), status: select(STATUSES, r.status || 'Active'), kind: select(KINDS, r.kind || 'Regular'),
        until: h('input', { type: 'date', value: r.until || '' }), notes: h('textarea', { rows: '2' }), email: h('input', { type: 'email', value: r.email, disabled: r.signed_up }) };
      var save = h('button', { class: 'btn', onclick: async function () {
        var p = {};
        if (s.pref.value.trim() !== prefNow) p.preferred_name = s.pref.value.trim();
        if (s.house.value.trim() !== (r.house || '')) p.house = s.house.value.trim();
        if (String(s.year.value || '') !== String(r.grad_year || '')) p.grad_year = s.year.value || null;
        if (s.status.value !== (r.status || 'Active')) p.status = s.status.value;
        if (s.kind.value !== (r.kind || 'Regular')) p.kind = s.kind.value;
        if ((s.until.value || '') !== (r.until || '')) p.until = s.until.value || null;
        if (s.notes.dataset.touched) p.notes = s.notes.value;
        if (!r.signed_up && fullEmail(s.email.value) !== r.email) p.email = fullEmail(s.email.value);
        if (!Object.keys(p).length) { toast('Nothing changed'); return; }
        save.disabled = true;
        var ok = await run(async function () { must(await sb.rpc('student_update', { p_matric: r.matric, p: p })); return true; }, 'Saved');
        save.disabled = false;
        if (ok) load({ matric: r.matric, email: p.email || r.email });
      } }, 'Save record');
      s.notes.addEventListener('input', function () { s.notes.dataset.touched = '1'; });
      sb.rpc('student_get', { p_matric: r.matric }).then(function (x) { if (!x.error && !s.notes.dataset.touched) s.notes.value = (x.data.student.notes || ''); });
      return h('section', { class: 'pp-sec' }, h('h4', null, 'Record'),
        h('p', { class: 'muted' }, 'Matric ' + r.matric),
        h('div', { class: 'pp-grid' },
          field('Preferred name', s.pref), field('House', s.house),
          field('Status', s.status), field('Type', s.kind),
          field('Graduation year', s.year), field('Ends (exchange) or returns (LOA)', s.until)),
        field('Email' + (r.signed_up ? ' (has an account: change it under Account)' : ''), s.email),
        field('Notes', s.notes), h('div', { class: 'row' }, save));
    }

    function accountSection(r) {
      var cell = h('div');
      function actions() {
        if (r.email === kit.me.email) return h('p', { class: 'muted' }, 'This is you.');
        return h('div', { class: 'acct-actions' },
          h('button', { class: 'ghost', onclick: function () { sendReset(r); } }, 'Send reset code'),
          h('button', { class: 'ghost', onclick: function () { editEmail(r, cell, actions); } }, 'Change email'),
          h('button', { class: 'danger', onclick: function () { remove(r); } }, 'Delete account'));
      }
      if (!r.signed_up) return h('section', { class: 'pp-sec' }, h('h4', null, 'Account'), h('p', { class: 'muted' }, r.alumni ? 'No account. Alumni cannot create one.' : r.approved ? 'No account yet. They can sign up with ' + r.email + '.' : 'No account, and this email is not approved to sign up.'));
      cell.appendChild(actions());
      return h('section', { class: 'pp-sec' }, h('h4', null, 'Account'),
        h('p', null, !r.approved ? h('span', { class: 'pill bad' }, 'Not on the list') : r.confirmed ? h('span', { class: 'pill ok' }, 'Signed up') : h('span', { class: 'pill' }, 'Not confirmed'),
          ' ', h('span', { class: 'muted' }, 'Created ' + date(r.signed_up_at) + (r.last_sign_in ? ' · last in ' + date(r.last_sign_in) : ' · never signed in'))), cell);
    }
    async function sendReset(r) {
      if (!confirm('Email ' + r.email + ' a password reset code?\n\nThey type it into the sign-in box under Forgot password > "I already have a code".')) return;
      await run(async function () { var x = await sb.auth.resetPasswordForEmail(r.email, { redirectTo: location.origin + location.pathname }); if (x.error) throw x.error; return true; }, 'Reset code sent to ' + r.email);
    }
    async function remove(r) {
      if (!confirm('Delete the account for ' + who(r) + ' (' + r.email + ')?\n\nThey are signed out and their password is gone. Their roster record and anything they wrote stay. If they are on the approved list they can sign up again.\n\nThis cannot be undone.')) return;
      var ok = await run(async function () { must(await sb.rpc('accounts_delete', { p_user: r.user_id })); return true; }, 'Account deleted');
      if (ok) { closePanel(); load(); }
    }
    function editEmail(r, cell, back) {
      var inp = h('input', { type: 'email', class: 'grow', value: r.email });
      var move = h('input', { type: 'checkbox', checked: true });
      var save = h('button', { class: 'btn', onclick: async function () {
        var nw = fullEmail(inp.value);
        if (!nw || nw === r.email) { toast('Type the new email', true); return; }
        if (!confirm('Change the sign-in email for ' + who(r) + '\nfrom ' + r.email + '\nto ' + nw + '?\n\nThey are signed out everywhere and sign in with the new email (same password).' + (move.checked ? '\nTheir roster and role records move to the new email too.' : ''))) return;
        save.disabled = true;
        var ok = await run(async function () { must(await sb.rpc('accounts_change_email', { p_user: r.user_id, p_new: nw, p_move: move.checked })); return true; }, 'Email changed');
        save.disabled = false;
        if (ok) load({ matric: r.matric, email: nw });
      } }, 'Save email');
      cell.replaceChildren(h('div', { class: 'acct-edit' }, inp,
        h('label', { class: 'chk' }, move, ' Also move their roster and role records'),
        h('div', { class: 'row' }, save, h('button', { class: 'ghost', onclick: function () { cell.replaceChildren(back()); } }, 'Cancel'))));
      inp.focus(); inp.select();
    }

    function openAdd() {
      var body = shell('Add a student', 'For exchange students and anyone not in the yearly lists');
      var f = { matric: h('input', { placeholder: 'U2512345A' }), name: h('input'), pref: h('input'), email: h('input', { type: 'email', placeholder: 'name@e.ntu.edu.sg' }),
        house: h('input'), kind: select(KINDS, 'Exchange'), until: h('input', { type: 'date' }), year: h('input', { type: 'number' }), notes: h('textarea', { rows: '2' }) };
      var go = h('button', { class: 'btn', onclick: async function () {
        var p = { matric: f.matric.value, full_name: f.name.value, preferred_name: f.pref.value, email: fullEmail(f.email.value), house: f.house.value,
          kind: f.kind.value, until: f.until.value || null, grad_year: f.year.value || null, notes: f.notes.value };
        go.disabled = true;
        var ok = await run(async function () { must(await sb.rpc('student_add', { p: p })); return true; }, 'Student added');
        go.disabled = false;
        if (ok) { closePanel(); load({ matric: String(p.matric).trim().toUpperCase(), email: p.email }); }
      } }, 'Add student');
      body.appendChild(h('div', null,
        h('p', { class: 'muted' }, 'They can then create an account with this email. The yearly sync leaves exchange students alone; they become alumni after their end date.'),
        h('div', { class: 'pp-grid' }, field('Matric', f.matric), field('Full name', f.name), field('Preferred name', f.pref), field('House', f.house), field('Type', f.kind), field('Ends on', f.until)),
        field('NTU email', f.email), field('Graduation year (optional)', f.year), field('Notes', f.notes), h('div', { class: 'row' }, go)));
      f.matric.focus();
    }
  }

  window.Accounts = { view: view };
})();
