import type { Metadata } from 'next';
import { getBodies, getLeaders, groupsOf, slugify, sortLeaders } from '@/lib/records';
import { storageUrl } from '@/lib/supabase';
import PageHero from '@/components/blocks/PageHero';
import GroupsBrowser, { type GroupItem } from '@/components/GroupsBrowser';

export const metadata: Metadata = { title: 'Student Groups' };
export const revalidate = 300;

// Logos and headers can be full links or file names inside the "body-images" storage bucket.
const img = (v: string | null) => (v ? storageUrl('body-images', v) : '');

export default async function StudentGroups() {
  const bodies = await getBodies().catch(() => null);
  const { leaders } = await getLeaders().catch(() => ({ ay: '', leaders: [] }));
  const groups = bodies ? groupsOf(bodies) : [];
  const items: GroupItem[] = groups.flatMap((g) => g.ccas.map((c) => ({
    name: c.name, href: `/student-groups/${g.slug}/${slugify(c.name)}`, committee: g.title, committeeHref: `/student-groups/${g.slug}`,
    chair: sortLeaders(leaders.filter((l) => l.level === 'CCA/Project' && l.body === c.name))[0]?.name ?? '',
    description: c.description, logo: img(c.logo), header: img(c.header), recruiting: !!c.recruitment,
  })));
  return (
    <>
      <PageHero title="Student Groups" intro={`Every CCA at LKCMedicine is student-run and sits under a MedSoc committee.${items.length ? ` ${items.length} groups to explore.` : ''}`} />
      <section className="band band-pale band-last" style={{ zIndex: 20 }}>
        <div className="mx-auto max-w-6xl px-4">
          {!bodies ? <p className="rounded-lg bg-red-100 px-3 py-2 text-bad">This list could not be loaded right now. Please try again in a minute.</p>
            : <GroupsBrowser items={items} committees={groups.map((g) => ({ name: g.title, href: `/student-groups/${g.slug}` }))} />}
        </div>
      </section>
    </>
  );
}
