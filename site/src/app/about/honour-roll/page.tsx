import type { Metadata } from 'next';
import Link from 'next/link';
import { getExcoTeams, sortLeaders, type Leader } from '@/lib/records';
import { ayNumber, ayToSlug, exco, ordinal } from '@/lib/ay';

export const metadata: Metadata = { title: 'Honour Roll' };
export const revalidate = 300;

export default async function HonourRoll() {
  let teams = new Map<string, Leader[]>(); let failed = false;
  try { teams = await getExcoTeams(); } catch { failed = true; }
  const years = [...teams.keys()].sort().reverse();
  const current = years[0];
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="display text-5xl">Honour roll</h1>
      <p className="mt-2 max-w-2xl text-muted">Every Executive Committee of the Students&rsquo; Medical Society, newest first. Open a year to see the team, what they achieved, and the news from that year.</p>
      {failed ? <p className="mt-6 rounded-lg bg-red-100 px-3 py-2 text-bad">The honour roll could not be loaded right now. Please try again in a minute.</p>
        : !years.length ? <p className="mt-6 text-muted">The honour roll is being updated. Check back soon.</p> : null}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {years.map((ay) => {
          const team = sortLeaders(teams.get(ay) ?? []);
          const lead = team.find((l) => /^president/i.test(l.title));
          return (
            <Link key={ay} href={`/about/honour-roll/${ayToSlug(ay)}`} className="rounded-xl border border-line bg-p50 p-5 no-underline transition hover:border-p500">
              <div className="text-sm font-medium uppercase tracking-wide text-p500">{ay}{ay === current ? ' · current' : ''}</div>
              <h2 className="display mt-1 text-4xl">{ayNumber(ay) > 0 ? `${ordinal(ayNumber(ay))} ExCo` : ay}</h2>
              {lead ? <p className="mt-2 text-sm text-muted">President: <span className="font-medium text-ink">{lead.name}</span></p> : null}
              <p className="text-sm text-muted">{team.length} member{team.length === 1 ? '' : 's'}</p>
            </Link>
          );
        })}
      </div>
      {years.length ? <p className="mt-8 text-xs text-muted">Counted from the 1st ExCo in AY13/14, so {years[0]} is the {exco(years[0])}.</p> : null}
    </div>
  );
}
