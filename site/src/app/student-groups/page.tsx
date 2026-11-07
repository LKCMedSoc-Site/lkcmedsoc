import type { Metadata } from 'next';
import { getBodies, getLeaders } from '@/lib/records';
import { groupItems } from '@/lib/groups';
import PageHero from '@/components/blocks/PageHero';
import GroupsBrowser from '@/components/GroupsBrowser';
import { plasmicData, PlasmicView } from '@/lib/plasmic-page';

export const metadata: Metadata = { title: 'Student Groups' };
export const revalidate = 300;

export default async function StudentGroups() {
  // A page designed in Plasmic at this path replaces the coded one below.
  const designed = await plasmicData('/student-groups');
  if (designed) return <PlasmicView data={designed} />;
  const bodies = await getBodies().catch(() => null);
  const { leaders } = await getLeaders().catch(() => ({ ay: '', leaders: [] }));
  const { items, committees } = bodies ? groupItems(bodies, leaders) : { items: [], committees: [] };
  return (
    <>
      <PageHero title="Student Groups" intro={`Every CCA at LKCMedicine is student-run and sits under a MedSoc committee.${items.length ? ` ${items.length} groups to explore.` : ''}`} />
      <section className="band band-pale band-last" style={{ zIndex: 20 }}>
        <div className="mx-auto max-w-6xl px-4">
          {!bodies ? <p className="rounded-lg bg-red-100 px-3 py-2 text-bad">This list could not be loaded right now. Please try again in a minute.</p>
            : <GroupsBrowser items={items} committees={committees} />}
        </div>
      </section>
    </>
  );
}
