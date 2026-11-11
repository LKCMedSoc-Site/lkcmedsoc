import { serverClient, photoUrl } from './supabase';

export const CATEGORIES = ['Impact', 'Events', 'Announcements', 'Stories'] as const;

export type Post = {
  slug: string; title: string; category: string; summary: string; published_at: string;
  author: string; bodyName: string; ay: string;
  featured: boolean; tags: string[];
  cover: string; body: string; photos: { url: string; caption: string }[]; event: { id: string; title: string } | null;
};

// The exact column names come from activities_posts.sql, which I haven't seen: accept the likely spellings.
/* eslint-disable @typescript-eslint/no-explicit-any */
export function normalise(r: any): Post {
  const photos = ((r.photos ?? []) as any[]).map((p) => ({
    url: photoUrl(typeof p === 'string' ? p : p.path ?? p.url), caption: typeof p === 'string' ? '' : p.caption ?? p.alt ?? '',
  })).filter((p) => p.url);
  const coverPath = r.cover_path ?? r.cover_photo ?? r.cover ?? r.cover_image;
  return {
    slug: r.slug, title: r.title, category: r.category ?? '',
    ay: typeof r.ay === 'string' ? r.ay : '',
    author: typeof r.author === 'string' ? r.author : '',      // only set when the author ticked "show my name"
    bodyName: typeof r.body === 'string' ? r.body : '',        // the society / committee the post is from
    summary: r.summary ?? r.excerpt ?? r.blurb ?? '',
    published_at: r.published_at ?? r.created_at ?? '',
    cover: coverPath ? photoUrl(coverPath) : photos[0]?.url ?? '',
    body: r.body_md ?? '',
    featured: r.featured === true, tags: Array.isArray(r.tags) ? (r.tags as unknown[]).map(String) : [],
    photos, event: r.event ?? null,
  };
}

export async function listPosts(opts: { limit?: number; offset?: number; category?: string | null; activity?: string | null; ay?: string | null } = {}) {
  const act = serverClient().schema('activities');
  const { data, error } = opts.ay
    ? await act.rpc('public_posts_ay', { p_ay: opts.ay, p_limit: opts.limit ?? 12, p_offset: opts.offset ?? 0, p_category: opts.category ?? null })
    : await act.rpc('public_posts', { p_limit: opts.limit ?? 12, p_offset: opts.offset ?? 0, p_category: opts.category ?? null, p_activity: opts.activity ?? null });
  if (error) throw error;
  const d = data as { total: number; items: unknown[] } | null;
  return { total: d?.total ?? 0, items: (d?.items ?? []).map(normalise) };
}

/** Years that have published posts (empty until ay_layer.sql has been run). */
export async function getPostYears(): Promise<{ ay: string; n: number }[]> {
  try {
    const { data } = await serverClient().schema('activities').rpc('public_post_years');
    return (data as { ay: string; n: number }[] | null) ?? [];
  } catch { return []; }
}
export async function getPostAy(slug: string): Promise<string> {
  try { const { data } = await serverClient().schema('activities').rpc('public_post_ay', { p_slug: slug }); return (data as string | null) ?? ''; } catch { return ''; }
}

export async function getPost(slug: string): Promise<Post | null> {
  const { data, error } = await serverClient().schema('activities').rpc('public_post', { p_slug: slug });
  if (error) throw error;
  return data ? normalise(data) : null;
}

/** Category pages live at /gazette/<slug>. "Events" reads as "Event write-ups" in the menu so it does not clash with the Events page. */
export const CATEGORY_SLUG: Record<string, string> = { Impact: 'impact', Events: 'events', Announcements: 'announcements', Stories: 'stories' };
export const CATEGORY_LABEL: Record<string, string> = { Impact: 'Impact', Events: 'Event write-ups', Announcements: 'Announcements', Stories: 'Stories' };
export const CATEGORY_BLURB: Record<string, string> = {
  Impact: 'What MedSoc and its groups have achieved, and for whom.',
  Events: 'Write-ups and photos from events across the year.',
  Announcements: 'News, calls for applicants and changes you should know about.',
  Stories: 'Voices and experiences from our students.',
};
export const categoryFromSlug = (slug: string) => CATEGORIES.find((c) => CATEGORY_SLUG[c] === slug) ?? null;

export type GazetteHome = { featured: Post[]; latest: Post[]; categories: { category: string; total: number; items: Post[] }[]; years: { ay: string; n: number }[] };

/**
 * Everything the Gazette home needs, from one database call (activities.public_gazette_home, sql/gazette_public.sql).
 * Until that file has been run it is built from the ordinary list call instead: the page looks the same, minus the featured picks.
 */
export async function getGazetteHome(): Promise<GazetteHome> {
  const act = serverClient().schema('activities');
  const r = await act.rpc('public_gazette_home', { p_featured: 4, p_latest: 8, p_per_category: 4 });
  if (!r.error && r.data) {
    const d = r.data as { featured?: unknown[]; latest?: unknown[]; categories?: { category: string; total: number; items: unknown[] }[]; years?: { ay: string; n: number }[] };
    return {
      featured: (d.featured ?? []).map(normalise), latest: (d.latest ?? []).map(normalise),
      categories: (d.categories ?? []).map((c) => ({ category: c.category, total: c.total, items: c.items.map(normalise) })), years: d.years ?? [],
    };
  }
  const [all, years] = await Promise.all([listPosts({ limit: 50 }), getPostYears()]);
  const items = all.items;
  return {
    featured: [], latest: items.slice(0, 8),
    categories: CATEGORIES.map((c) => { const mine = items.filter((p) => p.category === c); return { category: c, total: mine.length, items: mine.slice(0, 4) }; }),
    years,
  };
}
