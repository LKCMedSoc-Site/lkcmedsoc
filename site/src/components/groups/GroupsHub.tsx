'use client';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fetchBodies, fetchLeaders } from '@/lib/records-client';
import { groupItems } from '@/lib/groups';
import type { GroupItem } from '@/components/GroupsBrowser';

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
};
const Ctx = createContext<GroupsCtx | null>(null);
export const useGroups = () => useContext(Ctx);

// Loads every student group and holds the filters. Put the filter pieces and the list inside it, in any order and layout.
export default function GroupsHub({ children, className = '' }: { children?: ReactNode; className?: string }) {
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

  if (!data) return <p className={`text-muted ${className}`}>Loading student groups…</p>;
  if (data === 'failed') return <p className={`rounded-lg bg-red-100 px-3 py-2 text-bad ${className}`}>This list could not be loaded right now. Please try again in a minute.</p>;
  const value: GroupsCtx = {
    items, committees, shown, q, setQ, picked, recruiting, setRecruiting,
    toggle: (c) => setPicked((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c])),
    anyRecruiting: items.some((i) => i.recruiting), dirty: !!(q || picked.length || recruiting),
    clear: () => { setQ(''); setPicked([]); setRecruiting(false); },
    toneOf: (c) => TONES[Math.max(0, committees.findIndex((x) => x.name === c)) % TONES.length],
  };
  return <Ctx.Provider value={value}><div className={className}>{children}</div></Ctx.Provider>;
}
