'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { DataProvider, repeatedElement } from '@plasmicapp/loader-nextjs';
import { fetchBodies, fetchLeaders } from '@/lib/records-client';
import { committeesOf, slugify, sortLeaders, type Body, type Leader } from '@/lib/records';

export type PeoplePart = 'exco' | 'committee-heads' | 'year-reps' | 'stream-reps';

const isStream = (l: Leader) => /stream/i.test(l.title);
const initialsOf = (n: string) => n.split(/[\s(]+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');

function pick(part: PeoplePart, bodies: Body[], leaders: Leader[]): Leader[] {
  if (part === 'exco') { const e = bodies.find((b) => b.level === 'ExCo'); return e ? sortLeaders(leaders.filter((l) => l.level === 'ExCo' && l.body === e.name)) : []; }
  if (part === 'committee-heads') {
    return committeesOf(bodies).flatMap((c) => sortLeaders(leaders.filter((l) => l.level === 'Committee' && l.body === c.name)));
  }
  if (part === 'year-reps') return sortLeaders(leaders.filter((l) => l.level === 'Year' && !isStream(l)));
  return sortLeaders(leaders.filter(isStream));
}

// Loads the people for one part of Meet the Team and repeats whatever is dropped into it, once per person.
// In Plasmic: design one card inside, then bind its text and photo to the "person" fields (name, title, photo, group, initials, link).
export default function PeopleList({ part = 'exco', columns = 3, gap = 16, children, className = '' }: { part?: PeoplePart; columns?: number; gap?: number; children?: ReactNode; className?: string }) {
  const [data, setData] = useState<{ bodies: Body[]; leaders: Leader[] } | 'failed' | null>(null);
  useEffect(() => {
    let off = false;
    (async () => {
      try { const [bodies, lead] = await Promise.all([fetchBodies(), fetchLeaders()]); if (!off) setData({ bodies, leaders: lead.leaders }); }
      catch { if (!off) setData('failed'); }
    })();
    return () => { off = true; };
  }, []);
  if (!data) return <p className={`text-muted ${className}`}>Loading the team…</p>;
  if (data === 'failed') return <p className={`rounded-lg bg-red-100 px-3 py-2 text-bad ${className}`}>The team list could not be loaded right now. Please try again in a minute.</p>;

  const cols = Math.min(6, Math.max(1, Math.round(columns)));
  const people = pick(part, data.bodies, data.leaders);
  const committeeSlug = new Map(committeesOf(data.bodies).map((c) => [c.name, c.slug]));
  return (
    <div className={className} style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap }}>
      {people.map((l, i) => (
        <DataProvider key={`${l.body}-${l.title}-${l.name}-${i}`} name="person" data={{
          name: l.name, title: l.title, photo: l.photo || '', hasPhoto: !!l.photo, initials: initialsOf(l.name),
          group: l.level === 'Committee' ? l.body.replace(/ Committee$/, '') : l.body,
          link: l.level === 'Committee' ? `/student-groups/${committeeSlug.get(l.body) ?? slugify(l.body)}` : '',
        }}>
          {repeatedElement(i, children)}
        </DataProvider>
      ))}
    </div>
  );
}
