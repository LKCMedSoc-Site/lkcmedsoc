'use client';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useState, type ReactNode } from 'react';
import { DataProvider } from '@plasmicapp/loader-nextjs';
import { fetchBodies, fetchLeaders } from '@/lib/records-client';
import { committeesOf, slugify, sortLeaders, type Body, type Leader } from '@/lib/records';
import { useHubSeed } from './HubSeed';

export type PeopleHubRef = { setSearch: (query: string) => void; clearFilters: () => void };
export type PeopleHubProps = { children?: ReactNode; className?: string; limit?: number };

const isStream = (l: Leader) => /stream/i.test(l.title);
const initialsOf = (n: string) => n.split(/[\s(]+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
const person = (l: Leader, slugs: Map<string, string>) => ({
  name: l.name, title: l.title, photo: l.photo || '', hasPhoto: !!l.photo, initials: initialsOf(l.name),
  group: l.level === 'Committee' ? l.body.replace(/ Committee$/, '') : l.body,
  groupSlug: l.level === 'Committee' ? slugs.get(l.body) ?? slugify(l.body) : '',
  link: l.level === 'Committee' ? `/student-groups/${slugs.get(l.body) ?? slugify(l.body)}` : '',
});

// Loads the team and keeps a search. It draws nothing itself: Studio gets the data ($ctx.peopleHub) to build any layout.
const PeopleHub = forwardRef<PeopleHubRef, PeopleHubProps>(function PeopleHub({ children, className = '', limit = 0 }, ref) {
  const hubSeed = useHubSeed();
  const [data, setData] = useState<{ bodies: Body[]; leaders: Leader[]; ay: string } | 'failed' | null>(() => (hubSeed?.bodies && hubSeed.leaders ? { bodies: hubSeed.bodies, leaders: hubSeed.leaders, ay: hubSeed.ay ?? '' } : null));
  const [q, setQ] = useState('');
  useEffect(() => {
    if (data) return; // already seeded by the server
    let off = false;
    (async () => {
      try { const [bodies, lead] = await Promise.all([fetchBodies(), fetchLeaders()]); if (!off) setData({ bodies, leaders: lead.leaders, ay: lead.ay }); }
      catch { if (!off) setData('failed'); }
    })();
    return () => { off = true; };
  }, []);
  useImperativeHandle(ref, () => ({ setSearch: (v: string) => setQ(v ?? ''), clearFilters: () => setQ('') }));

  const hub = useMemo(() => {
    if (!data || data === 'failed') return { isLoading: !data, hasError: data === 'failed' };
    const { bodies, leaders } = data;
    const committees = committeesOf(bodies); const slugs = new Map(committees.map((c) => [c.name, c.slug]));
    const match = (l: Leader) => !q || `${l.name} ${l.title} ${l.body}`.toLowerCase().includes(q.toLowerCase());
    const cut = <T,>(list: T[]) => (limit > 0 ? list.slice(0, limit) : list);
    const exco = bodies.find((b) => b.level === 'ExCo');
    const excoL = exco ? sortLeaders(leaders.filter((l) => l.level === 'ExCo' && l.body === exco.name)).filter(match) : [];
    const headsL = committees.flatMap((c) => sortLeaders(leaders.filter((l) => l.level === 'Committee' && l.body === c.name))).filter(match);
    const yearsB = bodies.filter((b) => b.level === 'Year' && b.status === 'Active').sort((a, b) => a.name.localeCompare(b.name));
    const yearL = sortLeaders(leaders.filter((l) => l.level === 'Year' && !isStream(l))).filter(match);
    const streamL = sortLeaders(leaders.filter(isStream)).filter(match);
    return {
      isLoading: false, hasError: false, ay: data.ay, activeSearch: q, isFiltering: !!q,
      exco: cut(excoL).map((l) => person(l, slugs)), committeeHeads: cut(headsL).map((l) => person(l, slugs)),
      yearReps: cut(yearL).map((l) => person(l, slugs)), streamReps: cut(streamL).map((l) => person(l, slugs)),
      // Structured, for layouts that group people: each committee with its people, each year with its reps.
      committees: committees.map((c) => {
        const ppl = sortLeaders(leaders.filter((l) => l.level === 'Committee' && l.body === c.name)).filter(match).map((l) => person(l, slugs));
        return { name: c.name, short: c.name.replace(/ Committee$/, ''), slug: c.slug, link: `/student-groups/${c.slug}`, groupCount: c.ccas.length, head: ppl[0] ?? null, people: ppl };
      }),
      years: yearsB.map((y) => {
        const all = leaders.filter((l) => l.body === y.name && (l.level === 'Year' || isStream(l))).filter(match);
        return { name: y.name, reps: all.filter((l) => !isStream(l)).map((l) => person(l, slugs)), streams: all.filter(isStream).map((l) => person(l, slugs)) };
      }),
      excoCount: excoL.length, committeeHeadCount: headsL.length, yearRepCount: yearL.length, streamRepCount: streamL.length,
    };
  }, [data, q, limit]);
  return <DataProvider name="peopleHub" data={hub}><div className={className}>{children}</div></DataProvider>;
});
export default PeopleHub;
