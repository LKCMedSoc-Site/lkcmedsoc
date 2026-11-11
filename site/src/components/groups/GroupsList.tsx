'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { DataProvider, repeatedElement } from '@plasmicapp/loader-nextjs';
import type { GroupItem } from '@/components/GroupsBrowser';
import { useGroups } from './GroupsHub';
import { toGroupData } from './groupData';

export type { GroupData } from './groupData';

// Repeats the card you design inside it once per group that matches the filters, optionally under a heading for each committee.
export default function GroupsList({ columns = 3, gap = 16, byCommittee = true, children, className = '' }: { columns?: number; gap?: number; byCommittee?: boolean; children?: ReactNode; className?: string }) {
  const g = useGroups();
  if (!g) return <p className="text-sm text-muted">Place this inside a “Student groups hub”.</p>;
  if (g.loading) return <p className={`text-muted ${className}`}>Loading student groups…</p>;
  if (g.failed) return <p className={`rounded-lg bg-red-100 px-3 py-2 text-bad ${className}`}>This list could not be loaded right now. Please try again in a minute.</p>;
  const cols = Math.min(6, Math.max(1, Math.round(columns)));
  const grid = { display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap } as const;
  const cards = (list: GroupItem[], offset: number) => list.map((it, i) => (
    <DataProvider key={it.href} name="group" data={toGroupData(it, g.toneOfItem(it))}>{repeatedElement(offset + i, children)}</DataProvider>
  ));
  if (!g.shown.length) return <p className="mt-4 max-w-md text-lg text-muted">No groups match those filters. Try clearing one.</p>;
  if (!byCommittee) return <div className={className} style={grid}>{cards(g.shown, 0)}</div>;
  let n = 0;
  return (
    <div className={className}>
      {g.committees.filter((c) => g.shown.some((s) => s.committee === c.name)).map((c) => {
        const list = g.shown.filter((s) => s.committee === c.name); const start = n; n += list.length;
        return (
          <section key={c.name} className="mt-8 first:mt-0">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2"><h2 className="h-xl">{c.name}</h2><Link href={c.href} className="link-arrow">About this committee</Link></div>
            <div style={grid}>{cards(list, start)}</div>
          </section>
        );
      })}
    </div>
  );
}
