// LKCMedSoc Policy: the screens. Documents, one document, proposing a change, proposals and their votes, and the changelog.
// Everything goes through the policy_* functions in sql/policy.sql, which check who is asking. Only ExCo can use this app.
(function () {
  'use strict';
  var P = window.P, h = P.h, L = P.L;
  var TIER = { constitution: 'Constitution', bylaw: 'Bylaws', guide: 'Guides', external: 'NTU and School rules' };
  var TIER_ONE = { constitution: 'Constitution', bylaw: 'Bylaw', guide: 'Guide', external: 'NTU or School rule' };
  var TIER_NOTE = {
    constitution: 'Changed only by two-thirds of a General Meeting, then SAO. The result is recorded here.',
    bylaw: 'Binding. ExCo votes: a majority of the seats approves. Published within 7 days; a General Meeting can annul.',
    guide: 'Advice. The owning officer approves.',
    external: 'Set by NTU, SAO or the School. Linked, not amended here.'
  };
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  function rpc(name, args) { return P.act.rpc(name, args || {}).then(P.must); }
  // For functions that return nothing: resolve to true so P.run reports success.
  function rpcv(name, args) { return rpc(name, args).then(function () { return true; }); }
  function longDate(s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? (+m[3]) + ' ' + MONTHS[+m[2] - 1] + ' ' + m[1] : ''; }
  function when(s) { return s ? longDate(String(s).slice(0, 10)) : ''; }
  function aNo(n) { return 'A-' + String(n).padStart(3, '0'); }
  function docPill(d) { return d.status === 'in_force' ? P.pill('In force · version ' + d.version, 'dark') : P.pill('Draft proposal', 'warn'); }
  function amPill(s) {
    var label = { proposed: 'Voting', approved: 'Approved, not yet in force', rejected: 'Rejected', withdrawn: 'Withdrawn', in_force: 'In force' }[s] || s;
    return P.pill(label, { proposed: 'warn', approved: 'ok', rejected: 'bad', withdrawn: '', in_force: 'dark' }[s]);
  }
  function siteUrl(path) { return String(P.cfg.SITE_URL || '').replace(/\/$/, '') + path; }

  // ---------- the rich-text editor (Toast UI, the same one the Gazette uses) ----------
  function tui() { return Promise.resolve(window.toastuiReady).catch(function () { /* handled by the caller */ }).then(function () { return window.toastui && window.toastui.Editor; }); }
  function viewer(md) {
    var box = h('div', { class: 'md' });
    tui().then(function (T) { if (T && T.factory) T.factory({ el: box, viewer: true, initialValue: md || '' }); else box.textContent = md || ''; });
    return box;
  }
  function editor(box, md, height) {
    return tui().then(function (T) {
      if (!T) { box.replaceChildren(h('p', { class: 'pill bad' }, 'The text editor could not load. Check your connection and refresh the page.')); return null; }
      return new T({ el: box, height: height || '300px', initialEditType: 'wysiwyg', hideModeSwitch: true, usageStatistics: false, initialValue: md || '',
        toolbarItems: [['heading', 'bold', 'italic'], ['ul', 'ol', 'table'], ['hr', 'quote'], ['link']] });
    });
  }
  // A comparison of two texts, with deleted words struck through and new words underlined.
  function diffBox(a, b) {
    var out = h('div', { class: 'diff' });
    L.wordDiff(a, b).forEach(function (p) { out.appendChild(p.t === 'same' ? document.createTextNode(p.s) : h(p.t === 'ins' ? 'ins' : 'del', null, p.s)); });
    return out;
  }

  // ---------- Documents ----------
  P.route('/', { nav: 'docs', exco: true, fn: async function () {
    P.loading();
    var docs = await rpc('policy_all');
    var parts = [h('div', { class: 'hero' }, h('div', { class: 'muted' }, 'LKCMedSoc'), h('h1', null, 'Policy'),
      h('p', { class: 'muted' }, 'The Constitution, Bylaws and Guides. A draft can be edited directly; once adopted, a document only changes through a proposal that ExCo approves. Every change is recorded.'))];
    Object.keys(TIER).forEach(function (t) {
      var list = docs.filter(function (d) { return d.tier === t; });
      parts.push(h('h3', null, TIER[t]), h('p', { class: 'sub' }, TIER_NOTE[t]));
      if (!list.length) { parts.push(h('p', { class: 'muted' }, t === 'external' ? 'None listed yet.' : 'Nothing here yet.')); return; }
      parts.push(h('div', { class: 'list' }, list.map(function (d) {
        var pub = h('input', { type: 'checkbox', checked: d.published, onchange: function (ev) {
          P.run(function () { return rpcv('policy_set_published', { p_slug: d.slug, p_on: ev.target.checked }); }, ev.target.checked ? 'Now shown on the website' : 'Hidden from the website');
        } });
        return h('div', { class: 'item' },
          h('a', { class: 't', href: '#/d/' + d.slug, style: 'text-decoration:none' }, d.title),
          h('div', { class: 's' }, d.summary),
          h('div', { class: 'meta' }, docPill(d), P.pill(d.clauses + ' clauses'), d.open_amendments ? P.pill(d.open_amendments + ' open proposal' + (d.open_amendments > 1 ? 's' : ''), 'warn') : null,
            h('label', { class: 'chk', style: 'margin:0 0 0 auto' }, pub, 'Shown on the website')));
      })));
    });
    P.show(h('div', null, parts));
  } });

  // ---------- One document ----------
  P.route('/d/:slug', { nav: 'docs', exco: true, fn: async function (p, q) {
    P.loading();
    var w = await rpc('policy_working', { p_slug: p.slug });
    if (!w) { P.show(h('p', { class: 'muted' }, 'That document does not exist.')); return; }
    var d = w.doc, draft = d.status === 'draft';
    var head = [h('p', { class: 'sub' }, h('a', { href: '#/' }, '← Documents')), h('h2', null, d.title), h('p', { class: 'muted' }, d.summary),
      h('div', { class: 'row' }, P.pill(TIER_ONE[d.tier]), docPill(d), d.effective_on ? P.pill('effective ' + longDate(d.effective_on)) : null, P.pill('changed by ' + d.owner),
        d.published ? P.pill('shown on the website', 'ok') : P.pill('not on the website yet'))];
    var actions = h('div', { class: 'row' },
      draft ? h('a', { class: 'btn-link solid', href: '#/propose/' + d.slug + '?adopt=1' }, 'Propose adoption') : h('a', { class: 'btn-link solid', href: '#/propose/' + d.slug }, 'Propose a change'),
      h('a', { class: 'btn-link', href: siteUrl('/policy/' + d.slug + '/latest.pdf'), target: '_blank', rel: 'noopener' }, draft ? 'Draft PDF' : 'Latest PDF'),
      h('a', { class: 'btn-link', href: siteUrl('/policy/' + d.slug), target: '_blank', rel: 'noopener' }, 'View on the website'));
    var note = draft
      ? h('div', { class: 'card' }, h('b', null, 'This is a draft. '), 'You can edit any clause directly. Once ExCo adopts it, every change has to be proposed, voted on and recorded.')
      : h('div', { class: 'card' }, h('b', null, 'This document is in force. '), 'To change a clause, use “Propose a change”. The text only changes when the proposal is approved and published.');
    var cards = w.clauses.map(function (c) { return clauseCard(c, d, draft); });
    var parts = [head, actions, note, h('div', { class: 'stack' }, cards)];
    if (draft) parts.push(addClauseForm(d));
    P.show(h('div', null, parts));
    // Arriving from the website's "Edit" link on one provision: go straight to it (edit a draft in place; propose a change to a document in force).
    if (q && q.edit) {
      var card = document.getElementById(q.edit);
      if (card) {
        if (!draft) { P.nav('#/propose/' + d.slug + '?ref=' + encodeURIComponent(q.edit)); return; }
        var btn = card.querySelector('button'); if (btn) btn.click();
        // the text viewers above it finish loading a moment later and push the page down: scroll again as they settle
        [0, 400, 1000, 2000].forEach(function (ms) { setTimeout(function () { if (P.current && P.current.path === '/d/' + d.slug) card.scrollIntoView(); }, ms); });
      }
    }
  } });

  function clauseCard(c, d, draft) {
    var box = h('div', { class: 'card clause' + (c.repealed ? ' repealed' : ''), id: c.ref });
    function show() {
      box.replaceChildren(
        h('div', { class: 'row' }, h('span', { class: 'ref' }, c.ref), c.repealed ? P.pill('repealed', 'bad') : null),
        h('h3', { style: 'margin-top:0' }, c.heading), viewer(c.body_md),
        c.repealed ? null : h('div', { class: 'row' },
          draft ? h('button', { class: 'ghost', onclick: edit }, 'Edit') : h('a', { class: 'btn-link', href: '#/propose/' + d.slug + '?ref=' + encodeURIComponent(c.ref) }, 'Propose a change'),
          h('button', { class: 'ghost', onclick: function () { P.copy(siteUrl('/policy/' + d.slug + '#' + c.ref)); } }, 'Copy link')));
    }
    function edit() {
      var title = h('input', { class: 'grow', value: c.heading }), ebox = h('div'), ed = null;
      var save = h('button', { class: 'btn', onclick: async function () {
        if (!ed) return; save.disabled = true;
        var ok = await P.run(function () { return rpcv('policy_draft_save', { p_clause: c.id, p_heading: title.value, p_body: ed.getMarkdown() }); }, 'Saved');
        save.disabled = false; if (ok) P.dispatch();
      } }, 'Save');
      box.replaceChildren(h('div', { class: 'row' }, h('span', { class: 'ref' }, c.ref)), P.field('Heading', title), P.field('Text', ebox), h('div', { class: 'row' }, save, h('button', { class: 'ghost', onclick: show }, 'Cancel')));
      editor(ebox, c.body_md, '320px').then(function (e) { ed = e; });
    }
    show();
    return box;
  }

  function addClauseForm(d) {
    var ref = h('input', { placeholder: 'B-9.6', style: 'width:110px' }), title = h('input', { class: 'grow', placeholder: 'Heading' }), ebox = h('div'), ed = null;
    editor(ebox, '', '220px').then(function (e) { ed = e; });
    return h('div', { class: 'card' }, h('h3', { style: 'margin-top:0' }, 'Add a clause'),
      h('p', { class: 'sub' }, 'The number is permanent: it is never reused, even if the clause is repealed later. Use the form B-9.6 (letter, dash, section, dot, clause).'),
      h('div', { class: 'row' }, P.field('Number', ref), P.field('Heading', title)), P.field('Text', ebox),
      h('div', { class: 'row' }, h('button', { class: 'btn', onclick: async function () {
        if (!ed) return;
        var ok = await P.run(function () { return rpc('policy_draft_add', { p_doc: d.id, p_ref: ref.value, p_heading: title.value, p_body: ed.getMarkdown() }); }, 'Clause added');
        if (ok) P.dispatch();
      } }, 'Add clause')));
  }

  // ---------- Proposing a change (or the adoption of a draft) ----------
  P.route('/propose/:slug', { nav: 'amend', exco: true, fn: async function (p, q) {
    P.loading();
    var w = await rpc('policy_working', { p_slug: p.slug });
    if (!w) { P.show(h('p', { class: 'muted' }, 'That document does not exist.')); return; }
    var d = w.doc, adopt = !!q.adopt, items = [];
    if (adopt && d.status !== 'draft') { P.show(h('p', { class: 'muted' }, 'This document is already in force.')); return; }
    if (!adopt && d.status !== 'in_force') { P.show(h('p', { class: 'muted' }, 'This is a draft: edit it directly, or propose its adoption.')); return; }
    var title = h('input', { class: 'grow', value: adopt ? 'Adopt ' + d.title : '', placeholder: 'One line: what is changing' });
    var reason = h('textarea', { placeholder: 'Why is this needed? This is shown in the public changelog.' });
    var list = h('div', { class: 'stack' });
    var live = w.clauses.filter(function (c) { return !c.repealed; });

    function addItem(kind, ref) {
      var c = live.filter(function (x) { return x.ref === ref; })[0];
      if (kind !== 'add' && items.some(function (i) { return i.ref === ref; })) { P.toast('That clause is already in this proposal', true); return; }
      var it = { kind: kind, ref: ref, ed: null, heading: h('input', { class: 'grow', value: c ? c.heading : '' }), refIn: h('input', { placeholder: 'B-9.6', style: 'width:110px' }) };
      var ebox = h('div'), actionSel = P.select([['edit', 'Change the text'], ['repeal', 'Repeal (remove) this clause']], 'edit', { onchange: function () { it.kind = actionSel.value; ebody.hidden = it.kind === 'repeal'; } });
      var ebody = h('div', null, P.field('Heading', it.heading), P.field('New text', ebox));
      var card = h('div', { class: 'card' },
        h('div', { class: 'row' }, kind === 'add' ? h('span', null, 'New clause ', it.refIn) : h('span', { class: 'ref' }, ref), kind === 'add' ? null : actionSel,
          h('button', { class: 'ghost', style: 'margin-left:auto', onclick: function () { items.splice(items.indexOf(it), 1); card.remove(); } }, 'Remove')),
        ebody);
      it.card = card; items.push(it); list.appendChild(card);
      editor(ebox, c ? c.body_md : '', '300px').then(function (e) { it.ed = e; });
    }
    var pick = P.select([['', 'Choose a clause…']].concat(live.map(function (c) { return [c.ref, c.ref + '  ' + c.heading]; })), '');
    var parts = [h('p', { class: 'sub' }, h('a', { href: '#/d/' + d.slug }, '← ' + d.title)), h('h2', null, adopt ? 'Propose adoption' : 'Propose a change'),
      h('p', { class: 'muted' }, adopt ? 'This brings the whole document into force exactly as it reads now (' + live.length + ' clauses). ' + TIER_NOTE[d.tier]
        : 'Nothing changes until ExCo approves this and it is published. ' + TIER_NOTE[d.tier]),
      P.field('Title', title), P.field('Reason', reason)];
    if (!adopt) {
      parts.push(h('h3', null, 'What changes'), list,
        h('div', { class: 'row' }, pick, h('button', { class: 'ghost', onclick: function () { if (!pick.value) { P.toast('Choose a clause first', true); return; } addItem('edit', pick.value); pick.value = ''; } }, 'Change this clause'),
          h('button', { class: 'ghost', onclick: function () { addItem('add', ''); } }, 'Add a new clause')));
      if (q.ref) addItem('edit', q.ref);
    }
    var send = h('button', { class: 'btn', onclick: async function () {
      var changes = [];
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (it.kind === 'repeal') { changes.push({ ref: it.ref, action: 'repeal' }); continue; }
        if (!it.ed) { P.toast('Wait for the editor to load', true); return; }
        if (it.kind === 'add') { if (!it.refIn.value.trim()) { P.toast('Give each new clause a number', true); return; } changes.push({ ref: it.refIn.value.trim().toUpperCase(), action: 'add', heading: it.heading.value, body_md: it.ed.getMarkdown() }); }
        else changes.push({ ref: it.ref, action: 'edit', heading: it.heading.value, body_md: it.ed.getMarkdown() });
      }
      send.disabled = true;
      var id = await P.run(function () { return rpc('policy_propose', { p_doc: d.id, p_kind: adopt ? 'adopt' : 'change', p_title: title.value, p_reason: reason.value, p_changes: changes, p_name: P.me.name || P.me.email }); }, 'Proposal sent for a vote');
      send.disabled = false; if (id) P.nav('#/a/' + id);
    } }, 'Send for a vote');
    parts.push(h('div', { class: 'sticky' }, send));
    P.show(h('div', null, parts));
  } });

  // ---------- Proposals ----------
  P.route('/a', { nav: 'amend', exco: true, fn: async function (p, q) {
    P.loading();
    var f = q.f || 'open', all = await rpc('policy_amendments');
    var open = all.filter(function (a) { return a.status === 'proposed' || a.status === 'approved'; });
    var shown = f === 'open' ? open : f === 'done' ? all.filter(function (a) { return open.indexOf(a) < 0; }) : all;
    var chips = h('div', { class: 'chips' }, [['open', 'Open (' + open.length + ')'], ['done', 'Decided'], ['all', 'All']].map(function (c) {
      return h('a', { class: 'chip' + (f === c[0] ? ' on' : ''), href: '#/a?f=' + c[0], style: 'text-decoration:none' }, c[1]);
    }));
    var list = shown.length ? h('div', { class: 'list' }, shown.map(function (a) {
      var need = a.tier === 'bylaw' ? 5 : a.tier === 'guide' ? 1 : null;
      return h('a', { class: 'item', href: '#/a/' + a.id },
        h('div', { class: 't' }, aNo(a.number) + '  ' + a.title), h('div', { class: 's' }, a.doc_title + ' · proposed by ' + (a.proposed_by_name || 'someone') + ' on ' + when(a.proposed_at)),
        h('div', { class: 'meta' }, amPill(a.status), P.pill(TIER_ONE[a.tier]), P.pill(a.kind === 'adopt' ? 'adoption' : a.changes + ' clause' + (a.changes === 1 ? '' : 's')),
          a.status === 'proposed' && need ? P.pill(a.votes_for + ' of ' + need + ' votes needed', 'warn') : null));
    })) : h('p', { class: 'muted' }, 'Nothing here.');
    P.show(h('div', null, h('h2', null, 'Proposals'), h('p', { class: 'muted' }, 'Every change to a document in force, and every adoption of a draft, starts here. Open a draft or a clause to propose one.'), chips, list));
  } });

  // ---------- One proposal ----------
  P.route('/a/:id', { nav: 'amend', exco: true, fn: async function (p) {
    P.loading();
    var r = await rpc('policy_amendment', { p_id: p.id });
    if (!r) { P.show(h('p', { class: 'muted' }, 'That proposal does not exist.')); return; }
    var a = r.amendment, d = r.doc, need = r.needed, mine = (r.votes.filter(function (v) { return v.voter === r.me; })[0] || {}).vote;
    function reload() { P.dispatch(); }
    var parts = [h('p', { class: 'sub' }, h('a', { href: '#/a' }, '← Proposals')),
      h('div', { class: 'row' }, h('span', { class: 'ref' }, aNo(a.number)), amPill(a.status), P.pill(TIER_ONE[d.tier]), a.kind === 'adopt' ? P.pill('adoption') : null),
      h('h2', null, a.title),
      h('p', { class: 'muted' }, h('a', { href: '#/d/' + d.slug }, d.title), ' · proposed by ' + (a.proposed_by_name || 'someone') + ' on ' + when(a.proposed_at)),
      h('div', { class: 'card' }, h('b', null, 'Why: '), a.reason)];

    // what changes
    if (a.kind === 'adopt') parts.push(h('div', { class: 'card' }, 'Adopting brings the whole document into force as it now reads. ', h('a', { href: siteUrl('/policy/' + d.slug), target: '_blank', rel: 'noopener' }, 'Read it on the website'), '.'));
    r.changes.forEach(function (c) {
      var body = c.action === 'edit' ? [h('h3', { style: 'margin-top:8px' }, 'Heading'), diffBox(c.old_heading, c.new_heading), h('h3', null, 'Text'), diffBox(c.old_body_md, c.new_body_md),
          h('details', null, h('summary', null, 'Show the new text as it will read'), viewer(c.new_body_md))]
        : c.action === 'add' ? [h('h3', { style: 'margin-top:8px' }, c.new_heading), viewer(c.new_body_md)]
        : [h('p', { class: 'muted' }, 'This clause is removed. Its number is kept and never reused.'), h('div', { class: 'diff' }, h('del', null, c.old_heading + '\n\n' + c.old_body_md))];
      parts.push(h('div', { class: 'card' }, h('div', { class: 'row' }, h('span', { class: 'ref' }, c.ref), P.pill({ edit: 'Changed', add: 'New clause', repeal: 'Repealed' }[c.action], c.action === 'repeal' ? 'bad' : '')), body));
    });

    // the decision
    var dec = h('div', { class: 'card' }, h('h3', { style: 'margin-top:0' }, 'Decision'));
    if (d.tier === 'constitution') {
      dec.appendChild(h('p', { class: 'muted' }, TIER_NOTE.constitution));
      if (a.status === 'proposed') {
        var md = h('input', { type: 'date' }), mf = h('input', { type: 'number', min: 0, style: 'width:90px' }), ma = h('input', { type: 'number', min: 0, style: 'width:90px' }), ms = h('input', { type: 'checkbox' });
        dec.appendChild(h('div', { class: 'row' }, P.field('Meeting date', md), P.field('For', mf), P.field('Against', ma), h('label', { class: 'chk' }, ms, 'SAO has confirmed')));
        dec.appendChild(h('button', { class: 'btn', onclick: async function () {
          if (!md.value || mf.value === '') { P.toast('Enter the meeting date and the votes', true); return; }
          var out = await P.run(function () { return rpc('policy_record_meeting', { p_id: a.id, p_date: md.value, p_for: +mf.value, p_against: +(ma.value || 0), p_sao: ms.checked }); });
          if (out) { P.toast('Recorded: ' + out); reload(); }
        } }, 'Record the result'));
      } else if (a.meeting_date) dec.appendChild(h('p', null, 'General Meeting on ' + longDate(a.meeting_date) + ': ' + a.meeting_for + ' for, ' + a.meeting_against + ' against' + (a.sao_confirmed ? '; confirmed by SAO.' : '; not confirmed by SAO.')));
    } else {
      var yes = r.votes.filter(function (v) { return v.vote === 'for'; }).length, no = r.votes.filter(function (v) { return v.vote === 'against'; }).length;
      dec.appendChild(h('p', null, h('b', null, yes + ' for'), ', ' + no + ' against' + (' · needs ' + need + ' for' + (d.tier === 'bylaw' ? ' (a majority of ' + r.seats + ' seats)' : ''))));
      dec.appendChild(h('div', { class: 'bar' + (no > r.seats - need ? ' over' : '') }, h('i', { style: 'width:' + Math.min(100, Math.round(yes / need * 100)) + '%' })));
      if (a.status === 'proposed') {
        var note = h('input', { class: 'grow', placeholder: 'Optional: a line with your vote' });
        var cast = function (v, label) { return h('button', { class: mine === v ? 'btn' : 'ghost', onclick: async function () {
          var ok = await P.run(function () { return rpcv('policy_vote', { p_id: a.id, p_vote: v, p_comment: note.value, p_name: P.me.name || P.me.email }); }, 'Vote recorded: ' + label);
          if (ok) reload();
        } }, label); };
        dec.appendChild(h('div', { class: 'row' }, cast('for', 'For'), cast('against', 'Against'), cast('abstain', 'Abstain'), cast('recused', 'I step out')));
        dec.appendChild(h('div', { class: 'row' }, note));
        dec.appendChild(h('p', { class: 'sub' }, '“I step out” is for an officer with an interest in the decision. It is recorded and does not count for or against.'));
      }
      if (r.votes.length) dec.appendChild(h('ul', { class: 'votes' }, r.votes.map(function (v) {
        return h('li', null, h('b', null, v.name || 'ExCo member'), ' ', P.pill({ for: 'for', against: 'against', abstain: 'abstained', recused: 'stepped out' }[v.vote], v.vote === 'for' ? 'ok' : v.vote === 'against' ? 'bad' : ''), v.comment ? ' ' + v.comment : '');
      })));
      if (a.status === 'proposed') dec.appendChild(h('div', { class: 'row' }, h('button', { class: 'btn', onclick: async function () {
        var out = await P.run(function () { return rpc('policy_close_vote', { p_id: a.id }); });
        if (out) { P.toast('Decided: ' + out); reload(); }
      } }, 'Close the vote')));
    }
    if (a.status === 'approved') {
      var eff = h('input', { type: 'date', value: new Date(Date.now() + 8 * 36e5).toISOString().slice(0, 10) });
      dec.appendChild(h('div', { class: 'card', style: 'background:#fff' }, h('b', null, 'Approved on ' + when(a.decided_at) + '. '),
        a.publish_by ? 'Bylaws are published within 7 days: by ' + longDate(a.publish_by) + '. ' : '',
        h('div', { class: 'row' }, P.field('Takes effect on', eff), h('button', { class: 'btn', onclick: async function () {
          var v = await P.run(function () { return rpc('policy_publish', { p_id: a.id, p_effective: eff.value }); });
          if (v) { P.toast('In force as version ' + v); reload(); }
        } }, 'Bring into force'))));
    }
    if (a.status === 'in_force') dec.appendChild(h('p', null, 'In force from ' + longDate(a.effective_on) + ' as version ' + a.version_after + '. ', h('a', { href: siteUrl('/policy/' + d.slug + '?v=' + a.version_after), target: '_blank', rel: 'noopener' }, 'See it on the website'), ' · ', h('a', { href: siteUrl('/policy/' + d.slug + '/latest.pdf' + (a.version_after ? '?v=' + a.version_after : '')), target: '_blank', rel: 'noopener' }, 'PDF')));
    if (a.status === 'proposed') dec.appendChild(h('div', { class: 'row' }, h('button', { class: 'danger', onclick: async function () {
      if (!confirm('Withdraw this proposal?')) return;
      var ok = await P.run(function () { return rpcv('policy_withdraw', { p_id: a.id }); }, 'Withdrawn'); if (ok) reload();
    } }, 'Withdraw this proposal')));
    parts.push(dec);

    // the discussion
    var thread = h('div', { class: 'card' }, h('h3', { style: 'margin-top:0' }, 'Discussion'));
    if (!r.comments.length) thread.appendChild(h('p', { class: 'muted' }, 'No comments yet.'));
    r.comments.forEach(function (c) { thread.appendChild(h('div', { class: 'comment' }, h('b', null, c.name || 'ExCo member'), h('span', { class: 'sub' }, '  ' + when(c.at)), h('div', null, c.body))); });
    var cm = h('textarea', { placeholder: 'Add a comment', style: 'min-height:60px' });
    thread.appendChild(cm);
    thread.appendChild(h('div', { class: 'row' }, h('button', { class: 'ghost', onclick: async function () {
      if (!cm.value.trim()) return;
      var ok = await P.run(function () { return rpcv('policy_comment', { p_id: a.id, p_body: cm.value, p_name: P.me.name || P.me.email }); }); if (ok) reload();
    } }, 'Comment')));
    parts.push(thread);
    P.show(h('div', null, parts));
  } });

  // ---------- Changelog ----------
  P.route('/log', { nav: 'log', exco: true, fn: async function () {
    P.loading();
    var log = await rpc('policy_changelog');
    P.show(h('div', null, h('h2', null, 'Changelog'), h('p', { class: 'muted' }, 'Everything that has come into force, as the public sees it on the website. ', h('a', { href: siteUrl('/policy/changelog'), target: '_blank', rel: 'noopener' }, 'Open the public page')),
      log.length ? h('div', { class: 'list' }, log.map(function (e) {
        var how = e.tier === 'constitution' && e.meeting_date ? 'General Meeting ' + e.meeting_for + ' for, ' + e.meeting_against + ' against' : e.votes ? 'ExCo vote ' + e.votes['for'] + ' for, ' + e.votes.against + ' against' : '';
        return h('div', { class: 'item' }, h('div', { class: 't' }, aNo(e.number) + '  ' + e.title), h('div', { class: 's' }, e.doc_title + ', version ' + e.version + ' · from ' + longDate(e.effective_on)),
          h('div', { class: 'meta' }, P.pill(TIER_ONE[e.tier]), how ? P.pill(how) : null, e.changes.map(function (c) { return P.pill(c.ref + ' ' + c.action); })));
      })) : h('p', { class: 'muted' }, 'Nothing has come into force yet.')));
  } });
})();
