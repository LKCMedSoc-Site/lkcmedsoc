// LKCMedSoc Gazette: sign-in, the page chrome and start-up.
(function () {
  'use strict';
  var P = window.P, h = P.h, sb = P.sb;
  var $tabs = document.getElementById('tabs'), $who = document.getElementById('who');
  var REDIRECT = location.origin + location.pathname;
  var ready = false;

  function authBox(title, children) {
    $tabs.hidden = true;
    P.show(h('div', { class: 'login card' }, h('h2', null, title), children));
  }

  P.askSignIn = function () {
    var cur = location.hash;
    if (cur && cur !== '#/' && cur.indexOf('access_token') < 0) P.prefs.set('return', cur);
    loginView();
  };

  // The sign-in lightbox is shared by every LKCMedSoc site (shared/signin.js). The page behind it only says to sign in.
  function loginView(note) {
    $tabs.hidden = true;
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

  // ---------- chrome ----------
  function drawChrome() {
    var me = P.me;
    if (me) {
      $who.replaceChildren(h('span', null, me.name || me.email), (!window.LKCSignIn || LKCSignIn.hasPassword() ? h('button', { class: 'who-btn', onclick: newPasswordView }, 'Password') : null),
        h('button', { class: 'who-btn', id: 'signout', onclick: async function () { await sb.auth.signOut(); P.prefs.del('return'); location.hash = '#/'; boot(); } }, 'Sign out'));
    } else {
      $who.replaceChildren(h('button', { class: 'who-btn', id: 'signin', onclick: P.askSignIn }, 'Sign in'));
    }
    drawTabs();
  }
  function drawTabs() {
    var tabs = [];
    if (P.me) tabs.push(['posts', 'My posts', '#/posts']);
    if (P.approver || P.exco) tabs.push(['review', 'Review' + (P.badge ? ' (' + P.badge + ')' : ''), '#/review']);
    if (P.exco) tabs.push(['all', 'All posts', '#/all']);
    if (P.exco) tabs.push(['categories', 'Categories', '#/categories']);
    if (P.exco) tabs.push(['approvers', 'Approvers', '#/approvers']);
    var cur = P.current && P.current.opts && P.current.opts.nav;
    $tabs.hidden = !P.me;
    $tabs.replaceChildren(tabs.map(function (t) { return h('a', { class: t[0] === cur ? 'on' : '', href: t[2] }, t[1]); }));
  }
  P.onRoute = function () { drawTabs(); };

  async function boot() {
    var s = await sb.auth.getSession();
    P.me = null; P.exco = false; P.approver = false; P.badge = 0;
    if (s.data.session) {
      try {
        P.me = P.must(await P.rec.rpc('whoami'));
        P.exco = !!P.must(await P.act.rpc('is_exco'));
        try { P.approver = !!P.must(await P.act.rpc('is_approver')); } catch (e) { /* write-up functions not installed yet */ }
      } catch (e) { P.toast(P.friendly(e), true); P.me = null; }
    }
    ready = true;
    drawChrome();
    if (P.me && (P.exco || P.approver)) {
      P.act.from('posts_flat').select('id,author_email').eq('status', 'Submitted').then(function (r) {
        P.badge = (r.data || []).filter(function (x) { return P.exco || x.author_email !== P.me.email; }).length; drawTabs();
      });
    }
    var ret = P.prefs.get('return');
    if (P.me && ret) { P.prefs.del('return'); P.nav(ret); return; }
    P.dispatch();
  }

  sb.auth.onAuthStateChange(function (ev) { if (ev === 'PASSWORD_RECOVERY') newPasswordView(); });
  window.addEventListener('hashchange', function () { if (ready) P.dispatch(); });
  boot();
})();
