// The sign-in lightbox, the same on every LKCMedSoc site. It matches the website's own (site/src/components/nav/SignInDialog.tsx
// and AuthBox.tsx): a centred white panel over a dark plum backdrop, NTU email + password, Create account and Forgot password.
// It brings its own styles (everything is under .lkcsi), so no app stylesheet can change how it looks.
// The master copy is shared/signin.js; run `node tools/sync-shared.mjs` to copy it into each app.
//
//   LKCSignIn.open({ sb, redirect, friendly, onSignedIn, onClose, note })
//     sb          the app's Supabase client (needs sb.auth)
//     redirect    where email links (confirm / reset) bring the person back to
//     friendly    optional: turns an error into plain words
//     onSignedIn  called after a successful sign-in (the lightbox has closed itself)
//     onClose     called when the person closes the lightbox without signing in
//     note        optional green message shown at the top
//   LKCSignIn.close()
//   LKCSignIn.hasPassword()   false for an account made with Continue with Google (it has no password to change)
//
// Continue with Google: for the shared Gmail accounts of student groups, committees, houses and years (students use their NTU email).
// It goes through Supabase's Google sign-in, so the session is the same shared one as an email sign-in. Google's page cannot open inside
// a frame, so the whole window goes to Google; Google sends it back to the app it came from (inside the website header's frame, that
// is the app around the frame). Who may sign in is decided by the sign-up list in the database (records.email_allowed).
(function () {
  'use strict';
  var FONT = 'https://brwdgbitxisadwbuwbdi.supabase.co/storage/v1/object/public/fonts/';
  var CSS = [
    "@font-face{font-family:'DIN';src:url('" + FONT + "DIN-Regular.woff2') format('woff2');font-weight:400;font-display:swap}",
    "@font-face{font-family:'DIN';src:url('" + FONT + "DIN-Bold.woff2') format('woff2');font-weight:700;font-display:swap}",
    ".lkcsi{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;overflow-y:auto;padding:16px;background:rgba(29,15,27,.7);font-family:'DIN','DIN Alternate','Barlow','Segoe UI',system-ui,sans-serif;font-size:16px;line-height:1.5;color:#4d0a49;-webkit-font-smoothing:antialiased}",
    ".lkcsi *{box-sizing:border-box}",
    ".lkcsi-panel{position:relative;width:100%;max-width:448px;border-radius:16px;background:#fff;padding:20px;color:#4d0a49;box-shadow:0 25px 50px -12px rgba(0,0,0,.25)}",
    ".lkcsi-x{position:absolute;right:12px;top:12px;display:grid;place-items:center;width:36px;height:36px;padding:0;border:0;border-radius:999px;background:#f5eff5;color:#4d0a49;cursor:pointer}",
    ".lkcsi-x:hover{background:#ebe1fa}",
    ".lkcsi-x svg{width:16px;height:16px}",
    ".lkcsi-intro{margin:0 0 12px;padding-right:40px;font-size:14px;color:#6a5a69}",
    ".lkcsi-form{display:grid;gap:12px;border:1px solid #ddd2dc;border-radius:12px;background:#f5eff5;padding:16px}",
    ".lkcsi-form h3{margin:0;font-size:18px;font-weight:700;line-height:1.3;color:#4d0a49}",
    ".lkcsi-form p{margin:0;font-size:14px;color:#6a5a69}",
    ".lkcsi-form p.lkcsi-msg{border-radius:8px;padding:8px 12px;color:#b3261e;background:#fee2e2}",
    ".lkcsi-form p.lkcsi-msg.ok{color:#1d7a4d;background:#dcfce7}",
    ".lkcsi-form input{width:100%;margin:0;border:1px solid #d3a6cf;border-radius:8px;background:#fff;padding:10px 12px;font:inherit;color:#2a0f28}",
    ".lkcsi-form input:focus-visible,.lkcsi button:focus-visible{outline:2px solid #8e2a88;outline-offset:2px}",
    ".lkcsi-pw{position:relative}",
    ".lkcsi-form .lkcsi-pw input{padding-right:64px}",
    ".lkcsi-eye{position:absolute;right:6px;top:50%;transform:translateY(-50%);border:0;border-radius:6px;background:transparent;padding:4px 8px;font:inherit;font-size:13px;font-weight:700;color:#4d0a49;cursor:pointer}",
    ".lkcsi-eye:hover{background:#ebe1fa}",
    ".lkcsi-row{display:flex;flex-wrap:wrap;gap:8px}",
    ".lkcsi-btn{display:inline-flex;align-items:center;justify-content:center;border:1px solid #4d0a49;border-radius:8px;background:#4d0a49;padding:10px 16px;font:inherit;font-weight:700;color:#fff;cursor:pointer}",
    ".lkcsi-btn.out{background:#fff;color:#4d0a49}",
    ".lkcsi-btn.out:hover{background:#ebe1fa}",
    ".lkcsi-btn:disabled{opacity:.5;pointer-events:none}",
    ".lkcsi-alt{margin-top:12px;display:grid;gap:6px;justify-items:center;text-align:center}",
    ".lkcsi-or{display:flex;align-items:center;gap:10px;width:100%;font-size:13px;color:#6a5a69}",
    ".lkcsi-or::before,.lkcsi-or::after{content:'';flex:1;height:1px;background:#ddd2dc}",
    ".lkcsi-g{display:inline-flex;align-items:center;justify-content:center;gap:10px;width:100%;border:1px solid #d3a6cf;border-radius:8px;background:#fff;padding:10px 16px;font:inherit;font-weight:700;color:#2a0f28;cursor:pointer}",
    ".lkcsi-g:hover{background:#f5eff5}",
    ".lkcsi-g svg{width:18px;height:18px;flex:none}",
    ".lkcsi-alt small{font-size:12px;color:#6a5a69}"
  ].join('\n');
  var G = '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';

  // Where Google sends the person back to: the page they are on, or, inside the website header's frame, the app around the frame
  // (document.referrer: only its address is known, so the app's front page). Only LKCMedSoc addresses (and localhost) are used.
  function returnUrl(o) {
    if (window.self !== window.top) {
      try {
        var r = new URL(document.referrer);
        if (/(^|\.)lkcmedsoc\.com$/.test(r.hostname) || r.hostname === 'localhost') return r.origin + '/';
      } catch (e) { /* no referrer */ }
    }
    return o.redirect && !/\/sign-in$/.test(o.redirect) ? o.redirect : location.href.split('#')[0];
  }
  function google(o, btn) {
    btn.disabled = true;
    o.sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: returnUrl(o), skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } } })
      .then(function (r) {
        if (r.error || !r.data || !r.data.url) throw r.error || new Error('Google sign-in is not available right now.');
        try { window.top.location.href = r.data.url; } catch (e) { location.href = r.data.url; }
      })
      .catch(function (e) { btn.disabled = false; alert((e && e.message) || 'Google sign-in is not available right now.'); });
  }

  // Coming back from Google with a refusal (e.g. a Gmail that is not on the sign-up list): say so in plain words and tidy the address,
  // before the app reads it. Supabase puts the reason after # (or ? for some errors).
  (function () {
    if (window.self !== window.top) return;
    var raw = (location.hash || '').slice(1) + '&' + (location.search || '').slice(1);
    if (raw.indexOf('error_description=') < 0) return;
    var q = new URLSearchParams(raw), d = q.get('error_description') || '';
    try { history.replaceState(null, '', location.pathname); } catch (e) { /* old browser */ }
    var msg = /Database error saving new user|sign-in list/i.test(d)
      ? "That Google account can't sign in here. Google sign-in is for bodies with registered Google accounts. Students: sign in with your NTU email."
      : 'Google sign-in did not finish: ' + d;
    setTimeout(function () { alert(msg); }, 0);
  })();
  var X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';

  var root = null, prevOverflow = '', onKey = null;

  function el(tag, attrs) {
    var n = document.createElement(tag);
    for (var k in attrs || {}) { if (k === 'text') n.textContent = attrs[k]; else n.setAttribute(k, attrs[k]); }
    for (var i = 2; i < arguments.length; i++) if (arguments[i]) n.appendChild(arguments[i]);
    return n;
  }
  // a password box with a Show / Hide button
  function secret(input) {
    var b = el('button', { type: 'button', 'class': 'lkcsi-eye', 'aria-pressed': 'false', text: 'Show' });
    b.addEventListener('click', function () {
      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      b.textContent = show ? 'Hide' : 'Show'; b.setAttribute('aria-pressed', String(show));
      b.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    });
    b.setAttribute('aria-label', 'Show password');
    return el('div', { 'class': 'lkcsi-pw' }, input, b);
  }
  function ensureStyle() {
    if (document.getElementById('lkcsi-style')) return;
    var s = el('style', { id: 'lkcsi-style' }); s.textContent = CSS; document.head.appendChild(s);
  }

  function close(silent, o) {
    if (!root) return;
    root.remove(); root = null;
    document.body.style.overflow = prevOverflow;
    window.removeEventListener('keydown', onKey);
    if (!silent && o && o.onClose) o.onClose();
  }

  function open(o) {
    o = o || {};
    ensureStyle();
    close(true);
    prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    var panel = el('div', { 'class': 'lkcsi-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Sign in' });
    root = el('div', { 'class': 'lkcsi' }, panel);
    root.addEventListener('mousedown', function (e) { if (e.target === root) close(false, o); });
    onKey = function (e) { if (e.key === 'Escape') close(false, o); };
    window.addEventListener('keydown', onKey);
    document.body.appendChild(root);
    draw('signin', o.note ? { text: o.note, ok: true } : null);

    // Steps (mode): signin, signup, forgot, then code (type the 6-digit code from the email) and newpw (after a reset code).
    // keep: what was typed, put back after an error. ctx: { email, kind: 'signup' | 'recovery' } for the code step.
    function draw(mode, msg, keep, ctx) {
      keep = keep || {};
      var email = el('input', { type: 'email', placeholder: 'yourname@e.ntu.edu.sg', autocomplete: 'username', 'aria-label': 'Email' });
      var pw = el('input', { type: 'password', placeholder: mode === 'newpw' ? 'New password' : 'Password', autocomplete: mode === 'signup' || mode === 'newpw' ? 'new-password' : 'current-password', 'aria-label': 'Password' });
      var pw2 = el('input', { type: 'password', placeholder: 'Repeat password', autocomplete: 'new-password', 'aria-label': 'Repeat password' });
      var code = el('input', { type: 'text', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '10', placeholder: '6-digit code', 'aria-label': 'Code from your email' });
      code.addEventListener('input', function () { code.value = code.value.replace(/\D/g, ''); });
      var labels = { signin: 'Sign in', signup: 'Create account', forgot: 'Email me a code', code: 'Confirm', newpw: 'Save password' };
      var titles = { signin: 'Sign in with your NTU email', signup: 'Create account', forgot: 'Reset password', code: 'Enter the code we emailed you', newpw: 'Set a new password' };
      var go = el('button', { type: 'submit', 'class': 'lkcsi-btn', text: labels[mode] });
      var note = msg ? el('p', { 'class': 'lkcsi-msg' + (msg.ok ? ' ok' : ''), role: 'status', text: msg.text }) : null;
      function link(label, fn) { var b = el('button', { type: 'button', 'class': 'lkcsi-btn out', text: label }); b.addEventListener('click', fn); return b; }
      function to(m) { return function () { draw(m); }; }
      var row = el('div', { 'class': 'lkcsi-row' }, go);
      if (mode === 'signin') { row.appendChild(link('Create account', to('signup'))); row.appendChild(link('Forgot password', to('forgot'))); }
      else if (mode === 'forgot') {
        row.appendChild(link('I already have a code', function () {
          var e = email.value.trim().toLowerCase();
          if (!e) { fail('Enter your email first'); return; }
          draw('code', null, null, { email: e.indexOf('@') < 0 ? e + '@e.ntu.edu.sg' : e, kind: 'recovery' });
        }));
        row.appendChild(link('Back to sign in', to('signin')));
      } else if (mode === 'code') {
        row.appendChild(link('Send a new code', function () { resend(); }));
        row.appendChild(link('Back', to(ctx.kind === 'signup' ? 'signup' : 'forgot')));
      } else row.appendChild(link('Back to sign in', to('signin')));
      var intro = mode === 'signup' ? 'Use your NTU email. We email you a 6-digit code to confirm it is yours. Same account on every LKCMedSoc site.'
        : mode === 'forgot' ? 'We email you a 6-digit code. Type it here, then choose a new password.'
        : mode === 'code' ? (ctx.kind === 'recovery'
            ? 'If ' + ctx.email + ' has an account, a 6-digit code is on its way. It can take a minute; check junk mail too.'
            : 'We sent a 6-digit code to ' + ctx.email + '. It can take a minute; check junk mail too. Nothing arrived? You may already have an account: go Back and use Forgot password.') : '';
      var form = el('form', { 'class': 'lkcsi-form', novalidate: '' },
        el('h3', { text: titles[mode] }),
        intro ? el('p', { text: intro }) : null,
        note,
        mode === 'signin' || mode === 'signup' || mode === 'forgot' ? email : null,
        mode === 'code' ? code : null,
        mode === 'signin' || mode === 'signup' || mode === 'newpw' ? secret(pw) : null,
        mode === 'signup' || mode === 'newpw' ? secret(pw2) : null,
        row);
      var close_ = el('button', { type: 'button', 'class': 'lkcsi-x', 'aria-label': 'Close' }); close_.innerHTML = X;
      close_.addEventListener('click', function () { close(false, o); });
      var alt = null;
      if (mode === 'signin') {
        var gb = el('button', { type: 'button', 'class': 'lkcsi-g' }); gb.innerHTML = G + '<span>Continue with Google</span>';
        gb.addEventListener('click', function () { google(o, gb); });
        alt = el('div', { 'class': 'lkcsi-alt' }, el('div', { 'class': 'lkcsi-or', text: 'or' }), gb,
          el('small', { text: 'For bodies with registered Google accounts.' }));
      }
      panel.replaceChildren.apply(panel, [close_, el('p', { 'class': 'lkcsi-intro', text: 'One sign-in works on every LKCMedSoc site.' }), form, alt].filter(Boolean));
      email.value = keep.email || ''; pw.value = keep.pw || ''; pw2.value = keep.pw2 || '';
      (mode === 'code' ? code : mode === 'newpw' ? pw : keep.email && mode !== 'forgot' ? pw : email).focus();

      var auth = o.sb.auth, back = o.redirect || location.origin + location.pathname;
      function typed() { return { email: email.value, pw: pw.value, pw2: pw2.value }; }
      function fail(m) { draw(mode, { text: m, ok: false }, typed(), ctx); }
      function say(e) { return o.friendly ? o.friendly(e) : (e && e.message) || 'Something went wrong'; }
      function done() { close(true); if (o.onSignedIn) o.onSignedIn(); }
      function resend() {
        var p = ctx.kind === 'signup' ? auth.resend({ type: 'signup', email: ctx.email, options: { emailRedirectTo: back } }) : auth.resetPasswordForEmail(ctx.email, { redirectTo: back });
        p.then(function (r) { draw('code', r.error ? { text: say(r.error), ok: false } : { text: 'A new code is on its way. Only the newest one works.', ok: true }, null, ctx); });
      }
      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        go.disabled = true;
        var again = function (m) { go.disabled = false; fail(m); };
        if (mode === 'code') {
          if (code.value.length < 6) return again('Type the code from the email');
          auth.verifyOtp({ email: ctx.email, token: code.value, type: ctx.kind }).then(function (r) {
            if (r.error) return again(/expired|invalid/i.test(r.error.message || '') ? 'That code is wrong or has expired. Check it, or send a new one.' : say(r.error));
            if (ctx.kind === 'signup') done(); else draw('newpw');
          });
          return;
        }
        if (mode === 'newpw') {
          if (pw.value.length < 8) return again('Use at least 8 characters');
          if (pw.value !== pw2.value) return again('The two passwords differ');
          auth.updateUser({ password: pw.value }).then(function (r) { if (r.error) return again(say(r.error)); done(); });
          return;
        }
        var e = email.value.trim().toLowerCase();
        if (!e) return again('Enter your email');
        if (e.indexOf('@') < 0) e += '@e.ntu.edu.sg';   // just the name was typed: students' NTU address (anyone else types the whole address)
        if (mode === 'signin') {
          auth.signInWithPassword({ email: e, password: pw.value }).then(function (r) { if (r.error) return again(say(r.error)); done(); });
        } else if (mode === 'signup') {
          if (pw.value.length < 8) return again('Use at least 8 characters');
          if (pw.value !== pw2.value) return again('The two passwords differ');
          auth.signUp({ email: e, password: pw.value, options: { emailRedirectTo: back } }).then(function (r) {
            if (r.error) return again(say(r.error));
            if (r.data && r.data.session) return done();
            draw('code', null, null, { email: e, kind: 'signup' });
          });
        } else {
          auth.resetPasswordForEmail(e, { redirectTo: back }).then(function (r) {
            if (r.error) return again(say(r.error));
            draw('code', null, null, { email: e, kind: 'recovery' });
          });
        }
      });
    }
  }

  // Does the signed-in account have a password? Accounts made with Continue with Google have none, so apps hide
  // "Change password" for them. Reads the shared session (sso.js); when unsure it says yes, so the option never goes missing wrongly.
  function hasPassword() {
    try {
      var st = window.LKCSession ? window.LKCSession.storage : window.localStorage;
      var raw = st.getItem('sb-brwdgbitxisadwbuwbdi-auth-token');
      if (!raw) return true;
      var u = JSON.parse(raw).user || {}, m = u.app_metadata || {};
      var p = m.providers || (m.provider ? [m.provider] : null);
      return !p || p.indexOf('email') >= 0;
    } catch (e) { return true; }
  }

  window.LKCSignIn = { open: open, close: function () { close(true); }, hasPassword: hasPassword };
})();
