import { getBodies, getLeaders, type Body, type Leader } from './records';
import { serverClient } from './supabase';
import { getCategories, listPosts, type Category, type Post } from './posts';
import type { PublicEvent } from './events';

/**
 * The public data the Plasmic hubs start with, fetched on the server so a page designed in Plasmic is rendered with live content in its
 * first HTML (no loading state, and search engines see it). Each part is only fetched when the page actually uses a hub that needs it, and a
 * part that fails is simply left out: that hub then loads its own data in the browser as before.
 */
export type HubSeed = { bodies?: Body[]; leaders?: Leader[]; ay?: string; events?: PublicEvent[]; posts?: Post[]; categories?: Category[]; rand: number };

async function fetchEvents(): Promise<PublicEvent[] | undefined> {
  try {
    const r = await serverClient().schema('activities').rpc('upcoming_events');
    return r.error ? undefined : ((r.data ?? []) as PublicEvent[]);
  } catch { return undefined; }
}

export async function getHubSeed(designJson: string): Promise<HubSeed | null> {
  const uses = (name: string) => designJson.includes(name);
  const groups = uses('GroupsHub'), events = uses('EventsHub'), news = uses('NewsHub'), people = uses('PeopleHub');
  if (!groups && !events && !news && !people) return null;
  const [bodies, lead, ev, posts, categories] = await Promise.all([
    getBodies().catch(() => undefined),
    groups || people ? getLeaders().catch(() => undefined) : undefined,
    events ? fetchEvents() : undefined,
    news ? listPosts({ limit: 60 }).then((r) => r.items).catch(() => undefined) : undefined,
    news ? getCategories().catch(() => undefined) : undefined,
  ]);
  return {
    bodies: bodies?.map((b) => ({ ...b, about: null })), // the long write-ups are not needed by the hubs; keep the page light
    leaders: lead?.leaders, ay: lead?.ay, events: ev, posts, categories, rand: Math.random(),
  };
}
