// One sign-in for every LKCMedSoc site: the Supabase session lives in a cookie shared by lkcmedsoc.com and all its
// subdomains (records., activities., feedback.), so signing in or out on one does it for all.
// Same logic as shared/sso.js (copied into records, activities-site and feedback-site): change one, change the other.
// On other addresses (localhost, preview links) it uses normal browser storage instead.
const CHUNK = 1800;       // characters per cookie, well under the 4 KB cookie limit after URL-encoding
const MAX_AGE = 180 * 86400;

function attrs(): string {
  const shared = /(^|\.)lkcmedsoc\.com$/.test(location.hostname);
  return '; Path=/; SameSite=Lax' + (shared ? '; Domain=.lkcmedsoc.com' : '') + (location.protocol === 'https:' ? '; Secure' : '');
}
function read(name: string): string | null {
  for (const c of document.cookie ? document.cookie.split('; ') : []) {
    const eq = c.indexOf('=');
    if (c.slice(0, eq) === name) { try { return decodeURIComponent(c.slice(eq + 1)); } catch { return null; } }
  }
  return null;
}
const write = (name: string, value: string) => { document.cookie = `${name}=${encodeURIComponent(value)}${attrs()}; Max-Age=${MAX_AGE}`; };
const drop = (name: string) => { document.cookie = `${name}=${attrs()}; Max-Age=0`; };

export const sharedSession = {
  getItem(key: string): string | null {
    if (typeof document === 'undefined') return null;
    const n = read(`${key}.n`);
    if (n === null) {
      // First visit after this change: bring an existing signed-in session across from this site's old storage.
      try { const old = localStorage.getItem(key); if (old) { sharedSession.setItem(key, old); return old; } } catch { /* storage blocked */ }
      return null;
    }
    let out = '';
    for (let i = 0; i < Number(n); i++) { const part = read(`${key}.${i}`); if (part === null) return null; out += part; }
    return out;
  },
  setItem(key: string, value: string): void {
    const old = Number(read(`${key}.n`)) || 0;
    const parts: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK) parts.push(value.slice(i, i + CHUNK));
    parts.forEach((p, j) => write(`${key}.${j}`, p));
    for (let k = parts.length; k < old; k++) drop(`${key}.${k}`);
    write(`${key}.n`, String(parts.length));
  },
  removeItem(key: string): void {
    const n = Number(read(`${key}.n`)) || 0;
    for (let i = 0; i < n; i++) drop(`${key}.${i}`);
    drop(`${key}.n`);
    try { localStorage.removeItem(key); } catch { /* storage blocked */ }
  },
};
