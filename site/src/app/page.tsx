import Link from 'next/link';
import { HOME, PHOTOS } from '@/lib/home';
import { listPosts, type Post } from '@/lib/posts';
import { serverClient, photoUrl } from '@/lib/supabase';
import { getPageRendered } from '@/lib/content';
import { getBodies, getLeaders, type Body, type Leader } from '@/lib/records';
import { pickSpotlight } from '@/lib/spotlight';
import CcaSpotlight from '@/components/CcaSpotlight';
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
import { plasmicData, PlasmicView } from '@/lib/plasmic-page';

export const revalidate = 60;

export default async function Home() {
  // A page designed in Plasmic at this path replaces the coded one below.
  const designed = await plasmicData('/');
  if (designed) return <PlasmicView data={designed} />;
  let posts: Post[] = []; let events: PublicEvent[] = [];
  try { posts = (await listPosts({ limit: 3 })).items; } catch { /* the rest of the page still shows */ }
  try {
    const { data } = await serverClient().schema('activities').rpc('upcoming_events');
    events = ((data ?? []) as PublicEvent[]).slice(0, 3);
  } catch { /* same */ }
  const message = await getPageRendered('president-message');
  const messageReady = !!message && !/^\s*<p>\s*\[/.test(message.html); // hide the "[To be written…]" placeholder
  let bodies: Body[] = []; let leaders: Leader[] = [];
  try { bodies = await getBodies(); } catch { /* falls back to the written number */ }
  try { leaders = (await getLeaders()).leaders; } catch { /* the spotlight shows without names */ }
  const { groups, ccaCount, spot, spotLeaders } = pickSpotlight(bodies, leaders);
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
          <div className={wrap}><CcaSpotlight spot={spot} spotLeaders={spotLeaders} groups={groups} ccaCount={ccaCount} /></div>
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
