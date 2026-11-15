'use client';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { DataProvider } from '@plasmicapp/loader-nextjs';
import { browserClient } from '@/lib/supabase';
import { fetchBodies, fetchLeaders } from '@/lib/records-client';
import { normalise, type Post } from '@/lib/posts';
import type { Body, Leader } from '@/lib/records';
import { committeesOf, slugify } from '@/lib/records';
import type { PublicEvent } from '@/lib/events';
import { renderGroupMarkdown } from '@/lib/markdown';
import { buildBodyPage, buildHousesHub } from '@/lib/body-page';
import { loadHouseCup, type HouseCupYear } from '@/lib/house-cup';
import { useHubSeed } from './HubSeed';

type State = { bodies: Body[]; leaders: Leader[]; ay: string; events: PublicEvent[]; posts: Post[]; cups: HouseCupYear[] };
type Props = { children?: ReactNode; className?: string };

// Shared by the committee, house and house-system hubs: loads every body, the leaders, upcoming events and news (server-seeded when possible).
function useState_(): { state: State | null; failed: boolean } {
  const seed = useHubSeed();
  const [state, setState] = useState<State | null>(() => (seed?.bodies && seed.leaders ? { bodies: seed.bodies, leaders: seed.leaders, ay: seed.ay ?? '', events: seed.events ?? [], posts: seed.posts ?? [], cups: seed.cups ?? [] } : null));
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (state) return;
    let off = false;
    (async () => {
      const [bodies, lead, ev, posts, cups] = await Promise.all([
        fetchBodies(),
        fetchLeaders().catch(() => ({ ay: '', leaders: [] as Leader[] })),
        browserClient().schema('activities').rpc('upcoming_events').then((r) => (r.error ? [] : ((r.data ?? []) as PublicEvent[]))),
        browserClient().schema('activities').rpc('public_posts', { p_limit: 60, p_offset: 0, p_category: null, p_activity: null }).then((r) => (r.error ? [] : (((r.data as { items?: unknown[] } | null)?.items ?? []) as unknown[]).map(normalise))),
        loadHouseCup(browserClient()).catch(() => [] as HouseCupYear[]),
      ]);
      if (!off) setState({ bodies, leaders: lead.leaders, ay: lead.ay, events: ev, posts, cups });
    })().catch(() => { if (!off) setFailed(true); });
    return () => { off = true; };
  }, [state]);
  return { state, failed };
}

/** One committee: $ctx.committeePage. On /about/committee/[committee] set the address to $ctx.params.committee. Empty shows the first committee. */
export function CommitteePageHub({ children, className = '', committee = '' }: Props & { committee?: string }) {
  const { state, failed } = useState_();
  const data = useMemo(() => {
    const empty = { bodies: [], leaders: [], ay: '', events: [], posts: [], cups: [] as HouseCupYear[] };
    const s = state ?? empty;
    const slug = committee || committeesOf(s.bodies)[0]?.slug || '';
    return buildBodyPage({ ...s, kind: 'committee', slug, renderAbout: renderGroupMarkdown, loading: !state && !failed });
  }, [state, committee, failed]);
  return <DataProvider name="committeePage" data={data}><div className={className}>{children}</div></DataProvider>;
}

/** One house: $ctx.housePage. On /about/house-system/[house] set the address to $ctx.params.house. Empty shows the first house. */
export function HousePageHub({ children, className = '', house = '' }: Props & { house?: string }) {
  const { state, failed } = useState_();
  const data = useMemo(() => {
    const empty = { bodies: [], leaders: [], ay: '', events: [], posts: [], cups: [] as HouseCupYear[] };
    const s = state ?? empty;
    const slug = house || slugify(s.bodies.filter((b) => b.level === 'House' && b.status === 'Active').sort((a, b) => a.name.localeCompare(b.name))[0]?.name ?? '');
    return buildBodyPage({ ...s, kind: 'house', slug, renderAbout: renderGroupMarkdown, loading: !state && !failed });
  }, [state, house, failed]);
  return <DataProvider name="housePage" data={data}><div className={className}>{children}</div></DataProvider>;
}

/** The house system overview: $ctx.housesHub. */
export function HousesHub({ children, className = '', intro = '', howItWorks = '' }: Props & { intro?: string; howItWorks?: string }) {
  const { state, failed } = useState_();
  const data = useMemo(() => buildHousesHub({ ...(state ?? { bodies: [], leaders: [], ay: '', events: [], posts: [], cups: [] as HouseCupYear[] }), intro, howItWorks, renderAbout: renderGroupMarkdown, loading: !state && !failed }), [state, intro, howItWorks, failed]);
  return <DataProvider name="housesHub" data={data}><div className={className}>{children}</div></DataProvider>;
}
