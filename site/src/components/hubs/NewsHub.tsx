'use client';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useState, type ReactNode } from 'react';
import { DataProvider } from '@plasmicapp/loader-nextjs';
import { browserClient } from '@/lib/supabase';
import { normalise, CATEGORIES, CATEGORY_LABEL, type Post } from '@/lib/posts';
import { withAlpha } from '@/lib/tones';
import { fetchBodies } from '@/lib/records-client';
import { committeeMap } from '@/lib/records';
import { postDate } from '@/lib/dates';
import { useHubSeed } from './HubSeed';
import { usePaging } from './paging';

// One colour per category, drawn from the brand purples (plum, magenta, violet and orchid families, deepened so all four take white text, like
// committee colours do). Yellow is retired. Each also carries a light `tint` and a stronger `overlay` for light resting states and photo washes.
const TONE: Record<string, { color: string; onColor: string }> = {
  Impact: { color: '#4d0a49', onColor: '#ffffff' }, Events: { color: '#8e2a88', onColor: '#ffffff' },
  Announcements: { color: '#6d4aa8', onColor: '#ffffff' }, Stories: { color: '#9a5d94', onColor: '#ffffff' },
};
const toneOf = (c: string) => { const t = TONE[c] ?? { color: '#6d4aa8', onColor: '#ffffff' }; return { ...t, tint: withAlpha(t.color, 0.12), overlay: withAlpha(t.color, 0.55) }; };

export type NewsHubRef = {
  setSearch: (query: string) => void;
  setCategory: (name: string) => void; toggleCategory: (name: string) => void;
  setCommittee: (name: string) => void; toggleCommittee: (name: string) => void;
  nextPage: () => void; prevPage: () => void; goToPage: (page: number) => void;
  clearFilters: () => void;
};
export type NewsHubProps = { children?: ReactNode; className?: string; limit?: number; pageSize?: number; defaultCategory?: string; defaultCommittee?: string };
const list = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
const has = (arr: string[], name: string) => arr.some((x) => x.toLowerCase() === name.toLowerCase());

// Loads the latest stories and keeps the filters. It draws nothing itself: Studio gets the data ($ctx.newsHub) and actions to build any layout.
const NewsHub = forwardRef<NewsHubRef, NewsHubProps>(function NewsHub({ children, className = '', limit = 12, pageSize = 0, defaultCategory = '', defaultCommittee = '' }, ref) {
  const hubSeed = useHubSeed();
  const [posts, setPosts] = useState<Post[] | null>(() => hubSeed?.posts ?? null);
  const [failed, setFailed] = useState(false);
  const [cmap, setCmap] = useState<Record<string, string>>(() => (hubSeed?.bodies ? committeeMap(hubSeed.bodies) : {}));
  const [q, setQ] = useState(''); const [cats, setCats] = useState<string[]>(() => list(defaultCategory)); const [picked, setPicked] = useState<string[]>(() => list(defaultCommittee));
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
  useEffect(() => { setCats(list(defaultCategory)); setPicked(list(defaultCommittee)); }, [defaultCategory, defaultCommittee, posts]);

  const all = useMemo(() => (posts ?? []).map((p) => {
    const committee = cmap[p.bodyName] ?? ''; const tone = toneOf(p.category);
    return {
      slug: p.slug, title: p.title, category: p.category, categoryLabel: CATEGORY_LABEL[p.category] ?? p.category, categoryColor: tone.color, categoryOnColor: tone.onColor, categoryTint: tone.tint, categoryOverlay: tone.overlay, featured: p.featured, summary: p.summary,
      publishedAt: p.published_at, dateText: postDate(p.published_at), author: p.author, from: p.bodyName, committee, committeeShort: committee.replace(/ Committee$/, ''),
      cover: p.cover, hasCover: !!p.cover, link: `/gazette/${p.slug}`,
    };
  }), [posts, cmap]);
  const matches = all.filter((p) => {
    if (q && !`${p.title} ${p.summary}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (cats.length && !has(cats, p.category)) return false;
    if (picked.length && !has(picked, p.committee) && !has(picked, p.committeeShort)) return false;
    return true;
  });
  const paging = usePaging(matches.length, pageSize, [q, cats.join('|'), picked.join('|')].join('~'));
  const shown = pageSize > 0 ? matches.slice(paging.from, paging.to) : limit > 0 ? matches.slice(0, limit) : matches;
  const dirty = !!(q || cats.length || picked.length);
  const clear = () => { setQ(''); setCats([]); setPicked([]); };
  const toggleIn = (set: (f: (p: string[]) => string[]) => void, name: string) => set((p) => (has(p, name ?? '') ? p.filter((x) => x.toLowerCase() !== (name ?? '').toLowerCase()) : [...p, name]));
  useImperativeHandle(ref, () => ({
    setSearch: (v: string) => setQ(v ?? ''), setCategory: (n: string) => setCats(n ? [n] : []), toggleCategory: (n: string) => toggleIn(setCats, n),
    setCommittee: (n: string) => setPicked(n ? [n] : []), toggleCommittee: (n: string) => toggleIn(setPicked, n),
    nextPage: paging.next, prevPage: paging.prev, goToPage: paging.go, clearFilters: clear,
  }));

  const categories = CATEGORIES.map((name) => ({ name, label: CATEGORY_LABEL[name] ?? name, ...toneOf(name), isSelected: has(cats, name), count: all.filter((p) => p.category === name).length }));
  const committees = Array.from(new Set(all.map((p) => p.committee).filter(Boolean))).sort().map((name) => ({ name, short: name.replace(/ Committee$/, ''), isSelected: has(picked, name) || has(picked, name.replace(/ Committee$/, '')), count: all.filter((p) => p.committee === name).length }));
  const hub = {
    isLoading: !posts, hasError: failed, items: shown, first: shown[0] ?? null, totalCount: matches.length, shownCount: shown.length, allCount: all.length, hasMatches: shown.length > 0,
    countText: `${matches.length} stor${matches.length === 1 ? 'y' : 'ies'}${dirty ? ' match' : ''}`, categories, committees,
    activeSearch: q, ...paging.fields,
    selectedCategory: categories.find((c) => c.isSelected)?.name ?? '', selectedCategories: categories.filter((c) => c.isSelected).map((c) => c.name),
    selectedCategoryMap: Object.fromEntries(categories.map((c) => [c.name, c.isSelected])), selectedCategoryCount: categories.filter((c) => c.isSelected).length,
    selectedCommittee: committees.find((c) => c.isSelected)?.name ?? '', selectedCommittees: committees.filter((c) => c.isSelected).map((c) => c.name),
    selectedCommitteeMap: Object.fromEntries(committees.map((c) => [c.name, c.isSelected])), selectedCommitteeCount: committees.filter((c) => c.isSelected).length,
    isFiltering: dirty,
  };
  return <DataProvider name="newsHub" data={hub}><div className={className}>{children}</div></DataProvider>;
});
export default NewsHub;
