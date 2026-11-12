import Link from 'next/link';
import { getCategories, getPostYears, listPosts, listPostsBySub } from '@/lib/posts';
import { exco, isAy } from '@/lib/ay';
import { committeeMap, committeesOf, getBodies } from '@/lib/records';
import NewsCard from '@/components/NewsCard';
import GazetteNav from '@/components/gazette/GazetteNav';

const PER_PAGE = 12;

export type ListingSP = { category?: string; page?: string; ay?: string; committee?: string };
const select = 'h-10 max-w-full rounded-full border border-p900/25 bg-white px-3 text-sm font-bold text-p900';

/** The filtered list of posts. `basePath` is where the links point (/gazette/all or a category page); `fixedCategory` pins a category page. */
export default async function Listing({ sp, basePath, fixedCategory = null, fixedSub = null }: { sp: ListingSP; basePath: string; fixedCategory?: string | null; fixedSub?: string | null }) {
  const categories = await getCategories();
  const category = fixedCategory ?? (categories.find((c) => c.name === sp.category)?.name ?? null);
  const ay = sp.ay && isAy(sp.ay) ? sp.ay : null;
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);
  const bodies = await getBodies().catch(() => []);
  const committees = committeesOf(bodies);
  const committee = committees.find((c) => c.name === sp.committee)?.name ?? null;
  const cmap = committeeMap(bodies);
  const catInfo = categories.find((c) => c.name === category);
  const children = catInfo?.children ?? [];
  const subInfo = fixedSub ? children.find((k) => k.name === fixedSub) : undefined;

  let posts: Awaited<ReturnType<typeof listPosts>> = { total: 0, items: [] }; let failed = false;
  const [years] = await Promise.all([getPostYears(), (async () => {
    try {
      if (fixedCategory && fixedSub) {
        posts = await listPostsBySub(fixedCategory, fixedSub, { limit: PER_PAGE, offset: (page - 1) * PER_PAGE });
      } else if (committee) {
        // The database has no committee filter, so fetch a wide window and filter here.
        const all = await listPosts({ limit: 200, category, ay });
        const items = all.items.filter((p) => cmap[p.bodyName] === committee);
        posts = { total: items.length, items: items.slice((page - 1) * PER_PAGE, page * PER_PAGE) };
      } else posts = await listPosts({ limit: PER_PAGE, offset: (page - 1) * PER_PAGE, category, ay });
    } catch { failed = true; }
  })()]);
  const pages = Math.max(1, Math.ceil(posts.total / PER_PAGE));
  const q = (p: number, c: string | null, y: string | null, k: string | null) => {
    const qs = new URLSearchParams({ ...(c && !fixedCategory ? { category: c } : {}), ...(y ? { ay: y } : {}), ...(k ? { committee: k } : {}), ...(p > 1 ? { page: String(p) } : {}) }).toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const lead = page === 1 ? posts.items[0] : undefined;
  const rest = lead ? posts.items.slice(1) : posts.items;

  return (
    <>
      <section className="band band-plum" style={{ zIndex: 30 }}>
        <div className="mx-auto max-w-6xl px-4">
          <p className="eyebrow eyebrow-light"><Link href="/gazette" className="no-underline">Gazette</Link>{category && fixedSub ? <> · <Link href={`/gazette/${catInfo?.slug ?? ''}`} className="no-underline">{category}</Link></> : null}</p>
          <h1 className="hero-title mt-2 text-white !text-[clamp(3rem,9vw,7rem)]">{fixedSub ?? category ?? 'Archive'}</h1>
          <p className="mt-3 max-w-xl text-lg text-mist">{fixedSub ? subInfo?.blurb ?? '' : category ? catInfo?.blurb ?? '' : 'Every post, newest first. Filter by category, committee or year.'}</p>
          {lead && !failed ? <div className="mt-10 md:mt-14"><NewsCard post={lead} size="feature" priority /></div> : null}
        </div>
      </section>
      <GazetteNav current={category ?? 'all'} categories={categories} />

      <section className="band band-pale band-last" style={{ zIndex: 20 }}>
        <div className="mx-auto max-w-6xl px-4">
          {children.length ? (
            <nav aria-label="Sub-categories" className="mb-5 flex flex-wrap gap-2">
              {[null, ...children].map((k) => (
                <Link key={k?.slug ?? 'all'} href={k ? `${`/gazette/${catInfo?.slug}`}/${k.slug}` : `/gazette/${catInfo?.slug}`} className={`press rounded-full border px-3.5 py-1.5 text-sm font-bold no-underline ${(k?.name ?? null) === fixedSub ? 'border-p950 bg-p950 text-white' : 'border-p900/25 bg-white text-p900 hover:border-p900'}`}>{k?.name ?? `All ${category}`}</Link>
              ))}
            </nav>
          ) : null}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            {!fixedCategory ? <nav aria-label="Categories" className="flex flex-wrap gap-2">
              {[null, ...categories.map((x) => x.name)].map((c) => (
                <Link key={c ?? 'all'} href={q(1, c, ay, committee)} className={`press rounded-full border px-3.5 py-1.5 text-sm font-bold no-underline ${c === category ? 'border-p950 bg-p950 text-white' : 'border-p900/25 bg-white text-p900 hover:border-p900'}`}>{c ?? 'All'}</Link>
              ))}
            </nav> : null}
            {/* Plain form, works without JavaScript */}
            {!fixedSub ? <form action={basePath} method="get" className="flex flex-wrap items-center gap-2">
              {category && !fixedCategory ? <input type="hidden" name="category" value={category} /> : null}
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
              {(committee || ay || (category && !fixedCategory)) ? <Link href={basePath} className="text-sm font-bold text-p500 underline">Clear</Link> : null}
            </form> : null}
          </div>

          {failed ? <p className="mt-8 rounded-lg bg-red-100 px-3 py-2 text-bad">Posts could not be loaded right now. Please try again in a minute.</p>
            : posts.items.length ? (
              rest.length ? (
                <div className="mt-8 grid gap-5 md:grid-cols-6 md:gap-6">
                  {rest.map((p, i) => <div key={p.slug} className={i < 2 ? 'md:col-span-3' : 'md:col-span-2'}><NewsCard post={p} size={i < 2 ? 'wide' : 'card'} /></div>)}
                </div>
              ) : <p className="mt-8 text-muted">That is the only post here so far.</p>
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
