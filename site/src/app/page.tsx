import Link from 'next/link';
import { HOME, PHOTOS } from '@/lib/home';
import { listPosts, type Post } from '@/lib/posts';
import { serverClient, photoUrl } from '@/lib/supabase';
import { getPageRendered } from '@/lib/content';
import { getBodies, getLeaders, groupsOf, slugify, sortLeaders, type Body, type Group, type Leader } from '@/lib/records';
import PostCard from '@/components/PostCard';
import EventRow from '@/components/EventRow';
import type { PublicEvent } from '@/lib/events';
import { ymd } from '@/lib/dates';
import { ArrowRight } from 'lucide-react';
import Hero from '@/components/blocks/Hero';
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
  let ccaCount = 0; let groups: Group[] = []; let leaders: Leader[] = [];
  try { const bodies = await getBodies(); groups = groupsOf(bodies); ccaCount = groups.reduce((n, g) => n + g.ccas.length, 0); } catch { /* falls back to the written number */ }
  try { leaders = (await getLeaders()).leaders; } catch { /* the spotlight shows without names */ }
  // One CCA is featured each week, picked from those that already have named leaders.
  const all = groups.flatMap((g) => g.ccas.map((c) => ({ c, g })));
  const led = all.filter(({ c }) => leaders.some((l) => l.level === 'CCA/Project' && l.body === c.name));
  const pool = led.length ? led : all;
  const spot: { c: Body; g: Group } | undefined = pool.length ? pool[Math.floor(Date.now() / (7 * 864e5)) % pool.length] : undefined;
  const spotLeaders = spot ? sortLeaders(leaders.filter((l) => l.level === 'CCA/Project' && l.body === spot.c.name)) : [];
  // The yellow strip is for something important: an event that opens for RSVP or starts within two weeks.
  const next = events[0];
  const nd = next ? ymd(next.start_date) : null;
  const days = nd ? Math.round((Date.UTC(nd[0], nd[1] - 1, nd[2]) - Date.now()) / 864e5) : null;
  const notify = !!next && (!!next.rsvp_open || (days !== null && days <= 14));
  const numbers = HOME.numbers.map((n) => (n.label === 'Student CCAs' && ccaCount ? { ...n, value: String(ccaCount) } : n));

  const wrap = 'mx-auto max-w-6xl px-4';
  const tilePhotos = [PHOTOS.service, PHOTOS.events, PHOTOS.academic];
  const accents = ['text-p500', 'text-p500', 'text-p900'];
  const z = (n: number) => ({ zIndex: 30 - n });

  return (
    <>
      {notify && next ? (
        <Link href={`/events/${next.id}`} className="group block bg-acid text-p950 no-underline">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2 text-sm font-bold md:text-base">
            <span className="min-w-0 truncate">{next.rsvp_open ? 'RSVP open' : 'Coming up'}: {next.title}</span>
            <span className="flex shrink-0 items-center gap-1 underline decoration-2 underline-offset-4">Details<ArrowRight aria-hidden className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
          </div>
        </Link>
      ) : null}
      <Hero title={HOME.heroTitle} tagline={HOME.heroTagline} image={photoUrl(PHOTOS.hero)} />

      <section className="band band-magenta" style={z(1)}>
        <div className={wrap}>
          <p className="max-w-4xl text-3xl font-medium leading-[1.1] text-white md:text-6xl">{HOME.intro}</p>
        </div>
      </section>

      <section className="band band-pale" style={z(2)}>
        <div className={wrap}>
          <SectionHead title="What we do" />
          <div className="mt-6 md:mt-10">
            {HOME.whatWeDo.map((w, i) => (
              <Reveal key={w.title}>
                <Link href={w.href} className="row-link zoom group grid items-center gap-4 border-t border-p900/20 py-6 no-underline md:grid-cols-12 md:gap-10 md:py-10">
                  <div className={`md:col-span-7 ${i % 2 ? 'md:order-2' : ''}`}>
                    <h3 className="display text-p900"><span className="row-title text-5xl md:text-8xl">{w.title}</span> <span aria-hidden className={`row-arrow ml-1 inline-block text-3xl md:text-6xl ${accents[i]}`}>→</span></h3>
                    <p className="mt-3 max-w-lg text-base text-muted md:mt-5 md:text-lg">{w.text}</p>
                  </div>
                  <div className={`md:col-span-5 ${i % 2 ? 'md:order-1' : ''}`}>
                    <div className="slant"><SafeImage src={photoUrl(tilePhotos[i])} sizes="(min-width: 768px) 40vw, 100vw" className="aspect-[16/9] w-full md:aspect-[16/10]" /></div>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {events.length ? (
        <section className="band band-grey" style={z(3)}>
          <div className={wrap}>
            <SectionHead title="Coming up" linkLabel="All events" linkHref="/events" />
            <div className="mt-6 border-b border-p900/20 md:mt-8">{events.map((e) => <EventRow key={e.id} ev={e} />)}</div>
          </div>
        </section>
      ) : null}

      {spot ? (
        <section className="band band-grape" style={z(4)}>
          <div className={`${wrap} grid gap-10 md:grid-cols-12 md:gap-8`}>
            <div className="md:col-span-7">
              <h2 className="h-xl text-mist">CCA spotlight</h2>
              <p className="display mt-3 text-[clamp(3.2rem,9vw,7rem)] leading-[.88] text-white">{spot.c.name}</p>
              <p className="mt-4 inline-block rounded-full border border-lilac/50 px-3 py-1 text-sm text-lilac">{spot.g.title}</p>
              {spotLeaders.length ? (
                <ul className="mt-5 space-y-1 text-lg text-mist">
                  {spotLeaders.slice(0, 4).map((l, i) => <li key={i}><span className="text-lilac">{l.title}</span> · <span className="font-medium text-white">{l.name}</span></li>)}
                </ul>
              ) : null}
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href={`/student-groups/${spot.g.slug}/${slugify(spot.c.name)}`} className="press rounded-full bg-pink px-6 py-3 font-bold text-p900 no-underline hover:bg-white">See {spot.c.name}</Link>
                <Link href="/student-groups" className="press rounded-full border border-lilac/60 px-6 py-3 font-bold text-white no-underline hover:bg-white/10">All {ccaCount} CCAs</Link>
              </div>
            </div>
            <div className="md:col-span-5">
              <p className="text-sm font-bold text-lilac">Find yours</p>
              <ul className="mt-2 border-b border-p300">
                {groups.map((g) => (
                  <li key={g.slug} className="border-t border-p300">
                    <Link href={`/student-groups/${g.slug}`} className="row-link group flex items-center justify-between gap-4 py-4 no-underline">
                      <span><span className="display row-title text-3xl text-white md:text-4xl">{g.title}</span><span className="block text-sm text-lilac">{g.ccas.length} CCA{g.ccas.length === 1 ? '' : 's'}</span></span>
                      <ArrowRight aria-hidden className="row-arrow h-6 w-6 text-pink" />
                    </Link>
                  </li>
                ))}
                <li className="border-t border-p300">
                  <Link href="/about/houses" className="row-link group flex items-center justify-between gap-4 py-4 no-underline">
                    <span><span className="display row-title text-3xl text-white md:text-4xl">House system</span><span className="block text-sm text-lilac">Your house and its reps</span></span>
                    <ArrowRight aria-hidden className="row-arrow h-6 w-6 text-pink" />
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </section>
      ) : null}

      {messageReady && message ? (
        <section className="band band-pale" style={z(5)}>
          <div className="mx-auto max-w-4xl px-4">
            <SectionHead title={message.title} />
            <div className="prose-lkc mt-5 text-lg" dangerouslySetInnerHTML={{ __html: message.html }} />
          </div>
        </section>
      ) : null}

      {posts.length ? (
        <section className={`band ${messageReady && message ? 'band-grey' : 'band-pale'}`} style={z(6)}>
          <div className={wrap}>
            <SectionHead title="Latest news" linkLabel="All news" linkHref="/news" />
            <div className="mt-6 grid gap-6 md:mt-8 md:grid-cols-3 md:gap-8">{posts.map((p) => <div key={p.slug} className="rounded-xl bg-white p-3 pb-5 shadow-[0_1px_0_rgba(77,10,73,.08),0_10px_24px_-14px_rgba(77,10,73,.35)] transition-transform duration-300 hover:-translate-y-0.5"><PostCard post={p} /></div>)}</div>
          </div>
        </section>
      ) : null}

      <section className="band band-plum" style={z(7)}>
        <div className={`${wrap} grid grid-cols-3 gap-4 md:gap-8`}>
          {numbers.map((n) => (
            <Reveal key={n.label}>
              <div className="border-t-4 border-pink pt-3 md:pt-5">
                <div className="display text-5xl text-white sm:text-7xl md:text-9xl"><Counter value={n.value} /></div>
                <div className="mt-1 text-sm font-medium text-mist md:mt-2 md:text-xl">{n.label}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="band band-mist" style={z(8)}>
        <div className={wrap}>
          <SectionHead title="What students say" />
          <div className="mt-6 grid gap-8 md:mt-10 md:grid-cols-2 md:gap-16">
            {HOME.testimonials.map((t) => (
              <blockquote key={t.who}>
                <span aria-hidden className="quote-mark block text-p500">&ldquo;</span>
                <p className="mt-3 text-2xl leading-snug text-p950 md:text-3xl">{t.quote}</p>
                <footer className="mt-4 font-bold text-p300">{t.who}</footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      <section className="band band-pink band-last" style={z(9)}>
        <div className={`${wrap} grid items-center gap-8 md:grid-cols-12`}>
          <div className="md:col-span-7">
            <h2 className="h-xl">Want to get involved?</h2>
            <div className="mt-6 flex flex-wrap gap-3 md:mt-8">
              <Link href="/about/work-with-us" className="press rounded-full bg-p900 px-7 py-3.5 font-bold text-white no-underline hover:bg-p950">Work with us</Link>
              <Link href="/student-groups" className="press rounded-full border-2 border-p900 px-7 py-3.5 font-bold text-p900 no-underline hover:bg-p900 hover:text-white">Explore student life</Link>
            </div>
          </div>
          <div className="zoom slant md:col-span-5"><SafeImage src={photoUrl(PHOTOS.join)} sizes="(min-width: 768px) 40vw, 100vw" className="aspect-[16/10] w-full" /></div>
        </div>
      </section>
    </>
  );
}
