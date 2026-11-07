// Feedback and issues. Students send feedback (the form suggests answers that already exist), ExCo triages it into
// issues in the inbox, and every issue is one conversation: the people who raised it on one side, the responders on
// the other, newest at the bottom. ExCo can show an issue to the student body. A reply can be tagged with a meeting
// (e.g. "SSLG 1"); the tag leads to the minutes and every issue raised at that meeting.
(function () {
  'use strict';
  var P = window.P, h = P.h;
  var STATUSES = ['Open', 'Pending', 'Resolved'];
  var PRIVACY = [
    ['exco_and_responsible', 'Share my identity with ExCo and the person handling it', 'Only ExCo and the leader looking after your issue can see who you are. Nobody else can. You can follow the replies under My feedback.'],
    ['anonymous', 'Remain completely anonymous', 'Nobody can see who you are, and you will not be able to follow the replies or add follow-ups.']
  ];
  var PRIVACY_LABEL = { exco_and_responsible: 'ExCo and the person handling it can see who you are', anonymous: 'Anonymous' };
  var STATUS_KIND = { Resolved: 'ok', Pending: 'warn', Open: 'dark' };
  var day = function (s) { return s ? new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''; };
  var clock = function (s) { return new Date(s).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); };
  var statusPill = function (s) { return P.pill(s, STATUS_KIND[s]); };
  var raised = function (n) { return n + (Number(n) === 1 ? ' person has' : ' people have') + ' raised this'; };
  var asList = function (a) { return a && a.length ? a : []; };
  // Academic years run August to July: 5 March 2027 is AY26/27. Meetings are grouped by them, like everything else at MedSoc.
  var ayOf = function (d) { var y = d.getFullYear() - (d.getMonth() >= 7 ? 0 : 1), p2 = function (n) { return String(n % 100).padStart(2, '0'); }; return 'AY' + p2(y) + '/' + p2(y + 1); };
  async function currentAy() {
    try { var r = await P.rec.from('academic_years').select('ay,is_open'); var open = asList(r.data).filter(function (a) { return a.is_open; }).map(function (a) { return a.ay; }).sort().pop(); if (open) return open; } catch (e) { /* fall back to the calendar */ }
    return ayOf(new Date());
  }
  // People ExCo can assign an issue to: current leaders, shown with their positions.
  async function loadPeople() { try { var r = await P.act.rpc('assignable_people'); return r.error ? [] : asList(r.data); } catch (e) { return []; } }
  var personLabel = function (p) { return p.name + (p.positions ? ' — ' + p.positions : ''); };
  function peopleSelect(people, value, attrs) {
    var opts = [['', 'No one yet']].concat(people.map(function (p) { return [p.email, personLabel(p)]; }));
    if (value && !people.some(function (p) { return p.email === value; })) opts.push([value, value]);
    return P.select(opts, value || '', attrs);
  }

  // ---------------------------------------------------------------- the conversation
  // items come from issue_thread() or shared_thread(): { id, happened_at, kind, body, who, mine, meeting_id, meeting_name }
  async function loadMeetings() { try { var r = await P.act.from('meetings').select('id,name,ay,held_on').order('held_on', { ascending: false, nullsFirst: true }); return r.error ? [] : asList(r.data); } catch (e) { return []; } }
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
        h('div', { class: 'body' }, m.body),
        m.meeting_id ? h('a', { class: 'tag', href: '#/meeting/' + m.meeting_id }, m.meeting_name) : null));
    });
    return box;
  }
  function toBottom() { var t = document.getElementById('thread'); if (t) t.scrollTop = t.scrollHeight; }

  async function conversation(issueId, mode) {
    // mode: 'staff' (ExCo or the person responsible) or 'student'
    var holder = h('div');
    var text = h('textarea', { rows: 3, placeholder: mode === 'staff' ? 'Write a reply, or log what happened (e.g. “Emailed the Registrar, reply expected next week”)' : 'Add a follow-up' });
    var kind = P.select([['note', 'Message'], ['email', 'Email sent or received']], 'note');
    var meetings = mode === 'staff' ? await loadMeetings() : [];
    var cur = mode === 'staff' ? await currentAy() : '';
    var years = meetings.map(function (m) { return m.ay; }).filter(function (y, i, a) { return a.indexOf(y) === i; }).sort().reverse();
    var shownAy = years.indexOf(cur) >= 0 ? cur : (years[0] || cur);
    var tag = P.select([['', 'No meeting tag']], '');
    var yearSel = P.select(years, shownAy, { 'aria-label': 'Academic year of the meeting' });
    var ayNote = h('span', { class: 'sub' }, shownAy);
    var more = h('button', { class: 'linkbtn', type: 'button', onclick: function () { yearSel.hidden = false; more.hidden = true; ayNote.hidden = true; } }, 'Other year…');
    yearSel.hidden = shownAy === cur; more.hidden = shownAy !== cur || years.length < 2; ayNote.hidden = shownAy !== cur;
    function fillTags() {
      tag.replaceChildren.apply(tag, [h('option', { value: '' }, 'No meeting tag')].concat(meetings.filter(function (m) { return m.ay === shownAy; }).map(function (m) { return h('option', { value: m.id }, m.name); })));
      ayNote.textContent = shownAy;
    }
    yearSel.addEventListener('change', function () { shownAy = yearSel.value; fillTags(); });
    fillTags();
    var send = h('button', { class: 'btn', onclick: async function () {
      if (!text.value.trim()) { P.toast('Write something first', true); return; }
      send.disabled = true;
      var ok = await P.run(async function () {
        if (mode === 'staff') P.must(await P.act.rpc('add_issue_note', { p_issue: issueId, p_kind: kind.value, p_body: text.value, p_meeting: tag.value || null }));
        else P.must(await P.act.rpc('reply_to_issue', { p_issue: issueId, p_message: text.value }));
      });
      send.disabled = false;
      if (ok) { text.value = ''; tag.value = ''; await draw(); }
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
        mode === 'staff' && meetings.length ? yearSel : null,
        mode === 'staff' && meetings.length ? tag : null,
        mode === 'staff' && meetings.length ? ayNote : null,
        mode === 'staff' && meetings.length ? more : null,
        send),
      mode === 'staff' ? h('p', { class: 'sub', style: 'margin:10px 0 0' }, 'Students who raised this issue can read everything written here, and so can every student if the issue is shown to the student body. Tag a reply with a meeting to link it to that meeting\'s minutes.') : null);
    var el = h('div', null, holder, composer);
    await draw();
    return { el: el, scroll: toBottom };
  }

  // ---------------------------------------------------------------- shared page pieces
  var pageHead = function (title, sub, action) { return h('div', { class: 'page-head' }, h('div', null, h('h1', null, title), sub ? h('p', { class: 'muted' }, sub) : null), action || null); };
  var back = function (href, label) { return h('a', { class: 'back', href: href }, '← ' + label); };
  var emptyBox = function (msg) { return h('div', { class: 'empty' }, msg); };
  var chipsFor = function (opts, current, onPick) {
    var box = h('div', { class: 'chips' });
    function draw() { box.replaceChildren(opts.map(function (o) { return h('button', { class: 'chip' + (o[0] === current ? ' on' : ''), type: 'button', onclick: function () { current = o[0]; draw(); onPick(current); } }, o[1]); })); }
    draw();
    return box;
  };

  // ---------------------------------------------------------------- home
  P.route('/', { public: true, nav: 'home', fn: function () {
    if (P.me) { P.nav('#/said'); return; }
    P.show(h('div', { class: 'landing' },
      h('div', null,
        h('h1', null, 'Tell MedSoc what to improve'),
        h('p', { class: 'lead' }, 'Send feedback, follow what happens to it, and see the issues other students have raised. Sign in with your NTU email. You can stay anonymous.'),
        h('div', { class: 'row' }, h('button', { class: 'btn', onclick: P.askSignIn }, 'Sign in'))),
      h('div', { class: 'card tint' }, h('ol', { class: 'steps' },
        h('li', null, h('div', null, h('b', null, 'You send feedback'), 'Choose who can see that it was you, or stay fully anonymous.')),
        h('li', null, h('div', null, h('b', null, 'ExCo sorts it into an issue'), 'Similar feedback is grouped, and one person is made responsible.')),
        h('li', null, h('div', null, h('b', null, 'You follow the replies'), 'Updates, meeting tags and minutes appear in one conversation.'))))));
  } });

  // ---------------------------------------------------------------- student: send feedback
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
    function privacy() { var r = document.querySelector('input[name="f-priv"]:checked'); return r ? r.value : 'exco_and_responsible'; }
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
        matches.replaceChildren(rows.length ? h('div', { class: 'card tint', style: 'margin-top:14px' },
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
      pageHead('Send feedback', 'Tell us what we should know or change. ExCo reads everything and decides what happens next.'),
      h('div', { class: 'form-grid' },
        h('div', { class: 'card' },
          P.field('Your message', msg), matches, joining,
          h('fieldset', { class: 'choices' }, h('legend', null, 'Who can see that it was you?'), privacyRows),
          P.field('Contact (optional)', contact, 'Only if you want a private reply somewhere else. ExCo will see it.'),
          h('div', { class: 'row' }, btn)),
        h('aside', { class: 'card tint' },
          h('h2', { style: 'margin-bottom:12px' }, 'What happens next'),
          h('ol', { class: 'steps' },
            h('li', null, h('div', null, h('b', null, 'ExCo sorts it'), 'Your feedback joins an issue, or starts a new one.')),
            h('li', null, h('div', null, h('b', null, 'Someone is made responsible'), 'A leader replies and logs what they do.')),
            h('li', null, h('div', null, h('b', null, 'You follow it'), 'Under My feedback, unless you chose to be anonymous.'))),
          h('p', { class: 'sub', style: 'margin-top:16px' }, 'Check ', P.link('#/said', 'Issues'), ' first: someone may have raised it already.')))));
  } });

  // ---------------------------------------------------------------- student: my feedback (one row per conversation)
  P.route('/feedback/mine', { nav: 'mine', fn: async function () {
    P.loading();
    var rows = asList(P.must(await P.act.rpc('my_feedback')));
    var byIssue = {}, cards = [];
    rows.forEach(function (r) {
      if (!r.issue_id) { cards.push({ pending: true, last: r.created_at, first: r }); return; }
      if (!byIssue[r.issue_id]) { byIssue[r.issue_id] = { issue: r, count: 0, last: r.last_update, first: r }; cards.push(byIssue[r.issue_id]); }
      byIssue[r.issue_id].count++;
    });
    cards.sort(function (a, b) { return new Date(b.last) - new Date(a.last); });
    P.show(h('div', { class: 'mine' },
      pageHead('My feedback', 'Open one to read the replies and add a follow-up. Fully anonymous feedback cannot be listed here.'),
      cards.length ? cards.map(function (c) {
        if (c.pending) return h('div', { class: 'card issue' },
          h('div', null, h('div', { class: 't' }, c.first.message.length > 90 ? c.first.message.slice(0, 90) + '…' : c.first.message),
            h('div', { class: 's' }, 'Sent ' + day(c.first.created_at) + ' · ' + PRIVACY_LABEL[c.first.privacy])),
          P.pill('Waiting for ExCo', 'dark'));
        return h('a', { class: 'card issue linkcard', href: '#/thread/' + c.issue.issue_id },
          h('div', null, h('div', { class: 't' }, c.issue.issue_title),
            h('div', { class: 's' }, 'Updated ' + day(c.last) + ' · ' + c.count + (c.count === 1 ? ' message from you' : ' messages from you') + ' · ' + PRIVACY_LABEL[c.issue.privacy])),
          statusPill(c.issue.issue_status));
      }) : h('div', { class: 'card' }, emptyBox('You have not sent any feedback yet.'), h('div', { class: 'row', style: 'justify-content:center' }, h('a', { class: 'btn', href: '#/suggest' }, 'Send feedback')))));
  } });

  // A student's view of one conversation
  P.route('/thread/:id', { nav: 'mine', fn: async function (params) {
    P.loading();
    var iss = P.must(await P.act.rpc('my_feedback')).filter(function (r) { return r.issue_id === params.id; })[0];
    var convo = await conversation(params.id, 'student');
    P.show(h('div', null,
      back('#/feedback/mine', 'My feedback'),
      h('div', { class: 'detail-head' }, h('h1', null, iss ? iss.issue_title : 'Conversation'),
        h('div', { class: 'meta' }, iss ? statusPill(iss.issue_status) : null, h('span', { class: 'sub' }, 'You and MedSoc. A follow-up on a resolved issue reopens it.'))),
      convo.el));
    convo.scroll();
  } });

  // ---------------------------------------------------------------- student: issues shared with the student body
  P.route('/said', { nav: 'board', fn: async function () {
    P.loading();
    var rows = P.must(await P.act.from('shared_issues').select('*').order('updated_at', { ascending: false }));
    var q = h('input', { class: 'grow', type: 'search', placeholder: 'Search issues', 'aria-label': 'Search issues' });
    var status = '';
    var list = h('div');
    function draw() {
      var t = q.value.trim().toLowerCase();
      var shown = rows.filter(function (r) { return (!status || r.status === status) && (!t || r.title.toLowerCase().indexOf(t) >= 0); });
      list.replaceChildren(shown.length ? shown.map(function (r) {
        return h('a', { class: 'card issue linkcard', href: '#/shared/' + r.id },
          h('div', { class: 'tally' }, h('b', null, String(r.times_raised)), h('span', null, 'raised')),
          h('div', null, h('div', { class: 't' }, r.title), h('div', { class: 's' }, 'Updated ' + day(r.updated_at))),
          statusPill(r.status));
      }) : h('div', { class: 'card' }, emptyBox(rows.length ? 'Nothing matches.' : 'Nothing has been shared yet.')));
    }
    q.addEventListener('input', draw);
    draw();
    P.show(h('div', null,
      pageHead('Issues', 'Questions that come up again and again, and what MedSoc has said or done. ExCo chooses which issues are shown here. Students are never named.'),
      h('div', { class: 'toolbar' },
        chipsFor([['', 'All']].concat(STATUSES.map(function (s) { return [s, s]; })), '', function (v) { status = v; draw(); }), q,
        h('a', { href: '#/meetings' }, 'Meeting minutes →')),
      list));
  } });

  // One shared conversation, read-only, with a way to add your own voice
  P.route('/shared/:id', { nav: 'board', fn: async function (params) {
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
      var ok = await P.run(async function () { P.must(await P.act.rpc('submit_feedback', { p_message: msg.value.trim(), p_privacy: r ? r.value : 'exco_and_responsible', p_contact: '', p_issue: iss.id })); }, 'Added to this issue');
      add.disabled = false;
      if (ok) P.dispatch();
    } }, 'Add my voice');
    var meetingNames = items.filter(function (m) { return m.meeting_id; }).reduce(function (acc, m) { if (!acc.some(function (x) { return x.id === m.meeting_id; })) acc.push({ id: m.meeting_id, name: m.meeting_name }); return acc; }, []);
    P.show(h('div', null,
      back('#/said', 'All issues'),
      h('div', { class: 'detail-head' }, h('h1', null, iss.title), h('div', { class: 'meta' }, statusPill(iss.status), h('span', { class: 'sub' }, raised(iss.times_raised)))),
      h('div', { class: 'detail' },
        h('div', null, threadView(items)),
        h('aside', { class: 'props' },
          h('h3', null, 'Is this your problem too?'), msg,
          h('fieldset', { class: 'choices' }, h('legend', null, 'Who can see that it was you?'), priv),
          h('div', { class: 'row' }, add),
          meetingNames.length ? h('div', null, h('h3', null, 'Discussed at'), meetingNames.map(function (m) { return h('div', null, P.link('#/meeting/' + m.id, m.name)); })) : null))));
    toBottom();
  } });

  // ---------------------------------------------------------------- workspace: tickets (the queue for ExCo and the people responsible)
  var VIEWS = [['triage', 'To triage'], ['mine', 'Assigned to me'], ['Open', 'Open'], ['Pending', 'Pending'], ['Resolved', 'Resolved'], ['all', 'All tickets']];
  P.route('/tickets', { nav: 'tickets', fn: async function (params, q) {
    if (!P.canWork()) { P.show(h('p', { class: 'muted' }, 'This section is for ExCo and the people handling an issue.')); return; }
    P.prefs.set('space', 'work');
    P.loading();
    var mineRows = asList(await P.act.rpc('my_issues').then(function (r) { return r.error ? [] : r.data; }).catch(function () { return []; }));
    var mineIds = {}; mineRows.forEach(function (r) { mineIds[r.id] = true; });
    var data = { pending: [], issues: [], people: [], counts: {} };
    if (P.exco) {
      data.pending = P.must(await P.act.from('feedback').select('*').is('issue_id', null).order('created_at', { ascending: true }));
      data.issues = P.must(await P.act.from('issues').select('*').is('merged_into', null).order('updated_at', { ascending: false }));
      var links = await P.fetchAll(function () { return P.act.from('feedback').select('issue_id').not('issue_id', 'is', null); });
      links.forEach(function (l) { data.counts[l.issue_id] = (data.counts[l.issue_id] || 0) + 1; });
      data.people = await loadPeople();
      P.triageCount = data.pending.length; P.refreshChrome();
    } else {
      data.issues = mineRows;
    }
    var allowed = VIEWS.filter(function (v) { return v[0] !== 'triage' || P.exco; });
    var view = q.view && allowed.some(function (v) { return v[0] === q.view; }) ? q.view : (P.exco ? (data.pending.length ? 'triage' : 'Open') : 'mine');
    var inView = function (v) {
      return v === 'triage' ? data.pending.length : v === 'mine' ? data.issues.filter(function (i) { return mineIds[i.id]; }).length : v === 'all' ? data.issues.length : data.issues.filter(function (i) { return i.status === v; }).length;
    };
    var queue = h('nav', { class: 'queue', 'aria-label': 'Ticket views' },
      P.exco ? h('h3', null, 'Queue') : null,
      allowed.filter(function (v) { return v[0] === 'triage' || v[0] === 'mine'; }).map(queueLink),
      h('h3', null, 'Status'),
      allowed.filter(function (v) { return v[0] !== 'triage' && v[0] !== 'mine'; }).map(queueLink));
    function queueLink(v) { return h('a', { class: v[0] === view ? 'on' : '', href: '#/tickets?view=' + v[0] }, v[1], h('span', { class: 'n' }, String(inView(v[0])))); }
    var label = allowed.filter(function (v) { return v[0] === view; })[0][1];
    P.show(h('div', null,
      pageHead(label, view === 'triage' ? 'Feedback nobody has sorted yet. Add it to an existing issue, or start a new one.' : null),
      h('div', { class: 'work-grid' }, queue, view === 'triage' ? h('div', null, triage(data)) : ticketList(data, view, mineIds))));
  } });
  P.route('/inbox', { nav: 'tickets', fn: function () { P.nav('#/tickets?view=triage'); } });
  P.route('/assigned', { nav: 'tickets', fn: function () { P.nav('#/tickets?view=mine'); } });

  function ticketList(data, view, mineIds) {
    var q = h('input', { class: 'grow', type: 'search', placeholder: 'Search tickets', 'aria-label': 'Search tickets' });
    var list = h('div', { class: 'tickets' });
    function draw() {
      var t = q.value.trim().toLowerCase();
      var shown = data.issues.filter(function (i) {
        var inV = view === 'all' || (view === 'mine' ? mineIds[i.id] : i.status === view);
        return inV && (!t || (i.title + ' ' + (i.responsible_email || '')).toLowerCase().indexOf(t) >= 0);
      });
      list.replaceChildren(h('div', { class: 'thead' }, h('span', null, 'Ticket'), h('span', null, 'Status'), h('span', { class: 'hide-sm' }, 'Responsible'), h('span', { class: 'num hide-sm' }, 'Raised'), h('span', { class: 'num hide-sm' }, 'Updated')),
        shown.length ? shown.map(function (i) {
          var who = data.people.filter(function (p) { return p.email === i.responsible_email; })[0];
          var n = data.counts[i.id] !== undefined ? data.counts[i.id] : i.times_raised;
          return h('a', { class: 'trow', href: '#/issue/' + i.id },
            h('span', { class: 'title' }, i.title), statusPill(i.status),
            h('span', { class: 'cell hide-sm' }, who ? who.name : (i.responsible_email || 'Unassigned')),
            h('span', { class: 'cell num hide-sm' }, String(n || 0)), h('span', { class: 'cell num hide-sm' }, day(i.updated_at)));
        }) : emptyBox('No tickets here.'));
    }
    q.addEventListener('input', draw);
    draw();
    return h('div', null, h('div', { class: 'toolbar' }, q), list);
  }

  function triage(data) {
    if (!data.pending.length) return h('div', { class: 'tickets' }, emptyBox('Nothing waiting. Every piece of feedback has been sorted into an issue.'));
    return data.pending.map(function (f) {
      var title = h('input', { class: 'grow', value: f.message.replace(/\s+/g, ' ').slice(0, 70), maxlength: 200 });
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
        var ok = await P.run(async function () { P.must(await P.act.rpc('triage_feedback', { p_feedback: f.id, p_issue: found.value, p_new_title: null, p_responsible: null })); }, 'Added to the issue');
        if (ok) P.dispatch();
      } }, 'Add to this issue');
      var create = h('button', { class: 'btn', onclick: async function () {
        var ok = await P.run(async function () {
          P.must(await P.act.rpc('triage_feedback', { p_feedback: f.id, p_issue: null, p_new_title: title.value, p_responsible: resp.value }));
        }, 'Issue created');
        if (ok) P.dispatch();
      } }, 'Create issue');
      return h('div', { class: 'card triage-card' },
        h('div', { class: 'row', style: 'margin-top:0' }, P.pill(PRIVACY_LABEL[f.privacy], 'plain'), h('span', { class: 'from' }, day(f.created_at) + ' · From: ' + (f.submitter_email || 'Anonymous') + (f.contact ? ' · Contact: ' + f.contact : ''))),
        h('blockquote', null, f.message),
        h('div', { class: 'split2' },
          h('div', null, h('h3', { style: 'margin-top:0' }, 'Add to an existing issue'), h('div', { class: 'row' }, find), h('div', { class: 'row' }, found, link)),
          h('div', null, h('h3', { style: 'margin-top:0' }, 'Or start a new issue'),
            P.field('Short title (write it so it could be public)', title),
            P.field('Person responsible', resp),
            h('div', { class: 'row' }, create))));
    });
  }

  // ---------------------------------------------------------------- workspace: one ticket (ExCo or the person responsible)
  P.route('/issue/:id', { nav: 'tickets', fn: async function (params) {
    P.prefs.set('space', 'work');
    P.loading();
    var iss = P.must(await P.act.from('issues').select('*').eq('id', params.id).maybeSingle());
    if (!iss) { P.show(h('p', { class: 'muted' }, 'That issue was not found, or you are not responsible for it.')); return; }
    var ex = P.exco;
    var convo = await conversation(iss.id, 'staff');
    var people = ex ? await loadPeople() : [];
    var who = asList(P.must(await P.act.rpc('responsible_of', { p_issue: iss.id })))[0];
    var items = asList(P.must(await P.act.rpc('issue_thread', { p_issue: iss.id })));
    var meetingTags = items.filter(function (m) { return m.meeting_id; }).reduce(function (acc, m) { if (!acc.some(function (x) { return x.id === m.meeting_id; })) acc.push({ id: m.meeting_id, name: m.meeting_name }); return acc; }, []);

    var title = h('input', { value: iss.title, maxlength: 200, 'aria-label': 'Title' });
    var status = P.select(STATUSES, iss.status);
    var resp = peopleSelect(people, iss.responsible_email || '', { disabled: !ex });
    var pub = h('input', { type: 'checkbox', checked: iss.show_to_students, disabled: !ex });
    var save = h('button', { class: 'btn', onclick: async function () {
      save.disabled = true;
      var ok = await P.run(async function () {
        P.must(await P.act.rpc('save_issue', { p_id: iss.id, p_title: title.value, p_status: status.value, p_responsible: resp.value, p_show_to_students: pub.checked }));
      }, 'Saved');
      save.disabled = false;
      if (ok) P.dispatch();
    } }, 'Save changes');

    var merge = null;
    if (ex) {
      var mfind = h('input', { placeholder: 'Find the issue to merge this into…' });
      var msel = P.select([['', 'Pick an issue']], '');
      mfind.addEventListener('input', async function () {
        var t = mfind.value.trim(); if (t.length < 2) return;
        var res = await P.act.from('issues').select('id,title,status').ilike('title', '%' + t.replace(/[%_]/g, '') + '%').neq('id', iss.id).is('merged_into', null).limit(15);
        msel.replaceChildren.apply(msel, [h('option', { value: '' }, 'Pick an issue')].concat(asList(res.data).map(function (i) { return h('option', { value: i.id }, i.title + ' (' + i.status + ')'); })));
      });
      merge = h('div', null, h('div', { class: 'divider' }), h('h3', null, 'Duplicate?'), mfind, h('div', { class: 'row' }, msel),
        h('button', { class: 'danger', onclick: async function () {
          if (!msel.value) { P.toast('Pick the issue to merge into', true); return; }
          if (!confirm('Merge this issue into the one you picked? This cannot be undone.')) return;
          var ok = await P.run(async function () { P.must(await P.act.rpc('merge_issues', { p_from: iss.id, p_into: msel.value })); }, 'Merged');
          if (ok) P.nav('#/tickets');
        } }, 'Merge duplicate'));
    }

    P.show(h('div', null,
      back(ex ? '#/tickets' : '#/tickets?view=mine', 'Tickets'),
      h('div', { class: 'detail-head' }, h('h1', null, iss.title),
        h('div', { class: 'meta' }, statusPill(iss.status), h('span', { class: 'sub' }, 'Opened ' + day(iss.created_at) + ' · ' + raised(iss.times_raised || 0)))),
      h('div', { class: 'detail' },
        h('div', null, convo.el),
        h('aside', { class: 'props' },
          h('h3', null, 'Ticket'),
          P.field('Title', title),
          P.field('Status', status),
          P.field('Person responsible', resp),
          h('label', { class: 'chk' }, pub, h('span', null, h('strong', null, 'Show to student body'), h('br'), h('span', { class: 'sub' }, 'Every signed-in student can read this conversation (students are never named).' + (ex ? '' : ' ExCo decides.')))),
          h('div', { class: 'row' }, save),
          h('div', { class: 'divider' }),
          h('h3', null, 'Details'),
          h('dl', null,
            h('div', null, h('dt', null, 'Responsible'), h('dd', null, who ? who.name + (who.positions ? ', ' + who.positions : '') : (iss.responsible_email || 'No one yet'))),
            h('div', null, h('dt', null, 'Meetings'), h('dd', null, meetingTags.length ? meetingTags.map(function (m) { return h('div', null, P.link('#/meeting/' + m.id, m.name)); }) : 'None tagged'))),
          merge))));
    convo.scroll();
  } });

  // ---------------------------------------------------------------- meetings: a tag on replies, with minutes and the issues raised there
  P.route('/meetings', { nav: 'meetings', fn: async function () {
    P.loading();
    var rows = asList(P.must(await P.act.from('meetings').select('*').order('held_on', { ascending: false, nullsFirst: true }).order('created_at', { ascending: false })));
    var cur = await currentAy();
    var known = [];
    try { var yr = await P.rec.from('academic_years').select('ay'); known = asList(yr.data).map(function (a) { return a.ay; }); } catch (e) { /* the form still offers the current year */ }
    var all = known.concat(rows.map(function (m) { return m.ay; }), [cur]).filter(function (y, i, a) { return a.indexOf(y) === i; }).sort().reverse();
    var name = h('input', { class: 'grow', placeholder: 'e.g. SSLG 1', maxlength: 80 });
    var date = h('input', { type: 'date' });
    var ay = P.select(all, cur);
    date.addEventListener('change', function () {
      if (!date.value) return;
      var guess = ayOf(new Date(date.value + 'T00:00:00'));
      if (all.indexOf(guess) < 0) { all.push(guess); all.sort().reverse(); ay.replaceChildren.apply(ay, all.map(function (y) { return h('option', { value: y }, y); })); }
      ay.value = guess;
    });
    var add = h('button', { class: 'btn', onclick: async function () {
      if (name.value.trim().length < 2) { P.toast('Give the meeting a name', true); return; }
      var ok = await P.run(async function () { P.must(await P.act.from('meetings').insert({ name: name.value.trim(), held_on: date.value || null, ay: ay.value })); }, 'Meeting added');
      if (ok) P.dispatch();
    } }, 'Add meeting');
    var byAy = {};
    rows.forEach(function (m) { (byAy[m.ay] = byAy[m.ay] || []).push(m); });
    var yrs = Object.keys(byAy).sort().reverse();
    var openYear = byAy[cur] ? cur : yrs[0];
    P.show(h('div', null,
      pageHead('Meetings', 'Tag a reply on an issue with a meeting, and the issue shows up here with that meeting\'s minutes. Meetings are grouped by academic year.'),
      P.exco ? h('div', { class: 'card' }, h('strong', null, 'New meeting'), h('div', { class: 'row' }, name, date, ay, add), h('p', { class: 'sub' }, 'The academic year fills in from the date (August to July). Change it if you need to.')) : null,
      yrs.length ? yrs.map(function (y) {
        return h('details', { class: 'ayblock', open: y === openYear },
          h('summary', null, y + ' · ' + byAy[y].length + (byAy[y].length === 1 ? ' meeting' : ' meetings')),
          byAy[y].map(function (m) {
            return h('a', { class: 'card issue linkcard', href: '#/meeting/' + m.id },
              h('div', null, h('div', { class: 't' }, m.name), h('div', { class: 's' }, m.held_on ? day(m.held_on) : 'Date not set')),
              m.minutes_path ? P.pill('Minutes uploaded', 'ok') : P.pill('No minutes yet'));
          }));
      }) : h('p', { class: 'muted' }, 'No meetings yet.')));
  } });

  P.route('/meeting/:id', { nav: 'meetings', fn: async function (params) {
    P.loading();
    var m = P.must(await P.act.from('meetings').select('*').eq('id', params.id).maybeSingle());
    if (!m) { P.show(h('p', { class: 'muted' }, 'That meeting was not found.')); return; }
    var issues = asList(P.must(await P.act.rpc('meeting_issues', { p_meeting: m.id })));
    var minutes = h('div');
    function drawMinutes() {
      var open = h('button', { class: 'btn', onclick: async function () {
        var r = await P.sb.storage.from('meeting-minutes').createSignedUrl(m.minutes_path, 600);
        if (r.error) { P.toast(P.friendly(r.error), true); return; }
        window.open(r.data.signedUrl, '_blank', 'noopener');
      } }, 'Open the minutes (PDF)');
      var file = h('input', { type: 'file', accept: 'application/pdf', hidden: true });
      var up = h('button', { class: 'ghost', onclick: function () { file.click(); } }, m.minutes_path ? 'Replace the PDF' : 'Upload the minutes (PDF)');
      file.addEventListener('change', async function () {
        var f = file.files[0]; if (!f) return;
        if (f.type !== 'application/pdf') { P.toast('Please choose a PDF file', true); file.value = ''; return; }
        up.disabled = true;
        var path = m.id + '/' + Date.now().toString(36) + '.pdf';
        var ok = await P.run(async function () {
          var u = await P.sb.storage.from('meeting-minutes').upload(path, f, { contentType: 'application/pdf' });
          if (u.error) throw u.error;
          P.must(await P.act.from('meetings').update({ minutes_path: path }).eq('id', m.id));
          if (m.minutes_path) await P.sb.storage.from('meeting-minutes').remove([m.minutes_path]);
        }, 'Minutes saved');
        up.disabled = false; file.value = '';
        if (ok) P.dispatch();
      });
      minutes.replaceChildren(h('div', { class: 'row' }, m.minutes_path ? open : h('span', { class: 'muted' }, 'Minutes have not been uploaded yet.'), P.exco ? up : null, file));
    }
    drawMinutes();
    var link = function (i) { return i.can_edit ? '#/issue/' + i.id : i.shared ? '#/shared/' + i.id : '#/thread/' + i.id; };
    P.show(h('div', null,
      back('#/meetings', 'Meetings'),
      h('div', { class: 'detail-head' }, h('h1', null, m.name + ' · ' + m.ay), m.held_on ? h('div', { class: 'meta' }, h('span', { class: 'sub' }, day(m.held_on))) : null),
      h('div', { class: 'card' }, h('strong', null, 'Minutes'), minutes),
      h('h3', null, 'Issues raised at this meeting'),
      issues.length ? issues.map(function (i) {
        return h('a', { class: 'card issue linkcard', href: link(i) },
          h('div', { class: 'tally' }, h('b', null, String(i.times_raised)), h('span', null, 'raised')),
          h('div', null, h('div', { class: 't' }, i.title), h('div', { class: 's' }, 'Updated ' + day(i.last_update) + (i.shared ? '' : ' · not shared with students'))),
          statusPill(i.status));
      }) : h('p', { class: 'muted' }, 'No issues have been tagged with this meeting yet. Each issue is followed up in its own conversation after the meeting.')));
  } });
})();
