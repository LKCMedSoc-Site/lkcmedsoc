// Suggestion box: students send, ExCo answers, resolved items show on a public "You said, we did" list.
(function () {
  'use strict';
  var P = window.P, h = P.h;
  var CATS = ['Suggestion', 'Complaint', 'Website problem', 'Welfare / other'];
  var STATUSES = ['New', 'Looking into it', 'Done', 'Declined'];
  var day = function (s) { return s ? new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''; };
  var statusKind = { Done: 'ok', Declined: 'bad', 'Looking into it': 'warn', New: 'dark' };

  // ---- Send a suggestion (any signed-in student) ----
  P.route('/suggest', { nav: 'suggest', fn: async function () {
    var cat = P.select(CATS, 'Suggestion', { id: 's-cat' });
    var msg = h('textarea', { id: 's-msg', rows: 6, maxlength: 3000, placeholder: 'What would you like us to know or change?' });
    var anon = h('input', { type: 'checkbox', id: 's-anon', checked: true });
    var contact = h('input', { id: 's-contact', class: 'grow', placeholder: 'Optional: email or Telegram, if you want a private reply' });
    var btn = h('button', { class: 'btn', id: 's-send', onclick: async function () {
      if (msg.value.trim().length < 5) { P.toast('Please write a little more', true); return; }
      btn.disabled = true;
      var ok = await P.run(async function () {
        P.must(await P.act.rpc('submit_suggestion', { p_category: cat.value, p_message: msg.value.trim(), p_anonymous: anon.checked, p_contact: contact.value }));
      }, 'Thank you. ExCo will read this.');
      btn.disabled = false;
      if (ok) { msg.value = ''; contact.value = ''; }
    } }, 'Send');
    P.show(h('div', null,
      h('h2', null, 'Suggestion box'),
      h('p', { class: 'muted' }, 'Tell ExCo what we should do better. Tick anonymous and your name is not saved with your message.'),
      h('div', { class: 'card' },
        P.field('Type', cat),
        P.field('Your message', msg),
        h('div', { class: 'row' }, h('label', null, anon, ' Send anonymously')),
        P.field('Contact (optional)', contact, 'Only fill this in if you want a private reply. ExCo will see it.'),
        h('div', { class: 'row' }, btn)),
      h('p', null, P.link('#/said', 'See what we have changed so far'))));
  } });

  // ---- Public list: "You said, we did" ----
  P.route('/said', { public: true, nav: 'said', fn: async function () {
    P.loading();
    var rows = P.must(await P.act.from('public_suggestions').select('*'));
    P.show(h('div', null,
      h('h2', null, 'You said, we did'),
      h('p', { class: 'muted' }, 'Suggestions from students and what ExCo did about them.'),
      rows.length ? rows.map(function (r) {
        return h('div', { class: 'card' },
          h('div', { class: 'row' }, P.pill(r.category), P.pill(r.status, statusKind[r.status]), h('span', { class: 'sub' }, day(r.replied_at))),
          h('p', null, r.message),
          r.reply ? h('p', null, h('strong', null, 'ExCo: '), r.reply) : null);
      }) : h('p', { class: 'muted' }, 'Nothing here yet.'),
      P.me ? h('p', null, P.link('#/suggest', 'Send a suggestion')) : null));
  } });

  // ---- ExCo inbox ----
  P.route('/inbox', { exco: true, nav: 'inbox', fn: async function () {
    P.loading();
    var rows = P.must(await P.act.from('suggestions').select('*').order('created_at', { ascending: false }));
    var filter = P.select([['', 'All']].concat(STATUSES.map(function (s) { return [s, s]; })), '', { id: 'i-filter' });
    var list = h('div');
    function draw() {
      var f = filter.value;
      var shown = rows.filter(function (r) { return !f || r.status === f; });
      list.replaceChildren(shown.length ? shown.map(card) : h('p', { class: 'muted' }, 'Nothing here.'));
    }
    function card(r) {
      var st = P.select(STATUSES, r.status);
      var rep = h('textarea', { rows: 3, placeholder: 'Reply (shown publicly only if ticked below)' }, r.reply || '');
      var pub = h('input', { type: 'checkbox', checked: r.show_public });
      var save = h('button', { class: 'btn', onclick: async function () {
        save.disabled = true;
        var ok = await P.run(async function () {
          P.must(await P.act.rpc('reply_suggestion', { p_id: r.id, p_status: st.value, p_reply: rep.value, p_public: pub.checked }));
        }, 'Saved');
        save.disabled = false;
        if (ok) { r.status = st.value; r.reply = rep.value; r.show_public = pub.checked; }
      } }, 'Save');
      return h('div', { class: 'card' },
        h('div', { class: 'row' }, P.pill(r.category), P.pill(r.status, statusKind[r.status]), h('span', { class: 'sub' }, day(r.created_at))),
        h('p', null, r.message),
        h('p', { class: 'sub' }, 'From: ' + (r.submitter_email || 'Anonymous') + (r.contact ? ' · Contact: ' + r.contact : '')),
        P.field('Status', st), P.field('Reply', rep),
        h('div', { class: 'row' }, h('label', null, pub, ' Show on the public "You said, we did" list')),
        h('div', { class: 'row' }, save));
    }
    filter.addEventListener('change', draw);
    draw();
    P.show(h('div', null, h('h2', null, 'Suggestion inbox'), P.field('Show', filter), list));
  } });
})();
