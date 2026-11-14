import type { Metadata } from 'next';
import { serverClient } from '@/lib/supabase';
import { committeeMap, getBodies } from '@/lib/records';
import type { PublicEvent } from '@/lib/events';
import PageHero from '@/components/blocks/PageHero';
import EventsBrowser from '@/components/EventsBrowser';
import { plasmicData, PlasmicView } from '@/lib/plasmic-page';

export const metadata: Metadata = { title: 'Events' };
export const revalidate = 60;

export default async function EventsPage() {
  // A page designed in Plasmic at this path replaces the coded one below.
  const designed = await plasmicData('/events');
  if (designed) return <PlasmicView data={designed} />;
  let events: PublicEvent[] = []; let failed = false;
  try {
    const { data, error } = await serverClient().schema('activities').rpc('upcoming_events');
    if (error) throw error;
    events = (data ?? []) as PublicEvent[];
  } catch { failed = true; }
  const committees = committeeMap(await getBodies().catch(() => []));
  return (
    <>
      <PageHero title="Events" intro="What is coming up across MedSoc. Open to everyone unless marked “Students only”; you only sign in when you RSVP." />
      <section className="band band-pale band-last" style={{ zIndex: 20 }}>
        <div className="mx-auto max-w-6xl px-4">
          {failed ? <p className="rounded-lg bg-red-100 px-3 py-2 text-bad">Events could not be loaded right now. Please try again in a minute.</p> : <EventsBrowser events={events} committees={committees} />}
        </div>
      </section>
    </>
  );
}
