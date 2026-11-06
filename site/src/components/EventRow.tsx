import Link from 'next/link';
import { whenText, ymd } from '@/lib/dates';
import type { PublicEvent } from '@/lib/events';
import { SpotsPill } from '@/components/EventCard';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// One event as a wide row: big date, title, where and when.
export default function EventRow({ ev }: { ev: PublicEvent }) {
  const d = ymd(ev.start_date);
  return (
    <Link href={`/events/${ev.id}`} className="row-link group grid grid-cols-[5.5rem_1fr_auto] items-center gap-4 border-t border-p900/20 py-6 no-underline md:grid-cols-[9rem_1fr_auto] md:gap-8 md:py-8">
      <div className="display grid aspect-square place-items-center rounded-2xl bg-p900 text-center text-white">
        {d ? <div><span className="block text-6xl leading-none md:text-7xl">{d[2]}</span><span className="mt-1 block text-lg tracking-widest md:text-2xl">{MONTHS[d[1] - 1]}</span></div> : <span className="text-3xl">TBC</span>}
      </div>
      <div className="min-w-0">
        <div className="row-title inline text-2xl font-bold leading-tight text-p900 md:text-4xl">{ev.title}</div>
        <div className="mt-2 text-muted md:text-lg">{whenText(ev)}{ev.venue ? ` · ${ev.venue}` : ''}</div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          {ev.body ? <span className="text-muted">{ev.body}</span> : null}
          <SpotsPill ev={ev} />
          {ev.visibility === 'Members' ? <span className="rounded-full bg-p900 px-2.5 py-0.5 text-xs text-white">NTU students</span> : null}
        </div>
      </div>
      <span aria-hidden className="row-arrow display text-4xl text-p500 md:text-6xl">→</span>
    </Link>
  );
}
