'use client';
import { useEffect, useState } from 'react';
import { fetchBodies, fetchLeaders } from '@/lib/records-client';
import { groupItems } from '@/lib/groups';
import GroupsBrowser from '@/components/GroupsBrowser';

// The Student Groups card grid with search and committee filters. Loads its own data, so it works on any page designed in Plasmic.
export default function GroupsBlock({ className = '' }: { className?: string }) {
  const [data, setData] = useState<ReturnType<typeof groupItems> | 'failed' | null>(null);
  useEffect(() => {
    let off = false;
    (async () => {
      try {
        const [bodies, lead] = await Promise.all([fetchBodies(), fetchLeaders().catch(() => ({ ay: '', leaders: [] }))]);
        if (!off) setData(groupItems(bodies, lead.leaders));
      } catch { if (!off) setData('failed'); }
    })();
    return () => { off = true; };
  }, []);
  if (!data) return <p className={`text-muted ${className}`}>Loading student groups…</p>;
  if (data === 'failed') return <p className={`rounded-lg bg-red-100 px-3 py-2 text-bad ${className}`}>This list could not be loaded right now. Please try again in a minute.</p>;
  return <div className={className}><GroupsBrowser items={data.items} committees={data.committees} /></div>;
}
