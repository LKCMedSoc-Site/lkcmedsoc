import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { slugify, type Body, type Group, type Leader } from '@/lib/records';

// The "CCA spotlight" content: this week's featured group, who leads it, and the list of committees to find yours.
// Made for a dark background (the home page puts it on a deep plum band).
export default function CcaSpotlight({ spot, spotLeaders, groups, ccaCount }: { spot: { c: Body; g: Group }; spotLeaders: Leader[]; groups: Group[]; ccaCount: number }) {
  return (
    <div className="grid gap-10 md:grid-cols-12 md:gap-8">
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
  );
}
