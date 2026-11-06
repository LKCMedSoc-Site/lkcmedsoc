// Dates are plain 'YYYY-MM-DD' strings and times 'HH:MM[:SS]', all Singapore time (ported from the portal's lib.js).
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => (n < 10 ? '0' : '') + n;

export type When = { start_date?: string | null; end_date?: string | null; start_time?: string | null; end_time?: string | null };

export function ymd(s?: string | null): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s ?? ''));
  return m ? [+m[1], +m[2], +m[3]] : null;
}
function dayOfWeek(s: string) { const p = ymd(s); return p ? new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay() : 0; }
export function addDays(s: string, n: number) {
  const p = ymd(s); if (!p) return '';
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
export function fmtDate(s?: string | null, withYear = false) {
  const p = ymd(s); if (!p || !s) return '';
  return `${DAYS[dayOfWeek(s)]} ${p[2]} ${MONTHS[p[1] - 1]}${withYear ? ' ' + p[0] : ''}`;
}
export function fmtTime(t?: string | null) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(t ?? '')); if (!m) return '';
  const h = +m[1]; const ap = h >= 12 ? 'pm' : 'am';
  return `${h % 12 || 12}${m[2] === '00' ? '' : ':' + m[2]} ${ap}`;
}
export function whenText(ev: When) {
  if (!ev.start_date) return 'Date to be confirmed';
  const multi = ev.end_date && ev.end_date !== ev.start_date;
  let out = fmtDate(ev.start_date) + (multi ? ' to ' + fmtDate(ev.end_date) : '');
  if (ev.start_time) { out += ', ' + fmtTime(ev.start_time); if (ev.end_time) out += ' to ' + fmtTime(ev.end_time); }
  return out;
}
/** "5 Nov 2026" for a timestamp, shown in Singapore time. */
export function postDate(iso?: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Singapore' });
}
