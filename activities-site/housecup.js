// House Cup: one page, one academic year at a time. Everyone sees each house's share of every reason, scaled by the reason's weight.
// ExCo can add a reason, set the weights, click a reason to enter the points for each house, and lock a finished year.
// Raw points are only ever loaded for the editor (house_cup_reason_points); the public table never contains them.
(function () {
  'use strict';
  var P = window.P, h = P.h;
  var COLORS = { blue: '#2f6fbd', cyan: '#1a9bb5', teal: '#168a7a', green: '#3a8f3a', amber: '#d9a21b', orange: '#e0702a', red: '#c23030', slate: '#64707d' };

  function colorOf(c) { return COLORS[c] || (/^#[0-9a-f]{6}$/i.test(c || '') ? c : '#b9a6b3'); }
  function f1(n) { return Number(n || 0).toFixed(1); }
  function f2(n) { return Number(n || 0).toFixed(2).replace(/\.?0+$/, ''); }
  function ord(n) { var s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
  function today() { return P.L.sgToday(); }

  async function page(params, query) {
    P.loading();
    var years = P.must(await P.act.rpc('house_cup_years'));
    var ay = (query && query.ay) || P.prefs.get('cup_ay');
    if (!ay || years.indexOf(ay) < 0) ay = years[0];
    var data = P.must(await P.act.rpc('house_cup', { p_ay: ay }));
    var st = { ay: ay, years: years, data: data, editing: null, weights: {} };
    var root = h('div', { class: 'cup' });
    P.show(root);

    // Left and right arrow keys flip the year (not while typing in a box)
    function key(ev) {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test((ev.target || {}).tagName || '')) return;
      if (ev.key === 'ArrowLeft') go(1); else if (ev.key === 'ArrowRight') go(-1);
    }
    document.addEventListener('keydown', key);
    P.onLeave(function () { document.removeEventListener('keydown', key); });

    async function load(newAy) {
      st.ay = newAy || st.ay; P.prefs.set('cup_ay', st.ay);
      st.data = P.must(await P.act.rpc('house_cup', { p_ay: st.ay }));
      st.years = P.must(await P.act.rpc('house_cup_years'));
      st.editing = null; st.weights = {};
      draw();
    }
    function go(step) {   // years run newest first, so "left" (older) is +1
      var i = st.years.indexOf(st.ay) + step;
      if (i < 0 || i >= st.years.length) return;
      P.run(function () { return load(st.years[i]); });
    }

    function draw() {
      var d = st.data, i = st.years.indexOf(st.ay), locked = d.is_final, canEdit = !!P.exco && !locked;
      var older = i < st.years.length - 1, newer = i > 0;
      var dirty = Object.keys(st.weights).length > 0;
      var wsum = Number(d.weights_total), off = d.reasons.length && Math.round(wsum * 100) !== 10000;

      var head = h('div', { class: 'cup-head' },
        h('button', { class: 'ghost cup-arrow', id: 'cup-prev', 'aria-label': 'Earlier year', disabled: !older, onclick: function () { go(1); } }, '◀'),
        h('div', { class: 'cup-year' }, h('h2', null, 'House Cup'), h('div', { class: 'cup-ay' }, st.ay)),
        h('button', { class: 'ghost cup-arrow', id: 'cup-next', 'aria-label': 'Later year', disabled: !newer, onclick: function () { go(-1); } }, '▶'));

      var notes = h('div', { class: 'row' },
        locked ? P.pill('Final', 'ok') : (d.reasons.length ? P.pill('Provisional', 'warn') : null),
        off ? h('span', { class: 'pill warn' }, 'Weights add to ' + f2(wsum) + '%, not 100%. Scores are scaled to fit until you fix them.') : null);

      var body;
      if (!d.houses.length) body = h('p', { class: 'muted' }, 'No houses are set up yet.');
      else if (!d.reasons.length) body = h('p', { class: 'muted' }, 'No house points have been recorded for ' + st.ay + ' yet.' + (P.exco ? '' : ' Check back soon.'));
      else body = table(d, canEdit);

      var tools = [];
      if (P.exco) {
        if (!locked) tools.push(h('button', { class: 'btn', id: 'cup-add', onclick: function () { open(null); } }, '+ Add house points'));
        if (dirty) tools.push(h('button', { class: 'btn', id: 'cup-saveweights', onclick: saveWeights }, 'Save weights'));
        if (dirty) tools.push(h('button', { class: 'ghost', onclick: function () { st.weights = {}; draw(); } }, 'Undo weight changes'));
        if (d.reasons.length) tools.push(h('button', { class: 'ghost', id: 'cup-final', onclick: function () { setFinal(!locked); } }, locked ? 'Reopen year' : 'Mark year final'));
      }

      root.replaceChildren(head, notes, body, tools.length ? h('div', { class: 'row' }, tools) : null,
        st.editing ? editor(st.editing) : null,
        h('p', { class: 'sub' }, 'Each cell is the house’s share of the points all houses earned for that reason, times the reason’s weight. ' +
          'The totals add up to 100.'));
    }

    function table(d, canEdit) {
      var hs = d.houses.slice().sort(function (a, b) { return a.name < b.name ? -1 : 1; });
      var byId = {}; hs.forEach(function (x) { byId[x.id] = x; });
      var top = d.houses.reduce(function (m, x) { return Math.min(m, x.rank); }, 99);
      var head = h('tr', null, h('th', null, 'Reason'), h('th', { class: 'num' }, 'Weight'),
        hs.map(function (x) { return h('th', { class: 'num' }, h('span', { class: 'cup-dot', style: 'background:' + colorOf(x.color) }), x.name); }));
      var rows = d.reasons.map(function (r) {
        var cells = {}; (r.cells || []).forEach(function (c) { cells[c.house_id] = c; });
        var w = st.weights[r.id] !== undefined ? st.weights[r.id] : r.weight;
        var nameEl = P.exco ? h('button', { class: 'cup-reason', onclick: function () { open(r.id); } }, r.name) : h('span', null, r.name);
        var weightEl = canEdit
          ? h('input', { type: 'number', min: 0, max: 100, step: 'any', class: 'cup-w', 'aria-label': 'Weight for ' + r.name, value: w,
              oninput: function (ev) {
                var v = ev.target.value;
                if (v === '' || Number(v) === Number(r.weight)) delete st.weights[r.id]; else st.weights[r.id] = v;
                updateDirty();
              } })
          : h('span', null, f2(r.weight) + '%');
        return h('tr', null, h('td', null, nameEl, h('div', { class: 'sub' }, P.L.fmtDate(r.awarded_on))),
          h('td', { class: 'num' }, weightEl, canEdit ? '%' : null),
          hs.map(function (x) {
            var c = cells[x.id] || { share: 0, weighted: 0 };
            return h('td', { class: 'num' }, h('div', { class: 'cup-v' }, f1(c.weighted)), h('div', { class: 'sub' }, Math.round(c.share * 100) + '%'));
          }));
      });
      var total = h('tr', { class: 'cup-total' }, h('td', null, 'Total'), h('td', { class: 'num' }, '100'),
        hs.map(function (x) { return h('td', { class: 'num' }, f2(byId[x.id].total)); }));
      var rank = h('tr', { class: 'cup-rank' }, h('td', null, 'Place'), h('td', null),
        hs.map(function (x) { var r = byId[x.id].rank; return h('td', { class: 'num' }, h('span', { class: 'cup-place' + (r === top ? ' first' : '') }, ord(r))); }));
      return h('div', { class: 'scroll' }, h('table', { class: 'cup-table' }, h('thead', null, head), h('tbody', null, rows, total, rank)));
    }

    function updateDirty() {   // redraw only the toolbar state without losing focus in a weight box
      var active = document.activeElement, id = active && active.getAttribute && active.getAttribute('aria-label');
      var had = !!document.getElementById('cup-saveweights'), has = Object.keys(st.weights).length > 0;
      if (had === has) return;
      draw();
      if (id) { var el = root.querySelector('[aria-label="' + id.replace(/"/g, '\\"') + '"]'); if (el) { el.focus(); var n = el.value; el.value = ''; el.value = n; } }
    }

    async function saveWeights() {
      var w = {}; Object.keys(st.weights).forEach(function (k) { w[k] = Number(st.weights[k]); });
      var ok = await P.run(async function () { P.must(await P.act.rpc('save_house_cup_weights', { p_ay: st.ay, p_weights: w })); return true; }, 'Weights saved');
      if (ok) await P.run(function () { return load(); });
    }

    async function setFinal(on) {
      if (on && !window.confirm('Mark ' + st.ay + ' final? Points and weights will be locked until you reopen it.')) return;
      var ok = await P.run(async function () { P.must(await P.act.rpc('set_house_cup_final', { p_ay: st.ay, p_final: on })); return true; }, on ? 'Year marked final' : 'Year reopened');
      if (ok) await P.run(function () { return load(); });
    }

    // ---------- the points panel ----------
    async function open(id) {
      var hs = st.data.houses.slice().sort(function (a, b) { return a.name < b.name ? -1 : 1; });
      var rec = { id: null, name: '', weight: 0, awarded_on: today(), scores: {} };
      if (id) rec = await P.run(async function () { return P.must(await P.act.rpc('house_cup_reason_points', { p_reason: id })); });
      if (!rec) return;
      st.editing = { rec: rec, houses: hs };
      draw();
      var el = document.getElementById('cup-editor'); if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    function editor(ed) {
      var rec = ed.rec, locked = st.data.is_final;
      var name = h('input', { id: 'ed-name', class: 'grow', maxlength: 80, value: rec.name, placeholder: 'e.g. Sports Day' });
      var on = h('input', { id: 'ed-date', type: 'date', value: rec.awarded_on });
      var wt = h('input', { id: 'ed-weight', type: 'number', min: 0, max: 100, step: 'any', value: rec.weight, style: 'width:90px' });
      var inputs = ed.houses.map(function (x) {
        var v = rec.scores[x.id];
        return { house: x, el: h('input', { type: 'number', min: 0, step: 'any', inputmode: 'decimal', class: 'cup-pts', 'data-house': x.id,
          value: v === undefined ? '' : v, placeholder: 'points' }) };
      });
      var err = h('div', { class: 'pill bad', hidden: true });
      function fail(m) { err.textContent = m; err.hidden = false; }
      var save = h('button', { class: 'btn', id: 'ed-save', onclick: async function () {
        err.hidden = true;
        var scores = {};
        for (var i = 0; i < inputs.length; i++) {
          var raw = inputs[i].el.value.trim(), n = Number(raw);
          if (raw === '' || !isFinite(n)) { fail('Enter a number for ' + inputs[i].house.name + ' (0 if they earned none).'); inputs[i].el.focus(); return; }
          if (n < 0) { fail('Points cannot be negative.'); inputs[i].el.focus(); return; }
          scores[inputs[i].house.id] = n;
        }
        if (!name.value.trim()) { fail('Give the reason a name.'); name.focus(); return; }
        var w = Number(wt.value);
        if (wt.value === '' || !isFinite(w) || w < 0 || w > 100) { fail('The weight must be between 0 and 100.'); wt.focus(); return; }
        save.disabled = true;
        var ok = await P.run(async function () {
          P.must(await P.act.rpc('save_house_cup_reason', { p_id: rec.id, p_ay: st.ay, p_name: name.value, p_weight: w, p_on: on.value || null, p_scores: scores }));
          return true;
        }, 'Saved');
        save.disabled = false;
        if (ok) await P.run(function () { return load(); });
      } }, rec.id ? 'Save changes' : 'Add house points');
      var del = rec.id ? h('button', { class: 'danger', onclick: async function () {
        if (!window.confirm('Delete "' + rec.name + '" and its points?')) return;
        var ok = await P.run(async function () { P.must(await P.act.rpc('delete_house_cup_reason', { p_id: rec.id })); return true; }, 'Deleted');
        if (ok) await P.run(function () { return load(); });
      } }, 'Delete') : null;
      return h('div', { class: 'card', id: 'cup-editor' },
        h('h3', null, rec.id ? 'Edit house points' : 'Add house points'),
        locked ? h('p', { class: 'pill warn' }, 'This year is final. Reopen it to change points.') : null,
        h('div', { class: 'row' }, P.field('Reason', name), P.field('Date', on), P.field('Weight (%)', wt)),
        h('div', { class: 'cup-grid' }, inputs.map(function (x) {
          return h('div', null, h('label', null, h('span', { class: 'cup-dot', style: 'background:' + colorOf(x.house.color) }), x.house.name), x.el);
        })),
        h('p', { class: 'sub' }, 'Every house needs a number. Use any scale you like (100s or 10000s): only the share between houses counts.'),
        err,
        h('div', { class: 'row' }, save, h('button', { class: 'ghost', onclick: function () { st.editing = null; draw(); } }, 'Cancel'), del));
    }

    draw();
  }

  P.route('/house-cup', { public: true, nav: 'housecup', fn: page });
})();
