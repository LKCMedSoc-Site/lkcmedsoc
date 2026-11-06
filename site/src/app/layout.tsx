import type { Metadata } from 'next';
import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { SITE } from '@/lib/site';
import { getBodies, groupsOf, slugify } from '@/lib/records';

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `${SITE.name} · Students' Medical Society`, template: `%s · ${SITE.name}` },
  description: 'The student organisation representing all medical students at LKCMedicine.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Committees become the Student Groups menu; every CCA becomes a search result with its own page.
  const bodies = await getBodies().catch(() => []);
  const gs = groupsOf(bodies);
  const groups = gs.map((g) => ({ label: g.title, href: `/student-groups/${g.slug}` }));
  const index = gs.flatMap((g) => g.ccas.map((c) => ({ label: c.name, href: `/student-groups/${g.slug}/${slugify(c.name)}`, kind: 'CCA', hint: g.title })));
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <Header index={index} groups={groups} />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
