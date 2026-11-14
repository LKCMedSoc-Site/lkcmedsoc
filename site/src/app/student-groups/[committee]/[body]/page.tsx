import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { committeesOf, getBodies, getLeaders, slugify, sortLeaders } from '@/lib/records';
import { listPosts } from '@/lib/posts';
import { renderGroupMarkdown } from '@/lib/markdown';
import { serverClient, storageUrl } from '@/lib/supabase';
import SafeImage from '@/components/SafeImage';
import GroupIcon from '@/components/groups/GroupIcon';
import { buildGroupPage } from '@/lib/group-page';
import { plasmicData, PlasmicView } from '@/lib/plasmic-page';
import { withAlpha } from '@/lib/tones';
import type { PublicEvent } from '@/lib/events';
import Leaders from '@/components/Leaders';

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
  // A page designed in Plasmic at /student-groups/[committee]/[body] replaces the coded one below (see plasmic-kit/GROUP-PAGE.md).
  const designed = await plasmicData(`/student-groups/${p.committee}/${p.body}`);
  if (designed) return <PlasmicView data={designed} />;
  const { c, b } = await find(p.committee, p.body);
  if (!c || !b) notFound();
  const bodies = await getBodies().catch(() => []);
  const { ay, leaders } = await getLeaders().catch(() => ({ ay: '', leaders: [] }));
  const posts = await listPosts({ limit: 60 }).then((r) => r.items).catch(() => []);
  let events: PublicEvent[] = [];
  try { const { data } = await serverClient().schema('activities').rpc('upcoming_events'); events = (data ?? []) as PublicEvent[]; } catch { /* the page still shows */ }
  const g = buildGroupPage({ bodies, leaders, ay, events, posts, committee: p.committee, body: p.body, renderAbout: renderGroupMarkdown });
  // The group's colour is the page's primary colour: the hero wash, headings, links, buttons and the leaders panel all take it.
  const col = g.color;
  const wash = `linear-gradient(180deg, ${withAlpha(col, 0.78)} 0%, ${withAlpha(col, 0.9)} 100%)`;
  return (
    <div style={{ ['--g' as string]: col }}>
      <section className="band" style={{ zIndex: 30, background: col, color: '#fff' }}>
        {g.hasHeader ? <div aria-hidden className="absolute inset-0"><SafeImage src={g.header} priority sizes="100vw" className="h-full w-full" /></div> : null}
        <div aria-hidden className="absolute inset-0" style={{ background: g.hasHeader ? wash : `linear-gradient(135deg, ${col}, ${withAlpha(col, 0.82)})` }} />
        <div className="relative mx-auto max-w-6xl px-4 pt-6">
          <Link href={g.committeeLink} className="mb-6 inline-block text-sm font-bold text-white/80 no-underline hover:text-white">← {g.committee}</Link>
          <div className="flex flex-wrap items-end gap-x-8 gap-y-5">
            {g.hasLogo ? <span className="block h-24 w-24 shrink-0 overflow-hidden rounded-full border-4 border-white bg-white shadow-sm md:h-28 md:w-28"><SafeImage src={g.logo} sizes="112px" className="h-full w-full" /></span> : null}
            <div className="min-w-0 flex-1">
              <span className="inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">{g.committeeShort}</span>
              <h1 className="hero-title mt-6 max-w-4xl text-white !text-[clamp(2.8rem,8vw,6rem)]">{g.name}</h1>
            </div>
          </div>
          {g.description ? <p className="mt-5 max-w-2xl text-lg text-white/90 md:text-xl">{g.description}</p> : null}
          {g.hasJoin || g.hasLinks ? (
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {g.join ? <a href={g.join.url} target="_blank" rel="noopener" className="press inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 font-bold no-underline hover:bg-white/90" style={{ color: col }}>{g.join.label} <GroupIcon kind="join" size={18} /></a> : null}
              {g.links.map((l) => (
                <a key={l.url} href={l.url} target={l.kind === 'email' ? undefined : '_blank'} rel="noopener" aria-label={`${g.name} on ${l.label}`} title={l.label} className="press grid h-11 w-11 place-items-center rounded-full border border-white/40 bg-white/10 text-white no-underline hover:bg-white hover:!text-[var(--g)]"><GroupIcon kind={l.kind} size={20} /></a>
              ))}
            </div>
          ) : null}
        </div>
      </section>
      <section className="band band-pale band-last" style={{ zIndex: 20 }}>
        <div className="mx-auto grid max-w-6xl gap-10 px-4 md:grid-cols-12 md:gap-12">
          {/* The write-up launches straight in and gets most of the width. */}
          <div className="min-w-0 md:col-span-8">
            {g.hasAbout ? <div className="prose-lkc group-prose text-lg" dangerouslySetInnerHTML={{ __html: g.aboutHtml }} /> : <p className="max-w-md text-muted">{g.name} has not written its page yet. Check back soon.</p>}
          </div>
          {/* The side column stays in view while the write-up scrolls. */}
          <aside className="md:col-span-4 md:self-start md:sticky md:top-24 md:max-h-[calc(100vh-7rem)] md:overflow-y-auto">
            <div className="rounded-2xl p-6" style={{ background: col, color: '#fff' }}>
              <h2 className="display text-3xl text-white">Who leads it</h2>
              {g.ay ? <p className="mt-1 text-sm text-white/75">{g.ay}</p> : null}
              {g.hasLeaders ? <Leaders className="mt-3 text-base [&_.text-muted]:text-white/75 [&_.font-medium]:text-white" list={sortLeaders(leaders.filter((l) => l.level === 'CCA/Project' && l.body === b.name))} /> : <p className="mt-3 text-white/80">Leaders for this group are not listed yet.</p>}
              <p className="mt-4 border-t border-white/25 pt-3 text-sm text-white/80">Part of the <Link href={g.committeeLink} className="font-bold text-white underline-offset-2 hover:underline">{g.committee}</Link>.</p>
            </div>
            {g.hasEvents ? (
              <div className="mt-6">
                <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: col }}>Coming up</h2>
                <ul className="mt-2 divide-y divide-p900/15 border-y border-p900/15">
                  {g.events.slice(0, 3).map((e) => (
                    <li key={e.id}>
                      <Link href={e.link} className="flex items-center gap-3 py-2.5 no-underline">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-center leading-none" style={{ background: col, color: '#fff' }}><span><span className="block text-[10px] font-bold tracking-wider">{e.monthShort}</span><span className="display block text-xl">{e.day}</span></span></span>
                        <span className="min-w-0"><span className="block truncate text-sm font-bold text-ink">{e.title}</span><span className="block truncate text-xs text-muted">{e.whenText}</span></span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {g.hasPosts ? (
              <div className="mt-6">
                <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: col }}>From the news</h2>
                <ul className="mt-2 divide-y divide-p900/15 border-y border-p900/15">
                  {g.posts.slice(0, 3).map((x) => (
                    <li key={x.slug}>
                      <Link href={x.link} className="block py-2.5 no-underline">
                        <span className="block text-xs text-muted">{x.dateText}</span>
                        <span className="block text-sm font-bold leading-snug text-ink">{x.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </aside>
        </div>
      </section>
    </div>
  );
}
