import type { Metadata } from 'next';
import PageHero from '@/components/blocks/PageHero';
import SignInPage from './SignInPage';

export const metadata: Metadata = { title: 'Sign in', robots: { index: false } };

// The plain sign-in page. The header's Sign in button opens a lightbox instead; this page is for email links and links from the other LKCMedSoc sites.
// `?next=` says where to go afterwards: a page on this site, or another lkcmedsoc.com address.
export default function Page() {
  return (
    <>
      <PageHero title="Sign in" intro="One sign-in works on every LKCMedSoc site." />
      <section className="band band-pale band-last" style={{ zIndex: 20 }}>
        <div className="mx-auto max-w-md px-4"><SignInPage /></div>
      </section>
    </>
  );
}
