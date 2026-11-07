'use client';
import { useEffect, useState } from 'react';
import { browserClient } from '@/lib/supabase';
import { fetchBodies } from '@/lib/records-client';
import { committeeMap } from '@/lib/records';
import type { PublicEvent } from '@/lib/events';
import EventsBrowser from '@/components/EventsBrowser';

// Every upcoming event with search, committee, month and RSVP filters. Loads its own data, so it works on any page designed in Plasmic.
export default function EventsBlock({ className = '' }: { className?: string }) {
  const [state, setState] = useState<{ events: PublicEvent[]; committees: Record<string, string>; failed: boolean } | null>(null);
  useEffect(() => {
    let off = false;
    (async () => {
      try {
        const [ev, bodies] = await Promise.all([browserClient().schema('activities').rpc('upcoming_events'), fetchBodies().catch(() => [])]);
        if (ev.error) throw ev.error;
        if (!off) setState({ events: (ev.data ?? []) as PublicEvent[], committees: committeeMap(bodies), failed: false });
      } catch { if (!off) setState({ events: [], committees: {}, failed: true }); }
    })();
    return () => { off = true; };
  }, []);
  if (!state) return <p className={`text-muted ${className}`}>Loading events…</p>;
  if (state.failed) return <p className={`rounded-lg bg-red-100 px-3 py-2 text-bad ${className}`}>Events could not be loaded right now. Please try again in a minute.</p>;
  return <div className={className}><EventsBrowser events={state.events} committees={state.committees} /></div>;
}
