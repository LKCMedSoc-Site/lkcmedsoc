import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getExcoTeams } from '@/lib/records';
import { listPosts } from '@/lib/posts';
import { getPageRendered } from '@/lib/content';
import { exco, slugToAy } from '@/lib/ay';
import Leaders from '@/components/Leaders';
import PostCard from '@/components/PostCard';

export const revalidate = 300;
type Props = { params: Promise<{ ay: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const ay = slugToAy((await params).ay);
  return { title: ay ? `${exco(ay)} (${ay})` : 'Honour Roll' };
}

export default async function TermPage({ params }: Props) {
  const slug = (await params).ay;
  const ay = slugToAy(slug);
  if (!ay) notFound();
  const [teams, posts] = await Promise.all([getExcoTeams().catch(() => null), listPosts({ ay, limit: 6 }).catch(() => null)]);
  const team = teams?.get(ay) ?? [];
  const writeup = await getPageRendered(`exco/${slug}`);       // content/exco/ay26-27.md, edited with the site's text editor
  if (teams && !team.length && !writeup && !posts?.total) notFound();
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <p className="text-sm"><Link className="underline" href="/about/honour-roll">Honour roll</Link></p>
      <div className="mt-1 text-sm font-medium uppercase tracking-wide text-p500">{ay}</div>
      <h1 className="display text-5xl">{exco(ay)}</h1>

      <section className="mt-8"><h2 className="display text-3xl">The team</h2>
        {team.length ? <Leaders className="mt-3 columns-1 sm:columns-2" list={team} /> : <p className="mt-2 text-muted">The team list for this year is not available.</p>}
      </section>

      <section className="mt-10"><h2 className="display text-3xl">What they achieved</h2>
        {writeup && writeup.html.trim() ? <div className="prose-lkc mt-3" dangerouslySetInnerHTML={{ __html: writeup.html }} />
          : <p className="mt-2 text-muted">A write-up for this year is coming soon.</p>}
      </section>

      <section className="mt-10">
        <div className="flex items-end justify-between"><h2 className="display text-3xl">News from {ay}</h2>
          {posts?.total ? <Link className="text-sm underline" href={`/gazette/all?ay=${encodeURIComponent(ay)}`}>All {posts.total} posts</Link> : null}</div>
        {posts?.items.length ? <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{posts.items.map((p) => <PostCard key={p.slug} post={p} />)}</div>
          : <p className="mt-2 text-muted">No write-ups from this year yet.</p>}
      </section>
    </div>
  );
}
