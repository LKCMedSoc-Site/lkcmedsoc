'use client';
import { useEffect, useState } from 'react';
import { fetchBodies, fetchLeaders } from '@/lib/records-client';
import { pickSpotlight } from '@/lib/spotlight';
import CcaSpotlight from '@/components/CcaSpotlight';

// This week's featured CCA and the committees list. Loads its own data. It is built for a dark background: leave "Dark panel" on to
// give it one, or turn it off and place it on a plum band.
export default function CcaSpotlightBlock({ panel = true, className = '' }: { panel?: boolean; className?: string }) {
  const [data, setData] = useState<ReturnType<typeof pickSpotlight> | null>(null);
  useEffect(() => {
    let off = false;
    (async () => {
      try {
        const [bodies, lead] = await Promise.all([fetchBodies(), fetchLeaders().catch(() => ({ ay: '', leaders: [] }))]);
        if (!off) setData(pickSpotlight(bodies, lead.leaders));
      } catch { /* shows nothing */ }
    })();
    return () => { off = true; };
  }, []);
  if (!data || !data.spot) return <div className={`min-h-24 ${className}`} />;
  const inner = <CcaSpotlight spot={data.spot} spotLeaders={data.spotLeaders} groups={data.groups} ccaCount={data.ccaCount} />;
  return <div className={className}>{panel ? <div className="rounded-2xl bg-p900 px-6 py-10 md:px-10">{inner}</div> : inner}</div>;
}
