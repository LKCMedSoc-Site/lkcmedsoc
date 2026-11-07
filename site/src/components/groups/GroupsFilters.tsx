'use client';
import { Search } from 'lucide-react';
import { useGroups } from './GroupsHub';

const NEED = <p className="text-sm text-muted">Place this inside a “Student groups hub”.</p>;
const chip = (on: boolean) => `press rounded-full border px-3.5 py-1.5 text-sm font-bold ${on ? 'border-p950 bg-p950 text-white' : 'border-p900/25 bg-white text-p900 hover:border-p900'}`;

export function GroupsSearch({ placeholder = 'Search groups', className = '' }: { placeholder?: string; className?: string }) {
  const g = useGroups(); if (!g) return NEED;
  return (
    <label className={`relative block ${className}`}>
      <span className="sr-only">Search student groups</span>
      <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-p500" />
      <input value={g.q} onChange={(e) => g.setQ(e.target.value)} placeholder={placeholder} className="h-10 w-full rounded-full border-2 border-p950 bg-white pl-9 pr-3 text-sm text-p950 outline-none focus:border-p500" />
    </label>
  );
}

export function GroupsCommitteeChips({ showDots = true, className = '' }: { showDots?: boolean; className?: string }) {
  const g = useGroups(); if (!g) return NEED;
  return (
    <div className={`flex gap-2 overflow-x-auto pb-1 ${className}`} role="group" aria-label="Filter by committee">
      {g.committees.map((c) => { const on = g.picked.includes(c.name); return (
        <button key={c.name} type="button" aria-pressed={on} onClick={() => g.toggle(c.name)} className={`${chip(on)} flex shrink-0 items-center gap-2`}>
          {showDots ? <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: g.toneOf(c.name).bg, boxShadow: '0 0 0 1px rgba(77,10,73,.3)' }} /> : null}{c.name.replace(/ Committee$/, '')}
        </button>); })}
    </div>
  );
}

export function GroupsRecruitingToggle({ label = 'Recruiting', className = '' }: { label?: string; className?: string }) {
  const g = useGroups(); if (!g) return NEED;
  if (!g.anyRecruiting) return null;
  return <button type="button" aria-pressed={g.recruiting} onClick={() => g.setRecruiting(!g.recruiting)} className={`${chip(g.recruiting)} ${className}`}>{label}</button>;
}

export function GroupsClear({ label = 'Clear', className = '' }: { label?: string; className?: string }) {
  const g = useGroups(); if (!g) return NEED;
  return g.dirty ? <button type="button" onClick={g.clear} className={`text-sm font-bold text-p500 underline ${className}`}>{label}</button> : null;
}

export function GroupsCount({ className = '' }: { className?: string }) {
  const g = useGroups(); if (!g) return NEED;
  return <p className={`text-sm text-muted ${className}`} aria-live="polite">{g.shown.length} group{g.shown.length === 1 ? '' : 's'}{g.dirty ? ' match' : ''}</p>;
}
