import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getBodies, getLeaders, slugify } from '@/lib/records';
import Leaders from '@/components/Leaders';
import PageHero from '@/components/blocks/PageHero';
import { plasmicData, PlasmicView } from '@/lib/plasmic-page';

export const revalidate = 300;
type Props = { params: Promise<{ house: string }> };

const houseOf = async (slug: string) => (await getBodies().catch(() => [])).find((b) => b.level === 'House' && b.status === 'Active' && slugify(b.name) === slug);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const h = await houseOf((await params).house);
  return { title: h?.name ?? 'House System' };
}

export default async function HousePage({ params }: Props) {
  const slug = (await params).house;
  // A page designed in Plasmic at /about/house-system/[house] replaces the coded one below.
  const designed = await plasmicData(`/about/house-system/${slug}`);
  if (designed) return <PlasmicView data={designed} />;
  const h = await houseOf(slug);
  if (!h) notFound();
  const { ay, leaders } = await getLeaders().catch(() => ({ ay: '', leaders: [] }));
  const reps = leaders.filter((l) => l.level === 'House' && l.body === h.name);
  return (
    <>
      <PageHero title={h.name} back={{ label: 'House system', href: '/about/house-system' }} intro={h.description ?? (ay ? `House representatives, ${ay}` : undefined)} />
      <section className="band band-pale band-last" style={{ zIndex: 20 }}>
        <div className="mx-auto max-w-4xl px-4">
          <h2 className="h-xl">House reps</h2>
          {reps.length ? <Leaders className="mt-4" list={reps} /> : <p className="mt-3 text-muted">The reps for this house are not listed yet.</p>}
          <p className="mt-8 text-sm">See every house on the <Link className="underline" href="/about/house-system">house system</Link> page, or all reps on <Link className="underline" href="/about/leadership#house-reps">Leadership</Link>.</p>
        </div>
      </section>
    </>
  );
}
