'use client';
import { useSelector } from '@plasmicapp/loader-nextjs';

// Ready-made event pieces that paint themselves in the event's committee colour, the same idea as the Group parts.
// Give one an `event` (in a repeat, bind it to currentItem). Inside the lightbox, with no event given, it reads the selected event.
type Ev = { color?: string; onColor?: string; tint?: string; committeeShort?: string; day?: string; monthShort?: string; cover?: string; hasCover?: boolean; title?: string };
const SAMPLE: Ev = { color: '#0f766e', onColor: '#ffffff', tint: '#0f766e1f', committeeShort: 'Committee', day: '11', monthShort: 'NOV', cover: '', hasCover: false, title: 'Sample event' };
function useEv(event?: Ev | null): Ev {
  const hub = useSelector('eventsHub') as { selected?: Ev | null } | undefined;
  return event ?? hub?.selected ?? SAMPLE;
}
type Common = { event?: Ev | null; className?: string };

/** The committee name on its own colour. Pill, full-width bar, tint (pale wash) or just a dot. */
export function EventTag({ event, look = 'pill', className = '' }: Common & { look?: 'pill' | 'tint' | 'bar' | 'dot' }) {
  const e = useEv(event);
  if (look === 'dot') return <span aria-hidden className={`inline-block h-3 w-3 rounded-full ${className}`} style={{ background: e.color }} />;
  const solid = look !== 'tint';
  return <span className={`inline-block text-xs font-bold uppercase tracking-wider ${look === 'bar' ? 'w-full px-4 py-2' : 'rounded-full px-3 py-1'} ${className}`} style={{ background: solid ? e.color : e.tint, color: solid ? e.onColor : e.color }}>{e.committeeShort}</span>;
}

/** A white date badge (day over month) with the day and month in the committee colour. It sits above a Cover fill, inset 12px from the corner. */
export function EventDateBadge({ event, className = '' }: Common) {
  const e = useEv(event);
  return (
    <span className={`relative z-[1] rounded-lg bg-white ${className}`} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', alignSelf: 'flex-start', margin: 12, padding: '6px 12px', color: e.color }}>
      <span className="display uppercase" style={{ display: 'block', fontSize: 30, lineHeight: 0.9 }}>{e.day}</span>
      <span className="uppercase" style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em' }}>{e.monthShort}</span>
    </span>
  );
}

/** A coloured edge: a vertical stripe, a horizontal bar or a dot. Put it inside a card or a calendar chip. */
export function EventAccent({ event, look = 'stripe', thickness = 4, className = '' }: Common & { look?: 'stripe' | 'bar' | 'dot'; thickness?: number }) {
  const e = useEv(event);
  if (look === 'dot') return <span aria-hidden className={`inline-block h-2.5 w-2.5 rounded-full ${className}`} style={{ background: e.color }} />;
  const style = look === 'stripe' ? { width: thickness, alignSelf: 'stretch', background: e.color } : { height: thickness, width: '100%', background: e.color };
  return <span aria-hidden className={`block rounded-full ${className}`} style={style} />;
}

/** Fills its parent (give the parent a position and a height) with the committee colour, and the event's photo over it when there is one. */
export function EventCover({ event, className = '' }: Common) {
  const e = useEv(event);
  return (
    <span aria-hidden className={`absolute inset-0 block overflow-hidden ${className}`} style={{ background: e.color }}>
      {e.hasCover && e.cover ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={e.cover} alt="" className="absolute inset-0 h-full w-full object-cover" /> : null}
    </span>
  );
}
