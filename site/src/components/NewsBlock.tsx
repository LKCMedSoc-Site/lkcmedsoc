'use client';
import { useEffect, useMemo, useState } from 'react';
import { browserClient } from '@/lib/supabase';
import { normalise, type Post } from '@/lib/posts';
import { fetchBodies } from '@/lib/records-client';
import { committeeMap } from '@/lib/records';
import NewsCard from '@/components/NewsCard';

const chip = (on: boolean) => `press rounded-full border px-3.5 py-1.5 text-sm font-bold ${on ? 'border-p950 bg-p950 text-white' : 'border-p900/25 bg-white text-p900 hover:border-p900'}`;

// Latest stories as cards, with a category filter and (optionally) a committee filter. Loads its own data, so it works on any page designed in Plasmic.
export default function NewsBlock({ count = 12, showFilters = true, className = '' }: { count?: number; showFilters?: boolean; className?: string }) {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [cmap, setCmap] = useState<Record<string, string>>({});
  const [cat, setCat] = useState('');
  const [committee, setCommittee] = useState('');
  useEffect(() => {
    let off = false;
    (async () => {
      const r = await browserClient().schema('activities').rpc('public_posts', { p_limit: Math.max(count, 60), p_offset: 0, p_category: null, p_activity: null });
      if (!off) setPosts(((((r.data as { items?: unknown[] } | null)?.items) ?? []) as unknown[]).map(normalise));
      fetchBodies().then((b) => { if (!off) setCmap(committeeMap(b)); }).catch(() => {});
    })().catch(() => { if (!off) setPosts([]); });
    return () => { off = true; };
  }, [count]);
  const categories = useMemo(() => Array.from(new Set((posts ?? []).map((p) => p.category).filter(Boolean))), [posts]);   // the ones that have posts
  const committees = useMemo(() => Array.from(new Set(Object.values(cmap))).sort(), [cmap]);
  if (!posts) return <p className={`text-muted ${className}`}>Loading news…</p>;
  const shown = posts.filter((p) => (!cat || p.category === cat) && (!committee || cmap[p.bodyName] === committee)).slice(0, count);
  return (
    <div className={className}>
      {showFilters ? (
        <div className="flex flex-wrap items-center gap-2">
          {['', ...categories].map((c) => <button key={c || 'all'} type="button" aria-pressed={cat === c} onClick={() => setCat(c)} className={chip(cat === c)}>{c || 'All'}</button>)}
          {committees.length ? (
            <select aria-label="Committee" value={committee} onChange={(e) => setCommittee(e.target.value)} className="h-10 max-w-full rounded-full border border-p900/25 bg-white px-3 text-sm font-bold text-p900">
              <option value="">All committees</option>
              {committees.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          ) : null}
        </div>
      ) : null}
      {shown.length ? (
        <div className="mt-6 grid gap-5 md:grid-cols-6 md:gap-6">
          {shown.map((p, i) => <div key={p.slug} className={i < 2 ? 'md:col-span-3' : 'md:col-span-2'}><NewsCard post={p} size={i < 2 ? 'wide' : 'card'} /></div>)}
        </div>
      ) : <p className="mt-6 max-w-md text-lg text-muted">Nothing posted here yet. Try another filter.</p>}
    </div>
  );
}
