import type { Metadata } from 'next';
import Link from 'next/link';
import { getGazetteHome, type GazetteHome } from '@/lib/posts';
import { exco } from '@/lib/ay';
import { plasmicData, PlasmicView } from '@/lib/plasmic-page';
import GazetteNav from '@/components/gazette/GazetteNav';
import { LeadStory, SideStory, StoryCard } from '@/components/gazette/Stories';

export const metadata: Metadata = { title: 'Gazette', description: 'News, stories and updates from LKCMedSoc.' };
export const revalidate = 60;

export default async function GazettePage() {
  // A page designed in Plasmic at this path replaces the coded one below.
  const designed = await plasmicData('/gazette');
  if (designed) return <PlasmicView data={designed} />;
  let home: GazetteHome | null = null;
  try { home = await getGazetteHome(); } catch { /* shown below */ }
  const lead = home ? home.featured[0] ?? home.latest[0] : undefined;
  // Right-hand column: the other featured posts first, then the newest, up to five, never repeating the lead.
  const side = home ? [...home.featured.slice(1), ...home.latest].filter((p) => p.slug !== lead?.slug).slice(0, 5) : [];
  const sections = (home?.categories ?? []).filter((c) => c.items.length);

  return (
    <>
      <section className="band band-plum" style={{ zIndex: 30 }}>
        <div className="mx-auto max-w-6xl px-4">
          <p className="eyebrow eyebrow-light">LKCMedSoc</p>
          <h1 className="hero-title mt-2 text-white !text-[clamp(3.5rem,11vw,8rem)]">Gazette</h1>
          <p className="mt-3 max-w-xl text-lg text-mist">News, stories and updates from every corner of MedSoc.</p>
        </div>
      </section>
      <GazetteNav current="home" categories={(home?.categories ?? []).map((c) => ({ name: c.category, slug: c.slug, blurb: c.blurb, tone: c.tone }))} />

      <section className="band band-pale band-last" style={{ zIndex: 20 }}>
        <div className="mx-auto max-w-6xl px-4">
          {!home ? <p className="rounded-lg bg-red-100 px-3 py-2 text-bad">The Gazette could not be loaded right now. Please try again in a minute.</p>
            : !lead ? <p className="max-w-md text-lg text-muted">Nothing has been published yet. Check back soon.</p> : (
              <>
                <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
                  <div className="lg:col-span-8"><LeadStory post={lead} /></div>
                  <aside className="lg:col-span-4" aria-label="More stories">
                    <h2 className="eyebrow border-b-2 border-p950 pb-2 !text-p950">Also in the Gazette</h2>
                    <div className="mt-4 divide-y divide-line">{side.map((p) => <SideStory key={p.slug} post={p} />)}</div>
                  </aside>
                </div>

                {sections.map((c) => (
                  <section key={c.category} className="mt-16" aria-labelledby={`cat-${c.category}`}>
                    <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-p950 pb-2">
                      <div>
                        <h2 id={`cat-${c.category}`} className="text-2xl font-bold text-p950">{c.category}</h2>
                        {c.blurb ? <p className="text-sm text-muted">{c.blurb}</p> : null}
                      </div>
                      <Link href={`/gazette/${c.slug}`} className="link-arrow text-sm">All {c.total} →</Link>
                    </div>
                    <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{c.items.map((p) => <StoryCard key={p.slug} post={p} />)}</div>
                  </section>
                ))}

                {home.years.length ? (
                  <section className="mt-16 rounded-2xl bg-mist p-6 md:p-8" aria-labelledby="by-year">
                    <h2 id="by-year" className="text-2xl font-bold">Browse by year</h2>
                    <p className="mt-1 text-sm text-muted">Every post belongs to the ExCo that was in office when it was written.</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {home.years.map((y) => (
                        <Link key={y.ay} href={`/gazette/all?ay=${encodeURIComponent(y.ay)}`} className="press rounded-full border border-p900/25 bg-white px-3.5 py-1.5 text-sm font-bold text-p900 no-underline hover:border-p900">
                          {exco(y.ay)} · {y.ay} <span className="font-medium text-muted">({y.n})</span>
                        </Link>
                      ))}
                    </div>
                  </section>
                ) : null}

                <section className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-p950 p-6 text-white md:p-8">
                  <div><h2 className="text-2xl font-bold !text-white">Got something to share?</h2><p className="mt-1 text-mist">Write it up for the Gazette. A reviewer will look at it before it goes live.</p></div>
                  <a href="https://gazette.lkcmedsoc.com" className="press rounded-full bg-pink px-6 py-3 font-bold text-p950 no-underline hover:bg-white">Write for the Gazette</a>
                </section>
              </>
            )}
        </div>
      </section>
    </>
  );
}
