import type { Metadata } from 'next';
import Link from 'next/link';
import { getBodies, getLeaders } from '@/lib/records';
import Leaders from '@/components/Leaders';

export const metadata: Metadata = { title: 'House System' };
export const revalidate = 300;

export default async function Houses() {
  const bodies = await getBodies().catch(() => null);
  const { ay, leaders } = await getLeaders().catch(() => ({ ay: '', leaders: [] }));
  const houses = (bodies ?? []).filter((b) => b.level === 'House' && b.status === 'Active').sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-sm"><Link className="underline" href="/student-life">Student life</Link></p>
      <h1 className="display mt-1 text-5xl">House system</h1>
      {ay ? <p className="mt-2 text-muted">{ay}</p> : null}
      {!bodies ? <p className="mt-6 rounded-lg bg-red-100 px-3 py-2 text-bad">This list could not be loaded right now. Please try again in a minute.</p> : null}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {houses.map((h) => (
          <div key={h.name} className="rounded-xl border border-line bg-white p-4">
            <h2 className="text-lg font-bold text-p900">{h.name}</h2>
            {h.description ? <p className="mt-1 text-sm text-muted">{h.description}</p> : null}
            <Leaders className="mt-3" list={leaders.filter((l) => l.level === 'House' && l.body === h.name)} />
          </div>
        ))}
      </div>
    </div>
  );
}
