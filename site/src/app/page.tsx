import Link from 'next/link';
import { HOME } from '@/lib/home';
import { listPosts, type Post } from '@/lib/posts';
import { serverClient } from '@/lib/supabase';
import { getPageRendered } from '@/lib/content';
import { getBodies } from '@/lib/records';
import PostCard from '@/components/PostCard';
import EventCard from '@/components/EventCard';
import type { PublicEvent } from '@/lib/events';
import { Button } from '@/components/ui/button';

export const revalidate = 60;

export default async function Home() {
  let posts: Post[] = []; let events: PublicEvent[] = [];
  try { posts = (await listPosts({ limit: 3 })).items; } catch { /* the rest of the page still shows */ }
  try {
    const { data } = await serverClient().schema('activities').rpc('upcoming_events');
    events = ((data ?? []) as PublicEvent[]).slice(0, 3);
  } catch { /* same */ }
  const message = await getPageRendered('president-message');
  let ccaCount = 0;
  try { ccaCount = (await getBodies()).filter((b) => b.level === 'CCA/Project' && b.status === 'Active').length; } catch { /* falls back to the written number */ }
  const numbers = HOME.numbers.map((n) => (n.label === 'Student CCAs' && ccaCount ? { ...n, value: String(ccaCount) } : n));

  return (
    <>
      <section className="bg-p900 text-white">
        <div className="mx-auto max-w-6xl px-4 py-20 md:py-28">
          <h1 className="display text-6xl text-white md:text-8xl">{HOME.heroTitle}</h1>
          <p className="mt-6 max-w-2xl text-lg text-p100 md:text-xl">{HOME.heroTagline}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild variant="onDark" size="lg"><Link href="/events">See events</Link></Button>
            <Button asChild variant="outline" size="lg" className="border-p300 bg-transparent text-white hover:bg-p700"><Link href="/about">Meet the team</Link></Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-14 text-center">
        <p className="text-2xl font-medium text-p900">{HOME.intro}</p>
      </section>

      <section className="bg-p50 py-14">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="display text-4xl">What we do</h2>
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {HOME.whatWeDo.map((w) => (
              <Link key={w.title} href={w.href} className="rounded-xl border border-line bg-white p-6 no-underline transition hover:border-p500">
                <h3 className="display text-3xl">{w.title}</h3>
                <p className="mt-2 text-muted">{w.text}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {message ? (
        <section className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="display text-4xl">{message.title}</h2>
          <div className="prose-lkc mt-4" dangerouslySetInnerHTML={{ __html: message.html }} />
        </section>
      ) : null}

      {events.length ? (
        <section className="mx-auto max-w-6xl px-4 pb-14">
          <div className="flex items-end justify-between"><h2 className="display text-4xl">Coming up</h2><Link href="/events" className="text-sm underline">All events</Link></div>
          <div className="mt-6 grid gap-3 md:grid-cols-3">{events.map((e) => <EventCard key={e.id} ev={e} />)}</div>
        </section>
      ) : null}

      {posts.length ? (
        <section className="mx-auto max-w-6xl px-4 pb-14">
          <div className="flex items-end justify-between"><h2 className="display text-4xl">Latest news</h2><Link href="/news" className="text-sm underline">All news</Link></div>
          <div className="mt-6 grid gap-5 md:grid-cols-3">{posts.map((p) => <PostCard key={p.slug} post={p} />)}</div>
        </section>
      ) : null}

      <section className="bg-p700 py-14 text-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 text-center md:grid-cols-3">
          {numbers.map((n) => (
            <div key={n.label}><div className="display text-7xl text-white">{n.value}</div><div className="mt-1 text-p100">{n.label}</div></div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="display text-4xl">What students say</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {HOME.testimonials.map((t) => (
            <blockquote key={t.who} className="rounded-xl border border-line bg-p50 p-6">
              <p className="text-lg text-p900">&ldquo;{t.quote}&rdquo;</p>
              <footer className="mt-3 text-sm text-muted">{t.who}</footer>
            </blockquote>
          ))}
        </div>
      </section>
    </>
  );
}
