import { getCmsPage } from './cms';
import { renderMarkdown } from './markdown';
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.join(process.cwd(), 'content');
export type Page = { slug: string; title: string; body: string };

/** Plain markdown files with a small "---" header. Used as the fallback when the Plasmic CMS has no entry for the page. */
export function getPage(slug: string): Page | null {
  if (!/^[a-z0-9-]+(\/[a-z0-9-]+)*$/.test(slug)) return null;
  const file = path.join(DIR, ...slug.split('/')) + '.md';
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, 'utf8');
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  const head = m ? m[1] : ''; const body = m ? m[2] : raw;
  const title = /^title:\s*"?(.*?)"?\s*$/m.exec(head)?.[1] ?? slug;
  return { slug, title, body };
}

export type RenderedPage = { slug: string; title: string; html: string };

/** Words from the Plasmic CMS when there is an entry for this address, otherwise from the file in /content. */
export async function getPageRendered(slug: string): Promise<RenderedPage | null> {
  if (!/^[a-z0-9-]+(\/[a-z0-9-]+)*$/.test(slug)) return null;
  const file = getPage(slug);
  const cms = await getCmsPage(slug);
  if (cms) return { slug, title: cms.title || file?.title || slug, html: cms.html };
  return file ? { slug, title: file.title, html: renderMarkdown(file.body) } : null;
}
