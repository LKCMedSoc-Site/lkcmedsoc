import type { Metadata } from 'next';
import Link from 'next/link';
import { getBodies, getLeaders } from '@/lib/records';
import { CommitteesPart, ExcoPart, YearsPart } from '@/components/TeamParts';
import PageHero from '@/components/blocks/PageHero';
import { plasmicData, PlasmicView } from '@/lib/plasmic-page';

export const metadata: Metadata = { title: 'Meet the Team' };
export const revalidate = 300;

export default async function MeetTheTeam() {
  // A page designed in Plasmic at this path replaces the coded one below.
  const designed = await plasmicData('/about/meet-the-team');
  if (designed) return <PlasmicView data={designed} />;
  const [bodies, lead] = await Promise.all([getBodies().catch(() => null), getLeaders().catch(() => null)]);
  if (!bodies || !lead) return <><PageHero title="Meet the Team" /><section className="band band-pale band-last" style={{ zIndex: 20 }}><div className="mx-auto max-w-3xl px-4"><p className="rounded-lg bg-red-100 px-3 py-2 text-bad">The team list could not be loaded right now. Please try again in a minute.</p></div></section></>;
  const { ay, leaders } = lead;
  return (
    <>
      <PageHero title="Meet the Team" intro={`The students behind MedSoc${ay ? `, ${ay}` : ''}. Want to join them?`}>
        <Link href="/about/work-with-us" className="press mt-6 inline-block rounded-full bg-pink px-6 py-3 font-bold text-p900 no-underline hover:bg-white">Work with us</Link>
      </PageHero>
      <section className="band band-pale band-last" style={{ zIndex: 20 }}>
        <div className="mx-auto max-w-6xl space-y-14 px-4 md:space-y-20">
          <ExcoPart bodies={bodies} leaders={leaders} />
          <CommitteesPart bodies={bodies} leaders={leaders} />
          <YearsPart bodies={bodies} leaders={leaders} />

          <p className="text-sm">Looking for house representatives? See the <Link className="underline" href="/about/houses">house system</Link>. Past teams are on the <Link className="underline" href="/about/honour-roll">honour roll</Link>.</p>
        </div>
      </section>
    </>
  );
}
