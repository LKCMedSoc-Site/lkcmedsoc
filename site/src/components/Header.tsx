'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { APPLY, type Highlight, type NavItem } from '@/lib/nav';
import { SITE } from '@/lib/site';
import { useSiteMenu } from '@/lib/useSiteMenu';
import type { SearchItem } from '@/components/SearchOverlay';
import NavMenu from '@/components/nav/NavMenu';
import MobileMenu from '@/components/nav/MobileMenu';
import SiteSearch from '@/components/SiteSearch';

// The ready-made site header: logo, the menu, search, Apply and the phone menu. It slides away on scroll down and returns on scroll up.
// It is made of NavMenu, SiteSearch and MobileMenu, which can also be used on their own to design a different header in Plasmic.
export type HeaderProps = {
  index?: SearchItem[]; groups?: NavItem[];
  /** Everything below is optional; leave it out for the site's usual header. They are what the Plasmic block (SiteHeaderBlock) edits. */
  logoText?: string; tagline?: string; menuItems?: NavItem[]; highlights?: Highlight[]; ctaText?: string; ctaUrl?: string; previewOpen?: string;
};
export default function Header({ index = [], groups = [], logoText, tagline, menuItems, highlights, ctaText, ctaUrl, previewOpen }: HeaderProps) {
  const menu = useSiteMenu(groups, index, menuItems);
  const [hidden, setHidden] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => { const y = window.scrollY; setHidden(y > 120 && y > last + 4); if (Math.abs(y - last) > 4) last = y; };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <header className={`sticky top-0 z-50 bg-p950 text-p50 transition-transform duration-300 ${hidden && !menuOpen ? '-translate-y-full' : ''}`}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-baseline gap-2 no-underline" aria-label={`${logoText || SITE.name} home`}>
          <span className="display text-3xl text-white">{logoText || SITE.name}</span>
          <span className="hidden text-sm text-p300 2xl:inline">{tagline ?? 'Students\u2019 Medical Society'}</span>
        </Link>
        <NavMenu groups={menu.groups} index={menu.index} items={menuItems} highlights={highlights} previewOpen={previewOpen} />
        <div className="flex items-center gap-2">
          <SiteSearch groups={menu.groups} index={menu.index} />
          <a href={ctaUrl || APPLY.href} target="_blank" rel="noopener" className="press hidden h-10 items-center gap-1.5 rounded-full bg-pink px-5 text-sm font-bold text-p900 no-underline hover:bg-white lg:flex">{ctaText || APPLY.label}<ArrowUpRight aria-hidden className="h-4 w-4" /></a>
          <MobileMenu groups={menu.groups} index={menu.index} menuItems={menuItems} ctaText={ctaText} ctaUrl={ctaUrl} logoText={logoText} onOpenChange={setMenuOpen} />
        </div>
      </div>
    </header>
  );
}
