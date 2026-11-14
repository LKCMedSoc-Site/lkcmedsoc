'use client';
import { useSelector } from '@plasmicapp/loader-nextjs';
import EventView from '@/components/EventView';

/** The event page's working parts for the lightbox: add to calendar, RSVP (sign in or guest) and the ticket QR. Reads the selected event. */
export default function EventActions({ event, className = '' }: { event?: { id?: string } | null; className?: string }) {
  const hub = useSelector('eventsHub') as { selected?: { id?: string } | null } | undefined;
  const id = event?.id ?? hub?.selected?.id;
  if (!id) return <div className={`text-sm text-muted ${className}`}>RSVP and calendar buttons appear here for the selected event.</div>;
  return <div className={className}><EventView key={id} id={id} initial={null} bare /></div>;
}
