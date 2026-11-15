import type { Metadata } from 'next';
import Link from 'next/link';
import PageHero from '@/components/blocks/PageHero';
import { plasmicData, PlasmicView } from '@/lib/plasmic-page';

export const metadata: Metadata = { title: 'About' };
export const revalidate = 300;

const LINKS = [
  { href: '/about/leadership', title: 'Leadership', text: 'The ExCo, committees, year reps and house reps.' },
  { href: '/about/house-system', title: 'House system', text: 'The houses and their representatives.' },
  { href: '/about/honour-roll', title: 'Honour roll', text: 'Every team that came before.' },
  { href: '/about/work-with-us', title: 'Work with us', text: 'Join a committee or start a group.' },
  { href: '/about/alumni', title: 'Alumni', text: 'Staying connected after graduation.' },
];

export default async function About() {
  // A page designed in Plasmic at this path (the creative About page) replaces the coded one below.
  const designed = await plasmicData('/about');
  if (designed) return <PlasmicView data={designed} />;
  return (
    <>
      <PageHero title="About" intro="The student society of the Lee Kong Chian School of Medicine: who we are and how we are put together." />
      <section className="band band-pale band-last" style={{ zIndex: 20 }}>
        <div className="mx-auto max-w-4xl px-4">
          <ul className="divide-y divide-line border-y border-line">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="row-link flex items-center justify-between gap-4 py-5 no-underline">
                  <span><span className="row-title display block text-3xl text-p900">{l.title}</span><span className="block text-muted">{l.text}</span></span>
                  <span aria-hidden className="row-arrow display text-3xl text-p500">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
