'use client';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { DataProvider } from '@plasmicapp/loader-nextjs';
import { browserClient } from '@/lib/supabase';
import type { ChangeEntry, DocView, PolicyDoc } from '@/lib/policy';
import { buildDocHub, type DocBundle } from '@/lib/policy-hub';
import { renderMarkdown } from '@/lib/markdown';
import { useHubSeed } from './HubSeed';

export type PolicyDocHubProps = { children?: ReactNode; className?: string; slug?: string };

// Loads one policy document: its provisions (with ready-made HTML), versions, recent changes and the previous and next document. It draws nothing itself:
// Studio gets $ctx.policyDoc. On a page at /policy/[slug], set the slug to $ctx.params.slug; with no slug it shows the first document, so the design has something to preview.
export default function PolicyDocHub({ children, className = '', slug = '' }: PolicyDocHubProps) {
  const seed = useHubSeed();
  const seeded = seed?.policyDoc && (!slug || seed.policyDoc.slug === slug) ? seed.policyDoc : null;
  const [bundle, setBundle] = useState<DocBundle | null>(seeded);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (seeded) { setBundle(seeded); return; }
    let off = false;
    (async () => {
      const act = browserClient().schema('activities');
      const idx = await act.rpc('policy_index'); if (idx.error) throw idx.error;
      const index = (idx.data ?? []) as PolicyDoc[];
      const want = slug || index[0]?.slug;
      if (!want) { if (!off) setBundle({ slug: '', view: null, log: [], index }); return; }
      const [doc, log] = await Promise.all([act.rpc('policy_doc', { p_slug: want, p_version: null }), act.rpc('policy_changelog', { p_slug: want })]);
      if (doc.error) throw doc.error;
      if (!off) setBundle({ slug: want, view: (doc.data ?? null) as DocView | null, log: (log.data ?? []) as ChangeEntry[], index });
    })().catch(() => { if (!off) setFailed(true); });
    return () => { off = true; };
  }, [seeded, slug]);
  const hub = useMemo(() => buildDocHub(bundle, failed, renderMarkdown), [bundle, failed]);
  return <DataProvider name="policyDoc" data={hub}><div className={className}>{children}</div></DataProvider>;
}
