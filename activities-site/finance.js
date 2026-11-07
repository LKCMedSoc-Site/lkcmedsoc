// ExCo and treasurer: money by pot, yearly allocations, funding requests, missing receipts.
(function () {
  'use strict';
  var P = window.P, h = P.h, L = P.L;
  var TABS = [['pots', 'Pots'], ['alloc', 'Allocations'], ['apps', 'Requests'], ['receipts', 'Receipts']];
  var LEVELS = ['CCA/Project', 'Committee', 'ExCo', 'Year', 'House'];
  var state = { ay: null };

  async function shell(params, body) {
    var ays = await P.years();
    if (!state.ay) state.ay = P.prefs.get('ay') || P.defaultAy(ays);
    var tab = params.tab || 'pots';
    var aySel = P.select(ays.map(function (y) { return [y.ay, y.ay + (y.is_open ? '' : ' (closed)')]; }), state.ay, {
      id: 'fin-ay', onchange: function () { state.ay = aySel.value; P.prefs.set('ay', state.ay); P.dispatch(); } });
    var holder = h('div', null, h('p', { class: 'muted' }, 'Loading…'));
    P.show(h('div', { class: 'stack' },
      h('div', { class: 'row' }, h('h2', { style: 'margin:0;flex:1' }, 'Finance'), aySel),
      h('div', { class: 'subtabs' }, TABS.map(function (t) {
        return h('a', { class: 'chip' + (t[0] === tab ? ' on' : ''), href: '#/finance/' + t[0], style: 'text-decoration:none' }, t[1]);
      })), holder));
    holder.replaceChildren(await body(tab));
  }

  var views = {
    // ---- money by pot ----
    pots: async function () {
      var rows = await P.fetchAll(function () { return P.act.from('pot_balance').select('*').eq('ay', state.ay).order('pot').order('body'); });
      if (!rows.length) return h('p', { class: 'muted' }, 'No money has been allocated, requested or planned for ' + state.ay + ' yet.');
      var pots = Array.from(new Set(rows.map(function (r) { return r.pot; })));
      return h('div', { class: 'stack' }, pots.map(function (p) {
        var rs = rows.filter(function (r) { return r.pot === p; });
        function sum(k) { return rs.reduce(function (s, r) { return s + Number(r[k]); }, 0); }
        var table = P.table(['Body', 'Allocated', 'Approved', 'Planned', 'Spent', 'Left'],
          rs.map(function (r) { return [r.body, L.money(r.allocated), L.money(r.approved), L.money(r.planned), L.money(r.spent),
            h('span', { class: Number(r.remaining) < 0 ? 'neg' : '' }, L.money(r.remaining))]; })
          .concat([[h('b', null, 'Total'), h('b', null, L.money(sum('allocated'))), h('b', null, L.money(sum('approved'))), h('b', null, L.money(sum('planned'))), h('b', null, L.money(sum('spent'))),
            h('b', null, L.money(sum('remaining')))]]), [1, 2, 3, 4, 5]);
        return h('details', { class: 'card', open: rs.length < 12, 'data-pot': p }, h('summary', null, h('b', null, p), ' · ' + rs.length + ' bodies · ' + L.money(sum('remaining')) + ' left'), table);
      }));
    },

    // ---- allocations ----
    alloc: async function () {
      var rows = await P.fetchAll(function () { return P.act.from('allocation_sheet').select('*').eq('ay', state.ay).order('body'); });
      var pots = P.must(await P.act.from('pots').select('*').eq('guaranteed', true).order('ord')).map(function (p) { return p.name; });
      var bodies = [], seen = {}, cell = {};
      rows.forEach(function (r) {
        if (!seen[r.body_id]) { seen[r.body_id] = 1; bodies.push(r); }
        cell[r.body_id + '|' + r.pot] = r;
      });
      var totals = {}, totalEls = {};
      function calcTotals() { pots.forEach(function (p) { totals[p] = bodies.reduce(function (s, b) { return s + Number((cell[b.body_id + '|' + p] || {}).amount || 0); }, 0); }); }
      function drawTotals() { calcTotals(); pots.forEach(function (p) { if (totalEls[p]) totalEls[p].textContent = L.money(totals[p]); }); }
      var q = h('input', { id: 'al-search', placeholder: 'Filter bodies', class: 'grow' });
      var tbody = h('tbody', null);
      function drawRows() {
        var f = q.value.trim().toLowerCase();
        tbody.replaceChildren(bodies.filter(function (b) { return !f || (b.body + ' ' + (b.parent_committee || '') + ' ' + b.body_level).toLowerCase().indexOf(f) >= 0; }).map(function (b) {
          return h('tr', { 'data-body': b.body },
            h('td', null, b.body, h('div', { class: 'sub' }, b.body_level + (b.parent_committee ? ' · ' + b.parent_committee : ''))),
            pots.map(function (p) {
              var c = cell[b.body_id + '|' + p] || { amount: 0 };
              var i = h('input', { type: 'number', min: 0, step: '0.01', value: Number(c.amount) === 0 && !c.has_row ? '' : c.amount, placeholder: '0', 'data-pot': p });
              i.addEventListener('change', async function () {
                var v = i.value === '' ? 0 : Number(i.value);
                var ok = await P.run(async function () {
                  P.must(await P.act.from('allocations').upsert({ body_id: b.body_id, ay: state.ay, pot: p, amount: v }, { onConflict: 'body_id,ay,pot' }).select('amount'));
                }, 'Saved');
                if (ok) { cell[b.body_id + '|' + p] = Object.assign({}, c, { amount: v, has_row: true }); drawTotals(); }
              });
              return h('td', { class: 'cell' }, i);
            }));
        }));
      }
      q.addEventListener('input', drawRows);

      // same amount for every active body of a kind
      var bp = P.select(pots, pots[0], { id: 'bulk-pot' });
      var ba = h('input', { id: 'bulk-amt', type: 'number', min: 0, step: '0.01', placeholder: 'Amount each ($)' });
      var lv = {}; LEVELS.forEach(function (l) { lv[l] = h('input', { type: 'checkbox', checked: l === 'CCA/Project', 'data-level': l }); });
      var ow = h('input', { id: 'bulk-over', type: 'checkbox' });
      var bulk = h('div', { class: 'card stack' }, h('h3', { style: 'margin-top:0' }, 'Same amount for every active body'),
        h('div', { class: 'row' }, bp, ba),
        h('div', null, LEVELS.map(function (l) { return h('label', { class: 'chk' }, lv[l], l); })),
        h('label', { class: 'chk' }, ow, 'Replace amounts that are already set'),
        h('div', { class: 'row' }, h('button', { class: 'btn', id: 'bulk-go', onclick: async function () {
          var levels = LEVELS.filter(function (l) { return lv[l].checked; });
          if (!levels.length) { P.toast('Pick at least one kind of body', true); return; }
          if (ba.value === '' || Number(ba.value) < 0) { P.toast('Enter the amount', true); return; }
          if (!confirm('Give ' + L.money(ba.value) + ' of ' + bp.value + ' to every active ' + levels.join(' / ') + (ow.checked ? ', replacing existing amounts?' : ' that has none set?'))) return;
          var n = await P.run(async function () {
            return P.must(await P.act.rpc('set_allocations_bulk', { p_ay: state.ay, p_pot: bp.value, p_amount: Number(ba.value), p_levels: levels, p_overwrite: ow.checked }));
          });
          if (n !== undefined) { P.toast(n + ' allocation' + (n === 1 ? '' : 's') + ' written'); P.dispatch(); }
        } }, 'Apply')),
        h('p', { class: 'muted' }, 'Individual amounts can still be changed in the table afterwards.'));

      drawRows(); calcTotals();
      return h('div', { class: 'stack' }, bulk,
        h('div', { class: 'row' }, q),
        h('div', { class: 'scroll sheet' }, h('table', null,
          h('thead', null, h('tr', null, [h('th', null, 'Body')].concat(pots.map(function (p) { return h('th', { class: 'num' }, p); })))),
          tbody,
          h('tfoot', null, h('tr', null, [h('th', null, 'Total')].concat(pots.map(function (p) {
            totalEls[p] = h('th', { class: 'num', 'data-total': p }, L.money(totals[p])); return totalEls[p]; })))))),
        h('p', { class: 'muted' }, 'Only ExCo can change these. Leaders see their own body\'s amounts on their budget tab.'));
    },

    // ---- funding requests ----
    apps: async function () {
      var rows = await P.fetchAll(function () { return P.act.from('applications_flat').select('*').eq('ay', state.ay).order('requested_at', { ascending: false }); });
      var pending = rows.filter(function (r) { return r.status === 'Pending'; }), done = rows.filter(function (r) { return r.status !== 'Pending'; });
      function card(r) {
        var amt = h('input', { type: 'number', min: 0, step: '0.01', value: r.amount_requested, style: 'max-width:140px' });
        async function decide(d) {
          if (await P.run(async function () { P.must(await P.act.rpc('decide_application', { app_id: r.id, decision: d, p_amount: d === 'Approved' ? Number(amt.value) : null })); }, d)) P.dispatch();
        }
        return h('div', { class: 'item', 'data-app': r.body },
          h('div', { class: 't' }, r.body + ' · ' + r.pot + ' · ' + L.money(r.amount_requested)),
          h('div', { class: 's' }, (r.activity ? r.activity + ' · ' : '') + (r.requested_by || '') + (r.note ? ' · ' + r.note : '')),
          h('div', { class: 'row' }, h('label', { class: 'sub', style: 'margin:0' }, 'Approve'), amt,
            h('button', { class: 'btn', onclick: function () { decide('Approved'); } }, 'Approve'),
            h('button', { class: 'danger', onclick: function () { decide('Rejected'); } }, 'Reject')));
      }
      return h('div', { class: 'stack' }, h('h3', null, 'Waiting for a decision (' + pending.length + ')'),
        pending.length ? h('div', { class: 'list' }, pending.map(card)) : h('p', { class: 'muted' }, 'Nothing waiting.'),
        h('h3', null, 'Decided'),
        done.length ? P.table(['Body', 'Pot', 'Requested', 'Status', 'Approved', 'By'], done.map(function (r) {
          return [r.body, r.pot, L.money(r.amount_requested), P.pill(r.status, r.status === 'Approved' ? 'ok' : 'bad'), r.amount_approved ? L.money(r.amount_approved) : '–', r.decided_by || ''];
        }), [2, 4]) : h('p', { class: 'muted' }, 'None yet.'));
    },

    // ---- receipts ----
    receipts: async function () {
      var rows = await P.fetchAll(function () { return P.act.from('missing_receipts').select('*').eq('ay', state.ay).order('body').order('activity'); });
      if (!rows.length) return h('p', { class: 'good' }, 'Every recorded expense has a receipt in its folder.');
      var total = rows.reduce(function (s, r) { return s + Number(r.amount_actual); }, 0);
      return h('div', { class: 'stack' }, h('p', null, h('b', null, rows.length + ' expenses'), ' without a receipt, ' + L.money(total) + ' in total.'),
        P.table(['Body', 'Activity', 'Item', 'Pot', 'Amount', 'Claim'], rows.map(function (r) {
          return [r.body, h('a', { href: '#/a/' + r.activity_id + '/spending' }, r.activity), r.description, r.pot, L.money(r.amount_actual), r.claim_status];
        }), [4]));
    }
  };

  P.route('/finance/:tab?', { public: false, exco: true, nav: 'finance', fn: function (params) {
    return shell(params, function (tab) { return (views[tab] || views.pots)(); });
  } });
})();
