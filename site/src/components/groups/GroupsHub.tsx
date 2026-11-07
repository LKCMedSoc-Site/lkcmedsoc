'use client';
import { createContext, forwardRef, useContext, useEffect, useImperativeHandle, useMemo, useState, type ReactNode } from 'react';
import { DataProvider } from '@plasmicapp/loader-nextjs';
import { fetchBodies, fetchLeaders } from '@/lib/records-client';
import { groupItems } from '@/lib/groups';
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
const GroupsHub = forwardRef<GroupsHubRef, { children?: ReactNode; className?: string }>(function GroupsHub({ children, className = '' }, ref) {
  const [data, setData] = useState<ReturnType<typeof groupItems> | 'failed' | null>(null);
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [recruiting, setRecruiting] = useState(false);
  useEffect(() => {
    let off = false;
    (async () => {
      try { const [bodies, lead] = await Promise.all([fetchBodies(), fetchLeaders().catch(() => ({ ay: '', leaders: [] }))]); if (!off) setData(groupItems(bodies, lead.leaders)); }
      catch { if (!off) setData('failed'); }
    })();
    return () => { off = true; };
  }, []);
  const items = data && data !== 'failed' ? data.items : [];
  const committees = data && data !== 'failed' ? data.committees : [];
  const shown = useMemo(() => items.filter((i) => {
    if (q && !`${i.name} ${i.description ?? ''} ${i.committee}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (picked.length && !picked.includes(i.committee)) return false;
    if (recruiting && !i.recruiting) return false;
    return true;
  }).sort((a, b) => a.name.localeCompare(b.name)), [items, q, picked, recruiting]);

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
  const hub = {
    isLoading: loading, hasError: failed,
    items: shown.map((it) => ({ ...toGroupData(it, toneOf(it.committee)), committeeSlug: slugOf(it.committeeHref) })),
    totalCount: shown.length, allCount: items.length, hasMatches: shown.length > 0,
    countText: `${shown.length} group${shown.length === 1 ? '' : 's'}${dirty ? ' match' : ''}`,
    activeSearch: q, committees: committeeData,
    selectedCommitteeMap: Object.fromEntries(committeeData.map((c) => [c.slug, c.isSelected])),
    selectedCommitteeCount: picked.length,
    isRecruitingOnly: recruiting, anyRecruiting: value.anyRecruiting, isFiltering: dirty,
  };
  return <Ctx.Provider value={value}><DataProvider name="groupsHub" data={hub}><div className={className}>{children}</div></DataProvider></Ctx.Provider>;
});
export default GroupsHub;
