'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import SafeImage from '@/components/SafeImage';

export type GroupItem = { name: string; href: string; committee: string; committeeHref: string; chair: string; description: string | null; logo: string; header: string; recruiting: boolean; color?: string | null; committeeColor?: string | null };

// Each committee gets one colour, used on its cards and its filter chip.
const TONES = [
  { bar: 'bg-p500 text-white', dot: 'bg-p500' },
  { bar: 'bg-lilac text-p950', dot: 'bg-lilac' },
  { bar: 'bg-pink text-p950', dot: 'bg-pink' },
  { bar: 'bg-p900 text-white', dot: 'bg-p900' },
  { bar: 'bg-p300 text-p950', dot: 'bg-p300' },
  { bar: 'bg-mist text-p900', dot: 'bg-mist ring-1 ring-p900/30' },
];
const chip = (on: boolean) => `press rounded-full border px-3.5 py-1.5 text-sm font-bold ${on ? 'border-p950 bg-p950 text-white' : 'border-p900/25 bg-white text-p900 hover:border-p900'}`;

function Card({ g, tone }: { g: GroupItem; tone: (typeof TONES)[number] }) {
  return (
    <Link href={g.href} className="zoom group flex h-full flex-col overflow-hidden rounded-xl border-2 border-p950 bg-white no-underline shadow-[0_12px_24px_-16px_rgba(42,6,40,.55)] transition-transform duration-300 hover:-translate-y-0.5">
      {g.header ? (
        <div className="relative"><SafeImage src={g.header} sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw" className="aspect-[16/9] w-full" />
          {g.logo ? <span className="absolute -bottom-5 left-4 h-12 w-12 overflow-hidden rounded-full border-2 border-white bg-white shadow"><SafeImage src={g.logo} sizes="48px" className="h-full w-full" /></span> : null}
        </div>
      ) : null}
      <div className={`flex flex-1 flex-col px-4 pb-4 ${g.header ? 'pt-8' : 'pt-4'}`}>
        <div className="flex items-start justify-between gap-3">
          <h3 className="display text-[1.9rem] leading-[.95] text-p950">{g.name}</h3>
          {!g.header && g.logo ? <span className="h-11 w-11 shrink-0 overflow-hidden rounded-full border border-p900/20"><SafeImage src={g.logo} sizes="44px" className="h-full w-full" /></span> : null}
        </div>
        {g.description ? <p className="mt-2 line-clamp-2 text-sm text-muted">{g.description}</p> : null}
        <div className="mt-auto pt-4">
          {g.chair ? <p className="truncate text-sm text-muted">Chairperson · <span className="font-medium text-p900">{g.chair}</span></p> : <p className="text-sm text-muted">&nbsp;</p>}
        </div>
      </div>
      <div className={`flex items-center justify-between gap-3 px-4 pb-2.5 pt-6 text-xs font-bold uppercase tracking-wider [clip-path:polygon(0_28%,100%_0,100%_100%,0_100%)] ${tone.bar}`}>
        <span className="truncate">{g.committee.replace(/ Committee$/, '')}</span>
        {g.recruiting ? <span className="shrink-0 rounded-full bg-white/90 px-2 py-0.5 text-p950">Recruiting</span> : <span aria-hidden className="row-arrow text-base normal-case">→</span>}
      </div>
    </Link>
  );
}

export default function GroupsBrowser({ items, committees }: { items: GroupItem[]; committees: { name: string; href: string; color?: string | null }[] }) {
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [grouped, setGrouped] = useState(true);
  const [recruiting, setRecruiting] = useState(false);
  const toneOf = (c: string) => TONES[Math.max(0, committees.findIndex((x) => x.name === c)) % TONES.length];
  const anyRecruiting = items.some((i) => i.recruiting);

  const shown = useMemo(() => items.filter((i) => {
    if (q && !`${i.name} ${i.description ?? ''} ${i.committee}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (picked.length && !picked.includes(i.committee)) return false;
    if (recruiting && !i.recruiting) return false;
    return true;
  }).sort((a, b) => a.name.localeCompare(b.name)), [items, q, picked, recruiting]);
  const dirty = !!(q || picked.length || recruiting);
  const toggle = (c: string) => setPicked((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));

  return (
    <div>
      <div className="sticky top-16 z-20 -mx-4 border-b border-p900/10 bg-p50/95 px-4 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-0 flex-1 basis-48">
            <span className="sr-only">Search student groups</span>
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-p500" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search groups" className="h-10 w-full rounded-full border-2 border-p950 bg-white pl-9 pr-3 text-sm text-p950 outline-none focus:border-p500" />
          </label>
          <details className="group/dd relative">
            <summary className="press flex h-10 cursor-pointer list-none items-center gap-2 rounded-full border-2 border-p950 bg-pink px-4 text-sm font-bold text-p950 [&::-webkit-details-marker]:hidden">
              Committees{picked.length ? ` (${picked.length})` : ''}<ChevronDown aria-hidden className="h-4 w-4 transition-transform group-open/dd:rotate-180" />
            </summary>
            <div className="absolute right-0 z-30 mt-2 max-h-[60svh] w-72 overflow-y-auto rounded-xl border border-p900/20 bg-white p-2 shadow-xl max-sm:fixed max-sm:inset-x-3 max-sm:w-auto">
              {committees.map((c) => {
                const on = picked.includes(c.name);
                return (
                  <label key={c.name} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-p950 hover:bg-mist">
                    <input type="checkbox" checked={on} onChange={() => toggle(c.name)} className="sr-only" />
                    <span aria-hidden className={`grid h-5 w-5 shrink-0 place-items-center rounded border-2 border-p950 ${on ? 'bg-p950 text-white' : 'bg-white'}`}>{on ? <Check className="h-3.5 w-3.5" /> : null}</span>
                    <span aria-hidden className={`h-3 w-3 shrink-0 rounded-full ${toneOf(c.name).dot}`} />{c.name}
                  </label>
                );
              })}
            </div>
          </details>
          {anyRecruiting ? <button type="button" aria-pressed={recruiting} onClick={() => setRecruiting(!recruiting)} className={chip(recruiting)}>Recruiting</button> : null}
          <div className="flex gap-1" role="group" aria-label="Layout">
            <button type="button" aria-pressed={grouped} onClick={() => setGrouped(true)} className={chip(grouped)}>By committee</button>
            <button type="button" aria-pressed={!grouped} onClick={() => setGrouped(false)} className={chip(!grouped)}>A–Z</button>
          </div>
          {dirty ? <button type="button" onClick={() => { setQ(''); setPicked([]); setRecruiting(false); }} className="text-sm font-bold text-p500 underline">Clear</button> : null}
        </div>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter by committee">
          {committees.map((c) => { const on = picked.includes(c.name); return <button key={c.name} type="button" aria-pressed={on} onClick={() => toggle(c.name)} className={`${chip(on)} flex shrink-0 items-center gap-2`}><span aria-hidden className={`h-2.5 w-2.5 rounded-full ${toneOf(c.name).dot}`} />{c.name.replace(/ Committee$/, '')}</button>; })}
        </div>
      </div>

      <p className="mt-4 text-sm text-muted" aria-live="polite">{shown.length} group{shown.length === 1 ? '' : 's'}{dirty ? ' match' : ''}</p>
      {shown.length ? (grouped ? committees.filter((c) => shown.some((s) => s.committee === c.name)).map((c) => (
        <section key={c.name} className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-2"><h2 className="h-xl">{c.name}</h2><Link href={c.href} className="link-arrow">About this committee</Link></div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{shown.filter((s) => s.committee === c.name).map((g) => <Card key={g.href} g={g} tone={toneOf(g.committee)} />)}</div>
        </section>
      )) : <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{shown.map((g) => <Card key={g.href} g={g} tone={toneOf(g.committee)} />)}</div>)
        : <p className="mt-8 max-w-md text-lg text-muted">No groups match those filters. Try clearing one.</p>}
    </div>
  );
}
