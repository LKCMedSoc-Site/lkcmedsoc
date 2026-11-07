// Feedback and issues. Students send feedback (the form suggests answers that already exist), ExCo triages it into
// issues in the inbox, and every issue is one conversation: the people who raised it on one side, the responders on
// the other, newest at the bottom. Resolved issues can be shown on a public "Issues and answers" page.
// (File name kept from the old suggestion box.)
(function () {
  'use strict';
  var P = window.P, h = P.h;
  var STATUSES = ['Open', 'Pending', 'Resolved'];
  var ROUTES = [['', 'Not decided'], ['Direct', 'Resolve directly'], ['SSLG', 'Table at SSLG']];
  var PRIVACY = [
    ['exco_only', 'Share my identity with ExCo only', 'ExCo can see who you are. Nobody else can, including the staff who handle the issue. You can follow the replies under My feedback.'],
    ['anonymous', 'Remain completely anonymous', 'Nobody can see who you are, and you will not be able to follow the replies or add follow-ups.']
  ];
  var PRIVACY_LABEL = { exco_only: 'ExCo can see who you are', anonymous: 'Anonymous' };
  var STATUS_KIND = { Resolved: 'ok', Pending: 'warn', Open: 'dark' };
  var day = function (s) { return s ? new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''; };
  var clock = function (s) { return new Date(s).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); };
  var statusPill = function (s) { return P.pill(s, STATUS_KIND[s]); };
  var raised = function (n) { return n + (Number(n) === 1 ? ' person has' : ' people have') + ' raised this'; };
  var asList = function (a) { return a && a.length ? a : []; };
  // People ExCo can assign an issue to: current leaders, shown with their positions.
  async function loadPeople() { try { var r = await P.act.rpc('assignable_people'); return r.error ? [] : asList(r.data); } catch (e) { return []; } }
  var personLabel = function (p) { return p.name + (p.positions ? ' — ' + p.positions : ''); };
  function peopleSelect(people, value, attrs) {
    var opts = [['', 'No one yet']].concat(people.map(function (p) { return [p.email, personLabel(p)]; }));
    if (value && !people.some(function (p) { return p.email === value; })) opts.push([value, value]);
    return P.select(opts, value || '', attrs);
  }

  // ---------------------------------------------------------------- the conversation
  // items come from issue_thread() or shared_thread(): { id, happened_at, kind, body, who, mine }
  function threadView(items) {
    var box = h('div', { class: 'thread', id: 'thread' });
    var lastDay = '';
    if (!items.length) box.appendChild(h('p', { class: 'muted' }, 'No messages yet.'));
    items.forEach(function (m) {
      var d = day(m.happened_at);
      if (d !== lastDay) { box.appendChild(h('div', { class: 'daymark' }, d)); lastDay = d; }
      if (m.kind === 'status' || m.kind === 'assigned') { box.appendChild(h('div', { class: 'sys' }, m.body + ' · ' + clock(m.happened_at))); return; }
      var side = m.kind === 'feedback' ? 'giver' : 'responder';
      var label = m.kind === 'email' ? m.who + ' · email' : m.who;
      box.appendChild(h('div', { class: 'msg ' + side },
        h('div', { class: 'who' }, label + ' · ' + clock(m.happened_at)),
        h('div', { class: 'body' }, m.body)));
    });
    return box;
  }
  function toBottom() { var t = document.getElementById('thread'); if (t) t.scrollTop = t.scrollHeight; }

  async function conversation(issueId, mode) {
    // mode: 'staff' (ExCo or the person responsible) or 'student'
    var holder = h('div');
    var text = h('textarea', { rows: 3, placeholder: mode === 'staff' ? 'Write a reply, or log what happened (e.g. “Emailed the Registrar, reply expected next week”)' : 'Add a follow-up' });
    var kind = P.select([['note', 'Message'], ['email', 'Email sent or received']], 'note');
    var send = h('button', { class: 'btn', onclick: async function () {
      if (!text.value.trim()) { P.toast('Write something first', true); return; }
      send.disabled = true;
      var ok = await P.run(async function () {
        if (mode === 'staff') P.must(await P.act.rpc('add_issue_note', { p_issue: issueId, p_kind: kind.value, p_body: text.value }));
        else P.must(await P.act.rpc('reply_to_issue', { p_issue: issueId, p_message: text.value }));
      });
      send.disabled = false;
      if (ok) { text.value = ''; await draw(); }
    } }, mode === 'staff' ? 'Send' : 'Send follow-up');
    async function draw() {
      var items = P.must(await P.act.rpc('issue_thread', { p_issue: issueId }));
      holder.replaceChildren(threadView(asList(items)));
      toBottom();
      return items;
    }
    var composer = h('div', { class: 'composer' }, text,
      h('div', { class: 'row' },
        mode === 'staff' ? kind : null,
        send),
      mode === 'staff' ? h('p', { class: 'sub' }, 'Everything written here can be read by the students who raised this issue, and by every student if the issue is shown to the student body.') : null);
    var el = h('div', null, holder, composer);
    await draw();
    return { el: el, scroll: toBottom };
  }

  // ---------------------------------------------------------------- send feedback
  P.route('/suggest', { nav: 'suggest', fn: async function () {
    var msg = h('textarea', { id: 'f-msg', rows: 6, maxlength: 3000, placeholder: 'What would you like us to know or change? Be as specific as you can.' });
    var contact = h('input', { id: 'f-contact', class: 'grow', placeholder: 'Optional: another way to reach you' });
    var matches = h('div');
    var joining = h('div');
    var chosen = null, timer;

    var privacyRows = PRIVACY.map(function (p, i) {
      return h('label', { class: 'choice' }, h('input', { type: 'radio', name: 'f-priv', value: p[0], checked: i === 0 }),
        h('span', null, h('strong', null, p[1]), h('span', { class: 'sub' }, p[2])));
    });
    function privacy() { var r = document.querySelector('input[name="f-priv"]:checked'); return r ? r.value : 'exco_only'; }
    msg.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(look, 450); });

    function pick(r) {
      chosen = r ? r.id : null;
      joining.replaceChildren(r ? h('div', { class: 'card ok' }, h('div', null, 'You are adding yourself to: ', h('strong', null, r.title)),
        h('div', { class: 'row' }, h('button', { class: 'ghost', onclick: function () { pick(null); look(); } }, 'Not this one'))) : null);
      if (r) matches.replaceChildren();
    }
    async function look() {
      var t = msg.value.trim();
      if (chosen || t.length < 12) { if (!chosen) matches.replaceChildren(); return; }
      try {
        var res = await P.act.rpc('similar_issues', { p_text: t });
        if (res.error) throw res.error;
        var rows = asList(res.data);
        matches.replaceChildren(rows.length ? h('div', { class: 'card' },
          h('strong', null, 'Is it one of these?'),
          h('p', { class: 'muted' }, 'These are already being looked at. If one is yours, add yourself to it and you will see updates.'),
          rows.map(function (r) {
            return h('div', { class: 'match' },
              h('div', { class: 'row' }, h('strong', null, r.title), statusPill(r.status), h('span', { class: 'sub' }, raised(r.times_raised))),
              h('div', { class: 'row' }, P.link('#/shared/' + r.id, 'Read the conversation'), h('button', { class: 'ghost', onclick: function () { pick(r); } }, 'This is my question too')));
          })) : null);
      } catch (e) { matches.replaceChildren(); }
    }

    var btn = h('button', { class: 'btn', id: 'f-send', onclick: async function () {
      if (msg.value.trim().length < 5) { P.toast('Please write a little more', true); return; }
      btn.disabled = true;
      var ok = await P.run(async function () {
        P.must(await P.act.rpc('submit_feedback', { p_message: msg.value.trim(), p_privacy: privacy(), p_contact: contact.value, p_issue: chosen }));
      }, 'Thank you. We have your feedback.');
      btn.disabled = false;
      if (ok) { msg.value = ''; contact.value = ''; pick(null); matches.replaceChildren(); P.nav('#/feedback/mine'); }
    } }, 'Send feedback');

    P.show(h('div', null,
      h('h2', null, 'Send feedback'),
      h('p', { class: 'muted' }, 'Tell us what we should know or change. ExCo reads everything and decides what happens next. You can follow it here.'),
      h('div', { class: 'card' },
        P.field('Your message', msg),
        matches, joining,
        h('fieldset', { class: 'choices' }, h('legend', null, 'Who can see that it was you?'), privacyRows),
        P.field('Contact (optional)', contact, 'Only if you want a private reply somewhere else. ExCo will see it.'),
        h('div', { class: 'row' }, btn)),
      h('p', null, P.link('#/said', 'Issues students have raised'), ' · ', P.link('#/feedback/mine', 'My feedback'))));
  } });

  // ---------------------------------------------------------------- my feedback (one card per conversation)
  P.route('/feedback/mine', { nav: 'myfeedback', fn: async function () {
    P.loading();
    var rows = asList(P.must(await P.act.rpc('my_feedback')));
    var byIssue = {}, cards = [];
    rows.forEach(function (r) {
      if (!r.issue_id) { cards.push({ pending: true, last: r.created_at, first: r }); return; }
      if (!byIssue[r.issue_id]) { byIssue[r.issue_id] = { issue: r, count: 0, last: r.last_update, first: r }; cards.push(byIssue[r.issue_id]); }
      byIssue[r.issue_id].count++;
    });
    cards.sort(function (a, b) { return new Date(b.last) - new Date(a.last); });
    P.show(h('div', null,
      h('h2', null, 'My feedback'),
      h('p', { class: 'muted' }, 'Open one to read the replies and add a follow-up. Fully anonymous feedback cannot be listed here.'),
      cards.length ? cards.map(function (c) {
        if (c.pending) return h('div', { class: 'card' }, h('div', { class: 'row' }, P.pill('Waiting for ExCo', 'dark'), P.pill(PRIVACY_LABEL[c.first.privacy]), h('span', { class: 'sub' }, day(c.first.created_at))), h('p', null, c.first.message));
        return h('a', { class: 'card linkcard', href: '#/thread/' + c.issue.issue_id },
          h('div', { class: 'row' }, h('strong', null, c.issue.issue_title), statusPill(c.issue.issue_status), h('span', { class: 'sub' }, 'Updated ' + day(c.last))),
          h('p', { class: 'sub' }, c.count + (c.count === 1 ? ' message from you' : ' messages from you') + ' · ' + PRIVACY_LABEL[c.issue.privacy]),
          h('p', null, c.first.message));
      }) : h('p', { class: 'muted' }, 'You have not sent any feedback yet. ', P.link('#/suggest', 'Send some')),
      h('p', null, P.link('#/suggest', 'Send feedback'))));
  } });

  // A student's view of one conversation
  P.route('/thread/:id', { nav: 'myfeedback', fn: async function (params) {
    P.loading();
    var iss = P.must(await P.act.rpc('my_feedback')).filter(function (r) { return r.issue_id === params.id; })[0];
    var convo = await conversation(params.id, 'student');
    P.show(h('div', null,
      h('p', null, P.link('#/feedback/mine', '← My feedback')),
      h('div', { class: 'row' }, h('h2', { style: 'margin:0' }, iss ? iss.issue_title : 'Conversation'), iss ? statusPill(iss.issue_status) : null),
      h('p', { class: 'muted' }, 'You and MedSoc. A follow-up on a resolved issue reopens it.'),
      convo.el));
    convo.scroll();
  } });

  // ---------------------------------------------------------------- issues shared with the student body (signed-in students)
  P.route('/said', { nav: 'said', fn: async function () {
    P.loading();
    var rows = P.must(await P.act.from('shared_issues').select('*').order('updated_at', { ascending: false }));
    var q = h('input', { class: 'grow', placeholder: 'Search issues' });
    var st = P.select([['', 'Any status']].concat(STATUSES.map(function (s) { return [s, s]; })), '');
    var list = h('div');
    function draw() {
      var t = q.value.trim().toLowerCase();
      var shown = rows.filter(function (r) { return (!st.value || r.status === st.value) && (!t || r.title.toLowerCase().indexOf(t) >= 0); });
      list.replaceChildren(shown.length ? shown.map(function (r) {
        return h('a', { class: 'card linkcard', href: '#/shared/' + r.id },
          h('div', { class: 'row' }, h('strong', null, r.title), statusPill(r.status), h('span', { class: 'sub' }, raised(r.times_raised) + ' · updated ' + day(r.updated_at))));
      }) : h('p', { class: 'muted' }, rows.length ? 'Nothing matches.' : 'Nothing has been shared yet.'));
    }
    [q, st].forEach(function (el) { el.addEventListener('input', draw); });
    draw();
    P.show(h('div', null,
      h('h2', null, 'Issues students have raised'),
      h('p', { class: 'muted' }, 'Questions that come up again and again, and what MedSoc has said or done. ExCo chooses which issues are shown here. Students are never named.'),
      h('div', { class: 'row' }, q, st), list,
      h('p', null, P.link('#/suggest', 'Send feedback'))));
  } });

  // One shared conversation, read-only, with a way to add your own voice
  P.route('/shared/:id', { nav: 'said', fn: async function (params) {
    P.loading();
    var iss = P.must(await P.act.from('shared_issues').select('*').eq('id', params.id).maybeSingle());
    if (!iss) { P.show(h('p', { class: 'muted' }, 'That issue is not shared with students.')); return; }
    var items = asList(P.must(await P.act.rpc('shared_thread', { p_issue: iss.id })));
    var msg = h('textarea', { rows: 3, maxlength: 3000, placeholder: 'Is this your problem too? Add what you would like to say.' });
    var priv = PRIVACY.map(function (p, i) { return h('label', { class: 'choice' }, h('input', { type: 'radio', name: 's-priv', value: p[0], checked: i === 0 }), h('span', null, h('strong', null, p[1]))); });
    var add = h('button', { class: 'btn', onclick: async function () {
      if (msg.value.trim().length < 5) { P.toast('Please write a little more', true); return; }
      var r = document.querySelector('input[name="s-priv"]:checked');
      add.disabled = true;
      var ok = await P.run(async function () { P.must(await P.act.rpc('submit_feedback', { p_message: msg.value.trim(), p_privacy: r ? r.value : 'exco_only', p_contact: '', p_issue: iss.id })); }, 'Added to this issue');
      add.disabled = false;
      if (ok) P.dispatch();
    } }, 'Add my voice');
    P.show(h('div', null,
      h('p', null, P.link('#/said', '← All issues')),
      h('div', { class: 'row' }, h('h2', { style: 'margin:0' }, iss.title), statusPill(iss.status)),
      h('p', { class: 'sub' }, raised(iss.times_raised)),
      threadView(items),
      h('div', { class: 'card' }, msg, h('fieldset', { class: 'choices' }, h('legend', null, 'Who can see that it was you?'), priv), h('div', { class: 'row' }, add))));
    toBottom();
  } });

  // ---------------------------------------------------------------- issues I am responsible for
  P.route('/assigned', { nav: 'assigned', fn: async function () {
    P.loading();
    var rows = asList(P.must(await P.act.rpc('my_issues')));
    P.show(h('div', null,
      h('h2', null, 'Assigned to me'),
      h('p', { class: 'muted' }, 'Issues you are responsible for. Reply, log what happens and update the status.'),
      rows.length ? P.table(['Issue', 'Status', 'Route', 'Raised', 'Updated'], rows.map(function (r) {
        return [P.link('#/issue/' + r.id, r.title), statusPill(r.status), r.route || '', r.times_raised, day(r.updated_at)];
      }), [3]) : h('p', { class: 'muted' }, 'Nothing is assigned to you.')));
  } });

  // ---------------------------------------------------------------- ExCo inbox
  var inboxTab = 'triage';
  P.route('/inbox', { exco: true, nav: 'inbox', fn: async function () {
    P.loading();
    var data = {
      pending: P.must(await P.act.from('feedback').select('*').is('issue_id', null).order('created_at', { ascending: true })),
      issues: P.must(await P.act.from('issues').select('*').is('merged_into', null).order('updated_at', { ascending: false })),
      links: await P.fetchAll(function () { return P.act.from('feedback').select('issue_id').not('issue_id', 'is', null); }),
      people: await loadPeople()
    };
    var counts = {};
    data.links.forEach(function (l) { counts[l.issue_id] = (counts[l.issue_id] || 0) + 1; });
    var holder = h('div');
    var tabs = h('div', { class: 'subtabs' });
    function drawTabs() {
      tabs.replaceChildren([['triage', 'To triage (' + data.pending.length + ')'], ['issues', 'All issues (' + data.issues.length + ')']].map(function (t) {
        return h('button', { class: t[0] === inboxTab ? 'on' : '', onclick: function () { inboxTab = t[0]; drawTabs(); drawBody(); } }, t[1]);
      }));
    }
    function drawBody() { holder.replaceChildren(inboxTab === 'triage' ? triage(data) : issuesList(data, counts)); }
    drawTabs(); drawBody();
    P.show(h('div', null, h('h2', null, 'Feedback inbox'), tabs, holder));
  } });

  function triage(data) {
    if (!data.pending.length) return h('p', { class: 'muted' }, 'Nothing waiting. Every piece of feedback has been sorted into an issue.');
    return data.pending.map(function (f) {
      var title = h('input', { class: 'grow', value: f.message.replace(/\s+/g, ' ').slice(0, 70), maxlength: 200 });
      var route = P.select(ROUTES, '');
      var resp = peopleSelect(data.people, '');
      var find = h('input', { class: 'grow', placeholder: 'Find an existing issue…' });
      var found = P.select([['', 'Pick an existing issue']], '');
      var timer;
      find.addEventListener('input', function () {
        clearTimeout(timer);
        timer = setTimeout(function () {
          var t = find.value.trim().toLowerCase();
          var hits = data.issues.filter(function (i) { return t && i.title.toLowerCase().indexOf(t) >= 0; }).slice(0, 20);
          found.replaceChildren.apply(found, [h('option', { value: '' }, hits.length ? 'Pick an existing issue' : 'No match')].concat(hits.map(function (i) { return h('option', { value: i.id }, i.title + ' (' + i.status + ')'); })));
        }, 250);
      });
      var link = h('button', { class: 'ghost', onclick: async function () {
        if (!found.value) { P.toast('Find and pick an issue first', true); return; }
        var ok = await P.run(async function () { P.must(await P.act.rpc('triage_feedback', { p_feedback: f.id, p_issue: found.value, p_new_title: null, p_route: null, p_responsible: null })); }, 'Added to the issue');
        if (ok) P.dispatch();
      } }, 'Add to this issue');
      var create = h('button', { class: 'btn', onclick: async function () {
        var ok = await P.run(async function () {
          P.must(await P.act.rpc('triage_feedback', { p_feedback: f.id, p_issue: null, p_new_title: title.value, p_route: route.value, p_responsible: resp.value }));
        }, 'Issue created');
        if (ok) P.dispatch();
      } }, 'Create issue');
      return h('div', { class: 'card' },
        h('div', { class: 'row' }, P.pill(PRIVACY_LABEL[f.privacy]), h('span', { class: 'sub' }, day(f.created_at) + ' · From: ' + (f.submitter_email || 'Anonymous') + (f.contact ? ' · Contact: ' + f.contact : ''))),
        h('p', null, f.message),
        h('h3', null, 'Add to an existing issue'),
        h('div', { class: 'row' }, find, found, link),
        h('h3', null, 'Or start a new issue'),
        P.field('Short title (write it so it could be public)', title),
        h('div', { class: 'row' }, P.field('What to do', route), P.field('Person responsible', resp)),
        h('div', { class: 'row' }, create));
    });
  }

  function issuesList(data, counts) {
    var q = h('input', { class: 'grow', placeholder: 'Search issues' });
    var st = P.select([['', 'Any status']].concat(STATUSES.map(function (s) { return [s, s]; })), '');
    var rt = P.select([['', 'Any route']].concat(ROUTES.slice(1)).concat([['none', 'No route yet']]), '');
    var list = h('div');
    function draw() {
      var t = q.value.trim().toLowerCase();
      var shown = data.issues.filter(function (i) {
        return (!st.value || i.status === st.value) && (!rt.value || (rt.value === 'none' ? !i.route : i.route === rt.value)) &&
          (!t || (i.title + ' ' + (i.responsible_email || '')).toLowerCase().indexOf(t) >= 0);
      });
      list.replaceChildren(shown.length ? P.table(['Issue', 'Status', 'Route', 'Responsible', 'Raised', 'Updated'], shown.map(function (i) {
        var who = data.people.filter(function (p) { return p.email === i.responsible_email; })[0];
        return [P.link('#/issue/' + i.id, i.title), statusPill(i.status), i.route || '', who ? who.name : (i.responsible_email || ''), counts[i.id] || 0, day(i.updated_at)];
      }), [4]) : h('p', { class: 'muted' }, 'No issues match.'));
    }
    [q, st, rt].forEach(function (el) { el.addEventListener('input', draw); });
    draw();
    return h('div', null, h('div', { class: 'row' }, q, st, rt), list);
  }

  // ---------------------------------------------------------------- one issue (ExCo or the person responsible)
  P.route('/issue/:id', { nav: 'inbox', fn: async function (params) {
    P.loading();
    var iss = P.must(await P.act.from('issues').select('*').eq('id', params.id).maybeSingle());
    if (!iss) { P.show(h('p', { class: 'muted' }, 'That issue was not found, or you are not responsible for it.')); return; }
    var ex = P.exco;
    var convo = await conversation(iss.id, 'staff');
    var people = ex ? await loadPeople() : [];
    var who = asList(P.must(await P.act.rpc('responsible_of', { p_issue: iss.id })))[0];

    var title = h('input', { class: 'grow', value: iss.title, maxlength: 200 });
    var status = P.select(STATUSES, iss.status);
    var route = P.select(ROUTES, iss.route || '', { disabled: !ex });
    var resp = peopleSelect(people, iss.responsible_email || '', { disabled: !ex });
    var pub = h('input', { type: 'checkbox', checked: iss.show_to_students, disabled: !ex });
    var save = h('button', { class: 'btn', onclick: async function () {
      save.disabled = true;
      var ok = await P.run(async function () {
        P.must(await P.act.rpc('save_issue', { p_id: iss.id, p_title: title.value, p_status: status.value, p_route: route.value, p_responsible: resp.value, p_show_to_students: pub.checked }));
      }, 'Saved');
      save.disabled = false;
      if (ok) P.dispatch();
    } }, 'Save');

    var merge = null;
    if (ex) {
      var mfind = h('input', { class: 'grow', placeholder: 'Find the issue to merge this into…' });
      var msel = P.select([['', 'Pick an issue']], '');
      mfind.addEventListener('input', async function () {
        var t = mfind.value.trim(); if (t.length < 2) return;
        var res = await P.act.from('issues').select('id,title,status').ilike('title', '%' + t.replace(/[%_]/g, '') + '%').neq('id', iss.id).is('merged_into', null).limit(15);
        msel.replaceChildren.apply(msel, [h('option', { value: '' }, 'Pick an issue')].concat(asList(res.data).map(function (i) { return h('option', { value: i.id }, i.title + ' (' + i.status + ')'); })));
      });
      merge = h('div', { class: 'row' }, mfind, msel, h('button', { class: 'danger', onclick: async function () {
        if (!msel.value) { P.toast('Pick the issue to merge into', true); return; }
        if (!confirm('Merge this issue into the one you picked? This cannot be undone.')) return;
        var ok = await P.run(async function () { P.must(await P.act.rpc('merge_issues', { p_from: iss.id, p_into: msel.value })); }, 'Merged');
        if (ok) P.nav('#/inbox');
      } }, 'Merge duplicate'));
    }

    P.show(h('div', null,
      h('p', null, ex ? P.link('#/inbox', '← Inbox') : P.link('#/assigned', '← Assigned to me')),
      h('div', { class: 'row' }, h('h2', { style: 'margin:0' }, iss.title), statusPill(iss.status), iss.route ? P.pill(iss.route === 'SSLG' ? 'SSLG' : 'Direct') : null),
      h('p', { class: 'sub' }, 'Opened ' + day(iss.created_at) + (who ? ' · Responsible: ' + who.name + (who.positions ? ', ' + who.positions : '') : (iss.responsible_email ? ' · Responsible: ' + iss.responsible_email : ''))),
      convo.el,
      h('details', { class: 'card settings' }, h('summary', null, 'Issue settings'),
        P.field('Title', title),
        h('div', { class: 'row' }, P.field('Status', status), P.field('What to do', route), P.field('Person responsible', resp)),
        h('div', { class: 'row' }, h('label', { class: 'choice' }, pub, h('span', null, h('strong', null, 'Show to student body'), h('span', { class: 'sub' }, 'Every signed-in student can read this conversation (students are never named).' + (ex ? '' : ' ExCo decides.'))))),
        h('div', { class: 'row' }, save),
        merge ? h('h3', null, 'Duplicate?') : null, merge)));
    convo.scroll();
  } });
})();
