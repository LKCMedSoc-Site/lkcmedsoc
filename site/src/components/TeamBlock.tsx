'use client';
import { useEffect, useState } from 'react';
import { fetchBodies, fetchLeaders } from '@/lib/records-client';
import type { Body, Leader } from '@/lib/records';
import { CommitteesPart, ExcoPart, YearsPart } from '@/components/TeamParts';

// One part of Meet the Team, loading its own data, so it can sit in any frame designed in Plasmic.
export default function TeamBlock({ part = 'exco', showHeading = true, className = '' }: { part?: 'exco' | 'committees' | 'years'; showHeading?: boolean; className?: string }) {
  const [data, setData] = useState<{ bodies: Body[]; leaders: Leader[] } | 'failed' | null>(null);
  useEffect(() => {
    let off = false;
    (async () => {
      try {
        const [bodies, lead] = await Promise.all([fetchBodies(), fetchLeaders()]);
        if (!off) setData({ bodies, leaders: lead.leaders });
      } catch { if (!off) setData('failed'); }
    })();
    return () => { off = true; };
  }, []);
  if (!data) return <p className={`text-muted ${className}`}>Loading the team…</p>;
  if (data === 'failed') return <p className={`rounded-lg bg-red-100 px-3 py-2 text-bad ${className}`}>The team list could not be loaded right now. Please try again in a minute.</p>;
  const Part = part === 'committees' ? CommitteesPart : part === 'years' ? YearsPart : ExcoPart;
  return <div className={className}><Part bodies={data.bodies} leaders={data.leaders} heading={showHeading} /></div>;
}
