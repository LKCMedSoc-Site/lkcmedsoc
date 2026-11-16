// "Group pages": managers edit the public page of the bodies they manage (images, blurb, links, write-up).
(function () {
  'use strict';
  var SITE = 'https://lkcmedsoc.com';
  var state = { id: null };

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function slug(s, stripCommittee) { s = String(s || '').toLowerCase(); if (stripCommittee) s = s.replace(/ committee$/, ''); return s.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

  // Same block syntax as the website (site/src/lib/markdown.ts). Keep the two in step.
  var OPENS = /^:::(callout|photos|quote|columns|toggle)(?:\s+.*)?$/;
  function videoEmbed(raw) {
    try {
      var u = new URL(String(raw).trim()); if (u.protocol !== 'https:') return null;
      var host = u.hostname.replace(/^(www\.|m\.)/, ''), id = null, m;
      if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
      else if (host === 'youtube.com') id = u.pathname === '/watch' ? u.searchParams.get('v') : /^\/(embed|shorts|live)\//.test(u.pathname) ? u.pathname.split('/')[2] : null;
      if (id && /^[A-Za-z0-9_-]{11}$/.test(id)) return 'https://www.youtube-nocookie.com/embed/' + id;
      if ((host === 'vimeo.com' || host === 'player.vimeo.com') && (m = /\/(?:video\/)?(\d{6,12})(?:\/|$)/.exec(u.pathname))) return 'https://player.vimeo.com/video/' + m[1];
    } catch (e) { /* not a link */ }
    return null;
  }
  // The optional `cols=3 w=70 align=center` on a :::photos line (same rule as photoOpts in site/src/lib/markdown.ts).
  function photoOpts(line) {
    var c = /\bcols=([234])\b/.exec(line), w = /\bw=(\d{1,3})\b/.exec(line), al = /\balign=(left|center|right)\b/.exec(line);
    return (c ? ' data-cols="' + c[1] + '"' : '') + (w ? ' data-w="' + Math.min(100, Math.max(10, +w[1])) + '"' : '') + (w && al ? ' data-align="' + al[1] + '"' : '');
  }
  function blocks(lines, videos, depth) {
    var out = [], buf = [], i = 0, m;
    function flush() { if (buf.length) { out.push(window.marked.parse(buf.join('\n'))); buf = []; } }
    while (i < lines.length) {
      var ln = lines[i];
      if (depth < 4 && (m = OPENS.exec(ln))) {
        flush(); var inner = [], open = 1; i++;
        while (i < lines.length) {
          if (/^:::\s*$/.test(lines[i])) { open--; if (open === 0) break; } else if (OPENS.test(lines[i])) open++;
          inner.push(lines[i]); i++;
        }
        i++;
        var kind = m[1];
        if (kind === 'columns') {
          var cols = [[]], nest = 0;
          inner.forEach(function (l) {
            if (/^:::\s*$/.test(l)) nest--; else if (OPENS.test(l)) nest++;
            if (nest === 0 && /^\|\|\|\s*$/.test(l)) cols.push([]); else cols[cols.length - 1].push(l);
          });
          out.push('<div class="blk-columns" data-n="' + Math.min(cols.length, 4) + '">' + cols.slice(0, 4).map(function (c) { return '<div class="blk-col">' + blocks(c, videos, depth + 1) + '</div>'; }).join('') + '</div>');
          continue;
        }
        var html = blocks(inner, videos, depth + 1);
        if (kind === 'toggle') out.push('<details class="blk-toggle"><summary>' + esc(ln.replace(/^:::toggle\s*/, '').trim() || 'More') + '</summary>' + html + '</details>');
        else out.push(kind === 'callout' ? '<aside class="blk-callout">' + html + '</aside>' : kind === 'photos' ? '<div class="blk-photos"' + photoOpts(ln) + '>' + html + '</div>' : '<figure class="blk-quote">' + html + '</figure>');
        continue;
      }
      if ((m = /^:::button\s+(.+?)\s*\|\s*(https?:\/\/\S+)\s*$/.exec(ln))) { flush(); out.push('<p><a class="blk-button" href="' + esc(m[2]) + '">' + esc(m[1]) + '</a></p>'); i++; continue; }
      if ((m = /^:::video\s+(\S+)\s*$/.exec(ln))) { var emb = videoEmbed(m[1]); if (emb) { flush(); videos.push(emb); out.push('<p>LKCVIDEO' + (videos.length - 1) + 'TOKEN</p>'); i++; continue; } }
      buf.push(ln); i++;
    }
    flush();
    return out.join('\n');
  }
  function renderMd(md) {
    var videos = [], html = blocks(String(md || '').replace(/\r/g, '').split('\n'), videos, 0);
    var clean = window.DOMPurify.sanitize(html, { ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'a', 'ul', 'ol', 'li', 'blockquote', 'h2', 'h3', 'h4', 'hr', 'img', 'aside', 'div', 'figure', 'code', 'details', 'summary'], ALLOWED_ATTR: ['href', 'src', 'alt', 'class', 'data-n', 'data-cols', 'data-w', 'data-align'] });
    clean = clean.replace(/<div class="blk-photos"([^>]*)>/g, function (m, a) {
      var w = /data-w="(\d{1,3})"/.exec(a); if (!w) return m;
      var al = (/data-align="(left|center|right)"/.exec(a) || [])[1];
      return '<div class="blk-photos"' + a + ' style="width:' + Math.min(100, Math.max(10, +w[1])) + '%;' + (al === 'center' ? 'margin-left:auto;margin-right:auto;' : al === 'right' ? 'margin-left:auto;' : '') + '">';
    });
    clean = clean.replace(/<img ([^>]*?)\s*\/?>\{w=(\d{1,3})(?:\s+align=(left|center|right))?\}/g, function (_m, a, w, al) { return '<img ' + a + ' class="blk-img' + (al ? ' blk-img-' + al : '') + '" style="width:' + Math.min(100, Math.max(10, +w)) + '%">'; });
    return clean.replace(/<p>LKCVIDEO(\d+)TOKEN<\/p>/g, function (_m, n) { return videos[+n] ? '<div class="blk-video"><iframe src="' + videos[+n] + '" title="Video" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>' : ''; });
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
      tb('Quote', 'A pull quote', function () { block(':::quote\n“What a memorable experience.”\n\n— Name, Year 3\n:::'); }),
      h('span', { class: 'sep' }),
      tb('Columns', 'Text side by side (a line of just ||| starts the next column)', function () { block(':::columns\n\n|||\n\n:::'); }),
      tb('Toggle', 'A section people can open and close', function () { block(':::toggle Question or title\nThe answer or details go here.\n:::'); }),
      tb('Video', 'A YouTube or Vimeo video', function () { var u = prompt('Video link (YouTube or Vimeo)'); if (u) block(':::video ' + u.trim()); }),
      tb('Divider', 'A thin line between sections', function () { block('---'); }),
      toggle);
    // Visual mode (type on the page). Loaded on demand; if it cannot load, the plain text box simply stays.
    var ve = null, veHost = h('div', { hidden: true }), mode = 'text', modeBtn = h('button', { class: 'ghost sm', type: 'button' }, 'Loading page editor…');
    modeBtn.disabled = true;
    var hint = h('p', { class: 'muted' }, 'Blocks start with ::: on their own line and end with a line of just :::. Blocks can sit inside columns and toggles; in columns a line of just ||| starts the next column. Emoji work in headings. Use Preview to check how it looks.');
    function setMode(m) {
      if (m === mode) return;
      if (m === 'visual') { ve.setMarkdown(ta.value); } else { ta.value = ve.get(); }
      mode = m; var vis = m === 'visual';
      veHost.hidden = !vis; ta.hidden = vis || !write; toolbar.hidden = vis; preview.hidden = vis || write; hint.hidden = vis;
      modeBtn.textContent = vis ? 'Edit as text' : 'Edit on the page';
    }
    modeBtn.addEventListener('click', function () { if (ve) setMode(mode === 'visual' ? 'text' : 'visual'); });
    import('./visual-editor.js').then(function (mod) {
      ve = mod.create({ markdown: ta.value, marked: window.marked, render: renderMd, videoEmbed: videoEmbed, upload: function (f) { return upload(kit, bodyId, f, 1600); }, onError: function (e) { kit.toast(kit.friendly ? kit.friendly(e) : e.message, true); } });
      veHost.appendChild(ve.el); modeBtn.disabled = false; modeBtn.textContent = 'Edit on the page';
      setMode('visual');
    }).catch(function () { modeBtn.textContent = 'Page editor unavailable'; });
    return { get: function () { return mode === 'visual' && ve ? ve.get() : ta.value; }, el: h('div', null, h('div', { class: 'row' }, modeBtn), veHost, toolbar, ta, preview, fileIn, hint) };
  }

  // Icon links for the group's page. Instagram, website and the join link have their own boxes above; these are everything else (Telegram, TikTok, email…).
  // Keep the kinds in step with SOCIAL_KINDS in site/src/lib/group-links.ts and the check in sql/body_socials.sql.
  var SOCIALS = { instagram: 'Instagram', telegram: 'Telegram', tiktok: 'TikTok', youtube: 'YouTube', facebook: 'Facebook', linkedin: 'LinkedIn', whatsapp: 'WhatsApp', discord: 'Discord', x: 'X', email: 'Email', website: 'Website' };
  function guessKind(u) {
    u = String(u || '').trim();
    if (/^mailto:|^[^@\s]+@[^@\s]+\.[^@\s]+$/i.test(u)) return 'email';
    var host = ''; try { host = new URL(u).hostname.replace(/^www\./, '').toLowerCase(); } catch (e) { return 'website'; }
    if (/(^|\.)instagram\.com$/.test(host)) return 'instagram';
    if (host === 't.me' || /(^|\.)telegram\.(me|org)$/.test(host)) return 'telegram';
    if (/(^|\.)tiktok\.com$/.test(host)) return 'tiktok';
    if (/(^|\.)youtube\.com$/.test(host) || host === 'youtu.be') return 'youtube';
    if (/(^|\.)facebook\.com$/.test(host) || host === 'fb.com') return 'facebook';
    if (/(^|\.)linkedin\.com$/.test(host)) return 'linkedin';
    if (host === 'wa.me' || /(^|\.)whatsapp\.com$/.test(host)) return 'whatsapp';
    if (/(^|\.)discord\.(gg|com)$/.test(host)) return 'discord';
    if (host === 'x.com' || host === 'twitter.com') return 'x';
    return 'website';
  }
  /** A bare address such as abc.com becomes https://abc.com (the saved links must start with https://). Emails and Instagram @handles are left alone. */
  function fixLink(kind, u) {
    u = String(u || '').trim();
    if (!u || kind === 'email' || /^(https?:|mailto:)/i.test(u) || (kind === 'instagram' && u.indexOf('/') < 0)) return u;
    return /^[\w-]+(\.[\w-]+)+([/?#]\S*)?$/.test(u) ? 'https://' + u : u;
  }
  function socialsField(kit, initial, card) {
    var h = kit.h, rows = [], list = h('div', { class: 'socials' });
    function addRow(kind, url) {
      var sel = h('select', { 'aria-label': 'Type of link' }, Object.keys(SOCIALS).map(function (k) { return h('option', { value: k }, SOCIALS[k]); }));
      sel.value = SOCIALS[kind] ? kind : 'website';
      var inp = h('input', { value: url || '', placeholder: 'Paste a link (or an @handle for Instagram), e.g. https://t.me/yourgroup', 'aria-label': 'Link' });
      inp.addEventListener('input', function () { var v = inp.value.trim(); if (v) sel.value = /^@[\w.]+$/.test(v) ? 'instagram' : guessKind(v); });
      inp.addEventListener('blur', function () { inp.value = fixLink(sel.value, inp.value); });
      var row = h('div', { class: 'socialrow' }, sel, inp, h('button', { class: 'ghost sm', type: 'button', title: 'Remove', onclick: function () { rows = rows.filter(function (r) { return r.el !== row; }); row.remove(); } }, 'Remove'));
      rows.push({ el: row, sel: sel, inp: inp }); list.appendChild(row);
    }
    (initial || []).forEach(function (x) { addRow(x.kind, x.kind === 'email' ? x.url : x.url); });
    var add = h('button', { class: 'ghost sm', type: 'button', onclick: function () { if (rows.length < 12) addRow('website', ''); } }, '+ Add a link');
    return {
      get: function () { return rows.map(function (r) { return { kind: r.sel.value, url: fixLink(r.sel.value, r.inp.value) }; }).filter(function (x) { return x.url; }); },
      el: h('div', { class: 'card' }, h('strong', null, (card && card.title) || 'Social and contact links'), (card && card.before) || null,
        h('p', { class: 'muted' }, (card && card.lead) || 'Shown as small icons on your page, next to your Instagram and website. Add Telegram, TikTok, YouTube, an email address and more; the type is picked for you from the link.'), list, add)
    };
  }

  /** One list for every link that shows as an icon. Instagram and the website have their own database columns, so they are listed first and split back out on save. */
  function linksField(kit, r, join) {
    var h = kit.h, seed = [];
    if (r.instagram) seed.push({ kind: 'instagram', url: r.instagram });
    if (r.website) seed.push({ kind: 'website', url: r.website });
    (r.socials || []).forEach(function (x) { if (!seed.some(function (y) { return y.kind === x.kind && y.url === x.url; })) seed.push(x); });
    var f = socialsField(kit, seed, {
      title: 'Links',
      before: [kit.field('Join / sign-up link', join), h('p', { class: 'muted' }, 'Shown as a “Join us” button on your page.')],
      lead: 'Your Instagram, website, Telegram, TikTok, YouTube, an email address and more. They show as small icons on your page. Paste a link (or an @handle for Instagram) and the type is picked for you.'
    });
    return {
      el: f.el,
      get: function () {
        var ig = null, web = null, rest = [];
        f.get().forEach(function (x) { if (x.kind === 'instagram' && !ig) ig = x; else if (x.kind === 'website' && !web) web = x; else rest.push(x); });
        return { instagram: ig ? ig.url : '', website: web ? web.url : '', socials: rest };
      }
    };
  }

  // The colours a body can choose for its chip, badge and card. None are purple (that is the site's own colour); every one takes white text.
  // Keep in step with TONE_SLOTS in site/src/lib/tones.ts and the check in sql/body_color.sql.
  var COLORS = { blue: '#1d4ed8', cyan: '#0e7490', teal: '#0f766e', green: '#15803d', amber: '#b45309', orange: '#c2410c', red: '#b91c1c', slate: '#475569' };
  // Any colour can be chosen. It is stored as #rrggbb; the website (site/src/lib/tones.ts) and this preview both darken it, only if needed,
  // until white text on it reaches 4.5:1 contrast, so a pale pick can never make a chip unreadable. Keep the two copies of readable() in step.
  function lum(hex) {
    var c = [1, 3, 5].map(function (i) { var v = parseInt(hex.substr(i, 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function readable(hex) {
    var rgb = [1, 3, 5].map(function (i) { return parseInt(hex.substr(i, 2), 16); });
    for (var n = 0; n < 40 && 1.05 / (lum('#' + rgb.map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join('')) + 0.05) < 4.5; n++) rgb = rgb.map(function (v) { return Math.round(v * 0.95); });
    return '#' + rgb.map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join('');
  }
  var HEX = /^#[0-9a-fA-F]{6}$/;
  function colorField(kit, initial, name) {
    var h = kit.h, value = (COLORS[initial] || HEX.test(initial || '')) ? initial : '';
    var note = h('p', { class: 'muted' }, '');
    var preview = h('div', { class: 'tonepreview' });
    var shortName = String(name || 'Your group').replace(/ Committee$/, '');
    function chipEl(cls, st, text) { return h('span', { class: 'tp-chip ' + cls, style: st }, text); }
    // The same four tones the website derives in site/src/lib/tones.ts: solid, white-on-solid text, a 12% wash and a 55% photo wash.
    function paintPreview(shown) {
      if (!shown) { preview.replaceChildren(h('p', { class: 'muted' }, 'A colour is picked for you (your committee’s colour if you belong to one). Choose a colour above to see how it would look.')); return; }
      var tint = shown + '1f', over = shown + '8c';
      function tone(label, use, bg, fg, text) { return h('div', { class: 'tp-tone' }, h('div', { class: 'tp-sw', style: 'background:' + bg + ';color:' + fg }, text || 'Aa'), h('strong', null, label), h('span', { class: 'muted' }, use)); }
      var photo = 'linear-gradient(135deg,#d9c4a3,#8a9fb0 55%,#4b5d6b)';
      preview.replaceChildren(
        h('strong', null, 'Tones used'),
        h('div', { class: 'tp-tones' },
          tone('Solid', 'Badges, bars and selected chips, with white text', shown, '#fff', shown),
          tone('Light wash', 'Resting chips, pills and tags', tint, shown, 'Aa'),
          tone('Coloured text', 'Links and headings on white', '#fff', shown, 'Aa'),
          tone('Photo wash', 'Over your header photo', over, '#fff', 'Aa')),
        h('strong', { style: 'display:block;margin-top:14px' }, 'How it will look'),
        h('div', { class: 'tp-demo' },
          h('div', { class: 'tp-card' },
            h('div', { class: 'tp-photo', style: 'background:' + photo }, h('div', { class: 'tp-over', style: 'background:' + over }), h('span', { class: 'tp-badge', style: 'background:' + shown }, shortName.charAt(0))),
            h('div', { class: 'tp-bar', style: 'background:' + shown }, shortName),
            h('div', { class: 'tp-body' }, h('strong', null, name || 'Your group'), h('span', { class: 'muted' }, 'Your card on the Student Groups page'))),
          h('div', { class: 'tp-side' },
            h('div', { class: 'muted' }, 'Filter chips'),
            h('div', { class: 'row' }, chipEl('', 'background:' + tint + ';color:' + shown + ';border-color:' + shown, shortName), chipEl('', 'background:' + shown + ';color:#fff;border-color:' + shown, shortName + ' ✓')),
            h('div', { class: 'muted' }, 'Event and news pills'),
            h('div', { class: 'row' }, chipEl('sq', 'background:' + tint + ';color:' + shown, 'Event'), chipEl('sq', 'background:' + shown + ';color:#fff', 'Event')),
            h('div', { class: 'muted' }, 'Links and buttons on your page'),
            h('div', { class: 'row' }, h('span', { class: 'tp-link', style: 'color:' + shown }, 'Join our next session'), chipEl('', 'background:' + shown + ';color:#fff;border-color:' + shown, 'Join us')),
            h('div', { class: 'tp-callout', style: 'background:' + tint + ';border-left:4px solid ' + shown }, 'A highlighted box in your write-up')))
      );
    }
    var buttons = [];
    var custom = h('input', { type: 'color', class: 'swatch-input', 'aria-label': 'Pick any colour' });
    var customBtn = h('label', { class: 'swatch custom', title: 'Pick any colour' }, h('span', null, 'Any'), custom);
    function hexOf(v) { return COLORS[v] || (HEX.test(v) ? v.toLowerCase() : ''); }
    function paint() {
      var raw = hexOf(value), shown = raw ? readable(raw) : '';
      paintPreview(shown);
      note.textContent = raw && shown !== raw ? 'Shown a little darker on the website so white text stays easy to read.' : '';
      buttons.forEach(function (b) { b.btn.setAttribute('aria-pressed', b.key === value ? 'true' : 'false'); });
      var isCustom = HEX.test(value);
      customBtn.setAttribute('aria-pressed', isCustom ? 'true' : 'false');
      customBtn.style.background = isCustom ? value : '';
      customBtn.classList.toggle('on', isCustom);
      if (isCustom) custom.value = value.toLowerCase();
    }
    function swatch(key, label, bg) {
      var btn = h('button', { type: 'button', class: 'swatch' + (key ? '' : ' auto'), title: label, 'aria-label': label, style: bg ? 'background:' + bg : null, onclick: function () { value = key; paint(); } }, key ? '' : 'Auto');
      buttons.push({ key: key, btn: btn });
      return btn;
    }
    custom.addEventListener('input', function () { value = custom.value.toLowerCase(); paint(); });
    var row = h('div', { class: 'swatches' }, swatch('', 'Automatic', null), Object.keys(COLORS).map(function (k) { return swatch(k, k.charAt(0).toUpperCase() + k.slice(1), COLORS[k]); }), customBtn);
    paint();
    return { get: function () { return value; }, el: h('div', { class: 'card' }, h('strong', null, 'Group colour'), h('p', { class: 'muted' }, 'Used for your filter chip, your badge and your card on the website. Pick a suggested colour or choose any colour you like with Any. Auto picks one for you; a group with no colour of its own uses its committee’s.'), row, preview, note) };
  }

  async function load(kit, body) {
    var h = kit.h, slot = kit.slot;
    slot.replaceChildren(h('p', { class: 'muted' }, 'Loading…'));
    var cols = 'id,name,level,parent_committee,description,about_md,logo_url,header_url,instagram,website,recruitment_url,color';
    var r = await kit.run(async function () {
      // socials only exists once sql/body_socials.sql has been run; until then the page still opens, without the icon-links box.
      var withSocials = await kit.sb.from('bodies').select(cols + ',socials').eq('id', body.id).single();
      if (!withSocials.error) return withSocials.data;
      return kit.must(await kit.sb.from('bodies').select(cols).eq('id', body.id).single());
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
    var hasSocials = Array.isArray(r.socials);
    var links = hasSocials ? linksField(kit, r, join) : null;
    var about = editor(kit, r.id, r.about_md);
    var view = r.level === 'CCA/Project' && r.parent_committee ? SITE + '/student-groups/' + slug(r.parent_committee, true) + '/' + slug(r.name) : null;
    var save = h('button', { class: 'btn', type: 'button', onclick: async function () {
      save.disabled = true;
      var ok = await kit.run(async function () {
        var lk = links ? links.get() : null;
        kit.must(await kit.sb.rpc('save_my_body', { b: r.id, p_description: blurb.value, p_about_md: about.get(), p_logo_url: logo.get(), p_header_url: header.get(), p_instagram: lk ? lk.instagram : ig.value, p_website: lk ? lk.website : web.value, p_recruitment_url: join.value }));
        kit.must(await kit.sb.rpc('save_my_body_color', { b: r.id, p_color: color.get() || null }));
        if (links) kit.must(await kit.sb.rpc('save_my_body_socials', { b: r.id, p_socials: lk.socials }));
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
      links ? links.el : h('div', { class: 'card' }, h('strong', null, 'Links'), kit.field('Join / sign-up link', join), kit.field('Instagram', ig), kit.field('Website', web)),
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
