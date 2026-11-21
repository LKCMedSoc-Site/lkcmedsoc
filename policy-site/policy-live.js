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
    var ydoc = new Y.Doc(), awareness = new LE.Awareness(ydoc), canEdit = data.access === 'edit', lastId = data.last_id || 0;
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
      try { var id = await rpc('policy_live_push', { p_slug: slug, p_update: LE.b64(Y.mergeUpdates(batch)), p_md: LE.markdownOf(ed), p_name: myName() }); lastId = Math.max(lastId, id); setStatus('All changes saved'); }
      catch (e) { pending = batch.concat(pending); setStatus('Not saved. Will retry.', 'bad'); clearTimeout(pushT); pushT = setTimeout(push, 4000); }
      pushing = false; if (pending.length) { clearTimeout(pushT); pushT = setTimeout(push, 300); }
    }
    function setStatus(t, kind) { status.textContent = t; status.className = 'savestate' + (kind ? ' ' + kind : ''); }

    // ---- loading the shared document ----
    await new Promise(function (ok) { chan.subscribe(function (s) { if (s === 'SUBSCRIBED' || s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') ok(s); }); });
    if (!data.state) {                                            // nobody has opened it yet: the first editor turns the markdown into the shared document
      if (!canEdit) { P.show(h('p', { class: 'muted' }, 'Nobody has started live editing of this document yet.')); return; }
      var tmp = new Y.Doc(); LE.seed(tmp, data.working_md);
      await rpc('policy_live_init', { p_slug: slug, p_state: LE.b64(Y.encodeStateAsUpdate(tmp)) });
      data = await rpc('policy_live_open', { p_slug: slug });
    }
    Y.applyUpdate(ydoc, LE.unb64(data.state), 'remote');
    (data.updates || []).forEach(function (u) { Y.applyUpdate(ydoc, LE.unb64(u), 'remote'); });
    lastId = data.last_id || 0;
    if (canEdit && (data.updates || []).length > 40) { rpc('policy_live_compact', { p_slug: slug, p_state: LE.b64(Y.encodeStateAsUpdate(ydoc)), p_upto: lastId }).catch(function () { /* next time */ }); }

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
    var toolbar = canEdit ? h('div', { class: 'lv-toolbar noprint', role: 'toolbar', 'aria-label': 'Formatting' },
      grp(tb('undo', 'Undo (your changes only)', function (c) { c.undo().run(); }), tb('redo', 'Redo', function (c) { c.redo().run(); })),
      grp(tb('bold', 'Bold', function (c) { c.toggleBold().run(); }, function () { return ed.isActive('bold'); }), tb('italic', 'Italic', function (c) { c.toggleItalic().run(); }, function () { return ed.isActive('italic'); })),
      grp(tb('article', 'Article title', function (c) { c.toggleHeading({ level: 2 }).run(); }, function () { return ed.isActive('heading'); }),
        tb('clause', 'Numbered clause', function (c) { c.toggleOrderedList().run(); }, function () { return ed.isActive('orderedList'); }),
        tb('sub', 'Make a sub-item (indent)', function (c) { c.sinkListItem('listItem').run(); }), tb('out', 'Back out of a sub-item', function (c) { c.liftListItem('listItem').run(); })),
      grp(tb('table', 'Insert a table', function (c) { c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); }),
        tb('rowAdd', 'Add a row below', function (c) { c.addRowAfter().run(); }), tb('colAdd', 'Add a column after', function (c) { c.addColumnAfter().run(); }),
        tb('rowDel', 'Delete this row', function (c) { c.deleteRow().run(); }), tb('colDel', 'Delete this column', function (c) { c.deleteColumn().run(); }), tb('tableDel', 'Delete the table', function (c) { c.deleteTable().run(); }))) : null;

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

    // ---- invites (ExCo) ----
    var invites = null;
    if (P.exco) {
      var em = h('input', { type: 'email', class: 'grow', placeholder: 'Email of someone to invite' }), mode = P.select([['edit', 'Can edit'], ['read', 'Can read and comment']], 'edit'), list = h('div', { class: 'muted' });
      async function drawInv() { try { var l = await rpc('policy_editor_list', { p_slug: slug }); list.replaceChildren.apply(list, l.map(function (e) { return h('div', null, e.email + ' · ' + (e.can_edit ? 'can edit' : 'read and comment') + ' ', h('button', { class: 'ghost small', onclick: async function () { await rpc('policy_editor_remove', { p_slug: slug, p_email: e.email }); drawInv(); } }, 'Remove')); })); if (!l.length) list.textContent = 'Only ExCo can open this document so far.'; } catch (e) { list.textContent = ''; } }
      invites = h('details', { class: 'lv-invite noprint' }, h('summary', null, 'Invite someone to this document'), h('div', { class: 'row' }, em, mode, h('button', { class: 'btn small', onclick: async function () {
        if (await P.run(function () { return rpc('policy_editor_add', { p_slug: slug, p_email: em.value, p_can_edit: mode.value === 'edit', p_name: myName() }).then(function () { return true; }); }, 'Invited')) { em.value = ''; drawInv(); } } }, 'Invite')),
        h('p', { class: 'sub' }, 'They sign in with that email (it is added to the sign-in list if it was not there) and open this page. They see only this document.'), list);
      drawInv();
    }

    P.show(h('div', { class: 'lv' }, h('div', { class: 'lv-head' }, h('a', { href: '#/' }, '← Documents'), h('h1', null, data.doc.title), h('span', { class: 'pill warn' }, 'Working copy'), people, status),
      h('p', { class: 'muted' }, canEdit ? 'Everyone here edits the same working copy at once. The President publishes it as the next version; the published text does not change until then.' : 'You can read and comment. You cannot edit.'),
      invites, toolbar, h('div', { class: 'lv-body' }, editorEl, notesCol)));
    document.body.appendChild(cmBtn);
    awareness.setLocalStateField('user', me);
    ed = LE.create({ element: editorEl, ydoc: ydoc, awareness: awareness, user: me, editable: canEdit,
      onNoteClick: function (id) { activeId = id; paintNotes(); },
      onSelection: function () {
        refreshTb(); var s = ed.state.selection; if (s.empty) { cmBtn.hidden = true; return; }
        var c = ed.view.coordsAtPos(s.to); cmBtn.hidden = false; cmBtn.style.cssText = 'position:fixed;z-index:30;left:' + Math.round(c.left) + 'px;top:' + Math.round(c.bottom + 6) + 'px';
      } });
    ed.on('transaction', refreshTb); drawPeople(); announce(); send('hello', {}); setStatus(canEdit ? 'All changes saved' : 'Read only'); await reloadNotes();
    var dtimer = setInterval(function () { paintNotes(); }, 15000);   // highlights follow the words as other people type
    ed.on('update', function () { clearTimeout(ed._pn); ed._pn = setTimeout(paintNotes, 400); });
    window.__live = { ed: ed, ydoc: ydoc, awareness: awareness };
    P.onLeave(function () {
      closed = true; clearInterval(dtimer); clearTimeout(pushT); cmBtn.remove();
      if (pending.length) { var b = pending; pending = []; rpc('policy_live_push', { p_slug: slug, p_update: LE.b64(Y.mergeUpdates(b)), p_md: LE.markdownOf(ed), p_name: myName() }).catch(function () { /* lost only if the tab died */ }); }
      LE.removeAwarenessStates(awareness, [ydoc.clientID], 'local'); try { P.sb.removeChannel(chan); } catch (e) { /* closing */ } ed.destroy();
    });
    window.addEventListener('beforeunload', function () { if (pending.length) push(); });
  }
  P.route('/live/:slug', { nav: 'docs', fn: livePage });
})();
