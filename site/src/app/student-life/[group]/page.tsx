import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getBodies, getLeaders, groupsOf } from '@/lib/records';
import CcaCard from '@/components/CcaCard';

export const revalidate = 300;
type Props = { params: Promise<{ group: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = (await params).group;
  const g = groupsOf(await getBodies().catch(() => [])).find((x) => x.slug === slug);
  return { title: g?.title ?? 'Student Life' };
}

export default async function GroupPage({ params }: Props) {
  const slug = (await params).group;
  const bodies = await getBodies().catch(() => null);
  if (!bodies) return <div className="mx-auto max-w-3xl px-4 py-10"><p className="rounded-lg bg-red-100 px-3 py-2 text-bad">This list could not be loaded right now. Please try again in a minute.</p></div>;
  const group = groupsOf(bodies).find((g) => g.slug === slug);
  if (!group) notFound();
  const { ay, leaders } = await getLeaders().catch(() => ({ ay: '', leaders: [] }));
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-sm"><Link className="underline" href="/student-life">Student life</Link></p>
      <h1 className="display mt-1 text-5xl">{group.title}</h1>
      <p className="mt-2 text-muted">Under the {group.committee}{ay ? ` · ${ay}` : ''}</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {group.ccas.map((c) => <CcaCard key={c.name} body={c} leaders={leaders.filter((l) => l.level === 'CCA/Project' && l.body === c.name)} />)}
      </div>
    </div>
  );
}
