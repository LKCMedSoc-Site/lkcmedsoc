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

  // The sign-in lightbox is shared by every LKCMedSoc site (shared/signin.js). The page behind it only says to sign in.
  function loginView(note) {
    P.show(h('div', { class: 'card' }, h('p', { class: 'muted' }, 'Sign in with your NTU email to continue.'),
      h('div', { class: 'row' }, h('button', { class: 'btn', onclick: function () { loginView(); } }, 'Sign in'))));
    window.LKCSignIn.open({ sb: sb, redirect: REDIRECT, friendly: P.friendly, note: note, onSignedIn: boot });
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
        !window.LKCSignIn || LKCSignIn.hasPassword() ? h('button', { onclick: newPasswordView }, 'Change password') : null,   // Google accounts have no password
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
