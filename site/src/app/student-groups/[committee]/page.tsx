import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { committeesOf, getBodies, getLeaders, slugify, sortLeaders } from '@/lib/records';
import Leaders from '@/components/Leaders';
import Avatar from '@/components/Avatar';
import PageHero from '@/components/blocks/PageHero';

export const revalidate = 300;
type Props = { params: Promise<{ committee: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = (await params).committee;
  const c = committeesOf(await getBodies().catch(() => [])).find((x) => x.slug === slug);
  return { title: c?.name ?? 'Student Groups' };
}

export default async function CommitteePage({ params }: Props) {
  const slug = (await params).committee;
  const bodies = await getBodies().catch(() => null);
  const c = bodies ? committeesOf(bodies).find((x) => x.slug === slug) : undefined;
  if (!c) notFound();
  const { ay, leaders } = await getLeaders().catch(() => ({ ay: '', leaders: [] }));
  const head = leaders.filter((l) => l.level === 'Committee' && l.body === c.name);
  return (
    <>
      <PageHero title={c.name} back={{ label: 'Student Groups', href: '/student-groups' }} intro={ay ? `Leadership for ${ay}` : undefined} />
      <section className="band band-pale band-last" style={{ zIndex: 20 }}>
        <div className="mx-auto max-w-6xl px-4">
          {head.length ? <div className="mb-10"><h2 className="h-xl">Committee</h2><div className="mt-4 flex items-center gap-4"><Avatar name={head[0].name} photo={head[0].photo} size={80} /><Leaders className="text-base" list={head} /></div></div> : null}
          <h2 className="h-xl">{c.ccas.length ? 'Groups under this committee' : 'About this committee'}</h2>
          {c.ccas.length ? (
            <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {c.ccas.map((b) => {
                const chair = sortLeaders(leaders.filter((l) => l.level === 'CCA/Project' && l.body === b.name))[0];
                return (
                  <li key={b.name} className="overflow-hidden rounded-xl border border-p900/15 bg-white">
                    <Link href={`/student-groups/${c.slug}/${slugify(b.name)}`} className="row-link flex h-full items-center justify-between gap-3 p-4 no-underline hover:bg-mist md:p-5">
                      <span className="min-w-0"><span className="row-title block text-lg font-bold text-p900">{b.name}</span>{chair ? <span className="block truncate text-sm text-muted">{chair.name}</span> : null}</span>
                      <span aria-hidden className="row-arrow display text-3xl text-p500">→</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : <p className="mt-4 max-w-xl text-muted">This committee runs events and programmes directly rather than through separate CCAs. See what it has been up to on the <Link className="underline" href="/gazette">Gazette</Link>.</p>}
        </div>
      </section>
    </>
  );
}
