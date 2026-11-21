// LKCMedSoc Policy: live editing of the working copy (several people typing at once, with cursors). Route #/live/:slug.
// The editor is built from tools/live-editor into live-editor.js. Changes travel between browsers on a private Realtime channel and are kept in the database
// (policy_live_* functions in sql/policy_live.sql); comments are the same policy_notes the ordinary page uses, so they show on the published copy too.
(function () {
  'use strict';
  var P = window.P, h = P.h;
  function rpc(name, args) { return P.act.rpc(name, args || {}).then(P.must); }
  function myName() { return (P.me && (P.me.name || P.me.email)) || 'Someone'; }
  var COLOURS = ['#c0392b', '#2471a3', '#1e8449', '#b9770e', '#7d3c98', '#117a8b', '#af4f6e', '#5d6d7e'];
  function colourFor(s) { var n = 0; for (var i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) >>> 0; return COLOURS[n % COLOURS.length]; }

  async function livePage(p) {
    P.loading();
    if (!window.LiveEditor) { P.show(h('p', { class: 'muted' }, 'The live editor did not load.')); return; }
    var LE = window.LiveEditor, Y = LE.Y, slug = p.slug;
    var data = await rpc('policy_live_open', { p_slug: slug });
    if (!data) { P.show(h('p', { class: 'muted' }, 'Live editing is not switched on for this document.')); return; }
    var ydoc = new Y.Doc(), awareness = new LE.Awareness(ydoc), canEdit = data.access === 'edit', lastId = data.last_id || 0, epoch = data.epoch || 1;
    var canWork = P.exco || canEdit;   // ExCo and people shared with as Editor: rename, version history, restore
    var ed = null, notes = [], activeId = null, pending = [], pushT = null, pushing = false, closed = false, status = h('span', { class: 'savestate', role: 'status', 'aria-live': 'polite' }, 'Connecting…');

    // ---- the channel: changes and cursors go straight to the other browsers ----
    var chan = P.sb.channel('policy-live:' + slug, { config: { private: true, broadcast: { self: false } } });
    function send(ev, payload) { try { chan.send({ type: 'broadcast', event: ev, payload: payload }); } catch (e) { /* the database copy still has it */ } }
    chan.on('broadcast', { event: 'u' }, function (m) { Y.applyUpdate(ydoc, LE.unb64(m.payload.u), 'remote'); });
    chan.on('broadcast', { event: 'a' }, function (m) { LE.applyAwarenessUpdate(awareness, LE.unb64(m.payload.a), 'remote'); });
    chan.on('broadcast', { event: 'hello' }, function () { announce(); });
    chan.on('broadcast', { event: 'notes' }, function () { reloadNotes(); });
    function announce() { if (awareness.getLocalState()) send('a', { a: LE.b64(LE.encodeAwarenessUpdate(awareness, [ydoc.clientID])) }); }
    awareness.on('update', function (c, origin) { if (origin !== 'remote') send('a', { a: LE.b64(LE.encodeAwarenessUpdate(awareness, c.added.concat(c.updated, c.removed))) }); drawPeople(); });
    ydoc.on('update', function (u, origin) {
      if (origin === 'remote' || !canEdit) return;
      send('u', { u: LE.b64(u) }); pending.push(u); setStatus('Saving…'); clearTimeout(pushT); pushT = setTimeout(push, 1200);
    });
    async function push() {
      if (!pending.length || pushing || closed) return;
      pushing = true; var batch = pending; pending = [];
      try { var id = await rpc('policy_live_push', { p_slug: slug, p_update: LE.b64(Y.mergeUpdates(batch)), p_md: LE.markdownOf(ed), p_name: myName(), p_epoch: epoch }); lastId = Math.max(lastId, id); setStatus('All changes saved'); }
      catch (e) { if (/EPOCH/.test(String(e && e.message))) { stale(); pushing = false; return; } pending = batch.concat(pending); setStatus('Not saved. Will retry.', 'bad'); clearTimeout(pushT); pushT = setTimeout(push, 4000); }
      pushing = false; if (pending.length) { clearTimeout(pushT); pushT = setTimeout(push, 300); }
    }
    function stale() { closed = true; pending = []; setStatus('This document was restored from an earlier save. Reload the page.', 'bad'); try { ed.setEditable(false); } catch (e) { /* none */ } P.toast('This document was restored from an earlier save. Reload the page to continue.', true); }
    function setStatus(t, kind) { status.textContent = t; status.className = 'savestate' + (kind ? ' ' + kind : ''); }

    // ---- loading the shared document ----
    await new Promise(function (ok) { chan.subscribe(function (s) { if (s === 'SUBSCRIBED' || s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') ok(s); }); });
    if (!data.state) {                                            // nobody has opened it yet: the first editor turns the markdown into the shared document
      if (!canEdit) { P.show(h('p', { class: 'muted' }, 'Nobody has started live editing of this document yet.')); return; }
      var tmp = new Y.Doc(); LE.seed(tmp, data.working_md);
      await rpc('policy_live_init', { p_slug: slug, p_state: LE.b64(Y.encodeStateAsUpdate(tmp)), p_epoch: epoch });
      data = await rpc('policy_live_open', { p_slug: slug });
    }
    Y.applyUpdate(ydoc, LE.unb64(data.state), 'remote');
    (data.updates || []).forEach(function (u) { Y.applyUpdate(ydoc, LE.unb64(u), 'remote'); });
    lastId = data.last_id || 0;
    if (canEdit && (data.updates || []).length > 40) { rpc('policy_live_compact', { p_slug: slug, p_state: LE.b64(Y.encodeStateAsUpdate(ydoc)), p_upto: lastId, p_epoch: epoch }).catch(function () { /* next time */ }); }

    // ---- the page ----
    var me = { name: myName(), color: colourFor(P.me && P.me.email || myName()) };
    var editorEl = h('div', { class: 'lv-editor' }), people = h('div', { class: 'lv-people', 'aria-label': 'Who is here' }), notesCol = h('aside', { class: 'lv-notes', 'aria-label': 'Comments' });
    var cmBtn = h('button', { class: 'btn small', type: 'button', hidden: true }, 'Comment');
    function drawPeople() {
      var seen = {}; awareness.getStates().forEach(function (st, id) { if (st.user) seen[st.user.name + id] = st.user; });
      people.replaceChildren.apply(people, Object.keys(seen).map(function (k) { var u = seen[k]; return h('span', { class: 'lv-person', style: 'background:' + u.color, title: u.name }, (u.name || '?').trim().charAt(0).toUpperCase()); }));
    }
    var IC = {
      bold: '<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z"/>',
      italic: '<path d="M10 5h8M6 19h8M14 5 10 19"/>',
      undo: '<path d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3"/>',
      redo: '<path d="m15 14 5-5-5-5M20 9H10a6 6 0 0 0 0 12h3"/>',
      article: '<path d="M5 5v14M19 5v14M5 12h14"/>',
      clause: '<path d="M10 6h10M10 12h10M10 18h10M4 5l1.5-1v5M3.8 14.5c.6-1 2.7-.9 2.7.5 0 1.3-2.7 2-2.7 3.5h2.9"/>',
      sub: '<path d="M3 5h18M13 10h8M13 15h8M3 20h18M3 9l4 3-4 3z"/>',
      out: '<path d="M3 5h18M13 10h8M13 15h8M3 20h18M7 9l-4 3 4 3z"/>',
      table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16M15 4v16"/>',
      rowAdd: '<rect x="3" y="3" width="18" height="10" rx="1.5"/><path d="M12 16v5M9.5 18.5h5"/>',
      colAdd: '<rect x="3" y="3" width="10" height="18" rx="1.5"/><path d="M18.5 9.5v5M16 12h5"/>',
      rowDel: '<rect x="3" y="3" width="18" height="10" rx="1.5"/><path d="M9.5 18.5h5"/>',
      colDel: '<rect x="3" y="3" width="10" height="18" rx="1.5"/><path d="M16 12h5"/>',
      image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m21 16-5-5-8 8"/>',
      palette: '<path d="M12 3a9 9 0 1 0 0 18c1.2 0 2-.8 2-1.8 0-.6-.3-1-.6-1.4-.3-.4-.4-.7-.4-1.1 0-.9.7-1.7 1.7-1.7H17a4 4 0 0 0 4-4C21 6.4 17 3 12 3z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7" r="1"/>',
      tableDel: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m9 9 6 6M15 9l-6 6"/>'
    };
    function icon(name) { var sp = document.createElement('span'); sp.className = 'lv-ic'; sp.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + IC[name] + '</svg>'; return sp; }
    var tbButtons = [];
    function tb(name, title, fn, active) {
      var b = h('button', { type: 'button', class: 'lv-tb', title: title, 'aria-label': title, onmousedown: function (ev) { ev.preventDefault(); }, onclick: function () { fn(ed.chain().focus()); } });
      b.appendChild(icon(name)); if (active) tbButtons.push([b, active]); return b;
    }
    function grp() { return h.apply(null, ['div', { class: 'lv-grp', role: 'group' }].concat([].slice.call(arguments))); }
    function refreshTb() { tbButtons.forEach(function (x) { var on = false; try { on = x[1](); } catch (e) { /* no editor yet */ } x[0].classList.toggle('on', !!on); }); }
    // ---- cell colour: tables have none by default; select cells (click one, or drag across several) and pick a colour ----
    var CELL_COLORS = [['No colour', null], ['Grey', '#eceff1'], ['Yellow', '#fff3bf'], ['Green', '#d8f0dc'], ['Blue', '#d6e6fb'], ['Purple', '#e9dcf3'], ['Red', '#fbdcdc'], ['Orange', '#fde4c8']], pal = null;
    function closePalette() { if (pal) { pal.remove(); pal = null; document.removeEventListener('mousedown', outside, true); document.removeEventListener('keydown', escPal, true); } }
    function outside(ev) { if (pal && !pal.contains(ev.target) && !colourBtn.contains(ev.target)) closePalette(); }
    function escPal(ev) { if (ev.key === 'Escape') closePalette(); }
    function openPalette() {
      if (pal) { closePalette(); return; }
      if (!LE.inTable(ed)) { P.toast('Click in a table first, or drag across the cells you want to colour.', true); return; }
      var r = colourBtn.getBoundingClientRect();
      pal = h('div', { class: 'lv-pop', role: 'menu', 'aria-label': 'Cell colour', style: 'top:' + Math.round(r.bottom + 6) + 'px;left:' + Math.round(Math.max(8, r.left - 40)) + 'px' },
        CELL_COLORS.map(function (c) { return h('button', { type: 'button', class: 'lv-sw' + (c[1] ? '' : ' none'), title: c[0], 'aria-label': c[0], style: c[1] ? 'background:' + c[1] : '', onmousedown: function (ev) { ev.preventDefault(); }, onclick: function () { LE.setCellColor(ed, c[1]); closePalette(); } }); }));
      document.body.appendChild(pal); document.addEventListener('mousedown', outside, true); document.addEventListener('keydown', escPal, true);
    }
    // ---- right-click a table: the options menu ----
    var tmenu = null;
    function closeTableMenu() { if (tmenu) { tmenu.remove(); tmenu = null; document.removeEventListener('mousedown', outsideMenu, true); document.removeEventListener('keydown', escMenu, true); window.removeEventListener('scroll', closeTableMenu, true); window.removeEventListener('blur', closeTableMenu); } }
    function outsideMenu(ev) { if (tmenu && !tmenu.contains(ev.target)) closeTableMenu(); }
    function escMenu(ev) { if (ev.key === 'Escape') closeTableMenu(); }
    function openTableMenu(pt) {
      closeTableMenu(); closePalette();
      function canDo(name) { try { return !!ed.can()[name](); } catch (e) { return false; } }
      function item(label, name, fn) {
        var ok = fn ? true : canDo(name);
        return h('button', { type: 'button', role: 'menuitem', class: 'lv-mi', disabled: !ok, onmousedown: function (ev) { ev.preventDefault(); }, onclick: function () { closeTableMenu(); if (fn) fn(); else ed.chain().focus()[name]().run(); } }, label);
      }
      var sw = h('div', { class: 'lv-mi-sw' }, CELL_COLORS.map(function (c) { return h('button', { type: 'button', class: 'lv-sw' + (c[1] ? '' : ' none'), title: c[0], 'aria-label': 'Cell colour: ' + c[0], style: c[1] ? 'background:' + c[1] : '', onmousedown: function (ev) { ev.preventDefault(); }, onclick: function () { LE.setCellColor(ed, c[1]); closeTableMenu(); } }); }));
      tmenu = h('div', { class: 'lv-ctx', role: 'menu', 'aria-label': 'Table options' },
        item('Insert row above', 'addRowBefore'), item('Insert row below', 'addRowAfter'), item('Insert column left', 'addColumnBefore'), item('Insert column right', 'addColumnAfter'), h('hr'),
        item('Delete row', 'deleteRow'), item('Delete column', 'deleteColumn'), item('Delete table', 'deleteTable'), h('hr'),
        item('Merge cells', 'mergeCells'), item('Split cell', 'splitCell'), item('Header row on or off', 'toggleHeaderRow'), item('Equal column widths', null, function () { LE.resetTableWidths(ed); }), h('hr'),
        h('div', { class: 'lv-mi-lab' }, 'Cell colour'), sw);
      tmenu.style.left = pt.x + 'px'; tmenu.style.top = pt.y + 'px'; document.body.appendChild(tmenu);
      var w = tmenu.offsetWidth, hh = tmenu.offsetHeight; tmenu.style.left = Math.max(8, Math.min(pt.x, window.innerWidth - w - 8)) + 'px'; tmenu.style.top = Math.max(8, Math.min(pt.y, window.innerHeight - hh - 8)) + 'px';
      document.addEventListener('mousedown', outsideMenu, true); document.addEventListener('keydown', escMenu, true); window.addEventListener('scroll', closeTableMenu, true); window.addEventListener('blur', closeTableMenu);
    }
    // ---- images: pick, paste or drag a picture in; it is shrunk, uploaded to the private policy-images bucket and placed on its own line ----
    var imgCache = {};
    function resolveImage(src) {
      var path = String(src || '').replace(/^policy-image:/, ''), hit = imgCache[path]; if (hit && hit.until > Date.now()) return hit.p;
      var pr = P.sb.storage.from('policy-images').createSignedUrl(path, 3600).then(function (r) { if (r.error || !r.data) throw (r.error || new Error('no link')); return r.data.signedUrl; });
      imgCache[path] = { p: pr, until: Date.now() + 50 * 60 * 1000 }; pr.catch(function () { delete imgCache[path]; }); return pr;
    }
    async function addImages(files) {
      for (var i = 0; i < files.length; i++) {
        var f = files[i]; if (f.size > 15 * 1024 * 1024) { P.toast('That image is too large (15 MB at most before it is shrunk).', true); continue; }
        try {
          P.toast('Preparing the image\u2026'); var prep = await LE.prepareImage(f);
          if (prep.blob.size > 5 * 1024 * 1024) { P.toast('Even shrunk, that image is over 5 MB. Try a smaller picture.', true); continue; }
          var alt = await LE.askText({ title: 'Add image', label: 'Alt text (optional): a short description for people who cannot see the image. Screen readers read it aloud.', required: false, multiline: true, ok: 'Add image' }); if (alt === null) continue;
          var path = data.doc.id + '/' + (window.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(16).slice(2)) + '.' + prep.ext;
          var up = await P.sb.storage.from('policy-images').upload(path, prep.blob, { contentType: prep.type, upsert: false }); if (up.error) throw up.error;
          LE.insertImage(ed, { src: 'policy-image:' + path, alt: alt.trim(), title: 'w=100' });
        } catch (e) { P.toast(P.friendly(e) || 'Could not add the image.', true); }
      }
    }
    var imgInput = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml', multiple: true, hidden: true, onchange: function () { var fs = [].slice.call(imgInput.files); imgInput.value = ''; if (fs.length) addImages(fs); } });
    var imgBtn = h('button', { type: 'button', class: 'lv-tb', title: 'Insert image (or paste or drag one in)', 'aria-label': 'Insert image', onmousedown: function (ev) { ev.preventDefault(); }, onclick: function () { imgInput.click(); } }); imgBtn.appendChild(icon('image')); imgBtn.appendChild(imgInput);
    var colourBtn = h('button', { type: 'button', class: 'lv-tb', title: 'Cell colour (select cells first)', 'aria-label': 'Cell colour', onmousedown: function (ev) { ev.preventDefault(); }, onclick: openPalette }); colourBtn.appendChild(icon('palette'));
    // (the inserted table has a header row because a markdown table needs one to be saved; the header has no colour, only bold text)
    var toolbar = canEdit ? h('div', { class: 'lv-toolbar noprint', role: 'toolbar', 'aria-label': 'Formatting' },
      grp(tb('undo', 'Undo (your changes only)', function (c) { c.undo().run(); }), tb('redo', 'Redo', function (c) { c.redo().run(); })),
      grp(tb('bold', 'Bold', function (c) { c.toggleBold().run(); }, function () { return ed.isActive('bold'); }), tb('italic', 'Italic', function (c) { c.toggleItalic().run(); }, function () { return ed.isActive('italic'); })),
      grp(tb('article', 'Article title', function (c) { c.toggleHeading({ level: 2 }).run(); }, function () { return ed.isActive('heading'); }),
        tb('clause', 'Numbered clause', function (c) { c.toggleOrderedList().run(); }, function () { return ed.isActive('orderedList'); }),
        tb('sub', 'Make a sub-item (indent)', function (c) { if (!LE.canIndent(ed)) { P.toast('Four levels is the most: 1.1, (a), (i), (A).', true); return; } c.sinkListItem('listItem').run(); }), tb('out', 'Back out of a sub-item', function (c) { c.liftListItem('listItem').run(); })),
      grp(imgBtn),
      grp(tb('table', 'Insert a table', function (c) { c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); }),
        tb('rowAdd', 'Add a row below', function (c) { c.addRowAfter().run(); }), tb('colAdd', 'Add a column after', function (c) { c.addColumnAfter().run(); }),
        tb('rowDel', 'Delete this row', function (c) { c.deleteRow().run(); }), tb('colDel', 'Delete this column', function (c) { c.deleteColumn().run(); }), tb('tableDel', 'Delete the table', function (c) { c.deleteTable().run(); }), colourBtn)) : null;

    // ---- comments (the same table and functions as the ordinary page) ----
    function threads() { var roots = notes.filter(function (n) { return !n.parent_id; }); return roots.map(function (r) { return { root: r, replies: notes.filter(function (n) { return n.parent_id === r.id; }) }; }); }
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
      var open = notes.filter(function (n) { return !n.parent_id && !n.resolved; });
      LE.setNotes(ed, open, activeId);
      notesCol.replaceChildren.apply(notesCol, threads().filter(function (t) { return !t.root.resolved; }).map(function (t) {
        var r = t.root, card = h('div', { class: 'lv-card' + (r.id === activeId ? ' on' : ''), 'data-tid': r.id, onclick: function () { activeId = r.id; paintNotes(); } },
          h('div', { class: 'lv-q' }, '“' + r.quote.slice(0, 80) + (r.quote.length > 80 ? '…' : '') + '”'),
          [r].concat(t.replies).map(function (n) { return h('div', { class: 'lv-note' }, h('b', null, n.author_name + ': '), n.body); }));
        if (r.id === activeId) {
          var ta = h('input', { type: 'text', placeholder: 'Reply…', class: 'grow' });
          card.appendChild(h('div', { class: 'row' }, ta, h('button', { class: 'btn small', onclick: async function (ev) { ev.stopPropagation(); if (!ta.value.trim()) return; if (await P.run(function () { return rpc('policy_note_add', { p_slug: slug, p_ref: '', p_quote: r.quote, p_prefix: r.prefix, p_body: ta.value, p_parent: r.id, p_name: myName() }).then(function () { return true; }); })) { send('notes', {}); reloadNotes(); } } }, 'Reply'),
            h('button', { class: 'ghost small', onclick: async function (ev) { ev.stopPropagation(); if (await P.run(function () { return rpc('policy_note_resolve', { p_id: r.id, p_resolved: true, p_name: myName() }).then(function () { return true; }); })) { send('notes', {}); reloadNotes(); } } }, 'Resolve')));
        }
        return card;
      }));
      layoutNotes();
    }
    async function reloadNotes() { try { notes = (await rpc('policy_note_list', { p_slug: slug })) || []; } catch (e) { /* keep what we have */ } if (ed) paintNotes(); }
    cmBtn.addEventListener('mousedown', function (ev) { ev.preventDefault(); });
    cmBtn.addEventListener('click', function () {
      var q = LE.selectionQuote(ed); if (!q) return; var ta = h('textarea', { rows: 3, class: 'grow', placeholder: 'Write a comment' });
      var box = h('div', { class: 'lv-card on' }, h('div', { class: 'lv-q' }, '“' + q.quote.slice(0, 80) + '”'), ta,
        h('div', { class: 'row' }, h('button', { class: 'btn small', onclick: async function () { if (!ta.value.trim()) return;
          if (await P.run(function () { return rpc('policy_note_add', { p_slug: slug, p_ref: '', p_quote: q.quote, p_prefix: q.prefix, p_body: ta.value, p_parent: null, p_name: myName() }).then(function () { return true; }); })) { send('notes', {}); box.remove(); reloadNotes(); } } }, 'Comment'),
          h('button', { class: 'ghost small', onclick: function () { box.remove(); } }, 'Cancel')));
      box.setAttribute('data-tid', 'draft'); box.setAttribute('data-y', String(Math.round(ed.view.coordsAtPos(ed.state.selection.from).top - notesCol.getBoundingClientRect().top)));
      notesCol.prepend(box); layoutNotes(); cmBtn.hidden = true; ta.focus();
    });

    // ---- icons for the bar (clock = version history, people = share) ----
    function svg(path, size) { var sp = document.createElement('span'); sp.className = 'lv-ic'; sp.innerHTML = '<svg viewBox="0 0 24 24" width="' + (size || 20) + '" height="' + (size || 20) + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + '</svg>'; return sp; }
    var PATH = { history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2"/>', lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>', link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>', back: '<path d="M19 12H5M11 6l-6 6 6 6"/>', close: '<path d="M6 6l12 12M18 6 6 18"/>', people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.3a6.5 6.5 0 0 1 3.5 5.7"/>', dots: '<circle cx="12" cy="5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="19" r="1.2"/>' };
    function avatar(name, size) { return h('span', { class: 'lv-av', style: 'background:' + colourFor(name || '?') + ';width:' + (size || 32) + 'px;height:' + (size || 32) + 'px;font-size:' + Math.round((size || 32) * 0.45) + 'px' }, (name || '?').trim().charAt(0).toUpperCase()); }

    // ---- Share (laid out like the Google Docs dialog) ----
    function openShare() {
      var overlay = h('div', { class: 'gd-overlay', onclick: function (ev) { if (ev.target === overlay) close(); } }), people = [], chips = [];
      function close() { overlay.remove(); document.removeEventListener('keydown', onKey); }
      function onKey(ev) { if (ev.key === 'Escape') close(); }
      document.addEventListener('keydown', onKey);
      var input = h('input', { type: 'text', class: 'gd-add', placeholder: 'Add people by email', 'aria-label': 'Add people by email', autocomplete: 'off' });
      var chipRow = h('div', { class: 'gd-chips' }), addBox = h('div', { class: 'gd-addbox' }, chipRow, input), roleSel = h('select', { class: 'gd-role', 'aria-label': 'Role' }, h('option', { value: 'edit' }, 'Editor'), h('option', { value: 'read' }, 'Commenter'));
      var sendRow = h('div', { class: 'gd-send', hidden: true }), listEl = h('div', { class: 'gd-people' });
      function takeChip() { var v = input.value.trim().replace(/[,;]$/, ''); if (!v) return; if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) { P.toast('That is not an email address', true); return; } if (chips.indexOf(v.toLowerCase()) < 0) chips.push(v.toLowerCase()); input.value = ''; drawChips(); }
      function drawChips() {
        chipRow.replaceChildren.apply(chipRow, chips.map(function (c) { var x = h('button', { type: 'button', class: 'gd-x', 'aria-label': 'Remove ' + c, onclick: function () { chips.splice(chips.indexOf(c), 1); drawChips(); } }); x.appendChild(svg(PATH.close, 12)); return h('span', { class: 'gd-chip' }, avatar(c, 20), c, x); }));
        sendRow.hidden = !chips.length; addBox.classList.toggle('has', !!chips.length);
      }
      input.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ',' || ev.key === ';' || ev.key === ' ') { ev.preventDefault(); takeChip(); } else if (ev.key === 'Backspace' && !input.value && chips.length) { chips.pop(); drawChips(); } });
      input.addEventListener('blur', takeChip);
      var sendBtn = h('button', { type: 'button', class: 'gd-btn fill', onclick: async function () {
        takeChip(); if (!chips.length) return; var role = roleSel.value, done = 0;
        for (var i = 0; i < chips.length; i++) { try { await rpc('policy_editor_add', { p_slug: slug, p_email: chips[i], p_can_edit: role === 'edit', p_name: myName() }); done++; } catch (e) { P.toast(P.friendly(e), true); } }
        chips = []; drawChips(); if (done) P.toast('Shared with ' + done + (done === 1 ? ' person' : ' people')); load(); } }, 'Send');
      sendRow.append(h('div', { class: 'gd-sendrole' }, roleSel), h('div', { class: 'gd-sendbtns' }, h('button', { type: 'button', class: 'gd-btn', onclick: function () { chips = []; drawChips(); } }, 'Cancel'), sendBtn));
      function personRow(name, sub, right) { return h('div', { class: 'gd-person' }, avatar(name, 36), h('div', { class: 'gd-pn' }, h('div', { class: 'gd-name' }, name), sub ? h('div', { class: 'gd-sub' }, sub) : null), right); }
      async function setRole(email, val, row) {
        if (val === 'none') { if (!(await LE.askConfirm({ title: 'Remove access', message: 'Remove access for ' + email + '? They will no longer be able to open this document.', ok: 'Remove' }))) { load(); return; } try { await rpc('policy_editor_remove', { p_slug: slug, p_email: email }); P.toast('Removed access'); } catch (e) { P.toast(P.friendly(e), true); } load(); return; }
        try { await rpc('policy_editor_add', { p_slug: slug, p_email: email, p_can_edit: val === 'edit', p_name: myName() }); } catch (e) { P.toast(P.friendly(e), true); } load();
      }
      async function load() {
        var l = []; try { l = await rpc('policy_editor_list', { p_slug: slug }); } catch (e) { /* none */ }
        var mine = P.me && (P.me.name || P.me.email) || 'You';
        listEl.replaceChildren.apply(listEl, [personRow(mine + ' (you)', P.me && P.me.email || '', h('span', { class: 'gd-fixed' }, 'Owner')), personRow('ExCo members', 'Everyone on ExCo can edit the working copy', h('span', { class: 'gd-fixed' }, 'Editor'))].concat(l.map(function (e) {
          var sel = h('select', { class: 'gd-role', 'aria-label': 'Role for ' + e.email, onchange: function () { setRole(e.email, sel.value); } }, h('option', { value: 'edit' }, 'Editor'), h('option', { value: 'read' }, 'Commenter'), h('option', { value: 'none' }, 'Remove access'));
          sel.value = e.can_edit ? 'edit' : 'read'; return personRow(e.email, e.added_by ? 'Added by ' + e.added_by : '', sel);
        })));
      }
      var dlg = h('div', { class: 'gd-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Share' },
        h('div', { class: 'gd-title' }, 'Share “' + data.doc.title + '”'),
        addBox, sendRow,
        h('div', { class: 'gd-h' }, 'People with access'), listEl,
        h('div', { class: 'gd-h' }, 'General access'),
        h('div', { class: 'gd-person' }, h('span', { class: 'gd-gicon' }, svg(PATH.lock, 20)), h('div', { class: 'gd-pn' }, h('div', { class: 'gd-name' }, 'Restricted'), h('div', { class: 'gd-sub' }, 'Only ExCo and the people added above can open the working copy. Members read the published version.'))),
        h('div', { class: 'gd-foot' }, h('button', { type: 'button', class: 'gd-btn', onclick: function () { var u = location.origin + location.pathname + '#/live/' + slug; P.copy ? P.copy(u).then(function () { P.toast('Link copied'); }) : navigator.clipboard.writeText(u).then(function () { P.toast('Link copied'); }); } }, svg(PATH.link, 18), ' Copy link'),
          h('button', { type: 'button', class: 'gd-btn fill', onclick: close }, 'Done')));
      overlay.appendChild(dlg); document.body.appendChild(overlay); load(); input.focus();
    }

    // ---- Version history (laid out like the Google Docs panel) ----
    var histOpen = false, histPanel = null, histPreview = null, histTop = null, curView = null;
    function dayLabel(d) { var t = new Date(); t.setHours(0, 0, 0, 0); var x = new Date(d); x.setHours(0, 0, 0, 0); var diff = Math.round((t - x) / 864e5); return diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : x.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: x.getFullYear() === t.getFullYear() ? undefined : 'numeric' }); }
    function stamp(d) { return new Date(d).toLocaleString(undefined, { day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' }); }
    async function openHistory() {
      if (histOpen) return; histOpen = true; cmBtn.hidden = true;
      var named = false, sel = null, items = [], body = h('div', { class: 'gd-hbody' }), onlyNamed = h('input', { type: 'checkbox', id: 'gd-named' });
      var pv = h('div', { class: 'lv-editor lv-prev' }), pvEd = null, banner = h('div', { class: 'gd-hbar' });
      function show(item) {
        sel = item; build(); var g0 = groupOf(item); if (g0) openG[g0.key] = true; draw();
        (async function () {
          var md = '';
          try { md = item.kind === 'current' ? LE.markdownOf(ed) : item.kind === 'pub' ? ((await rpc('policy_text', { p_slug: slug, p_version: item.version })) || {}).body_md : await rpc('policy_backup_text', { p_slug: slug, p_id: item.id }); } catch (e) { P.toast('Could not load that version', true); }
          if (pvEd) pvEd.destroy(); pv.replaceChildren(); pvEd = LE.preview(pv, md || '', { resolveImage: resolveImage });
        })();
        banner.replaceChildren(h('span', { class: 'gd-hname' }, item.kind === 'current' ? 'Current version' : item.label || stamp(item.at)),
          item.kind !== 'save' || !canEdit ? null : h('button', { type: 'button', class: 'gd-btn fill', onclick: async function () {
            if (!(await LE.askConfirm({ title: 'Restore this version', message: 'Put this version back for everyone? What is there now is kept in the version history.', ok: 'Restore' }))) return;
            if (await P.run(function () { return rpc('policy_restore_backup', { p_slug: slug, p_id: item.id, p_name: myName() }).then(function () { return true; }); }, 'Restored')) location.reload(); } }, 'Restore this version'));
      }
      var openG = { draft: true };
      function groupOf(item) { var g = null; groups.forEach(function (x) { if (x.rows.indexOf(item) >= 0 || x.head === item) g = x; }); return g; }
      var groups = [];
      function build() {                                                          // one section per published version, newest first; the saves are filed under the version they led up to
        var vers = items.filter(function (x) { return x.kind === 'pub'; }).sort(function (a, b) { return b.version - a.version; }), saves = items.filter(function (x) { return x.kind === 'save'; }), cur = items.filter(function (x) { return x.kind === 'current'; })[0];
        var T = function (x) { return new Date(x.at).getTime(); }, latest = vers.length ? T(vers[0]) : -Infinity;
        groups = [{ key: 'draft', title: vers.length ? 'Unpublished changes \u00b7 since version ' + vers[0].version : 'Not published', rows: [cur].concat(saves.filter(function (x) { return T(x) > latest; })) }];
        vers.forEach(function (v, k) { var lo = k + 1 < vers.length ? T(vers[k + 1]) : -Infinity, hi = T(v); groups.push({ key: 'v' + v.version, head: v, live: k === 0, rows: saves.filter(function (x) { return T(x) <= hi && T(x) > lo; }) }); });
      }
      function chevron(open) { var b = h('span', { class: 'gd-gchev' + (open ? ' open' : '') }); b.appendChild(svg('<path d="m6 9 6 6 6-6"/>', 16)); return b; }
      function draw() {
        build();
        var out = [];
        groups.forEach(function (g) {
          var isOpen = !!openG[g.key], rows = onlyNamed.checked ? (g.key === 'draft' ? [g.rows[0]] : []) : g.rows;
          if (g.head) {
            var v = g.head, on = sel && sel.key === v.key;
            out.push(h('div', { class: 'gd-grp pub' + (g.live ? ' live' : '') },
              h('button', { type: 'button', class: 'gd-ghead' + (on ? ' on' : ''), onclick: function () { show(v); } },
                h('span', { class: 'gd-gt' }, 'Version ' + v.version, g.live ? h('span', { class: 'lv-live' }, 'Live now') : null),
                h('span', { class: 'gd-gs' }, stamp(v.at)), h('span', { class: 'gd-gs' }, 'Published by ' + (v.by || 'the President')), v.note ? h('span', { class: 'gd-gn' }, v.note) : null),
              rows.length ? h('button', { type: 'button', class: 'gd-gtoggle', 'aria-expanded': isOpen ? 'true' : 'false', onclick: function () { openG[g.key] = !isOpen; draw(); } }, chevron(isOpen), rows.length + (rows.length === 1 ? ' edit before this version' : ' edits before this version')) : null,
              isOpen ? rows.map(row) : null));
          } else {
            out.push(h('div', { class: 'gd-grp draftgrp' }, h('div', { class: 'gd-gdraft' }, g.title), rows.map(row)));
          }
        });
        body.replaceChildren.apply(body, out);
      }
      function row(i) {
        var on = sel && sel.key === i.key;
        return h('button', { type: 'button', class: 'gd-ver' + (on ? ' on' : ''), onclick: function () { show(i); } },
          h('span', { class: 'gd-vtxt' }, h('span', { class: 'gd-vt' }, i.kind === 'current' ? 'Current version' : stamp(i.at)), h('span', { class: 'gd-vwho' }, h('i', { style: 'background:' + colourFor(i.by || '?') }), i.by || 'Someone')));
      }
      onlyNamed.addEventListener('change', draw);
      var back = h('button', { type: 'button', class: 'gd-back', 'aria-label': 'Back to the document', onclick: closeHistory }); back.appendChild(svg(PATH.back, 22));
      histPanel = h('aside', { class: 'gd-hist', 'aria-label': 'Version history' }, h('div', { class: 'gd-htitle' }, 'Version history'), body,
        h('label', { class: 'gd-hfoot', for: 'gd-named' }, onlyNamed, ' Only show named versions'));
      histTop = h('div', { class: 'gd-htop' }, back, h('span', { class: 'gd-hname' }, 'Version history'), banner);
      outPanel.hidden = true; lvEl.classList.add('hist');
      // the preview sits in the same sheet as the editor, so it has the same type, indents and numbering
      lvBody.replaceChildren(h('div', { class: 'lv-scroll' }, h('div', { class: 'lv-col lv-prevcol' }, pv)), histPanel); lvRoot.insertBefore(histTop, lvTop); lvTop.hidden = true;
      curView = pv;
      var bk = []; try { bk = await rpc('policy_backups', { p_slug: slug }); } catch (e) { /* none */ }
      var pubs = []; try { pubs = await rpc('policy_versions', { p_slug: slug }); } catch (e) { pubs = meta.versions.map(function (v) { return { version: v.version, published_at: (v.effective_on || new Date().toISOString().slice(0, 10)) + 'T12:00:00', note: v.note, by: v.by }; }); }
      items = [{ kind: 'current', key: 'cur', at: new Date().toISOString(), by: 'You and others, now' }]
        .concat(pubs.map(function (v) { return { kind: 'pub', key: 'p' + v.version, version: v.version, at: v.published_at, by: v.by, note: v.note, label: 'Version ' + v.version + (v.note ? ': ' + v.note : '') }; }))
        .concat(bk.map(function (b) { return { kind: 'save', key: 'b' + b.id, id: b.id, at: b.saved_at, by: b.by }; }));
      show(items[0]);
    }
    function closeHistory() {
      if (!histOpen) return; histOpen = false; if (histTop) histTop.remove(); lvEl.classList.remove('hist'); lvBody.replaceChildren(lvScroll, notesCol); fitAll(); lvTop.hidden = false; setOutline(outOpen); paintNotes();
    }

    // ---- name and description (ExCo): click the name to rename; the info button edits the description ----
    var docInfo = { title: data.doc.title, summary: '' };
    function longDate(s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : ''; }
    // ---- the version token under the title: "Not published" or "Version N", opening a log of every publish with the President's comments ----
    var meta = { versions: [], status: data.doc.status, version: data.doc.version, effective_on: null };
    var tokenT = h('span', null, data.doc.version > 0 ? 'Version ' + data.doc.version : 'Not published'), tokenCaret = svg('<path d="m6 9 6 6 6-6"/>', 14);
    var token = h('button', { type: 'button', class: 'lv-token', 'aria-expanded': 'false', 'aria-controls': 'lv-log', title: 'Version log', onclick: toggleLog }, tokenT, tokenCaret);
    var logEl = h('div', { class: 'lv-log', id: 'lv-log', hidden: true }), metaLine = h('div', { class: 'lv-meta' }, token, logEl);
    function toggleLog() { var open = logEl.hidden; logEl.hidden = !open; token.setAttribute('aria-expanded', open ? 'true' : 'false'); token.classList.toggle('open', open); }
    function drawLog() {
      logEl.replaceChildren();
      if (!meta.versions.length) { logEl.appendChild(h('p', { class: 'lv-log-empty' }, 'Not published yet. Each version the President publishes is listed here with their comments.')); return; }
      var liveV = meta.versions.reduce(function (m, v) { return Math.max(m, v.version); }, 0);   // the highest published version is the one members see
      meta.versions.forEach(function (v) {
        var isLive = v.version === liveV;
        logEl.appendChild(h('div', { class: 'lv-log-item' + (isLive ? ' live' : ' old') }, h('div', { class: 'lv-log-h' }, h('b', null, 'Version ' + v.version), isLive ? h('span', { class: 'lv-live' }, 'Live now') : null, v.effective_on ? ' \u00b7 ' + longDate(v.effective_on) : '', ' \u00b7 ', h('a', { href: '#/d/' + slug + '?v=' + v.version }, 'View')),
          h('div', { class: 'lv-log-by' }, 'Published by ' + (v.by || 'the President')), v.note ? h('p', { class: 'lv-log-note' }, v.note) : null));
      });
    }
    // The token says Unpublished changes the moment the working copy differs from the published text (ExCo can compare; others just see the version).
    function updateToken() {
      var inForce = meta.status === 'in_force' && meta.version > 0, dirty = false;
      if (inForce && meta.published_md !== null && meta.published_md !== undefined && ed) { try { dirty = LE.markdownOf(ed).trim() !== meta.published_md.trim(); } catch (e) { dirty = false; } }
      tokenT.textContent = !inForce ? 'Not published' : dirty ? 'Unpublished changes \u00b7 since version ' + meta.version : 'Version ' + meta.version + (meta.effective_on ? ' \u00b7 ' + longDate(meta.effective_on) : '');
      token.classList.toggle('dirty', inForce && dirty);
    }
    var metaFirst = true;
    function refreshMeta(w) {
      if (!w || !w.doc) return; if (metaFirst) { docInfo.summary = w.doc.summary || ''; metaFirst = false; }
      meta.versions = w.versions || []; meta.status = w.doc.status; meta.version = w.doc.version; meta.effective_on = w.doc.effective_on;
      meta.published_md = typeof w.published_md === 'string' ? w.published_md : null; updateToken(); drawLog();
    }
    function loadMeta() { return rpc('policy_live_info', { p_slug: slug }).then(refreshMeta).catch(function () { /* none */ }); }
    var sumP = loadMeta();
    async function saveInfo() {
      if (docInfo.title.trim().length < 3) { P.toast('The name needs at least 3 letters', true); setTitle(lastTitle, null); return false; }
      try { await rpc('policy_doc_save', { p_slug: slug, p_title: docInfo.title, p_summary: docInfo.summary }); lastTitle = docInfo.title.trim(); lastSummary = docInfo.summary; return true; } catch (e) { P.toast(P.friendly(e), true); return false; }
    }
    var lastTitle = data.doc.title, lastSummary = '';
    var titleEl = canWork ? h('input', { type: 'text', class: 'gd-titleinput', maxlength: 120, value: data.doc.title, 'aria-label': 'Document name', title: 'Rename',
      oninput: function () { setTitle(titleEl.value, titleEl); }, onblur: function () { if (docInfo.title !== lastTitle) saveInfo(); },
      onkeydown: function (ev) { if (ev.key === 'Enter') titleEl.blur(); } }) : h('h1', null, data.doc.title);
    if (canWork) titleEl.style.width = Math.max(8, data.doc.title.length + 1) + 'ch';
    // the name and description also sit at the top of the page itself; the bar, this block and the details box all show the same text
    function fit(el) { el.style.height = 'auto'; el.style.height = (el.scrollHeight + 3) + 'px'; }
    var titleT = h('textarea', { class: 'doc-title edit-in-place', rows: 1, maxlength: 120, 'aria-label': 'Document name', spellcheck: 'true', readonly: !canWork }),
      descT = h('textarea', { class: 'muted edit-in-place', rows: 1, maxlength: 400, placeholder: canWork ? 'Add a description' : '', 'aria-label': 'Description', readonly: !P.exco });
    titleT.value = data.doc.title;
    var infoT = null;
    function setTitle(v, from) { docInfo.title = v; if (from !== titleEl && titleEl.tagName === 'INPUT') { titleEl.value = v; } if (titleEl.tagName === 'INPUT') titleEl.style.width = Math.max(8, v.length + 1) + 'ch'; if (from !== titleT) titleT.value = v; fit(titleT); }
    function setDesc(v, from) { docInfo.summary = v; if (from !== descT) descT.value = v; fit(descT); }
    sumP.then(function () { descT.value = docInfo.summary; fit(descT); });
    if (canWork) {
      [titleT, descT].forEach(function (el) {
        el.addEventListener('input', function () { if (el === titleT) setTitle(el.value, el); else setDesc(el.value, el); clearTimeout(infoT); infoT = setTimeout(function () { saveInfo(); }, 1000); });
        el.addEventListener('blur', function () { clearTimeout(infoT); if (docInfo.title !== lastTitle || descT.value !== lastSummary) saveInfo(); });
      });
      titleT.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); descT.focus(); } });
      descT.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); ed.commands.focus('start'); } });
    }
    var titleBlock = h('div', { class: 'lv-doctitle' }, h('div', { class: 'lv-org' }, "LKCMedicine Students' Medical Society"), titleT, descT, metaLine);
    function fitAll() { fit(titleT); fit(descT); }
    function openDetails() {
      var overlay = h('div', { class: 'gd-overlay', onclick: function (ev) { if (ev.target === overlay) overlay.remove(); } });
      var nm = h('input', { type: 'text', class: 'gd-field', maxlength: 120, value: docInfo.title, 'aria-label': 'Document name' }), ds = h('textarea', { class: 'gd-field', rows: 4, maxlength: 400, placeholder: 'Add a description', 'aria-label': 'Description' });
      ds.value = docInfo.summary;
      overlay.appendChild(h('div', { class: 'gd-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Document details' }, h('div', { class: 'gd-title' }, 'Document details'),
        h('label', { class: 'gd-lab' }, 'Name'), nm, h('label', { class: 'gd-lab' }, 'Description'), ds, h('div', { class: 'gd-sub' }, 'The description shows in the list of documents.'),
        h('div', { class: 'gd-foot', style: 'justify-content:flex-end;gap:8px' }, h('button', { type: 'button', class: 'gd-btn', onclick: function () { overlay.remove(); } }, 'Cancel'),
          h('button', { type: 'button', class: 'gd-btn fill', onclick: async function () { setTitle(nm.value, null); setDesc(ds.value, null); if (await saveInfo()) { overlay.remove(); P.toast('Saved'); } } }, 'Save'))));
      document.body.appendChild(overlay); nm.focus();
    }
    var infoBtn = h('button', { type: 'button', class: 'gd-iconbtn', title: 'Name and description', 'aria-label': 'Name and description', onclick: openDetails }); infoBtn.appendChild(svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>', 20));
    var pdfBtn = h('button', { type: 'button', class: 'gd-iconbtn', title: 'Save as PDF', 'aria-label': 'Save as PDF', onclick: async function () {
      pdfBtn.disabled = true; P.toast('Preparing the PDF\u2026');
      try { await LE.savePdf(ed.getJSON(), { org: "LKCMedicine Students' Medical Society", title: docInfo.title, summary: docInfo.summary, versionLine: tokenT.textContent, filename: slug + (meta.version > 0 ? '-v' + meta.version : '-working-copy')  }, { resolveImage: resolveImage }); }
      catch (e) { P.toast('Could not make the PDF. Check your connection and try again.', true); }
      pdfBtn.disabled = false; } });
    pdfBtn.appendChild(svg('<path d="M12 4v10m0 0-4-4m4 4 4-4M5 19h14"/>', 20));
    var histBtn = h('button', { type: 'button', class: 'gd-iconbtn', title: 'Version history', 'aria-label': 'Version history', onclick: openHistory }); histBtn.appendChild(svg(PATH.history, 22));
    var shareBtn = h('button', { type: 'button', class: 'gd-share', onclick: openShare }); shareBtn.appendChild(svg(PATH.lock, 16)); shareBtn.appendChild(document.createTextNode(' Share'));
    // ---- Publish (the President only): asks for comments, saves what is pending, then publishes the working copy as the next version ----
    async function flushPending() { clearTimeout(pushT); for (var n = 0; n < 60 && (pending.length || pushing); n++) { if (!pushing && pending.length) await push(); else await new Promise(function (r) { setTimeout(r, 100); }); } return !pending.length; }
    function openPublish() {
      var next = (meta.version || 0) + 1, overlay = h('div', { class: 'gd-overlay', onclick: function (ev) { if (ev.target === overlay) close(); } });
      function close() { overlay.remove(); document.removeEventListener('keydown', onKey); } function onKey(ev) { if (ev.key === 'Escape') close(); } document.addEventListener('keydown', onKey);
      var note = h('textarea', { class: 'gd-field', rows: 4, maxlength: 140, placeholder: 'What changed in this version? These comments go in the version log.', 'aria-label': 'Comments for this version' }), count = h('div', { class: 'gd-sub' }, '0 / 140');
      var go = h('button', { type: 'button', class: 'gd-btn fill', disabled: true, onclick: async function () {
        go.disabled = true; var saved = await flushPending(); if (!saved) { P.toast('Your latest changes are not saved yet. Try again in a moment.', true); go.disabled = false; return; }
        var nv = await P.run(function () { return rpc('policy_text_publish', { p_slug: slug, p_note: note.value.trim(), p_effective: new Date(Date.now() + 8 * 36e5).toISOString().slice(0, 10), p_name: myName() }); }, 'Published version ' + next);   // publishing puts it in force straight away (today, Singapore time)
        if (nv) { close(); await loadMeta(); logEl.hidden = false; token.setAttribute('aria-expanded', 'true'); token.classList.add('open'); } else go.disabled = false; } }, 'Publish version ' + next);
      note.addEventListener('input', function () { count.textContent = note.value.length + ' / 140'; go.disabled = note.value.trim().length < 3; });
      overlay.appendChild(h('div', { class: 'gd-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Publish' }, h('div', { class: 'gd-title' }, 'Publish version ' + next),
        h('p', { class: 'gd-sub', style: 'font-size:.9rem;margin:0 0 6px' }, 'Publishing puts this version in force straight away. Members will see the document as it is now. Editing carries on in the working copy and members see no change until the next version.'),
        h('label', { class: 'gd-lab' }, 'Comments (required)'), note, count,
        h('div', { class: 'gd-foot', style: 'justify-content:flex-end;gap:8px' }, h('button', { type: 'button', class: 'gd-btn', onclick: close }, 'Cancel'), go)));
      document.body.appendChild(overlay); note.focus();
    }
    var pubBtn = P.canConfirm ? h('button', { type: 'button', class: 'gd-btn fill gd-pub', onclick: openPublish }, 'Publish') : null;
    var lvHead = h('div', { class: 'lv-head' }, h('a', { href: '#/' }, '← Documents'), titleEl, canWork ? infoBtn : null, status, h('span', { class: 'lv-spacer' }), people,
      pdfBtn, canWork ? histBtn : null, pubBtn, P.exco ? shareBtn : null);   // only ExCo can invite people
    var lvIntro = h('p', { class: 'muted' }, canEdit ? 'Everyone here edits the same working copy at once. The President publishes it as the next version; the published text does not change until then.' : 'You can read and comment. You cannot edit.');
    // ---- zoom: the − and + buttons, Ctrl/Cmd + scroll, trackpad pinch (Chrome, Firefox, Safari) and two-finger pinch on a touch screen ----
    var zoom = 1; try { zoom = +localStorage.getItem('policyZoom') || 1; } catch (e) { /* no storage */ }
    var zoomLab = h('button', { type: 'button', class: 'lv-zoomlab', title: 'Back to 100%', onclick: function () { setZoom(1); } }, '100%');
    // zoom around a point (the pointer, the pinch centre, or the middle of the window for the buttons): the words under it stay under it
    function setZoom(z, cx, cy) {
      z = Math.min(2.5, Math.max(0.4, z)); if (Math.abs(z - zoom) < 0.0005) return;
      var sc = lvScroll, r0 = lvCol.getBoundingClientRect(), sr = sc.getBoundingClientRect();
      if (cx == null) cx = sr.left + sr.width / 2; if (cy == null) cy = window.innerHeight / 2;
      var relX = (cx - r0.left) / zoom, relY = (cy - r0.top) / zoom;
      zoom = z; lvCol.style.zoom = zoom;
      var r1 = lvCol.getBoundingClientRect();
      var se = document.scrollingElement || document.documentElement; se.scrollTo({ top: se.scrollTop + r1.top + relY * zoom - cy, behavior: 'instant' }); sc.scrollTo({ left: sc.scrollLeft + r1.left + relX * zoom - cx, behavior: 'instant' }); zoomLab.textContent = Math.round(zoom * 100) + '%'; try { localStorage.setItem('policyZoom', String(zoom)); } catch (e) { /* no storage */ } fitAll(); try { if (ed) paintNotes(); } catch (e) { /* none */ } }
    var STEPS = [0.4, 0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5];
    function stepZoom(dir) { var i; if (dir > 0) { for (i = 0; i < STEPS.length && STEPS[i] <= zoom + 0.001; i++); setZoom(STEPS[Math.min(i, STEPS.length - 1)]); } else { for (i = STEPS.length - 1; i >= 0 && STEPS[i] >= zoom - 0.001; i--); setZoom(STEPS[Math.max(i, 0)]); } }
    var zOut = h('button', { type: 'button', class: 'lv-tb', title: 'Zoom out', 'aria-label': 'Zoom out', onclick: function () { stepZoom(-1); } }), zIn = h('button', { type: 'button', class: 'lv-tb', title: 'Zoom in', 'aria-label': 'Zoom in', onclick: function () { stepZoom(1); } });
    zOut.appendChild(svg('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2M8 11h6"/>', 18)); zIn.appendChild(svg('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2M8 11h6M11 8v6"/>', 18));
    var zoomGrp = h('div', { class: 'lv-grp lv-zoom', role: 'group', 'aria-label': 'Zoom' }, zOut, zoomLab, zIn);
    if (!toolbar) toolbar = h('div', { class: 'lv-toolbar noprint', role: 'toolbar', 'aria-label': 'View' });
    toolbar.appendChild(zoomGrp);
    // ---- outline (Google Docs style): the articles down the left, the one you are reading highlighted, click to jump ----
    var outOpen = window.innerWidth >= 1500; try { var so = localStorage.getItem('policyOutline'); if (so !== null) outOpen = so === '1'; } catch (e) { /* no storage */ }
    var outList = h('nav', { class: 'lv-outlist', 'aria-label': 'Outline' }), outBtn = h('button', { type: 'button', class: 'lv-tb', title: 'Document outline', 'aria-label': 'Document outline', 'aria-pressed': 'false', onclick: function () { setOutline(!outOpen, true); } });
    var outClose = h('button', { type: 'button', class: 'lv-outx', 'aria-label': 'Close the outline', onclick: function () { setOutline(false, true); } }); outClose.appendChild(svg(PATH.close, 16));
    var outPanel = h('aside', { class: 'lv-outline noprint', 'aria-label': 'Outline' }, h('div', { class: 'lv-outhead' }, h('span', null, 'Outline'), outClose), outList);
    outBtn.appendChild(svg('<path d="M4 6h16M4 12h10M4 18h13"/>', 18));
    function setOutline(on, remember) { outOpen = on; outBtn.setAttribute('aria-pressed', on ? 'true' : 'false'); outBtn.classList.toggle('on', on); outPanel.hidden = !on || histOpen; if (remember) { try { localStorage.setItem('policyOutline', on ? '1' : '0'); } catch (e) { /* no storage */ } } placeOutline(); }   // only a click is remembered, not the default for this window size
    function placeOutline() {
      if (outPanel.hidden) return; var bar = lvTop.getBoundingClientRect(), col = lvCol.getBoundingClientRect();
      outPanel.style.top = Math.max(bar.bottom + 12, 12) + 'px'; outPanel.style.left = Math.max(12, col.left - 236) + 'px'; outPanel.style.maxHeight = 'calc(100vh - ' + (Math.max(bar.bottom + 12, 12) + 16) + 'px)';
      outPanel.classList.toggle('over', col.left - 236 < 12);
    }
    var outActive = -1;
    function drawOutline() {
      if (!ed) return; var hs = LE.headings(ed);
      outList.replaceChildren.apply(outList, hs.map(function (hd, i) {
        var letter = i < 26 ? String.fromCharCode(65 + i) + '.' : (i + 1) + '.';
        return h('button', { type: 'button', class: 'lv-outitem' + (i === outActive ? ' on' : ''), onclick: function () { LE.scrollToHeading(ed, hd.pos); } }, h('span', { class: 'lv-outn' }, letter), h('span', { class: 'lv-outt' }, hd.text.trim() || 'Untitled article'));
      }));
      if (!hs.length) outList.appendChild(h('p', { class: 'lv-outempty' }, 'Articles will appear here.'));
    }
    function markOutline() {                                                  // the last article whose title has passed the top of the page
      if (!ed || outPanel.hidden) return; var hs = LE.headings(ed), cut = Math.max(lvTop.getBoundingClientRect().bottom + 90, 200), k = -1;
      hs.forEach(function (hd, i) { var t = LE.headingTop(ed, hd.pos); if (t !== null && t <= cut) k = i; });
      if (k !== outActive) { outActive = k; [].slice.call(outList.children).forEach(function (el, i) { el.classList.toggle('on', i === k); }); }
    }
    var outT = null; function outSoon() { clearTimeout(outT); outT = setTimeout(function () { drawOutline(); markOutline(); }, 300); }
    function onOutScroll() { placeOutline(); markOutline(); }
    window.addEventListener('scroll', onOutScroll, { passive: true }); window.addEventListener('resize', onOutScroll);
    var outGrp = h('div', { class: 'lv-grp', role: 'group' }, outBtn); toolbar.insertBefore(outGrp, toolbar.firstChild);
    var toolbarWrap = h('div', { class: 'lv-tbwrap' }, toolbar);
    var lvCol = h('div', { class: 'lv-col' }, titleBlock, editorEl);
    var lvScroll = h('div', { class: 'lv-scroll' }, lvCol);
    var lvBody = h('div', { class: 'lv-body' }, lvScroll, notesCol);
    var lvTop = h('div', { class: 'lv-top' }, lvHead, toolbarWrap);
    var lvEl = h('div', { class: 'lv' }, lvTop, lvBody), lvRoot = lvEl;
    lvCol.style.zoom = zoom; zoomLab.textContent = Math.round(zoom * 100) + '%';
    lvBody.addEventListener('wheel', function (ev) { if (!(ev.ctrlKey || ev.metaKey)) return; ev.preventDefault(); setZoom(zoom * Math.exp(-ev.deltaY * (ev.deltaMode === 1 ? 0.05 : 0.01)), ev.clientX, ev.clientY); }, { passive: false });
    var gz0 = 1; lvBody.addEventListener('gesturestart', function (ev) { ev.preventDefault(); gz0 = zoom; }); lvBody.addEventListener('gesturechange', function (ev) { ev.preventDefault(); setZoom(gz0 * ev.scale, ev.clientX, ev.clientY); }); lvBody.addEventListener('gestureend', function (ev) { ev.preventDefault(); });
    var pd0 = 0, pz0 = 1; function pdist(t) { return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY); }
    lvBody.addEventListener('touchstart', function (ev) { if (ev.touches.length === 2) { pd0 = pdist(ev.touches); pz0 = zoom; } }, { passive: true });
    lvBody.addEventListener('touchmove', function (ev) { if (ev.touches.length === 2 && pd0) { ev.preventDefault(); setZoom(pz0 * pdist(ev.touches) / pd0, (ev.touches[0].clientX + ev.touches[1].clientX) / 2, (ev.touches[0].clientY + ev.touches[1].clientY) / 2); } }, { passive: false });
    lvBody.addEventListener('touchend', function (ev) { if (ev.touches.length < 2) pd0 = 0; }, { passive: true });
    P.show(lvEl); fitAll();
    var viewEl = document.getElementById('view'); viewEl.classList.add('lv-wide'); P.onLeave(function () { viewEl.classList.remove('lv-wide'); }); setTimeout(fitAll, 0); if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitAll); window.addEventListener('resize', fitAll);
    document.body.appendChild(cmBtn);
    awareness.setLocalStateField('user', me);
    ed = LE.create({ onTableMenu: openTableMenu, resolveImage: resolveImage, onImageFiles: addImages, element: editorEl, ydoc: ydoc, awareness: awareness, user: me, editable: canEdit,
      onNoteClick: function (id) { activeId = id; paintNotes(); },
      onSelection: function () {
        refreshTb(); var s = ed.state.selection; if (s.empty) { cmBtn.hidden = true; return; }
        var c = ed.view.coordsAtPos(s.to); cmBtn.hidden = false; cmBtn.style.cssText = 'position:fixed;z-index:30;left:' + Math.round(c.left) + 'px;top:' + Math.round(c.bottom + 6) + 'px';
      } });
    document.body.appendChild(outPanel); setOutline(outOpen); drawOutline(); markOutline(); ed.on('update', outSoon);
    if (window.ResizeObserver) { var roN = new ResizeObserver(function () { layoutNotes(); }); roN.observe(editorEl); P.onLeave(function () { roN.disconnect(); }); }
    window.addEventListener('resize', layoutNotes); P.onLeave(function () { window.removeEventListener('resize', layoutNotes); });
    ed.on('transaction', function () { clearTimeout(ed._ln); ed._ln = setTimeout(layoutNotes, 120); });
    ed.on('transaction', refreshTb); drawPeople(); announce(); send('hello', {}); setStatus(canEdit ? 'All changes saved' : 'Read only'); await reloadNotes();
    var dtimer = setInterval(function () { paintNotes(); }, 15000);   // highlights follow the words as other people type
    ed.on('update', function () { clearTimeout(ed._pn); ed._pn = setTimeout(paintNotes, 400); clearTimeout(ed._tk); ed._tk = setTimeout(updateToken, 500); });
    updateToken();
    window.__live = { ed: ed, ydoc: ydoc, awareness: awareness, refreshMeta: refreshMeta };   // refreshMeta: handy for checking the version log without publishing
    P.onLeave(function () {
      closed = true; closePalette(); closeTableMenu(); outPanel.remove(); window.removeEventListener('scroll', onOutScroll); window.removeEventListener('resize', onOutScroll); clearInterval(dtimer); clearTimeout(pushT); cmBtn.remove();
      if (pending.length) { var b = pending; pending = []; rpc('policy_live_push', { p_slug: slug, p_update: LE.b64(Y.mergeUpdates(b)), p_md: LE.markdownOf(ed), p_name: myName(), p_epoch: epoch }).catch(function () { /* lost only if the tab died */ }); }
      LE.removeAwarenessStates(awareness, [ydoc.clientID], 'local'); try { P.sb.removeChannel(chan); } catch (e) { /* closing */ } ed.destroy();
    });
    window.addEventListener('beforeunload', function () { if (pending.length) push(); });
  }
  P.route('/live/:slug', { nav: 'docs', fn: livePage });
})();
