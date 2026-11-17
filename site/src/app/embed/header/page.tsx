import type { Metadata } from 'next';
import Header from '@/components/Header';
import { getBodies, groupsOf, slugify } from '@/lib/records';
import { PlasmicOr } from '@/lib/plasmic-page';
import EmbedBridge from './EmbedBridge';

export const metadata: Metadata = { title: 'LKCMedSoc header', robots: { index: false, follow: false } };

// The site header on its own, to be shown in a frame at the top of the other LKCMedSoc apps (records, activities, feedback, gazette, policy).
// It is the same header as the website's (a header designed in Plasmic Studio under the name "Header" replaces the built-in one), so editing it there changes it everywhere.
// The apps' script (shared/suite-nav.js) shows it and keeps the frame the right size; see EmbedBridge.
export default async function Page({ searchParams }: { searchParams: Promise<{ signin?: string }> }) {
  // ?signin=0: no account button. Used when the header is loaded from an address that cannot see the shared sign-in cookie (the website's Vercel address).
  const showSignIn = (await searchParams).signin !== '0';
  const bodies = await getBodies().catch(() => []);
  const gs = groupsOf(bodies);
  const groups = gs.map((g) => ({ label: g.title, href: `/about/committee/${g.slug}` }));
  const index = gs.flatMap((g) => g.ccas.map((c) => ({ label: c.name, href: `/student-groups/${g.slug}/${slugify(c.name)}`, kind: 'CCA', hint: g.title })));
  return (
    <>
      <EmbedBridge />
      <PlasmicOr lookup="Header"><Header index={index} groups={groups} hideOnScrollDown={false} showSignIn={showSignIn} /></PlasmicOr>
    </>
  );
}
