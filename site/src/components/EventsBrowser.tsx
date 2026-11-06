'use client';
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { PublicEvent } from '@/lib/events';
import { ymd } from '@/lib/dates';
import EventRow from '@/components/EventRow';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const chip = (on: boolean) => `press rounded-full border px-3.5 py-1.5 text-sm font-bold ${on ? 'border-p950 bg-p950 text-white' : 'border-p900/25 bg-white text-p900 hover:border-p900'}`;

// All upcoming events with filters. The list is already loaded, so filtering is instant.
export default function EventsBrowser({ events, committees }: { events: PublicEvent[]; committees: Record<string, string> }) {
  const [q, setQ] = useState('');
  const [committee, setCommittee] = useState('');
  const [month, setMonth] = useState('');
  const [rsvp, setRsvp] = useState(false);
  const [open, setOpen] = useState(false);

  const keyOf = (e: PublicEvent) => { const d = ymd(e.start_date); return d ? `${d[0]}-${String(d[1]).padStart(2, '0')}` : 'tbc'; };
  const months = useMemo(() => Array.from(new Set(events.map(keyOf))).filter((k) => k !== 'tbc').sort(), [events]);
  const committeeList = useMemo(() => Array.from(new Set(events.map((e) => (e.body ? committees[e.body] ?? '' : '')).filter(Boolean))).sort(), [events, committees]);

  const shown = events.filter((e) => {
    if (q && !`${e.title} ${e.venue ?? ''} ${e.body ?? ''}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (committee && (e.body ? committees[e.body] : '') !== committee) return false;
    if (month && keyOf(e) !== month) return false;
    if (rsvp && !e.rsvp_open) return false;
    if (open && e.visibility === 'Members') return false;
    return true;
  });
  const groups = new Map<string, PublicEvent[]>();
  shown.forEach((e) => groups.set(keyOf(e), [...(groups.get(keyOf(e)) ?? []), e]));
  const dirty = !!(q || committee || month || rsvp || open);

  return (
    <div>
      <div className="sticky top-16 z-20 -mx-4 border-b border-p900/10 bg-p50/95 px-4 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-0 flex-1 basis-48">
            <span className="sr-only">Search events</span>
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-p500" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search events" className="h-10 w-full rounded-full border border-p900/25 bg-white pl-9 pr-3 text-sm text-p950 outline-none focus:border-p500" />
          </label>
          {committeeList.length ? (
            <label><span className="sr-only">Committee</span>
              <select value={committee} onChange={(e) => setCommittee(e.target.value)} className="h-10 max-w-[14rem] rounded-full border border-p900/25 bg-white px-3 text-sm font-bold text-p900">
                <option value="">All committees</option>
                {committeeList.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          ) : null}
          <button type="button" aria-pressed={rsvp} onClick={() => setRsvp(!rsvp)} className={chip(rsvp)}>RSVP open</button>
          <button type="button" aria-pressed={open} onClick={() => setOpen(!open)} className={chip(open)}>Open to everyone</button>
          {dirty ? <button type="button" onClick={() => { setQ(''); setCommittee(''); setMonth(''); setRsvp(false); setOpen(false); }} className="text-sm font-bold text-p500 underline">Clear</button> : null}
        </div>
        {months.length > 1 ? (
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Month">
            <button type="button" aria-pressed={!month} onClick={() => setMonth('')} className={chip(!month)}>All dates</button>
            {months.map((m) => { const [y, mo] = m.split('-'); return <button key={m} type="button" aria-pressed={month === m} onClick={() => setMonth(month === m ? '' : m)} className={`${chip(month === m)} shrink-0`}>{MONTHS[+mo - 1].slice(0, 3)} {y.slice(2) !== String(new Date().getFullYear()).slice(2) ? `’${y.slice(2)}` : ''}</button>; })}
          </div>
        ) : null}
      </div>

      <p className="mt-4 text-sm text-muted" aria-live="polite">{shown.length} event{shown.length === 1 ? '' : 's'}{dirty ? ' match' : ' coming up'}</p>
      {shown.length ? Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([k, list]) => (
        <section key={k} className="mt-6">
          <h2 className="display text-3xl text-p500 md:text-4xl">{k === 'tbc' ? 'Date to be confirmed' : `${MONTHS[+k.split('-')[1] - 1]} ${k.split('-')[0]}`}</h2>
          <div className="mt-2 border-b border-p900/20">{list.map((e) => <EventRow key={e.id} ev={e} />)}</div>
        </section>
      )) : <p className="mt-8 max-w-md text-lg text-muted">{events.length ? 'No events match those filters. Try clearing one.' : 'No upcoming events are open right now. Check back soon.'}</p>}
    </div>
  );
}
