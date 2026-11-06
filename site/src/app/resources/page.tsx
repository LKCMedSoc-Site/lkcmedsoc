import type { Metadata } from 'next';
import Link from 'next/link';
import { getPageRendered } from '@/lib/content';
import { TILE_GROUPS } from '@/lib/students-corner';
import PageHero from '@/components/blocks/PageHero';
import { ArrowUpRight } from 'lucide-react';

export const metadata: Metadata = { title: 'Resources' };
export const revalidate = 60;

// Intro text comes from the CMS page "students-corner"; the tiles come from src/lib/students-corner.ts.
export default async function Resources() {
  const page = await getPageRendered('students-corner');
  return (
    <>
      <PageHero title="Resources" intro="Tools and documents for organising events, running a CCA and having your say." />
      <section className="band band-pale band-last" style={{ zIndex: 20 }}>
        <div className="mx-auto max-w-6xl space-y-12 px-4 md:space-y-16">
          {page?.html ? <div className="prose-lkc" dangerouslySetInnerHTML={{ __html: page.html }} /> : null}
          {TILE_GROUPS.map((g) => (
            <div key={g.title}>
              <h2 className="h-xl">{g.title}</h2>
              <ul className="mt-5 grid gap-3 md:grid-cols-3">
                {g.tiles.map((t) => {
                  const ext = /^https?:/.test(t.href);
                  const inner = <><span className="min-w-0"><span className="row-title block text-xl font-bold text-p900">{t.label}</span><span className="mt-1 block text-sm text-muted">{t.note}</span></span>{ext ? <ArrowUpRight aria-hidden className="row-arrow h-6 w-6 shrink-0 text-p500" /> : <span aria-hidden className="row-arrow display text-3xl text-p500">→</span>}</>;
                  const cls = 'row-link group flex h-full items-start justify-between gap-3 bg-white p-5 no-underline transition-colors hover:bg-mist md:p-6';
                  return <li key={t.label} className="overflow-hidden rounded-xl border border-p900/15 bg-white">{ext ? <a href={t.href} target="_blank" rel="noopener" className={cls}>{inner}</a> : <Link href={t.href} className={cls}>{inner}</Link>}</li>;
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
