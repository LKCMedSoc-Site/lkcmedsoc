import { addDays, type When } from './dates';

export type CalEvent = When & { id: string; title: string; venue?: string | null; summary?: string | null; body?: string | null };
const pad = (n: number) => (n < 10 ? '0' : '') + n;
const compact = (date: string, time: string) => date.replace(/-/g, '') + 'T' + String(time).replace(/:/g, '').slice(0, 4).padEnd(4, '0') + '00';

function plusHour(date: string, time: string): [string, string] {
  const m = /^(\d{1,2}):(\d{2})/.exec(time)!; const h = +m[1] + 1;
  return h >= 24 ? [addDays(date, 1), pad(h - 24) + ':' + m[2]] : [date, pad(h) + ':' + m[2]];
}
function span(ev: CalEvent) {
  const endDate = ev.end_date || ev.start_date!;
  if (!ev.start_time) return { allDay: true as const, start: ev.start_date!, end: addDays(endDate, 1) };
  const end = ev.end_time ? [endDate, ev.end_time] as [string, string] : plusHour(endDate, ev.start_time);
  return { allDay: false as const, start: [ev.start_date!, ev.start_time] as [string, string], end };
}
const esc = (t?: string | null) => String(t ?? '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
function fold(line: string) { const out: string[] = []; let s = line; while (s.length > 70) { out.push(s.slice(0, 70)); s = ' ' + s.slice(70); } out.push(s); return out.join('\r\n'); }

export function eventICS(ev: CalEvent, url: string) {
  if (!ev.start_date) return '';
  const sp = span(ev); const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//LKCMedSoc//Website//EN', 'CALSCALE:GREGORIAN',
    'BEGIN:VTIMEZONE', 'TZID:Asia/Singapore', 'BEGIN:STANDARD', 'DTSTART:19700101T000000', 'TZOFFSETFROM:+0800', 'TZOFFSETTO:+0800', 'TZNAME:SGT', 'END:STANDARD', 'END:VTIMEZONE',
    'BEGIN:VEVENT', `UID:${ev.id}@lkcmedsoc`, `DTSTAMP:${stamp}`];
  if (sp.allDay) lines.push('DTSTART;VALUE=DATE:' + sp.start.replace(/-/g, ''), 'DTEND;VALUE=DATE:' + sp.end.replace(/-/g, ''));
  else lines.push('DTSTART;TZID=Asia/Singapore:' + compact(sp.start[0], sp.start[1]), 'DTEND;TZID=Asia/Singapore:' + compact(sp.end[0], sp.end[1]));
  lines.push('SUMMARY:' + esc(ev.title));
  if (ev.venue) lines.push('LOCATION:' + esc(ev.venue));
  const desc = [ev.summary, ev.body ? 'Organised by ' + ev.body : '', url].filter(Boolean).join('\n\n');
  if (desc) lines.push('DESCRIPTION:' + esc(desc));
  lines.push('URL:' + url, 'END:VEVENT', 'END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

export function googleCalUrl(ev: CalEvent, url: string) {
  if (!ev.start_date) return '';
  const sp = span(ev);
  const dates = sp.allDay ? `${sp.start.replace(/-/g, '')}/${sp.end.replace(/-/g, '')}` : `${compact(sp.start[0], sp.start[1])}/${compact(sp.end[0], sp.end[1])}`;
  const details = [ev.summary, url].filter(Boolean).join('\n\n');
  return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(ev.title) + '&dates=' + dates +
    '&ctz=Asia%2FSingapore&location=' + encodeURIComponent(ev.venue || '') + '&details=' + encodeURIComponent(details);
}
