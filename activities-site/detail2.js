// One activity, continued: budget, spending, the event page settings, and the day-of screen.
(function () {
  'use strict';
  var P = window.P, h = P.h, L = P.L;
  var CAP_UNIT = { per_pax: 'per person', per_item: 'per item', per_event: 'per event' };
  var DENIED = "You don't have permission for that, or it is locked at this stage.";

  function updater(table, matchFn, ctx, reloadAfter) {
    return function (row, patch, okMsg) {
      return P.run(async function () {
        var rows = P.must(await matchFn(P.act.from(table).update(patch), row).select('*'));
        if (!rows.length) throw new Error(DENIED);
      }, okMsg || 'Saved').then(function (ok) { if (ok && reloadAfter) ctx.reload(); return ok; });
    };
  }
  function numInput(val, onchange, attrs) {
    var i = h('input', Object.assign({ type: 'number', step: '0.01', min: 0, value: val === null || val === undefined ? '' : val }, attrs || {}));
    i.addEventListener('change', function () { onchange(i.value); });
    return i;
  }
  function textInput(val, onchange, attrs) {
    var i = h('input', Object.assign({ value: val || '' }, attrs || {}));
    i.addEventListener('change', function () { onchange(i.value); });
    return i;
  }

  // ---------- budget ----------
  P.tabs.budget = { label: 'Budget', show: async function (ctx) {
    var id = ctx.id, a = ctx.a;
    var data = await Promise.all([
      P.act.from('budget_lines_checked').select('*').eq('activity_id', id).order('sort').order('description'),
      P.act.from('budget_categories').select('*').order('ord'),
      P.act.from('pots').select('*').order('ord'),
      P.act.from('pot_balance').select('*').eq('body_id', a.body_id).eq('ay', a.ay),
      P.act.from('applications_flat').select('*').eq('activity_id', id).order('requested_at', { ascending: false })
    ]);
    var lines = P.must(data[0]), cats = P.must(data[1]), pots = P.must(data[2]), bal = P.must(data[3]), apps = P.must(data[4]);
    var upd = updater('budget_lines', function (q, r) { return q.eq('id', r.id); }, ctx, true);
    var total = lines.reduce(function (s, l) { return s + Number(l.amount); }, 0);

    var rows = lines.map(function (l) {
      var cat = P.select(cats.map(function (c) { return c.name; }), l.category, { onchange: function (e) { upd(l, { category: e.target.value }); } });
      var pot = P.select(pots.map(function (p) { return p.name; }), l.pot, { onchange: function (e) { upd(l, { pot: e.target.value }); } });
      return h('tr', { 'data-line': l.description },
        h('td', null, textInput(l.description, function (v) { upd(l, { description: v }); })),
        h('td', null, cat), h('td', null, pot),
        h('td', null, numInput(l.quantity, function (v) { upd(l, { quantity: Number(v) }); })),
        h('td', null, numInput(l.unit_cost, function (v) { upd(l, { unit_cost: Number(v) }); })),
        h('td', { class: 'num' }, L.money(l.amount), l.over_cap ? h('div', null, P.pill('Over cap ' + L.money(l.cap_amount) + ' ' + (CAP_UNIT[l.cap_unit] || ''), 'bad')) : null),
        h('td', null, ctx.editable ? h('button', { class: 'danger', onclick: async function () {
          if (!confirm('Remove this line?')) return;
          if (await P.run(async function () { P.must(await P.act.from('budget_lines').delete().eq('id', l.id).select('id')); }, 'Removed')) ctx.reload();
        } }, 'Remove') : null));
    });

    // money by pot, with what is left after every plan this body has made
    var usedPots = Array.from(new Set(lines.map(function (l) { return l.pot; }).concat((a.funding_pots || [])))).filter(Boolean);
    var balBy = {}; bal.forEach(function (b) { balBy[b.pot] = b; });
    var here = {}; lines.forEach(function (l) { here[l.pot] = (here[l.pot] || 0) + Number(l.amount); });
    var potRows = usedPots.map(function (p) {
      var b = balBy[p] || { allocated: 0, approved: 0, planned: 0, pending: 0 };
      var spendable = Number(b.allocated) + Number(b.approved), left = spendable - Number(b.planned);
      return [p, L.money(b.allocated), L.money(b.approved), L.money(here[p] || 0), L.money(b.planned),
        h('span', { class: left < 0 ? 'neg' : 'good' }, L.money(left)), Number(b.pending) ? L.money(b.pending) : '–'];
    });

    // add line
    var nd = h('input', { id: 'b-desc', placeholder: 'What is it for', class: 'grow' });
    var nc = P.select(cats.map(function (c) { return c.name; }), '', { id: 'b-cat' });
    var np = P.select(pots.map(function (p) { return p.name; }), (a.funding_pots || [])[0] || pots[0].name, { id: 'b-pot' });
    var nq = h('input', { id: 'b-qty', type: 'number', min: 0, step: '0.01', value: 1 });
    var nu = h('input', { id: 'b-unit', type: 'number', min: 0, step: '0.01', placeholder: 'Unit cost' });
    var live = h('div', { class: 'muted', id: 'b-live' });
    function showLive() {
      var amt = (Number(nq.value) || 0) * (Number(nu.value) || 0), pb = balBy[np.value] || { allocated: 0, approved: 0, planned: 0 };
      var left = Number(pb.allocated) + Number(pb.approved) - Number(pb.planned) - amt;
      live.replaceChildren('This line: ' + L.money(amt) + '. ' + np.value + ' would have ', h('span', { class: left < 0 ? 'neg' : 'good' }, L.money(left)), ' left after all plans.');
    }
    [nq, nu].forEach(function (i) { i.addEventListener('input', showLive); }); np.addEventListener('change', showLive); showLive();

    // funds requests
    var ap = P.select(pots.map(function (p) { return p.name; }), (pots.filter(function (p) { return !p.guaranteed; })[0] || pots[0]).name, { id: 'ap-pot' });
    var aa = h('input', { id: 'ap-amt', type: 'number', min: 0, step: '0.01', placeholder: 'Amount' });
    var an = h('input', { id: 'ap-note', placeholder: 'Why (optional)', class: 'grow' });

    return h('div', { class: 'stack' },
      h('div', { class: 'card' }, h('div', { class: 'muted' }, 'Planned total'), h('div', { class: 'total', id: 'b-total' }, L.money(total))),
      lines.length ? h('div', { class: 'scroll' }, h('table', null,
        h('thead', null, h('tr', null, ['Item', 'Category', 'Pot', 'Qty', 'Unit cost', 'Amount', ''].map(function (x, i) { return h('th', { class: i === 5 ? 'num' : '' }, x); }))),
        h('tbody', null, rows))) : h('p', { class: 'muted' }, 'No budget lines yet.'),
      ctx.editable ? h('div', { class: 'card stack' }, h('h3', { style: 'margin-top:0' }, 'Add a line'),
        h('div', { class: 'row' }, nd), h('div', { class: 'row' }, P.field('Category', nc), P.field('Pot', np)),
        h('div', { class: 'row' }, P.field('Quantity', nq), P.field('Unit cost ($)', nu)), live,
        h('div', { class: 'row' }, h('button', { class: 'btn', id: 'b-add', onclick: async function () {
          if (!nd.value.trim()) { P.toast('Say what the line is for', true); return; }
          if (!(Number(nq.value) > 0)) { P.toast('Quantity must be more than zero', true); return; }
          if (await P.run(async function () {
            P.must(await P.act.from('budget_lines').insert({ activity_id: id, category: nc.value, pot: np.value, description: nd.value.trim(), quantity: Number(nq.value), unit_cost: Number(nu.value) || 0 }).select('id'));
          }, 'Added')) ctx.reload();
        } }, 'Add line'))) : h('p', { class: 'muted' }, 'The budget is locked while the activity is ' + a.status.toLowerCase() + '.'),
      potRows.length ? h('div', null, h('h3', null, 'Money by pot'),
        P.table(['Pot', 'Allocated', 'Approved', 'This activity', 'All plans', 'Left', 'Pending'], potRows, [1, 2, 3, 4, 5, 6]),
        h('p', { class: 'muted' }, 'Left = allocated plus approved, minus everything planned by ' + (ctx.l.body || 'this body') + ' this year.')) : null,
      h('div', { class: 'card stack' }, h('h3', { style: 'margin-top:0' }, 'Funding requests'),
        apps.length ? P.table(['Pot', 'Requested', 'Status', 'Approved'], apps.map(function (x) { return [x.pot, L.money(x.amount_requested), P.pill(x.status, x.status === 'Approved' ? 'ok' : x.status === 'Rejected' ? 'bad' : ''), x.amount_approved ? L.money(x.amount_approved) : '–']; }), [1, 3])
             : h('p', { class: 'muted' }, 'None yet. Guaranteed pots come from your allocation; ask for the others here.'),
        h('div', { class: 'row' }, ap, aa), h('div', { class: 'row' }, an),
        h('div', { class: 'row' }, h('button', { class: 'ghost', id: 'ap-go', onclick: async function () {
          if (!(Number(aa.value) > 0)) { P.toast('Enter an amount', true); return; }
          if (await P.run(async function () {
            P.must(await P.act.from('applications').insert({ body_id: a.body_id, ay: a.ay, activity_id: id, pot: ap.value, amount_requested: Number(aa.value), note: P.blank(an.value) }).select('id'));
          }, 'Request sent')) ctx.reload();
        } }, 'Request funds'))));
  } };

  // ---------- spending ----------
  P.tabs.spending = { label: 'Spending', show: async function (ctx) {
    var id = ctx.id, a = ctx.a;
    var data = await Promise.all([
      P.act.from('spending_entries').select('*').eq('activity_id', id).order('spent_on').order('description'),
      P.act.from('budget_lines').select('id,description,pot,amount').eq('activity_id', id).order('sort'),
      P.act.from('pots').select('*').order('ord')
    ]);
    var ents = P.must(data[0]), lines = P.must(data[1]), pots = P.must(data[2]);
    var upd = updater('spending_entries', function (q, r) { return q.eq('id', r.id); }, ctx, false);
    var actual = ents.reduce(function (s, e) { return s + Number(e.amount_actual); }, 0);
    var planned = lines.reduce(function (s, l) { return s + Number(l.amount); }, 0);
    var missing = ents.filter(function (e) { return !e.receipt_in_folder && Number(e.amount_actual) > 0; }).length;

    function card(e) {
      var keepsBox = h('div', { class: 'stack', hidden: !e.keeps });
      var kn = h('input', { placeholder: 'Item name', value: e.keeps_name || '', class: 'grow' });
      var kq = h('input', { type: 'number', min: 1, placeholder: 'Qty', value: e.keeps_qty || '' });
      var kr = h('input', { placeholder: 'Room', value: e.keeps_room || '', class: 'grow' });
      var kl = h('input', { placeholder: 'Shelf / location', value: e.keeps_location || '', class: 'grow' });
      var keeps = h('input', { type: 'checkbox', checked: e.keeps, onchange: function () {
        if (keeps.checked) keepsBox.hidden = false;
        else upd(e, { keeps: false }, 'Saved').then(function () { keepsBox.hidden = true; });
      } });
      keepsBox.replaceChildren(h('div', { class: 'row' }, kn, kq), h('div', { class: 'row' }, kr, kl),
        h('div', { class: 'row' }, h('button', { class: 'ghost', onclick: function () {
          if (!kn.value.trim() || !(Number(kq.value) > 0)) { P.toast('Give the item a name and a quantity', true); return; }
          upd(e, { keeps: true, keeps_name: kn.value.trim(), keeps_qty: Number(kq.value), keeps_room: P.blank(kr.value), keeps_location: P.blank(kl.value) }, 'Sent to inventory drafts');
        } }, 'Save inventory details')));
      var claim = P.select(['Not claimed', 'Claim submitted', 'Reimbursed', 'Paid by SLS'], e.claim_status, { onchange: function (ev) { upd(e, { claim_status: ev.target.value }); } });
      var pot = P.select(pots.map(function (p) { return p.name; }), e.pot, { onchange: function (ev) { upd(e, { pot: ev.target.value }); } });
      var rec = h('input', { type: 'checkbox', checked: e.receipt_in_folder, onchange: function () { upd(e, { receipt_in_folder: rec.checked }); } });
      return h('div', { class: 'item', 'data-entry': e.description },
        h('div', { class: 'row', style: 'margin-top:0' }, textInput(e.description, function (v) { upd(e, { description: v }); }, { class: 'grow' }),
          numInput(e.amount_actual, function (v) { upd(e, { amount_actual: Number(v) }).then(function (ok) { if (ok) ctx.reload(); }); }, { style: 'max-width:120px' })),
        h('div', { class: 'row' }, pot, h('input', { type: 'date', value: e.spent_on || '', onchange: function (ev) { upd(e, { spent_on: P.blank(ev.target.value) }); } }), claim),
        h('label', { class: 'chk' }, rec, 'Receipt is in the folder'),
        h('label', { class: 'chk' }, keeps, 'We keep this after the event (adds a draft inventory item)'), keepsBox,
        h('div', { class: 'row' }, h('button', { class: 'danger', onclick: async function () {
          if (!confirm('Remove this entry?')) return;
          if (await P.run(async function () { P.must(await P.act.from('spending_entries').delete().eq('id', e.id).select('id')); }, 'Removed')) ctx.reload();
        } }, 'Remove')));
    }

    var nd = h('input', { id: 's-desc', placeholder: 'What was bought', class: 'grow' });
    var np = P.select(pots.map(function (p) { return p.name; }), (a.funding_pots || [])[0] || pots[0].name, { id: 's-pot' });
    var na = h('input', { id: 's-amt', type: 'number', min: 0, step: '0.01', placeholder: 'Amount ($)' });
    var nt = h('input', { id: 's-date', type: 'date' });
    var nl = P.select([['', 'Not linked to a budget line']].concat(lines.map(function (l) { return [l.id, l.description + ' (' + l.pot + ')']; })), '', { id: 's-line', class: 'grow' });

    var byPot = {};
    lines.forEach(function (l) { (byPot[l.pot] = byPot[l.pot] || { p: 0, a: 0 }).p += Number(l.amount); });
    ents.forEach(function (e) { (byPot[e.pot] = byPot[e.pot] || { p: 0, a: 0 }).a += Number(e.amount_actual); });

    return h('div', { class: 'stack' },
      h('div', { class: 'cols' },
        h('div', { class: 'stat' }, h('b', null, L.money(planned)), h('span', null, 'planned')),
        h('div', { class: 'stat' }, h('b', { id: 's-actual' }, L.money(actual)), h('span', null, 'spent so far')),
        h('div', { class: 'stat' }, h('b', { class: missing ? 'neg' : '' }, missing), h('span', null, 'missing receipts'))),
      a.drive_folder_url ? h('div', null, h('a', { href: a.drive_folder_url, target: '_blank', rel: 'noopener' }, 'Open the receipts folder')) : h('p', { class: 'muted' }, 'No receipts folder yet. Add the link under Overview, Edit details.'),
      ctx.spendable ? null : h('p', { class: 'pill warn' }, 'Spending can be recorded once the activity is approved.'),
      ents.length ? h('div', { class: 'list' }, ents.map(card)) : h('p', { class: 'muted' }, 'Nothing recorded yet.'),
      ctx.spendable ? h('div', { class: 'card stack' }, h('h3', { style: 'margin-top:0' }, 'Record spending'),
        h('div', { class: 'row' }, nd), h('div', { class: 'row' }, P.field('Pot', np), P.field('Amount', na), P.field('Date', nt)), h('div', { class: 'row' }, nl),
        h('div', { class: 'row' }, h('button', { class: 'btn', id: 's-add', onclick: async function () {
          if (!nd.value.trim()) { P.toast('Say what was bought', true); return; }
          if (!(Number(na.value) >= 0) || na.value === '') { P.toast('Enter the amount', true); return; }
          if (await P.run(async function () {
            P.must(await P.act.from('spending_entries').insert({ activity_id: id, pot: np.value, description: nd.value.trim(), amount_actual: Number(na.value), spent_on: P.blank(nt.value), budget_line_id: P.blank(nl.value) }).select('id'));
          }, 'Recorded')) ctx.reload();
        } }, 'Add spending'))) : null,
      Object.keys(byPot).length ? h('div', null, h('h3', null, 'Planned against actual'),
        P.table(['Pot', 'Planned', 'Spent', 'Difference'], Object.keys(byPot).map(function (p) {
          var d = byPot[p].p - byPot[p].a;
          return [p, L.money(byPot[p].p), L.money(byPot[p].a), h('span', { class: d < 0 ? 'neg' : '' }, L.money(d))];
        }), [1, 2, 3])) : null);
  } };

  // ---------- event cover picture ----------
  // The cover is a 16:9 banner: crop the middle of any photo to that shape, at most 1600 px wide, as a JPEG.
  var COVER_BUCKET = 'event-covers';
  function coverBlob(file) {
    return new Promise(function (res, rej) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var want = 16 / 9, sw = img.width, sh = img.height, cw, ch;
        if (sw / sh > want) { ch = sh; cw = Math.round(sh * want); } else { cw = sw; ch = Math.round(sw / want); }
        var sx = Math.round((sw - cw) / 2), sy = Math.round((sh - ch) / 2);
        var ow = Math.min(1600, cw), oh = Math.round(ow / want), c = document.createElement('canvas');
        c.width = ow; c.height = oh;
        c.getContext('2d').drawImage(img, sx, sy, cw, ch, 0, 0, ow, oh); URL.revokeObjectURL(url);
        c.toBlob(function (b) { b ? res(b) : rej(new Error('Could not read that image')); }, 'image/jpeg', 0.85);
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('Could not read that image. Try a JPEG, PNG or WebP photo.')); };
      img.src = url;
    });
  }
  P.coverBlob = coverBlob; // exposed so it can be tested on its own

  // ---------- event page settings ----------
  P.tabs.page = { label: 'Event page', show: async function (ctx) {
    var id = ctx.id, a = ctx.a;
    var counts = P.must(await P.act.from('attendance_counts').select('*').eq('activity_id', id).maybeSingle()) || {};
    var approved = a.status === 'Approved';
    var sphere = h('input', { id: 'p-sphere', placeholder: 'e.g. the ID shown in SPHERE', value: a.sphere_event_id || '', class: 'grow' });
    var vis = P.select([['Hidden', 'No public page'], ['Members', 'NTU students (sign in)'], ['Public', 'Anyone with the link']], a.visibility, { id: 'p-vis' });
    var summary = h('textarea', { id: 'p-summary', placeholder: 'A short blurb for the event page' }, a.public_summary || '');
    var st = h('input', { id: 'p-start', type: 'time', value: a.start_time ? a.start_time.slice(0, 5) : '' });
    var en = h('input', { id: 'p-end', type: 'time', value: a.end_time ? a.end_time.slice(0, 5) : '' });
    var cap = h('input', { id: 'p-cap', type: 'number', min: 0, placeholder: 'No limit', value: a.rsvp_capacity === null || a.rsvp_capacity === undefined ? '' : a.rsvp_capacity });
    var dl = h('input', { id: 'p-deadline', type: 'datetime-local', value: L.toSgLocalInput(a.rsvp_deadline) });
    var rsvp = h('input', { id: 'p-rsvp', type: 'checkbox', checked: a.rsvp_open, disabled: !approved && !a.rsvp_open });
    var photos = h('input', { id: 'p-photos', type: 'url', placeholder: 'https://… (SharePoint link)', value: a.photos_url || '', class: 'grow' });
    var guests = h('input', { id: 'p-guests', type: 'checkbox', checked: a.guest_rsvp_open });
    // Cover picture: uploaded straight away, but only attached to the event when the page is saved. Pictures uploaded and then replaced or
    // removed are deleted after a successful save so nothing is left behind.
    var coverWas = a.cover_url || '', coverNow = coverWas, uploaded = [];
    var coverPath = function (u) { var i = String(u || '').indexOf('/' + COVER_BUCKET + '/'); return i < 0 ? '' : u.slice(i + COVER_BUCKET.length + 2); };
    var coverImg = h('img', { id: 'p-cover-img', alt: 'Cover picture preview', style: 'display:none;width:100%;max-width:420px;aspect-ratio:16/9;object-fit:cover;border-radius:10px;background:#ebe1fa' });
    var coverFile = h('input', { id: 'p-cover-file', type: 'file', accept: 'image/jpeg,image/png,image/webp' });
    var coverRemove = h('button', { class: 'ghost', type: 'button', id: 'p-cover-remove', onclick: function () { coverNow = ''; showCover(); } }, 'Remove cover');
    function showCover() {
      coverImg.style.display = coverNow ? 'block' : 'none'; coverImg.src = coverNow || '';
      coverRemove.style.display = coverNow ? '' : 'none';
    }
    showCover();
    coverFile.addEventListener('change', async function () {
      var f = coverFile.files && coverFile.files[0]; if (!f) return;
      await P.run(async function () {
        var blob = await coverBlob(f);
        var path = id + '/' + crypto.randomUUID().replace(/-/g, '').slice(0, 16) + '.jpg';
        var r = await P.sb.storage.from(COVER_BUCKET).upload(path, blob, { contentType: 'image/jpeg' });
        if (r.error) throw r.error;
        uploaded.push(path);
        coverNow = P.cfg.SUPABASE_URL + '/storage/v1/object/public/' + COVER_BUCKET + '/' + path; showCover();
      }, 'Picture added. Press Save to keep it.');
      coverFile.value = '';
    });
    vis.addEventListener('change', function () { if (vis.value !== 'Public') guests.checked = false; });
    guests.addEventListener('change', function () { if (guests.checked) { vis.value = 'Public'; rsvp.checked = true; } });
    var link = a.visibility !== 'Hidden' ? P.eventUrl(id) : null;
    return h('div', { class: 'stack' },
      h('div', { class: 'cols' },
        h('div', { class: 'stat' }, h('b', null, counts.going || 0), h('span', null, 'going')),
        h('div', { class: 'stat' }, h('b', null, counts.waitlist || 0), h('span', null, 'on the waitlist')),
        h('div', { class: 'stat' }, h('b', null, counts.came || 0), h('span', null, 'came'))),
      approved || a.rsvp_open ? null : h('p', { class: 'pill warn' }, 'RSVP can open once the activity is approved. You can prepare the page now.'),
      P.field('SPHERE event ID', sphere, 'Paste it here after you create the event in SPHERE, so the two stay linked.'),
      P.field('Who can see the page', vis),
      P.field('Blurb', summary),
      P.field('Cover picture', h('div', { class: 'stack' }, coverImg, h('div', { class: 'row' }, coverFile, coverRemove)),
        'Optional. A banner for the event on the website and the home page. Any photo works: the middle is cropped to a wide 16:9 shape.'),
      P.field('Photo album link', photos, 'Paste the SharePoint link after the event. A "See the photos" button then appears on the event page.'),
      h('div', { class: 'row' }, P.field('Starts at', st), P.field('Ends at', en)),
      h('div', { class: 'row' }, P.field('Places (empty for no limit)', cap), P.field('RSVP closes (empty: end of the event day)', dl)),
      h('label', { class: 'chk' }, rsvp, 'RSVP is open'),
      h('label', { class: 'chk' }, guests, 'Let external guests register (people without an NTU sign-in). Needs a public page.'),
      h('div', { class: 'sticky' }, h('button', { class: 'btn', id: 'p-save', onclick: async function () {
        var s = { sphere_event_id: sphere.value, visibility: vis.value, public_summary: summary.value, start_time: st.value, end_time: en.value,
                  rsvp_capacity: cap.value, rsvp_deadline: L.fromSgLocalInput(dl.value), rsvp_open: rsvp.checked, guest_rsvp_open: guests.checked, photos_url: photos.value, cover_url: coverNow };
        if (await P.run(async function () { P.must(await P.act.rpc('set_event_page', { aid: id, s: s })); }, 'Saved')) {
          // tidy up: delete pictures that are no longer the cover (replaced ones, removed ones, and the old cover)
          var keep = coverPath(coverNow), drop = uploaded.concat([coverPath(coverWas)]).filter(function (x, i, all) { return x && x !== keep && all.indexOf(x) === i; });
          if (drop.length) { try { await P.sb.storage.from(COVER_BUCKET).remove(drop); } catch (e) { /* a leftover file is harmless */ } }
          ctx.reload();
        }
      } }, 'Save')),
      link ? h('div', { class: 'card stack' }, h('h3', { style: 'margin-top:0' }, 'Share it'),
        h('div', { class: 'row' }, h('input', { value: link, readonly: true, class: 'grow', id: 'p-link' }), h('button', { class: 'ghost', onclick: function () { P.copy(link); } }, 'Copy')),
        h('div', null, P.qr(link)), h('div', { class: 'row' }, h('a', { href: '#/e/' + id }, 'Open the page'))) : null);
  } };

  // ---------- day-of ----------
  // Reads QR codes from the camera: the browser's own detector where there is one, otherwise jsQR from a CDN.
  async function startScanner(holder, onCode) {
    var stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    var video = h('video', { class: 'scan', playsinline: '', muted: '', autoplay: '' });
    video.srcObject = stream; holder.replaceChildren(video); await video.play();
    var detector = null, canvas = document.createElement('canvas'), ctx2 = canvas.getContext('2d'), last = '', lastAt = 0, stopped = false;
    if ('BarcodeDetector' in window) detector = new window.BarcodeDetector({ formats: ['qr_code'] });
    else if (!window.jsQR) {
      await new Promise(function (res, rej) {
        var s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js'; s.onload = res; s.onerror = function () { rej(new Error('Could not load the scanner. Type the ticket code instead.')); };
        document.head.appendChild(s);
      });
    }
    function stop() { stopped = true; stream.getTracks().forEach(function (t) { t.stop(); }); holder.replaceChildren(); }
    (async function loop() {
      while (!stopped) {
        try {
          var text = '';
          if (detector) { var r = await detector.detect(video); if (r.length) text = r[0].rawValue; }
          else if (video.videoWidth) {
            canvas.width = video.videoWidth; canvas.height = video.videoHeight; ctx2.drawImage(video, 0, 0);
            var img = ctx2.getImageData(0, 0, canvas.width, canvas.height), q = window.jsQR(img.data, img.width, img.height);
            if (q) text = q.data;
          }
          if (text && (text !== last || Date.now() - lastAt > 4000)) { last = text; lastAt = Date.now(); await onCode(text); }
        } catch (e) { /* keep scanning */ }
        await new Promise(function (r2) { setTimeout(r2, 250); });
      }
    })();
    P.onLeave(stop);
    return stop;
  }
  P.startScanner = startScanner;

  P.tabs.day = { label: 'Day-of', show: async function (ctx) {
    var id = ctx.id, a = ctx.a;
    var live = a.status === 'Approved' || a.status === 'Completed';
    // door screen
    var door = h('div', { class: 'stack', 'data-testid': 'door' }), shownCode = '';
    async function refreshDoor() {
      try {
        var r = P.must(await P.act.rpc('current_checkin_code', { aid: id }));
        if (r.code !== shownCode) {
          shownCode = r.code;
          door.replaceChildren(h('div', null, P.qr(P.checkinUrl(id, r.code), true)), h('div', { class: 'bigcode', id: 'door-code' }, r.code),
            h('div', { class: 'sub' }, 'Students scan this, or type the code on the event page. It changes every minute.'));
        }
      } catch (e) { door.replaceChildren(h('p', { class: 'pill bad' }, P.friendly(e))); }
    }
    if (live) { await refreshDoor(); P.every(15000, refreshDoor); }

    // list and counts
    var listBox = h('div', null), countBox = h('div', { class: 'cols' }), filter = 'All', all = [];
    function drawList() {
      var vis = all.filter(function (r) { return filter === 'All' || r.outcome === filter; });
      listBox.replaceChildren(vis.length ? P.table(['Name', 'Who', 'RSVP', 'Outcome', 'Time', ''], vis.map(function (r) {
        return [r.name, r.kind, r.rsvp_status || '–', P.pill(r.outcome, r.outcome === 'Attended' || r.outcome === 'Walk-in' ? 'ok' : r.outcome === 'No-show' ? 'bad' : ''),
          r.checked_in_at ? new Date(r.checked_in_at).toLocaleTimeString('en-SG', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Singapore' }) : '',
          r.checkin_id ? h('button', { class: 'danger', onclick: async function () {
            if (!confirm('Remove ' + r.name + ' from check-in?')) return;
            if (await P.run(async function () { P.must(await P.act.from('checkins').delete().eq('id', r.checkin_id).select('id')); }, 'Removed')) refresh();
          } }, 'Undo') : ''];
      })) : h('p', { class: 'muted' }, 'Nobody here yet.'));
    }
    var chips = h('div', { class: 'chips' });
    function drawChips() {
      chips.replaceChildren(['All', 'Attended', 'Walk-in', 'No-show', 'Waitlisted', 'Cancelled'].map(function (f) {
        return h('button', { class: 'chip' + (filter === f ? ' on' : ''), onclick: function () { filter = f; drawChips(); drawList(); } }, f);
      }));
    }
    async function refresh() {
      try {
        all = P.must(await P.act.from('attendance_flat').select('*').eq('activity_id', id).order('name'));
        var c = P.must(await P.act.from('attendance_counts').select('*').eq('activity_id', id).maybeSingle()) || {};
        countBox.replaceChildren(
          [[c.going || 0, 'said yes'], [c.attended || 0, 'came (RSVP)'], [c.walk_in || 0, 'walk-ins'], [c.no_show || 0, 'no-shows'], [c.came || 0, 'total here']].map(function (x) {
            return h('div', { class: 'stat' }, h('b', null, x[0]), h('span', null, x[1]));
          }));
        drawList();
      } catch (e) { listBox.replaceChildren(h('p', { class: 'pill bad' }, P.friendly(e))); }
    }
    drawChips(); await refresh(); P.every(20000, refresh);

    // scan or type a ticket
    var scanHolder = h('div', null), stopScan = null;
    var scanBtn = h('button', { class: 'ghost', id: 'scan-btn', onclick: async function () {
      if (stopScan) { stopScan(); stopScan = null; scanBtn.textContent = 'Scan tickets'; return; }
      try {
        stopScan = await startScanner(scanHolder, async function (text) { await checkTicket(text); });
        scanBtn.textContent = 'Stop scanning';
      } catch (e) { P.toast(P.friendly(e), true); }
    } }, 'Scan tickets');
    async function checkTicket(code) {
      var r = await P.run(async function () { return P.must(await P.act.rpc('check_in_rsvp_code', { aid: id, p_code: code.trim() })); });
      if (r && r.status) { P.toast((r.status === 'already' ? 'Already in: ' : 'Checked in: ') + r.name); refresh(); }
    }
    var ticket = h('input', { id: 'd-ticket', placeholder: 'Ticket code', class: 'grow' });
    var mn = h('input', { id: 'd-name', placeholder: 'Name', class: 'grow' }), me = h('input', { id: 'd-email', type: 'email', placeholder: 'Email (optional)', class: 'grow' });
    var mk = P.select(['Student', 'Guest'], 'Student', { id: 'd-kind' });

    return h('div', { class: 'stack' },
      live ? h('div', { class: 'card stack', style: 'text-align:center' }, h('h3', { style: 'margin-top:0' }, 'Door screen'), door)
           : h('p', { class: 'pill warn' }, 'Check-in works once the activity is approved.'),
      countBox, chips, listBox,
      h('div', { class: 'card stack' }, h('h3', { style: 'margin-top:0' }, 'Check someone in'),
        h('div', { class: 'row' }, scanBtn), scanHolder,
        h('div', { class: 'row' }, ticket, h('button', { class: 'btn', id: 'd-ticket-go', onclick: function () { if (ticket.value.trim()) { checkTicket(ticket.value); ticket.value = ''; } } }, 'Check in')),
        h('h3', null, 'Add a walk-in'),
        h('div', { class: 'row' }, mn), h('div', { class: 'row' }, me), h('div', { class: 'row' }, mk),
        h('div', { class: 'row' }, h('button', { class: 'ghost', id: 'd-manual', onclick: async function () {
          if (!mn.value.trim()) { P.toast('Add a name', true); return; }
          var r = await P.run(async function () { return P.must(await P.act.rpc('check_in_manual', { aid: id, p_name: mn.value, p_email: P.blank(me.value), p_kind: mk.value })); });
          if (r && r.status) { P.toast(r.status === 'already' ? 'Already checked in' : 'Added'); mn.value = ''; me.value = ''; refresh(); }
        } }, 'Add'))),
      h('div', { class: 'card stack' }, h('h3', { style: 'margin-top:0' }, 'After the event'),
        h('div', { class: 'row' }, h('button', { class: 'ghost', id: 'd-csv', onclick: async function () {
          var rows = P.must(await P.act.from('participants').select('*').eq('activity_id', id).order('name'));
          P.download(a.title.replace(/[^\w]+/g, '-').toLowerCase() + '-participants.csv', L.csv(rows, ['name', 'email', 'kind', 'outcome', 'checked_in_at', 'method']));
        } }, 'Download participant list (CSV)')),
        h('div', { class: 'muted' }, 'Guests\' names and emails should be deleted once the event is over. Counts stay.'),
        h('div', { class: 'row' }, h('button', { class: 'danger', id: 'd-erase', onclick: async function () {
          if (!confirm('Delete all guest names and emails for this event? This cannot be undone.')) return;
          var n = await P.run(async function () { return P.must(await P.act.rpc('erase_guest_data', { aid: id })); });
          if (n !== undefined) { P.toast('Guest details erased (' + n + ')'); refresh(); }
        } }, 'Erase guest details'))));
  } };
})();
