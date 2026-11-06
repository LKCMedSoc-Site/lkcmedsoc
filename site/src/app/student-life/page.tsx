import type { Metadata } from 'next';
import Link from 'next/link';
import { getBodies, groupsOf } from '@/lib/records';

export const metadata: Metadata = { title: 'Student Life' };
export const revalidate = 300;

export default async function StudentLife() {
  let groups: ReturnType<typeof groupsOf> = []; let failed = false;
  try { groups = groupsOf(await getBodies()); } catch { failed = true; }
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="display text-5xl">Student life</h1>
      <p className="mt-2 max-w-2xl text-muted">Every activity at LKCMedicine is a student-run CCA, grouped under a MedSoc committee. Pick a group to see its CCAs and who leads them.</p>
      {failed ? <p className="mt-6 rounded-lg bg-red-100 px-3 py-2 text-bad">This list could not be loaded right now. Please try again in a minute.</p> : null}
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        {groups.map((g) => (
          <Link key={g.slug} href={`/student-life/${g.slug}`} className="rounded-xl border border-line bg-p50 p-6 no-underline transition hover:border-p500">
            <h2 className="display text-3xl">{g.title}</h2>
            <p className="mt-1 text-sm text-muted">{g.ccas.length} CCA{g.ccas.length === 1 ? '' : 's'} · {g.ccas.slice(0, 4).map((c) => c.name).join(', ')}{g.ccas.length > 4 ? '…' : ''}</p>
          </Link>
        ))}
        <Link href="/student-life/houses" className="rounded-xl border border-line bg-p50 p-6 no-underline transition hover:border-p500">
          <h2 className="display text-3xl">House system</h2>
          <p className="mt-1 text-sm text-muted">The houses and their representatives.</p>
        </Link>
      </div>
    </div>
  );
}
