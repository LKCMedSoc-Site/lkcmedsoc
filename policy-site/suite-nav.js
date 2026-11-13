// The LKCMedSoc menu bar shown on top of every app (records, activities, feedback). Master copies live in shared/ at the repo root;
// after changing them run `node tools/sync-shared.mjs` so every site gets the update. Include it with:
//   <script src="suite-nav.js" defer></script>
// Where the menu comes from: the website's /api/navigation (always current, Student Groups included), with the copy of menu.json next to
// this script as the fallback, and the last good answer kept in the browser so the bar appears at once and still works offline.
// Set window.LKC_NAV_API before this script to use another address (or '' to skip the API). It adds nothing if no menu can be loaded,
// so an app never breaks because of it.
(function () {
  'use strict';
  var script = document.currentScript;
  if (!script || window.__lkcSuite) return;
  window.__lkcSuite = true;
  var base = script.src.replace(/[^/]*$/, '');

  var css = [
    '#lkc-suite{position:relative;z-index:200;background:#2a0628;color:#f5eff5;font:500 14px/1.2 DIN,"DIN Alternate",system-ui,-apple-system,"Segoe UI",sans-serif}',
    '#lkc-suite *{box-sizing:border-box}',
    '#lkc-suite a{color:inherit;text-decoration:none}',
    '#lkc-suite .lkc-bar{max-width:1200px;margin:0 auto;display:flex;align-items:center;gap:4px;padding:0 12px;min-height:42px}',
    '#lkc-suite .lkc-logo{font-weight:700;letter-spacing:.04em;font-size:16px;margin-right:10px;white-space:nowrap}',
    '#lkc-suite .lkc-logo span{color:#d3a6cf;font-weight:400}',
    '#lkc-suite .lkc-item{position:relative}',
    '#lkc-suite .lkc-item>a,#lkc-suite .lkc-item>button{display:flex;align-items:center;gap:5px;height:42px;padding:0 10px;color:#f5eff5;background:none;border:0;font:inherit;cursor:pointer;border-radius:0}',
    '#lkc-suite .lkc-item>a:hover,#lkc-suite .lkc-item>button:hover,#lkc-suite .lkc-item.lkc-open>button{background:#4d0a49}',
    '#lkc-suite .lkc-item.lkc-apps{margin-left:auto}',
    '#lkc-suite .lkc-item.lkc-apps>button{background:#ff9fe6;color:#2a0628;font-weight:700;border-radius:999px;height:30px;margin:6px 0}',
    '#lkc-suite .lkc-item.lkc-apps>button:hover,#lkc-suite .lkc-item.lkc-apps.open>button{background:#fff}',
    '#lkc-suite .lkc-caret{font-size:9px;opacity:.7}',
    '#lkc-suite .lkc-panel{display:none;position:absolute;left:0;top:42px;min-width:290px;max-width:360px;background:#fff;color:#2a0f28;border-radius:0 0 12px 12px;box-shadow:0 18px 40px -12px rgba(42,6,40,.5);padding:8px;z-index:5}',
    '#lkc-suite .lkc-item.lkc-apps .lkc-panel{left:auto;right:0}',
    '#lkc-suite .lkc-item.lkc-open .lkc-panel{display:block}',
    '#lkc-suite .lkc-panel a{display:block;padding:9px 12px;border-radius:8px;color:#2a0f28}',
    '#lkc-suite .lkc-panel a:hover{background:#ebe1fa}',
    '#lkc-suite .lkc-panel a small{display:block;color:#6a5a69;font-size:12px;font-weight:400;margin-top:2px}',
    '#lkc-suite .lkc-panel a.here{background:#f5eff5;box-shadow:inset 3px 0 0 #8e2a88}',
    '#lkc-suite .lkc-panel a.here b::after{content:" · you are here";font-weight:400;color:#8e2a88;font-size:12px}',
    '#lkc-suite .lkc-menu-btn{display:none;margin-left:auto;background:#4d0a49;color:#fff;border:0;border-radius:999px;height:30px;padding:0 14px;font:inherit;font-weight:700;cursor:pointer}',
    '@media (max-width:900px){#lkc-suite .lkc-item,#lkc-suite .lkc-item.lkc-apps{display:none}#lkc-suite .lkc-menu-btn{display:block}',
    '#lkc-suite.lkc-mobile-open .lkc-bar{flex-wrap:wrap;padding-bottom:10px}',
    '#lkc-suite.lkc-mobile-open .lkc-item,#lkc-suite.lkc-mobile-open .lkc-item.lkc-apps{display:block;width:100%;margin:0}',
    '#lkc-suite.lkc-mobile-open .lkc-item>a,#lkc-suite.lkc-mobile-open .lkc-item>button{width:100%;height:40px;margin:0;border-radius:6px;justify-content:space-between}',
    '#lkc-suite.lkc-mobile-open .lkc-item.lkc-apps>button{background:#ff9fe6;border-radius:6px;height:40px}',
    '#lkc-suite .lkc-panel,#lkc-suite .lkc-item.lkc-apps .lkc-panel{position:static;max-width:none;box-shadow:none;border-radius:8px}}'
  ].join('');
  var style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { if (k === 'text') n.textContent = attrs[k]; else n.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  var slug = function (s) { return String(s).toLowerCase().replace(/ committee$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); };

  // Closing menus on a click elsewhere or Escape: set up once, because the bar can be drawn again when a newer menu arrives.
  var closeAll = function () { var r = document.getElementById('lkc-suite'); if (r) r.querySelectorAll('.lkc-item.lkc-open').forEach(function (o) { o.classList.remove('lkc-open'); }); };
  document.addEventListener('click', closeAll);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeAll(); });

  function render(menu) {
    var old = document.getElementById('lkc-suite'); if (old) old.remove();
    var site = menu.site, host = location.hostname;
    var abs = function (href) { return /^https?:/.test(href) ? href : site + href; };
    var here = function (href) { try { return new URL(abs(href)).hostname === host; } catch (e) { return false; } };

    var root = el('div', { id: 'lkc-suite', role: 'navigation', 'aria-label': 'LKCMedSoc sites' });
    var bar = el('div', { class: 'lkc-bar' });
    bar.appendChild(el('a', { class: 'lkc-logo', href: site }, [document.createTextNode('LKCMedSoc')]));
    var groupsItem;
    menu.items.forEach(function (it) {
      var isApps = it.label === 'Apps';
      var item = el('div', { class: 'lkc-item' + (isApps ? ' lkc-apps' : '') });
      if (it.children) {
        var btn = el('button', { type: 'button', 'aria-expanded': 'false' }, [document.createTextNode(it.label), el('span', { class: 'lkc-caret', text: '▾' })]);
        var panel = el('div', { class: 'lkc-panel' });
        (isApps ? it.children : [{ label: 'All ' + it.label.toLowerCase(), href: it.href }].concat(it.children)).forEach(function (c) {
          panel.appendChild(el('a', { href: abs(c.href), class: here(c.href) && isApps ? 'lkc-here' : '' }, [el('b', { text: c.label }), c.note ? el('small', { text: c.note }) : null]));
        });
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          var open = !item.classList.contains('lkc-open');
          root.querySelectorAll('.lkc-item.lkc-open').forEach(function (o) { o.classList.remove('lkc-open'); o.firstChild.setAttribute('aria-expanded', 'false'); });
          if (open) { item.classList.add('lkc-open'); btn.setAttribute('aria-expanded', 'true'); }
        });
        item.appendChild(btn); item.appendChild(panel);
        if (it.label === 'Student Groups') groupsItem = panel;
      } else item.appendChild(el('a', { href: abs(it.href) }, [document.createTextNode(it.label)]));
      bar.appendChild(item);
    });
    var burger = el('button', { class: 'lkc-menu-btn', type: 'button', 'aria-label': 'Open the LKCMedSoc menu', text: 'Menu' });
    burger.addEventListener('click', function () { root.classList.toggle('lkc-mobile-open'); });
    bar.insertBefore(burger, bar.querySelector('.lkc-item'));
    root.appendChild(bar);
    document.body.insertBefore(root, document.body.firstChild);

    // Student Groups: the API already sends the committees that really have groups. Only when the menu came from the local copy, ask the
    // database directly (if this app can reach it) to replace the fallback list.
    var cfg = window.PORTAL_CONFIG || window.RECORDS_CONFIG;
    if (cfg && groupsItem && menu.source !== 'live') {
      fetch(cfg.SUPABASE_URL + '/rest/v1/public_bodies?select=name,level,parent_committee', { headers: { apikey: cfg.SUPABASE_ANON_KEY, 'Accept-Profile': 'records' } })
        .then(function (r) { return r.json(); }).then(function (rows) {
          var withGroups = {};
          rows.forEach(function (b) { if (b.level === 'CCA/Project' && b.parent_committee) withGroups[b.parent_committee] = true; });
          var names = Object.keys(withGroups).sort();
          if (!names.length) return;
          groupsItem.replaceChildren(el('a', { href: abs('/student-groups') }, [el('b', { text: 'All student groups' })]));
          names.forEach(function (n) { groupsItem.appendChild(el('a', { href: site + '/student-groups/' + slug(n) }, [el('b', { text: n })])); });
        }).catch(function () { /* the fallback list stays */ });
    }
  }

  var API = window.LKC_NAV_API !== undefined ? window.LKC_NAV_API : 'https://lkcmedsoc.com/api/navigation';
  var KEY = 'lkc-nav-v1', shown = null, shownFromApi = false;
  var noop = function () { /* no menu bar, or the one already shown stays: the app still works */ };
  var valid = function (m) { return !!(m && m.site && Array.isArray(m.items) && m.items.length); };
  var remembered = function () {
    try { var c = JSON.parse(localStorage.getItem(KEY) || 'null'); return c && valid(c.menu) && Date.now() - c.t < 7 * 864e5 ? c.menu : null; } catch (e) { return null; }
  };
  var remember = function (m) { try { localStorage.setItem(KEY, JSON.stringify({ t: Date.now(), menu: m })); } catch (e) { /* private mode */ } };
  var show = function (m, fromApi) { var key = JSON.stringify(m); if (key === shown) return; shown = key; shownFromApi = shownFromApi || fromApi; render(m); };

  // First paint: the last good answer, or the local menu.json. Then the API, which replaces it if it says something different.
  var first = remembered();
  if (first) show(first, false);
  else fetch(base + 'menu.json').then(function (r) { return r.json(); }).then(function (m) { if (valid(m) && !shownFromApi) show(m, false); }).catch(noop);
  if (API) {
    var ctl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 4000);
    fetch(API, ctl ? { signal: ctl.signal } : {})
      .then(function (r) { if (!r.ok) throw new Error('bad status'); return r.json(); })
      .then(function (m) { clearTimeout(timer); if (!valid(m)) return; remember(m); show(m, true); })
      .catch(noop);
  }
})();
