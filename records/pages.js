// "Group pages": managers edit the public page of the bodies they manage (images, blurb, links, write-up).
(function () {
  'use strict';
  var SITE = 'https://lkcmedsoc.com';
  var state = { id: null };

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function slug(s, stripCommittee) { s = String(s || '').toLowerCase(); if (stripCommittee) s = s.replace(/ committee$/, ''); return s.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

  // Same block syntax as the website (site/src/lib/markdown.ts). Keep the two in step.
  function renderMd(md) {
    var lines = String(md || '').replace(/\r/g, '').split('\n'), out = [], buf = [], i = 0, m;
    function flush() { if (buf.length) { out.push(window.marked.parse(buf.join('\n'))); buf = []; } }
    while (i < lines.length) {
      var ln = lines[i];
      if ((m = /^:::(callout|photos|quote)\s*$/.exec(ln))) {
        flush(); var inner = []; i++;
        while (i < lines.length && !/^:::\s*$/.test(lines[i])) { inner.push(lines[i]); i++; }
        i++;
        var html = window.marked.parse(inner.join('\n'));
        out.push(m[1] === 'callout' ? '<aside class="blk-callout">' + html + '</aside>' : m[1] === 'photos' ? '<div class="blk-photos">' + html + '</div>' : '<figure class="blk-quote">' + html + '</figure>');
        continue;
      }
      if ((m = /^:::button\s+(.+?)\s*\|\s*(https?:\/\/\S+)\s*$/.exec(ln))) { flush(); out.push('<p><a class="blk-button" href="' + esc(m[2]) + '">' + esc(m[1]) + '</a></p>'); i++; continue; }
      buf.push(ln); i++;
    }
    flush();
    return window.DOMPurify.sanitize(out.join('\n'), { ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'a', 'ul', 'ol', 'li', 'blockquote', 'h2', 'h3', 'h4', 'hr', 'img', 'aside', 'div', 'figure', 'code'], ALLOWED_ATTR: ['href', 'src', 'alt', 'class'] });
  }

  // Shrink a photo in the browser before uploading (smaller, faster pages).
  async function shrink(file, maxW) {
    try {
      var bmp = await createImageBitmap(file);
      var s = Math.min(1, maxW / bmp.width), c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(bmp.width * s)); c.height = Math.max(1, Math.round(bmp.height * s));
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      var blob = await new Promise(function (r) { c.toBlob(r, 'image/webp', 0.86); });
      return blob && blob.size < file.size ? blob : file;
    } catch (e) { return file; }
  }

  async function upload(kit, bodyId, file, maxW) {
    if (!/^image\//.test(file.type)) throw new Error('Please choose an image file.');
    if (file.size > 15 * 1024 * 1024) throw new Error('That image is over 15 MB. Choose a smaller one.');
    var blob = await shrink(file, maxW);
    var ext = ({ 'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif' })[blob.type] || 'jpg';
    var path = bodyId + '/' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7) + '.' + ext;
    var r = await kit.sb.storage.from('body-images').upload(path, blob, { contentType: blob.type, cacheControl: '31536000' });
    if (r.error) throw r.error;
    return kit.sb.storage.from('body-images').getPublicUrl(path).data.publicUrl;
  }

  function imageField(kit, bodyId, label, hint, initial, maxW, round) {
    var h = kit.h, url = initial || '', prev = h('div', { class: 'imgprev' + (round ? ' round' : '') }), msg = h('span', { class: 'muted' });
    var input = h('input', { type: 'file', accept: 'image/*', hidden: true });
    function paint() {
      prev.replaceChildren(url ? h('img', { src: url, alt: '' }) : h('span', { class: 'muted' }, 'No image yet'));
      rm.hidden = !url;
    }
    var rm = h('button', { class: 'ghost', type: 'button', onclick: function () { url = ''; paint(); } }, 'Remove');
    var pick = h('button', { class: 'btn', type: 'button', onclick: function () { input.click(); } }, 'Upload image');
    input.addEventListener('change', async function () {
      var f = input.files[0]; if (!f) return;
      pick.disabled = true; msg.textContent = 'Uploading…';
      try { url = await upload(kit, bodyId, f, maxW); msg.textContent = 'Uploaded. Press Save to publish it.'; paint(); }
      catch (e) { msg.textContent = ''; kit.toast(kit.friendly ? kit.friendly(e) : e.message, true); }
      pick.disabled = false; input.value = '';
    });
    paint();
    return { get: function () { return url; }, el: h('div', { class: 'card' }, h('strong', null, label), h('p', { class: 'muted' }, hint), prev, h('div', { class: 'row' }, pick, rm, msg), input) };
  }

  function editor(kit, bodyId, initial) {
    var h = kit.h;
    var ta = h('textarea', { class: 'md', rows: 16, placeholder: 'Tell people what your group does, who it is for and how to get involved.' });
    ta.value = initial || '';
    var preview = h('div', { class: 'md-preview prose', hidden: true });
    var fileIn = h('input', { type: 'file', accept: 'image/*', hidden: true });
    function wrap(before, after, placeholder) {
      var s = ta.selectionStart, e = ta.selectionEnd, sel = ta.value.slice(s, e) || placeholder || '';
      ta.setRangeText(before + sel + after, s, e, 'select'); ta.focus();
    }
    function block(text) {
      var s = ta.selectionStart, pre = ta.value.slice(0, s), lead = pre && !/\n\n$/.test(pre) ? (/\n$/.test(pre) ? '\n' : '\n\n') : '';
      ta.setRangeText(lead + text + '\n\n', s, ta.selectionEnd, 'end'); ta.focus();
    }
    function tb(label, title, fn) { return h('button', { class: 'ghost sm', type: 'button', title: title, onclick: fn }, label); }
    fileIn.addEventListener('change', async function () {
      var f = fileIn.files[0]; if (!f) return;
      try { var u = await upload(kit, bodyId, f, 1600); wrap('![', '](' + u + ')', 'describe the photo'); }
      catch (e) { kit.toast(kit.friendly ? kit.friendly(e) : e.message, true); }
      fileIn.value = '';
    });
    var write = true;
    var toggle = h('button', { class: 'ghost sm', type: 'button', onclick: function () {
      write = !write; ta.hidden = !write; preview.hidden = write; toolbar.classList.toggle('dim', !write);
      if (!write) preview.innerHTML = renderMd(ta.value) || '<p class="muted">Nothing to preview yet.</p>';
      toggle.textContent = write ? 'Preview' : 'Back to editing';
    } }, 'Preview');
    var toolbar = h('div', { class: 'toolbar' },
      tb('Heading', 'Section heading', function () { wrap('## ', '', 'Heading'); }),
      tb('B', 'Bold', function () { wrap('**', '**', 'bold text'); }),
      tb('I', 'Italic', function () { wrap('*', '*', 'italic text'); }),
      tb('Link', 'Link', function () { var u = prompt('Link address (starts with https://)'); if (u) wrap('[', '](' + u + ')', 'link text'); }),
      tb('List', 'Bulleted list', function () { block('- First point\n- Second point'); }),
      tb('Photo', 'Upload and insert a photo', function () { fileIn.click(); }),
      h('span', { class: 'sep' }),
      tb('Join button', 'A big button linking somewhere', function () { var u = prompt('Where should the button go? (https://…)'); if (u) block(':::button Join us | ' + u); }),
      tb('Callout', 'A highlighted box', function () { block(':::callout\nImportant note here.\n:::'); }),
      tb('Photo row', 'Several photos side by side', function () { block(':::photos\n![](https://)\n![](https://)\n:::'); }),
      tb('Quote', 'A pull quote', function () { block(':::quote\n“What a memorable experience.”\n— Name, Year 3\n:::'); }),
      toggle);
    return { get: function () { return ta.value; }, el: h('div', null, toolbar, ta, preview, fileIn, h('p', { class: 'muted' }, 'Blocks start with ::: on their own line; callouts, photo rows and quotes end with a line of just :::. Use Preview to check how it looks.')) };
  }

  // The colours a body can choose for its chip, badge and card. None are purple (that is the site's own colour); every one takes white text.
  // Keep in step with TONE_SLOTS in site/src/lib/tones.ts and the check in sql/body_color.sql.
  var COLORS = { blue: '#1d4ed8', cyan: '#0e7490', teal: '#0f766e', green: '#15803d', amber: '#b45309', orange: '#c2410c', red: '#b91c1c', slate: '#475569' };
  function colorField(kit, initial, name) {
    var h = kit.h, value = COLORS[initial] ? initial : '';
    var chip = h('span', { class: 'colorchip' }, name);
    var buttons = [];
    function paint() {
      chip.style.background = value ? COLORS[value] : '#8a8494';
      buttons.forEach(function (b) { b.btn.setAttribute('aria-pressed', b.key === value ? 'true' : 'false'); });
    }
    function swatch(key, label, bg) {
      var btn = h('button', { type: 'button', class: 'swatch' + (key ? '' : ' auto'), title: label, 'aria-label': label, style: bg ? 'background:' + bg : null, onclick: function () { value = key; paint(); } }, key ? '' : 'Auto');
      buttons.push({ key: key, btn: btn });
      return btn;
    }
    var row = h('div', { class: 'swatches' }, swatch('', 'Automatic', null), Object.keys(COLORS).map(function (k) { return swatch(k, k.charAt(0).toUpperCase() + k.slice(1), COLORS[k]); }));
    paint();
    return { get: function () { return value; }, el: h('div', { class: 'card' }, h('strong', null, 'Group colour'), h('p', { class: 'muted' }, 'Used for your filter chip, your badge and your card on the website. Auto picks one for you; a group with no colour of its own uses its committee’s.'), row, h('div', { class: 'row' }, chip)) };
  }

  async function load(kit, body) {
    var h = kit.h, slot = kit.slot;
    slot.replaceChildren(h('p', { class: 'muted' }, 'Loading…'));
    var r = await kit.run(async function () {
      return kit.must(await kit.sb.from('bodies').select('id,name,level,parent_committee,description,about_md,logo_url,header_url,instagram,website,recruitment_url,color').eq('id', body.id).single());
    });
    if (!r) return;
    var logo = imageField(kit, r.id, 'Logo', 'Square works best. Shown as a round badge on your card and page.', r.logo_url, 400, true);
    var header = imageField(kit, r.id, 'Header image', 'A wide photo (landscape). Shown at the top of your card and your page.', r.header_url, 1800, false);
    var color = colorField(kit, r.color, r.name);
    var blurb = h('textarea', { rows: 3, maxlength: 400, placeholder: 'One or two lines for your card, e.g. “Weekly visits to cheer up paediatric patients.”' });
    blurb.value = r.description || '';
    var count = h('span', { class: 'muted' }, '');
    function cnt() { count.textContent = blurb.value.length + ' / 400'; }
    blurb.addEventListener('input', cnt); cnt();
    var join = h('input', { value: r.recruitment_url || '', placeholder: 'https://forms.gle/…' });
    var ig = h('input', { value: r.instagram || '', placeholder: '@yourgroup' });
    var web = h('input', { value: r.website || '', placeholder: 'https://…' });
    var about = editor(kit, r.id, r.about_md);
    var view = r.level === 'CCA/Project' && r.parent_committee ? SITE + '/student-groups/' + slug(r.parent_committee, true) + '/' + slug(r.name) : null;
    var save = h('button', { class: 'btn', type: 'button', onclick: async function () {
      save.disabled = true;
      var ok = await kit.run(async function () {
        kit.must(await kit.sb.rpc('save_my_body', { b: r.id, p_description: blurb.value, p_about_md: about.get(), p_logo_url: logo.get(), p_header_url: header.get(), p_instagram: ig.value, p_website: web.value, p_recruitment_url: join.value }));
        kit.must(await kit.sb.rpc('save_my_body_color', { b: r.id, p_color: color.get() || null }));
        return true;
      }, 'Saved. The website updates within a few minutes.');
      save.disabled = false;
      void ok;
    } }, 'Save changes');
    slot.replaceChildren(
      h('div', { class: 'row' }, h('h3', { style: 'margin:0' }, r.name), view ? h('a', { href: view, target: '_blank', rel: 'noopener' }, 'View public page ↗') : null),
      h('div', { class: 'two' }, logo.el, header.el),
      color.el,
      h('div', { class: 'card' }, h('strong', null, 'Short description'), h('p', { class: 'muted' }, 'Appears on your card in the Student Groups list.'), blurb, count),
      h('div', { class: 'card' }, h('strong', null, 'Links'), kit.field('Join / sign-up link', join), kit.field('Instagram', ig), kit.field('Website', web)),
      h('div', { class: 'card' }, h('strong', null, 'About your group'), h('p', { class: 'muted' }, 'The full write-up on your group’s page. Add photos, links and highlighted blocks.'), about.el),
      h('div', { class: 'row' }, save));
  }

  window.GroupPages = {
    view: async function (kit) {
      var h = kit.h;
      kit.show(h('p', { class: 'muted' }, 'Loading…'));
      var bodies = await kit.run(async function () { return kit.must(await kit.sb.rpc('my_bodies')); });
      if (!bodies) return;
      bodies = bodies.filter(function (b) { return b.level === 'CCA/Project' || b.level === 'Committee' || b.level === 'House'; });
      if (!bodies.length) { kit.show(h('p', { class: 'muted' }, 'You do not manage a group page yet. Ask an admin to add you as a manager.')); return; }
      if (!state.id || !bodies.some(function (b) { return b.id === state.id; })) state.id = bodies[0].id;
      var slot = h('div');
      var sel = h('select', { class: 'grow', onchange: function () { state.id = sel.value; load(Object.assign({}, kit, { slot: slot }), bodies.filter(function (b) { return b.id === state.id; })[0]); } },
        bodies.map(function (b) { return h('option', { value: b.id, selected: b.id === state.id }, b.name + ' (' + b.level + ')'); }));
      kit.show(h('div', null, h('h2', null, 'Group pages'), h('p', { class: 'muted' }, 'This is what the public sees on the website. Pick a group you manage.'), h('div', { class: 'row' }, sel), slot));
      load(Object.assign({}, kit, { slot: slot }), bodies.filter(function (b) { return b.id === state.id; })[0]);
    }
  };
})();
