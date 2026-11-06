import Link from 'next/link';
import { whenText, ymd } from '@/lib/dates';
import type { PublicEvent } from '@/lib/events';

export function SpotsPill({ ev }: { ev: PublicEvent }) {
  if (!ev.rsvp_open) return null;
  const base = 'inline-block rounded-full px-2 py-0.5 text-xs';
  if (ev.spots_left == null) return <span className={`${base} bg-green-100 text-ok`}>RSVP open</span>;
  if (ev.spots_left === 0) return <span className={`${base} bg-amber-100 text-amber-800`}>Full: waitlist open</span>;
  return <span className={`${base} bg-green-100 text-ok`}>{ev.spots_left} spot{ev.spots_left === 1 ? '' : 's'} left</span>;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function EventCard({ ev }: { ev: PublicEvent }) {
  const d = ymd(ev.start_date);
  return (
    <Link href={`/events/${ev.id}`} className="group flex gap-4 rounded-2xl border border-line bg-white p-4 no-underline transition hover:-translate-y-0.5 hover:border-p500 hover:shadow-lg">
      <div className="grid h-20 w-20 shrink-0 place-items-center rounded-xl bg-p900 text-center text-white">
        {d ? <div><div className="display text-4xl leading-none">{d[2]}</div><div className="mt-1 text-xs font-bold uppercase tracking-widest text-p300">{MONTHS[d[1] - 1]}</div></div> : <div className="text-xs text-p300">TBC</div>}
      </div>
      <div className="min-w-0">
        <div className="text-lg font-bold leading-snug text-p900 group-hover:underline">{ev.title}</div>
        <div className="mt-0.5 text-sm text-muted">{whenText(ev)}{ev.venue ? ` · ${ev.venue}` : ''}</div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          {ev.body ? <span className="text-muted">{ev.body}</span> : null}
          <SpotsPill ev={ev} />
          {ev.visibility === 'Members' ? <span className="rounded-full bg-p100 px-2 py-0.5 text-xs text-p700">NTU students</span> : null}
        </div>
      </div>
    </Link>
  );
}
