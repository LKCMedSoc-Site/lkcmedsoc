import { serverClient, photoUrl } from './supabase';

/** A post category. ExCo manages the list in the Gazette app (activities.post_categories); the site reads it, so nothing here is a fixed list. */
export type SubCategory = { name: string; slug: string; blurb: string };
export type Category = { name: string; slug: string; blurb: string; tone: number; children?: SubCategory[] };
/** Used only if the database cannot be reached. */
export const DEFAULT_CATEGORIES: Category[] = [
  { name: 'Announcements', slug: 'announcements', blurb: 'News, calls for applicants and changes you should know about.', tone: 2 },
  { name: 'Activities', slug: 'activities', blurb: 'Recaps, trip and project write-ups, and photos from what we have been doing.', tone: 0 },
  { name: 'Publications', slug: 'publications', blurb: 'Quarterly updates, newsletters and reports from MedSoc.', tone: 3 },
  { name: 'Creative', slug: 'creative', blurb: 'Features, narrative pieces, art and series like Humans of Med.', tone: 1 },
];
/** The eight tag colours a category can take (deepened brand purples, all with white text). The database stores which one as a number. */
export const TONES = ['#8e2a88', '#9a5d94', '#6d4aa8', '#4d0a49', '#7a3a9e', '#a0457f', '#5b3a8c', '#b0508a'];
export const toneColor = (tone: number | null | undefined) => TONES[(((tone ?? 0) % TONES.length) + TONES.length) % TONES.length];

export type Post = {
  slug: string; title: string; category: string; categorySlug: string; categoryTone: number; subcategory: string; subcategorySlug: string; summary: string; published_at: string;
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
    slug: r.slug, title: r.title, category: r.category ?? '', categorySlug: typeof r.category_slug === 'string' ? r.category_slug : '', categoryTone: typeof r.category_tone === 'number' ? r.category_tone : 0, subcategory: typeof r.subcategory === 'string' ? r.subcategory : '', subcategorySlug: typeof r.subcategory_slug === 'string' ? r.subcategory_slug : '',
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

/** Posts in one sub-category (activities.public_posts_sub, sql/post_subcategories.sql). */
export async function listPostsBySub(category: string, sub: string, opts: { limit?: number; offset?: number } = {}) {
  const { data, error } = await serverClient().schema('activities').rpc('public_posts_sub', { p_category: category, p_sub: sub, p_limit: opts.limit ?? 12, p_offset: opts.offset ?? 0 });
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

export const categoryBySlug = (list: Category[], slug: string) => list.find((c) => c.slug === slug) ?? null;

/** The visible categories in order, from activities.public_categories (sql/post_categories.sql). */
export async function getCategories(): Promise<Category[]> {
  try {
    const { data, error } = await serverClient().schema('activities').rpc('public_categories');
    const rows = (data as { name: string; slug: string; blurb: string | null; tone: number; children?: { name: string; slug: string; blurb: string | null }[] }[] | null) ?? [];
    if (!error && rows.length) return rows.map((c) => ({ name: c.name, slug: c.slug, blurb: c.blurb ?? '', tone: c.tone ?? 0, children: (c.children ?? []).map((k) => ({ name: k.name, slug: k.slug, blurb: k.blurb ?? '' })) }));
  } catch { /* use the default list */ }
  return DEFAULT_CATEGORIES;
}

export type GazetteHome = { featured: Post[]; latest: Post[]; categories: { category: string; slug: string; blurb: string; tone: number; total: number; items: Post[] }[]; years: { ay: string; n: number }[] };

/**
 * Everything the Gazette home needs, from one database call (activities.public_gazette_home, sql/gazette_public.sql).
 * Until that file has been run it is built from the ordinary list call instead: the page looks the same, minus the featured picks.
 */
export async function getGazetteHome(): Promise<GazetteHome> {
  const act = serverClient().schema('activities');
  const r = await act.rpc('public_gazette_home', { p_featured: 4, p_latest: 8, p_per_category: 4 });
  if (!r.error && r.data) {
    const d = r.data as { featured?: unknown[]; latest?: unknown[]; categories?: { category: string; slug: string; blurb: string | null; tone: number; total: number; items: unknown[] }[]; years?: { ay: string; n: number }[] };
    return {
      featured: (d.featured ?? []).map(normalise), latest: (d.latest ?? []).map(normalise),
      categories: (d.categories ?? []).map((c) => ({ category: c.category, slug: c.slug, blurb: c.blurb ?? '', tone: c.tone ?? 0, total: c.total, items: c.items.map(normalise) })), years: d.years ?? [],
    };
  }
  const [all, years] = await Promise.all([listPosts({ limit: 50 }), getPostYears()]);
  const items = all.items;
  return {
    featured: [], latest: items.slice(0, 8),
    categories: DEFAULT_CATEGORIES.map((c) => { const mine = items.filter((p) => p.category === c.name); return { category: c.name, slug: c.slug, blurb: c.blurb, tone: c.tone, total: mine.length, items: mine.slice(0, 4) }; }),
    years,
  };
}
