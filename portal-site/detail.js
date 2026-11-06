// One activity: header, tabs, overview (approvals and actions), paperwork, publicity and risks.
(function () {
  'use strict';
  var P = window.P, h = P.h, L = P.L;
  P.tabs = {};   // tab name -> { label, show(ctx) }
  var ORDER = ['overview', 'paperwork', 'budget', 'spending', 'risks', 'page', 'day', 'publicity'];
  var STEP_LABEL = { COMMITTEE_HEAD: 'Committee head', EXCO_ATTACHE: 'ExCo attaché', SLS: 'SLS', SAO: 'SAO officer' };
  var PHASES = [['start_of_ay', 'Start of the year'], ['proposal', 'Proposal'], ['after_approval', 'After approval'],
                ['after_event', 'After the event'], ['accounts', 'Accounts'], ['archive', 'Archive']];
  var TRACKS = { SAO_LARGE: 'Large scale', SAO_SMALL: 'Small scale', NO_SAO: 'No SAO approval' };
  P.TRACKS = TRACKS;

  async function load(id) {
    var a = P.must(await P.act.from('activities').select('*').eq('id', id).maybeSingle());
    if (!a) return null;
    var l = P.must(await P.act.from('activity_list').select('*').eq('id', id).maybeSingle());
    return { id: id, a: a, l: l || {} };
  }

  async function page(params) {
    P.loading();
    var ctx = await load(params.id);
    if (!ctx) { P.show(h('div', { class: 'card' }, h('h2', null, 'Not found'), h('p', { class: 'muted' }, 'This activity does not exist, or you cannot see it.'), P.link('#/activities', 'Back to activities'))); return; }
    var tab = P.tabs[params.tab] ? params.tab : 'overview';
    var a = ctx.a;
    ctx.exco = P.exco;
    ctx.editable = P.exco || a.status === 'Draft' || a.status === 'Changes requested';
    ctx.spendable = P.exco || a.status === 'Approved' || a.status === 'Completed';
    ctx.reload = function () { page(params); };
    var body = h('div', null, h('p', { class: 'muted' }, 'Loading…'));
    var tabs = h('div', { class: 'subtabs' }, ORDER.filter(function (t) { return P.tabs[t]; }).map(function (t) {
      return h('a', { class: 'chip' + (t === tab ? ' on' : ''), href: '#/a/' + params.id + '/' + t, style: 'text-decoration:none' }, P.tabs[t].label);
    }));
    P.show(h('div', { class: 'stack' },
      h('div', null, P.link('#/activities', '← Activities')),
      h('div', null,
        h('h2', { style: 'margin-bottom:4px' }, a.title),
        h('div', { class: 'meta', style: 'display:flex;gap:6px;flex-wrap:wrap;align-items:center' },
          P.statusPill(a.status), P.pill(a.kind), ctx.l.track ? P.pill(TRACKS[ctx.l.track] || ctx.l.track) : null,
          h('span', { class: 'sub' }, (ctx.l.body || '') + (ctx.l.parent_committee ? ' · ' + ctx.l.parent_committee : '') + ' · ' + a.ay))),
      tabs, body));
    try { body.replaceChildren(await P.tabs[tab].show(ctx)); }
    catch (e) { body.replaceChildren(h('p', { class: 'pill bad' }, P.friendly(e))); }
  }

  // ---------- overview ----------
  P.tabs.overview = { label: 'Overview', show: async function (ctx) {
    var a = ctx.a, id = ctx.id;
    var approvals = P.must(await P.act.from('approvals').select('*').eq('activity_id', id).order('ord'));
    var nextOpen = approvals.filter(function (s) { return s.status === 'Pending'; })[0];
    var earlierOpen = nextOpen && approvals.some(function (s) { return s.ord < nextOpen.ord && s.status !== 'Approved'; });
    var canDecide = false;
    if (a.status === 'Submitted' && nextOpen && !earlierOpen) {
      canDecide = !!P.must(await P.act.rpc('can_decide_step', { aid: id, p_step: nextOpen.step }));
    }
    var blockers = h('div', null);
    var parts = [];

    // checklist: where this event is, step by step
    try {
      var came = 0, wroteUp = false;
      try { var cn = P.must(await P.act.from('attendance_counts').select('*').eq('activity_id', id).maybeSingle()); came = (cn && cn.came) || 0; } catch (e) { /* not available */ }
      try { var ps = P.must(await P.act.from('posts_flat').select('published_at').eq('activity_id', id)); wroteUp = ps.some(function (x) { return !!x.published_at; }); } catch (e) { /* not available */ }
      var step = function (k) { return approvals.filter(function (s) { return s.step === k; })[0]; };
      var tab = function (t) { return '#/a/' + id + '/' + t; };
      var stat = function (s) { return !s ? null : s.status === 'Approved' ? 'done' : (s.status === 'Changes requested' || s.status === 'Rejected') ? 'bad' : 'wait'; };
      var outside = approvals.filter(function (s) { return s.step === 'SLS' || s.step === 'SAO'; });
      var outsideState = !outside.length ? 'wait' : outside.some(function (s) { return s.status === 'Changes requested' || s.status === 'Rejected'; }) ? 'bad' : outside.every(function (s) { return s.status === 'Approved'; }) ? 'done' : 'wait';
      var submitted = ['Submitted', 'Approved', 'Completed', 'Rejected'].indexOf(a.status) >= 0;
      var items = [
        ['Fill in the details', 'done', null, null],
        ['Submit for approval', submitted ? 'done' : a.status === 'Changes requested' ? 'bad' : 'wait', a.status === 'Changes requested' ? 'Changes were requested. Fix them and submit again.' : null, tab('overview')],
        ['Committee head approves', stat(step('COMMITTEE_HEAD')) || 'wait', step('COMMITTEE_HEAD') && step('COMMITTEE_HEAD').note, null],
        ['ExCo attaché approves', stat(step('EXCO_ATTACHE')) || 'wait', step('EXCO_ATTACHE') && step('EXCO_ATTACHE').note, null],
        ['SLS' + (step('SAO') ? ' and SAO' : '') + ' approve (ExCo records this)', outsideState, null, null],
        ['Set up the event page and RSVP', a.visibility !== 'Hidden' && a.public_summary ? 'done' : 'wait', null, tab('page')],
        ['Event day: check people in', came > 0 ? 'done' : 'wait', came > 0 ? came + ' checked in' : null, tab('day')],
        ['Mark the event completed', a.status === 'Completed' ? 'done' : 'wait', null, tab('overview')],
        ['Publish the write-up', wroteUp ? 'done' : 'wait', null, '#/posts'],
        ['Add the photo album link', a.photos_url ? 'done' : 'wait', null, tab('page')]
      ];
      if (a.status === 'Cancelled' || a.status === 'Rejected') items.forEach(function (it) { if (it[1] === 'wait') it[1] = 'off'; });
      var now = -1;
      items.forEach(function (it, i) { if (now < 0 && (it[1] === 'wait' || it[1] === 'bad')) now = i; });
      parts.push(h('div', { class: 'card stack', id: 'checklist' },
        h('h3', { style: 'margin-top:0' }, 'Checklist'),
        items.map(function (it, i) {
          var state = it[1] === 'wait' && i === now ? 'now' : it[1];
          var mark = { done: '✓', now: '●', bad: '✗', wait: '○', off: '–' }[state];
          return h('div', { class: 'row', style: 'justify-content:space-between;align-items:flex-start' },
            h('div', null, h('b', null, mark + ' ' + it[0]), it[2] ? h('div', { class: 'sub' }, it[2]) : null),
            state === 'now' || state === 'bad' ? (it[3] ? P.link(it[3], 'Open', 'ghost') : P.pill(state === 'bad' ? 'Needs attention' : 'Next', state === 'bad' ? 'bad' : 'dark'))
              : P.pill({ done: 'Done', wait: 'Later', off: 'Stopped' }[state], state === 'done' ? 'ok' : ''));
        })));
    } catch (e) { /* the checklist is a convenience; never block the page */ }

    // facts
    parts.push(h('div', { class: 'card' }, h('dl', { class: 'kv' },
      h('dt', null, 'When'), h('dd', null, L.whenText(a)),
      h('dt', null, 'Venue'), h('dd', null, a.venue || '–'),
      h('dt', null, 'Scale'), h('dd', null, a.scale + (a.expected_pax ? ' · ' + a.expected_pax + ' pax' : '')),
      h('dt', null, 'Funding'), h('dd', null, (a.funding_pots || []).join(', ') || 'None planned'),
      h('dt', null, 'SPHERE ID'), h('dd', null, a.sphere_event_id || '–'),
      h('dt', null, 'Annual Workplan'), h('dd', null, a.in_annual_workplan ? 'In the approved workplan' : 'Not marked as in the workplan'),
      h('dt', null, 'Paperwork'), h('dd', null, (ctx.l.docs_done || 0) + ' of ' + (ctx.l.docs_total || 0) + ' done' + (Number(ctx.l.docs_overdue) ? ', ' + ctx.l.docs_overdue + ' overdue' : ''))),
      a.description ? h('p', { style: 'white-space:pre-wrap' }, a.description) : null));

    // actions
    var actions = [];
    function act(label, cls, fn) { actions.push(h('button', { class: cls, onclick: fn }, label)); }
    if (a.status === 'Draft' || a.status === 'Changes requested') {
      act('Submit for approval', 'btn', async function () {
        blockers.replaceChildren();
        try {
          var r = P.must(await P.act.rpc('submit_activity', { aid: id }));
          P.toast('Submitted (' + (P.TRACKS[r.track] || r.track) + ')'); ctx.reload();
        } catch (e) {
          var msg = P.friendly(e).replace(/^Cannot submit yet:\s*/, '');
          blockers.replaceChildren(h('div', { class: 'card', 'data-testid': 'blockers' }, h('b', null, 'Cannot submit yet'),
            h('ul', null, msg.split(/\.\s+/).filter(Boolean).map(function (m) { return h('li', null, m.replace(/\.?$/, '.')); }))));
        }
      });
    }
    if (a.status === 'Approved') {
      act('Mark as completed', 'ghost', async function () {
        if (await P.run(async function () { P.must(await P.act.rpc('mark_completed', { aid: id })); }, 'Marked completed')) ctx.reload();
      });
    }
    if (a.status !== 'Cancelled' && a.status !== 'Completed') {
      act('Cancel activity', 'danger', async function () {
        if (!confirm('Cancel this activity?')) return;
        if (await P.run(async function () { P.must(await P.act.rpc('cancel_activity', { aid: id })); }, 'Cancelled')) ctx.reload();
      });
    }
    parts.push(h('div', { class: 'row' }, actions), blockers);

    // approvals
    if (approvals.length) {
      var dec = h('select', { id: 'dec' }, ['Approved', 'Changes requested', 'Rejected'].map(function (d) { return h('option', { value: d }, d); }));
      var note = h('textarea', { id: 'dec-note', placeholder: 'Note (required unless approving)' });
      parts.push(h('div', { class: 'card stack' },
        h('h3', { style: 'margin-top:0' }, 'Approval chain'),
        approvals.map(function (s) {
          return h('div', { class: 'row', style: 'justify-content:space-between' },
            h('div', null, h('b', null, STEP_LABEL[s.step] || s.step), s.decided_by ? h('div', { class: 'sub' }, s.decided_by + (s.note ? ': ' + s.note : '')) : null),
            P.pill(s.status, s.status === 'Approved' ? 'ok' : s.status === 'Pending' ? '' : 'bad'));
        }),
        canDecide ? h('div', { class: 'stack' }, h('div', null, 'Your decision on the ', h('b', null, STEP_LABEL[nextOpen.step]), ' step'),
          dec, note,
          h('div', { class: 'row' }, h('button', { class: 'btn', id: 'dec-go', onclick: async function () {
            if (await P.run(async function () {
              P.must(await P.act.rpc('decide_step', { aid: id, p_step: nextOpen.step, decision: dec.value, p_note: P.blank(note.value) }));
            }, 'Recorded')) ctx.reload();
          } }, 'Record decision'))) : null,
        a.status === 'Submitted' && nextOpen && !canDecide ? h('div', { class: 'muted' }, 'Waiting for the ' + STEP_LABEL[nextOpen.step] + '.') : null));
    }

    // ExCo tools
    if (P.exco) {
      var st = P.select(['Draft', 'Submitted', 'Changes requested', 'Approved', 'Rejected', 'Completed', 'Cancelled'], a.status, { id: 'ov-status' });
      var why = h('input', { id: 'ov-why', placeholder: 'Reason (required)', class: 'grow' });
      var unwhy = h('input', { id: 'ov-unwhy', placeholder: 'Reason to unlock the accounts', class: 'grow' });
      parts.push(h('details', { class: 'card' }, h('summary', null, 'ExCo tools'),
        h('div', { class: 'row' }, st, why, h('button', { class: 'ghost', onclick: async function () {
          if (await P.run(async function () { P.must(await P.act.rpc('exco_set_status', { aid: id, new_status: st.value, reason: why.value })); }, 'Status changed')) ctx.reload();
        } }, 'Set status')),
        h('div', { class: 'row' }, unwhy, h('button', { class: 'ghost', onclick: async function () {
          if (await P.run(async function () { P.must(await P.act.rpc('unlock_accounts', { aid: id, reason: unwhy.value })); }, 'Accounts unlocked')) ctx.reload();
        } }, 'Unlock accounts'))));
    }

    // edit
    if (ctx.editable) {
      var pots = P.must(await P.act.from('pots').select('*').order('ord'));
      var termYears = (P.exco || (P.me && P.me.is_admin)) ? await P.years() : null;   // only ExCo can move an activity to another term
      parts.push(h('details', { class: 'card', id: 'edit-box' }, h('summary', null, 'Edit details'),
        P.activityForm(a, { pots: pots, ays: termYears, ayHint: 'Moves the activity and its write-ups to another term. Budgets and funding applications stay with the year they were made in.', saveLabel: 'Save changes', save: async function (v) {
          var r = await P.run(async function () {
            var rows = P.must(await P.act.from('activities').update(v).eq('id', id).select('id'));
            if (!rows.length) throw new Error("You don't have permission for that, or it is locked at this stage.");
          }, 'Saved');
          if (r) ctx.reload();
        } })));
    }
    return h('div', { class: 'stack' }, parts);
  } };

  // ---------- paperwork ----------
  P.tabs.paperwork = { label: 'Paperwork', show: async function (ctx) {
    var id = ctx.id, today = L.sgToday();
    var items = P.must(await P.act.from('checklist_items').select('*').eq('activity_id', id));
    var types = P.must(await P.act.from('doc_types').select('*').order('ord'));
    var byCode = {}; types.forEach(function (t) { byCode[t.code] = t; });
    items.sort(function (x, y) { return byCode[x.doc_code].ord - byCode[y.doc_code].ord; });
    function save(it, patch) {
      return P.run(async function () {
        var rows = P.must(await P.act.from('checklist_items').update(patch).eq('activity_id', id).eq('doc_code', it.doc_code).select('doc_code'));
        if (!rows.length) throw new Error("You don't have permission for that, or it is locked at this stage.");
      }, 'Saved');
    }
    function row(it) {
      var t = byCode[it.doc_code], late = it.due_date && it.due_date < today && (it.status === 'Not started' || it.status === 'Drafting');
      var status = P.select(['Not started', 'Drafting', 'Submitted', 'Done'], it.status, { onchange: function () { save(it, { status: status.value }).then(function (ok) { if (ok) ctx.reload(); }); } });
      var url = h('input', { type: 'url', placeholder: 'Link to your copy', value: it.doc_url || '', class: 'grow', onchange: function () { save(it, { doc_url: P.blank(url.value) }); } });
      var dates = [['Draft', it.draft_due], ['ExCo', it.exco_due], ['SLS', it.sls_due], ['SAO', it.sao_due]].filter(function (d) { return d[1]; })
        .map(function (d) { return d[0] + ' ' + L.fmtDate(d[1]); }).join(' · ');
      return h('div', { class: 'item', 'data-doc': it.doc_code },
        h('div', { class: 'row', style: 'justify-content:space-between;margin:0' },
          h('div', null, h('span', { class: 't' }, t.code.replace(/_/g, ' ') + ' · ' + t.title), t.optional ? h('span', { class: 'sub' }, ' (optional)') : null),
          late ? P.pill('Overdue', 'bad') : null),
        h('div', { class: 's' }, (it.due_date ? 'Due ' + L.fmtDate(it.due_date) : 'No due date yet') + (t.submit_to ? ' · to ' + t.submit_to : '')),
        dates ? h('div', { class: 'sub' }, dates) : null,
        h('div', { class: 'row' }, status, t.template_url ? h('a', { href: t.template_url, target: '_blank', rel: 'noopener' }, t.generated_on_site ? 'Template' : 'Open form / template') : null),
        h('div', { class: 'row' }, url));
    }
    var out = [];
    PHASES.forEach(function (ph) {
      var rows = items.filter(function (it) { return byCode[it.doc_code].phase === ph[0]; });
      if (rows.length) out.push(h('h3', null, ph[1]), h('div', { class: 'list' }, rows.map(row)));
    });
    return h('div', null, items.length ? out : h('p', { class: 'muted' }, 'The checklist appears once the activity has a date.'),
      h('p', { class: 'muted' }, 'Due dates are worked out from the event date, and move if you change it.'));
  } };

  // ---------- publicity ----------
  P.tabs.publicity = { label: 'Publicity', show: async function (ctx) {
    var id = ctx.id;
    var items = P.must(await P.act.from('publicity_items').select('*').eq('activity_id', id));
    var chans = P.must(await P.act.from('publicity_channels').select('*').order('ord'));
    var by = {}; chans.forEach(function (c) { by[c.name] = c; });
    items.sort(function (x, y) { return (by[x.channel] || {}).ord - (by[y.channel] || {}).ord; });
    function save(it, patch) {
      return P.run(async function () {
        var rows = P.must(await P.act.from('publicity_items').update(patch).eq('activity_id', id).eq('channel', it.channel).select('channel'));
        if (!rows.length) throw new Error("You don't have permission for that.");
      }, 'Saved');
    }
    var done = items.filter(function (i) { return i.status === 'Done' || i.status === 'Not needed'; }).length;
    return h('div', { class: 'stack' },
      h('div', { class: 'muted' }, done + ' of ' + items.length + ' channels sorted. The Publicity Request Form itself is on the Paperwork tab.'),
      items.length ? h('div', { class: 'list' }, items.map(function (it) {
        var c = by[it.channel] || {};
        var st = P.select(['To do', 'Requested', 'Done', 'Not needed'], it.status, { onchange: function () { save(it, { status: st.value }); } });
        var due = h('input', { type: 'date', value: it.due_date || '', onchange: function () { save(it, { due_date: P.blank(due.value) }); } });
        var link = h('input', { type: 'url', placeholder: 'Link (post, poster, request)', value: it.link || '', class: 'grow', onchange: function () { save(it, { link: P.blank(link.value) }); } });
        var note = h('input', { placeholder: 'Note', value: it.note || '', class: 'grow', onchange: function () { save(it, { note: P.blank(note.value) }); } });
        return h('div', { class: 'item', 'data-channel': it.channel },
          h('div', { class: 't' }, it.channel), h('div', { class: 's' }, c.how || ''),
          c.applies_to && c.applies_to !== 'All events' ? h('div', null, P.pill(c.applies_to, 'warn')) : null,
          h('div', { class: 'row' }, st, due), h('div', { class: 'row' }, link), h('div', { class: 'row' }, note));
      })) : h('p', { class: 'muted' }, 'No publicity channels are set up for this kind of activity.'));
  } };

  // ---------- risks (RAMS) ----------
  P.tabs.risks = { label: 'Risks', show: async function (ctx) {
    var id = ctx.id, a = ctx.a;
    var rows = P.must(await P.act.from('rams_rows').select('*').eq('activity_id', id).order('sort').order('hazard'));
    function save(r, patch) {
      return P.run(async function () {
        var res = P.must(await P.act.from('rams_rows').update(patch).eq('id', r.id).select('id'));
        if (!res.length) throw new Error("You don't have permission for that, or it is locked at this stage.");
      }, 'Saved').then(function (ok) { if (ok) ctx.reload(); });
    }
    function num5(val, fn) { return P.select([1, 2, 3, 4, 5], val, { onchange: function (e) { fn(Number(e.target.value)); } }); }
    function text(r, k, ph) { var i = h('input', { value: r[k] || '', placeholder: ph || '', onchange: function () { var p = {}; p[k] = P.blank(i.value); save(r, p); } }); return i; }
    function rate(n) { return h('span', { class: 'pill ' + (n >= 16 ? 'bad' : n >= 12 ? 'warn' : 'ok') }, n); }
    var nh = h('input', { id: 'r-hazard', placeholder: 'Hazard', class: 'grow' }), nw = h('input', { id: 'r-who', placeholder: 'Who is at risk', class: 'grow' });
    var nc = h('input', { id: 'r-controls', placeholder: 'Existing controls', class: 'grow' });
    var ns = P.select([1, 2, 3, 4, 5], 3, { id: 'r-sev' }), nl = P.select([1, 2, 3, 4, 5], 3, { id: 'r-lik' });
    var na = h('input', { id: 'r-extra', placeholder: 'Additional control', class: 'grow' }), no = h('input', { id: 'r-owner', placeholder: 'Owner', class: 'grow' });
    var need = (a.injury_risk || a.significant_injury_risk) && !rows.length;
    return h('div', { class: 'stack' },
      h('p', { class: 'muted' }, 'Rate each hazard 1 to 5 for severity and likelihood. A rating of 12 or more needs an extra control and a named owner. 16 or more cannot be submitted.'),
      need ? h('p', { class: 'pill warn' }, 'This activity is marked as a risk of injury, so it needs at least one risk before it can be submitted.') : null,
      rows.length ? h('div', { class: 'scroll' }, h('table', null,
        h('thead', null, h('tr', null, ['Hazard', 'Who', 'Controls', 'Sev', 'Lik', 'Rating', 'Extra control', 'Owner', ''].map(function (x) { return h('th', null, x); }))),
        h('tbody', null, rows.map(function (r) {
          return h('tr', { 'data-rams': r.hazard }, h('td', null, text(r, 'hazard')), h('td', null, text(r, 'who_at_risk')), h('td', null, text(r, 'existing_controls')),
            h('td', null, num5(r.severity, function (v) { save(r, { severity: v }); })), h('td', null, num5(r.likelihood, function (v) { save(r, { likelihood: v }); })),
            h('td', null, rate(r.rating)), h('td', null, text(r, 'additional_control')), h('td', null, text(r, 'owner')),
            h('td', null, h('button', { class: 'danger', onclick: async function () {
              if (!confirm('Remove this risk?')) return;
              if (await P.run(async function () { P.must(await P.act.from('rams_rows').delete().eq('id', r.id).select('id')); }, 'Removed')) ctx.reload();
            } }, 'Remove')));
        })))) : null,
      ctx.editable ? h('div', { class: 'card stack' }, h('h3', { style: 'margin-top:0' }, 'Add a risk'),
        h('div', { class: 'row' }, nh), h('div', { class: 'row' }, nw), h('div', { class: 'row' }, nc),
        h('div', { class: 'row' }, P.field('Severity', ns), P.field('Likelihood', nl)),
        h('div', { class: 'row' }, na), h('div', { class: 'row' }, no),
        h('div', { class: 'row' }, h('button', { class: 'btn', id: 'r-add', onclick: async function () {
          if (!nh.value.trim()) { P.toast('Name the hazard', true); return; }
          if (await P.run(async function () {
            P.must(await P.act.from('rams_rows').insert({ activity_id: id, hazard: nh.value.trim(), who_at_risk: P.blank(nw.value), existing_controls: P.blank(nc.value),
              severity: Number(ns.value), likelihood: Number(nl.value), additional_control: P.blank(na.value), owner: P.blank(no.value) }).select('id'));
          }, 'Added')) ctx.reload();
        } }, 'Add risk'))) : null);
  } };

  P.route('/a/:id/:tab?', { public: false, nav: 'activities', fn: page });
})();
