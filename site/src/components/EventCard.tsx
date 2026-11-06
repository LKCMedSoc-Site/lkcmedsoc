import Link from 'next/link';
import { whenText } from '@/lib/dates';
import type { PublicEvent } from '@/lib/events';

export function SpotsPill({ ev }: { ev: PublicEvent }) {
  if (!ev.rsvp_open) return null;
  const base = 'inline-block rounded-full px-2 py-0.5 text-xs';
  if (ev.spots_left == null) return <span className={`${base} bg-green-100 text-ok`}>RSVP open</span>;
  if (ev.spots_left === 0) return <span className={`${base} bg-amber-100 text-amber-800`}>Full: waitlist open</span>;
  return <span className={`${base} bg-green-100 text-ok`}>{ev.spots_left} spot{ev.spots_left === 1 ? '' : 's'} left</span>;
}

export default function EventCard({ ev }: { ev: PublicEvent }) {
  return (
    <Link href={`/events/${ev.id}`} className="block rounded-xl border border-line bg-white p-4 no-underline transition hover:border-p500">
      <div className="text-lg font-bold text-p900">{ev.title}</div>
      <div className="mt-0.5 text-sm text-muted">{whenText(ev)}{ev.venue ? ` · ${ev.venue}` : ''}</div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        {ev.body ? <span className="text-muted">{ev.body}</span> : null}
        <SpotsPill ev={ev} />
        {ev.visibility === 'Members' ? <span className="rounded-full bg-p100 px-2 py-0.5 text-xs text-p700">NTU students</span> : null}
      </div>
    </Link>
  );
}
