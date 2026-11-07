import type { Metadata } from 'next';
import Link from 'next/link';
import { committeesOf, getBodies, getLeaders, sortLeaders, type Leader } from '@/lib/records';
import Leaders from '@/components/Leaders';
import Avatar from '@/components/Avatar';
import PageHero from '@/components/blocks/PageHero';
import { plasmicData, PlasmicView } from '@/lib/plasmic-page';

export const metadata: Metadata = { title: 'Meet the Team' };
export const revalidate = 300;

const isStream = (l: Leader) => /stream/i.test(l.title);

export default async function MeetTheTeam() {
  // A page designed in Plasmic at this path replaces the coded one below.
  const designed = await plasmicData('/about/meet-the-team');
  if (designed) return <PlasmicView data={designed} />;
  const [bodies, lead] = await Promise.all([getBodies().catch(() => null), getLeaders().catch(() => null)]);
  if (!bodies || !lead) return <><PageHero title="Meet the Team" /><section className="band band-pale band-last" style={{ zIndex: 20 }}><div className="mx-auto max-w-3xl px-4"><p className="rounded-lg bg-red-100 px-3 py-2 text-bad">The team list could not be loaded right now. Please try again in a minute.</p></div></section></>;
  const { ay, leaders } = lead;
  const of = (level: string, body: string) => leaders.filter((l) => l.level === level && l.body === body);
  const committees = committeesOf(bodies);
  const years = bodies.filter((b) => b.level === 'Year' && b.status === 'Active').sort((a, b) => a.name.localeCompare(b.name));
  const exco = bodies.find((b) => b.level === 'ExCo');
  return (
    <>
      <PageHero title="Meet the Team" intro={`The students behind MedSoc${ay ? `, ${ay}` : ''}. Want to join them?`}>
        <Link href="/about/work-with-us" className="press mt-6 inline-block rounded-full bg-pink px-6 py-3 font-bold text-p900 no-underline hover:bg-white">Work with us</Link>
      </PageHero>
      <section className="band band-pale band-last" style={{ zIndex: 20 }}>
        <div className="mx-auto max-w-6xl space-y-14 px-4 md:space-y-20">
          {exco ? (
            <div>
              <h2 className="h-xl">{exco.name}</h2>
              <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {sortLeaders(of('ExCo', exco.name)).map((l, i) => <li key={i} className="flex items-center gap-4 rounded-xl border border-p900/15 bg-white p-4"><Avatar name={l.name} photo={l.photo} size={64} /><span className="min-w-0"><span className="block text-sm text-muted">{l.title}</span><span className="mt-0.5 block text-xl font-bold text-p900">{l.name}</span></span></li>)}
              </ul>
            </div>
          ) : null}

          <div>
            <h2 className="h-xl">Committees</h2>
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {committees.map((c) => (
                <li key={c.name}>
                  <Link href={`/student-groups/${c.slug}`} className="row-link press group block h-full rounded-xl bg-p950 p-5 text-mist no-underline transition-colors hover:bg-p900">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="display text-3xl leading-[.95] text-white"><span className="row-title">{c.name.replace(/ Committee$/, '')}</span></h3>
                        <p className="mt-1 text-sm text-p300">Committee{c.ccas.length ? ` · ${c.ccas.length} group${c.ccas.length === 1 ? '' : 's'}` : ''}</p>
                      </div>
                      {(() => { const h = of('Committee', c.name)[0]; return h ? <Avatar name={h.name} photo={h.photo} size={56} dark /> : null; })()}
                    </div>
                    <Leaders className="mt-3 [&_.text-muted]:text-p300 [&_.font-medium]:text-white" list={of('Committee', c.name)} />
                    <span aria-hidden className="row-arrow mt-3 inline-block text-2xl text-pink">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="h-xl">Year &amp; stream representatives</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {years.map((y) => {
                const all = leaders.filter((l) => (l.level === 'Year' && l.body === y.name) || (isStream(l) && l.body === y.name));
                const reps = all.filter((l) => !isStream(l)); const streams = all.filter(isStream);
                return (
                  <div key={y.name} className="rounded-xl border border-p900/15 bg-white p-4">
                    <h3 className="display text-3xl text-p900">{y.name}</h3>
                    <Leaders className="mt-2" list={reps} />
                    {streams.length ? <><p className="mt-3 text-xs font-bold uppercase tracking-wider text-p500">Stream representatives</p><Leaders className="mt-1" list={streams} /></> : null}
                  </div>
                );
              })}
            </div>
          </div>

          <p className="text-sm">Looking for house representatives? See the <Link className="underline" href="/about/houses">house system</Link>. Past teams are on the <Link className="underline" href="/about/honour-roll">honour roll</Link>.</p>
        </div>
      </section>
    </>
  );
}
