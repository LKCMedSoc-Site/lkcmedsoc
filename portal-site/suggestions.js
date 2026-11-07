// Feedback and issues. Students send feedback (the form suggests answers that already exist), ExCo triages it into
// issues, the person responsible for an issue works on it, and resolved issues show on a public "Issues & answers" page.
// (File name kept from the old suggestion box.)
(function () {
  'use strict';
  var P = window.P, h = P.h;
  var CATS = ['Suggestion', 'Complaint', 'Website problem', 'Welfare / other', 'Paper for SSLG'];
  var ISSUE_CATS = ['Academic', 'Welfare', 'Facilities', 'Administrative', 'Website', 'Other'];
  var STATUSES = ['New', 'Open', 'Tabled', 'Resolved', 'Declined'];
  var ROUTES = [['', 'Not decided'], ['Direct', 'Resolve directly'], ['SSLG', 'Table at SSLG']];
  var PRIVACY = [
    ['named', 'Show my name', 'Staff and ExCo can see who sent this. Best if you want a reply.'],
    ['hidden_from_staff', 'Hide my name from staff', 'Only ExCo can see it, so we can still reply to you. The staff handling the issue never see it.'],
    ['anonymous', 'Fully anonymous', 'Nobody can see who sent it, and we cannot reply to you.']
  ];
  var PRIVACY_LABEL = { named: 'Name shown', hidden_from_staff: 'Hidden from staff', anonymous: 'Anonymous' };
  var STATUS_KIND = { Resolved: 'ok', Declined: 'bad', Open: 'warn', Tabled: 'warn', New: 'dark' };
  var day = function (s) { return s ? new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''; };
  var statusPill = function (s) { return P.pill(s, STATUS_KIND[s]); };
  var raised = function (n) { return n + (Number(n) === 1 ? ' person has' : ' people have') + ' raised this'; };
  var asList = function (a) { return a && a.length ? a : []; };

  // ---------------------------------------------------------------- send feedback
  P.route('/suggest', { nav: 'suggest', fn: async function () {
    var cat = P.select(CATS, 'Suggestion', { id: 'f-cat' });
    var msg = h('textarea', { id: 'f-msg', rows: 6, maxlength: 3000, placeholder: 'What would you like us to know or change? Be as specific as you can.' });
    var contact = h('input', { id: 'f-contact', class: 'grow', placeholder: 'Optional: another way to reach you' });
    var sslg = h('input', { type: 'checkbox', id: 'f-sslg' });
    var matches = h('div');
    var joining = h('div');
    var chosen = null, timer;

    var privacyRows = PRIVACY.map(function (p, i) {
      return h('label', { class: 'choice' }, h('input', { type: 'radio', name: 'f-priv', value: p[0], checked: i === 1 }),
        h('span', null, h('strong', null, p[1]), h('span', { class: 'sub' }, p[2])));
    });
    function privacy() { var r = document.querySelector('input[name="f-priv"]:checked'); return r ? r.value : 'hidden_from_staff'; }

    cat.addEventListener('change', function () { if (cat.value === 'Paper for SSLG') sslg.checked = true; });
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
          h('p', { class: 'muted' }, 'These issues are already being looked at. If one is yours, add yourself to it and you will see updates.'),
          rows.map(function (r) {
            return h('div', { class: 'match' },
              h('div', { class: 'row' }, h('strong', null, r.title), statusPill(r.status), h('span', { class: 'sub' }, raised(r.times_raised))),
              r.public_answer ? h('p', null, r.public_answer) : null,
              h('button', { class: 'ghost', onclick: function () { pick(r); } }, 'This is my question too'));
          })) : null);
      } catch (e) { matches.replaceChildren(); }
    }

    var btn = h('button', { class: 'btn', id: 'f-send', onclick: async function () {
      if (msg.value.trim().length < 5) { P.toast('Please write a little more', true); return; }
      btn.disabled = true;
      var ok = await P.run(async function () {
        P.must(await P.act.rpc('submit_feedback', { p_category: cat.value, p_message: msg.value.trim(), p_privacy: privacy(), p_contact: contact.value, p_wants_sslg: sslg.checked, p_issue: chosen }));
      }, 'Thank you. We have your feedback.');
      btn.disabled = false;
      if (ok) { msg.value = ''; contact.value = ''; sslg.checked = false; pick(null); matches.replaceChildren(); P.nav('#/feedback/mine'); }
    } }, 'Send feedback');

    P.show(h('div', null,
      h('h2', null, 'Send feedback'),
      h('p', { class: 'muted' }, 'Suggestions, complaints, website problems, or a paper for the Student-Staff Liaison Group (SSLG). ExCo reads everything.'),
      h('div', { class: 'card' },
        P.field('Type', cat),
        P.field('Your message', msg),
        matches, joining,
        h('div', { class: 'row' }, h('label', { class: 'choice' }, sslg, h('span', null, h('strong', null, 'Raise this at SSLG'), h('span', { class: 'sub' }, 'Tick if this should go to the next Student-Staff Liaison Group meeting. If your name is shown, you will be the person who follows it up, unless ExCo decides otherwise.')))),
        h('fieldset', { class: 'choices' }, h('legend', null, 'Who can see that it was you?'), privacyRows),
        P.field('Contact (optional)', contact, 'Only if you want a private reply somewhere else. ExCo will see it.'),
        h('div', { class: 'row' }, btn)),
      h('p', null, P.link('#/said', 'Issues and answers'), ' · ', P.link('#/feedback/mine', 'My feedback'))));
  } });

  // ---------------------------------------------------------------- my feedback
  P.route('/feedback/mine', { nav: 'myfeedback', fn: async function () {
    P.loading();
    var rows = P.must(await P.act.rpc('my_feedback'));
    P.show(h('div', null,
      h('h2', null, 'My feedback'),
      h('p', { class: 'muted' }, 'What you have sent, and what happened to it. Fully anonymous feedback cannot be listed here.'),
      rows.length ? rows.map(function (r) {
        return h('div', { class: 'card' },
          h('div', { class: 'row' }, P.pill(r.category), P.pill(PRIVACY_LABEL[r.privacy] || r.privacy), r.issue_id ? statusPill(r.issue_status) : P.pill('Waiting for ExCo', 'dark'), h('span', { class: 'sub' }, day(r.created_at))),
          h('p', null, r.message),
          r.issue_id ? h('div', { class: 'sub' }, 'Being handled as: ', h('strong', null, r.issue_title)) : null,
          r.outcome ? h('p', null, h('strong', null, 'Outcome: '), r.outcome) : null,
          asList(r.updates).map(function (u) { return h('p', { class: 'sub' }, day(u.at) + ': ' + u.body); }));
      }) : h('p', { class: 'muted' }, 'You have not sent any feedback yet. ', P.link('#/suggest', 'Send some')),
      h('p', null, P.link('#/suggest', 'Send feedback'))));
  } });

  // ---------------------------------------------------------------- public list
  P.route('/said', { public: true, nav: 'said', fn: async function () {
    P.loading();
    var rows = P.must(await P.act.from('public_issues').select('*').order('created_at', { ascending: false }));
    var q = h('input', { class: 'grow', placeholder: 'Search issues and answers' });
    var cat = P.select([['', 'All topics']].concat(ISSUE_CATS.map(function (c) { return [c, c]; })), '');
    var st = P.select([['', 'Any status']].concat(STATUSES.map(function (s) { return [s, s]; })), '');
    var list = h('div');
    function draw() {
      var t = q.value.trim().toLowerCase();
      var shown = rows.filter(function (r) {
        return (!cat.value || r.category === cat.value) && (!st.value || r.status === st.value) &&
          (!t || (r.title + ' ' + (r.public_answer || '') + ' ' + asList(r.tags).join(' ')).toLowerCase().indexOf(t) >= 0);
      });
      list.replaceChildren(shown.length ? shown.map(function (r) {
        return h('div', { class: 'card' },
          h('div', { class: 'row' }, h('strong', null, r.title), statusPill(r.status), P.pill(r.category), h('span', { class: 'sub' }, raised(r.times_raised) + (r.resolved_at ? ' · resolved ' + day(r.resolved_at) : ''))),
          r.public_answer ? h('p', null, r.public_answer) : h('p', { class: 'muted' }, 'No answer published yet.'));
      }) : h('p', { class: 'muted' }, rows.length ? 'Nothing matches.' : 'Nothing here yet.'));
    }
    [q, cat, st].forEach(function (el) { el.addEventListener('input', draw); });
    draw();
    P.show(h('div', null,
      h('h2', null, 'Issues and answers'),
      h('p', { class: 'muted' }, 'Questions students keep asking, and what MedSoc and the school have said or done about them.'),
      h('div', { class: 'row' }, q, cat, st), list,
      P.me ? h('p', null, P.link('#/suggest', 'Send feedback')) : null));
  } });

  // ---------------------------------------------------------------- issues I am responsible for
  P.route('/assigned', { nav: 'assigned', fn: async function () {
    P.loading();
    var rows = P.must(await P.act.rpc('my_issues'));
    P.show(h('div', null,
      h('h2', null, 'Assigned to me'),
      h('p', { class: 'muted' }, 'Issues you are responsible for. You can update them, add notes and record the outcome.'),
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
      issues: P.must(await P.act.from('issues').select('*').order('updated_at', { ascending: false })),
      links: await P.fetchAll(function () { return P.act.from('feedback').select('issue_id').not('issue_id', 'is', null); })
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
    function drawBody() { holder.replaceChildren(inboxTab === 'triage' ? triage(data, refresh) : issuesList(data, counts)); }
    function refresh() { P.dispatch(); }
    drawTabs(); drawBody();
    P.show(h('div', null, h('h2', null, 'Feedback inbox'), tabs, holder));
  } });

  function triage(data, refresh) {
    if (!data.pending.length) return h('p', { class: 'muted' }, 'Nothing waiting. Every piece of feedback has been sorted into an issue.');
    return data.pending.map(function (f) {
      var title = h('input', { class: 'grow', value: f.message.replace(/\s+/g, ' ').slice(0, 70), maxlength: 200 });
      var icat = P.select(ISSUE_CATS, 'Other');
      var route = P.select(ROUTES, f.wants_sslg || f.category === 'Paper for SSLG' ? 'SSLG' : '');
      var resp = h('input', { class: 'grow', type: 'email', placeholder: 'Person responsible (email)', value: (f.wants_sslg && f.privacy === 'named' && f.submitter_email) || '' });
      var find = h('input', { class: 'grow', placeholder: 'Find an existing issue…' });
      var found = P.select([['', 'Pick an existing issue']], '');
      var timer;
      find.addEventListener('input', function () {
        clearTimeout(timer);
        timer = setTimeout(function () {
          var t = find.value.trim().toLowerCase();
          var hits = data.issues.filter(function (i) { return i.status !== 'Duplicate' && t && (i.title + ' ' + (i.summary || '')).toLowerCase().indexOf(t) >= 0; }).slice(0, 20);
          found.replaceChildren.apply(found, [h('option', { value: '' }, hits.length ? 'Pick an existing issue' : 'No match')].concat(hits.map(function (i) { return h('option', { value: i.id }, i.title + ' (' + i.status + ')'); })));
        }, 250);
      });
      var link = h('button', { class: 'ghost', onclick: async function () {
        if (!found.value) { P.toast('Find and pick an issue first', true); return; }
        var ok = await P.run(async function () { P.must(await P.act.rpc('triage_feedback', { p_feedback: f.id, p_issue: found.value, p_new_title: null, p_category: null, p_route: null, p_responsible: null })); }, 'Added to the issue');
        if (ok) refresh();
      } }, 'Add to this issue');
      var create = h('button', { class: 'btn', onclick: async function () {
        var ok = await P.run(async function () {
          P.must(await P.act.rpc('triage_feedback', { p_feedback: f.id, p_issue: null, p_new_title: title.value, p_category: icat.value, p_route: route.value, p_responsible: resp.value }));
        }, 'Issue created');
        if (ok) refresh();
      } }, 'Create issue');
      return h('div', { class: 'card' },
        h('div', { class: 'row' }, P.pill(f.category), P.pill(PRIVACY_LABEL[f.privacy]), f.wants_sslg ? P.pill('Wants SSLG', 'warn') : null, h('span', { class: 'sub' }, day(f.created_at))),
        h('p', null, f.message),
        h('p', { class: 'sub' }, 'From: ' + (f.submitter_email || 'Anonymous') + (f.contact ? ' · Contact: ' + f.contact : '')),
        h('h3', null, 'Add to an existing issue'),
        h('div', { class: 'row' }, find, found, link),
        h('h3', null, 'Or start a new issue'),
        P.field('Short title (written so it can be public)', title),
        h('div', { class: 'row' }, P.field('Topic', icat), P.field('Route', route), P.field('Person responsible', resp)),
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
        return i.status !== 'Duplicate' && (!st.value || i.status === st.value) && (!rt.value || (rt.value === 'none' ? !i.route : i.route === rt.value)) &&
          (!t || (i.title + ' ' + (i.summary || '') + ' ' + (i.responsible_email || '')).toLowerCase().indexOf(t) >= 0);
      });
      list.replaceChildren(shown.length ? P.table(['Issue', 'Status', 'Route', 'Responsible', 'Raised', 'Updated'], shown.map(function (i) {
        return [P.link('#/issue/' + i.id, i.title), statusPill(i.status), i.route || '', i.responsible_email || '', counts[i.id] || 0, day(i.updated_at)];
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
    var feedback = P.must(await P.act.rpc('issue_feedback', { p_issue: iss.id }));
    var notes = P.must(await P.act.from('issue_notes').select('*').eq('issue_id', iss.id).order('created_at', { ascending: false }));
    var ex = P.exco;

    var title = h('input', { class: 'grow', value: iss.title, maxlength: 200 });
    var icat = P.select(ISSUE_CATS, iss.category);
    var status = P.select(STATUSES.filter(function (s) { return ex || s !== 'Tabled' || iss.status === 'Tabled'; }), iss.status);
    var route = P.select(ROUTES, iss.route || '', { disabled: !ex });
    var resp = h('input', { class: 'grow', type: 'email', value: iss.responsible_email || '', disabled: !ex, placeholder: 'email' });
    var tags = h('input', { class: 'grow', value: asList(iss.tags).join(', '), placeholder: 'comma separated, e.g. exams, labs' });
    var summary = h('textarea', { rows: 4 }, iss.summary || ''); summary.value = iss.summary || '';
    var outcome = h('textarea', { rows: 3, placeholder: 'What was decided or done' }, iss.outcome || ''); outcome.value = iss.outcome || '';
    var answer = h('textarea', { rows: 3, placeholder: 'A plain answer students can read. Shown publicly only if ExCo ticks the box.' }, iss.public_answer || ''); answer.value = iss.public_answer || '';
    var pub = h('input', { type: 'checkbox', checked: iss.show_public, disabled: !ex });

    var save = h('button', { class: 'btn', onclick: async function () {
      save.disabled = true;
      var ok = await P.run(async function () {
        P.must(await P.act.rpc('save_issue', {
          p_id: iss.id, p_title: title.value, p_summary: summary.value, p_category: icat.value,
          p_tags: tags.value.split(',').map(function (t) { return t.trim().toLowerCase(); }).filter(Boolean),
          p_status: status.value, p_route: route.value, p_responsible: resp.value, p_outcome: outcome.value, p_public_answer: answer.value, p_show_public: pub.checked
        }));
      }, 'Saved');
      save.disabled = false;
      if (ok) P.dispatch();
    } }, 'Save changes');

    var nKind = P.select([['note', 'Note (internal)'], ['email', 'Email sent or received'], ['outcome', 'Outcome update']], 'note');
    var nBody = h('textarea', { rows: 3, placeholder: 'e.g. Emailed the Registrar on 12 Nov. Reply expected next week.' });
    var nVis = h('input', { type: 'checkbox' });
    var addNote = h('button', { class: 'ghost', onclick: async function () {
      if (!nBody.value.trim()) { P.toast('Write the note first', true); return; }
      var ok = await P.run(async function () { P.must(await P.act.rpc('add_issue_note', { p_issue: iss.id, p_kind: nKind.value, p_body: nBody.value, p_visible: nVis.checked })); }, 'Note added');
      if (ok) P.dispatch();
    } }, 'Add to timeline');

    var merge = null;
    if (ex) {
      var mfind = h('input', { class: 'grow', placeholder: 'Find the issue to merge this into…' });
      var msel = P.select([['', 'Pick an issue']], '');
      mfind.addEventListener('input', async function () {
        var t = mfind.value.trim(); if (t.length < 2) return;
        var res = await P.act.from('issues').select('id,title,status').ilike('title', '%' + t.replace(/[%_]/g, '') + '%').neq('id', iss.id).neq('status', 'Duplicate').limit(15);
        msel.replaceChildren.apply(msel, [h('option', { value: '' }, 'Pick an issue')].concat(asList(res.data).map(function (i) { return h('option', { value: i.id }, i.title + ' (' + i.status + ')'); })));
      });
      merge = h('div', { class: 'card' }, h('strong', null, 'Duplicate of another issue?'), h('p', { class: 'muted' }, 'Merging moves all the feedback here into the other issue and hides this one.'),
        h('div', { class: 'row' }, mfind, msel, h('button', { class: 'danger', onclick: async function () {
          if (!msel.value) { P.toast('Pick the issue to merge into', true); return; }
          if (!confirm('Merge this issue into the one you picked? This cannot be undone.')) return;
          var ok = await P.run(async function () { P.must(await P.act.rpc('merge_issues', { p_from: iss.id, p_into: msel.value })); }, 'Merged');
          if (ok) P.nav('#/inbox');
        } }, 'Merge')));
    }

    P.show(h('div', null,
      h('p', null, ex ? P.link('#/inbox', '← Inbox') : P.link('#/assigned', '← Assigned to me')),
      h('div', { class: 'row' }, h('h2', { style: 'margin:0' }, iss.title), statusPill(iss.status), iss.route ? P.pill(iss.route === 'SSLG' ? 'SSLG' : 'Direct') : null),
      h('p', { class: 'sub' }, 'Opened ' + day(iss.created_at) + ' · ' + feedback.length + (feedback.length === 1 ? ' piece of feedback' : ' pieces of feedback')),
      h('div', { class: 'card' },
        P.field('Title (public if shown)', title),
        h('div', { class: 'row' }, P.field('Topic', icat), P.field('Status', status), P.field('Route', route)),
        h('div', { class: 'row' }, P.field('Person responsible', resp), P.field('Tags', tags)),
        P.field('Background (internal)', summary),
        P.field('Outcome', outcome),
        P.field('Public answer', answer),
        h('div', { class: 'row' }, h('label', { class: 'choice' }, pub, h('span', null, 'Show on the public "Issues and answers" page' + (ex ? '' : ' (ExCo decides)')))),
        h('div', { class: 'row' }, save)),
      h('h3', null, 'Feedback behind this issue'),
      feedback.length ? feedback.map(function (f) {
        return h('div', { class: 'card' },
          h('div', { class: 'row' }, P.pill(f.category), P.pill(PRIVACY_LABEL[f.privacy]), f.wants_sslg ? P.pill('Wants SSLG', 'warn') : null, h('span', { class: 'sub' }, day(f.created_at) + ' · ' + f.source)),
          h('p', null, f.message),
          h('p', { class: 'sub' }, 'From: ' + f.who + (f.contact ? ' · Contact: ' + f.contact : '')));
      }) : h('p', { class: 'muted' }, 'No feedback is linked yet.'),
      h('h3', null, 'Timeline'),
      h('div', { class: 'card' }, P.field('Add', nKind), nBody,
        h('div', { class: 'row' }, h('label', { class: 'choice' }, nVis, h('span', null, 'People who raised this can see this update')), addNote)),
      notes.length ? notes.map(function (n) {
        return h('div', { class: 'note' }, h('div', { class: 'sub' }, day(n.created_at) + ' · ' + n.author_email + ' · ' + n.kind + (n.visible_to_submitters ? ' · visible to submitters' : '')), h('div', null, n.body));
      }) : h('p', { class: 'muted' }, 'No notes yet.'),
      merge));
  } });
})();
