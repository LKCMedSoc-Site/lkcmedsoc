// LKCMedSoc Policy: the screens. Documents, one document, proposing a change, and proposals.
// Everything goes through the policy_* functions in sql/policy.sql, which check who is asking. Signed-in members can read; only ExCo can edit, propose and publish.
(function () {
  'use strict';
  var P = window.P, h = P.h, L = P.L;
  var TIER = { constitution: 'Constitution', bylaw: 'Bylaws', guide: 'Guides', external: 'NTU and School rules' };
  var TIER_ONE = { constitution: 'Constitution', bylaw: 'Bylaw', guide: 'Guide', external: 'NTU or School rule' };
  var TIER_NOTE = {
    constitution: 'The society’s founding rules. Any ExCo member can edit; the President publishes each new version.',
    bylaw: 'Binding rules. Any ExCo member can edit; the President publishes each new version.',
    guide: 'Advice. Any ExCo member can edit; the President publishes each new version.',
    external: 'Set by NTU, SAO or the School. Linked, not amended here.'
  };
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  var ICONS = {
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    print: '<path d="M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 14h10v7H7z"/>',
    undo: '<path d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3"/>',
    redo: '<path d="m15 14 5-5-5-5M20 9H10a6 6 0 0 0 0 12h3"/>',
    edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4zM14 6l4 4"/>',
    check: '<path d="m5 12 5 5L20 7"/>',
    chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>'
  };
  function ic(name) { var s = document.createElement('span'); s.className = 'ic'; s.setAttribute('aria-hidden', 'true'); s.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + ICONS[name] + '</svg>'; return s; }
  // "Documents > Bylaws": where you are, and a way back up one level.
  function crumbs(trail) {
    return h('nav', { class: 'crumbs noprint', 'aria-label': 'Breadcrumb' }, trail.map(function (t, i) {
      return i === trail.length - 1 ? h('span', { 'aria-current': 'page' }, t[0]) : h('a', { href: t[1] }, t[0]);
    }));
  }
  function mark(text, q) {
    var out = h('span');
    var re = new RegExp('(' + String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
    String(text).split(re).forEach(function (part, i) { out.appendChild(i % 2 ? h('mark', null, part) : document.createTextNode(part)); });
    return out;
  }
  function rpc(name, args) { return P.act.rpc(name, args || {}).then(P.must); }
  // For functions that return nothing: resolve to true so P.run reports success.
  function rpcv(name, args) { return rpc(name, args).then(function () { return true; }); }
  function longDate(s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? (+m[3]) + ' ' + MONTHS[+m[2] - 1] + ' ' + m[1] : ''; }
  function when(s) { return s ? longDate(String(s).slice(0, 10)) : ''; }
  function aNo(n) { return 'A-' + String(n).padStart(3, '0'); }
  function docPill(d) { return d.status === 'in_force' ? P.pill('In force · version ' + d.version, 'dark') : P.pill('Draft · ExCo only', 'warn'); }
  // A link to a document (and a provision in it) inside this app.
  function docLink(slug, ref, v) { var q = []; if (v) q.push('v=' + v); if (ref) q.push('at=' + encodeURIComponent(ref)); return location.origin + location.pathname + '#/d/' + slug + (q.length ? '?' + q.join('&') : ''); }

  // ---------- the rich-text editor (Toast UI, the same one the Gazette uses) ----------
  function tui() { return Promise.resolve(window.toastuiReady).catch(function () { /* handled by the caller */ }).then(function () { return window.toastui && window.toastui.Editor; }); }
  // ---------- Reading (every signed-in member) ----------
  function searchBox(q) {
    var inp = h('input', { type: 'search', class: 'grow', value: q || '', placeholder: 'Search the policy, or type a number like B-9.4', 'aria-label': 'Search the policy' });
    function go() { var t = inp.value.trim(); P.nav(t ? '#/s?q=' + encodeURIComponent(t) : '#/'); }
    inp.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') go(); });
    return h('div', { class: 'row' }, inp, h('button', { class: 'btn', onclick: go }, 'Search'));
  }
  function hero(lead) { return h('div', { class: 'hero' }, h('h1', null, 'Policy'), h('p', { class: 'muted' }, lead)); }
  var LEAD = 'How MedSoc is run, in one place. Every provision has a number you can quote, and every change is recorded in the document’s history. Select any words to comment on them. If an NTU or School rule conflicts with a MedSoc rule, the NTU or School rule applies.';

  // One list of documents, with the type as a plain label and a filter on top.
  function indexView(docs, exco, q) {
    var want = TIER[q.t] ? q.t : '';
    var order = Object.keys(TIER);
    docs = docs.slice().sort(function (a, b) { return order.indexOf(a.tier) - order.indexOf(b.tier); });
    var shown = docs.filter(function (d) { return !want || d.tier === want; });
    var chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Filter by type' },
      order.map(function (t) { return [t, TIER[t] + ' (' + docs.filter(function (d) { return d.tier === t; }).length + ')']; }).map(function (c) {
        var on = want === c[0];   // press the chosen type again to show everything
        return h('a', { class: 'chip' + (on ? ' on' : ''), href: on ? '#/' : '#/?t=' + c[0], style: 'text-decoration:none', 'aria-pressed': on ? 'true' : 'false' }, c[1]);
      }));
    var list = shown.length ? h('div', { class: 'list' }, shown.map(function (d) {
      var meta = [h('span', { class: 'kind' }, TIER_ONE[d.tier]), docPill(d)];
      if (exco) {
      }
      return h('div', { class: 'item' }, h('a', { class: 't', href: '#/d/' + d.slug, style: 'text-decoration:none' }, d.title), h('div', { class: 's' }, d.summary), h('div', { class: 'meta' }, meta));
    })) : h('div', { class: 'list' }, h('div', { class: 'item empty' }, 'Nothing here yet.'));
    var how = h('details', { class: 'how' }, h('summary', null, 'How documents are changed'),
      h('dl', null, order.map(function (t) { return [h('dt', null, TIER[t]), h('dd', null, TIER_NOTE[t])]; })));
    P.show(h('div', null, exco ? h('div', { class: 'hero' }, h('h1', null, 'Policy'), h('p', { class: 'muted' }, 'Any ExCo member can edit a document. Members see it once the President publishes it, and each new version is recorded. Everyone signed in can comment on any passage.'), searchBox(''))
      : [hero(LEAD), searchBox('')], chips, list, how));
  }
  async function memberIndex(q) { P.loading(); indexView(await rpc('policy_index'), false, q || {}); }

  P.route('/s', { nav: 'docs', fn: async function (p, q) {
    var t = (q.q || '').trim();
    P.loading();
    var hits = t.length >= 2 ? await rpc('policy_search', { p_q: t }) : [];
    function snip(x) { return String(x || '').replace(/^#+\s*/gm, '').replace(/[|*`>]+/g, ' ').replace(/\\/g, '').replace(/\s+/g, ' ').trim(); }
    P.show(h('div', null, crumbs([['Documents', '#/'], ['Search']]), searchBox(t),
      h('h3', null, t.length < 2 ? 'Type at least two letters' : hits.length ? hits.length + ' document' + (hits.length === 1 ? '' : 's') + ' mention “' + t + '”' : 'Nothing found for “' + t + '”'),
      h('div', { class: 'list' }, hits.map(function (x) {
        return h('div', { class: 'item' }, h('a', { class: 't', href: '#/d/' + x.doc_slug + '?find=' + encodeURIComponent(x.find || t), style: 'text-decoration:none' }, mark(x.doc_title, t)),
          h('div', { class: 's' }, mark('…' + snip(x.snippet) + '…', t)));
      }))));
  } });

  // ======================================================================
  // One document, like a Google Doc: a sheet you type in (ExCo), comments in the margin (everyone signed in)
  // ======================================================================
  var MORE_ICONS = {
    bold: '<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z"/>',
    italic: '<path d="M19 4h-9M14 20H5M15 4 9 20"/>',
    ul: '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
    ol: '<path d="M10 6h10M10 12h10M10 18h10"/><path d="M4 7V4.5L3.2 5M3.6 13.5c0-1 2.4-1 2.4.2 0 1-2.4 1.8-2.4 2.8h2.6"/>',
    indent: '<path d="M3 6h18M11 12h10M11 18h10M3 9l3 3-3 3"/>',
    outdent: '<path d="M3 6h18M11 12h10M11 18h10M6 9l-3 3 3 3"/>',
    table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16"/>',
    quote: '<path d="M7 7h4v4H7zM13 7h4v4h-4zM9 11c0 3-1 4-3 5M15 11c0 3-1 4-3 5"/>',
    hr: '<path d="M4 12h16"/>'
  };
  Object.keys(MORE_ICONS).forEach(function (k) { ICONS[k] = MORE_ICONS[k]; });

  function textNodes(root) { var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), out = [], n; while ((n = w.nextNode())) out.push(n); return out; }
  function textOf(root) { return textNodes(root).map(function (n) { return n.nodeValue; }).join(''); }
  function findAnchor(text, quote, prefix) {
    if (!quote) return -1;
    var i = prefix ? text.indexOf(prefix + quote) : -1;
    return i >= 0 ? i + prefix.length : text.indexOf(quote);
  }
  // A DOM range for characters [start, end) of the text inside root.
  function rangeAt(root, start, end) {
    var pos = 0, r = document.createRange(), a = false, b = false;
    textNodes(root).forEach(function (n) {
      var len = n.nodeValue.length;
      if (!a && start >= pos && start <= pos + len && start < pos + len) { r.setStart(n, start - pos); a = true; }
      if (a && !b && end > pos && end <= pos + len) { r.setEnd(n, end - pos); b = true; }
      pos += len;
    });
    return a && b ? r : null;
  }
  function clock(iso) { try { return new Date(iso).toLocaleString('en-SG', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }); } catch (e) { return ''; } }
  function myName() { return (P.me && (P.me.name || P.me.email)) || ''; }
  var HL = !!(window.CSS && CSS.highlights && window.Highlight);

  async function docPage(p, q) {
    P.loading();
    var v = /^\d{1,4}$/.test(q.v || '') ? +q.v : null;
    var wantWork = !!P.exco && v === null;                         // ExCo type into the working copy; an older version is read-only
    var got = await Promise.all([wantWork ? rpc('policy_work', { p_slug: p.slug }) : rpc('policy_text', { p_slug: p.slug, p_version: v }), rpc('policy_note_list', { p_slug: p.slug }).catch(function () { return []; })]);
    var data = got[0], notes = got[1] || [];
    if (!data) { P.show(h('p', { class: 'muted' }, 'That document does not exist, or it is not published yet.')); return; }
    var canEdit = wantWork, d = data.doc, draft = d.status === 'draft';
    var text0 = canEdit ? data.working_md : data.body_md, published = canEdit ? data.published_md : data.body_md;
    var rev = canEdit ? data.rev : 0, versions = data.versions || [];
    var past = !canEdit && v !== null && v < d.version;
    var ed = null, bodyEl = null, composerInfo = null, activeId = null, showDone = false, spans = [], dirty = false, timer = null, saving = false, conflict = false;
    var sheetBody = h('div', { class: 'sheetbody' + (d.numbering === 'legal' ? ' legal' : '') });
    var notesCol = h('aside', { class: 'notes-col', 'aria-label': 'Comments' });
    var cmBtn = h('button', { class: 'cmbtn', type: 'button', hidden: true, 'aria-label': 'Comment on the selected words' }, ' Comment'); cmBtn.prepend(ic('chat'));
    var status = h('span', { class: 'savestate', role: 'status', 'aria-live': 'polite' }, '');
    var banner = h('div', { class: 'card conflict', hidden: true });
    var outline = h('details', { class: 'toc noprint' }, h('summary', null, 'Outline'), h('nav', { 'aria-label': 'Outline' }));

    // ---- reading the text back out of the page ----
    function currentMd() { return ed ? ed.getMarkdown() : text0; }
    function rootEl() { return canEdit ? sheetBody.querySelector('.toastui-editor-ww-container .ProseMirror') : sheetBody.querySelector('.toastui-editor-contents'); }

    // ---- publishing bar ----
    var bar = canEdit && !draft ? h('div', { class: 'pubbar quiet' }) : null;
    function unpublished() { return currentMd().trim() !== (published || '').trim(); }
    function drawBar() {
      if (!bar) return;
      if (!unpublished()) { bar.className = 'pubbar quiet'; bar.replaceChildren(h('span', { class: 'count' }, 'Everything you see here is published.')); return; }
      bar.className = 'pubbar';
      var head = h('div', { class: 'pubhead' }, h('b', null, 'This document has changes that members cannot see yet'),
        h('span', { class: 'count' }, 'Members keep reading version ' + d.version + ' until the President publishes your changes.'));
      if (!P.canConfirm) { bar.replaceChildren(head); return; }
      var note = h('input', { class: 'grow', placeholder: 'What changed, in a line (shown in the history)', maxlength: 140 });
      var eff = h('input', { type: 'date', value: new Date(Date.now() + 8 * 36e5).toISOString().slice(0, 10) });
      var go = h('button', { class: 'btn', onclick: async function () {
        if (!(await flush())) return;
        if (!confirm('Publish these changes as version ' + (d.version + 1) + '? Members will see the new wording.')) return;
        go.disabled = true;
        var nv = await P.run(function () { return rpc('policy_text_publish', { p_slug: d.slug, p_note: note.value, p_effective: eff.value, p_name: myName() }); });
        go.disabled = false; if (nv) { P.toast('Published as version ' + nv); P.dispatch(); }
      } }, 'Publish changes');
      bar.replaceChildren(head, h('div', { class: 'row' }, note, h('label', { class: 'inl' }, 'From ', eff), go));
    }

    // ---- saving: as you type, with a guard against two people overwriting each other ----
    function setStatus(t, cls) { status.textContent = t; status.className = 'savestate' + (cls ? ' ' + cls : ''); }
    function showConflict(who) {
      conflict = true; banner.hidden = false;
      banner.replaceChildren(h('b', null, (who || 'Someone') + ' saved a newer copy of this document. '), 'Your latest typing has not been saved. ', h('button', { class: 'ghost small', onclick: function () { try { navigator.clipboard.writeText(currentMd()); P.toast('Your text is copied'); } catch (e) { /* ignore */ } } }, 'Copy my text'), ' ', h('button', { class: 'btn small', onclick: function () { P.dispatch(); } }, 'Load their version'));
      setStatus('Not saved', 'bad');
    }
    async function flush() {
      clearTimeout(timer);
      if (!canEdit || conflict) return !dirty;
      if (!dirty) return true;
      if (saving) return false;
      saving = true; dirty = false; setStatus('Saving…');
      try { rev = await rpc('policy_text_save', { p_slug: d.slug, p_body: currentMd(), p_base_rev: rev, p_name: myName() }); saving = false; if (!dirty) setStatus('All changes saved'); return true; }
      catch (e) { saving = false; dirty = true; var m = String(e && e.message || ''); if (m.indexOf('CONFLICT') === 0) { showConflict(m.replace(/^CONFLICT:\s*/, '').replace(/ saved a newer copy$/, '')); return false; } setStatus('Not saved. Check your connection; we will try again.', 'bad'); timer = setTimeout(flush, 4000); return false; }
    }
    function touch() {
      if (conflict) return;
      dirty = true; setStatus('Saving…'); clearTimeout(timer); timer = setTimeout(flush, 1500);
      scheduleRefresh(); drawBar();
    }

    // ---- comments: highlights on the words, cards in the margin ----
    var refreshT = null;
    function scheduleRefresh() { clearTimeout(refreshT); refreshT = setTimeout(function () { computeSpans(); paint(); layoutNotes(); drawOutline(); }, 350); }
    function threads() { var roots = notes.filter(function (n) { return !n.parent_id; }); return roots.map(function (r) { return { root: r, replies: notes.filter(function (n) { return n.parent_id === r.id; }) }; }); }
    function computeSpans() {
      spans = []; var root = rootEl(); if (!root) return;
      var t = textOf(root);
      threads().forEach(function (th) {
        var r = th.root; if (r.resolved && !showDone) return;
        var i = findAnchor(t, r.quote, r.prefix); if (i < 0) return;
        var rg = rangeAt(root, i, i + r.quote.length); if (rg) spans.push({ id: r.id, start: i, end: i + r.quote.length, range: rg });
      });
      if (composerInfo) { var rg2 = rangeAt(root, composerInfo.start, composerInfo.end); if (rg2) spans.push({ id: 'draft', start: composerInfo.start, end: composerInfo.end, range: rg2 }); }
    }
    function paint() {
      if (!HL) return;
      CSS.highlights.delete('cm'); CSS.highlights.delete('cm-on'); CSS.highlights.delete('cm-draft');
      var a = new Highlight(), b = new Highlight(), c = new Highlight();
      spans.forEach(function (s) { (s.id === 'draft' ? c : s.id === activeId ? b : a).add(s.range); });
      CSS.highlights.set('cm', a); CSS.highlights.set('cm-on', b); CSS.highlights.set('cm-draft', c);
    }
    function spanFor(id) { return spans.filter(function (s) { return s.id === id; })[0]; }
    function threadCard(th) {
      var r = th.root, all = [r].concat(th.replies);
      var card = h('div', { class: 'thread' + (r.id === activeId ? ' on' : '') + (r.resolved ? ' done' : ''), 'data-id': r.id });
      var reply = h('textarea', { rows: 1, placeholder: 'Reply', 'aria-label': 'Reply' });
      var post = h('button', { class: 'btn small', hidden: true, onclick: async function () {
        if (!reply.value.trim()) return; post.disabled = true;
        var ok = await P.run(function () { return rpcv('policy_note_add', { p_slug: d.slug, p_ref: '', p_quote: r.quote, p_prefix: r.prefix, p_body: reply.value, p_parent: r.id, p_name: myName() }); });
        post.disabled = false; if (ok) reloadNotes(r.id);
      } }, 'Reply');
      reply.addEventListener('focus', function () { post.hidden = false; reply.rows = 3; layoutNotes(); });
      var tools = h('div', { class: 'row tools' });
      if (r.mine || P.exco) tools.appendChild(h('button', { class: 'linkbtn', onclick: async function () {
        if (await P.run(function () { return rpcv('policy_note_resolve', { p_id: r.id, p_resolved: !r.resolved, p_name: myName() }); })) reloadNotes(null);
      } }, r.resolved ? 'Reopen' : 'Resolve'));
      var kids = [
        r.quote ? h('div', { class: 'tq' }, '“' + (r.quote.length > 90 ? r.quote.slice(0, 90) + '…' : r.quote) + '”') : null,
        all.map(function (c) {
          return h('div', { class: 'cmt' }, h('div', { class: 'cmeta' }, h('b', null, c.author_name), h('span', null, clock(c.created_at)),
            c.mine || P.exco ? h('button', { class: 'linkbtn x', title: 'Delete', 'aria-label': 'Delete this comment', onclick: async function () {
              if (!confirm(c.id === r.id && th.replies.length ? 'Delete this comment and its replies?' : 'Delete this comment?')) return;
              if (await P.run(function () { return rpcv('policy_note_delete', { p_id: c.id }); })) reloadNotes(null);
            } }, 'Delete') : null), h('p', null, c.body));
        }),
        r.resolved ? h('div', { class: 'sub' }, 'Resolved by ' + (r.resolved_by_name || 'someone')) : null,
        r.resolved ? null : h('div', { class: 'replybox' }, reply, post), tools];
      [].concat.apply([], kids).filter(Boolean).forEach(function (k) { card.appendChild(k); });
      card.addEventListener('click', function (ev) { if (ev.target.closest('textarea, button')) return; focusThread(r.id, true); });
      return card;
    }
    function composerCard() {
      var info = composerInfo, ta = h('textarea', { rows: 3, placeholder: 'Add a comment', 'aria-label': 'Comment' });
      var card = h('div', { class: 'thread composer on', 'data-id': 'draft' }, h('div', { class: 'tq' }, '“' + (info.quote.length > 90 ? info.quote.slice(0, 90) + '…' : info.quote) + '”'), h('div', { class: 'cmeta' }, h('b', null, myName())), ta,
        h('div', { class: 'row' }, h('button', { class: 'btn small', onclick: async function () {
          if (!ta.value.trim()) return;
          var ok = await P.run(function () { return rpcv('policy_note_add', { p_slug: d.slug, p_ref: '', p_quote: info.quote, p_prefix: info.prefix, p_body: ta.value, p_parent: null, p_name: myName() }); });
          if (ok) { composerInfo = null; reloadNotes(null); }
        } }, 'Comment'), h('button', { class: 'ghost small', onclick: function () { composerInfo = null; drawNotes(); } }, 'Cancel')));
      setTimeout(function () { ta.focus(); }, 30);
      return card;
    }
    function drawNotes() {
      var ts = threads(), open = ts.filter(function (t) { return !t.root.resolved; }), done = ts.filter(function (t) { return t.root.resolved; });
      var cards = [];
      if (composerInfo) cards.push(composerCard());
      (showDone ? ts : open).forEach(function (t) { cards.push(threadCard(t)); });
      var foot = done.length ? h('button', { class: 'linkbtn', onclick: function () { showDone = !showDone; drawNotes(); } }, showDone ? 'Hide resolved comments' : 'Show ' + done.length + ' resolved') : null;
      notesCol.replaceChildren(h('div', { class: 'notes-head' }, 'Comments' + (open.length ? ' (' + open.length + ')' : '')), h('div', { class: 'notes-cards' }, cards.length ? cards : h('p', { class: 'sub emptyn' }, 'Select words in the text to comment on them.')), foot);
      computeSpans(); paint(); layoutNotes();
    }
    // On a wide screen each comment sits level with its words; they push each other down so none overlap.
    function layoutNotes() {
      var wide = window.matchMedia('(min-width: 1100px)').matches, host = notesCol.querySelector('.notes-cards'); if (!host) return;
      var cards = [].slice.call(host.querySelectorAll('.thread'));
      if (!wide) { host.style.height = ''; cards.forEach(function (c) { c.style.top = ''; }); return; }
      var base = host.getBoundingClientRect().top + window.scrollY, last = 0;
      cards.forEach(function (c) { c.style.top = '0px'; });
      cards.map(function (c) { var s = spanFor(c.getAttribute('data-id')); return { c: c, y: s ? s.range.getBoundingClientRect().top + window.scrollY - base : 0 }; })
        .sort(function (a, b) { return a.y - b.y; })
        .forEach(function (x) { var top = Math.max(x.y, last); x.c.style.top = top + 'px'; last = top + x.c.offsetHeight + 10; });
      host.style.height = last + 'px';
    }
    function focusThread(id, scroll) {
      activeId = id; drawNotes();
      var s = spanFor(id);
      if (scroll && s) { var y = s.range.getBoundingClientRect().top + window.scrollY - window.innerHeight / 3; window.scrollTo({ top: y, behavior: 'smooth' }); }
    }
    async function reloadNotes(focusId) {
      try { notes = await rpc('policy_note_list', { p_slug: d.slug }); } catch (e) { /* keep what we have */ }
      if (focusId) activeId = focusId;
      drawNotes();
    }
    // Clicking highlighted words opens their comment.
    function offsetAtPoint(x, y) {
      var root = rootEl(); if (!root) return -1;
      var rg = document.caretRangeFromPoint ? document.caretRangeFromPoint(x, y) : null;
      if (!rg && document.caretPositionFromPoint) { var cp = document.caretPositionFromPoint(x, y); if (cp) { rg = document.createRange(); rg.setStart(cp.offsetNode, cp.offset); } }
      if (!rg || !root.contains(rg.startContainer)) return -1;
      var pre = document.createRange(); pre.selectNodeContents(root); pre.setEnd(rg.startContainer, rg.startOffset);
      return pre.toString().length;
    }
    sheetBody.addEventListener('click', function (ev) {
      var sel = window.getSelection(); if (sel && !sel.isCollapsed) return;
      var o = offsetAtPoint(ev.clientX, ev.clientY); if (o < 0) return;
      var hit = spans.filter(function (s) { return s.id !== 'draft' && o >= s.start && o <= s.end; })[0];
      if (hit) focusThread(hit.id, false);
    });
    // Selecting words shows a Comment button beside them.
    function selectionInfo() {
      var sel = window.getSelection(); if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
      var r = sel.getRangeAt(0), root = rootEl(); if (!root || !root.contains(r.commonAncestorContainer)) return null;
      var pre = document.createRange(); pre.selectNodeContents(root); pre.setEnd(r.startContainer, r.startOffset);
      var raw = r.toString(), lead = raw.length - raw.replace(/^\s+/, '').length, quote = raw.trim();
      if (!quote || quote.length > 400) return null;
      var start = pre.toString().length + lead, all = textOf(root);
      return { start: start, end: start + quote.length, quote: quote, prefix: all.slice(Math.max(0, start - 40), start), rect: r.getBoundingClientRect() };
    }
    function onSelect() {
      var info = selectionInfo();
      if (!info) { cmBtn.hidden = true; return; }
      cmBtn.hidden = false; cmBtn.style.top = Math.max(110, info.rect.top - 42) + 'px'; cmBtn.style.left = Math.min(window.innerWidth - 130, info.rect.right) + 'px'; cmBtn._info = info;
    }
    cmBtn.addEventListener('mousedown', function (ev) { ev.preventDefault(); });
    cmBtn.addEventListener('click', function () {
      var info = cmBtn._info; if (!info) return;
      composerInfo = info; cmBtn.hidden = true; window.getSelection().removeAllRanges(); drawNotes();
      var c = notesCol.querySelector('.composer'); if (c && !window.matchMedia('(min-width: 1100px)').matches) c.scrollIntoView({ block: 'center' });
    });

    // ---- the outline on the left (like Docs' document outline) ----
    function drawOutline() {
      var root = rootEl(); if (!root) return;
      var nav = outline.querySelector('nav'), n = 0, items = [];
      [].slice.call(root.querySelectorAll('h2, h3')).forEach(function (hd) {
        var t = hd.textContent.trim(); if (!t) return;
        if (hd.tagName === 'H2' && d.numbering === 'legal') n++;
        items.push(h('a', { href: '#', class: hd.tagName === 'H3' ? 'sub3' : '', onclick: function (ev) { ev.preventDefault(); hd.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, hd.tagName === 'H2' && d.numbering === 'legal' ? h('span', null, n) : null, t));
      });
      nav.replaceChildren(items.length ? items : h('p', { class: 'sub' }, 'Headings you add appear here.'));
    }

    // ---- the editor toolbar ----
    function toolbar() {
      function btn(name, tip, icon, fn) { var b = h('button', { type: 'button', class: 'tb', title: tip, 'aria-label': tip, onmousedown: function (ev) { ev.preventDefault(); }, onclick: function () { if (ed) fn(); } }); b.appendChild(ic(icon)); return b; }
      var styles = h('select', { class: 'styles', 'aria-label': 'Text style', onchange: function () {
        if (!ed) return; var val = styles.value; styles.value = '';
        if (val === 'p') ed.exec('paragraph'); else ed.exec('heading', { level: +val });
        ed.focus();
      } }, h('option', { value: '' }, 'Text style'), h('option', { value: 'p' }, 'Normal text'), h('option', { value: '2' }, d.numbering === 'legal' ? 'Article heading' : 'Heading'), h('option', { value: '3' }, 'Sub-heading'));
      return h('div', { class: 'docbar noprint', role: 'toolbar', 'aria-label': 'Formatting' },
        btn('undo', 'Undo', 'undo', function () { ed.exec('undo'); }), btn('redo', 'Redo', 'redo', function () { ed.exec('redo'); }), h('span', { class: 'sep' }),
        styles, h('span', { class: 'sep' }),
        btn('bold', 'Bold', 'bold', function () { ed.exec('bold'); }), btn('italic', 'Italic', 'italic', function () { ed.exec('italic'); }),
        btn('link', 'Link', 'link', function () { var url = prompt('Link address'); if (!url) return; var sel = window.getSelection().toString(); ed.exec('addLink', { linkUrl: url, linkText: sel || url }); }), h('span', { class: 'sep' }),
        btn('ul', 'Bulleted list', 'ul', function () { ed.exec('bulletList'); }), btn('ol', 'Numbered list', 'ol', function () { ed.exec('orderedList'); }),
        btn('outdent', 'Decrease indent', 'outdent', function () { ed.exec('outdent'); }), btn('indent', 'Increase indent', 'indent', function () { ed.exec('indent'); }), h('span', { class: 'sep' }),
        btn('table', 'Insert table', 'table', function () { ed.exec('addTable', { rowCount: 3, columnCount: 3, data: ['', '', '', '', '', '', '', '', ''] }); }), btn('hr', 'Divider', 'hr', function () { ed.exec('hr'); }), btn('quote', 'Quote', 'quote', function () { ed.exec('blockQuote'); }),
        h('span', { class: 'grow' }), status);
    }

    // ---- build the page ----
    var titlePart = canEdit ? titleBox(d) : h('div', { class: 'titlebox' }, h('h2', { class: 'doc-title' }, d.title), d.summary ? h('p', { class: 'muted' }, d.summary) : null);
    var topLine = canEdit ? publishSwitch(d, draft) : h('div', { class: 'row' }, past ? P.pill('Version ' + d.shown_version + ' (superseded)', 'warn') : docPill(d), d.effective_on ? h('span', { class: 'count' }, 'in force from ' + longDate(d.effective_on)) : null);
    var printBtn = (function () { var b = h('button', { class: 'ghost', onclick: function () { window.print(); } }, ' Print or save as PDF'); b.prepend(ic('print')); return b; })();
    var note = past ? h('div', { class: 'card' }, 'You are reading an older version. ', h('a', { href: '#/d/' + d.slug }, 'Go to the current version'), '.')
      : canEdit ? null : draft ? h('div', { class: 'card' }, 'This is a draft.') : null;
    var hist = versions.length ? [h('h3', null, 'History'), h('div', { class: 'list' }, versions.map(function (x) {
      return h('div', { class: 'item' }, h('a', { class: 't', href: '#/d/' + d.slug + '?v=' + x.version, style: 'text-decoration:none' }, 'Version ' + x.version + (x.note ? ' · ' + x.note : '')), h('div', { class: 's' }, 'from ' + longDate(x.effective_on) + (x.by ? ' · published by ' + x.by : '')));
    }))] : null;
    var stage = h('div', { class: 'stage' }, canEdit ? toolbar() : null,
      h('div', { class: 'sheetrow' }, outline, h('div', { class: 'sheet' }, titlePart, sheetBody), notesCol));
    P.show(h('div', null, crumbs([['Documents', '#/'], [d.title]]), topLine, h('div', { class: 'row noprint' }, printBtn), note, banner, bar, stage, h('div', { class: 'histwrap' }, hist), cmBtn));

    // The editor (or the read-only viewer) needs the rich-text library, so it starts once that has loaded.
    tui().then(function (T) {
      if (!T) { sheetBody.replaceChildren(h('p', { class: 'pill bad' }, 'The text editor could not load. Check your connection and refresh the page.')); return; }
      var host = h('div'); sheetBody.appendChild(host);
      if (canEdit) {
        ed = new T({ el: host, height: 'auto', minHeight: '60vh', initialEditType: 'wysiwyg', hideModeSwitch: true, usageStatistics: false, initialValue: text0, toolbarItems: [], placeholder: 'Start typing…' });
        ed.on('change', touch);
      } else if (T.factory) { T.factory({ el: host, viewer: true, initialValue: text0 }); }
      else host.textContent = text0;
      drawBar(); drawNotes(); drawOutline();
      [300, 900, 2000].forEach(function (ms) { setTimeout(function () { if (P.current && P.current.path === '/d/' + d.slug) { computeSpans(); paint(); layoutNotes(); drawOutline(); } }, ms); });
      if (q.find) {
        var go = function () {
          var root = rootEl(); if (!root) return; var i = textOf(root).toLowerCase().indexOf(String(q.find).toLowerCase()); if (i < 0) return;
          var rg = rangeAt(root, i, i + String(q.find).length); if (!rg) return;
          window.scrollTo({ top: rg.getBoundingClientRect().top + window.scrollY - window.innerHeight / 3 });
          if (HL) { CSS.highlights.set('found', new Highlight(rg)); setTimeout(function () { CSS.highlights.delete('found'); }, 4000); }
        };
        [500, 1200].forEach(function (ms) { setTimeout(go, ms); });
      }
    });

    // Listeners and cleanup go after P.show: showing the page clears what the previous page registered.
    document.addEventListener('mouseup', onSelect); document.addEventListener('keyup', onSelect);
    var hideOnScroll = function () { cmBtn.hidden = true; layoutNotes(); }; window.addEventListener('scroll', hideOnScroll, { passive: true });
    window.addEventListener('resize', layoutNotes);
    var poll = canEdit ? setInterval(async function () {
      if (conflict || saving) return;
      try { var r = await rpc('policy_rev', { p_slug: d.slug }); if (r.rev > rev && !dirty) { banner.hidden = false; banner.replaceChildren(h('b', null, (r.by || 'Someone') + ' has edited this document. '), h('button', { class: 'btn small', onclick: function () { P.dispatch(); } }, 'Show their changes')); } } catch (e) { /* ignore */ }
    }, 20000) : null;
    P.onLeave(function () {
      document.removeEventListener('mouseup', onSelect); document.removeEventListener('keyup', onSelect); window.removeEventListener('scroll', hideOnScroll); window.removeEventListener('resize', layoutNotes);
      if (poll) clearInterval(poll); clearTimeout(refreshT); cmBtn.remove();
      if (HL) { CSS.highlights.delete('cm'); CSS.highlights.delete('cm-on'); CSS.highlights.delete('cm-draft'); CSS.highlights.delete('found'); }
      if (dirty && !conflict) { clearTimeout(timer); flush(); }
    });
    window.addEventListener('beforeunload', function () { if (dirty) flush(); });
  }
  P.route('/d/:slug', { nav: 'docs', fn: docPage });

  // ---------- Documents (the index) ----------
  P.route('/', { nav: 'docs', fn: async function (p, q) {
    if (!P.exco) return memberIndex(q);
    P.loading();
    indexView(await rpc('policy_all'), true, q || {});
  } });

  // The document's name and description: click the text and type. Saved a moment after you stop (ExCo).
  function titleBox(d) {
    var status = h('span', { class: 'savestate', role: 'status', 'aria-live': 'polite' }, '');
    var t = h('textarea', { class: 'doc-title edit-in-place', rows: 1, maxlength: 120, 'aria-label': 'Document name', spellcheck: 'true' });
    var sm = h('textarea', { class: 'muted edit-in-place', rows: 1, maxlength: 400, placeholder: 'Add a description', 'aria-label': 'Description' });
    t.value = d.title; sm.value = d.summary || '';
    var timer = null, dirty = false;
    function fit(el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
    async function save() {
      if (!dirty) return;
      if (t.value.trim().length < 3) { status.textContent = 'The name needs at least 3 letters'; status.className = 'savestate bad'; return; }
      dirty = false; status.textContent = 'Saving…'; status.className = 'savestate';
      try { await rpcv('policy_doc_save', { p_slug: d.slug, p_title: t.value, p_summary: sm.value }); d.title = t.value.trim(); d.summary = sm.value.trim(); if (!dirty) status.textContent = 'All changes saved'; }
      catch (e) { dirty = true; status.textContent = 'Not saved. Check your connection.'; status.className = 'savestate bad'; }
    }
    function touch(ev) { dirty = true; fit(ev.target); status.textContent = 'Saving…'; clearTimeout(timer); timer = setTimeout(save, 1000); }
    [t, sm].forEach(function (el) { el.addEventListener('input', touch); el.addEventListener('blur', function () { clearTimeout(timer); save(); }); });
    t.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); sm.focus(); } });
    P.onLeave(function () { clearTimeout(timer); if (dirty) save(); });
    function fitAll() { fit(t); fit(sm); }
    setTimeout(fitAll, 0); requestAnimationFrame(function () { requestAnimationFrame(fitAll); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitAll);   // the title font arrives late: measure again
    if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', fitAll);
    window.addEventListener('resize', fitAll);
    return h('div', { class: 'titlebox' }, t, sm, h('div', { class: 'row noprint' }, status));
  }

  // One control for "is this document published?". A draft is for ExCo only; publishing shows it to members.
  function publishSwitch(d, draft) {
    var state = draft ? 'off' : 'on';
    var title = draft ? 'Draft · ExCo only' : 'Published · version ' + d.version;
    var sub = draft ? (P.canConfirm ? 'Members cannot see it yet. Switch on to publish it.' : 'Members cannot see it yet. The President publishes it.')
      : (d.effective_on ? 'Members see the published version. In force from ' + longDate(d.effective_on) + '.' : 'Members see the published version.');
    var btn = h('button', { type: 'button', class: 'switch ' + state, role: 'switch', 'aria-checked': draft ? 'false' : 'true', 'aria-label': 'Published', disabled: !draft || !P.canConfirm,
      onclick: async function () {
        if (!confirm('Publish “' + d.title + '”? It comes into force as it reads now, and members can read it.')) return;
        var ok = await P.run(function () { return rpc('policy_text_publish', { p_slug: d.slug, p_note: 'First publication', p_effective: new Date(Date.now() + 8 * 36e5).toISOString().slice(0, 10), p_name: myName() }); }, 'Published');
        if (ok) P.dispatch();
      } }, h('span', { class: 'knob' }));
    return h('div', { class: 'switchrow' }, btn, h('div', { class: 'switchtext' }, h('b', null, title), h('span', null, sub)));
  }
})();
