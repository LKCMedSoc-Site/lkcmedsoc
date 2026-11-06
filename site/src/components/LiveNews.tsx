'use client';
import { useEffect, useState } from 'react';
import { browserClient } from '@/lib/supabase';
import { normalise, type Post } from '@/lib/posts';
import PostCard from './PostCard';

const COLS: Record<string, string> = { '1': 'grid-cols-1', '2': 'grid-cols-1 sm:grid-cols-2', '3': 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' };

/** Latest news cards. Used inside Plasmic pages; reads public data only. */
export default function LiveNews({ category = 'All', count = 6, columns = '3', className }: { category?: string; count?: number; columns?: string; className?: string }) {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let off = false;
    browserClient().schema('activities')
      .rpc('public_posts', { p_limit: count, p_offset: 0, p_category: category === 'All' ? null : category, p_activity: null })
      .then(({ data, error }) => {
        if (off) return;
        if (error) { setFailed(true); return; }
        setPosts((((data as { items?: unknown[] } | null)?.items) ?? []).map(normalise));
      });
    return () => { off = true; };
  }, [category, count]);

  if (failed) return <p className={className}>News could not be loaded right now.</p>;
  if (!posts) return <p className={`text-muted ${className ?? ''}`}>Loading news…</p>;
  if (!posts.length) return <p className={`text-muted ${className ?? ''}`}>Nothing posted here yet.</p>;
  return <div className={`grid gap-5 ${COLS[columns] ?? COLS['3']} ${className ?? ''}`}>{posts.map((p) => <PostCard key={p.slug} post={p} />)}</div>;
}
