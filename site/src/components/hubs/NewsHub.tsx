'use client';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useState, type ReactNode } from 'react';
import { DataProvider } from '@plasmicapp/loader-nextjs';
import { browserClient } from '@/lib/supabase';
import { normalise, CATEGORIES, type Post } from '@/lib/posts';
import { fetchBodies } from '@/lib/records-client';
import { committeeMap } from '@/lib/records';
import { postDate } from '@/lib/dates';
import { useHubSeed } from './HubSeed';

// One colour per category, the same as the coded news cards.
const TONE: Record<string, { color: string; onColor: string }> = {
  Impact: { color: '#ff9fe6', onColor: '#2a0628' }, Events: { color: '#c3a1f2', onColor: '#2a0628' },
  Announcements: { color: '#e9ee2e', onColor: '#2a0628' }, Stories: { color: '#ebe1fa', onColor: '#4d0a49' },
};
const toneOf = (c: string) => TONE[c] ?? { color: '#d3a6cf', onColor: '#2a0628' };

export type NewsHubRef = {
  setSearch: (query: string) => void;
  setCategory: (name: string) => void; toggleCategory: (name: string) => void;
  setCommittee: (name: string) => void; toggleCommittee: (name: string) => void;
  clearFilters: () => void;
};
export type NewsHubProps = { children?: ReactNode; className?: string; limit?: number; defaultCategory?: string; defaultCommittee?: string };

// Loads the latest stories and keeps the filters. It draws nothing itself: Studio gets the data ($ctx.newsHub) and actions to build any layout.
const NewsHub = forwardRef<NewsHubRef, NewsHubProps>(function NewsHub({ children, className = '', limit = 12, defaultCategory = '', defaultCommittee = '' }, ref) {
  const hubSeed = useHubSeed();
  const [posts, setPosts] = useState<Post[] | null>(() => hubSeed?.posts ?? null);
  const [failed, setFailed] = useState(false);
  const [cmap, setCmap] = useState<Record<string, string>>(() => (hubSeed?.bodies ? committeeMap(hubSeed.bodies) : {}));
  const [q, setQ] = useState(''); const [cat, setCat] = useState(() => defaultCategory.trim()); const [committee, setCommittee] = useState(() => defaultCommittee.trim());
  useEffect(() => {
    if (hubSeed?.posts) return; // already seeded by the server
    let off = false;
    (async () => {
      const r = await browserClient().schema('activities').rpc('public_posts', { p_limit: Math.max(limit, 60), p_offset: 0, p_category: null, p_activity: null });
      if (r.error) throw r.error;
      if (!off) setPosts(((((r.data as { items?: unknown[] } | null)?.items) ?? []) as unknown[]).map(normalise));
      fetchBodies().then((b) => { if (!off) setCmap(committeeMap(b)); }).catch(() => {});
    })().catch(() => { if (!off) { setPosts([]); setFailed(true); } });
    return () => { off = true; };
  }, [limit]);
  useEffect(() => { setCat(defaultCategory.trim()); setCommittee(defaultCommittee.trim()); }, [defaultCategory, defaultCommittee, posts]);

  const all = useMemo(() => (posts ?? []).map((p) => {
    const committee = cmap[p.bodyName] ?? ''; const tone = toneOf(p.category);
    return {
      slug: p.slug, title: p.title, category: p.category, categoryColor: tone.color, categoryOnColor: tone.onColor, summary: p.summary,
      publishedAt: p.published_at, dateText: postDate(p.published_at), author: p.author, from: p.bodyName, committee, committeeShort: committee.replace(/ Committee$/, ''),
      cover: p.cover, hasCover: !!p.cover, link: `/news/${p.slug}`,
    };
  }), [posts, cmap]);
  const matches = all.filter((p) => {
    if (q && !`${p.title} ${p.summary}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (cat && p.category !== cat) return false;
    if (committee && p.committee.toLowerCase() !== committee.toLowerCase() && p.committeeShort.toLowerCase() !== committee.toLowerCase()) return false;
    return true;
  });
  const shown = limit > 0 ? matches.slice(0, limit) : matches;
  const dirty = !!(q || cat || committee);
  const clear = () => { setQ(''); setCat(''); setCommittee(''); };
  useImperativeHandle(ref, () => ({
    setSearch: (v: string) => setQ(v ?? ''), setCategory: (n: string) => setCat(n ?? ''), toggleCategory: (n: string) => setCat((c) => (c === n ? '' : n)),
    setCommittee: (n: string) => setCommittee(n ?? ''), toggleCommittee: (n: string) => setCommittee((c) => (c === n ? '' : n)), clearFilters: clear,
  }));

  const categories = CATEGORIES.map((name) => ({ name, ...toneOf(name), isSelected: cat === name, count: all.filter((p) => p.category === name).length }));
  const committees = Array.from(new Set(all.map((p) => p.committee).filter(Boolean))).sort().map((name) => ({ name, short: name.replace(/ Committee$/, ''), isSelected: committee.toLowerCase() === name.toLowerCase(), count: all.filter((p) => p.committee === name).length }));
  const hub = {
    isLoading: !posts, hasError: failed, items: shown, first: shown[0] ?? null, totalCount: matches.length, shownCount: shown.length, allCount: all.length, hasMatches: shown.length > 0,
    countText: `${matches.length} stor${matches.length === 1 ? 'y' : 'ies'}${dirty ? ' match' : ''}`, categories, committees,
    activeSearch: q, selectedCategory: cat, selectedCommittee: committee, isFiltering: dirty,
  };
  return <DataProvider name="newsHub" data={hub}><div className={className}>{children}</div></DataProvider>;
});
export default NewsHub;
