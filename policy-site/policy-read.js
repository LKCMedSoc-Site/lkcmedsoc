// LKCMedSoc Policy: the page members read. It is the same sheet as the live editor (same type, numbering, outline, folding, zoom and comments), without the editing tools.
// A published version of a document is shown at #/d/:slug (the version in force) or #/d/:slug?v=N (an earlier one).
(function () {
  'use strict';
  var P = window.P, h = P.h;
  function rpc(name, args) { return P.act.rpc(name, args || {}).then(P.must); }
  function myName() { return (P.me && (P.me.name || P.me.email)) || 'Someone'; }
  var COLOURS = ['#c0392b', '#2471a3', '#1e8449', '#b9770e', '#7d3c98', '#117a8b', '#af4f6e', '#5d6d7e'];
  function colourFor(s) { var n = 0; for (var i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) >>> 0; return COLOURS[n % COLOURS.length]; }
  function svg(path, size) { var sp = document.createElement('span'); sp.className = 'lv-ic'; sp.innerHTML = '<svg viewBox="0 0 24 24" width="' + (size || 20) + '" height="' + (size || 20) + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + '</svg>'; return sp; }
  function longDate(s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : ''; }

  P.readDoc = async function (p, q) {
    P.loading();
    if (!window.LiveEditor) { P.show(h('p', { class: 'muted' }, 'The editor library did not load.')); return; }
    var LE = window.LiveEditor, slug = p.slug, want = /^\d{1,4}$/.test((q && q.v) || '') ? +q.v : null;
    var got = await Promise.all([rpc('policy_text', { p_slug: slug, p_version: want }), P.exco ? rpc('policy_note_list', { p_slug: slug }).catch(function () { return []; }) : Promise.resolve([])]);   // comments are for ExCo and the people a document is shared with: members just read
    var data = got[0], notes = got[1] || [];
    if (!data) { P.show(h('p', { class: 'muted' }, 'That document does not exist, or it is not published yet.')); return; }
    var d = data.doc, versions = data.versions || [], shown = d.shown_version || d.version, current = d.version, activeId = null, ed = null;

    // ---- the sheet: organisation, title, description, version token with its log ----
    var logEl = h('div', { class: 'lv-log', id: 'lv-log', hidden: true });
    var token = h('button', { type: 'button', class: 'lv-token', 'aria-expanded': 'false', 'aria-controls': 'lv-log', title: 'Version log',
      onclick: function () { var open = logEl.hidden; logEl.hidden = !open; token.setAttribute('aria-expanded', open ? 'true' : 'false'); token.classList.toggle('open', open); } },
      h('span', null, 'Version ' + shown + (versions.filter(function (v) { return v.version === shown; }).map(function (v) { return v.effective_on ? ' · ' + longDate(v.effective_on) : ''; })[0] || '')), svg('<path d="m6 9 6 6 6-6"/>', 14));
    if (P.exco) logEl.appendChild(h('div', { class: 'lv-log-item draftitem' }, h('div', { class: 'lv-log-h' }, h('b', null, 'Working copy'), ' \u00b7 ', h('a', { href: '#/live/' + slug }, 'Edit')), h('div', { class: 'lv-log-by' }, 'The draft ExCo are editing. Changes here are not published until the President publishes.')));
    versions.slice().sort(function (a, b) { return b.version - a.version; }).forEach(function (v) {
      var isLive = v.version === current, isShown = v.version === shown;
      logEl.appendChild(h('div', { class: 'lv-log-item' + (isLive ? ' live' : ' old') }, h('div', { class: 'lv-log-h' }, h('b', null, 'Version ' + v.version), isLive ? h('span', { class: 'lv-live' }, 'Live now') : null,
        v.effective_on ? ' · ' + longDate(v.effective_on) : '', ' · ', isShown ? h('span', null, 'viewing') : h('a', { href: '#/d/' + slug + (v.version === current ? '' : '?v=' + v.version) }, 'View')),
        h('div', { class: 'lv-log-by' }, 'Published by ' + (v.by || 'the President')), v.note ? h('p', { class: 'lv-log-note' }, v.note) : null));
    });
    var notCurrent = shown < current ? h('div', { class: 'lv-oldnote' }, 'You are reading version ' + shown + '. The version in force is version ' + current + '. ', h('a', { href: '#/d/' + slug }, 'Read the current version')) : null;
    var titleBlock = h('div', { class: 'lv-doctitle' }, h('div', { class: 'lv-org' }, "LKCMedicine Students' Medical Society"), h('h1', { class: 'lv-rtitle' }, d.title), d.summary ? h('p', { class: 'lv-rdesc' }, d.summary) : null,
      h('div', { class: 'lv-meta' }, token, logEl), notCurrent);
    var editorEl = h('div', { class: 'lv-editor' }), notesCol = h('aside', { class: 'lv-notes', 'aria-label': 'Comments' });
    var cmBtn = h('button', { class: 'btn small', type: 'button', hidden: true }, 'Comment');

    // ---- the top bar ----
    var copyBtn = h('button', { type: 'button', class: 'gd-iconbtn', title: 'Copy link', 'aria-label': 'Copy link', onclick: function () { var u = location.origin + location.pathname + '#/d/' + slug + (shown < current ? '?v=' + shown : ''); (P.copy ? P.copy(u) : navigator.clipboard.writeText(u)).then(function () { P.toast('Link copied'); }); } });
    copyBtn.appendChild(svg('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>', 20));
    var pdfBtn = h('button', { type: 'button', class: 'gd-iconbtn', title: 'Save as PDF', 'aria-label': 'Save as PDF', onclick: async function () {
      pdfBtn.disabled = true; P.toast('Preparing the PDF\u2026');
      try { await LE.savePdf(ed.getJSON(), { org: "LKCMedicine Students' Medical Society", title: d.title, summary: d.summary, versionLine: token.textContent, filename: slug + '-v' + shown  }, { resolveImage: resolveImage }); }
      catch (e) { P.toast('Could not make the PDF. Check your connection and try again.', true); }
      pdfBtn.disabled = false; } });
    pdfBtn.appendChild(svg('<path d="M12 4v10m0 0-4-4m4 4 4-4M5 19h14"/>', 20));
    var lvHead = h('div', { class: 'lv-head' }, h('a', { href: '#/' }, '← Documents'), h('h1', null, d.title), h('span', { class: 'lv-spacer' }),
      pdfBtn, copyBtn);

    // ---- toolbar: outline and zoom, as in the editor ----
    var zoom = 1; try { zoom = +localStorage.getItem('policyZoom') || 1; } catch (e) { /* no storage */ }
    var zoomLab = h('button', { type: 'button', class: 'lv-zoomlab', title: 'Back to 100%', onclick: function () { setZoom(1); } }, '100%');
    function setZoom(z, cx, cy) {
      z = Math.min(2.5, Math.max(0.4, z)); if (Math.abs(z - zoom) < 0.0005) return;
      var r0 = lvCol.getBoundingClientRect(), sr = lvScroll.getBoundingClientRect(); if (cx == null) cx = sr.left + sr.width / 2; if (cy == null) cy = window.innerHeight / 2;
      var relX = (cx - r0.left) / zoom, relY = (cy - r0.top) / zoom; zoom = z; lvCol.style.zoom = zoom;
      var r1 = lvCol.getBoundingClientRect(), se = document.scrollingElement || document.documentElement;
      se.scrollTo({ top: se.scrollTop + r1.top + relY * zoom - cy, behavior: 'instant' }); lvScroll.scrollTo({ left: lvScroll.scrollLeft + r1.left + relX * zoom - cx, behavior: 'instant' });
      zoomLab.textContent = Math.round(zoom * 100) + '%'; try { localStorage.setItem('policyZoom', String(zoom)); } catch (e) { /* no storage */ } if (ed) paintNotes(); placeOutline();
    }
    var STEPS = [0.4, 0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5];
    function stepZoom(dir) { var i; if (dir > 0) { for (i = 0; i < STEPS.length && STEPS[i] <= zoom + 0.001; i++); setZoom(STEPS[Math.min(i, STEPS.length - 1)]); } else { for (i = STEPS.length - 1; i >= 0 && STEPS[i] >= zoom - 0.001; i--); setZoom(STEPS[Math.max(i, 0)]); } }
    var zOut = h('button', { type: 'button', class: 'lv-tb', title: 'Zoom out', 'aria-label': 'Zoom out', onclick: function () { stepZoom(-1); } }), zIn = h('button', { type: 'button', class: 'lv-tb', title: 'Zoom in', 'aria-label': 'Zoom in', onclick: function () { stepZoom(1); } });
    zOut.appendChild(svg('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2M8 11h6"/>', 18)); zIn.appendChild(svg('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2M8 11h6M11 8v6"/>', 18));
    var outOpen = window.innerWidth >= 1500; try { var so = localStorage.getItem('policyOutline'); if (so !== null) outOpen = so === '1'; } catch (e) { /* no storage */ }
    var outList = h('nav', { class: 'lv-outlist', 'aria-label': 'Outline' }), outBtn = h('button', { type: 'button', class: 'lv-tb', title: 'Document outline', 'aria-label': 'Document outline', 'aria-pressed': 'false', onclick: function () { setOutline(!outOpen, true); } });
    var outClose = h('button', { type: 'button', class: 'lv-outx', 'aria-label': 'Close the outline', onclick: function () { setOutline(false, true); } }); outClose.appendChild(svg('<path d="M6 6l12 12M18 6 6 18"/>', 16));
    var outPanel = h('aside', { class: 'lv-outline noprint', 'aria-label': 'Outline' }, h('div', { class: 'lv-outhead' }, h('span', null, 'Outline'), outClose), outList);
    outBtn.appendChild(svg('<path d="M4 6h16M4 12h10M4 18h13"/>', 18));
    function setOutline(on, remember) { outOpen = on; outBtn.setAttribute('aria-pressed', on ? 'true' : 'false'); outBtn.classList.toggle('on', on); outPanel.hidden = !on; if (remember) { try { localStorage.setItem('policyOutline', on ? '1' : '0'); } catch (e) { /* no storage */ } } placeOutline(); }
    function placeOutline() {
      if (outPanel.hidden) return; var bar = lvTop.getBoundingClientRect(), col = lvCol.getBoundingClientRect(), top = Math.max(bar.bottom + 12, 12);
      outPanel.style.top = top + 'px'; outPanel.style.left = Math.max(12, col.left - 236) + 'px'; outPanel.style.maxHeight = 'calc(100vh - ' + (top + 16) + 'px)'; outPanel.classList.toggle('over', col.left - 236 < 12);
    }
    var outActive = -1;
    function drawOutline() {
      if (!ed) return; var hs = LE.headings(ed);
      outList.replaceChildren.apply(outList, hs.map(function (hd, i) {
        return h('button', { type: 'button', class: 'lv-outitem' + (i === outActive ? ' on' : ''), onclick: function () { LE.scrollToHeading(ed, hd.pos); } }, h('span', { class: 'lv-outn' }, (i < 26 ? String.fromCharCode(65 + i) : i + 1) + '.'), h('span', { class: 'lv-outt' }, hd.text.trim() || 'Untitled article'));
      }));
    }
    function markOutline() {
      if (!ed || outPanel.hidden) return; var hs = LE.headings(ed), cut = Math.max(lvTop.getBoundingClientRect().bottom + 90, 200), k = -1;
      hs.forEach(function (hd, i) { var t = LE.headingTop(ed, hd.pos); if (t !== null && t <= cut) k = i; });
      if (k !== outActive) { outActive = k; [].slice.call(outList.children).forEach(function (el, i) { el.classList.toggle('on', i === k); }); }
    }
    function onScroll() { placeOutline(); markOutline(); }
    window.addEventListener('scroll', onScroll, { passive: true }); window.addEventListener('resize', onScroll);
    var toolbar = h('div', { class: 'lv-toolbar noprint', role: 'toolbar', 'aria-label': 'View' }, h('div', { class: 'lv-grp' }, outBtn), h('div', { class: 'lv-grp lv-zoom', role: 'group', 'aria-label': 'Zoom' }, zOut, zoomLab, zIn));

    // ---- comments: the same threads as in the editor (members can comment, reply and resolve) ----
    function threads() { var roots = notes.filter(function (n) { return !n.parent_id; }); return roots.map(function (r) { return { root: r, replies: notes.filter(function (n) { return n.parent_id === r.id; }) }; }); }
    function send(name, args) { return rpc(name, args).then(function () { return true; }); }
    // Comment cards line up with the words they are about (like Google Docs): each card sits at the height of its highlight, and a card that would overlap the one above moves down.
    function layoutNotes() {
      var cards = [].slice.call(notesCol.querySelectorAll('.lv-card[data-tid]')), base = notesCol.getBoundingClientRect().top, items = cards.map(function (c) {
        var y = null;
        if (c.getAttribute('data-tid') === 'draft') y = +c.getAttribute('data-y') || 0;
        else { var sp = editorEl.querySelector('[data-note="' + c.getAttribute('data-tid') + '"]'); if (sp) { var rc = sp.getBoundingClientRect(); if (rc.height > 0) y = rc.top - base; else y = null; } else y = 1e9; }   // no highlight at all: the words were changed; the card goes to the end. A highlight folded away hides its card.
        c.classList.toggle('orphan', y === 1e9);
        return { c: c, y: y };
      });
      items.forEach(function (it) { it.c.hidden = it.y === null; });
      items = items.filter(function (it) { return it.y !== null; }).sort(function (a, b) { return a.y - b.y; });
      var bottom = 0; items.forEach(function (it) { var top = Math.max(it.y, bottom ? bottom + 8 : 0); it.c.style.top = Math.max(0, top) + 'px'; bottom = Math.max(0, top) + it.c.offsetHeight; });
      notesCol.style.minHeight = bottom + 'px';
    }
    function paintNotes() {
      if (!ed) return; LE.setNotes(ed, notes.filter(function (n) { return !n.parent_id && !n.resolved; }), activeId);
      notesCol.replaceChildren.apply(notesCol, threads().filter(function (t) { return !t.root.resolved; }).map(function (t) {
        var r = t.root, card = h('div', { class: 'lv-card' + (r.id === activeId ? ' on' : ''), 'data-tid': r.id, onclick: function () { activeId = r.id; paintNotes(); } },
          h('div', { class: 'lv-q' }, '“' + r.quote.slice(0, 80) + (r.quote.length > 80 ? '…' : '') + '”'), [r].concat(t.replies).map(function (n) { return h('div', { class: 'lv-note' }, h('b', null, n.author_name + ': '), n.body); }));
        if (r.id === activeId) {
          var ta = h('input', { type: 'text', placeholder: 'Reply…', class: 'grow' });
          card.appendChild(h('div', { class: 'row' }, ta, h('button', { class: 'btn small', onclick: async function (ev) { ev.stopPropagation(); if (!ta.value.trim()) return; if (await P.run(function () { return send('policy_note_add', { p_slug: slug, p_ref: '', p_quote: r.quote, p_prefix: r.prefix, p_body: ta.value, p_parent: r.id, p_name: myName() }); })) reload(); } }, 'Reply'),
            h('button', { class: 'ghost small', onclick: async function (ev) { ev.stopPropagation(); if (await P.run(function () { return send('policy_note_resolve', { p_id: r.id, p_resolved: true, p_name: myName() }); })) reload(); } }, 'Resolve')));
        }
        return card;
      }));
      layoutNotes();
    }
    async function reload() { try { notes = (await rpc('policy_note_list', { p_slug: slug })) || []; } catch (e) { /* keep */ } paintNotes(); }
    cmBtn.addEventListener('mousedown', function (ev) { ev.preventDefault(); });
    cmBtn.addEventListener('click', function () {
      var qq = LE.selectionQuote(ed); if (!qq) return; var ta = h('textarea', { rows: 3, class: 'grow', placeholder: 'Write a comment' });
      var box = h('div', { class: 'lv-card on' }, h('div', { class: 'lv-q' }, '“' + qq.quote.slice(0, 80) + '”'), ta, h('div', { class: 'row' },
        h('button', { class: 'btn small', onclick: async function () { if (!ta.value.trim()) return; if (await P.run(function () { return send('policy_note_add', { p_slug: slug, p_ref: '', p_quote: qq.quote, p_prefix: qq.prefix, p_body: ta.value, p_parent: null, p_name: myName() }); })) { box.remove(); reload(); } } }, 'Comment'),
        h('button', { class: 'ghost small', onclick: function () { box.remove(); } }, 'Cancel')));
      box.setAttribute('data-tid', 'draft'); box.setAttribute('data-y', String(Math.round(ed.view.coordsAtPos(ed.state.selection.from).top - notesCol.getBoundingClientRect().top)));
      notesCol.prepend(box); layoutNotes(); cmBtn.hidden = true; ta.focus();
    });

    // ---- assemble ----
    var lvCol = h('div', { class: 'lv-col' }, titleBlock, editorEl), lvScroll = h('div', { class: 'lv-scroll' }, lvCol), lvBody = h('div', { class: 'lv-body' + (P.exco ? '' : ' lv-nonotes') }, lvScroll, P.exco ? notesCol : null);
    var lvTop = h('div', { class: 'lv-top' }, lvHead, h('div', { class: 'lv-tbwrap' }, toolbar)), lvEl = h('div', { class: 'lv' }, lvTop, lvBody);
    lvCol.style.zoom = zoom; zoomLab.textContent = Math.round(zoom * 100) + '%';
    lvBody.addEventListener('wheel', function (ev) { if (!(ev.ctrlKey || ev.metaKey)) return; ev.preventDefault(); setZoom(zoom * Math.exp(-ev.deltaY * (ev.deltaMode === 1 ? 0.05 : 0.01)), ev.clientX, ev.clientY); }, { passive: false });
    var gz0 = 1; lvBody.addEventListener('gesturestart', function (ev) { ev.preventDefault(); gz0 = zoom; }); lvBody.addEventListener('gesturechange', function (ev) { ev.preventDefault(); setZoom(gz0 * ev.scale, ev.clientX, ev.clientY); }); lvBody.addEventListener('gestureend', function (ev) { ev.preventDefault(); });
    var pd0 = 0, pz0 = 1; function pdist(t) { return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY); }
    lvBody.addEventListener('touchstart', function (ev) { if (ev.touches.length === 2) { pd0 = pdist(ev.touches); pz0 = zoom; } }, { passive: true });
    lvBody.addEventListener('touchmove', function (ev) { if (ev.touches.length === 2 && pd0) { ev.preventDefault(); setZoom(pz0 * pdist(ev.touches) / pd0, (ev.touches[0].clientX + ev.touches[1].clientX) / 2, (ev.touches[0].clientY + ev.touches[1].clientY) / 2); } }, { passive: false });
    lvBody.addEventListener('touchend', function (ev) { if (ev.touches.length < 2) pd0 = 0; }, { passive: true });
    P.show(lvEl);
    var viewEl = document.getElementById('view'); viewEl.classList.add('lv-wide'); document.body.appendChild(cmBtn); document.body.appendChild(outPanel);
    var imgCache = {};
    function resolveImage(src) {
      var path = String(src || '').replace(/^policy-image:/, ''), hit = imgCache[path]; if (hit && hit.until > Date.now()) return hit.p;
      var pr = P.sb.storage.from('policy-images').createSignedUrl(path, 3600).then(function (x) { if (x.error || !x.data) throw (x.error || new Error('no link')); return x.data.signedUrl; });
      imgCache[path] = { p: pr, until: Date.now() + 50 * 60 * 1000 }; pr.catch(function () { delete imgCache[path]; }); return pr;
    }
    ed = LE.createReader({ resolveImage: resolveImage, element: editorEl, markdown: data.body_md || '', onNoteClick: function (id) { activeId = id; paintNotes(); },
      onSelection: function () { if (!P.exco) return; var s = ed.state.selection; if (s.empty) { cmBtn.hidden = true; return; } var c = ed.view.coordsAtPos(s.to); cmBtn.hidden = false; cmBtn.style.cssText = 'position:fixed;z-index:30;left:' + Math.round(c.left) + 'px;top:' + Math.round(c.bottom + 6) + 'px'; } });
    drawOutline(); setOutline(outOpen); markOutline(); paintNotes();
    if (window.ResizeObserver) { var roN = new ResizeObserver(function () { layoutNotes(); }); roN.observe(editorEl); P.onLeave(function () { roN.disconnect(); }); }
    window.addEventListener('resize', layoutNotes); P.onLeave(function () { window.removeEventListener('resize', layoutNotes); });
    ed.on('transaction', function () { clearTimeout(ed._ln); ed._ln = setTimeout(layoutNotes, 120); });
    P.onLeave(function () { viewEl.classList.remove('lv-wide'); cmBtn.remove(); outPanel.remove(); window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); try { ed.destroy(); } catch (e) { /* closing */ } });
  };
})();
