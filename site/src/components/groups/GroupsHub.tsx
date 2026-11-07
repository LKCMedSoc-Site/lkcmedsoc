'use client';
import { createContext, forwardRef, useContext, useEffect, useImperativeHandle, useMemo, useState, type ReactNode } from 'react';
import { DataProvider } from '@plasmicapp/loader-nextjs';
import { fetchBodies, fetchLeaders } from '@/lib/records-client';
import { groupItems } from '@/lib/groups';
import { pickSpotlight } from '@/lib/spotlight';
import type { GroupItem } from '@/components/GroupsBrowser';
import { toGroupData } from './groupData';

// One colour per committee, used on its badge and its filter chip. Hex values are the brand palette.
export const TONES = [
  { bg: '#8e2a88', fg: '#ffffff' }, { bg: '#c3a1f2', fg: '#2a0628' }, { bg: '#ff9fe6', fg: '#2a0628' },
  { bg: '#4d0a49', fg: '#ffffff' }, { bg: '#d3a6cf', fg: '#2a0628' }, { bg: '#ebe1fa', fg: '#4d0a49' },
];

export type GroupsCtx = {
  items: GroupItem[]; committees: { name: string; href: string }[]; shown: GroupItem[];
  q: string; setQ: (v: string) => void; picked: string[]; toggle: (c: string) => void;
  recruiting: boolean; setRecruiting: (v: boolean) => void; anyRecruiting: boolean; dirty: boolean; clear: () => void;
  toneOf: (committee: string) => (typeof TONES)[number];
  loading: boolean; failed: boolean;
};
const Ctx = createContext<GroupsCtx | null>(null);
export const useGroups = () => useContext(Ctx);

export type GroupsHubRef = {
  setSearch: (query: string) => void;
  toggleCommittee: (slug: string) => void;
  setRecruitingOnly: (on: boolean) => void;
  toggleRecruitingOnly: () => void;
  clearFilters: () => void;
};

const slugOf = (href: string) => href.split('/').filter(Boolean).pop() ?? '';

// Loads every student group and holds the filters. It does not draw anything itself: it gives Studio the data ($ctx.groupsHub) and actions
// (setSearch, toggleCommittee, setRecruitingOnly, toggleRecruitingOnly, clearFilters), and the ready-made pieces below also work inside it.
type HubData = ReturnType<typeof groupItems> & { spotName: string; spotLeaders: { name: string; title: string }[] };
// A stable shuffle for "random" order: the same order for the whole visit, a different one next time.
const rankOf = (seed: number, text: string) => { let h = (seed * 1e9) | 0; for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619); return h >>> 0; };

export type GroupsHubProps = {
  children?: ReactNode; className?: string;
  /** Show at most this many groups (0 = all). Handy for a small preview on the home page. */
  limit?: number; defaultRecruitingOnly?: boolean; defaultCommittee?: string; order?: 'a-z' | 'random';
};

const GroupsHub = forwardRef<GroupsHubRef, GroupsHubProps>(function GroupsHub({ children, className = '', limit = 0, defaultRecruitingOnly = false, defaultCommittee = '', order = 'a-z' }, ref) {
  const [data, setData] = useState<HubData | 'failed' | null>(null);
  const [seed] = useState(() => Math.random());
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [recruiting, setRecruiting] = useState(false);
  useEffect(() => {
    let off = false;
    (async () => {
      try { const [bodies, lead] = await Promise.all([fetchBodies(), fetchLeaders().catch(() => ({ ay: '', leaders: [] }))]); if (!off) { const sp = pickSpotlight(bodies, lead.leaders); setData({ ...groupItems(bodies, lead.leaders), spotName: sp.spot?.c.name ?? '', spotLeaders: sp.spotLeaders.map((l) => ({ name: l.name, title: l.title })) }); } }
      catch { if (!off) setData('failed'); }
    })();
    return () => { off = true; };
  }, []);
  const items = data && data !== 'failed' ? data.items : [];
  const committees = data && data !== 'failed' ? data.committees : [];
  // Starting filters set from the block's settings, applied once the groups have loaded.
  useEffect(() => {
    if (!data || data === 'failed') return;
    setRecruiting(!!defaultRecruitingOnly);
    const want = defaultCommittee.trim().toLowerCase();
    const c = want ? data.committees.find((x) => x.name.toLowerCase() === want || slugOf(x.href) === want || x.name.toLowerCase().replace(/ committee$/, '') === want) : undefined;
    setPicked(c ? [c.name] : []);
  }, [data, defaultRecruitingOnly, defaultCommittee]);
  const matches = useMemo(() => items.filter((i) => {
    if (q && !`${i.name} ${i.description ?? ''} ${i.committee}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (picked.length && !picked.includes(i.committee)) return false;
    if (recruiting && !i.recruiting) return false;
    return true;
  }).sort((a, b) => (order === 'random' ? rankOf(seed, a.name) - rankOf(seed, b.name) : a.name.localeCompare(b.name))), [items, q, picked, recruiting, order, seed]);
  const shown = limit > 0 ? matches.slice(0, limit) : matches;

  const toggle = (name: string) => setPicked((p) => (p.includes(name) ? p.filter((x) => x !== name) : [...p, name]));
  const clear = () => { setQ(''); setPicked([]); setRecruiting(false); };
  useImperativeHandle(ref, () => ({
    setSearch: (query: string) => setQ(query ?? ''),
    toggleCommittee: (slug: string) => { const c = committees.find((x) => slugOf(x.href) === slug || x.name === slug); if (c) toggle(c.name); },
    setRecruitingOnly: (on: boolean) => setRecruiting(!!on),
    toggleRecruitingOnly: () => setRecruiting((r) => !r),
    clearFilters: clear,
  }));

  const toneOf = (c: string) => TONES[Math.max(0, committees.findIndex((x) => x.name === c)) % TONES.length];
  const loading = !data, failed = data === 'failed';
  const dirty = !!(q || picked.length || recruiting);
  const value: GroupsCtx = { items, committees, shown, q, setQ, picked, recruiting, setRecruiting, toggle, anyRecruiting: items.some((i) => i.recruiting), dirty, clear, toneOf, loading, failed };

  // What Studio sees as $ctx.groupsHub. Chips can bind their "selected" look straight to committees[i].isSelected or selectedCommitteeMap[slug].
  const committeeData = committees.map((c) => ({
    name: c.name, short: c.name.replace(/ Committee$/, ''), slug: slugOf(c.href), href: c.href,
    color: toneOf(c.name).bg, onColor: toneOf(c.name).fg, isSelected: picked.includes(c.name), count: items.filter((i) => i.committee === c.name).length,
  }));
  const spotItem = data && data !== 'failed' && data.spotName ? items.find((i) => i.name === data.spotName) : undefined;
  const hub = {
    isLoading: loading, hasError: failed,
    items: shown.map((it) => ({ ...toGroupData(it, toneOf(it.committee)), committeeSlug: slugOf(it.committeeHref) })),
    totalCount: matches.length, shownCount: shown.length, allCount: items.length, hasMatches: shown.length > 0,
    countText: `${matches.length} group${matches.length === 1 ? '' : 's'}${dirty ? ' match' : ''}`,
    // This week's featured group (the site rotates one each week among groups that have named leaders). There is no "featured" flag in the data.
    spotlight: spotItem ? { ...toGroupData(spotItem, toneOf(spotItem.committee)), committeeSlug: slugOf(spotItem.committeeHref) } : null,
    spotlightLeaders: data && data !== 'failed' ? data.spotLeaders : [],
    activeSearch: q, committees: committeeData,
    selectedCommitteeMap: Object.fromEntries(committeeData.map((c) => [c.slug, c.isSelected])),
    selectedCommitteeCount: picked.length,
    isRecruitingOnly: recruiting, anyRecruiting: value.anyRecruiting, isFiltering: dirty,
  };
  return <Ctx.Provider value={value}><DataProvider name="groupsHub" data={hub}><div className={className}>{children}</div></DataProvider></Ctx.Provider>;
});
export default GroupsHub;
