import type { Metadata } from 'next';
import { serverClient } from '@/lib/supabase';
import EventCard from '@/components/EventCard';
import type { PublicEvent } from '@/lib/events';

export const metadata: Metadata = { title: 'Events' };
export const revalidate = 60;

export default async function EventsPage() {
  let events: PublicEvent[] = []; let failed = false;
  try {
    const { data, error } = await serverClient().schema('activities').rpc('upcoming_events');
    if (error) throw error;
    events = (data ?? []) as PublicEvent[];
  } catch { failed = true; }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="display text-5xl">Upcoming events</h1>
      <p className="mt-2 text-muted">Open to everyone unless marked &ldquo;NTU students&rdquo;. You only sign in when you RSVP.</p>
      <div className="mt-6 grid gap-3">
        {failed ? <p className="rounded-lg bg-red-100 px-3 py-2 text-bad">Events could not be loaded right now. Please try again in a minute.</p>
          : events.length ? events.map((ev) => <EventCard key={ev.id} ev={ev} />)
          : <p className="text-muted">No upcoming events are open right now. Check back soon.</p>}
      </div>
    </div>
  );
}
