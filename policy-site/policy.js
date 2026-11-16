// LKCMedSoc Policy: the screens. Documents, one document, proposing a change, and proposals.
// Everything goes through the policy_* functions in sql/policy.sql, which check who is asking. Signed-in members can read; only ExCo can edit, propose and publish.
(function () {
  'use strict';
  var P = window.P, h = P.h, L = P.L;
  var TIER = { constitution: 'Constitution', bylaw: 'Bylaws', guide: 'Guides', external: 'NTU and School rules' };
  var TIER_ONE = { constitution: 'Constitution', bylaw: 'Bylaw', guide: 'Guide', external: 'NTU or School rule' };
  var TIER_NOTE = {
    constitution: 'The society’s founding rules. ExCo agrees each change among themselves, then publishes it.',
    bylaw: 'Binding. ExCo agrees each change among themselves, then publishes it. A General Meeting can annul.',
    guide: 'Advice. The owning officer approves.',
    external: 'Set by NTU, SAO or the School. Linked, not amended here.'
  };
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  var ICONS = {
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    print: '<path d="M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 14h10v7H7z"/>',
    undo: '<path d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3"/>',
    redo: '<path d="m15 14 5-5-5-5M20 9H10a6 6 0 0 0 0 12h3"/>',
    edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4zM14 6l4 4"/>',
    check: '<path d="m5 12 5 5L20 7"/>'
  };
  function ic(name) { var s = document.createElement('span'); s.className = 'ic'; s.setAttribute('aria-hidden', 'true'); s.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + ICONS[name] + '</svg>'; return s; }
  // "Documents > Bylaws": where you are, and a way back up one level.
  function crumbs(trail) {
    return h('nav', { class: 'crumbs noprint', 'aria-label': 'Breadcrumb' }, trail.map(function (t, i) {
      return i === trail.length - 1 ? h('span', { 'aria-current': 'page' }, t[0]) : h('a', { href: t[1] }, t[0]);
    }));
  }
  function esc(x) { return String(x).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function mark(text, q) {
    var out = h('span');
    var re = new RegExp('(' + String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
    String(text).split(re).forEach(function (part, i) { out.appendChild(i % 2 ? h('mark', null, part) : document.createTextNode(part)); });
    return out;
  }
  // The next free clause number (B-9.6 after B-9.5), counting repealed clauses too: a number is never reused.
  function nextRef(refs, tier) {
    var last = null, max = {};
    refs.forEach(function (r) { var m = /^([A-Z]+-\d+)\.(\d+)$/.exec(r); if (!m) return; last = m[1]; max[m[1]] = Math.max(max[m[1]] || 0, +m[2]); });
    if (!last) return ({ constitution: 'C', bylaw: 'B', guide: 'G', external: 'E' }[tier] || 'B') + '-1.1';
    return last + '.' + (max[last] + 1);
  }
  function rpc(name, args) { return P.act.rpc(name, args || {}).then(P.must); }
  // For functions that return nothing: resolve to true so P.run reports success.
  function rpcv(name, args) { return rpc(name, args).then(function () { return true; }); }
  function longDate(s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? (+m[3]) + ' ' + MONTHS[+m[2] - 1] + ' ' + m[1] : ''; }
  function when(s) { return s ? longDate(String(s).slice(0, 10)) : ''; }
  function aNo(n) { return 'A-' + String(n).padStart(3, '0'); }
  function docPill(d) { return d.status === 'in_force' ? P.pill('In force · version ' + d.version, 'dark') : P.pill('Draft proposal', 'warn'); }
  function amPill(s) {
    var label = { proposed: 'Waiting to be published', approved: 'Approved, not yet in force', rejected: 'Rejected', withdrawn: 'Withdrawn', in_force: 'In force' }[s] || s;
    return P.pill(label, { proposed: 'warn', approved: 'ok', rejected: 'bad', withdrawn: '', in_force: 'dark' }[s]);
  }
  // A link to a document (and a provision in it) inside this app.
  function docLink(slug, ref, v) { var q = []; if (v) q.push('v=' + v); if (ref) q.push('at=' + encodeURIComponent(ref)); return location.origin + location.pathname + '#/d/' + slug + (q.length ? '?' + q.join('&') : ''); }

  // ---------- the rich-text editor (Toast UI, the same one the Gazette uses) ----------
  function tui() { return Promise.resolve(window.toastuiReady).catch(function () { /* handled by the caller */ }).then(function () { return window.toastui && window.toastui.Editor; }); }
  function viewer(md) {
    var box = h('div', { class: 'md' });
    tui().then(function (T) { if (T && T.factory) T.factory({ el: box, viewer: true, initialValue: md || '' }); else box.textContent = md || ''; });
    return box;
  }
  function editor(box, md, height, onChange) {
    return tui().then(function (T) {
      if (!T) { box.replaceChildren(h('p', { class: 'pill bad' }, 'The text editor could not load. Check your connection and refresh the page.')); return null; }
      var inst = null;
      function tool(name, tip, icon) { var b = h('button', { type: 'button', class: 'tb', 'aria-label': tip, title: tip, onclick: function () { if (inst) inst.exec(name); } }); b.appendChild(ic(icon)); return { name: name, tooltip: tip, el: b }; }
      // Same order as Google Docs: undo and redo, then the text style, then bold and italic, then link, then lists.
      inst = new T({ el: box, height: height || '300px', initialEditType: 'wysiwyg', hideModeSwitch: true, usageStatistics: false, initialValue: md || '',
        toolbarItems: [[tool('undo', 'Undo', 'undo'), tool('redo', 'Redo', 'redo')], ['heading', 'bold', 'italic'], ['link'], ['ul', 'ol'], ['table', 'hr', 'quote']] });
      if (onChange) inst.on('change', onChange);
      return inst;
    });
  }
  // A comparison of two texts, with deleted words struck through and new words underlined.
  // Strip the writing marks (**bold**, # headings, links, list dashes, table bars) so people compare words, not symbols.
  function plain(md) {
    return String(md || '').replace(/\r/g, '')
      .replace(/^\s*\|?[\s:|-]+\|[\s:|-]*$/gm, '')                 // table divider rows
      .replace(/^\s{0,3}#{1,6}\s+/gm, '')                            // headings
      .replace(/^\s{0,3}>\s?/gm, '')                                 // quotes
      .replace(/^\s*([-*+]|\d+[.)])\s+/gm, '\u2022 ')                 // list items
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')                     // images
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')                      // links
      .replace(/(\*\*|__)(.+?)\1/g, '$2').replace(/(\*|_)(.+?)\1/g, '$2').replace(/`([^`]+)`/g, '$1')
      .replace(/^\s*\|/gm, '').replace(/\|\s*$/gm, '').replace(/\s*\|\s*/g, '  \u00b7  ')
      .replace(/\n{3,}/g, '\n\n').trim();
  }
  function diffBox(a, b) {
    a = plain(a); b = plain(b);
    var out = h('div', { class: 'diff' });
    L.wordDiff(a, b).forEach(function (p) { out.appendChild(p.t === 'same' ? document.createTextNode(p.s) : h(p.t === 'ins' ? 'ins' : 'del', null, p.s)); });
    return out;
  }

  // The provision list beside a long document: jumps to a clause and follows the reader down the page.
  function withToc(refs, stack) {
    var links = refs.map(function (c) { return h('a', { href: '#', 'data-ref': c.ref, onclick: function (ev) { ev.preventDefault(); var el = document.getElementById(c.ref); if (el) el.scrollIntoView({ behavior: 'smooth' }); } }, h('span', null, c.ref), c.heading); });
    var toc = h('details', { class: 'toc noprint' }, h('summary', null, 'Jump to a provision'), h('nav', { 'aria-label': 'Provisions' }, links));
    var mq = window.matchMedia('(min-width: 1180px)');
    toc.open = mq.matches;
    if (mq.addEventListener) mq.addEventListener('change', function (e) { toc.open = e.matches; });
    links.forEach(function (a) { a.addEventListener('click', function () { if (!mq.matches) toc.open = false; }); });
    if (typeof IntersectionObserver === 'function') {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) links.forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-ref') === e.target.id); }); });
      }, { rootMargin: '-80px 0px -70% 0px' });
      setTimeout(function () { stack.querySelectorAll('.clause').forEach(function (n) { io.observe(n); }); }, 0);
      P.onLeave(function () { io.disconnect(); });
    }
    return h('div', { class: 'doc-layout' }, toc, stack);
  }

  // ---------- Reading (every signed-in member) ----------
  function searchBox(q) {
    var inp = h('input', { type: 'search', class: 'grow', value: q || '', placeholder: 'Search the policy, or type a number like B-9.4', 'aria-label': 'Search the policy' });
    function go() { var t = inp.value.trim(); P.nav(t ? '#/s?q=' + encodeURIComponent(t) : '#/'); }
    inp.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') go(); });
    return h('div', { class: 'row' }, inp, h('button', { class: 'btn', onclick: go }, 'Search'));
  }
  function hero(lead) { return h('div', { class: 'hero' }, h('h1', null, 'Policy'), h('p', { class: 'muted' }, lead)); }
  var LEAD = 'How MedSoc is run, in one place. Every provision has a number you can quote, and every change is recorded in the changelog. If an NTU or School rule conflicts with a MedSoc rule, the NTU or School rule applies.';

  async function memberIndex() {
    P.loading();
    var docs = await rpc('policy_index'), parts = [hero(LEAD), searchBox('')];
    Object.keys(TIER).forEach(function (t) {
      var list = docs.filter(function (d) { return d.tier === t; });
      parts.push(h('h3', null, TIER[t]), h('p', { class: 'sub' }, TIER_NOTE[t]));
      if (!list.length) { parts.push(h('div', { class: 'list' }, h('div', { class: 'item empty' }, t === 'external' ? 'None listed yet.' : t === 'guide' ? 'No Guides published yet.' : 'Nothing published yet.'))); return; }
      parts.push(h('div', { class: 'list' }, list.map(function (d) {
        return h('div', { class: 'item' }, h('a', { class: 't', href: '#/d/' + d.slug, style: 'text-decoration:none' }, d.title), h('div', { class: 's' }, d.summary), h('div', { class: 'meta' }, docPill(d)));
      })));
    });
    P.show(h('div', null, parts));
  }

  P.route('/s', { nav: 'docs', fn: async function (p, q) {
    var t = (q.q || '').trim();
    P.loading();
    var hits = t.length >= 2 ? await rpc('policy_search', { p_q: t }) : [];
    P.show(h('div', null, crumbs([['Documents', '#/'], ['Search']]), searchBox(t),
      h('h3', null, t.length < 2 ? 'Type at least two letters' : hits.length ? hits.length + ' result' + (hits.length === 1 ? '' : 's') + ' for “' + t + '”' : 'Nothing found for “' + t + '”'),
      h('div', { class: 'list' }, hits.map(function (x) {
        return h('div', { class: 'item' }, h('a', { class: 't', href: '#/d/' + x.doc_slug + '?at=' + encodeURIComponent(x.ref), style: 'text-decoration:none' }, h('span', { class: 'ref' }, x.ref), ' ', mark(x.heading, t)),
          h('div', { class: 's' }, x.doc_title), h('div', { class: 's' }, mark(String(x.snippet || '').replace(/[|*#`-]+/g, ' ').replace(/\s+/g, ' ').slice(0, 150) + '…', t)));
      }))));
  } });

  // One document as members read it: the version in force (or an older one with ?v=), with a source note under each provision.
  async function readDoc(p, q) {
    P.loading();
    var v = /^\d{1,4}$/.test(q.v || '') ? +q.v : null;
    var got = await Promise.all([rpc('policy_doc', { p_slug: p.slug, p_version: v }), rpc('policy_changelog', { p_slug: p.slug })]);
    var view = got[0], full = got[1] || [];
    if (!view) { P.show(h('p', { class: 'muted' }, 'That document does not exist, or it is not visible to members yet.')); return; }
    var d = view.doc, draft = d.status === 'draft', past = v !== null && v < d.version;
    var upTo = full.filter(function (e) { return e.version <= d.shown_version; }).sort(function (a, b) { return a.version - b.version; });
    function notes(ref) {
      var out = [];
      upTo.forEach(function (e) {
        if (e.kind === 'adopt') { out.push('Adopted ' + aNo(e.number) + ', in force ' + longDate(e.effective_on)); return; }
        var c = e.changes.filter(function (x) { return x.ref === ref; })[0];
        if (c) out.push({ edit: 'Amended', add: 'Added', repeal: 'Repealed' }[c.action] + ' ' + aNo(e.number) + ', in force ' + longDate(e.effective_on));
      });
      return out;
    }
    var cards = view.clauses.map(function (c) {
      var ns = notes(c.ref);
      return h('div', { class: 'card clause', id: c.ref },
        h('div', { class: 'row' }, h('span', { class: 'ref' }, c.ref)), h('h3', { style: 'margin-top:0' }, c.heading), viewer(c.body_md),
        ns.length ? h('p', { class: 'sub' }, '[' + ns.join('; ') + ']') : null,
        null);
    });
    var parts = [
      crumbs([['Documents', '#/'], [d.title]]), h('h2', { class: 'doc-title' }, d.title), h('p', { class: 'muted' }, d.summary),
      h('div', { class: 'row' }, P.pill(TIER_ONE[d.tier]), past ? P.pill('Version ' + d.shown_version + ' (superseded)', 'warn') : docPill(d), !draft && d.effective_on ? P.pill('in force from ' + longDate(d.effective_on)) : null, P.pill('changed by ' + d.owner)),
      h('div', { class: 'row noprint' }, (function () { var b = h('button', { class: 'ghost', onclick: function () { window.print(); } }, ' Print or save as PDF'); b.prepend(ic('print')); return b; })(),
        (function () { var b = h('button', { class: 'ghost', onclick: function () { P.copy(docLink(d.slug, null, typeof past !== 'undefined' && past ? d.shown_version : null)); } }, ' Copy link'); b.prepend(ic('link')); return b; })()),
      draft ? h('div', { class: 'card' }, h('b', null, 'Draft proposal. '), 'This has not been adopted, so it is not binding yet. The wording can still change.') : null,
      past ? h('div', { class: 'card' }, 'You are reading an older version. ', h('a', { href: '#/d/' + d.slug }, 'Go to the version in force (version ' + d.version + ')'), '.') : null,
      cards.length ? withToc(view.clauses, h('div', { class: 'stack' }, cards)) : h('p', { class: 'muted' }, 'This document has no provisions yet.'),
      h('h3', null, 'Versions'),
      view.versions.length ? h('div', { class: 'list' }, view.versions.map(function (x) {
        return h('div', { class: 'item' }, h('a', { class: 't', href: x.version === d.version ? '#/d/' + d.slug : '#/d/' + d.slug + '?v=' + x.version, style: 'text-decoration:none' }, 'Version ' + x.version), h('div', { class: 's' }, 'from ' + longDate(x.effective_on) + ' · ' + x.title));
      })) : h('p', { class: 'muted' }, 'No version has come into force yet.')
    ];
    P.show(h('div', null, parts));
    if (q.at) {                                     // arriving at one provision: the text viewers settle a moment later and push the page down, so scroll again
      var go = function () { var el = document.getElementById(q.at); if (el && P.current && P.current.path === '/d/' + p.slug) { el.scrollIntoView(); el.classList.add('hit'); } };
      [0, 400, 1000, 2000].forEach(function (ms) { setTimeout(go, ms); });
    }
  }

  // ---------- Documents (ExCo's working view) ----------
  P.route('/', { nav: 'docs', fn: async function (p, q) {
    if (!P.exco) return memberIndex(q);
    P.loading();
    var docs = await rpc('policy_all');
    var parts = [h('div', { class: 'hero' }, h('h1', null, 'Policy'),
      h('p', { class: 'muted' }, 'The Constitution, Bylaws and Guides. A draft can be edited directly; once adopted, a document only changes through a proposal that ExCo approves. Every change is recorded.'), searchBox(''))];
    Object.keys(TIER).forEach(function (t) {
      var list = docs.filter(function (d) { return d.tier === t; });
      parts.push(h('h3', null, TIER[t]), h('p', { class: 'sub' }, TIER_NOTE[t]));
      if (!list.length) { parts.push(h('div', { class: 'list' }, h('div', { class: 'item empty' }, t === 'external' ? 'None listed yet.' : 'Nothing here yet.'))); return; }
      parts.push(h('div', { class: 'list' }, list.map(function (d) {
        var pub = h('input', { type: 'checkbox', checked: d.published, onchange: function (ev) {
          P.run(function () { return rpcv('policy_set_published', { p_slug: d.slug, p_on: ev.target.checked }); }, ev.target.checked ? 'Now visible to members' : 'Hidden from members');
        } });
        return h('div', { class: 'item' },
          h('a', { class: 't', href: '#/d/' + d.slug, style: 'text-decoration:none' }, d.title),
          h('div', { class: 's' }, d.summary),
          h('div', { class: 'meta' }, docPill(d), h('span', { class: 'count' }, d.clauses + ' clauses'), d.open_amendments ? P.pill(d.open_amendments + ' open proposal' + (d.open_amendments > 1 ? 's' : ''), 'warn') : null,
            h('label', { class: 'chk', style: 'margin:0 0 0 auto' }, pub, 'Shown to members')));
      })));
    });
    P.show(h('div', null, parts));
  } });

  // ---------- One document ----------
  P.route('/d/:slug', { nav: 'docs', fn: async function (p, q) {
    if (!P.exco || q.read || q.v) return readDoc(p, q);
    P.loading();
    var w = await rpc('policy_working', { p_slug: p.slug });
    if (!w) { P.show(h('p', { class: 'muted' }, 'That document does not exist.')); return; }
    var d = w.doc, draft = d.status === 'draft';
    var head = [crumbs([['Documents', '#/'], [d.title]]), h('h2', { class: 'doc-title' }, d.title), h('p', { class: 'muted' }, d.summary),
      h('div', { class: 'row' }, P.pill(TIER_ONE[d.tier]), docPill(d), d.effective_on ? P.pill('effective ' + longDate(d.effective_on)) : null, P.pill('changed by ' + d.owner),
        d.published ? P.pill('visible to members', 'ok') : P.pill('hidden from members'))];
    var actions = h('div', { class: 'row' },
      draft ? h('a', { class: 'btn-link solid', href: '#/propose/' + d.slug + '?adopt=1' }, 'Propose adoption') : h('a', { class: 'btn-link solid', href: '#/propose/' + d.slug }, 'Propose a change'),
      (function () { var b = h('button', { class: 'ghost', onclick: function () { window.print(); } }, ' Print or save as PDF'); b.prepend(ic('print')); return b; })(),
        (function () { var b = h('button', { class: 'ghost', onclick: function () { P.copy(docLink(d.slug, null, typeof past !== 'undefined' && past ? d.shown_version : null)); } }, ' Copy link'); b.prepend(ic('link')); return b; })());
    var note = draft
      ? h('div', { class: 'card' }, h('b', null, 'This is a draft. '), 'You can edit any clause directly. Once ExCo adopts it, every change has to be proposed, agreed by ExCo and published.')
      : h('div', { class: 'card' }, h('b', null, 'This document is in force. '), 'To change a clause, use “Propose a change”. The text only changes when the proposal is approved and published.');
    var cards = w.clauses.map(function (c) { return clauseCard(c, d, draft); });
    var parts = [head, actions, note, cards.length ? withToc(w.clauses, h('div', { class: 'stack' }, cards)) : h('div', { class: 'stack' })];
    if (draft) parts.push(addClauseForm(d, w.clauses));
    P.show(h('div', null, parts));
    // Arriving from a link on one provision: go straight to it (edit a draft in place; propose a change to a document in force).
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
          draft ? (function () { var b = h('button', { class: 'ghost', onclick: edit }, ' Edit this clause'); b.prepend(ic('edit')); return b; })() : h('a', { class: 'btn-link', href: '#/propose/' + d.slug + '?ref=' + encodeURIComponent(c.ref) }, 'Propose a change'),
          null));
    }
    function edit() {
      var title = h('input', { class: 'grow', value: c.heading }), ebox = h('div'), ed = null, timer = null, dirty = false;
      var status = h('span', { class: 'savestate', role: 'status', 'aria-live': 'polite' }, 'All changes saved');
      function setStatus(t, cls) { status.textContent = t; status.className = 'savestate' + (cls ? ' ' + cls : ''); }
      // Like Google Docs: there is no Save button. Changes are kept a moment after you stop typing.
      async function save() {
        if (!ed || !dirty) return true;
        dirty = false; setStatus('Saving…');
        try { await rpcv('policy_draft_save', { p_clause: c.id, p_heading: title.value, p_body: ed.getMarkdown() }); c.heading = title.value; c.body_md = ed.getMarkdown(); if (!dirty) setStatus('All changes saved'); return true; }
        catch (e) { dirty = true; setStatus('Not saved. Check your connection; we will try again.', 'bad'); return false; }
      }
      function touch() { dirty = true; setStatus('Saving…'); clearTimeout(timer); timer = setTimeout(save, 1200); }
      title.addEventListener('input', touch);
      P.onLeave(function () { clearTimeout(timer); if (dirty) save(); });
      var done = h('button', { class: 'btn', onclick: async function () { clearTimeout(timer); if (await save()) show(); } }, 'Done');
      box.replaceChildren(h('div', { class: 'row' }, h('span', { class: 'ref' }, c.ref)), P.field('Heading', title), P.field('Text', ebox), h('div', { class: 'row' }, done, status));
      editor(ebox, c.body_md, '320px', touch).then(function (e) { ed = e; });
    }
    show();
    return box;
  }

  function addClauseForm(d, clauses) {
    var title = h('input', { class: 'grow', placeholder: 'Heading' }), ebox = h('div'), ed = null;
    editor(ebox, '', '220px').then(function (e) { ed = e; });
    return h('div', { class: 'card' }, h('h3', { style: 'margin-top:0' }, 'Add a clause'),
      P.field('Heading', title), P.field('Text', ebox),
      h('div', { class: 'row' }, h('button', { class: 'btn', onclick: async function () {
        if (!ed) return;
        var ref = nextRef(clauses.map(function (c) { return c.ref; }), d.tier);
        var ok = await P.run(function () { return rpc('policy_draft_add', { p_doc: d.id, p_ref: ref, p_heading: title.value, p_body: ed.getMarkdown() }); }, 'Clause added as ' + ref);
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
    var reason = h('textarea', { placeholder: 'Why is this needed? ExCo and later readers will see it.' });
    var list = h('div', { class: 'stack' });
    var live = w.clauses.filter(function (c) { return !c.repealed; });

    function addItem(kind, ref) {
      var c = live.filter(function (x) { return x.ref === ref; })[0];
      if (kind !== 'add' && items.some(function (i) { return i.ref === ref; })) { P.toast('That clause is already in this proposal', true); return; }
      var it = { kind: kind, ref: ref, ed: null, heading: h('input', { class: 'grow', value: c ? c.heading : '' }),  };
      var ebox = h('div'), actionSel = P.select([['edit', 'Change the text'], ['repeal', 'Repeal (remove) this clause']], 'edit', { onchange: function () { it.kind = actionSel.value; ebody.hidden = it.kind === 'repeal'; } });
      var ebody = h('div', null, P.field('Heading', it.heading), P.field('New text', ebox));
      var card = h('div', { class: 'card' },
        h('div', { class: 'row' }, kind === 'add' ? h('b', null, 'New clause') : h('span', { class: 'ref' }, ref), kind === 'add' ? null : actionSel,
          h('button', { class: 'ghost', style: 'margin-left:auto', onclick: function () { items.splice(items.indexOf(it), 1); card.remove(); } }, 'Remove')),
        ebody);
      it.card = card; items.push(it); list.appendChild(card);
      var diffWrap = h('div', { class: 'suggest', hidden: true }, h('b', null, 'Your suggestion, as ExCo will see it'), h('div'));
      ebody.appendChild(diffWrap);
      var dt = null;
      function refreshDiff() {
        clearTimeout(dt);
        dt = setTimeout(function () {
          if (!it.ed || !c) return;
          var a = c.heading + '\n\n' + c.body_md, b = it.heading.value + '\n\n' + it.ed.getMarkdown();
          diffWrap.hidden = a === b;
          if (a !== b) diffWrap.lastChild.replaceWith(diffBox(a, b));
        }, 300);
      }
      it.heading.addEventListener('input', refreshDiff);
      editor(ebox, c ? c.body_md : '', '300px', refreshDiff).then(function (e) { it.ed = e; });
    }
    var pick = P.select([['', 'Choose a clause…']].concat(live.map(function (c) { return [c.ref, c.ref + '  ' + c.heading]; })), '');
    var parts = [crumbs([['Documents', '#/'], [d.title, '#/d/' + d.slug], [adopt ? 'Propose adoption' : 'Propose a change']]), h('h2', null, adopt ? 'Propose adoption' : 'Propose a change'),
      h('p', { class: 'muted' }, adopt ? 'This brings the whole document into force exactly as it reads now (' + live.length + ' clauses). ' + TIER_NOTE[d.tier]
        : 'Nothing changes until it is published. ' + TIER_NOTE[d.tier]),
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
        if (it.kind === 'add') { var used = w.clauses.map(function (x) { return x.ref; }).concat(changes.map(function (x) { return x.ref; })); changes.push({ ref: nextRef(used, d.tier), action: 'add', heading: it.heading.value, body_md: it.ed.getMarkdown() }); }
        else changes.push({ ref: it.ref, action: 'edit', heading: it.heading.value, body_md: it.ed.getMarkdown() });
      }
      send.disabled = true;
      var id = await P.run(function () { return rpc('policy_propose', { p_doc: d.id, p_kind: adopt ? 'adopt' : 'change', p_title: title.value, p_reason: reason.value, p_changes: changes, p_name: P.me.name || P.me.email }); }, 'Proposal shared with ExCo');
      send.disabled = false; if (id) P.nav('#/a/' + id);
    } }, 'Share with ExCo');
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
          null));
    })) : h('p', { class: 'muted' }, 'Nothing here.');
    P.show(h('div', null, h('h2', null, 'Proposals'), h('p', { class: 'muted' }, 'Every change to a document in force, and every adoption of a draft, starts here. Open a draft or a clause to propose one.'), chips, list));
  } });

  // ---------- One proposal ----------
  P.route('/a/:id', { nav: 'amend', exco: true, fn: async function (p) {
    P.loading();
    var r = await rpc('policy_amendment', { p_id: p.id });
    if (!r) { P.show(h('p', { class: 'muted' }, 'That proposal does not exist.')); return; }
    var a = r.amendment, d = r.doc;
    function reload() { P.dispatch(); }
    var parts = [crumbs([['Proposals', '#/a'], [aNo(a.number)]]),
      h('div', { class: 'row' }, h('span', { class: 'ref' }, aNo(a.number)), amPill(a.status), P.pill(TIER_ONE[d.tier]), a.kind === 'adopt' ? P.pill('adoption') : null),
      h('h2', null, a.title),
      h('p', { class: 'muted' }, h('a', { href: '#/d/' + d.slug }, d.title), ' · proposed by ' + (a.proposed_by_name || 'someone') + ' on ' + when(a.proposed_at)),
      h('div', { class: 'card' }, h('b', null, 'Why: '), a.reason)];

    // what changes
    if (a.kind === 'adopt') parts.push(h('div', { class: 'card' }, 'Adopting brings the whole document into force as it now reads. ', h('a', { href: '#/d/' + d.slug + '?read=1' }, 'Read it as members see it'), '.'));
    r.changes.forEach(function (c) {
      var body = c.action === 'edit' ? [h('h3', { style: 'margin-top:8px' }, 'Heading'), diffBox(c.old_heading, c.new_heading), h('h3', null, 'Text'), diffBox(c.old_body_md, c.new_body_md),
          h('details', null, h('summary', null, 'Show the new text as it will read'), viewer(c.new_body_md))]
        : c.action === 'add' ? [h('h3', { style: 'margin-top:8px' }, c.new_heading), viewer(c.new_body_md)]
        : [h('p', { class: 'muted' }, 'This clause is removed. Its number is kept and never reused.'), h('div', { class: 'diff' }, h('del', null, plain(c.old_heading + '\n\n' + c.old_body_md)))];
      parts.push(h('div', { class: 'card' }, h('div', { class: 'row' }, h('span', { class: 'ref' }, c.ref), P.pill({ edit: 'Changed', add: 'New clause', repeal: 'Repealed' }[c.action], c.action === 'repeal' ? 'bad' : '')), body));
    });

    // the decision
    var dec = h('div', { class: 'card' }, h('h3', { style: 'margin-top:0' }, 'Decision'));
    if (a.status === 'proposed') {
      var effNow = h('input', { type: 'date', value: new Date(Date.now() + 8 * 36e5).toISOString().slice(0, 10) });
      dec.appendChild(h('p', { class: 'muted' }, 'Once ExCo has agreed this among yourselves, publish it. The new wording replaces the old and the change is recorded in the document’s history. If anyone objects, talk it through first.'));
      dec.appendChild(h('div', { class: 'row' }, P.field('Takes effect on', effNow), h('button', { class: 'btn', onclick: async function () {
        if (!confirm('Publish this change? It replaces the current wording.')) return;
        var v = await P.run(function () { return rpc('policy_publish', { p_id: a.id, p_effective: effNow.value }); });
        if (v) { P.toast('Published as version ' + v); reload(); }
      } }, 'Publish')));
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
    if (a.status === 'in_force') dec.appendChild(h('p', null, 'In force from ' + longDate(a.effective_on) + ' as version ' + a.version_after + '. ', h('a', { href: '#/d/' + d.slug + '?read=1&v=' + a.version_after }, 'Read this version')));
    if (a.status === 'proposed') dec.appendChild(h('div', { class: 'row' }, h('button', { class: 'danger', onclick: async function () {
      if (!confirm('Withdraw this proposal?')) return;
      var ok = await P.run(function () { return rpcv('policy_withdraw', { p_id: a.id }); }, 'Withdrawn'); if (ok) reload();
    } }, 'Withdraw this proposal')));
    parts.push(dec);

    P.show(h('div', null, parts));
  } });
})();
