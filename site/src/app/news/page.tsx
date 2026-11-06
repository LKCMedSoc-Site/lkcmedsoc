import type { Metadata } from 'next';
import Link from 'next/link';
import { CATEGORIES, getPostYears, listPosts } from '@/lib/posts';
import { exco, isAy } from '@/lib/ay';
import PostCard from '@/components/PostCard';

export const metadata: Metadata = { title: 'News' };
export const revalidate = 60;
const PER_PAGE = 12;

export default async function NewsPage({ searchParams }: { searchParams: Promise<{ category?: string; page?: string; ay?: string }> }) {
  const sp = await searchParams;
  const category = (CATEGORIES as readonly string[]).includes(sp.category ?? '') ? sp.category! : null;
  const ay = sp.ay && isAy(sp.ay) ? sp.ay : null;
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);
  let posts: Awaited<ReturnType<typeof listPosts>> = { total: 0, items: [] }; let failed = false;
  const [years] = await Promise.all([getPostYears(), listPosts({ limit: PER_PAGE, offset: (page - 1) * PER_PAGE, category, ay }).then((r) => { posts = r; }).catch(() => { failed = true; })]);
  const pages = Math.max(1, Math.ceil(posts.total / PER_PAGE));
  const q = (p: number, c: string | null, y: string | null) => {
    const qs = new URLSearchParams({ ...(c ? { category: c } : {}), ...(y ? { ay: y } : {}), ...(p > 1 ? { page: String(p) } : {}) }).toString();
    return qs ? `/news?${qs}` : '/news';
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="display text-5xl">News</h1>
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <nav aria-label="Categories" className="flex flex-wrap gap-2">
          {[null, ...CATEGORIES].map((c) => (
            <Link key={c ?? 'all'} href={q(1, c, ay)} className={`rounded-full border px-3 py-1.5 text-sm no-underline ${c === category ? 'border-p500 bg-p500 text-white' : 'border-line bg-p100 text-p700'}`}>{c ?? 'All'}</Link>
          ))}
        </nav>
        {/* Plain form, works without JavaScript */}
        {years.length ? (
          <form action="/news" method="get" className="flex items-center gap-2 text-sm">
            {category ? <input type="hidden" name="category" value={category} /> : null}
            <label htmlFor="ay" className="text-muted">ExCo year</label>
            <select id="ay" name="ay" defaultValue={ay ?? ''} className="rounded-lg border border-p300 bg-white px-2 py-1.5">
              <option value="">All years</option>
              {years.map((y) => <option key={y.ay} value={y.ay}>{y.ay} · {exco(y.ay)} ({y.n})</option>)}
            </select>
            <button className="rounded-lg border border-p700 bg-white px-3 py-1.5 font-bold text-p700">Show</button>
          </form>
        ) : null}
      </div>
      {failed ? <p className="mt-6 rounded-lg bg-red-100 px-3 py-2 text-bad">News could not be loaded right now. Please try again in a minute.</p>
        : posts.items.length ? <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{posts.items.map((p) => <PostCard key={p.slug} post={p} />)}</div>
        : <p className="mt-6 text-muted">Nothing posted here yet.</p>}
      {pages > 1 ? (
        <div className="mt-8 flex items-center justify-between text-sm">
          {page > 1 ? <Link className="underline" href={q(page - 1, category, ay)}>← Newer</Link> : <span />}
          <span className="text-muted">Page {page} of {pages}</span>
          {page < pages ? <Link className="underline" href={q(page + 1, category, ay)}>Older →</Link> : <span />}
        </div>
      ) : null}
    </div>
  );
}
