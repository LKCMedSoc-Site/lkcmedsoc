// One sign-in for every LKCMedSoc site. Supabase normally keeps the signed-in session in each site's own browser storage,
// so every site asks you to sign in again. Here the session lives in a cookie shared by lkcmedsoc.com and all its
// subdomains (records., activities., feedback., and the main site), so signing in or out on one does it for all.
// On any other address (localhost, preview links) it quietly uses normal browser storage instead.
// The master copy is shared/sso.js; run `node tools/sync-shared.mjs` to copy it into records, activities-site and feedback-site.
(function () {
  'use strict';
  var SHARED = /(^|\.)lkcmedsoc\.com$/.test(location.hostname);
  var ATTRS = '; Path=/; SameSite=Lax' + (SHARED ? '; Domain=.lkcmedsoc.com' : '') + (location.protocol === 'https:' ? '; Secure' : '');
  var YEAR = 180 * 86400;
  var CHUNK = 1800;   // characters per cookie: stays well under the 4 KB cookie limit after URL-encoding

  function read(name) {
    var all = document.cookie ? document.cookie.split('; ') : [];
    for (var i = 0; i < all.length; i++) {
      var eq = all[i].indexOf('=');
      if (all[i].slice(0, eq) === name) { try { return decodeURIComponent(all[i].slice(eq + 1)); } catch (e) { return null; } }
    }
    return null;
  }
  function write(name, value) { document.cookie = name + '=' + encodeURIComponent(value) + ATTRS + '; Max-Age=' + YEAR; }
  function drop(name) { document.cookie = name + '=' + ATTRS + '; Max-Age=0'; }

  var storage = {
    getItem: function (key) {
      var n = read(key + '.n');
      if (n === null) {
        // First visit after this change: bring an existing signed-in session across from this site's old storage.
        try { var old = localStorage.getItem(key); if (old) { storage.setItem(key, old); return old; } } catch (e) { /* storage blocked */ }
        return null;
      }
      var out = '';
      for (var i = 0; i < Number(n); i++) { var part = read(key + '.' + i); if (part === null) return null; out += part; }
      return out;
    },
    setItem: function (key, value) {
      var old = Number(read(key + '.n')) || 0, parts = [];
      for (var i = 0; i < value.length; i += CHUNK) parts.push(value.slice(i, i + CHUNK));
      parts.forEach(function (p, j) { write(key + '.' + j, p); });
      for (var k = parts.length; k < old; k++) drop(key + '.' + k);
      write(key + '.n', String(parts.length));
    },
    removeItem: function (key) {
      var n = Number(read(key + '.n')) || 0;
      for (var i = 0; i < n; i++) drop(key + '.' + i);
      drop(key + '.n');
      try { localStorage.removeItem(key); } catch (e) { /* storage blocked */ }
    }
  };
  window.LKCSession = { storage: storage, shared: SHARED };
})();
