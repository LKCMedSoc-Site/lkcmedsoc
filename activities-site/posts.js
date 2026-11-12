// Write-ups: students write and submit them, approvers review them, ExCo appoints approvers.
// All writes go through the database functions in activities_posts.sql (and activities.set_post_ay from ay_layer.sql).
(function () {
  'use strict';
  var P = window.P, h = P.h, sb = P.sb;
  // The categories are managed by ExCo in the Gazette app (activities.post_categories).
  async function categoryNames(current) {
    var rows = P.must(await P.act.from('post_categories').select('name,hidden,ord').order('ord').order('name'));
    return rows.filter(function (r) { return !r.hidden || r.name === current; }).map(function (r) { return r.name; });
  }
  var EDITABLE = ['Draft', 'Changes requested', 'Unpublished'];
  var BUCKET = 'post-photos';
  var photoUrl = function (path) { return P.cfg.SUPABASE_URL + '/storage/v1/object/public/' + BUCKET + '/' + path; };
  function statusPill(s) { return P.pill(s, { Published: 'ok', Rejected: 'bad', 'Changes requested': 'warn', Unpublished: 'warn', Submitted: 'dark' }[s]); }
  function when(ts) { return ts ? new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Singapore' }) : ''; }

  // Resize a photo in the browser so it uploads quickly and stays under the 5 MB limit
  function shrink(file, max) {
    return new Promise(function (res, rej) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var r = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        c.toBlob(function (b) { b ? res(b) : rej(new Error('Could not read that image')); }, 'image/jpeg', 0.85);
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('Could not read that image')); };
      img.src = url;
    });
  }

  // Show saved text (with its photos) read-only, using the same look as the editor
  function tui() {   // the editor library loads from index.html; wait for it
    return Promise.resolve(window.toastuiReady).catch(function () { /* handled below */ }).then(function () { return window.toastui && window.toastui.Editor; });
  }
  function viewer(el, md) {
    el.textContent = md || '';
    tui().then(function (T) { if (T) { el.textContent = ''; T.factory({ el: el, viewer: true, initialValue: md || '' }); } });
  }

  // ---------- my write-ups ----------
  async function myPosts() {
    P.loading();
    var rows = P.must(await P.act.from('posts').select('id,title,category,status,ay,updated_at,decision_note').eq('author_email', P.me.email).order('updated_at', { ascending: false }));
    P.show(h('div', null, h('h2', null, 'My write-ups'),
      h('div', { class: 'row' }, h('a', { class: 'btn-link solid', href: '#/post/new' }, 'New write-up')),
      rows.length ? h('div', { class: 'list' }, rows.map(function (r) {
        return h('a', { class: 'item', href: '#/post/' + r.id }, h('div', { class: 't' }, r.title),
          h('div', { class: 's' }, r.category + (r.ay ? ' · ' + r.ay : '') + ' · updated ' + when(r.updated_at)),
          h('div', { class: 'meta' }, statusPill(r.status), r.decision_note && r.status !== 'Published' ? h('span', { class: 'sub' }, r.decision_note) : null));
      })) : h('p', { class: 'muted' }, 'You have not written anything yet.')));
  }

  // ---------- write / edit one ----------
  async function editor(p) {
    P.loading();
    var isNew = p.id === 'new', post = null, photos = [], curId = isNew ? null : p.id;
    if (!isNew) {
      post = P.must(await P.act.from('posts').select('*').eq('id', p.id).maybeSingle());
      if (!post) { P.show(h('p', { class: 'pill bad' }, 'Write-up not found.')); return; }
      if (post.author_email !== P.me.email) { P.nav('#/review/' + p.id); return; }
      photos = P.must(await P.act.from('post_photos').select('*').eq('post_id', p.id).order('ord'));
    }
    var editable = isNew || EDITABLE.indexOf(post.status) >= 0;
    var evs = P.must(await P.act.from('activity_list').select('id,title,start_date,ay,body,status').in('status', ['Approved', 'Completed']).order('start_date', { ascending: false, nullsFirst: false }).limit(300));
    var bodies = P.must(await P.rec.rpc('my_bodies'));
    var ays = await P.years();
    var CATS = await categoryNames(post && post.category);
    var evById = {}; evs.forEach(function (e) { evById[e.id] = e; });
    var defaultAy = P.defaultAy(ays), curAy = (post && post.ay) || defaultAy;

    var title = h('input', { id: 'p-title', class: 'grow', maxlength: 150, value: post ? post.title : '', placeholder: 'Title', disabled: !editable });
    var summary = h('textarea', { id: 'p-summary', maxlength: 300, placeholder: 'One or two sentences shown on the news list', disabled: !editable }, (post && post.summary) || '');
    var cat = P.select(CATS, post ? post.category : (CATS.indexOf('Activities') >= 0 ? 'Activities' : CATS[0]), { id: 'p-cat', disabled: !editable });
    var editorBox = h('div', { id: 'p-body' });
    var ev = P.select([['', 'Not about a specific event']].concat(evs.map(function (e) { return [e.id, e.title + ' (' + e.body + ', ' + e.ay + ')']; })), (post && post.activity_id) || '', { id: 'p-event', disabled: !editable });
    var body = P.select([['', 'No body']].concat(bodies.map(function (b) { return [b.id, b.name + ' (' + b.level + ')']; })), (post && post.body_id) || '', { id: 'p-body-id', disabled: !editable });
    var term = P.select(ays.map(function (y) { return [y.ay, y.ay + (y.is_open ? '' : ' (closed)')]; }), curAy, { id: 'p-ay', disabled: !editable });
    var showName = h('input', { id: 'p-show', type: 'checkbox', checked: post ? post.show_author : false, disabled: !editable });
    var termHint = h('div', { class: 'sub' }), bodyHint = h('div', { class: 'sub' });
    function sync() {   // a write-up about an event takes that event's term and body; otherwise you choose
      var e = evById[ev.value];
      if (e) { term.value = e.ay; term.disabled = true; body.disabled = true; termHint.textContent = 'Follows the event: ' + e.ay + '.'; bodyHint.textContent = 'Reviewed by the event\'s body (' + e.body + ').'; }
      else { term.disabled = !editable; body.disabled = !editable; termHint.textContent = 'Defaults to the current term. Change it if this belongs to an earlier one.'; bodyHint.textContent = 'Pick a body you manage, or leave empty and an all-posts approver or ExCo reviews it.'; }
    }
    ev.addEventListener('change', sync); sync();

    // ----- the text editor (photos live inside the text) -----
    var ed = null;
    var bodyAtLoad = (post && post.body_md) || '';
    var photoRows = photos.slice();      // every photo registered to this write-up
    var managed = {};                    // photos that belong to the text: in it when opened, or added this visit
    photos.forEach(function (f) { if (bodyAtLoad.indexOf(f.path) >= 0) managed[f.path] = true; });
    var mdNow = function () { return ed ? ed.getMarkdown() : bodyAtLoad; };
    function collect(md) {
      var s = { title: title.value.trim(), summary: summary.value, body_md: md, category: cat.value, show_author: showName.checked, activity_id: ev.value };
      if (!ev.value) s.body_id = body.value;
      return s;
    }
    async function ensureDraft() {       // a photo needs a saved write-up to belong to
      if (curId) return curId;
      if (!title.value.trim()) throw new Error('Give the write-up a title first, then add the photo.');
      curId = P.must(await P.act.rpc('save_post', { p_id: null, s: collect(mdNow()) }));
      history.replaceState(null, '', '#/post/' + curId);
      return curId;
    }
    async function addImage(file, done) {
      var path = null;
      try {
        if (photoRows.length >= 12) throw new Error('A write-up can have up to 12 photos.');
        var id = await ensureDraft();
        var blob = await shrink(file, 1800);
        path = id + '/' + crypto.randomUUID().replace(/-/g, '').slice(0, 16) + '.jpg';
        var r = await sb.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' });
        if (r.error) throw r.error;
        var pid = P.must(await P.act.rpc('add_post_photo', { p_id: id, p_path: path, p_caption: null }));
        photoRows.push({ id: pid, path: path }); managed[path] = true;
        done(photoUrl(path), '');
      } catch (e) {
        if (path) { try { await sb.storage.from(BUCKET).remove([path]); } catch (x) { /* ignore */ } }
        P.toast(P.friendly(e), true);
      }
    }
    async function dropUnused(md) {      // a photo taken out of the text is deleted when you save
      var gone = photoRows.filter(function (f) { return managed[f.path] && md.indexOf(f.path) < 0; });
      for (var i = 0; i < gone.length; i++) {
        P.must(await P.act.rpc('remove_post_photo', { p_photo: gone[i].id }));
        try { await sb.storage.from(BUCKET).remove([gone[i].path]); } catch (x) { /* ignore */ }
        delete managed[gone[i].path];
      }
      photoRows = photoRows.filter(function (f) { return gone.indexOf(f) < 0; });
    }
    async function startEditor() {
      editorBox.replaceChildren(h('p', { class: 'muted' }, 'Loading the editor…'));
      var T = await tui();
      if (!T) { editorBox.replaceChildren(h('p', { class: 'pill bad' }, 'The text editor could not load. Check your connection and refresh the page.')); return; }
      editorBox.replaceChildren();
      if (!editable) { viewer(editorBox, bodyAtLoad); return; }
      ed = new T({
        el: editorBox, height: '460px', initialEditType: 'wysiwyg', hideModeSwitch: true, usageStatistics: false,
        initialValue: bodyAtLoad,
        placeholder: 'Write here. Use the buttons above for headings, bold, lists and photos. You can also paste or drag photos in.',
        toolbarItems: [['heading', 'bold', 'italic'], ['hr', 'quote'], ['ul', 'ol'], ['image', 'link']],
        hooks: { addImageBlobHook: addImage }
      });
    }

    async function doSave() {
      if (!title.value.trim()) { P.toast('Give the write-up a title', true); return null; }
      save.disabled = true;
      var id = await P.run(async function () {
        var md = mdNow();
        var rid = P.must(await P.act.rpc('save_post', { p_id: curId, s: collect(md) }));
        curId = rid;
        if (!ev.value && term.value !== curAy) P.must(await P.act.rpc('set_post_ay', { p_id: rid, p_ay: term.value }));
        await dropUnused(md);
        return rid;
      }, 'Saved');
      save.disabled = false;
      return id || null;
    }
    var save = h('button', { class: 'btn', id: 'p-save', onclick: async function () {
      var id = await doSave();
      if (id) P.nav('#/post/' + id);
    } }, 'Save');

    var parts = [h('h2', null, isNew ? 'New write-up' : 'Write-up'), post ? h('div', { class: 'row' }, statusPill(post.status), post.ay ? P.pill(post.ay) : null) : null];
    if (post && post.decision_note && post.status !== 'Published') parts.push(h('div', { class: 'card' }, h('b', null, post.status + ': '), post.decision_note));
    if (!editable) parts.push(h('p', { class: 'muted' }, post.status === 'Submitted' ? 'Waiting for a reviewer. You can take it back to keep editing.' : 'This write-up is locked.'));
    parts.push(P.field('Title', title), P.field('Summary', summary, 'Up to 300 characters.'), P.field('Category', cat),
      P.field('About an event', ev), P.field('MedSoc term', term, null), termHint, P.field('Body', body), bodyHint,
      P.field('Text', editorBox), h('label', { class: 'chk' }, showName, 'Show my name on the post'));
    if (editable) parts.push(h('div', { class: 'sticky' }, save));

    if (!isNew) {
      // Photos from the old website sit in a gallery under the text rather than inside it
      var extra = photos.filter(function (f) { return bodyAtLoad.indexOf(f.path) < 0; });
      if (extra.length) {
        parts.push(h('h3', null, 'Gallery photos (' + extra.length + ')'),
          h('p', { class: 'muted' }, 'These show as a gallery under the text.' + (editable ? ' Save your text first if you remove one.' : '')),
          h('div', { class: 'row' }, extra.map(function (f) {
            return h('div', { style: 'text-align:center' }, h('img', { src: photoUrl(f.path), style: 'width:110px;height:110px;object-fit:cover;border-radius:8px', alt: '' }),
              editable ? h('div', null, h('button', { class: 'ghost', onclick: async function () {
                if (await P.run(async function () { P.must(await P.act.rpc('remove_post_photo', { p_photo: f.id })); await sb.storage.from(BUCKET).remove([f.path]); }, 'Removed')) P.dispatch();
              } }, 'Remove')) : null);
          })));
      }

      var acts = [];
      if (editable) {
        acts.push(h('button', { class: 'btn', onclick: async function () {
          var id = await doSave(); if (!id) return;   // save the text first so nothing is lost
          if (await P.run(async function () { P.must(await P.act.rpc('submit_post', { p_id: id })); }, 'Submitted for review')) P.dispatch();
        } }, 'Save and submit for review'));
        acts.push(h('button', { class: 'danger', onclick: async function () {
          if (!confirm('Delete this write-up and its photos?')) return;
          if (await P.run(async function () { P.must(await P.act.rpc('delete_post', { p_id: post.id })); }, 'Deleted')) P.nav('#/posts');
        } }, 'Delete'));
      } else if (post.status === 'Submitted') {
        acts.push(h('button', { class: 'ghost', onclick: async function () {
          if (await P.run(async function () { P.must(await P.act.rpc('withdraw_post', { p_id: post.id })); }, 'Taken back to draft')) P.dispatch();
        } }, 'Take back to edit'));
      } else if (post.status === 'Published') {
        acts.push(h('button', { class: 'danger', onclick: async function () {
          if (!confirm('Take this post off the website?')) return;
          if (await P.run(async function () { P.must(await P.act.rpc('unpublish_post', { p_id: post.id })); }, 'Taken down')) P.dispatch();
        } }, 'Take down'));
      }
      if (acts.length) parts.push(h('div', { class: 'row' }, acts));
    }
    parts.push(h('div', { class: 'row' }, P.link('#/posts', 'All my write-ups')));
    P.show(h('div', { class: 'stack' }, parts));
    startEditor();
  }

  // ---------- review ----------
  async function reviewList() {
    P.loading();
    var q = P.act.from('posts_flat').select('*').eq('status', 'Submitted'); if (!P.exco) q = q.neq('author_email', P.me.email);
    var rows = P.must(await q.order('submitted_at'));
    P.show(h('div', null, h('h2', null, 'Review'),
      rows.length ? h('div', { class: 'list' }, rows.map(function (r) {
        return h('a', { class: 'item', href: '#/review/' + r.id }, h('div', { class: 't' }, r.title),
          h('div', { class: 's' }, r.category + (r.body ? ' · ' + r.body : '') + ' · by ' + (r.author_name || r.author_email) + ' · submitted ' + when(r.submitted_at)));
      })) : h('p', { class: 'muted' }, 'Nothing is waiting for you.')));
  }

  async function reviewDetail(p) {
    P.loading();
    var post = P.must(await P.act.from('posts').select('*').eq('id', p.id).maybeSingle());
    if (!post) { P.show(h('p', { class: 'pill bad' }, 'Write-up not found, or it is not yours to review.')); return; }
    var photos = P.must(await P.act.from('post_photos').select('*').eq('post_id', p.id).order('ord'));
    var flat = P.must(await P.act.from('posts_flat').select('body').eq('id', p.id).maybeSingle()) || {};
    var note = h('textarea', { id: 'r-note', placeholder: 'Say what needs to change (needed for Request changes and Reject)' });
    function decide(label, decision, cls) {
      return h('button', { class: cls, onclick: async function () {
        if (await P.run(async function () { P.must(await P.act.rpc('decide_post', { p_id: post.id, p_decision: decision, p_note: P.blank(note.value) })); }, label + ': done')) P.nav('#/review');
      } }, label);
    }
    var bodyBox = h('div', { class: 'card' });
    var gallery = photos.filter(function (f) { return (post.body_md || '').indexOf(f.path) < 0; });   // photos not already inside the text
    var parts = [h('h2', null, post.title),
      h('div', { class: 'row' }, statusPill(post.status), P.pill(post.category), post.ay ? P.pill(post.ay) : null, flat.body ? P.pill(flat.body) : null),
      h('div', { class: 'sub' }, 'By ' + (post.author_name || post.author_email) + (post.show_author ? ' (name will be shown)' : ' (name hidden)') + ' · submitted ' + when(post.submitted_at)),
      post.summary ? h('p', { style: 'font-weight:700' }, post.summary) : null,
      bodyBox,
      gallery.length ? h('div', { class: 'row' }, gallery.map(function (f) { return h('img', { src: photoUrl(f.path), style: 'width:140px;height:140px;object-fit:cover;border-radius:8px', alt: '' }); })) : null];
    if (post.status === 'Submitted' && (post.author_email !== P.me.email || P.exco)) {
      parts.push(note, h('div', { class: 'row' }, decide('Publish', 'Published', 'btn'), decide('Request changes', 'Changes requested', 'ghost'), decide('Reject', 'Rejected', 'danger')));
    } else if (post.status === 'Published') {
      parts.push(h('div', { class: 'row' }, h('button', { class: 'danger', onclick: async function () {
        var why = prompt('Why is it being taken down?'); if (!why) return;
        if (await P.run(async function () { P.must(await P.act.rpc('unpublish_post', { p_id: post.id, p_note: why })); }, 'Taken down')) P.nav('#/review');
      } }, 'Take down')));
    }
    parts.push(h('div', { class: 'row' }, P.link('#/review', 'Back to the list')));
    P.show(h('div', { class: 'stack' }, parts));
    viewer(bodyBox, post.body_md);
  }

  // ---------- approvers (ExCo) ----------
  async function approvers() {
    P.loading();
    var rows = P.must(await P.act.from('approvers_flat').select('*').order('active', { ascending: false }).order('appointed_at', { ascending: false }));
    var bodies = P.must(await P.rec.rpc('my_bodies')), ays = await P.years();
    var email = h('input', { id: 'ap-email', type: 'email', class: 'grow', placeholder: 'person@e.ntu.edu.sg' });
    var scope = P.select([['All', 'All write-ups'], ['Body', 'One body (and the CCAs under it, if a committee)']], 'All', { id: 'ap-scope' });
    var body = P.select(bodies.map(function (b) { return [b.id, b.name + ' (' + b.level + ')']; }), (bodies[0] || {}).id, { id: 'ap-body', hidden: true });
    var ay = P.select(ays.filter(function (y) { return y.is_open; }).map(function (y) { return [y.ay, y.ay]; }), P.defaultAy(ays), { id: 'ap-ay' });
    var note = h('input', { id: 'ap-note', class: 'grow', placeholder: 'Note (optional)' });
    scope.addEventListener('change', function () { body.hidden = scope.value !== 'Body'; });
    var add = h('button', { class: 'btn', id: 'ap-add', onclick: async function () {
      if (email.value.indexOf('@') < 0) { P.toast('Enter their email', true); return; }
      if (await P.run(async function () { P.must(await P.act.rpc('appoint_approver', { p_email: email.value, p_scope: scope.value, p_body: scope.value === 'Body' ? body.value : null, p_ay: ay.value, p_note: P.blank(note.value) })); }, 'Appointed')) P.dispatch();
    } }, 'Appoint');
    P.show(h('div', { class: 'stack' }, h('h2', null, 'Approvers'),
      h('p', { class: 'muted' }, 'Approvers publish student write-ups. An appointment belongs to a term and ends when that term is closed. Nobody can approve their own write-up.'),
      h('div', { class: 'card stack' }, h('h3', { style: 'margin-top:0' }, 'Appoint someone'), h('div', { class: 'row' }, email), h('div', { class: 'row' }, scope, body, ay), h('div', { class: 'row' }, note), h('div', { class: 'row' }, add)),
      rows.length ? P.table(['Person', 'Covers', 'Term', 'Status', ''], rows.map(function (r) {
        return [(r.name ? r.name + ' ' : '') + r.email, r.scope === 'All' ? 'All write-ups' : r.body, r.ay, r.active ? P.pill('Active', 'ok') : P.pill(r.revoked_at ? 'Ended' : 'Term closed'),
          r.active ? h('button', { class: 'danger', onclick: async function () {
            if (!confirm('End this appointment?')) return;
            if (await P.run(async function () { P.must(await P.act.rpc('revoke_approver', { p_id: r.id })); }, 'Ended')) P.dispatch();
          } }, 'End') : ''];
      })) : h('p', { class: 'muted' }, 'No approvers appointed yet. ExCo can always approve.')));
  }

  P.route('/posts', { public: false, nav: 'posts', fn: myPosts });
  P.route('/post/:id', { public: false, nav: 'posts', fn: editor });
  P.route('/review', { public: false, nav: 'review', fn: reviewList });
  P.route('/review/:id', { public: false, nav: 'review', fn: reviewDetail });
  P.route('/approvers', { public: false, nav: 'approvers', exco: true, fn: approvers });
})();
