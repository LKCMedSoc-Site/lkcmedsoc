// LKCMedSoc Feedback: sign-in, the page chrome and start-up.
(function () {
  'use strict';
  var P = window.P, h = P.h, sb = P.sb;
  var $bar = document.getElementById('appbar');
  var REDIRECT = location.origin + location.pathname;
  var ready = false;

  function authBox(title, children) {
    P.show(h('div', { class: 'login card' }, h('h2', null, title), children));
  }

  P.askSignIn = function () {
    var cur = location.hash;
    if (cur && cur !== '#/' && cur.indexOf('access_token') < 0) P.prefs.set('return', cur);
    loginView();
  };

  function loginView(mode, note) {
    mode = mode || 'signin';
    var email = h('input', { id: 'f-email', type: 'email', placeholder: 'you@e.ntu.edu.sg', autocomplete: 'username', class: 'grow' });
    var pw = h('input', { id: 'f-pw', type: 'password', autocomplete: mode === 'signup' ? 'new-password' : 'current-password', class: 'grow', placeholder: 'Password' });
    var pw2 = h('input', { id: 'f-pw2', type: 'password', autocomplete: 'new-password', class: 'grow', placeholder: 'Repeat password' });
    var btn = h('button', { class: 'btn', id: 'f-go' }, mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Email me a reset link' : 'Sign in');
    function go() {
      var e = email.value.trim().toLowerCase();
      if (e.indexOf('@') < 0) { P.toast('Enter your email', true); return; }
      btn.disabled = true;
      var done = function () { btn.disabled = false; };
      if (mode === 'signin') {
        sb.auth.signInWithPassword({ email: e, password: pw.value }).then(function (r) {
          done(); if (r.error) { P.toast(P.friendly(r.error), true); return; } boot();
        });
      } else if (mode === 'signup') {
        if (pw.value.length < 8) { done(); P.toast('Use at least 8 characters', true); return; }
        if (pw.value !== pw2.value) { done(); P.toast('The two passwords differ', true); return; }
        sb.auth.signUp({ email: e, password: pw.value, options: { emailRedirectTo: REDIRECT } }).then(function (r) {
          done(); if (r.error) { P.toast(P.friendly(r.error), true); return; }
          if (r.data && r.data.session) { boot(); return; }
          loginView('signin', 'Check your email for a confirmation link. Open it, then sign in here.');
        });
      } else {
        sb.auth.resetPasswordForEmail(e, { redirectTo: REDIRECT }).then(function (r) {
          done(); if (r.error) { P.toast(P.friendly(r.error), true); return; }
          loginView('signin', 'If that email has an account, a reset link is on its way.');
        });
      }
    }
    btn.addEventListener('click', go);
    [email, pw, pw2].forEach(function (i) { i.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') go(); }); });
    var link = function (label, m) { return h('button', { class: 'ghost', onclick: function () { loginView(m); } }, label); };
    authBox(mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Reset password' : 'Sign in', [
      note ? h('p', { class: 'pill ok' }, note) : null,
      mode === 'signup' ? h('p', { class: 'muted' }, 'Use your NTU email. We send a link to confirm it is yours. This is the same account as the records site.') : null,
      h('div', { class: 'row' }, email),
      mode === 'forgot' ? null : h('div', { class: 'row' }, pw),
      mode === 'signup' ? h('div', { class: 'row' }, pw2) : null,
      h('div', { class: 'row' }, btn),
      h('div', { class: 'row' },
        mode !== 'signin' ? link('Back to sign in', 'signin') : null,
        mode === 'signin' ? link('Create account', 'signup') : null,
        mode === 'signin' ? link('Forgot password', 'forgot') : null),
      null]);
  }

  function newPasswordView() {
    var pw = h('input', { id: 'f-newpw', type: 'password', autocomplete: 'new-password', class: 'grow', placeholder: 'New password' });
    var btn = h('button', { class: 'btn', onclick: async function () {
      if (pw.value.length < 8) { P.toast('Use at least 8 characters', true); return; }
      btn.disabled = true;
      var r = await sb.auth.updateUser({ password: pw.value });
      btn.disabled = false;
      if (r.error) { P.toast(P.friendly(r.error), true); return; }
      P.toast('Password saved'); boot();
    } }, 'Save password');
    authBox('Set a new password', [h('div', { class: 'row' }, pw), h('div', { class: 'row' }, btn)]);
  }

  // ---------- chrome: ONE bar under the shared LKCMedSoc menu ----------
  // Two spaces. Student: Issues and My feedback. Workspace (ExCo and the people handling issues): Tickets and Meetings.
  var STUDENT_NAV = [['board', 'Issues', '#/said'], ['mine', 'My feedback', '#/feedback/mine']];
  var WORK_NAV = [['tickets', 'Tickets', '#/tickets'], ['meetings', 'Meetings', '#/meetings']];
  var initials = function (s) { return String(s || '?').split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0].toUpperCase(); }).join(''); };

  function drawChrome() {
    var me = P.me, nav = P.current && P.current.opts && P.current.opts.nav;
    var space = P.spaceFor(nav);
    document.body.classList.toggle('work', space === 'work');
    if (!me) {
      $bar.replaceChildren(h('div', { class: 'in' },
        h('a', { class: 'appname', href: '#/' }, 'Feedback'),
        h('div', { class: 'appright' }, h('button', { class: 'btn', id: 'signin', onclick: P.askSignIn }, 'Sign in'))));
      return;
    }
    var items = space === 'work' ? WORK_NAV : STUDENT_NAV;
    var links = items.map(function (t) {
      return h('a', { class: t[0] === nav ? 'on' : '', href: t[2] }, t[1],
        t[0] === 'tickets' && P.triageCount ? h('span', { class: 'count', title: P.triageCount + ' waiting to be sorted' }, String(P.triageCount)) : null);
    });
    var right = [];
    if (P.canWork()) right.push(h('div', { class: 'switch', role: 'group', 'aria-label': 'Switch view' },
      h('a', { class: space === 'student' ? 'on' : '', href: '#/said', onclick: function () { P.prefs.set('space', 'student'); } }, 'Student view'),
      h('a', { class: space === 'work' ? 'on' : '', href: '#/tickets', onclick: function () { P.prefs.set('space', 'work'); } }, 'Workspace')));
    if (space === 'student') right.push(h('a', { class: 'btn', href: '#/suggest' }, 'Send feedback'));
    right.push(h('details', { class: 'acct' },
      h('summary', { 'aria-label': 'Account' }, h('span', { class: 'avatar' }, initials(me.name || me.email))),
      h('div', { class: 'menu' },
        h('div', { class: 'who' }, h('b', null, me.name || me.email), me.name && me.email ? me.email : ''),
        h('button', { onclick: newPasswordView }, 'Change password'),
        h('button', { id: 'signout', onclick: async function () { await sb.auth.signOut(); P.prefs.del('return'); location.hash = '#/'; boot(); } }, 'Sign out'))));
    $bar.replaceChildren(h('div', { class: 'in' },
      h('a', { class: 'appname', href: space === 'work' ? '#/tickets' : '#/said' }, 'Feedback', space === 'work' ? h('span', { class: 'space' }, 'Workspace') : null),
      h('nav', { class: 'appnav', 'aria-label': 'Feedback' }, links),
      h('div', { class: 'appright' }, right)));
  }
  // Which space a screen belongs to. Meetings are in both; they follow the last space used.
  P.canWork = function () { return !!(P.exco || P.assigned); };
  P.spaceFor = function (nav) {
    if (!P.canWork()) return 'student';
    if (nav === 'tickets') return 'work';
    if (nav === 'meetings') return P.prefs.get('space') === 'work' ? 'work' : 'student';
    return 'student';
  };
  P.onRoute = function () { drawChrome(); };
  P.refreshChrome = drawChrome;
  document.addEventListener('click', function (e) { var d = document.querySelector('.acct[open]'); if (d && !d.contains(e.target)) d.removeAttribute('open'); });

  async function boot() {
    var s = await sb.auth.getSession();
    P.me = null; P.exco = false; P.assigned = false; P.triageCount = 0;
    if (s.data.session) {
      try {
        P.me = P.must(await P.rec.rpc('whoami'));
        P.exco = !!P.must(await P.act.rpc('is_exco'));
        try { P.assigned = P.must(await P.act.rpc('my_issues')).length > 0; } catch (e) { /* not a responsible person, or not installed yet */ }
        if (P.exco) { try { var c = await P.act.from('feedback').select('id', { count: 'exact', head: true }).is('issue_id', null); P.triageCount = c.count || 0; } catch (e) { /* the badge is optional */ } }
      } catch (e) { P.toast(P.friendly(e), true); P.me = null; }
    }
    ready = true;
    drawChrome();
    var ret = P.prefs.get('return');
    if (P.me && ret) { P.prefs.del('return'); P.nav(ret); return; }
    P.dispatch();
  }

  sb.auth.onAuthStateChange(function (ev) { if (ev === 'PASSWORD_RECOVERY') newPasswordView(); });
  window.addEventListener('hashchange', function () { if (ready) P.dispatch(); });
  boot();
})();
