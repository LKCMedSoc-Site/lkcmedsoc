import Link from 'next/link';
import { committeesOf, sortLeaders, type Body, type Leader } from '@/lib/records';
import Leaders from '@/components/Leaders';
import Avatar from '@/components/Avatar';

// The three parts of Meet the Team. The coded page and the Plasmic block both use these, so they always look the same.
const isStream = (l: Leader) => /stream/i.test(l.title);
const of = (leaders: Leader[], level: string, body: string) => leaders.filter((l) => l.level === level && l.body === body);

export function ExcoPart({ bodies, leaders, heading = true }: { bodies: Body[]; leaders: Leader[]; heading?: boolean }) {
  const exco = bodies.find((b) => b.level === 'ExCo');
  if (!exco) return null;
  return (
    <div>
      {heading ? <h2 className="h-xl">{exco.name}</h2> : null}
      <ul className={`${heading ? 'mt-6 ' : ''}grid gap-3 sm:grid-cols-2 lg:grid-cols-3`}>
        {sortLeaders(of(leaders, 'ExCo', exco.name)).map((l, i) => (
          <li key={i} className="flex items-center gap-4 rounded-xl border border-p900/15 bg-white p-4">
            <Avatar name={l.name} photo={l.photo} size={64} />
            <span className="min-w-0"><span className="block text-sm text-muted">{l.title}</span><span className="mt-0.5 block text-xl font-bold text-p900">{l.name}</span></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CommitteesPart({ bodies, leaders, heading = true }: { bodies: Body[]; leaders: Leader[]; heading?: boolean }) {
  const committees = committeesOf(bodies);
  return (
    <div>
      {heading ? <h2 className="h-xl">Committees</h2> : null}
      <ul className={`${heading ? 'mt-6 ' : ''}grid gap-4 sm:grid-cols-2 lg:grid-cols-3`}>
        {committees.map((c) => (
          <li key={c.name}>
            <Link href={`/student-groups/${c.slug}`} className="row-link press group block h-full rounded-xl bg-p950 p-5 text-mist no-underline transition-colors hover:bg-p900">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="display text-3xl leading-[.95] text-white"><span className="row-title">{c.name.replace(/ Committee$/, '')}</span></h3>
                  <p className="mt-1 text-sm text-p300">Committee{c.ccas.length ? ` · ${c.ccas.length} group${c.ccas.length === 1 ? '' : 's'}` : ''}</p>
                </div>
                {(() => { const h = of(leaders, 'Committee', c.name)[0]; return h ? <Avatar name={h.name} photo={h.photo} size={56} dark /> : null; })()}
              </div>
              <Leaders className="mt-3 [&_.text-muted]:text-p300 [&_.font-medium]:text-white" list={of(leaders, 'Committee', c.name)} />
              <span aria-hidden className="row-arrow mt-3 inline-block text-2xl text-pink">→</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function YearsPart({ bodies, leaders, heading = true }: { bodies: Body[]; leaders: Leader[]; heading?: boolean }) {
  const years = bodies.filter((b) => b.level === 'Year' && b.status === 'Active').sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div>
      {heading ? <h2 className="h-xl">Year &amp; stream representatives</h2> : null}
      <div className={`${heading ? 'mt-6 ' : ''}grid gap-4 sm:grid-cols-2 lg:grid-cols-5`}>
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
  );
}
