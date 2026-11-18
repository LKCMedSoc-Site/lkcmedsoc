// "Manage body": one place for everything about a body. First you choose what kind (house, committee, student group, year level, ExCo),
// then which one, then a section: its public page, its team, its official email, who can edit it, and (admins) its name and status.
// app.js supplies the helpers and the team editor; pages.js supplies the public page editor.
(function () {
  'use strict';
  var CATS = [
    { key: 'house', level: 'House', label: 'House', noun: 'house', button: 'Manage house', many: 'Houses', hint: 'The houses: their page, representatives and contact' },
    { key: 'committee', level: 'Committee', label: 'Committee', noun: 'committee', button: 'Manage committee', many: 'Committees', hint: 'Committees and their heads and members' },
    { key: 'group', level: 'CCA/Project', label: 'Student group', noun: 'student group', button: 'Manage student group', many: 'Student groups', hint: 'CCAs, projects and clubs' },
    { key: 'year', level: 'Year', label: 'Year level', noun: 'year level', button: 'Manage year levels', many: 'Year levels', hint: 'M1 to M5 and their representatives' },
    { key: 'exco', level: 'ExCo', label: 'ExCo', noun: 'ExCo', button: 'Manage ExCo', many: 'ExCo', hint: 'The executive committee' }
  ];
  var HAS_PAGE = { 'CCA/Project': 1, Committee: 1, House: 1 };
  var state = { cat: null, bodyId: null, section: null, q: '' };

  window.ManageBody = { view: view };

  async function view(kit) {
    var h = kit.h, sb = kit.sb, me = kit.me;
    kit.show(h('p', { class: 'muted' }, 'Loading…'));

    // Admins see every body (including inactive ones); everyone else sees the active bodies they manage.
    var bodies = await kit.run(async function () {
      return me.is_admin ? kit.must(await sb.from('bodies').select('id,name,level,status,parent_committee').order('level').order('name'))
                         : kit.must(await sb.rpc('my_bodies'));
    });
    if (!bodies) return;
    bodies.forEach(function (b) { if (!b.status) b.status = 'Active'; });
    var catOf = function (level) { return CATS.filter(function (c) { return c.level === level; })[0]; };
    var inCat = function (c) { return bodies.filter(function (b) { return b.level === c.level; }); };
    var cats = CATS.filter(function (c) { return me.is_admin || inCat(c).length; });
    if (!cats.length) { kit.show(h('p', { class: 'muted' }, 'You are not set up to manage any body yet. Ask an admin to add you as a manager.')); return; }

    var again = function () { view(kit); };
    var go = function (patch) { Object.assign(state, patch); again(); };
    if (state.cat && !cats.some(function (c) { return c.key === state.cat; })) state.cat = null;
    var cat = state.cat && CATS.filter(function (c) { return c.key === state.cat; })[0];
    var body = state.bodyId && bodies.filter(function (b) { return b.id === state.bodyId; })[0];
    if (state.bodyId && !body && !state.isNew) state.bodyId = null;

    if (!cat) return landing();
    if (state.isNew) return bodyScreen({ id: null, name: '', level: cat.level, status: 'Active', parent_committee: '' }, cat);
    if (!body) return list(cat);
    return bodyScreen(body, catOf(body.level) || cat);

    // ---- 1. What do you want to manage? ----
    function landing() {
      var grid = h('div', { class: 'catgrid' }, cats.map(function (c) {
        var n = inCat(c).length;
        return h('button', { class: 'catbtn', type: 'button', onclick: function () { go({ cat: c.key, bodyId: null, isNew: false, q: '' }); } },
          h('strong', null, c.button), h('span', { class: 'muted' }, c.hint), h('em', null, n + (me.is_admin ? ' in total' : ' you manage')));
      }));
      var parts = [h('h2', null, 'Manage body'), h('p', { class: 'muted' }, 'Choose what you want to manage.'), grid];
      if (me.is_admin) parts.push(refreshCard());
      kit.show(h('div', null, parts));
    }

    // ---- 2. Which one? ----
    function list(c) {
      var items = inCat(c);
      var q = h('input', { class: 'grow', placeholder: 'Search…', value: state.q, oninput: function () { state.q = q.value; draw(); } });
      var out = h('div');
      function draw() {
        var f = state.q.trim().toLowerCase();
        var shown = items.filter(function (b) { return !f || (b.name + ' ' + (b.parent_committee || '')).toLowerCase().indexOf(f) >= 0; });
        var groups = {};
        shown.forEach(function (b) { var k = c.level === 'CCA/Project' ? (b.parent_committee || 'Independent') : ''; (groups[k] = groups[k] || []).push(b); });
        out.replaceChildren(shown.length ? Object.keys(groups).sort().map(function (k) {
          return h('div', null, k ? h('h3', null, k) : null, h('div', { class: 'bodylist' }, groups[k].map(function (b) {
            return h('button', { class: 'bodybtn', type: 'button', onclick: function () { go({ bodyId: b.id, section: null }); } }, b.name,
              b.status === 'Inactive' ? h('span', { class: 'pill bad' }, 'Inactive') : null);
          })));
        }) : h('p', { class: 'muted' }, 'Nothing found.'));
      }
      draw();
      kit.show(h('div', null,
        h('button', { class: 'ghost sm', type: 'button', onclick: function () { go({ cat: null }); } }, '← Manage body'),
        h('h2', null, c.many),
        h('div', { class: 'row' }, items.length > 8 ? q : null, me.is_admin && c.key !== 'exco' ? h('button', { class: 'btn', type: 'button', onclick: function () { go({ isNew: true, bodyId: null, section: 'details' }); } }, 'New ' + c.noun) : null),
        out));
    }

    // ---- 3. One body ----
    function bodyScreen(b, c) {
      var hasPage = !!HAS_PAGE[b.level];
      var sections = [];
      if (!state.isNew) {
        if (hasPage) sections.push(['page', 'Public page']);
        sections.push(['team', 'Team'], ['contact', 'Contact email']);
        if (me.is_admin) sections.push(['access', 'Who can edit']);
      }
      if (me.is_admin) sections.push(['details', state.isNew ? 'Create' : 'Name and status']);
      var section = sections.some(function (s) { return s[0] === state.section; }) ? state.section : sections[0][0];
      var slot = h('div');
      kit.show(h('div', null,
        h('button', { class: 'ghost sm', type: 'button', onclick: function () { go({ bodyId: null, isNew: false, section: null }); } }, '← ' + c.many),
        h('div', { class: 'row' }, h('h2', { style: 'margin:0' }, state.isNew ? 'New ' + c.noun : b.name), b.status === 'Inactive' ? h('span', { class: 'pill bad' }, 'Inactive') : null),
        h('div', { class: 'subtabs' }, sections.map(function (s) {
          return h('button', { class: s[0] === section ? 'on' : '', type: 'button', onclick: function () { state.section = s[0]; bodyScreen(b, c); } }, s[1]);
        })), slot));
      if (section === 'page') kit.pageEditor(slot, b);
      else if (section === 'team') kit.roster(slot, b);
      else if (section === 'contact') contact(slot, b);
      else if (section === 'access') access(slot, b);
      else details(slot, b, c);
    }

    // ---- Contact email (managers and admins) ----
    async function contact(slot, b) {
      slot.replaceChildren(h('p', { class: 'muted' }, 'Loading…'));
      var current = await kit.run(async function () { return kit.must(await sb.rpc('my_body_contact', { b: b.id })); });
      if (current === undefined) return;
      var input = h('input', { class: 'grow', value: current || '', placeholder: 'name@example.com, other@example.com' });
      slot.replaceChildren(h('div', { class: 'card' }, h('strong', null, 'Official email'),
        h('p', { class: 'muted' }, 'The contact address for ' + b.name + '. Up to five, separated by commas. It is used for the body’s email group and is not shown on the website. (To show an email on the public page, add it under Public page, Links.)'),
        input, h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onclick: async function () {
          var ok = await kit.run(async function () { kit.must(await sb.rpc('save_my_body_contact', { b: b.id, p_emails: input.value })); return true; }, 'Saved');
          if (ok) contact(slot, b);
        } }, 'Save'))));
    }

    // ---- Who can edit (admins) ----
    async function access(slot, b) {
      var ms = await kit.run(async function () { return kit.must(await sb.from('body_managers').select('*').eq('body_id', b.id).order('email')); });
      if (!ms) return;
      var em = h('input', { type: 'email', placeholder: 'leader@e.ntu.edu.sg', class: 'grow' });
      slot.replaceChildren(h('h3', null, 'Who can edit this body'),
        h('p', { class: 'muted' }, 'Top leaders become editors when you press “Refresh managers” on the Manage body start page. Managers of a committee can also edit its student groups automatically.'),
        ms.length ? kit.table(['Email', 'How added', ''], ms.map(function (m) {
          return [m.email, m.source, h('button', { class: 'danger', type: 'button', onclick: async function () {
            await kit.run(async function () { kit.must(await sb.from('body_managers').delete().eq('body_id', b.id).eq('email', m.email)); });
            access(slot, b);
          } }, 'Remove')];
        })) : h('p', { class: 'muted' }, 'No managers yet.'),
        h('div', { class: 'row' }, em, h('button', { class: 'btn', type: 'button', onclick: async function () {
          await kit.run(async function () { kit.must(await sb.from('body_managers').insert({ body_id: b.id, email: em.value.trim().toLowerCase(), source: 'manual' })); }, 'Added');
          access(slot, b);
        } }, 'Add manager')));
    }

    // ---- Name, level, status, parent committee (admins) ----
    async function details(slot, b, c) {
      var levels = await kit.run(async function () { return kit.must(await sb.from('positions').select('level')); });
      if (!levels) return;
      levels = levels.map(function (x) { return x.level; }).filter(function (v, i, a) { return a.indexOf(v) === i; });
      if (levels.indexOf(b.level) < 0) levels.push(b.level);
      var committees = bodies.filter(function (x) { return x.level === 'Committee'; }).map(function (x) { return x.name; });
      if (b.parent_committee && committees.indexOf(b.parent_committee) < 0) committees.push(b.parent_committee);
      var f = {
        name: h('input', { value: b.name || '' }),
        level: h('select', null, levels.map(function (l) { return h('option', { value: l, selected: l === b.level }, l); })),
        status: h('select', null, ['Active', 'Inactive'].map(function (s) { return h('option', { value: s, selected: s === b.status }, s); })),
        parent_committee: h('select', null, h('option', { value: '' }, 'None'), committees.map(function (n) { return h('option', { value: n, selected: n === b.parent_committee }, n); }))
      };
      slot.replaceChildren(h('div', { class: 'card' },
        field('Name', f.name), field('Level', f.level), field('Status', f.status), field('Parent committee (for student groups)', f.parent_committee),
        h('p', { class: 'muted' }, 'Making a body inactive hides it from the website and from Manage body for everyone except admins.'),
        h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onclick: async function () {
          var rec = { name: f.name.value.trim(), level: f.level.value, status: f.status.value, parent_committee: f.parent_committee.value || null };
          if (!rec.name) { kit.toast('Name needed', true); return; }
          var saved = await kit.run(async function () {
            if (b.id) { kit.must(await sb.from('bodies').update(rec).eq('id', b.id)); return { id: b.id }; }
            return kit.must(await sb.from('bodies').insert(rec).select('id').single());
          }, 'Saved');
          if (saved) go({ isNew: false, bodyId: saved.id, section: b.id ? 'details' : 'page' });
        } }, b.id ? 'Save' : 'Create'))));
    }
    function field(label, input) { return h('div', null, h('label', null, label), input); }

    // ---- Admins: refresh the manager list from the top leaders of a year ----
    function refreshCard() {
      var ayS = h('select');
      kit.run(async function () { return kit.must(await sb.from('academic_years').select('ay').order('ay', { ascending: false })); }).then(function (years) {
        (years || []).forEach(function (y) { ayS.appendChild(h('option', { value: y.ay }, y.ay)); });
      });
      return h('div', null, h('h3', null, 'Refresh managers from top leaders'),
        h('div', { class: 'card' }, h('p', { class: 'muted' }, 'Replaces all automatic managers with the top leaders of the chosen year (committee heads, chairpersons, ExCo, year reps). Managers added by hand are kept.'),
          h('div', { class: 'row' }, ayS, h('button', { class: 'btn', type: 'button', onclick: async function () {
            var n = await kit.run(async function () { return kit.must(await sb.rpc('refresh_managers', { a: ayS.value })); });
            if (n !== undefined) kit.toast(n + ' manager links set');
          } }, 'Refresh managers'))));
    }
  }
})();
