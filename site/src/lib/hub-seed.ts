import { getBodies, getLeaders, slugify, type Body, type Leader } from './records';
import { serverClient } from './supabase';
import { getCategories, listPosts, type Category, type Post } from './posts';
import type { PublicEvent } from './events';
import { getHonour, type HonourData } from './honour';
import { loadHouseCup, type HouseCupYear } from './house-cup';

/**
 * The public data the Plasmic hubs start with, fetched on the server so a page designed in Plasmic is rendered with live content in its
 * first HTML (no loading state, and search engines see it). Each part is only fetched when the page actually uses a hub that needs it, and a
 * part that fails is simply left out: that hub then loads its own data in the browser as before.
 */
export type HubSeed = { bodies?: Body[]; leaders?: Leader[]; ay?: string; events?: PublicEvent[]; posts?: Post[]; categories?: Category[]; honour?: HonourData; cups?: HouseCupYear[]; rand: number };

async function fetchEvents(): Promise<PublicEvent[] | undefined> {
  try {
    const r = await serverClient().schema('activities').rpc('upcoming_events');
    return r.error ? undefined : ((r.data ?? []) as PublicEvent[]);
  } catch { return undefined; }
}

function pageParam(designJson: string, name: string): string {
  try { const d = JSON.parse(designJson) as { entryCompMetas?: { params?: Record<string, string> }[] }; return d.entryCompMetas?.[0]?.params?.[name] ?? ''; } catch { return ''; }
}

export async function getHubSeed(designJson: string): Promise<HubSeed | null> {
  const uses = (name: string) => designJson.includes(name);
  const groups = uses('GroupsHub'), events = uses('EventsHub'), news = uses('NewsHub'), people = uses('PeopleHub');
  const groupOne = uses('GroupPageHub'), honourUse = uses('HonourHub'), bodyUse = uses('CommitteePageHub') || uses('HousePageHub') || uses('HousesHub'), cupUse = uses('HousePageHub') || uses('HousesHub');
  if (!groups && !events && !news && !people && !groupOne && !honourUse && !bodyUse) return null;
  const [bodies, lead, ev, posts, categories, honour, cups] = await Promise.all([
    getBodies().catch(() => undefined),
    groups || people || groupOne || bodyUse ? getLeaders().catch(() => undefined) : undefined,
    events || groupOne || bodyUse ? fetchEvents() : undefined,
    news || groupOne || bodyUse ? listPosts({ limit: 60 }).then((r) => r.items).catch(() => undefined) : undefined,
    news ? getCategories().catch(() => undefined) : undefined,
    honourUse ? getHonour(pageParam(designJson, 'ay')).catch(() => undefined) : undefined,
    cupUse ? loadHouseCup(serverClient()).catch(() => undefined) : undefined,
  ]);
  return {
    // The long write-ups are not needed by the hubs; keep the page light. A single group's page keeps its own write-up.
    bodies: bodies?.map((b) => ((groupOne && slugify(b.name) === pageParam(designJson, 'body')) || (bodyUse && [pageParam(designJson, 'committee'), pageParam(designJson, 'house')].includes(slugify(b.name))) ? b : { ...b, about: null })),
    leaders: lead?.leaders, ay: lead?.ay, events: ev, posts, categories, honour, cups, rand: Math.random(),
  };
}
