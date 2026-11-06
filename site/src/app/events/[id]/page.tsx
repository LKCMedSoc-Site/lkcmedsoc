import type { Metadata } from 'next';
import { serverClient } from '@/lib/supabase';
import EventView from '@/components/EventView';
import type { PublicEvent } from '@/lib/events';
import { whenText } from '@/lib/dates';

export const revalidate = 60;
type Props = { params: Promise<{ id: string }> };

async function load(id: string): Promise<PublicEvent | null> {
  try {
    const { data } = await serverClient().schema('activities').rpc('public_event', { aid: id });
    return (data as PublicEvent | null) ?? null;
  } catch { return null; }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const ev = await load((await params).id);
  return ev ? { title: ev.title, description: `${whenText(ev)}${ev.venue ? ' · ' + ev.venue : ''}` } : { title: 'Event' };
}

// The server draws the public version (good for search and link previews); the browser then reloads it with the
// student's sign-in to show members-only events and their own RSVP.
export default async function EventPage({ params }: Props) {
  const { id } = await params;
  return <EventView id={id} initial={await load(id)} />;
}
