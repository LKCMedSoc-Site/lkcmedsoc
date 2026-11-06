import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { committeesOf, getBodies, getLeaders, slugify, sortLeaders } from '@/lib/records';
import { listPosts } from '@/lib/posts';
import { renderGroupMarkdown } from '@/lib/markdown';
import { serverClient, storageUrl } from '@/lib/supabase';
import SafeImage from '@/components/SafeImage';
import type { PublicEvent } from '@/lib/events';
import Leaders from '@/components/Leaders';
import PageHero from '@/components/blocks/PageHero';
import PostCard from '@/components/PostCard';
import EventRow from '@/components/EventRow';

export const revalidate = 300;
type Props = { params: Promise<{ committee: string; body: string }> };

async function find(committee: string, body: string) {
  const bodies = await getBodies().catch(() => null);
  const c = bodies ? committeesOf(bodies).find((x) => x.slug === committee) : undefined;
  const b = c?.ccas.find((x) => slugify(x.name) === body);
  return { c, b };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await params;
  return { title: (await find(p.committee, p.body)).b?.name ?? 'Student Groups' };
}

export default async function BodyPage({ params }: Props) {
  const p = await params;
  const { c, b } = await find(p.committee, p.body);
  if (!c || !b) notFound();
  const { ay, leaders } = await getLeaders().catch(() => ({ ay: '', leaders: [] }));
  const mine = sortLeaders(leaders.filter((l) => l.level === 'CCA/Project' && l.body === b.name));
  const posts = await listPosts({ limit: 60 }).then((r) => r.items.filter((x) => x.bodyName === b.name).slice(0, 3)).catch(() => []);
  let events: PublicEvent[] = [];
  try { const { data } = await serverClient().schema('activities').rpc('upcoming_events'); events = ((data ?? []) as PublicEvent[]).filter((e) => e.body === b.name).slice(0, 3); } catch { /* the page still shows */ }
  const links = [b.recruitment && ['Join us', b.recruitment], b.instagram && ['Instagram', b.instagram.startsWith('http') ? b.instagram : `https://instagram.com/${b.instagram.replace(/^@/, '')}`], b.website && ['Website', b.website]].filter(Boolean) as [string, string][];
  const siblings = c.ccas.filter((x) => x.name !== b.name).slice(0, 8);
  return (
    <>
      <PageHero title={b.name} back={{ label: c.name, href: `/student-groups/${c.slug}` }} intro={b.description ?? undefined}>
        {b.logo ? <span className="mt-5 block h-16 w-16 overflow-hidden rounded-full border-2 border-white bg-white"><SafeImage src={storageUrl('body-images', b.logo)} sizes="64px" className="h-full w-full" /></span> : null}
        {links.length ? <div className="mt-6 flex flex-wrap gap-3">{links.map(([l, h], i) => <a key={l} href={h} target="_blank" rel="noopener" className={`press rounded-full px-6 py-3 font-bold no-underline ${i === 0 ? 'bg-pink text-p900 hover:bg-white' : 'border border-p300/60 text-white hover:bg-white/10'}`}>{l}</a>)}</div> : null}
      </PageHero>
      <section className="band band-pale band-last" style={{ zIndex: 20 }}>
        <div className="mx-auto grid max-w-6xl gap-10 px-4 md:grid-cols-12 md:gap-12">
          <div className="space-y-10 md:col-span-7">
            {b.header ? <div className="slant"><SafeImage src={storageUrl('body-images', b.header)} priority sizes="(min-width: 768px) 55vw, 100vw" className="aspect-[16/9] w-full" /></div> : null}
            {b.about ? <div><h2 className="h-xl">About {b.name}</h2><div className="prose-lkc mt-4 text-lg" dangerouslySetInnerHTML={{ __html: renderGroupMarkdown(b.about) }} /></div> : null}
            {events.length ? <div><h2 className="h-xl">Coming up</h2><div className="mt-4 border-b border-p900/20">{events.map((e) => <EventRow key={e.id} ev={e} />)}</div></div> : null}
            {posts.length ? <div><h2 className="h-xl">From the news</h2><div className="mt-5 grid gap-6 sm:grid-cols-2">{posts.map((x) => <PostCard key={x.slug} post={x} />)}</div></div> : null}
            {!events.length && !posts.length ? <div><h2 className="h-xl">Latest</h2><p className="mt-3 max-w-md text-muted">Nothing posted by {b.name} yet. Events and write-ups appear here once they are published.</p></div> : null}
          </div>
          <aside className="md:col-span-5">
            <div className="rounded-2xl bg-p950 p-6 text-mist md:p-8">
              <h2 className="display text-4xl text-white">Who leads it</h2>
              {ay ? <p className="mt-1 text-sm text-p300">{ay}</p> : null}
              {mine.length ? <Leaders className="mt-4 text-base [&_.text-muted]:text-p300 [&_.font-medium]:text-white" list={mine} /> : <p className="mt-4 text-p300">Leaders for this group are not listed yet.</p>}
              <p className="mt-6 border-t border-p900 pt-4 text-sm text-p300">Part of the <Link href={`/student-groups/${c.slug}`} className="font-bold text-pink no-underline hover:underline">{c.name}</Link>.</p>
            </div>
            {siblings.length ? (
              <div className="mt-8">
                <p className="text-sm font-bold text-p500">More from this committee</p>
                <ul className="mt-2 flex flex-wrap gap-2">{siblings.map((s) => <li key={s.name}><Link href={`/student-groups/${c.slug}/${slugify(s.name)}`} className="press block rounded-full bg-mist px-3 py-1.5 text-sm font-medium text-p900 no-underline hover:bg-p900 hover:text-white">{s.name}</Link></li>)}</ul>
              </div>
            ) : null}
          </aside>
        </div>
      </section>
    </>
  );
}
