import type { Metadata } from 'next';
import Link from 'next/link';
import { getBodies, getLeaders } from '@/lib/records';
import Leaders from '@/components/Leaders';

export const metadata: Metadata = { title: 'About us' };
export const revalidate = 300;

export default async function About() {
  const [bodies, lead] = await Promise.all([getBodies().catch(() => null), getLeaders().catch(() => null)]);
  if (!bodies || !lead) return <div className="mx-auto max-w-3xl px-4 py-10"><h1 className="display text-5xl">About us</h1><p className="mt-6 rounded-lg bg-red-100 px-3 py-2 text-bad">The team list could not be loaded right now. Please try again in a minute.</p></div>;
  const { ay, leaders } = lead;
  const of = (level: string, body: string) => leaders.filter((l) => l.level === level && l.body === body);
  const committees = bodies.filter((b) => b.level === 'Committee' && b.status === 'Active').sort((a, b) => a.name.localeCompare(b.name));
  const years = bodies.filter((b) => b.level === 'Year' && b.status === 'Active').sort((a, b) => a.name.localeCompare(b.name));
  const exco = bodies.find((b) => b.level === 'ExCo');
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="display text-5xl">About us</h1>
      <p className="mt-2 text-muted">The people behind MedSoc{ay ? `, ${ay}` : ''}. Want to join? <Link className="underline" href="/about/work-with-us">Work with us</Link>.</p>

      {exco ? (<section className="mt-10"><h2 className="display text-3xl">{exco.name}</h2><Leaders className="mt-3 columns-1 sm:columns-2" list={of('ExCo', exco.name)} /></section>) : null}

      <section className="mt-10"><h2 className="display text-3xl">Committees</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {committees.map((c) => (
            <div key={c.name} className="rounded-xl border border-line bg-white p-4">
              <h3 className="text-lg font-bold text-p900">{c.name}</h3>
              <Leaders className="mt-2" list={of('Committee', c.name)} />
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10"><h2 className="display text-3xl">Year representatives</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {years.map((y) => (
            <div key={y.name} className="rounded-xl border border-line bg-white p-4">
              <h3 className="text-lg font-bold text-p900">{y.name}</h3>
              <Leaders className="mt-2" list={of('Year', y.name)} />
            </div>
          ))}
        </div>
      </section>

      <p className="mt-10 text-sm">House representatives are on the <Link className="underline" href="/student-life/houses">house system</Link> page. <Link className="underline" href="/about/honour-roll">Honour roll</Link> · <Link className="underline" href="/about/alumni">Alumni association</Link></p>
    </div>
  );
}
