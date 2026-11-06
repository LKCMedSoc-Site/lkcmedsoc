'use client';
import { useEffect, useState } from 'react';
import { browserClient } from '@/lib/supabase';
import type { PublicEvent } from '@/lib/events';
import EventCard from './EventCard';

/** Upcoming public events. Used inside Plasmic pages; reads public data only. */
export default function LiveEvents({ count = 10, className }: { count?: number; className?: string }) {
  const [events, setEvents] = useState<PublicEvent[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let off = false;
    browserClient().schema('activities').rpc('upcoming_events').then(({ data, error }) => {
      if (off) return;
      if (error) { setFailed(true); return; }
      setEvents(((data ?? []) as PublicEvent[]).slice(0, count));
    });
    return () => { off = true; };
  }, [count]);

  if (failed) return <p className={className}>Events could not be loaded right now.</p>;
  if (!events) return <p className={`text-muted ${className ?? ''}`}>Loading events…</p>;
  if (!events.length) return <p className={`text-muted ${className ?? ''}`}>No upcoming events are open right now. Check back soon.</p>;
  return <div className={`grid gap-3 ${className ?? ''}`}>{events.map((ev) => <EventCard key={ev.id} ev={ev} />)}</div>;
}
