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
  MORE_ICONS.minus = '<path d="M5 12h14"/>'; MORE_ICONS.plus = '<path d="M12 5v14M5 12h14"/>';
  MORE_ICONS.chevron = '<path d="m9 6 6 6-6 6"/>';
  MORE_ICONS.foldarticles = '<path d="m7 20 5-5 5 5"/><path d="m7 4 5 5 5-5"/>'; MORE_ICONS.foldclauses = '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 12h2"/>'; MORE_ICONS.unfold = '<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>';
  MORE_ICONS.fill = '<path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z"/><path d="m5 2 5 5"/><path d="M2 13h15"/><path d="M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z"/>';
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

  // Everything must sit inside an article (a "## " heading) and, below that, a numbered clause. Anything loose is moved into place:
  // a loose paragraph straight after a heading becomes a new clause, loose text or a table after a clause joins that clause,
  // and anything before the first article goes under a new article. Returns the text unchanged when it is already in order.
  // An article title has one fixed style, so any bold, italic or link marks inside it are removed.
  function plainTitle(line) {
    return line.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/(\*\*|__)(.+?)\1/g, '$2').replace(/(^|[^\w*])\*(?!\s)(.+?)\*(?!\w)/g, '$1$2').replace(/(^|[^\w_])_(?!\s)(.+?)_(?!\w)/g, '$1$2');
  }
  function enforceStructure(md) {
    var lines = String(md || '').split('\n'), out = [], seenH2 = false, inClause = false, emptyAt = -1;
    function needArticle() { if (!seenH2) { out.push('## Untitled article', ''); seenH2 = true; inClause = false; emptyAt = -1; } }
    function openClause(first) { out.push('1. ' + first); inClause = true; emptyAt = first === '' ? out.length - 1 : -1; }
    // the first line of content for a clause that was opened empty goes on the clause's own line (an empty clause followed by indented lines reads as code)
    function addLoose(text, isTable) {
      if (!inClause) { openClause(isTable ? '**New clause**' : text); if (isTable) out.push('', '   ' + text); return; }
      if (emptyAt >= 0) { out[emptyAt] = '1. ' + (isTable ? '**New clause**' : text); if (isTable) out.push('', '   ' + text); emptyAt = -1; return; }
      out.push('   ' + text);
    }
    lines.forEach(function (line) {
      if (/^#{1,6}\s/.test(line)) { out.push(plainTitle(line.replace(/^#{1,6}\s*/, '## '))); seenH2 = true; inClause = false; emptyAt = -1; return; }
      if (/^\s*$/.test(line)) { out.push(line); return; }
      if (/^\d+\.(\s|$)/.test(line)) { needArticle(); out.push(line); inClause = true; emptyAt = /^\d+\.\s*$/.test(line) ? out.length - 1 : -1; return; }
      if (/^ {2,}\S/.test(line) || /^\t/.test(line)) { if (inClause) { out.push(line); emptyAt = -1; } else { needArticle(); addLoose(line.trim(), /^\s*\|/.test(line)); } return; }
      if (/^<br\s*\/?>\s*$/.test(line)) { if (seenH2 && !inClause) openClause(''); return; }   // an empty loose paragraph: a new empty clause after a heading, otherwise nothing
      needArticle();
      addLoose(line, /^\|/.test(line));
    });
    var res = out.join('\n');
    return res.replace(/\n{3,}/g, '\n\n') === String(md || '').replace(/\n{3,}/g, '\n\n') ? md : res;
  }

  async function docPage(p, q) {
    P.loading();
    var v = /^\d{1,4}$/.test(q.v || '') ? +q.v : null;
    var wantWork = !!P.exco && v === null;                         // ExCo type into the working copy; an older version is read-only
    var got = await Promise.all([wantWork ? rpc('policy_work', { p_slug: p.slug }) : rpc('policy_text', { p_slug: p.slug, p_version: v }), rpc('policy_note_list', { p_slug: p.slug }).catch(function () { return []; })]);
    var data = got[0], notes = got[1] || [];
    if (!data) { P.show(h('p', { class: 'muted' }, 'That document does not exist, or it is not published yet.')); return; }
    var canEdit = wantWork, d = data.doc, draft = d.status === 'draft';
    var text0 = canEdit ? data.working_md : data.body_md, published = canEdit ? data.published_md : data.body_md, repairedOnLoad = false;
    if (canEdit) { var fixed0 = enforceStructure(text0); if (fixed0 !== text0) { text0 = fixed0; repairedOnLoad = true; } }
    var rev = canEdit ? data.rev : 0, versions = data.versions || [];
    var past = !canEdit && v !== null && v < d.version;
    var ed = null, bodyEl = null, composerInfo = null, activeId = null, showDone = false, spans = [], dirty = false, timer = null, saving = false, conflict = false;
    var ZOOMS = [0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];
    var zoom = 1; try { zoom = +localStorage.getItem('policyZoom') || 1; } catch (e) { /* no storage */ }
    zoom = Math.min(2, Math.max(0.5, zoom));
    var sheetBody = h('div', { class: 'sheetbody' });
    function applyNumbering() { sheetBody.classList.add('legal'); }                       // every document is numbered the same way
    applyNumbering();
    var notesCol = h('aside', { class: 'notes-col', 'aria-label': 'Comments' });
    var cmBtn = h('button', { class: 'cmbtn', type: 'button', hidden: true, 'aria-label': 'Comment on the selected words' }, ' Comment'); cmBtn.prepend(ic('chat'));
    var status = h('span', { class: 'savestate', role: 'status', 'aria-live': 'polite' }, '');
    var banner = h('div', { class: 'card conflict', hidden: true });
    var outMinBtn = h('button', { type: 'button', class: 'outmin', title: 'Minimise the outline', 'aria-label': 'Minimise the outline' });
    outMinBtn.appendChild(ic('chevron'));
    var outline = h('details', { class: 'toc noprint' }, h('summary', null, h('span', null, 'Outline'), outMinBtn), h('nav', { 'aria-label': 'Outline' }));
    var outHandle = h('div', { class: 'outresize', 'aria-hidden': 'true' });
    outline.appendChild(outHandle);
    var outW = 210; try { outW = +localStorage.getItem('policyOutlineW') || 210; } catch (e) { /* no storage */ }
    outW = Math.min(480, Math.max(180, outW));
    // The outline may only be as wide as the window leaves room for: it must never squeeze the document. (Below 1700px there is no spare room, so it keeps its standard width.)
    function outMax() { var row = stage && stage.querySelector('.sheetrow'), rw = row ? row.getBoundingClientRect().width : 1600; return window.innerWidth >= 1700 ? Math.max(180, Math.min(480, Math.floor((rw - 1000) / 2 - 28))) : 210; }
    function applyOutW() { var w = Math.min(outW, outMax()); stage.style.setProperty('--outw', w + 'px'); return w; }
    var omq = window.matchMedia('(min-width: 1500px)'); outline.open = omq.matches;      // a side panel on wide screens, collapsed above the page on narrower ones
    if (omq.addEventListener) omq.addEventListener('change', function (e) { outline.open = e.matches; });

    // ---- reading the text back out of the page ----
    function currentMd() { return ed ? ed.getMarkdown() : text0; }
    function rootEl() { return canEdit ? sheetBody.querySelector('.toastui-editor-ww-container .ProseMirror') : sheetBody.querySelector('.toastui-editor-contents'); }

    // ---- publishing bar ----
    var bar = canEdit && !draft ? h('div', { class: 'pubbar quiet', hidden: true }) : null;
    var publishedNorm = null;                                   // the published text as the editor would write it, so formatting-only differences do not count as changes
    function normalizeMd(T, md) {
      var box = document.createElement('div'); box.style.cssText = 'position:fixed;left:-9999px;top:0;width:700px'; document.body.appendChild(box);
      try { var tmp = new T({ el: box, height: 'auto', initialEditType: 'wysiwyg', hideModeSwitch: true, usageStatistics: false, initialValue: md, toolbarItems: [] }); var out = tmp.getMarkdown(); tmp.destroy(); return out; }
      catch (e) { return md; } finally { box.remove(); }
    }
    function unpublished() { return publishedNorm !== null && currentMd().trim() !== publishedNorm.trim(); }
    function drawBar() {
      if (!bar) return;
      if (!unpublished()) { bar.hidden = true; bar.replaceChildren(); return; }
      bar.hidden = false; bar.className = 'pubbar';
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
    var lastGood = text0;                                        // the last text that was saved (or loaded): damage is judged against it
    // Signs that the editor mangled the clause structure: empty-paragraph tags, or numbers and bullets that turned into literal text.
    function damage(md, base) {
      function n(re, t) { return (t.match(re) || []).length; }
      var checks = [[/^\s*<br>\s*$/gm, 'empty lines'], [/^\s*\d+\\\. /gm, 'clause numbers turned into plain text'], [/^\s*\\\* /gm, 'bullets turned into plain text']];
      for (var i = 0; i < checks.length; i++) if (n(checks[i][0], md) > n(checks[i][0], base)) return checks[i][1];
      return null;
    }
    function showDamage(what) {
      banner.hidden = false; banner.className = 'card conflict';
      banner.replaceChildren(h('b', null, 'That change was not saved. '), 'The editor mangled the formatting (' + what + '). ', h('button', { class: 'btn small', onclick: function () { if (ed) undoSafe(); } }, 'Undo it'), ' ', h('button', { class: 'ghost small', onclick: function () { P.dispatch(); } }, 'Reload without it'));
      setStatus('Not saved: formatting problem', 'bad');
    }
    async function flush() {
      clearTimeout(timer);
      if (!canEdit || conflict) return !dirty;
      if (!dirty) return true;
      if (saving) return false;
      var md = currentMd(), bad = damage(md, lastGood);
      if (bad) { showDamage(bad); return false; }
      if (!banner.hidden && banner.className.indexOf('conflict') >= 0 && !conflict) banner.hidden = true;
      saving = true; dirty = false; setStatus('Saving…');
      try { rev = await rpc('policy_text_save', { p_slug: d.slug, p_body: md, p_base_rev: rev, p_name: myName() }); lastGood = md; saving = false; if (!dirty) setStatus('All changes saved'); return true; }
      catch (e) { saving = false; dirty = true; var m = String(e && e.message || ''); if (m.indexOf('CONFLICT') === 0) { showConflict(m.replace(/^CONFLICT:\s*/, '').replace(/ saved a newer copy$/, '')); return false; } setStatus('Not saved. Check your connection; we will try again.', 'bad'); timer = setTimeout(flush, 4000); return false; }
    }
    // Nothing may sit outside an article and a clause: if the editor ends up with loose content (Enter after a heading, a table at the top, ...), move it into place.
    var enforceT = null;
    function enforce() {
      if (!ed || !canEdit) return;
      var md = ed.getMarkdown(), fixed = enforceStructure(md); if (fixed === md) return;
      var sel = null; try { sel = ed.getSelection(); } catch (e) { /* no selection */ }
      ed.setMarkdown(fixed, false);
      try { if (sel && sel.length === 2 && typeof sel[0] === 'number') ed.setSelection(sel[0], sel[1]); } catch (e) { /* the cursor stays where the editor put it */ }
      if (!enforce.told) { enforce.told = true; P.toast('Everything has to sit inside an article and a numbered clause, so it was moved there.'); }
    }
    function touch() {
      if (conflict) return;
      dirty = true; setStatus('Saving…'); clearTimeout(timer); timer = setTimeout(flush, 1500);
      clearTimeout(enforceT); enforceT = setTimeout(enforce, 250);
      scheduleRefresh(); drawBar();
    }

    // ---- comments: highlights on the words, cards in the margin ----
    var refreshT = null;
    function scheduleRefresh() { clearTimeout(refreshT); refreshT = setTimeout(function () { applyFold(); computeSpans(); paint(); layoutNotes(); drawOutline(); }, 350); }
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

    // ---- the outline on the left, and sections you can fold away ----
    var folded = {};                                     // "H2|Title|0" -> true
    var foldLayer = h('div', { class: 'foldlayer noprint' });

    // Things that can be folded: every Article heading, and every numbered clause that has more than a first line.
    function foldTargets(root) {
      var seen = {}, out = [], kids = [].slice.call(root.children);
      kids.forEach(function (el, ci) {
        if (/^H[23]$/.test(el.tagName)) { var k = el.tagName + '|' + el.textContent.trim(); seen[k] = (seen[k] || 0) + 1; out.push({ type: 'h', el: el, key: k + '|' + seen[k], ci: ci }); }
        else if (el.tagName === 'OL') [].slice.call(el.children).forEach(function (li, mi) {
          if (li.tagName !== 'LI' || li.children.length < 2) return;
          var k2 = 'LI|' + (li.children[0].textContent || '').trim().slice(0, 60); seen[k2] = (seen[k2] || 0) + 1; out.push({ type: 'li', el: li, key: k2 + '|' + seen[k2], ci: ci, mi: mi });
        });
      });
      return out;
    }
    function headingKeys(root) { return foldTargets(root).filter(function (x) { return x.type === 'h'; }); }
    // Folding hides blocks with a stylesheet that picks them by position, so the editor's own contents are never touched.
    var foldStyle = document.createElement('style'); document.head.appendChild(foldStyle);
    function applyFold() {
      var root = rootEl(); if (!root) return;
      var kids = [].slice.call(root.children), base = canEdit ? '.sheetbody .toastui-editor-ww-container .ProseMirror' : '.sheetbody .toastui-editor-contents', css = [];
      foldTargets(root).forEach(function (x) {
        if (!folded[x.key]) return;
        if (x.type === 'li') {
          var sel = base + ' > :nth-child(' + (x.ci + 1) + ') > :nth-child(' + (x.mi + 1) + ')';
          css.push(sel + ' > :nth-child(n+2) { display: none !important; }');
          return;
        }
        var lvl = x.el.tagName === 'H2' ? 2 : 3, end = x.ci + 1;
        while (end < kids.length && !(/^H[23]$/.test(kids[end].tagName) && (kids[end].tagName === 'H2' ? 2 : 3) <= lvl)) end++;
        if (end > x.ci + 1) css.push(base + ' > :nth-child(n+' + (x.ci + 2) + '):nth-child(-n+' + end + ') { display: none !important; }');
      });
      foldStyle.textContent = css.length ? '@media screen {\n' + css.join('\n') + '\n}' : '';
      drawFoldButtons(); applyTableWidths();
    }
    function drawFoldButtons() {
      var root = rootEl(); if (!root) return;
      var sheet = foldLayer.parentNode; if (!sheet) return; var base = sheet.getBoundingClientRect().top;
      // Centre each chevron on the first line of text of its heading or clause (not on the "Article 2" label above a heading).
      function lineCentre(el) {
        var rg = document.createRange(); rg.selectNodeContents(el); var rs = rg.getClientRects();
        var r = rs.length ? rs[0] : el.getBoundingClientRect(); return r.top + r.height / 2;
      }
      foldLayer.replaceChildren(foldTargets(root).filter(function (x) { return x.el.offsetParent !== null; }).map(function (x) {
        var on = !!folded[x.key], name = (x.el.textContent || '').trim().slice(0, 50), line = x.type === 'li' ? x.el.children[0] : x.el;
        var b = h('button', { type: 'button', class: 'foldbtn' + (on ? ' shut' : ''), 'aria-expanded': on ? 'false' : 'true', title: on ? 'Expand this section' : 'Collapse this section', 'aria-label': (on ? 'Expand ' : 'Collapse ') + name,
          style: 'top:' + Math.round((lineCentre(line) - base) / zoom - 12) + 'px', onmousedown: function (ev) { ev.preventDefault(); },
          onclick: function () { if (on) delete folded[x.key]; else { folded[x.key] = true; if (document.activeElement && root.contains(document.activeElement)) document.activeElement.blur(); } applyFold(); computeSpans(); paint(); layoutNotes(); } });
        b.appendChild(ic('chevron')); return b;
      }));
    }
    function foldAll(how) {
      var root = rootEl(); if (!root) return; folded = {};
      var ts = foldTargets(root);
      if (how === 'articles') { var top = ts.some(function (x) { return x.el.tagName === 'H2'; }) ? 'H2' : 'H3'; ts.forEach(function (x) { if (x.type === 'h' && x.el.tagName === top) folded[x.key] = true; }); }
      if (how === 'clauses') ts.forEach(function (x) { if (x.type === 'li') folded[x.key] = true; });
      applyFold(); computeSpans(); paint(); layoutNotes();
    }
    // ---- table column widths: drag a column border. Widths are kept beside the document (the text format has no place for them). ----
    var tableWidths = JSON.parse(JSON.stringify(d.table_widths || {}));
    var tableStyle = document.createElement('style'); document.head.appendChild(tableStyle);
    var tableLayer = h('div', { class: 'tablelayer noprint' });
    var saveWidthsT = null;
    function tableRows(root) {
      var seen = {}, base = canEdit ? '.sheetbody .toastui-editor-ww-container .ProseMirror' : '.sheetbody .toastui-editor-contents';
      return [].slice.call(root.querySelectorAll('table')).map(function (tb) {
        var first = tb.rows && tb.rows[0], cells = first ? [].slice.call(first.cells) : [];
        var key = cells.map(function (c) { return c.textContent.trim(); }).join('|') || 'table'; seen[key] = (seen[key] || 0) + 1; key += '#' + seen[key];
        var path = [], el = tb;
        while (el && el !== root) { var par = el.parentElement; path.unshift(el.tagName.toLowerCase() + ':nth-child(' + ([].indexOf.call(par.children, el) + 1) + ')'); el = par; }
        return { el: tb, key: key, cols: cells.length, sel: base + ' > ' + path.join(' > ') };
      });
    }
    function applyTableWidths() {
      var root = rootEl(); if (!root) return; var css = [], fillCss = [];
      tableRows(root).forEach(function (t) {
        var fl = tableWidths['~fill|' + t.key];
        if (fl) Object.keys(fl).forEach(function (rc) { var p = rc.split(','); if (/^#[0-9a-f]{6}$/i.test(fl[rc])) fillCss.push(t.sel + (+p[0] === 0 ? ' > thead > tr' : ' > tbody > tr:nth-child(' + p[0] + ')') + ' > :nth-child(' + (+p[1] + 1) + ') { background-color: ' + fl[rc] + ' !important; }'); });
        var w = tableWidths[t.key]; if (!w || w.length !== t.cols) return;
        css.push(t.sel + ' { table-layout: fixed !important; width: 100% !important; }');
        w.forEach(function (pc, i) { css.push(t.sel + ' tr > :nth-child(' + (i + 1) + ') { width: ' + pc + '% !important; overflow-wrap: anywhere; }'); });
      });
      tableStyle.textContent = fillCss.join('\n') + '\n@media screen {\n' + css.join('\n') + '\n}';
      drawTableHandles();
    }
    // Column widths and cell colours are kept beside the text (the text format has no place for them): one small object per document.
    function saveTableData() {
      clearTimeout(saveWidthsT); saveWidthsT = setTimeout(function () { rpcv('policy_table_widths', { p_slug: d.slug, p_widths: tableWidths }).catch(function () { P.toast('Could not save the table layout', true); }); }, 300);
    }
    var FILLS = [['No colour', null], ['Lilac', '#ece0f0'], ['Rose', '#f9dde3'], ['Orange', '#fde6cf'], ['Yellow', '#fdf2c2'], ['Green', '#dcf0dc'], ['Blue', '#d9e8f8'], ['Grey', '#e7e4e8']];
    function selectedCells() {
      var root = rootEl(); if (!root) return [];
      var sel = [].slice.call(root.querySelectorAll('td.selectedCell, th.selectedCell, td[class*="selected"], th[class*="selected"]'));
      if (sel.length) return sel;
      var s = window.getSelection(), n = s && s.anchorNode, el = n && (n.nodeType === 3 ? n.parentElement : n), c = el && root.contains(el) && el.closest('td,th');
      return c ? [c] : [];
    }
    function setFill(hex) {
      var root = rootEl(), cells = selectedCells(); if (!root) return;
      if (!cells.length) { P.toast('Click inside a table cell first.', true); return; }
      var rows = tableRows(root);
      cells.forEach(function (c) {
        var t = rows.filter(function (x) { return x.el === c.closest('table'); })[0]; if (!t) return;
        var k = '~fill|' + t.key, fl = tableWidths[k] || (tableWidths[k] = {}), rc = c.parentElement.rowIndex + ',' + c.cellIndex;
        if (hex) fl[rc] = hex; else delete fl[rc];
        if (!Object.keys(fl).length) delete tableWidths[k];
      });
      applyTableWidths(); saveTableData();
    }
    function fillMenu(anchor) {
      var old = document.querySelector('.fillpop'); if (old) { old.remove(); return; }
      var r = anchor.getBoundingClientRect(), pop = h('div', { class: 'fillpop noprint', role: 'menu', style: 'left:' + Math.round(r.left) + 'px;top:' + Math.round(r.bottom + 6) + 'px' },
        h('div', { class: 'fillhead' }, 'Cell colour'),
        h('div', { class: 'fillgrid' }, FILLS.map(function (f) {
          return h('button', { type: 'button', class: 'fillsw' + (f[1] ? '' : ' none'), title: f[0], 'aria-label': f[0], style: f[1] ? 'background:' + f[1] : '', onmousedown: function (ev) { ev.preventDefault(); }, onclick: function () { setFill(f[1]); pop.remove(); } });
        })));
      document.body.appendChild(pop);
      setTimeout(function () { document.addEventListener('mousedown', function away(ev) { if (!pop.contains(ev.target) && !anchor.contains(ev.target)) { pop.remove(); } if (!pop.isConnected) document.removeEventListener('mousedown', away); }); }, 0);
    }
    function drawTableHandles() {
      if (!canEdit) return;
      var root = rootEl(); if (!root) return; var sheet = tableLayer.parentNode; if (!sheet) return; var sr = sheet.getBoundingClientRect();
      var out = [];
      tableRows(root).forEach(function (t) {
        if (t.el.offsetParent === null || !t.el.rows.length || t.cols < 2) return;
        var tr = t.el.getBoundingClientRect(), cells = [].slice.call(t.el.rows[0].cells);
        for (var i = 0; i < cells.length - 1; i++) (function (i) {
          var cr = cells[i].getBoundingClientRect();
          var hd = h('div', { class: 'colhandle', title: 'Drag to change the column width', style: 'left:' + Math.round((cr.right - sr.left) / zoom) + 'px;top:' + Math.round((tr.top - sr.top) / zoom) + 'px;height:' + Math.round(tr.height / zoom) + 'px' });
          hd.addEventListener('mousedown', function (ev) {
            ev.preventDefault();
            var start = cells.map(function (c) { return c.getBoundingClientRect().width / tr.width * 100; }), x0 = ev.clientX, a = start[i], b = start[i + 1];
            function move(e) {
              var dx = (e.clientX - x0) / tr.width * 100, na = Math.min(a + b - 8, Math.max(8, a + dx)), nb = a + b - na, w = start.slice(); w[i] = Math.round(na * 10) / 10; w[i + 1] = Math.round(nb * 10) / 10;
              tableWidths[t.key] = w; applyTableWidths();
            }
            function up() {
              document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up);
              saveTableData();
            }
            document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
          });
          out.push(hd);
        })(i);
      });
      tableLayer.replaceChildren(out);
    }

    // The outline: every article with its numbered clauses beneath it. A clause is shown by its title, or by its first words.
    var outlineShut = {};                                  // article number -> true when its clauses are hidden in the outline
    function clauseLabel(li) {      // the clause's title or opening words, in full: how much shows is decided by the panel's width (two lines at most)
      var p = li.firstElementChild, t = (p ? p.textContent : li.textContent).replace(/\s+/g, ' ').trim();
      return t ? t.slice(0, 400) : 'Empty clause';
    }
    var pinnedKey = null;                                  // the outline entry you pressed: stays selected until you scroll the page yourself
    function goTo(el, key) {
      if (key) { pinnedKey = key; activeKey = null; markActive(); }
      function flash() {      // a soft highlight on the first line, in the sheet's own layer so the editor never sees it
        var sheet = foldLayer.parentNode; if (!sheet) return;
        var first = el.tagName === 'LI' ? (el.firstElementChild || el) : el, r = first.getBoundingClientRect(), lr = el.getBoundingClientRect(), sr = sheet.getBoundingClientRect();
        var f = h('div', { class: 'jumpflash noprint', style: 'left:' + Math.round((lr.left - sr.left) / zoom - 6) + 'px;top:' + Math.round((r.top - sr.top) / zoom - 3) + 'px;width:' + Math.round(lr.width / zoom + 12) + 'px;height:' + Math.round(Math.min(r.height, 60 * zoom) / zoom + 6) + 'px' });
        sheet.appendChild(f); setTimeout(function () { f.remove(); }, 1900);
      }
      function scroll() { flash(); window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.pageYOffset - 130), behavior: 'smooth' }); }
      if (el.offsetParent === null) { folded = {}; applyFold(); setTimeout(scroll, 80); } else scroll();   // a folded-away target is opened first
    }
    ['wheel', 'touchmove', 'keydown'].forEach(function (t) { window.addEventListener(t, function (e) { if (t === 'keydown' && !/^(Arrow|Page|Home|End| )/.test(e.key)) return; pinnedKey = null; }, { passive: true }); });
    function drawOutline() {
      var root = rootEl(); if (!root) return;
      var nav = outline.querySelector('nav'), arts = [], cur = null;
      [].slice.call(root.children).forEach(function (el) {
        if (el.tagName === 'H2') { var t = el.textContent.trim(); cur = { n: arts.length + 1, title: t || 'Untitled', el: el, clauses: [] }; arts.push(cur); }
        else if (el.tagName === 'OL' && cur) [].slice.call(el.children).forEach(function (li) { if (li.tagName === 'LI') cur.clauses.push({ n: cur.clauses.length + 1, label: clauseLabel(li), el: li }); });
      });
      var tools = arts.length ? h('div', { class: 'foldall' }, h('button', { class: 'linkbtn', onclick: function () { arts.forEach(function (a) { outlineShut[a.n] = true; }); drawOutline(); } }, 'Collapse all'), ' · ', h('button', { class: 'linkbtn', onclick: function () { outlineShut = {}; drawOutline(); } }, 'Expand all')) : null;
      var tree = arts.map(function (a) {
        var shut = !!outlineShut[a.n], list = h('div', { class: 'oclauses', hidden: shut || !a.clauses.length }, a.clauses.map(function (c) {
          return h('a', { href: '#', class: 'oc', title: c.label, 'data-key': a.n + '.' + c.n, onclick: function (ev) { ev.preventDefault(); goTo(c.el, a.n + '.' + c.n); } }, h('span', { class: 'onum' }, a.n + '.' + c.n), h('span', { class: 'otext' }, c.label));
        }));
        var tog = a.clauses.length ? h('button', { type: 'button', class: 'otog' + (shut ? ' shut' : ''), 'aria-expanded': shut ? 'false' : 'true', 'aria-label': (shut ? 'Show' : 'Hide') + ' the clauses of ' + a.title, onclick: function () { outlineShut[a.n] = !shut; drawOutline(); } }) : h('span', { class: 'otog none' });
        tog.appendChild(ic('chevron'));
        return h('div', { class: 'oart' }, h('div', { class: 'oarthead' }, tog, h('a', { href: '#', class: 'oa', title: a.title, 'data-key': String(a.n), onclick: function (ev) { ev.preventDefault(); goTo(a.el, String(a.n)); } }, h('span', { class: 'onum' }, a.n), h('span', { class: 'otext' }, a.title))), list);
      });
      nav.replaceChildren(tools, tree.length ? tree : h('p', { class: 'sub' }, 'Articles and clauses you add appear here.'));
      var sm = outline.querySelector('summary'); if (sm) outline.style.setProperty('--sumh', (sm.offsetHeight || 44) + 'px');
      markActive();
    }
    // Highlight, in the outline, the clause (or article) you are reading.
    var activeKey = null, outlineTouched = 0;
    ['wheel', 'touchmove', 'pointerdown'].forEach(function (t) { outline.addEventListener(t, function () { outlineTouched = Date.now(); }, { passive: true }); });
    function markActive() {
      var root = rootEl(); if (!root) return; var line = 160, best = null, art = 0, cl = 0;
      [].slice.call(root.children).forEach(function (el) {
        if (el.tagName === 'H2') { art++; cl = 0; if (el.offsetParent !== null && el.getBoundingClientRect().top <= line) best = String(art); }
        else if (el.tagName === 'OL') [].slice.call(el.children).forEach(function (li) { cl++; if (li.offsetParent !== null && li.getBoundingClientRect().top <= line) best = art + '.' + cl; });
      });
      if (pinnedKey && outline.querySelector('[data-key="' + pinnedKey + '"]')) best = pinnedKey;
      if (best === activeKey && outline.querySelector('.on')) return; activeKey = best;
      [].slice.call(outline.querySelectorAll('.on')).forEach(function (a) { a.classList.remove('on'); });
      var link = best && outline.querySelector('[data-key="' + best + '"]');
      if (link) {
        link.classList.add('on');
        // keep the current clause in view, unless the reader is scrolling the outline themselves
        if (Date.now() - outlineTouched > 4000 && outline.scrollHeight > outline.clientHeight + 4) {
          var or = outline.getBoundingClientRect(), lr = link.getBoundingClientRect();
          if (lr.top < or.top + 60 || lr.bottom > or.bottom - 40) outline.scrollTop = Math.max(0, outline.scrollTop + (lr.top - or.top) - outline.clientHeight / 3);
        }
      }
    }
    // ---- zoom the document (not the page around it) ----
    var zoomLabel = null;
    var zoomRedraw = null;
    // Zoom keeps the spot under `at` ({x, y} in window coordinates: the mouse, or the middle of the window) where it is.
    function setZoom(z, save, at) {
      var sheetEl = paperView && paperView.querySelector('.sheet'), r0 = sheetEl && sheetEl.getBoundingClientRect(), anchored = false, dx = 0, dy = 0, z0 = zoom;
      var pr = paperView && paperView.getBoundingClientRect();
      at = at || { x: pr ? pr.left + pr.width / 2 : window.innerWidth / 2, y: window.innerHeight / 2 };
      if (r0 && r0.width && r0.height) { dx = at.x - r0.left; dy = at.y - r0.top; anchored = true; }
      zoom = Math.min(2, Math.max(0.5, Math.round(z * 1000) / 1000));
      stage.style.setProperty('--z', zoom); if (zoomLabel) zoomLabel.textContent = Math.round(zoom * 100) + '%';
      if (anchored) {
        var k = zoom / z0, r1 = sheetEl.getBoundingClientRect();   // the spot under the cursor moves k times further from the sheet's corner (one measurement: less layout work, so no judder)
        var sx = (r1.left + dx * k) - at.x, sy = (r1.top + dy * k) - at.y;
        if (Math.abs(sx) > 0.5) paperView.scrollLeft += sx;
        if (Math.abs(sy) > 0.5) window.scrollTo({ top: window.pageYOffset + sy, behavior: 'instant' });
      }
      clearTimeout(zoomRedraw); zoomRedraw = setTimeout(function () {
        if (save !== false) { try { localStorage.setItem('policyZoom', String(zoom)); } catch (e) { /* no storage */ } } window.dispatchEvent(new Event('resize')); applyFold(); computeSpans(); paint(); layoutNotes(); }, 40);   // re-place the chevrons, table handles and comments once the text has resized
    }
    function stepZoom(dir) {
      var next = dir > 0 ? ZOOMS.filter(function (z) { return z > zoom + 0.005; })[0] : ZOOMS.filter(function (z) { return z < zoom - 0.005; }).pop();
      if (next) setZoom(next);
    }
    function zoomControls() {
      function zb(name, tip, icon, fn) { var b = h('button', { type: 'button', class: 'tb', title: tip, 'aria-label': tip, onclick: fn }); b.appendChild(ic(icon)); return b; }
      zoomLabel = h('button', { type: 'button', class: 'zoomlabel', title: 'Back to 100%', 'aria-label': 'Reset zoom', onclick: function () { setZoom(1); } }, Math.round(zoom * 100) + '%');
      return h('span', { class: 'zoomwrap', role: 'group', 'aria-label': 'Zoom' },
        zb('zout', 'Zoom out', 'minus', function () { stepZoom(-1); }), zoomLabel,
        zb('zin', 'Zoom in', 'plus', function () { stepZoom(1); }));
    }

    // ---- the editor toolbar ----
    // Fold the document itself (the outline has its own Collapse all / Expand all).
    function foldButtons() {
      function fb(tip, icon, fn) { var b = h('button', { type: 'button', class: 'tb', title: tip, 'aria-label': tip, onmousedown: function (ev) { ev.preventDefault(); }, onclick: fn }); b.appendChild(ic(icon)); return b; }
      return h('span', { class: 'foldbtns' }, fb('Collapse the document to its articles', 'foldarticles', function () { foldAll('articles'); }), fb('Collapse every clause to its first line', 'foldclauses', function () { foldAll('clauses'); }), fb('Expand the whole document', 'unfold', function () { foldAll(null); }));
    }
    // ---- levels: article title > clause (1.1) > sub-item (a) > sub-item (i). One button goes down a level, one goes up. ----
    function pmView() { return ed && ed.wwEditor && ed.wwEditor.view; }
    var isList = function (n) { return !!n && /List$/.test(n.type.name); };
    function levelAt(state) {      // 0 = an article title, 1..3 = clause, (a), (i); -1 = anywhere else (a table, say)
      var $f = state.selection.$from, n = 0;
      for (var d = $f.depth; d > 0; d--) { var t = $f.node(d).type.name; if (t === 'table') return -1; if (t === 'listItem') n++; }
      if (n === 0) return $f.depth >= 1 && $f.node(1).type.name === 'heading' ? 0 : -1;
      return n;
    }
    function listDepth(list) {     // how many list levels are inside (a list with no nested list is 1)
      var deepest = 0; list.forEach(function (item) { item.forEach(function (c) { if (isList(c)) deepest = Math.max(deepest, listDepth(c)); }); });
      return 1 + deepest;
    }
    // A clause goes up to become an article title. Its sub-items become its clauses; the clauses after it in the same article come along.
    function clauseToArticle(view) {
      var st = view.state, $f = st.selection.$from, S = st.schema, N = S.nodes, ol = $f.node(1), olPos = $f.before(1), idx = $f.index(1);
      if (!isList(ol) || $f.node(2).type.name !== 'listItem') return false;
      var li = ol.child(idx), first = li.firstChild;
      var title = first && first.type.name === 'paragraph' ? first.textContent : li.textContent;            // an article title carries no formatting
      var heading = N.heading.create({ level: 2 }, title ? S.text(title) : null);
      var sub = [], extra = [];
      li.forEach(function (c, off, i) { if (i === 0) return; if (isList(c)) c.forEach(function (it) { sub.push(it); }); else extra.push(c); });
      var items = []; if (extra.length) items.push(N.listItem.create(null, extra)); items = items.concat(sub);
      for (var i = idx + 1; i < ol.childCount; i++) items.push(ol.child(i));
      if (!items.length) items.push(N.listItem.create(null, N.paragraph.create()));
      var parts = [];
      if (idx > 0) { var before = []; for (i = 0; i < idx; i++) before.push(ol.child(i)); parts.push(ol.type.create(ol.attrs, before)); }
      parts.push(heading, ol.type.create(ol.attrs, items));
      var tr = st.tr.replaceWith(olPos, olPos + ol.nodeSize, parts), hPos = olPos + (idx > 0 ? parts[0].nodeSize : 0);
      tr.setSelection(st.selection.constructor.near(tr.doc.resolve(hPos + 1 + heading.content.size), -1));
      view.dispatch(tr.scrollIntoView()); return true;
    }
    // An article title goes down to become the last clause of the article above. Its clauses become that clause's sub-items.
    function articleToClause(view) {
      var st = view.state, $f = st.selection.$from, S = st.schema, N = S.nodes, doc = st.doc, hi = $f.index(0);
      if (hi === 0) return 'This is the first article: there is nothing above it to go under.';
      var prev = doc.child(hi - 1); if (!isList(prev)) return 'There is no clause above to put it under.';
      var head = doc.child(hi), next = hi + 1 < doc.childCount ? doc.child(hi + 1) : null, hasNext = isList(next);
      if (hasNext && listDepth(next) > 2) return 'It has too many levels under it to go down any further.';
      var kids = [N.paragraph.create(null, head.content)]; if (hasNext) kids.push(next);
      var li = N.listItem.create(null, kids), items = []; prev.forEach(function (x) { items.push(x); }); items.push(li);
      var posPrev = 0, posHead = 0; doc.forEach(function (n, off, i) { if (i === hi - 1) posPrev = off; if (i === hi) posHead = off; });
      var end = posHead + head.nodeSize + (hasNext ? next.nodeSize : 0);
      var tr = st.tr.replaceWith(posPrev, end, prev.type.create(prev.attrs, items));
      var liStart = posPrev + 1; for (var i = 0; i < items.length - 1; i++) liStart += items[i].nodeSize;
      tr.setSelection(st.selection.constructor.near(tr.doc.resolve(liStart + 2 + head.content.size), -1));
      view.dispatch(tr.scrollIntoView()); return true;
    }
    function indentLevel() {
      var v = pmView(); if (!v) return; var lv = levelAt(v.state); if (lv < 0) return;
      if (lv === 0) { var r = articleToClause(v); if (r !== true) P.toast(r, true); return; }
      if (lv >= 3) { P.toast('That is the lowest level.', true); return; }
      var before = v.state.doc; ed.exec('indent');
      if (v.state.doc.eq(before)) P.toast('A clause can only go under the clause above it.', true);
    }
    function outdentLevel() {
      var v = pmView(); if (!v) return; var lv = levelAt(v.state); if (lv < 0) return;
      if (lv === 0) { P.toast('This is the top level: an article title.', true); return; }
      if (lv === 1) clauseToArticle(v); else ed.exec('outdent');
    }
    function toolbar() {
      function btn(name, tip, icon, fn) { var b = h('button', { type: 'button', class: 'tb', title: tip, 'aria-label': tip, onmousedown: function (ev) { ev.preventDefault(); }, onclick: function () { if (ed) fn(); } }); b.appendChild(ic(icon)); return b; }
      // Three fixed styles: an article title (always the same), a clause title (bold), and normal text. Words inside normal text can still be bold or italic.
      function caretIn(tag) { var sel = window.getSelection(), n = sel && sel.anchorNode, el = n && (n.nodeType === 3 ? n.parentElement : n), root = rootEl(); return !!(el && root && root.contains(el) && el.closest(tag)); }
      async function setParagraphBold(on) {
        var sel = window.getSelection(), n = sel && sel.anchorNode, el = n && (n.nodeType === 3 ? n.parentElement : n), p = el && el.closest('li > p'); if (!p) { P.toast('Put the cursor in a clause first.', true); return; }
        var rg = document.createRange(); rg.selectNodeContents(p); sel.removeAllRanges(); sel.addRange(rg); document.dispatchEvent(new Event('selectionchange')); await new Promise(function (r) { setTimeout(r, 120); });
        var strongLen = [].slice.call(p.querySelectorAll('strong')).reduce(function (a, x) { return a + x.textContent.length; }, 0), all = strongLen >= p.textContent.length && strongLen > 0, some = strongLen > 0;
        if (on) { if (all) return; if (some) ed.exec('bold'); ed.exec('bold'); } else if (some) ed.exec('bold');
      }
      // Bold with just a cursor (nothing selected) inside a clause makes the clause's first line a bold clause title, or takes it away.
      function boldAction() {
        var sel = window.getSelection();
        if (sel && sel.isCollapsed && caretIn('li > p')) {
          var n = sel.anchorNode, el = n.nodeType === 3 ? n.parentElement : n, p = el.closest('li > p'), len = [].slice.call(p.querySelectorAll('strong')).reduce(function (a, x) { return a + x.textContent.length; }, 0);
          setParagraphBold(!(len > 0 && len >= p.textContent.length)); return;
        }
        ed.exec('bold');
      }
      function fmt(fn) { return function () { if (caretIn('h2')) { P.toast('An article title has one fixed style.', true); return; } fn(); }; }
      return h('div', { class: 'docbar pinbar noprint', role: 'toolbar', 'aria-label': 'Formatting' },
        leadItems(),
        btn('undo', 'Undo', 'undo', function () { undoSafe(); }), btn('redo', 'Redo', 'redo', function () { ed.exec('redo'); }), h('span', { class: 'sep' }),
        btn('outdent', 'Go up a level (Shift+Tab): a clause becomes an article, a sub-item becomes a clause', 'outdent', function () { outdentLevel(); }), btn('indent', 'Go down a level (Tab): an article becomes a clause, a clause becomes a sub-item', 'indent', function () { indentLevel(); }), h('span', { class: 'sep' }),
        btn('bold', 'Bold (with the cursor in a clause and nothing selected: bold clause title)', 'bold', fmt(boldAction)), btn('italic', 'Italic', 'italic', fmt(function () { ed.exec('italic'); })),
        btn('link', 'Link', 'link', fmt(function () { var url = prompt('Link address'); if (!url) return; var sel = window.getSelection().toString(); ed.exec('addLink', { linkUrl: url, linkText: sel || url }); })), h('span', { class: 'sep' }),
        btn('ul', 'Bulleted list', 'ul', function () { ed.exec('bulletList'); }), btn('ol', 'Numbered list', 'ol', function () { ed.exec('orderedList'); }), h('span', { class: 'sep' }),
        btn('table', 'Insert table', 'table', function () { ed.exec('addTable', { rowCount: 3, columnCount: 3, data: ['', '', '', '', '', '', '', '', ''] }); }), btn('hr', 'Divider', 'hr', function () { ed.exec('hr'); }),
        (function () { var b = btn('fill', 'Colour the selected table cells', 'fill', function () { fillMenu(b); }); return b; })(), h('span', { class: 'sep' }), foldButtons(),
        h('span', { class: 'grow' }), zoomControls(), status);
    }

    // ---- build the page ----
    var titlePart = canEdit ? titleBox(d) : h('div', { class: 'titlebox' }, h('h2', { class: 'doc-title' }, d.title), d.summary ? h('p', { class: 'muted' }, d.summary) : null);
    var topLine = canEdit ? publishSwitch(d, draft) : h('div', { class: 'row' }, past ? P.pill('Version ' + d.shown_version + ' (superseded)', 'warn') : docPill(d), d.effective_on ? h('span', { class: 'count' }, 'in force from ' + longDate(d.effective_on)) : null);
    var printBtn = (function () { var b = h('button', { type: 'button', class: 'tb', title: 'Print or save as PDF', 'aria-label': 'Print or save as PDF', onclick: function () { window.print(); } }); b.appendChild(ic('print')); return b; })();
    // The start of the pinned bar: whether the document is published (or a draft), and print.
    function leadItems() { return h('span', { class: 'leadgrp' }, topLine, printBtn, h('span', { class: 'sep' })); }
    var note = past ? h('div', { class: 'card' }, 'You are reading an older version. ', h('a', { href: '#/d/' + d.slug }, 'Go to the current version'), '.')
      : canEdit ? null : draft ? h('div', { class: 'card' }, 'This is a draft.') : null;
    var hist = versions.length ? [h('h3', null, 'History'), h('div', { class: 'list' }, versions.map(function (x) {
      return h('div', { class: 'item' }, h('a', { class: 't', href: '#/d/' + d.slug + '?v=' + x.version, style: 'text-decoration:none' }, 'Version ' + x.version + (x.note ? ' · ' + x.note : '')), h('div', { class: 's' }, 'from ' + longDate(x.effective_on) + (x.by ? ' · published by ' + x.by : '')));
    }))] : null;
    function earlierSaves() {
      var list = h('div', { class: 'list' }), box = h('details', { class: 'earlier noprint' }, h('summary', null, 'Earlier saves'), h('p', { class: 'sub' }, 'A copy of the text is kept every minute or so while you edit. Restoring one replaces the text now (which is also kept).'), list), loaded = false;
      box.addEventListener('toggle', async function () {
        if (!box.open || loaded) return; loaded = true; list.replaceChildren(h('p', { class: 'sub' }, 'Loading…'));
        var items = []; try { items = await rpc('policy_backups', { p_slug: d.slug }); } catch (e) { /* none */ }
        list.replaceChildren(items.length ? items.map(function (b) {
          return h('div', { class: 'item' }, h('div', { class: 't' }, clock(b.saved_at) + (b.by ? ' · ' + b.by : '')), h('div', { class: 's' }, b.preview + '…'),
            h('div', { class: 'meta' }, h('button', { class: 'ghost small', onclick: async function () {
              if (!confirm('Replace the text with this earlier save?')) return;
              if (await P.run(function () { return rpc('policy_restore_backup', { p_slug: d.slug, p_id: b.id, p_name: myName() }); }, 'Restored')) P.dispatch();
            } }, 'Restore this')));
        }) : h('p', { class: 'sub' }, 'No earlier saves yet.'));
      });
      return box;
    }
    var paperView = h('div', { class: 'paperview' }, h('div', { class: 'sheet' }, foldLayer, tableLayer, titlePart, sheetBody));
    function syncColumn() { stage.style.setProperty('--colw', paperView.clientWidth + 'px'); }
    var pinBar = canEdit ? toolbar() : h('div', { class: 'docbar pinbar noprint', role: 'toolbar', 'aria-label': 'View' }, leadItems(), foldButtons(), h('span', { class: 'grow' }), zoomControls());
    var stage = h('div', { class: 'stage' },
      h('div', { class: 'sheetrow' }, outline, h('div', { class: 'sheetcol' }, paperView), notesCol));
    P.show(h('div', null, pinBar, crumbs([['Documents', '#/'], [d.title]]), note, banner, bar, stage, h('div', { class: 'histwrap' }, hist, canEdit ? earlierSaves() : null), cmBtn));

    // The editor (or the read-only viewer) needs the rich-text library, so it starts once that has loaded.
    stage.style.setProperty('--z', zoom); applyOutW(); syncColumn();
    outHandle.addEventListener('mousedown', function (ev) {
      ev.preventDefault(); var x0 = ev.clientX, w0 = outW;
      function move(e) { outW = Math.min(outMax(), Math.max(180, Math.round(w0 + (x0 - e.clientX)))); applyOutW(); }
      function up() {
        document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up);
        try { localStorage.setItem('policyOutlineW', String(outW)); } catch (e) { /* no storage */ }
        setTimeout(function () { syncColumn(); applyFold(); computeSpans(); paint(); layoutNotes(); }, 40);
      }
      document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
    });
    // Wide windows: the outline card can be minimised to its title bar and dragged anywhere (double-click the title bar to put it back).
    var outPos = { x: 0, y: 0 }, outMini = false;
    try { var sp = JSON.parse(localStorage.getItem('policyOutlinePos') || 'null'); if (sp && isFinite(sp.x) && isFinite(sp.y)) outPos = sp; outMini = localStorage.getItem('policyOutlineMin') === '1'; } catch (e) { /* no storage */ }
    function placeOutline() {
      if (window.innerWidth < 1500) { outline.style.translate = ''; return; }
      var tr = outline.style.translate; outline.style.translate = '';
      var r = outline.getBoundingClientRect(), hh = 46;
      outPos.x = Math.min(window.innerWidth - r.right - 4, Math.max(4 - r.left, outPos.x));
      outPos.y = Math.min(window.innerHeight - r.top - hh, Math.max(4 - r.top, outPos.y));
      outline.style.translate = (outPos.x || outPos.y) ? Math.round(outPos.x) + 'px ' + Math.round(outPos.y) + 'px' : '';
      outline.classList.toggle('moved', !!(outPos.x || outPos.y));
    }
    function setMini(m) {
      outMini = m; outline.classList.toggle('min', m); outMinBtn.setAttribute('aria-expanded', m ? 'false' : 'true');
      outMinBtn.title = m ? 'Show the outline' : 'Minimise the outline'; outMinBtn.setAttribute('aria-label', outMinBtn.title);
      try { localStorage.setItem('policyOutlineMin', m ? '1' : '0'); } catch (e) { /* no storage */ }
      setTimeout(placeOutline, 0);
    }
    outMinBtn.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); setMini(!outMini); });
    var outSummary = outline.querySelector('summary');
    outSummary.addEventListener('click', function (ev) { if (window.innerWidth >= 1500) ev.preventDefault(); });
    outSummary.addEventListener('dblclick', function () { if (window.innerWidth < 1500) return; outPos = { x: 0, y: 0 }; placeOutline(); try { localStorage.removeItem('policyOutlinePos'); } catch (e) { /* no storage */ } });
    outSummary.addEventListener('mousedown', function (ev) {
      if (window.innerWidth < 1500 || ev.button !== 0 || ev.target.closest('.outmin')) return;
      ev.preventDefault(); var x0 = ev.clientX, y0 = ev.clientY, p0 = { x: outPos.x, y: outPos.y };
      outline.classList.add('dragging');
      function move(e) { outPos = { x: p0.x + e.clientX - x0, y: p0.y + e.clientY - y0 }; placeOutline(); }
      function up() {
        document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); outline.classList.remove('dragging');
        try { localStorage.setItem('policyOutlinePos', JSON.stringify(outPos)); } catch (e) { /* no storage */ }
      }
      document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
    });
    window.addEventListener('resize', placeOutline); P.onLeave(function () { window.removeEventListener('resize', placeOutline); });
    outline.classList.toggle('min', outMini); outMinBtn.setAttribute('aria-expanded', outMini ? 'false' : 'true'); placeOutline();
    var colObs = window.ResizeObserver ? new ResizeObserver(syncColumn) : null; if (colObs) colObs.observe(paperView);
    tui().then(function (T) {
      if (!T) { sheetBody.replaceChildren(h('p', { class: 'pill bad' }, 'The text editor could not load. Check your connection and refresh the page.')); return; }
      var host = h('div'); sheetBody.appendChild(host);
      if (canEdit) {
        ed = new T({ el: host, height: 'auto', minHeight: '60vh', initialEditType: 'wysiwyg', hideModeSwitch: true, usageStatistics: false, initialValue: text0, toolbarItems: [], placeholder: 'Start typing…' });
        ed.on('change', touch);
        if (repairedOnLoad) { P.toast('Some loose content was moved inside an article and a clause.'); touch(); }
      } else if (T.factory) { T.factory({ el: host, viewer: true, initialValue: text0 }); }
      else host.textContent = text0;
      if (canEdit && !draft) publishedNorm = normalizeMd(T, published || '');
      drawBar(); drawNotes(); drawOutline(); applyFold(); applyTableWidths();
      [300, 900, 2000].forEach(function (ms) { setTimeout(function () { if (P.current && P.current.path === '/d/' + d.slug) { applyFold(); computeSpans(); paint(); layoutNotes(); drawOutline(); } }, ms); });
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

    // Pinching on a trackpad (or Ctrl + scroll) zooms the document, not the page.
    var pinchStart = 1;
    // While you zoom (pinch or Ctrl + scroll) the sheet is only scaled with a transform, which the graphics card does without re-flowing the text.
    // Once you pause, the real zoom is applied in one go, around the same spot, and the transform is dropped.
    var gz = null;
    function previewZoom(z, at) {
      var sheetEl = paperView.querySelector('.sheet'); if (!sheetEl) return;
      if (!gz) {
        var r0 = sheetEl.getBoundingClientRect(), pr = paperView.getBoundingClientRect(), de = document.documentElement;
        gz = { z0: zoom, z: zoom, at: at, t: 0, el: sheetEl, r0: r0, dx: at.x - r0.left, dy: at.y - r0.top, pvLeft: pr.left, C: paperView.clientWidth, sy0: window.pageYOffset, docH: de.scrollHeight, sl0: paperView.scrollLeft };
        paperView.classList.add('zooming'); sheetEl.style.willChange = 'transform';
        gz.L1 = sheetEl.getBoundingClientRect().left;   // where the sheet sits once the container stops scrolling sideways (visible overflow resets the scroll)
        sheetEl.style.transformOrigin = (gz.dx / r0.width * 100) + '% ' + (gz.dy / r0.height * 100) + '%';
      }
      gz.z = Math.min(2, Math.max(0.5, z));
      // Where the page will really end up once the zoom is applied: it can only scroll so far, so the preview is held to the same limits (no jump when you stop).
      var k = gz.z / gz.z0, W1 = gz.r0.width * k, Ld = gz.at.x - gz.dx * k, Lx;
      if (W1 <= gz.C) Lx = gz.pvLeft + (gz.C - W1) / 2; else Lx = gz.pvLeft - Math.min(W1 - gz.C, Math.max(0, gz.pvLeft - Ld));
      var T = gz.r0.top + gz.sy0, Td = gz.at.y - gz.dy * k, maxS = Math.max(0, gz.docH + gz.r0.height * (k - 1) - window.innerHeight);
      var s1 = Math.min(maxS, Math.max(0, T - Td));
      gz.el.style.transform = 'translate(' + ((Lx - gz.L1 + (k - 1) * gz.dx) / gz.z0) + 'px, ' + (((T - s1) - Td) / gz.z0) + 'px) scale(' + k + ')';
      if (zoomLabel) zoomLabel.textContent = Math.round(gz.z * 100) + '%';
      clearTimeout(gz.t); gz.t = setTimeout(commitZoom, 140);
    }
    function commitZoom() {
      if (!gz) return; var g = gz; gz = null; clearTimeout(g.t);
      g.el.style.transform = ''; g.el.style.transformOrigin = ''; g.el.style.willChange = ''; paperView.classList.remove('zooming');
      paperView.scrollLeft = g.sl0;   // back to where it was scrolled, so the zoom is applied from the same picture
      setZoom(g.z, true, g.at);
    }
    function onWheelZoom(ev) {
      if (!ev.ctrlKey || !stage.contains(ev.target)) return;
      ev.preventDefault(); previewZoom((gz ? gz.z : zoom) * Math.exp(-ev.deltaY * 0.01), { x: ev.clientX, y: ev.clientY });
    }
    function gStart(ev) { if (!stage.contains(ev.target)) return; ev.preventDefault(); pinchStart = gz ? gz.z : zoom; }
    function gChange(ev) { if (!stage.contains(ev.target)) return; ev.preventDefault(); previewZoom(pinchStart * ev.scale, { x: ev.clientX, y: ev.clientY }); }
    function gEnd(ev) { if (stage.contains(ev.target)) ev.preventDefault(); }
    document.addEventListener('wheel', onWheelZoom, { passive: false });
    ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (n, i) { document.addEventListener(n, [gStart, gChange, gEnd][i], { passive: false }); });
    P.onLeave(function () { document.removeEventListener('wheel', onWheelZoom); document.removeEventListener('gesturestart', gStart); document.removeEventListener('gesturechange', gChange); document.removeEventListener('gestureend', gEnd); });
    // The editor's history starts from an empty page, so one undo too many would blank the document. If an undo would do that, take it back.
    function undoSafe() {
      if (!ed) return; var before = ed.getMarkdown();
      ed.exec('undo');
      if (!ed.getMarkdown().trim() && before.trim()) { ed.exec('redo'); P.toast('Nothing more to undo.'); }
    }
    // Tab goes down a level, Shift+Tab up (inside a table they keep moving between cells).
    if (canEdit) {
      sheetBody.addEventListener('keydown', function (ev) {
        if (ev.key !== 'Tab' || ev.ctrlKey || ev.metaKey || ev.altKey || !ed) return;
        var v = pmView(); if (!v || levelAt(v.state) < 0) return;
        ev.preventDefault(); ev.stopPropagation(); if (ev.shiftKey) outdentLevel(); else indentLevel();
      }, true);
    }
    // Undo and redo: Cmd or Ctrl + Z, Ctrl + Y, Shift + Z. All of them go through undoSafe / redoSafe, so undoing can never empty the page.
    if (canEdit) {
      sheetBody.addEventListener('keydown', function (ev) {
        if (!(ev.ctrlKey || ev.metaKey) || ev.altKey || !ed) return;
        var k = (ev.key || '').toLowerCase();
        if (k === 'z' && !ev.shiftKey) { ev.preventDefault(); ev.stopPropagation(); undoSafe(); }
        else if (k === 'y' || (k === 'z' && ev.shiftKey)) { ev.preventDefault(); ev.stopPropagation(); ed.exec('redo'); }
      }, true);
    }
    // Listeners and cleanup go after P.show: showing the page clears what the previous page registered.
    document.addEventListener('mouseup', onSelect); document.addEventListener('keyup', onSelect);
    var activeT = null;
    var hideOnScroll = function () { cmBtn.hidden = true; layoutNotes(); clearTimeout(activeT); activeT = setTimeout(markActive, 80); }; window.addEventListener('scroll', hideOnScroll, { passive: true });
    window.addEventListener('resize', layoutNotes); window.addEventListener('resize', drawTableHandles); window.addEventListener('resize', applyOutW);
    var poll = canEdit ? setInterval(async function () {
      if (conflict || saving) return;
      try { var r = await rpc('policy_rev', { p_slug: d.slug }); if (r.rev > rev && !dirty) { banner.hidden = false; banner.replaceChildren(h('b', null, (r.by || 'Someone') + ' has edited this document. '), h('button', { class: 'btn small', onclick: function () { P.dispatch(); } }, 'Show their changes')); } } catch (e) { /* ignore */ }
    }, 20000) : null;
    P.onLeave(function () {
      document.removeEventListener('mouseup', onSelect); document.removeEventListener('keyup', onSelect); window.removeEventListener('scroll', hideOnScroll); window.removeEventListener('resize', layoutNotes);
      if (poll) clearInterval(poll); clearTimeout(refreshT); cmBtn.remove(); foldStyle.remove(); tableStyle.remove(); if (colObs) colObs.disconnect(); window.removeEventListener('resize', drawTableHandles); window.removeEventListener('resize', applyOutW);
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
    function fit(el) { el.style.height = 'auto'; el.style.height = (el.scrollHeight + 3) + 'px'; }   // a few pixels spare so the last line is never cut
    async function save() {
      if (!dirty) return;
      if (t.value.trim().length < 3) { status.textContent = 'The name needs at least 3 letters'; status.className = 'savestate bad'; return; }
      dirty = false; status.textContent = ''; status.className = 'savestate';
      try { await rpcv('policy_doc_save', { p_slug: d.slug, p_title: t.value, p_summary: sm.value }); d.title = t.value.trim(); d.summary = sm.value.trim(); status.textContent = ''; }   // saved quietly: only a problem is worth a message here
      catch (e) { dirty = true; status.textContent = 'Not saved. Check your connection.'; status.className = 'savestate bad'; }
    }
    function touch(ev) { dirty = true; fit(ev.target); status.textContent = ''; clearTimeout(timer); timer = setTimeout(save, 1000); }
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
    var sub = draft ? (P.canConfirm ? 'Switch on to publish' : 'The President publishes it')
      : (d.effective_on ? 'In force from ' + longDate(d.effective_on) : 'Members can read it');
    var tip = draft ? 'Members cannot see it yet.' + (P.canConfirm ? ' Switch on to publish it.' : ' The President publishes it.') : 'Members see the published version.';
    var btn = h('button', { type: 'button', class: 'switch ' + state, role: 'switch', 'aria-checked': draft ? 'false' : 'true', 'aria-label': 'Published', disabled: !draft || !P.canConfirm,
      onclick: async function () {
        if (!confirm('Publish “' + d.title + '”? It comes into force as it reads now, and members can read it.')) return;
        var ok = await P.run(function () { return rpc('policy_text_publish', { p_slug: d.slug, p_note: 'First publication', p_effective: new Date(Date.now() + 8 * 36e5).toISOString().slice(0, 10), p_name: myName() }); }, 'Published');
        if (ok) P.dispatch();
      } }, h('span', { class: 'knob' }));
    return h('div', { class: 'switchrow', title: tip }, btn, h('div', { class: 'switchtext' }, h('b', null, title), h('span', null, sub)));
  }
})();
