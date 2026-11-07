import type { Metadata } from 'next';
import PageHero from '@/components/blocks/PageHero';
import { getBodies, getLeaders } from '@/lib/records';
import Leaders from '@/components/Leaders';
import { plasmicData, PlasmicView } from '@/lib/plasmic-page';

export const metadata: Metadata = { title: 'House System' };
export const revalidate = 300;

export default async function Houses() {
  // A page designed in Plasmic at this path replaces the coded one below.
  const designed = await plasmicData('/about/houses');
  if (designed) return <PlasmicView data={designed} />;
  const bodies = await getBodies().catch(() => null);
  const { ay, leaders } = await getLeaders().catch(() => ({ ay: '', leaders: [] }));
  const houses = (bodies ?? []).filter((b) => b.level === 'House' && b.status === 'Active').sort((a, b) => a.name.localeCompare(b.name));
  return (
    <>
      <PageHero title="House System" back={{ label: 'About us', href: '/about/meet-the-team' }} intro={ay ? `House representatives, ${ay}` : undefined} />
      <section className="band band-pale band-last" style={{ zIndex: 20 }}><div className="mx-auto max-w-6xl px-4">
      {!bodies ? <p className="mt-6 rounded-lg bg-red-100 px-3 py-2 text-bad">This list could not be loaded right now. Please try again in a minute.</p> : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {houses.map((h) => (
          <div key={h.name} className="rounded-xl border border-line bg-white p-4">
            <h2 className="text-lg font-bold text-p900">{h.name}</h2>
            {h.description ? <p className="mt-1 text-sm text-muted">{h.description}</p> : null}
            <Leaders className="mt-3" list={leaders.filter((l) => l.level === 'House' && l.body === h.name)} />
          </div>
        ))}
      </div>
      </div></section>
    </>
  );
}
