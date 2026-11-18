// LKCMedSoc Activities: sign-in, the page chrome and start-up.
(function () {
  'use strict';
  var P = window.P, h = P.h, sb = P.sb;
  var $tabs = document.getElementById('tabs'), $who = document.getElementById('who');
  var REDIRECT = location.origin + location.pathname;
  // Feedback has its own site now (LKCMedSoc Feedback). Old links and bookmarks to it land there.
  if (/^#\/(suggest|said|feedback|thread|shared|issue|assigned|inbox|meetings?)(\/|$)/.test(location.hash) && P.cfg.FEEDBACK_URL) { location.replace(P.cfg.FEEDBACK_URL + '/' + location.hash); return; }
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
      $who.replaceChildren(h('span', null, me.name || me.email), h('button', { class: 'who-btn', onclick: newPasswordView }, 'Password'),
        h('button', { class: 'who-btn', id: 'signout', onclick: async function () { await sb.auth.signOut(); P.prefs.del('return'); location.hash = '#/events'; boot(); } }, 'Sign out'));
    } else {
      $who.replaceChildren(h('button', { class: 'who-btn', id: 'signin', onclick: P.askSignIn }, 'Sign in'));
    }
    drawTabs();
  }
  function drawTabs() {
    var tabs = [];
    if (P.me && (P.me.can_manage || P.me.is_admin || P.exco || P.filer)) tabs.push(['activities', 'Activities', '#/']);
    tabs.push(['events', 'Events', '#/events']);
    tabs.push(['housecup', 'House Cup', '#/house-cup']);
    if (P.me && (P.me.can_manage || P.exco || P.approver)) tabs.push(['todo', 'To do' + (P.badge ? ' (' + P.badge + ')' : ''), '#/todo']);
    if (P.me) tabs.push(['mine', 'My events', '#/mine']);
    if (P.me) tabs.push(['posts', 'Write-ups', '#/posts']);
    if (P.approver || P.exco) tabs.push(['review', 'Review', '#/review']);
    if (P.exco) tabs.push(['approvers', 'Approvers', '#/approvers']);
    if (P.exco) tabs.push(['finance', 'Finance', '#/finance']);
    var cur = P.current && P.current.opts && P.current.opts.nav;
    $tabs.hidden = !P.me;
    $tabs.replaceChildren(tabs.map(function (t) { return h('a', { class: t[0] === cur ? 'on' : '', href: t[2] }, t[1]); }));
  }
  P.onRoute = function () { drawTabs(); };

  async function boot() {
    var s = await sb.auth.getSession();
    P.me = null; P.exco = false; P.approver = false; P.filer = false;
    if (s.data.session) {
      try {
        P.me = P.must(await P.rec.rpc('whoami'));
        P.exco = !!P.must(await P.act.rpc('is_exco'));
        try { P.approver = !!P.must(await P.act.rpc('is_approver')); } catch (e) { /* write-up functions not installed yet */ }
        try { P.filer = !!P.must(await P.act.rpc('can_file_events')); } catch (e) { /* event team access not installed yet */ }
      } catch (e) { P.toast(P.friendly(e), true); P.me = null; }
    }
    ready = true;
    drawChrome();
    if (P.me && P.loadWaiting && (P.me.can_manage || P.exco || P.approver)) {
      P.loadWaiting().then(function (w) { P.badge = w.acts.length + w.posts; drawTabs(); }).catch(function () { /* the tab still works without a count */ });
    }
    var ret = P.prefs.get('return');
    if (P.me && ret) { P.prefs.del('return'); P.nav(ret); return; }
    P.dispatch();
  }

  sb.auth.onAuthStateChange(function (ev) { if (ev === 'PASSWORD_RECOVERY') newPasswordView(); });
  window.addEventListener('hashchange', function () { if (ready) P.dispatch(); });
  boot();
})();
