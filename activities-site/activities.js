// Organiser screens: the activities list and the new-activity form (also used for editing).
(function () {
  'use strict';
  var P = window.P, h = P.h, L = P.L;

  var TRACKS = { SAO_LARGE: 'Large scale', SAO_SMALL: 'Small scale', NO_SAO: 'No SAO approval' };
  var STATUSES = ['Draft', 'Submitted', 'Changes requested', 'Approved', 'Completed', 'Rejected', 'Cancelled'];
  var KINDS = ['Event', 'Project', 'Programme', 'Publication', 'Merchandise'];
  var filt = { ay: null, status: 'All', kind: '', body: '', q: '', overdue: false };

  async function years() {
    if (!P._ays) P._ays = P.must(await P.rec.from('academic_years').select('*').order('ay', { ascending: false }));
    return P._ays;
  }
  P.years = years;
  P.defaultAy = function (ays) { var o = ays.filter(function (y) { return y.is_open; })[0]; return (o || ays[0] || {}).ay; };

  // ---------- list ----------
  async function list() {
    P.loading();
    var ays = await years();
    if (!filt.ay) filt.ay = P.prefs.get('ay') || P.defaultAy(ays);
    var rows = await P.fetchAll(function () { return P.act.from('activity_list').select('*').eq('ay', filt.ay).order('start_date', { ascending: true, nullsFirst: false }).order('title'); });
    var bodies = Array.from(new Set(rows.map(function (r) { return r.body; }))).sort();
    var holder = h('div', { class: 'list' });
    var stats = h('div', { class: 'cols' });

    function draw() {
      var q = filt.q.trim().toLowerCase();
      var vis = rows.filter(function (r) {
        return (filt.status === 'All' || r.status === filt.status) && (!filt.kind || r.kind === filt.kind) &&
          (!filt.body || r.body === filt.body) && (!filt.overdue || r.docs_overdue > 0) &&
          (!q || (r.title + ' ' + r.body).toLowerCase().indexOf(q) >= 0);
      });
      var inScope = rows.filter(function (r) { return r.status !== 'Cancelled' && r.status !== 'Rejected'; });
      stats.replaceChildren(
        stat(rows.length, 'activities'),
        stat(rows.filter(function (r) { return r.status === 'Submitted'; }).length, 'awaiting approval'),
        stat(inScope.reduce(function (a, r) { return a + Number(r.docs_overdue || 0); }, 0), 'documents overdue'),
        stat(L.money(inScope.reduce(function (a, r) { return a + Number(r.planned || 0); }, 0)), 'planned spend'));
      holder.replaceChildren(vis.length ? vis.map(card) : h('p', { class: 'muted' }, rows.length ? 'Nothing matches those filters.' : 'No activities in ' + filt.ay + ' yet. Start with “New activity”.'));
    }
    function stat(v, label) { return h('div', { class: 'stat' }, h('b', null, v), h('span', null, label)); }
    function card(r) {
      var overdue = Number(r.docs_overdue || 0);
      return h('a', { class: 'item', href: '#/a/' + r.id },
        h('div', { class: 't' }, r.title),
        h('div', { class: 's' }, r.body + (r.parent_committee ? ' · ' + r.parent_committee : '') + ' · ' + (r.start_date ? L.fmtDate(r.start_date) : 'No date yet')),
        h('div', { class: 'meta' }, P.statusPill(r.status), P.pill(r.kind), r.track ? P.pill(TRACKS[r.track] || r.track) : null,
          h('span', { class: 'sub' }, r.docs_done + '/' + r.docs_total + ' documents'),
          overdue ? P.pill(overdue + ' overdue', 'bad') : null,
          Number(r.planned) ? h('span', { class: 'sub' }, L.money(r.planned) + ' planned' + (Number(r.spent) ? ', ' + L.money(r.spent) + ' spent' : '')) : null));
    }
    function chip(label, on, fn) { return h('button', { class: 'chip' + (on ? ' on' : ''), onclick: fn }, label); }
    var chips = h('div', { class: 'chips' });
    function drawChips() {
      chips.replaceChildren(['All'].concat(STATUSES).map(function (s) {
        return chip(s, filt.status === s, function () { filt.status = s; drawChips(); draw(); });
      }), chip('Overdue only', filt.overdue, function () { filt.overdue = !filt.overdue; drawChips(); draw(); }));
    }
    var aySel = P.select(ays.map(function (y) { return [y.ay, y.ay + (y.is_open ? '' : ' (closed)')]; }), filt.ay,
      { onchange: function () { filt.ay = aySel.value; P.prefs.set('ay', filt.ay); list(); } });
    var kindSel = P.select([['', 'All kinds']].concat(KINDS), filt.kind, { onchange: function () { filt.kind = kindSel.value; draw(); } });
    var bodySel = P.select([['', 'All bodies']].concat(bodies), filt.body, { class: 'grow', onchange: function () { filt.body = bodySel.value; draw(); } });
    var search = h('input', { class: 'grow', placeholder: 'Search title or body', value: filt.q, oninput: function () { filt.q = search.value; draw(); } });
    drawChips(); draw();
    P.show(h('div', { class: 'stack' },
      h('div', { class: 'row' }, h('h2', { style: 'margin:0;flex:1' }, 'Activities'), P.link('#/new', 'New activity', 'btn-link solid')),
      stats, h('div', { class: 'row' }, aySel, kindSel, bodySel), h('div', { class: 'row' }, search), chips, holder));
  }

  // ---------- the activity form (new and edit) ----------
  var TOGGLES = [
    ['is_fop', 'Freshmen Orientation Programme'],
    ['medical_related', 'Medical-related event'],
    ['has_sponsors', 'Has sponsors'],
    ['ticketed', 'Ticketed'],
    ['has_guest_of_honour', 'Has a guest of honour'],
    ['workplan_variation', 'Varies from the approved workplan or funding'],
    ['safety_risk', 'High-risk activity (safety)'],
    ['reputational_risk', 'Reputational risk'],
    ['injury_risk', 'Risk of injury (needs A3 RAMS)'],
    ['significant_injury_risk', 'Significant risk of injury (needs A6 indemnity)'],
    ['has_participant_list', 'Needs a student participant list (A4)'],
    ['has_prizes', 'Has prizes'],
    ['community_engagement', 'Community engagement activity'],
    ['in_annual_workplan', 'In the approved Annual Workplan']
  ];

  // Builds the form. a: current values (or {} for new). opts: { bodies, ays, pots, save(values) }
  P.activityForm = function (a, opts) {
    a = a || {};
    var el = {};
    function inp(id, props) { el[id] = h('input', Object.assign({ id: 'a-' + id, class: 'grow' }, props)); return el[id]; }
    var kind = P.select(KINDS, a.kind || 'Event', { id: 'a-kind' });
    var body = opts.bodies ? P.select(opts.bodies.map(function (b) { return [b.id, b.name + ' (' + b.level + ')']; }), a.body_id || (opts.bodies[0] || {}).id, { id: 'a-body', class: 'grow' }) : null;
    var ay = opts.ays ? P.select(opts.ays.map(function (y) { return [y.ay, y.ay + (y.is_open ? '' : ' (closed)')]; }), a.ay || P.defaultAy(opts.ays), { id: 'a-ay' }) : null;
    var title = inp('title', { value: a.title || '', placeholder: 'Activity name' });
    var desc = h('textarea', { id: 'a-description', placeholder: 'What is it, who is it for?' }, a.description || '');
    var start = inp('start_date', { type: 'date', value: a.start_date || '' });
    var end = inp('end_date', { type: 'date', value: a.end_date || '' });
    var venue = inp('venue', { value: a.venue || '', placeholder: 'Venue' });
    var aud = P.select([['', 'Audience'], ['Open', 'Open to all'], ['Limited', 'Limited']], a.audience || '', { id: 'a-audience' });
    var pax = inp('expected_pax', { type: 'number', min: 0, value: a.expected_pax === null || a.expected_pax === undefined ? '' : a.expected_pax, placeholder: 'Expected pax' });
    var scale = P.select(['Club', 'University', 'National', 'International'], a.scale || 'Club', { id: 'a-scale' });
    var saoAmt = inp('sao_funding_amount', { type: 'number', min: 0, step: '0.01', value: a.sao_funding_amount || 0 });
    var ext = inp('external_guests', { type: 'number', min: 0, value: a.external_guests || 0 });
    var folder = inp('drive_folder_url', { type: 'url', value: a.drive_folder_url || '', placeholder: 'Receipts folder link (optional)' });
    var chks = {};
    TOGGLES.forEach(function (t) { chks[t[0]] = h('input', { id: 'a-' + t[0], type: 'checkbox', checked: !!a[t[0]] }); });
    var pots = {};
    (opts.pots || []).forEach(function (p) { pots[p.name] = h('input', { type: 'checkbox', 'data-pot': p.name, checked: (a.funding_pots || []).indexOf(p.name) >= 0 }); });
    var btn = h('button', { class: 'btn', id: 'a-save', onclick: async function () {
      if (!title.value.trim()) { P.toast('Give the activity a name', true); return; }
      if (start.value && end.value && end.value < start.value) { P.toast('The end date is before the start date', true); return; }
      var v = {
        kind: kind.value, title: title.value.trim(), description: P.blank(desc.value), start_date: P.blank(start.value), end_date: P.blank(end.value),
        venue: P.blank(venue.value), audience: P.blank(aud.value), expected_pax: P.num(pax.value), scale: scale.value,
        sao_funding_amount: P.num(saoAmt.value) || 0, external_guests: Math.max(0, parseInt(ext.value, 10) || 0), drive_folder_url: P.blank(folder.value),
        funding_pots: Object.keys(pots).filter(function (k) { return pots[k].checked; })
      };
      TOGGLES.forEach(function (t) { v[t[0]] = chks[t[0]].checked; });
      if (body) v.body_id = body.value;
      if (ay) v.ay = ay.value;
      btn.disabled = true;
      await opts.save(v);
      btn.disabled = false;
    } }, opts.saveLabel || 'Save');
    return h('div', { class: 'stack' },
      body ? P.field('Body', body) : null,
      ay ? P.field('Academic year (MedSoc term)', ay, opts.ayHint) : null,
      h('div', { class: 'row' }, P.field('Kind', kind)),
      P.field('Name', title), P.field('Description', desc),
      h('div', { class: 'row' }, P.field('Starts', start), P.field('Ends', end)),
      P.field('Venue', venue),
      h('div', { class: 'row' }, P.field('Audience', aud), P.field('Expected pax', pax), P.field('Scale', scale)),
      h('h3', null, 'These answers decide the paperwork'),
      h('div', null, TOGGLES.map(function (t) { return h('label', { class: 'chk' }, chks[t[0]], t[1]); })),
      h('h3', null, 'Funding'),
      h('div', null, (opts.pots || []).map(function (p) { return h('label', { class: 'chk' }, pots[p.name], p.name); })),
      h('div', { class: 'row' }, P.field('Planned SAO Grant and Subscription Fees ($)', saoAmt), P.field('External guests expected (G2)', ext)),
      P.field('Receipts folder', folder),
      h('div', { class: 'sticky' }, btn));
  };

  // Event team access: members of a body can file for it. Falls back to leaders only if the database update is not installed yet.
  async function myBodies() {
    var r = await P.act.rpc('my_event_bodies');
    if (!r.error) return r.data;
    return P.must(await P.rec.rpc('my_bodies'));
  }

  async function newActivity() {
    P.loading();
    var data = {
      bodies: await myBodies(), ays: (await years()).filter(function (y) { return y.is_open || P.me.is_admin; }),
      pots: P.must(await P.act.from('pots').select('*').order('ord'))
    };
    if (!data.bodies.length) { P.show(h('p', { class: 'muted' }, 'You are not set up to manage any body yet.')); return; }
    if (!data.ays.length) { P.show(h('p', { class: 'muted' }, 'No academic year is open for new activities.')); return; }
    P.show(h('div', null, h('h2', null, 'New activity'), P.activityForm({}, {
      bodies: data.bodies, ays: data.ays, pots: data.pots, saveLabel: 'Create activity',
      save: async function (v) {
        var row = await P.run(async function () { return P.must(await P.act.from('activities').insert(v).select('id')); });
        if (row && row[0]) { P.toast('Created'); location.hash = '#/a/' + row[0].id; }
      }
    })));
  }

  P.route('/', { public: true, nav: 'activities', fn: function () {
    if (P.me && (P.me.can_manage || P.me.is_admin || P.exco || P.filer)) return list();
    location.replace('#/events');
  } });
  P.route('/activities', { public: false, nav: 'activities', fn: list });
  P.route('/new', { public: false, nav: 'activities', fn: newActivity });
})();
