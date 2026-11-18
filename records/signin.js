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
(function () {
  'use strict';
  var FONT = 'https://brwdgbitxisadwbuwbdi.supabase.co/storage/v1/object/public/fonts/';
  var CSS = [
    "@font-face{font-family:'DIN';src:url('" + FONT + "DIN-Regular.woff2') format('woff2');font-weight:400;font-display:swap}",
    "@font-face{font-family:'DIN';src:url('" + FONT + "DIN-Bold.woff2') format('woff2');font-weight:700;font-display:swap}",
    ".lkcsi{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;overflow-y:auto;padding:16px;background:rgba(42,6,40,.7);font-family:'DIN','DIN Alternate','Barlow','Segoe UI',system-ui,sans-serif;font-size:16px;line-height:1.5;color:#4d0a49;-webkit-font-smoothing:antialiased}",
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
    ".lkcsi-btn:disabled{opacity:.5;pointer-events:none}"
  ].join('\n');
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
      else if (mode === 'code') {
        row.appendChild(link('Send a new code', function () { resend(); }));
        row.appendChild(link('Back', to(ctx.kind === 'signup' ? 'signup' : 'forgot')));
      } else row.appendChild(link('Back to sign in', to('signin')));
      var intro = mode === 'signup' ? 'Use your NTU email. We email you a 6-digit code to confirm it is yours. Same account on every LKCMedSoc site.'
        : mode === 'forgot' ? 'We email you a 6-digit code. Type it here, then choose a new password.'
        : mode === 'code' ? 'We sent a 6-digit code to ' + ctx.email + '. It can take a minute; check junk mail too.' : '';
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
      panel.replaceChildren(close_, el('p', { 'class': 'lkcsi-intro', text: 'One sign-in works on every LKCMedSoc site.' }), form);
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

  window.LKCSignIn = { open: open, close: function () { close(true); } };
})();
