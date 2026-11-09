'use client';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useState, type ReactNode } from 'react';
import { DataProvider } from '@plasmicapp/loader-nextjs';
import { browserClient, photoUrl } from '@/lib/supabase';
import { fetchBodies } from '@/lib/records-client';
import { committeeMap } from '@/lib/records';
import type { PublicEvent } from '@/lib/events';
import { fmtTime, whenText, ymd } from '@/lib/dates';
import { useHubSeed } from './HubSeed';

const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export type EventsHubRef = {
  setSearch: (query: string) => void;
  setCommittee: (name: string) => void; toggleCommittee: (name: string) => void;
  setMonth: (key: string) => void; toggleMonth: (key: string) => void;
  setRsvpOnly: (on: boolean) => void; toggleRsvpOnly: () => void;
  setOpenToEveryone: (on: boolean) => void; toggleOpenToEveryone: () => void;
  clearFilters: () => void;
};

const monthKey = (e: PublicEvent) => { const d = ymd(e.start_date); return d ? `${d[0]}-${String(d[1]).padStart(2, '0')}` : 'tbc'; };
const monthLabel = (k: string) => (k === 'tbc' ? 'Date to be confirmed' : `${LONG[+k.split('-')[1] - 1]} ${k.split('-')[0]}`);

function toEvent(e: PublicEvent, cmap: Record<string, string>) {
  const d = ymd(e.start_date); const committee = e.body ? cmap[e.body] ?? '' : '';
  const spotsText = !e.rsvp_open ? '' : e.spots_left == null ? 'RSVP open' : e.spots_left === 0 ? 'Full: waitlist open' : `${e.spots_left} spot${e.spots_left === 1 ? '' : 's'} left`;
  return {
    id: e.id, title: e.title, venue: e.venue ?? '', summary: e.summary ?? '', organiser: e.body ?? '', committee, committeeShort: committee.replace(/ Committee$/, ''),
    startDate: e.start_date ?? '', endDate: e.end_date ?? '', startTime: fmtTime(e.start_time), endTime: fmtTime(e.end_time), whenText: whenText(e),
    day: d ? String(d[2]) : '', monthShort: d ? SHORT[d[1] - 1] : 'TBC', monthKey: monthKey(e), monthLabel: monthLabel(monthKey(e)),
    cover: e.cover_url ? photoUrl(e.cover_url) : '', hasCover: !!e.cover_url,
    link: `/events/${e.id}`, rsvpOpen: !!e.rsvp_open, guestRsvpOpen: !!e.guest_rsvp_open, checkinOpen: !!e.checkin_open,
    spotsLeft: e.spots_left ?? null, spotsText, isFull: e.rsvp_open ? e.spots_left === 0 : false, ntuOnly: e.visibility === 'Members',
  };
}

export type EventsHubProps = { children?: ReactNode; className?: string; limit?: number; defaultRsvpOnly?: boolean; defaultCommittee?: string };

// Loads the upcoming events and keeps the filters. It draws nothing itself: Studio gets the data ($ctx.eventsHub) and actions to build any layout.
const EventsHub = forwardRef<EventsHubRef, EventsHubProps>(function EventsHub({ children, className = '', limit = 0, defaultRsvpOnly = false, defaultCommittee = '' }, ref) {
  const hubSeed = useHubSeed();
  const [state, setState] = useState<{ events: PublicEvent[]; cmap: Record<string, string>; failed: boolean } | null>(() => (hubSeed?.events && hubSeed.bodies ? { events: hubSeed.events, cmap: committeeMap(hubSeed.bodies), failed: false } : null));
  const [q, setQ] = useState(''); const [committee, setCommittee] = useState(() => defaultCommittee.trim()); const [month, setMonth] = useState('');
  const [rsvp, setRsvp] = useState(() => !!defaultRsvpOnly); const [open, setOpen] = useState(false);
  useEffect(() => {
    if (state) return; // already seeded by the server
    let off = false;
    (async () => {
      try {
        const [ev, bodies] = await Promise.all([browserClient().schema('activities').rpc('upcoming_events'), fetchBodies().catch(() => [])]);
        if (ev.error) throw ev.error;
        if (!off) setState({ events: (ev.data ?? []) as PublicEvent[], cmap: committeeMap(bodies), failed: false });
      } catch { if (!off) setState({ events: [], cmap: {}, failed: true }); }
    })();
    return () => { off = true; };
  }, []);
  useEffect(() => { setRsvp(!!defaultRsvpOnly); setCommittee(defaultCommittee.trim()); }, [defaultRsvpOnly, defaultCommittee, state]);

  const all = useMemo(() => (state?.events ?? []).map((e) => toEvent(e, state?.cmap ?? {})), [state]);
  const matches = all.filter((e) => {
    if (q && !`${e.title} ${e.venue} ${e.organiser}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (committee && e.committee.toLowerCase() !== committee.toLowerCase() && e.committeeShort.toLowerCase() !== committee.toLowerCase()) return false;
    if (month && e.monthKey !== month) return false;
    if (rsvp && !e.rsvpOpen) return false;
    if (open && e.ntuOnly) return false;
    return true;
  });
  const shown = limit > 0 ? matches.slice(0, limit) : matches;
  const dirty = !!(q || committee || month || rsvp || open);
  const clear = () => { setQ(''); setCommittee(''); setMonth(''); setRsvp(false); setOpen(false); };
  useImperativeHandle(ref, () => ({
    setSearch: (v: string) => setQ(v ?? ''), setCommittee: (n: string) => setCommittee(n ?? ''), toggleCommittee: (n: string) => setCommittee((c) => (c === n ? '' : n)),
    setMonth: (k: string) => setMonth(k ?? ''), toggleMonth: (k: string) => setMonth((m) => (m === k ? '' : k)),
    setRsvpOnly: (on: boolean) => setRsvp(!!on), toggleRsvpOnly: () => setRsvp((r) => !r),
    setOpenToEveryone: (on: boolean) => setOpen(!!on), toggleOpenToEveryone: () => setOpen((o) => !o), clearFilters: clear,
  }));

  const committees = Array.from(new Set(all.map((e) => e.committee).filter(Boolean))).sort().map((name) => ({ name, short: name.replace(/ Committee$/, ''), isSelected: committee.toLowerCase() === name.toLowerCase(), count: all.filter((e) => e.committee === name).length }));
  const months = Array.from(new Set(all.map((e) => e.monthKey))).filter((k) => k !== 'tbc').sort().map((key) => ({ key, label: monthLabel(key), short: SHORT[+key.split('-')[1] - 1], isSelected: month === key, count: all.filter((e) => e.monthKey === key).length }));
  const monthGroups = Array.from(new Set(shown.map((e) => e.monthKey))).sort().map((key) => ({ key, label: monthLabel(key), events: shown.filter((e) => e.monthKey === key) }));
  // The yellow notice strip: something important, meaning an event that opens for RSVP or starts within two weeks.
  const next = all[0]; const nd = next ? ymd(next.startDate) : null;
  const days = nd ? Math.round((Date.UTC(nd[0], nd[1] - 1, nd[2]) - Date.now()) / 864e5) : null;
  const notice = { show: !!next && (next.rsvpOpen || (days !== null && days <= 14)), text: next ? `${next.rsvpOpen ? 'RSVP open' : 'Coming up'}: ${next.title}` : '', link: next?.link ?? '', daysAway: days };

  const hub = {
    isLoading: !state, hasError: !!state?.failed, items: shown, totalCount: matches.length, shownCount: shown.length, allCount: all.length, hasMatches: shown.length > 0,
    countText: `${matches.length} event${matches.length === 1 ? '' : 's'}${dirty ? ' match' : ' coming up'}`, monthGroups, committees, months, next: next ?? null, notice,
    activeSearch: q, selectedCommittee: committee, selectedMonth: month, isRsvpOnly: rsvp, isOpenToEveryone: open, isFiltering: dirty,
  };
  return <DataProvider name="eventsHub" data={hub}><div className={className}>{children}</div></DataProvider>;
});
export default EventsHub;
