import { sanitizeBody } from './markdown';

// Plasmic CMS, table "page" with fields title, slug, body. Reads published text only (public token).
const ID = process.env.PLASMIC_CMS_ID;
const TOKEN = process.env.PLASMIC_CMS_PUBLIC_TOKEN;

export type CmsPage = { title: string; html: string };

/** One page by its address (e.g. "about/alumni"), or null when there is none, it is empty, or Plasmic cannot be reached. */
export async function getCmsPage(slug: string): Promise<CmsPage | null> {
  if (!ID || !TOKEN) return null;
  try {
    const q = encodeURIComponent(JSON.stringify({ where: { slug }, limit: 1 }));
    const res = await fetch(`https://data.plasmic.app/api/v1/cms/databases/${ID}/tables/page/query?q=${q}`, {
      headers: { 'x-plasmic-api-cms-tokens': `${ID}:${TOKEN}` },
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const rows = ((await res.json()) as { rows?: { data?: Record<string, unknown> }[] }).rows ?? [];
    const raw = rows[0]?.data;
    if (!raw) return null;
    const d = (typeof raw[''] === 'object' && raw[''] ? raw[''] : raw) as { title?: string; body?: string };
    const html = sanitizeBody(typeof d.body === 'string' ? d.body : '');
    if (!html.replace(/<[^>]*>/g, '').trim()) return null;
    return { title: (d.title ?? '').trim(), html };
  } catch { return null; }
}
