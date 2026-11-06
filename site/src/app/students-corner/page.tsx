import type { Metadata } from 'next';
import { getPageRendered } from '@/lib/content';
import { TILE_GROUPS } from '@/lib/students-corner';

export const metadata: Metadata = { title: "Students' Corner" };
export const revalidate = 60;

// The intro text comes from the page "students-corner" in the CMS; the tiles come from src/lib/students-corner.ts.
export default async function StudentsCorner() {
  const page = await getPageRendered('students-corner');
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="display text-5xl">Students&rsquo; Corner</h1>
      {page?.html ? <div className="prose-lkc mt-3 max-w-2xl" dangerouslySetInnerHTML={{ __html: page.html }} /> : null}
      <div className="mt-8 space-y-10">
        {TILE_GROUPS.map((g) => (
          <section key={g.title}>
            <h2 className="display text-3xl">{g.title}</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {g.tiles.map((t) => (
                <a key={t.label} href={t.href} className="rounded-xl border border-line bg-p50 p-5 no-underline transition hover:border-p500">
                  <h3 className="display text-2xl">{t.label}</h3>
                  <p className="mt-1 text-sm text-muted">{t.note}</p>
                </a>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
