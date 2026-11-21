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
    function tb(label, title, fn) { var b = h('button', { type: 'button', class: 'lv-tb', title: title, onmousedown: function (ev) { ev.preventDefault(); }, onclick: function () { fn(ed.chain().focus()); } }, label); return b; }
    var toolbar = canEdit ? h('div', { class: 'lv-toolbar noprint' },
      tb('B', 'Bold', function (c) { c.toggleBold().run(); }), tb('I', 'Italic', function (c) { c.toggleItalic().run(); }),
      tb('Undo', 'Undo your changes', function (c) { c.undo().run(); }), tb('Redo', 'Redo', function (c) { c.redo().run(); }),
      tb('Article', 'Turn this line into an article title', function (c) { c.toggleHeading({ level: 2 }).run(); }),
      tb('Clause', 'Make this a numbered clause', function (c) { c.toggleOrderedList().run(); }),
      tb('Sub-item', 'Indent as a sub-item', function (c) { c.sinkListItem('listItem').run(); }),
      tb('Outdent', 'Back out of a sub-item', function (c) { c.liftListItem('listItem').run(); }),
      tb('Table', 'Insert a table', function (c) { c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); }),
      tb('+Row', 'Add a row below', function (c) { c.addRowAfter().run(); }), tb('+Col', 'Add a column after', function (c) { c.addColumnAfter().run(); }),
      tb('−Row', 'Delete this row', function (c) { c.deleteRow().run(); }), tb('−Col', 'Delete this column', function (c) { c.deleteColumn().run(); }), tb('−Table', 'Delete the table', function (c) { c.deleteTable().run(); })) : null;

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

    P.show(h('div', { class: 'lv' }, h('div', { class: 'lv-head' }, h('a', { href: '#/' }, '← Documents'), h('h1', null, data.doc.title + ' (live working copy)'), people, status),
      h('p', { class: 'muted' }, canEdit ? 'Everyone here edits the same working copy at once. The President publishes it as the next version; the published text does not change until then.' : 'You can read and comment. You cannot edit.'),
      invites, toolbar, h('div', { class: 'lv-body' }, editorEl, notesCol)));
    document.body.appendChild(cmBtn);
    awareness.setLocalStateField('user', me);
    ed = LE.create({ element: editorEl, ydoc: ydoc, awareness: awareness, user: me, editable: canEdit,
      onNoteClick: function (id) { activeId = id; paintNotes(); },
      onSelection: function () {
        var s = ed.state.selection; if (s.empty) { cmBtn.hidden = true; return; }
        var c = ed.view.coordsAtPos(s.to); cmBtn.hidden = false; cmBtn.style.cssText = 'position:fixed;z-index:30;left:' + Math.round(c.left) + 'px;top:' + Math.round(c.bottom + 6) + 'px';
      } });
    drawPeople(); announce(); send('hello', {}); setStatus(canEdit ? 'All changes saved' : 'Read only'); await reloadNotes();
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
