import type { Metadata } from 'next';
import Link from 'next/link';
import { CATEGORIES, getPostYears, listPosts } from '@/lib/posts';
import { exco, isAy } from '@/lib/ay';
import { committeeMap, committeesOf, getBodies } from '@/lib/records';
import PageHero from '@/components/blocks/PageHero';
import NewsCard from '@/components/NewsCard';

export const metadata: Metadata = { title: 'News' };
export const revalidate = 60;
const PER_PAGE = 12;

type SP = { category?: string; page?: string; ay?: string; committee?: string };
const select = 'h-10 max-w-full rounded-full border border-p900/25 bg-white px-3 text-sm font-bold text-p900';

export default async function NewsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const category = (CATEGORIES as readonly string[]).includes(sp.category ?? '') ? sp.category! : null;
  const ay = sp.ay && isAy(sp.ay) ? sp.ay : null;
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);
  const bodies = await getBodies().catch(() => []);
  const committees = committeesOf(bodies);
  const committee = committees.find((c) => c.name === sp.committee)?.name ?? null;
  const cmap = committeeMap(bodies);

  let posts: Awaited<ReturnType<typeof listPosts>> = { total: 0, items: [] }; let failed = false;
  const [years] = await Promise.all([getPostYears(), (async () => {
    try {
      if (committee) {
        // The database has no committee filter, so fetch a wide window and filter here.
        const all = await listPosts({ limit: 200, category, ay });
        const items = all.items.filter((p) => cmap[p.bodyName] === committee);
        posts = { total: items.length, items: items.slice((page - 1) * PER_PAGE, page * PER_PAGE) };
      } else posts = await listPosts({ limit: PER_PAGE, offset: (page - 1) * PER_PAGE, category, ay });
    } catch { failed = true; }
  })()]);
  const pages = Math.max(1, Math.ceil(posts.total / PER_PAGE));
  const q = (p: number, c: string | null, y: string | null, k: string | null) => {
    const qs = new URLSearchParams({ ...(c ? { category: c } : {}), ...(y ? { ay: y } : {}), ...(k ? { committee: k } : {}), ...(p > 1 ? { page: String(p) } : {}) }).toString();
    return qs ? `/news?${qs}` : '/news';
  };
  const lead = page === 1 ? posts.items[0] : undefined;
  const rest = lead ? posts.items.slice(1) : posts.items;

  return (
    <>
      <section className="band band-plum" style={{ zIndex: 30 }}>
        <div className="mx-auto max-w-6xl px-4">
          <h1 className="hero-title text-white !text-[clamp(3rem,9vw,7rem)]">News</h1>
          <p className="mt-3 max-w-xl text-lg text-mist">Stories, announcements and write-ups from every corner of MedSoc.</p>
          {lead && !failed ? <div className="mt-10 md:mt-14"><NewsCard post={lead} size="feature" priority /></div> : null}
        </div>
      </section>

      <section className="band band-pale band-last" style={{ zIndex: 20 }}>
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <nav aria-label="Categories" className="flex flex-wrap gap-2">
              {[null, ...CATEGORIES].map((c) => (
                <Link key={c ?? 'all'} href={q(1, c, ay, committee)} className={`press rounded-full border px-3.5 py-1.5 text-sm font-bold no-underline ${c === category ? 'border-p950 bg-p950 text-white' : 'border-p900/25 bg-white text-p900 hover:border-p900'}`}>{c ?? 'All'}</Link>
              ))}
            </nav>
            {/* Plain form, works without JavaScript */}
            <form action="/news" method="get" className="flex flex-wrap items-center gap-2">
              {category ? <input type="hidden" name="category" value={category} /> : null}
              <label><span className="sr-only">Committee</span>
                <select name="committee" defaultValue={committee ?? ''} className={select}>
                  <option value="">All committees</option>
                  {committees.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
              </label>
              {years.length ? (
                <label><span className="sr-only">ExCo year</span>
                  <select name="ay" defaultValue={ay ?? ''} className={select}>
                    <option value="">All years</option>
                    {years.map((y) => <option key={y.ay} value={y.ay}>{y.ay} · {exco(y.ay)} ({y.n})</option>)}
                  </select>
                </label>
              ) : null}
              <button className="press h-10 rounded-full bg-p950 px-5 text-sm font-bold text-white hover:bg-p900">Filter</button>
              {(committee || ay || category) ? <Link href="/news" className="text-sm font-bold text-p500 underline">Clear</Link> : null}
            </form>
          </div>

          {failed ? <p className="mt-8 rounded-lg bg-red-100 px-3 py-2 text-bad">News could not be loaded right now. Please try again in a minute.</p>
            : posts.items.length ? (
              rest.length ? (
                <div className="mt-8 grid gap-5 md:grid-cols-6 md:gap-6">
                  {rest.map((p, i) => <div key={p.slug} className={i < 2 ? 'md:col-span-3' : 'md:col-span-2'}><NewsCard post={p} size={i < 2 ? 'wide' : 'card'} /></div>)}
                </div>
              ) : <p className="mt-8 text-muted">That is the only story here so far.</p>
            ) : <p className="mt-8 max-w-md text-lg text-muted">Nothing posted here yet{committee ? ` for the ${committee}` : ''}. Try another filter.</p>}

          {pages > 1 ? (
            <div className="mt-10 flex items-center justify-between text-sm font-bold">
              {page > 1 ? <Link className="press rounded-full border border-p900/25 bg-white px-4 py-2 text-p900 no-underline" href={q(page - 1, category, ay, committee)}>← Newer</Link> : <span />}
              <span className="text-muted">Page {page} of {pages}</span>
              {page < pages ? <Link className="press rounded-full border border-p900/25 bg-white px-4 py-2 text-p900 no-underline" href={q(page + 1, category, ay, committee)}>Older →</Link> : <span />}
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}
