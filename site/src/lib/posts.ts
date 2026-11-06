import { serverClient, photoUrl } from './supabase';

export const CATEGORIES = ['Impact', 'Events', 'Announcements', 'Stories'] as const;

export type Post = {
  slug: string; title: string; category: string; summary: string; published_at: string;
  author: string; bodyName: string; ay: string;
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
