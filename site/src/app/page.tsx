import Link from 'next/link';
import { HOME, PHOTOS } from '@/lib/home';
import { listPosts, type Post } from '@/lib/posts';
import { serverClient, photoUrl } from '@/lib/supabase';
import { getPageRendered } from '@/lib/content';
import { getBodies } from '@/lib/records';
import PostCard from '@/components/PostCard';
import EventCard from '@/components/EventCard';
import type { PublicEvent } from '@/lib/events';
import Hero from '@/components/blocks/Hero';
import Marquee from '@/components/blocks/Marquee';
import PhotoTile from '@/components/blocks/PhotoTile';
import SectionHead from '@/components/blocks/SectionHead';
import Reveal from '@/components/blocks/Reveal';
import Counter from '@/components/blocks/Counter';
import SafeImage from '@/components/SafeImage';

export const revalidate = 60;

export default async function Home() {
  let posts: Post[] = []; let events: PublicEvent[] = [];
  try { posts = (await listPosts({ limit: 3 })).items; } catch { /* the rest of the page still shows */ }
  try {
    const { data } = await serverClient().schema('activities').rpc('upcoming_events');
    events = ((data ?? []) as PublicEvent[]).slice(0, 3);
  } catch { /* same */ }
  const message = await getPageRendered('president-message');
  const messageReady = !!message && !/^\s*<p>\s*\[/.test(message.html); // hide the "[To be written…]" placeholder
  let ccaCount = 0;
  try { ccaCount = (await getBodies()).filter((b) => b.level === 'CCA/Project' && b.status === 'Active').length; } catch { /* falls back to the written number */ }
  const numbers = HOME.numbers.map((n) => (n.label === 'Student CCAs' && ccaCount ? { ...n, value: String(ccaCount) } : n));
  const tilePhotos = [PHOTOS.service, PHOTOS.events, PHOTOS.academic];

  return (
    <>
      <Hero title={HOME.heroTitle} tagline={HOME.heroTagline} image={photoUrl(PHOTOS.hero)} />
      <Marquee />

      <section className="mx-auto max-w-5xl px-4 py-20 md:py-28">
        <Reveal><p className="eyebrow">Who we are</p></Reveal>
        <Reveal delay={80}><p className="mt-4 text-3xl font-medium leading-tight text-p900 md:text-5xl">{HOME.intro}</p></Reveal>
      </section>

      <section className="bg-p50 py-20 md:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <SectionHead eyebrow="What we do" title="Three ways we serve" />
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {HOME.whatWeDo.map((w, i) => (
              <Reveal key={w.title} delay={i * 120} className={i === 1 ? 'md:translate-y-10' : ''}>
                <PhotoTile title={w.title} text={w.text} href={w.href} image={photoUrl(tilePhotos[i])} />
              </Reveal>
            ))}
          </div>
          <div className="hidden md:block md:h-10" />
        </div>
      </section>

      {messageReady && message ? (
        <section className="mx-auto max-w-4xl px-4 py-20">
          <SectionHead eyebrow="From the president" title={message.title} />
          <Reveal><div className="prose-lkc mt-6 text-lg" dangerouslySetInnerHTML={{ __html: message.html }} /></Reveal>
        </section>
      ) : null}

      {events.length ? (
        <section className="mx-auto max-w-6xl px-4 py-20">
          <SectionHead eyebrow="What's on" title="Coming up" linkLabel="All events" linkHref="/events" />
          <div className="mt-8 grid gap-4 md:grid-cols-3">{events.map((e, i) => <Reveal key={e.id} delay={i * 100}><EventCard ev={e} /></Reveal>)}</div>
        </section>
      ) : null}

      {posts.length ? (
        <section className="mx-auto max-w-6xl px-4 pb-20">
          <SectionHead eyebrow="Stories" title="Latest news" linkLabel="All news" linkHref="/news" />
          <div className="mt-8 grid gap-8 md:grid-cols-3">{posts.map((p, i) => <Reveal key={p.slug} delay={i * 100}><PostCard post={p} /></Reveal>)}</div>
        </section>
      ) : null}

      <section className="bg-p900 py-20 text-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 text-center md:grid-cols-3 md:gap-0 md:divide-x md:divide-p700">
          {numbers.map((n) => (
            <Reveal key={n.label}><div className="display text-7xl text-white md:text-8xl"><Counter value={n.value} /></div><div className="eyebrow eyebrow-light mt-3">{n.label}</div></Reveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 md:py-28">
        <SectionHead eyebrow="Voices" title="What students say" />
        <div className="mt-10 grid gap-10 md:grid-cols-2">
          {HOME.testimonials.map((t, i) => (
            <Reveal key={t.who} delay={i * 120}>
              <blockquote className="border-l-4 border-p300 pl-6">
                <p className="text-xl leading-snug text-p900 md:text-2xl">&ldquo;{t.quote}&rdquo;</p>
                <footer className="eyebrow mt-4">{t.who}</footer>
              </blockquote>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="relative isolate mx-4 mb-4 overflow-hidden rounded-3xl bg-p900 text-white md:mx-6">
        <div className="absolute inset-0 -z-20"><SafeImage src={photoUrl(PHOTOS.join)} className="h-full w-full" sizes="100vw" /></div>
        <div aria-hidden className="absolute inset-0 -z-10 bg-p900/75" />
        <div className="mx-auto max-w-6xl px-6 py-20 text-center md:py-28">
          <h2 className="h-xl text-white">Want to get involved?</h2>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/about/work-with-us" className="rounded-full bg-white px-7 py-3.5 font-bold text-p900 no-underline hover:bg-p100">Work with us</Link>
            <Link href="/student-life" className="rounded-full border border-white/60 px-7 py-3.5 font-bold text-white no-underline hover:bg-white/10">Explore student life</Link>
          </div>
        </div>
      </section>
    </>
  );
}
