'use client';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { DataProvider } from '@plasmicapp/loader-nextjs';
import type { HonourData } from '@/lib/honour';
import { useHubSeed } from './HubSeed';

export type HonourHubProps = { children?: ReactNode; className?: string; term?: string };

// Loads the honour roll: every past ExCo term, and (for a term page) one term's team, write-up and news. Draws nothing: Studio gets $ctx.honourHub.
// On a page at /about/honour-roll/[ay], set Term address to $ctx.params.ay. With nothing set the newest term is shown, so there is something to design against.
export default function HonourHub({ children, className = '', term = '' }: HonourHubProps) {
  const seed = useHubSeed();
  const seeded = seed?.honour && (!term || seed.honour.term?.slug === term) ? seed.honour : null;
  const [data, setData] = useState<HonourData | 'failed' | null>(seeded);
  useEffect(() => {
    if (data && data !== 'failed' && (!term || data.term?.slug === term)) return;
    let off = false;
    setData(null);
    (async () => {
      try { const r = await fetch(`/api/honour?term=${encodeURIComponent(term)}`); if (!r.ok) throw new Error(); const d = (await r.json()) as HonourData; if (!off) setData(d); }
      catch { if (!off) setData('failed'); }
    })();
    return () => { off = true; };
  }, [term]); // eslint-disable-line react-hooks/exhaustive-deps
  const hub = useMemo(() => (!data || data === 'failed' ? { isLoading: !data, hasError: data === 'failed', notFound: false, terms: [], termCount: 0, term: null, hasTerm: false } : { isLoading: false, hasError: false, ...data }), [data]);
  return <DataProvider name="honourHub" data={hub}><div className={className}>{children}</div></DataProvider>;
}
