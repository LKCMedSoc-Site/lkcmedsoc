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
    var colourBtn = h('button', { type: 'button', class: 'lv-tb', title: 'Cell colour (select cells first)', 'aria-label': 'Cell colour', onmousedown: function (ev) { ev.preventDefault(); }, onclick: openPalette }); colourBtn.appendChild(icon('palette'));
    // (the inserted table has a header row because a markdown table needs one to be saved; the header has no colour, only bold text)
    var toolbar = canEdit ? h('div', { class: 'lv-toolbar noprint', role: 'toolbar', 'aria-label': 'Formatting' },
      grp(tb('undo', 'Undo (your changes only)', function (c) { c.undo().run(); }), tb('redo', 'Redo', function (c) { c.redo().run(); })),
      grp(tb('bold', 'Bold', function (c) { c.toggleBold().run(); }, function () { return ed.isActive('bold'); }), tb('italic', 'Italic', function (c) { c.toggleItalic().run(); }, function () { return ed.isActive('italic'); })),
      grp(tb('article', 'Article title', function (c) { c.toggleHeading({ level: 2 }).run(); }, function () { return ed.isActive('heading'); }),
        tb('clause', 'Numbered clause', function (c) { c.toggleOrderedList().run(); }, function () { return ed.isActive('orderedList'); }),
        tb('sub', 'Make a sub-item (indent)', function (c) { if (!LE.canIndent(ed)) { P.toast('Four levels is the most: 1.1, (a), (i), (A).', true); return; } c.sinkListItem('listItem').run(); }), tb('out', 'Back out of a sub-item', function (c) { c.liftListItem('listItem').run(); })),
      grp(tb('table', 'Insert a table', function (c) { c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); }),
        tb('rowAdd', 'Add a row below', function (c) { c.addRowAfter().run(); }), tb('colAdd', 'Add a column after', function (c) { c.addColumnAfter().run(); }),
        tb('rowDel', 'Delete this row', function (c) { c.deleteRow().run(); }), tb('colDel', 'Delete this column', function (c) { c.deleteColumn().run(); }), tb('tableDel', 'Delete the table', function (c) { c.deleteTable().run(); }), colourBtn)) : null;

    // ---- comments (the same table and functions as the ordinary page) ----
    function threads() { var roots = notes.filter(function (n) { return !n.parent_id; }); return roots.map(function (r) { return { root: r, replies: notes.filter(function (n) { return n.parent_id === r.id; }) }; }); }
    function paintNotes() {
      var open = notes.filter(function (n) { return !n.parent_id && !n.resolved; });
      LE.setNotes(ed, open, activeId);
      notesCol.replaceChildren.apply(notesCol, threads().filter(function (t) { return !t.root.resolved; }).map(function (t) {
        var r = t.root, card = h('div', { class: 'lv-card' + (r.id === activeId ? ' on' : ''), onclick: function () { activeId = r.id; paintNotes(); } },
          h('div', { class: 'lv-q' }, '“' + r.quote.slice(0, 80) + (r.quote.length > 80 ? '…' : '') + '”'),
          [r].concat(t.replies).map(function (n) { return h('div', { class: 'lv-note' }, h('b', null, n.author_name + ': '), n.body); }));
        if (r.id === activeId) {
          var ta = h('input', { type: 'text', placeholder: 'Reply…', class: 'grow' });
          card.appendChild(h('div', { class: 'row' }, ta, h('button', { class: 'btn small', onclick: async function (ev) { ev.stopPropagation(); if (!ta.value.trim()) return; if (await P.run(function () { return rpc('policy_note_add', { p_slug: slug, p_ref: '', p_quote: r.quote, p_prefix: r.prefix, p_body: ta.value, p_parent: r.id, p_name: myName() }).then(function () { return true; }); })) { send('notes', {}); reloadNotes(); } } }, 'Reply'),
            h('button', { class: 'ghost small', onclick: async function (ev) { ev.stopPropagation(); if (await P.run(function () { return rpc('policy_note_resolve', { p_id: r.id, p_resolved: true, p_name: myName() }).then(function () { return true; }); })) { send('notes', {}); reloadNotes(); } } }, 'Resolve')));
        }
        return card;
      }));
    }
    async function reloadNotes() { try { notes = (await rpc('policy_note_list', { p_slug: slug })) || []; } catch (e) { /* keep what we have */ } if (ed) paintNotes(); }
    cmBtn.addEventListener('mousedown', function (ev) { ev.preventDefault(); });
    cmBtn.addEventListener('click', function () {
      var q = LE.selectionQuote(ed); if (!q) return; var ta = h('textarea', { rows: 3, class: 'grow', placeholder: 'Write a comment' });
      var box = h('div', { class: 'lv-card on' }, h('div', { class: 'lv-q' }, '“' + q.quote.slice(0, 80) + '”'), ta,
        h('div', { class: 'row' }, h('button', { class: 'btn small', onclick: async function () { if (!ta.value.trim()) return;
          if (await P.run(function () { return rpc('policy_note_add', { p_slug: slug, p_ref: '', p_quote: q.quote, p_prefix: q.prefix, p_body: ta.value, p_parent: null, p_name: myName() }).then(function () { return true; }); })) { send('notes', {}); box.remove(); reloadNotes(); } } }, 'Comment'),
          h('button', { class: 'ghost small', onclick: function () { box.remove(); } }, 'Cancel')));
      notesCol.prepend(box); cmBtn.hidden = true; ta.focus();
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
        if (val === 'none') { if (!confirm('Remove access for ' + email + '?')) { load(); return; } try { await rpc('policy_editor_remove', { p_slug: slug, p_email: email }); P.toast('Removed access'); } catch (e) { P.toast(P.friendly(e), true); } load(); return; }
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
        sel = item; draw();
        (async function () {
          var md = '';
          try { md = item.kind === 'current' ? LE.markdownOf(ed) : item.kind === 'pub' ? ((await rpc('policy_text', { p_slug: slug, p_version: item.version })) || {}).body_md : await rpc('policy_backup_text', { p_slug: slug, p_id: item.id }); } catch (e) { P.toast('Could not load that version', true); }
          if (pvEd) pvEd.destroy(); pv.replaceChildren(); pvEd = LE.preview(pv, md || '');
        })();
        banner.replaceChildren(h('span', { class: 'gd-hname' }, item.kind === 'current' ? 'Current version' : item.label || stamp(item.at)),
          item.kind !== 'save' || !canEdit ? null : h('button', { type: 'button', class: 'gd-btn fill', onclick: async function () {
            if (!confirm('Restore this version for everyone? What is there now is kept in the version history.')) return;
            if (await P.run(function () { return rpc('policy_restore_backup', { p_slug: slug, p_id: item.id, p_name: myName() }).then(function () { return true; }); }, 'Restored')) location.reload(); } }, 'Restore this version'));
      }
      function draw() {
        var list = items.filter(function (i) { return !onlyNamed.checked || i.kind === 'pub'; }), last = '';
        var out = [];
        list.forEach(function (i) {
          var lab = dayLabel(i.at); if (lab !== last) { out.push(h('div', { class: 'gd-day' }, lab)); last = lab; }
          var on = sel && sel.key === i.key;
          out.push(h('button', { type: 'button', class: 'gd-ver' + (on ? ' on' : ''), onclick: function () { show(i); } },
            h('span', { class: 'gd-vtxt' }, h('span', { class: i.kind === 'pub' ? 'gd-vt named' : 'gd-vt' }, i.kind === 'current' ? 'Current version' : i.label || stamp(i.at)),
              i.kind === 'pub' ? h('span', { class: 'gd-vs' }, stamp(i.at)) : null,
              h('span', { class: 'gd-vwho' }, h('i', { style: 'background:' + colourFor(i.by || '?') }), i.by || 'Someone'))));
        });
        if (!out.length) out.push(h('div', { class: 'muted', style: 'padding:16px' }, 'No named versions yet. A version is named when the President publishes.'));
        body.replaceChildren.apply(body, out);
      }
      onlyNamed.addEventListener('change', draw);
      var back = h('button', { type: 'button', class: 'gd-back', 'aria-label': 'Back to the document', onclick: closeHistory }); back.appendChild(svg(PATH.back, 22));
      histPanel = h('aside', { class: 'gd-hist', 'aria-label': 'Version history' }, h('div', { class: 'gd-htitle' }, 'Version history'), body,
        h('label', { class: 'gd-hfoot', for: 'gd-named' }, onlyNamed, ' Only show named versions'));
      histTop = h('div', { class: 'gd-htop' }, back, h('span', { class: 'gd-hname' }, 'Version history'), banner);
      lvEl.classList.add('hist'); lvBody.replaceChildren(pv, histPanel); lvRoot.insertBefore(histTop, lvTop); lvTop.hidden = true;
      curView = pv;
      var bk = []; try { bk = await rpc('policy_backups', { p_slug: slug }); } catch (e) { /* none */ }
      var pubs = (data.versions || (await rpc('policy_text', { p_slug: slug, p_version: data.doc.version > 0 ? data.doc.version : null }).catch(function () { return null; }) || {}).versions || []);
      items = [{ kind: 'current', key: 'cur', at: new Date().toISOString(), by: 'You and others, now' }]
        .concat(pubs.map(function (v) { return { kind: 'pub', key: 'p' + v.version, version: v.version, at: (v.effective_on || new Date().toISOString().slice(0, 10)) + 'T12:00:00', by: v.by, label: 'Version ' + v.version + (v.note ? ': ' + v.note : '') }; }))
        .concat(bk.map(function (b) { return { kind: 'save', key: 'b' + b.id, id: b.id, at: b.saved_at, by: b.by }; }));
      items.sort(function (a, b) { return a.kind === 'current' ? -1 : b.kind === 'current' ? 1 : new Date(b.at) - new Date(a.at); });
      show(items[0]);
    }
    function closeHistory() {
      if (!histOpen) return; histOpen = false; if (histTop) histTop.remove(); lvEl.classList.remove('hist'); lvBody.replaceChildren(lvScroll, notesCol); fitAll(); lvTop.hidden = false; paintNotes();
    }

    // ---- name and description (ExCo): click the name to rename; the info button edits the description ----
    var docInfo = { title: data.doc.title, summary: '' };
    function longDate(s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : ''; }
    // ---- the version token under the title: "Draft" or "Version N", opening a log of every publish with the President's comments ----
    var meta = { versions: [], status: data.doc.status, version: data.doc.version, effective_on: null };
    var tokenT = h('span', null, data.doc.version > 0 ? 'Version ' + data.doc.version : 'Draft · not yet in force'), tokenCaret = svg('<path d="m6 9 6 6 6-6"/>', 14);
    var token = h('button', { type: 'button', class: 'lv-token', 'aria-expanded': 'false', 'aria-controls': 'lv-log', title: 'Version log', onclick: toggleLog }, tokenT, tokenCaret);
    var logEl = h('div', { class: 'lv-log', id: 'lv-log', hidden: true }), metaLine = h('div', { class: 'lv-meta' }, token, logEl);
    function toggleLog() { var open = logEl.hidden; logEl.hidden = !open; token.setAttribute('aria-expanded', open ? 'true' : 'false'); token.classList.toggle('open', open); }
    function drawLog() {
      logEl.replaceChildren();
      if (!meta.versions.length) { logEl.appendChild(h('p', { class: 'lv-log-empty' }, 'Not published yet. When the President publishes, the document becomes a numbered version that members can read, and each publish is recorded here with the President\u2019s comments.')); return; }
      meta.versions.forEach(function (v) {
        logEl.appendChild(h('div', { class: 'lv-log-item' }, h('div', { class: 'lv-log-h' }, h('b', null, 'Version ' + v.version), v.effective_on ? ' \u00b7 in force from ' + longDate(v.effective_on) : ''),
          h('div', { class: 'lv-log-by' }, 'Published by ' + (v.by || 'the President')), v.note ? h('p', { class: 'lv-log-note' }, v.note) : null));
      });
    }
    var metaFirst = true;
    function refreshMeta(w) {
      if (!w || !w.doc) return; if (metaFirst) { docInfo.summary = w.doc.summary || ''; metaFirst = false; }
      meta.versions = w.versions || []; meta.status = w.doc.status; meta.version = w.doc.version; meta.effective_on = w.doc.effective_on;
      tokenT.textContent = w.doc.status === 'in_force' && w.doc.version > 0 ? 'Version ' + w.doc.version + (w.doc.effective_on ? ' \u00b7 In force from ' + longDate(w.doc.effective_on) : ' \u00b7 In force') : 'Draft \u00b7 not yet in force';
      drawLog(); if (typeof pubLink !== 'undefined' && pubLink) { pubLink.hidden = !(w.doc.version > 0); pubLink.href = '#/d/' + slug + '?v=' + w.doc.version; pubLink.textContent = 'Published version ' + w.doc.version; }
    }
    function loadMeta() { return (P.exco ? rpc('policy_work', { p_slug: slug }) : rpc('policy_text', { p_slug: slug })).then(refreshMeta).catch(function () { /* none */ }); }
    var sumP = loadMeta();
    async function saveInfo() {
      if (docInfo.title.trim().length < 3) { P.toast('The name needs at least 3 letters', true); setTitle(lastTitle, null); return false; }
      try { await rpc('policy_doc_save', { p_slug: slug, p_title: docInfo.title, p_summary: docInfo.summary }); lastTitle = docInfo.title.trim(); lastSummary = docInfo.summary; return true; } catch (e) { P.toast(P.friendly(e), true); return false; }
    }
    var lastTitle = data.doc.title, lastSummary = '';
    var titleEl = P.exco ? h('input', { type: 'text', class: 'gd-titleinput', maxlength: 120, value: data.doc.title, 'aria-label': 'Document name', title: 'Rename',
      oninput: function () { setTitle(titleEl.value, titleEl); }, onblur: function () { if (docInfo.title !== lastTitle) saveInfo(); },
      onkeydown: function (ev) { if (ev.key === 'Enter') titleEl.blur(); } }) : h('h1', null, data.doc.title);
    if (P.exco) titleEl.style.width = Math.max(8, data.doc.title.length + 1) + 'ch';
    // the name and description also sit at the top of the page itself; the bar, this block and the details box all show the same text
    function fit(el) { el.style.height = 'auto'; el.style.height = (el.scrollHeight + 3) + 'px'; }
    var titleT = h('textarea', { class: 'doc-title edit-in-place', rows: 1, maxlength: 120, 'aria-label': 'Document name', spellcheck: 'true', readonly: !P.exco }),
      descT = h('textarea', { class: 'muted edit-in-place', rows: 1, maxlength: 400, placeholder: P.exco ? 'Add a description' : '', 'aria-label': 'Description', readonly: !P.exco });
    titleT.value = data.doc.title;
    var infoT = null;
    function setTitle(v, from) { docInfo.title = v; if (from !== titleEl && titleEl.tagName === 'INPUT') { titleEl.value = v; } if (titleEl.tagName === 'INPUT') titleEl.style.width = Math.max(8, v.length + 1) + 'ch'; if (from !== titleT) titleT.value = v; fit(titleT); }
    function setDesc(v, from) { docInfo.summary = v; if (from !== descT) descT.value = v; fit(descT); }
    sumP.then(function () { descT.value = docInfo.summary; fit(descT); });
    if (P.exco) {
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
    var histBtn = h('button', { type: 'button', class: 'gd-iconbtn', title: 'Version history', 'aria-label': 'Version history', onclick: openHistory }); histBtn.appendChild(svg(PATH.history, 22));
    var shareBtn = h('button', { type: 'button', class: 'gd-share', onclick: openShare }); shareBtn.appendChild(svg(PATH.lock, 16)); shareBtn.appendChild(document.createTextNode(' Share'));
    var pubLink = h('a', { href: '#/d/' + slug + '?v=' + data.doc.version, hidden: !(data.doc.version > 0) }, 'Published version ' + data.doc.version);
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
    var lvHead = h('div', { class: 'lv-head' }, h('a', { href: '#/' }, '← Documents'), titleEl, P.exco ? infoBtn : null, h('span', { class: 'pill warn', title: canEdit ? 'Everyone here edits the same working copy at once. The President publishes it as the next version; the published text does not change until then.' : 'You can read and comment. You cannot edit.' }, canEdit ? 'Working copy' : 'Working copy · read only'),
      pubLink, status, h('span', { class: 'lv-spacer' }), people,
      P.exco ? histBtn : null, pubBtn, P.exco || canEdit ? shareBtn : null);
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
    ed = LE.create({ onTableMenu: openTableMenu, element: editorEl, ydoc: ydoc, awareness: awareness, user: me, editable: canEdit,
      onNoteClick: function (id) { activeId = id; paintNotes(); },
      onSelection: function () {
        refreshTb(); var s = ed.state.selection; if (s.empty) { cmBtn.hidden = true; return; }
        var c = ed.view.coordsAtPos(s.to); cmBtn.hidden = false; cmBtn.style.cssText = 'position:fixed;z-index:30;left:' + Math.round(c.left) + 'px;top:' + Math.round(c.bottom + 6) + 'px';
      } });
    ed.on('transaction', refreshTb); drawPeople(); announce(); send('hello', {}); setStatus(canEdit ? 'All changes saved' : 'Read only'); await reloadNotes();
    var dtimer = setInterval(function () { paintNotes(); }, 15000);   // highlights follow the words as other people type
    ed.on('update', function () { clearTimeout(ed._pn); ed._pn = setTimeout(paintNotes, 400); });
    window.__live = { ed: ed, ydoc: ydoc, awareness: awareness, refreshMeta: refreshMeta };   // refreshMeta: handy for checking the version log without publishing
    P.onLeave(function () {
      closed = true; closePalette(); closeTableMenu(); clearInterval(dtimer); clearTimeout(pushT); cmBtn.remove();
      if (pending.length) { var b = pending; pending = []; rpc('policy_live_push', { p_slug: slug, p_update: LE.b64(Y.mergeUpdates(b)), p_md: LE.markdownOf(ed), p_name: myName(), p_epoch: epoch }).catch(function () { /* lost only if the tab died */ }); }
      LE.removeAwarenessStates(awareness, [ydoc.clientID], 'local'); try { P.sb.removeChannel(chan); } catch (e) { /* closing */ } ed.destroy();
    });
    window.addEventListener('beforeunload', function () { if (pending.length) push(); });
  }
  P.route('/live/:slug', { nav: 'docs', fn: livePage });
})();
