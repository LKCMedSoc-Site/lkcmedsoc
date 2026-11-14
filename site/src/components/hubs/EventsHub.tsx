'use client';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useState, type ReactNode } from 'react';
import { DataProvider } from '@plasmicapp/loader-nextjs';
import { browserClient, photoUrl } from '@/lib/supabase';
import { fetchBodies } from '@/lib/records-client';
import { committeeMap, type Body } from '@/lib/records';
import { toneFor } from '@/lib/tones';
import type { PublicEvent } from '@/lib/events';
import { fmtTime, whenText, ymd } from '@/lib/dates';
import { useHubSeed } from './HubSeed';
import { usePaging } from './paging';

const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export type EventsHubRef = {
  setSearch: (query: string) => void;
  setCommittee: (name: string) => void; toggleCommittee: (name: string) => void;
  setMonth: (key: string) => void; toggleMonth: (key: string) => void;
  setRsvpOnly: (on: boolean) => void; toggleRsvpOnly: () => void;
  setOpenToEveryone: (on: boolean) => void; toggleOpenToEveryone: () => void;
  nextPage: () => void; prevPage: () => void; goToPage: (page: number) => void;
  clearFilters: () => void;
  openEvent: (id: string) => void; closeEvent: () => void;
  prevMonth: () => void; nextMonth: () => void; setCalendarMonth: (key: string) => void;
};

const monthKey = (e: PublicEvent) => { const d = ymd(e.start_date); return d ? `${d[0]}-${String(d[1]).padStart(2, '0')}` : 'tbc'; };
const monthLabel = (k: string) => (k === 'tbc' ? 'Date to be confirmed' : `${LONG[+k.split('-')[1] - 1]} ${k.split('-')[0]}`);

const daysBetween = (a: string, b: string) => Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 864e5);
const shiftMonth = (k: string, by: number) => { const [y, m] = k.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + by, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };
const todayKey = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`; };

function toEvent(e: PublicEvent, cmap: Record<string, string>, bodies: Body[]) {
  const d = ymd(e.start_date); const committee = e.body ? cmap[e.body] ?? '' : '';
  const committeeBody = bodies.find((b) => b.level === 'Committee' && b.name === committee);
  const tone = toneFor(committeeBody?.color, committee || e.title);
  const endDate = e.end_date && e.end_date > (e.start_date ?? '') ? e.end_date : (e.start_date ?? '');
  const dayCount = e.start_date && endDate ? daysBetween(e.start_date, endDate) + 1 : 1;
  const spotsText = !e.rsvp_open ? '' : e.spots_left == null ? 'RSVP open' : e.spots_left === 0 ? 'Full: waitlist open' : `${e.spots_left} spot${e.spots_left === 1 ? '' : 's'} left`;
  return {
    color: tone.bg, onColor: tone.fg, tint: tone.tint, overlay: tone.overlay, isMultiDay: dayCount > 1, dayCount, multiDayText: dayCount > 1 ? `${dayCount}-day event` : '', lastDate: endDate,
    id: e.id, title: e.title, venue: e.venue ?? '', summary: e.summary ?? '', organiser: e.body ?? '', committee, committeeShort: committee.replace(/ Committee$/, ''),
    startDate: e.start_date ?? '', endDate: e.end_date ?? '', startTime: fmtTime(e.start_time), endTime: fmtTime(e.end_time), whenText: whenText(e),
    day: d ? String(d[2]) : '', monthShort: d ? SHORT[d[1] - 1] : 'TBC', monthKey: monthKey(e), monthLabel: monthLabel(monthKey(e)),
    cover: e.cover_url ? photoUrl(e.cover_url) : '', hasCover: !!e.cover_url,
    link: `/events/${e.id}`, rsvpOpen: !!e.rsvp_open, guestRsvpOpen: !!e.guest_rsvp_open, checkinOpen: !!e.checkin_open,
    spotsLeft: e.spots_left ?? null, spotsText, isFull: e.rsvp_open ? e.spots_left === 0 : false, ntuOnly: e.visibility === 'Members',
  };
}

export type EventsHubProps = { children?: ReactNode; className?: string; limit?: number; pageSize?: number; defaultRsvpOnly?: boolean; defaultCommittee?: string };
const list = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

// Loads the upcoming events and keeps the filters. It draws nothing itself: Studio gets the data ($ctx.eventsHub) and actions to build any layout.
const EventsHub = forwardRef<EventsHubRef, EventsHubProps>(function EventsHub({ children, className = '', limit = 0, pageSize = 0, defaultRsvpOnly = false, defaultCommittee = '' }, ref) {
  const hubSeed = useHubSeed();
  const [state, setState] = useState<{ events: PublicEvent[]; cmap: Record<string, string>; bodies: Body[]; failed: boolean } | null>(() => (hubSeed?.events && hubSeed.bodies ? { events: hubSeed.events, cmap: committeeMap(hubSeed.bodies), bodies: hubSeed.bodies, failed: false } : null));
  const [q, setQ] = useState(''); const [picked, setPicked] = useState<string[]>(() => list(defaultCommittee)); const [month, setMonth] = useState('');
  const [rsvp, setRsvp] = useState(() => !!defaultRsvpOnly); const [open, setOpen] = useState(false);
  useEffect(() => {
    if (state) return; // already seeded by the server
    let off = false;
    (async () => {
      try {
        const [ev, bodies] = await Promise.all([browserClient().schema('activities').rpc('upcoming_events'), fetchBodies().catch(() => [])]);
        if (ev.error) throw ev.error;
        if (!off) setState({ events: (ev.data ?? []) as PublicEvent[], cmap: committeeMap(bodies), bodies, failed: false });
      } catch { if (!off) setState({ events: [], cmap: {}, bodies: [], failed: true }); }
    })();
    return () => { off = true; };
  }, []);
  useEffect(() => { setRsvp(!!defaultRsvpOnly); setPicked(list(defaultCommittee)); }, [defaultRsvpOnly, defaultCommittee, state]);

  const all = useMemo(() => (state?.events ?? []).map((e) => toEvent(e, state?.cmap ?? {}, state?.bodies ?? [])), [state]);
  const pass = (e: (typeof all)[number], useMonth: boolean) => {
    if (q && !`${e.title} ${e.venue} ${e.organiser}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (picked.length && !picked.some((p) => p.toLowerCase() === e.committee.toLowerCase() || p.toLowerCase() === e.committeeShort.toLowerCase())) return false;
    if (useMonth && month && e.monthKey !== month) return false;
    if (rsvp && !e.rsvpOpen) return false;
    if (open && e.ntuOnly) return false;
    return true;
  };
  const matches = all.filter((e) => pass(e, true));
  const [calKey, setCalKey] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const paging = usePaging(matches.length, pageSize, [q, picked.join('|'), month, rsvp, open].join('~'));
  const shown = pageSize > 0 ? matches.slice(paging.from, paging.to) : limit > 0 ? matches.slice(0, limit) : matches;
  const dirty = !!(q || picked.length || month || rsvp || open);
  const clear = () => { setQ(''); setPicked([]); setMonth(''); setRsvp(false); setOpen(false); };
  const isPicked = (name: string) => picked.some((p) => p.toLowerCase() === name.toLowerCase() || p.toLowerCase() === name.replace(/ Committee$/, '').toLowerCase());
  useImperativeHandle(ref, () => ({
    setSearch: (v: string) => setQ(v ?? ''), setCommittee: (n: string) => setPicked(n ? [n] : []), toggleCommittee: (n: string) => setPicked((p) => (p.some((x) => x.toLowerCase() === (n ?? '').toLowerCase()) ? p.filter((x) => x.toLowerCase() !== (n ?? '').toLowerCase()) : [...p, n])),
    setMonth: (k: string) => setMonth(k ?? ''), toggleMonth: (k: string) => setMonth((m) => (m === k ? '' : k)),
    openEvent: (id: string) => setSelectedId(id ?? ''), closeEvent: () => setSelectedId(''),
    prevMonth: () => setCalKey((k) => shiftMonth(k || firstKey, -1)), nextMonth: () => setCalKey((k) => shiftMonth(k || firstKey, 1)), setCalendarMonth: (k: string) => setCalKey(k ?? ''),
    setRsvpOnly: (on: boolean) => setRsvp(!!on), toggleRsvpOnly: () => setRsvp((r) => !r),
    setOpenToEveryone: (on: boolean) => setOpen(!!on), toggleOpenToEveryone: () => setOpen((o) => !o), nextPage: paging.next, prevPage: paging.prev, goToPage: paging.go, clearFilters: clear,
  }));

  const committees = Array.from(new Set(all.map((e) => e.committee).filter(Boolean))).sort().map((name) => ({ name, short: name.replace(/ Committee$/, ''), isSelected: isPicked(name), count: all.filter((e) => e.committee === name).length }));
  const months = Array.from(new Set(all.map((e) => e.monthKey))).filter((k) => k !== 'tbc').sort().map((key) => ({ key, label: monthLabel(key), short: SHORT[+key.split('-')[1] - 1], isSelected: month === key, count: all.filter((e) => e.monthKey === key).length }));
  const monthGroups = Array.from(new Set(shown.map((e) => e.monthKey))).sort().map((key) => ({ key, label: monthLabel(key), events: shown.filter((e) => e.monthKey === key) }));
  // The yellow notice strip: something important, meaning an event that opens for RSVP or starts within two weeks.
  const next = all[0]; const nd = next ? ymd(next.startDate) : null;
  const days = nd ? Math.round((Date.UTC(nd[0], nd[1] - 1, nd[2]) - Date.now()) / 864e5) : null;
  const notice = { show: !!next && (next.rsvpOpen || (days !== null && days <= 14)), text: next ? `${next.rsvpOpen ? 'RSVP open' : 'Coming up'}: ${next.title}` : '', link: next?.link ?? '', daysAway: days };

  // Month view: the chosen month (default: the month of the next event, else this month) as weeks of days. Filters apply except the month filter.
  const nowKey = todayKey();
  const firstKey = all[0]?.monthKey && all[0].monthKey !== 'tbc' ? all[0].monthKey : nowKey.slice(0, 7);
  const cKey = calKey || firstKey;
  const calEvents = all.filter((e) => pass(e, false));
  const [cy, cm] = cKey.split('-').map(Number);
  const lead = new Date(Date.UTC(cy, cm - 1, 1)).getUTCDay();
  const dim = new Date(Date.UTC(cy, cm, 0)).getUTCDate();
  const cells = Math.ceil((lead + dim) / 7) * 7;
  const calDays = Array.from({ length: cells }, (_, i) => {
    const d = new Date(Date.UTC(cy, cm - 1, 1 - lead + i));
    const date = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    const events = calEvents.filter((e) => e.startDate && date >= e.startDate.slice(0, 10) && date <= e.lastDate).map((e) => { const n = daysBetween(e.startDate.slice(0, 10), date) + 1; return { ...e, dayNumber: n, isFirstDay: n === 1, spanText: e.isMultiDay ? `Day ${n} of ${e.dayCount}` : '' }; });
    return { date, day: d.getUTCDate(), inMonth: d.getUTCMonth() === cm - 1, isToday: date === nowKey, hasEvents: events.length > 0, events };
  });
  const calendar = {
    key: cKey, label: monthLabel(cKey), year: cy, monthName: LONG[cm - 1], weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    days: calDays, weeks: Array.from({ length: cells / 7 }, (_, w) => ({ days: calDays.slice(w * 7, w * 7 + 7) })),
    eventCount: calDays.filter((d) => d.inMonth).reduce((n, d) => n + d.events.length, 0),
    months: Array.from({ length: 12 }, (_, i) => { const key = `${cy}-${String(i + 1).padStart(2, '0')}`; return { key, short: SHORT[i], isSelected: key === cKey, hasEvents: calEvents.some((e) => e.monthKey === key) }; }),
  };

  const hub = {
    isLoading: !state, hasError: !!state?.failed, items: shown, totalCount: matches.length, shownCount: shown.length, allCount: all.length, hasMatches: shown.length > 0,
    countText: `${matches.length} event${matches.length === 1 ? '' : 's'}${dirty ? ' match' : ' coming up'}`, monthGroups, committees, months, calendar, selected: all.find((e) => e.id === selectedId) ?? null, hasSelected: !!all.find((e) => e.id === selectedId), next: next ?? null, notice,
    activeSearch: q, ...paging.fields, selectedCommittee: committees.find((c) => c.isSelected)?.name ?? '', selectedCommittees: committees.filter((c) => c.isSelected).map((c) => c.name), selectedCommitteeMap: Object.fromEntries(committees.map((c) => [c.name, c.isSelected])), selectedCommitteeCount: committees.filter((c) => c.isSelected).length, selectedMonth: month, isRsvpOnly: rsvp, isOpenToEveryone: open, isFiltering: dirty,
  };
  return <DataProvider name="eventsHub" data={hub}><div className={className}>{children}</div></DataProvider>;
});
export default EventsHub;
