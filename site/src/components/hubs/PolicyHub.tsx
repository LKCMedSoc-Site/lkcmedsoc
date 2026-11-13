'use client';
import { forwardRef, useEffect, useImperativeHandle, useState, type ReactNode } from 'react';
import { DataProvider } from '@plasmicapp/loader-nextjs';
import { browserClient } from '@/lib/supabase';
import type { Hit, PolicyDoc } from '@/lib/policy';
import { buildIndexHub } from '@/lib/policy-hub';
import { useHubSeed } from './HubSeed';

export type PolicyHubRef = { setSearch: (query: string) => void; clearSearch: () => void };
export type PolicyHubProps = { children?: ReactNode; className?: string };

// Loads the published policy documents (grouped by tier) and the search results. It draws nothing itself: Studio gets $ctx.policyHub to build any layout.
const PolicyHub = forwardRef<PolicyHubRef, PolicyHubProps>(function PolicyHub({ children, className = '' }, ref) {
  const seed = useHubSeed();
  const [docs, setDocs] = useState<PolicyDoc[] | null>(() => seed?.policyDocs ?? null);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState(''); const [hits, setHits] = useState<Hit[]>([]);
  useEffect(() => {
    if (seed?.policyDocs) return;                      // already loaded by the server
    let off = false;
    browserClient().schema('activities').rpc('policy_index').then((r) => { if (off) return; if (r.error) setFailed(true); else setDocs((r.data ?? []) as PolicyDoc[]); });
    return () => { off = true; };
  }, [seed]);
  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return; }
    let off = false;
    const t = setTimeout(() => { browserClient().schema('activities').rpc('policy_search', { p_q: q.trim() }).then((r) => { if (!off) setHits((r.data ?? []) as Hit[]); }); }, 250);
    return () => { off = true; clearTimeout(t); };
  }, [q]);
  useImperativeHandle(ref, () => ({ setSearch: (v: string) => setQ(v ?? ''), clearSearch: () => setQ('') }));
  return <DataProvider name="policyHub" data={buildIndexHub(docs, failed, q, hits)}><div className={className}>{children}</div></DataProvider>;
});
export default PolicyHub;
