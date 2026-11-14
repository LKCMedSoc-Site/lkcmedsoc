'use client';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { DataProvider } from '@plasmicapp/loader-nextjs';
import { browserClient } from '@/lib/supabase';
import { fetchBodies, fetchLeaders } from '@/lib/records-client';
import { normalise, type Post } from '@/lib/posts';
import type { Body, Leader } from '@/lib/records';
import type { PublicEvent } from '@/lib/events';
import { renderGroupMarkdown } from '@/lib/markdown';
import { buildGroupPage } from '@/lib/group-page';
import { groupsOf, slugify } from '@/lib/records';
import { useHubSeed } from '@/components/hubs/HubSeed';

export type GroupPageHubProps = { children?: ReactNode; className?: string; committee?: string; body?: string };
type State = { bodies: Body[]; leaders: Leader[]; ay: string; events: PublicEvent[]; posts: Post[] };

// Loads one student group (its details, colour, write-up, icon links, leaders, upcoming events, news and the other groups in its committee).
// It draws nothing itself: Studio gets $ctx.groupPage. On a page at /student-groups/[committee]/[body], set the two settings to
// $ctx.params.committee and $ctx.params.body. With nothing set it shows the first group with a header picture, so there is something to design against.
export default function GroupPageHub({ children, className = '', committee = '', body = '' }: GroupPageHubProps) {
  const seed = useHubSeed();
  const [state, setState] = useState<State | null>(() => (seed?.bodies && seed.leaders ? { bodies: seed.bodies, leaders: seed.leaders, ay: seed.ay ?? '', events: seed.events ?? [], posts: seed.posts ?? [] } : null));
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (state) return; // already seeded by the server
    let off = false;
    (async () => {
      const [bodies, lead, ev, posts] = await Promise.all([
        fetchBodies(),
        fetchLeaders().catch(() => ({ ay: '', leaders: [] as Leader[] })),
        browserClient().schema('activities').rpc('upcoming_events').then((r) => (r.error ? [] : ((r.data ?? []) as PublicEvent[]))),
        browserClient().schema('activities').rpc('public_posts', { p_limit: 60, p_offset: 0, p_category: null, p_activity: null }).then((r) => (r.error ? [] : (((r.data as { items?: unknown[] } | null)?.items ?? []) as unknown[]).map(normalise))),
      ]);
      if (!off) setState({ bodies, leaders: lead.leaders, ay: lead.ay, events: ev, posts });
    })().catch(() => { if (!off) setFailed(true); });
    return () => { off = true; };
  }, [state]);

  const data = useMemo(() => {
    if (!state) return buildGroupPage({ bodies: [], leaders: [], ay: '', events: [], posts: [], committee: '', body: '', renderAbout: renderGroupMarkdown, loading: !failed });
    let c = committee, b = body;
    if (!c || !b) { // designing: show a real group so the layout has content
      const pick = groupsOf(state.bodies).flatMap((g) => g.ccas.map((x) => ({ g, x }))).find((e) => e.x.header && e.x.about) ?? groupsOf(state.bodies).flatMap((g) => g.ccas.map((x) => ({ g, x })))[0];
      if (pick) { c = pick.g.slug; b = slugify(pick.x.name); }
    }
    return buildGroupPage({ ...state, committee: c, body: b, renderAbout: renderGroupMarkdown });
  }, [state, committee, body, failed]);
  return <DataProvider name="groupPage" data={data}><div className={className}>{children}</div></DataProvider>;
}
