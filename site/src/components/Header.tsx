'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { APPLY, type NavItem } from '@/lib/nav';
import { SITE } from '@/lib/site';
import { useSiteMenu } from '@/lib/useSiteMenu';
import type { SearchItem } from '@/components/SearchOverlay';
import NavMenu from '@/components/nav/NavMenu';
import MobileMenu from '@/components/nav/MobileMenu';
import SiteSearch from '@/components/SiteSearch';

// The ready-made site header: logo, the menu, search, Apply and the phone menu. It slides away on scroll down and returns on scroll up.
// It is made of NavMenu, SiteSearch and MobileMenu, which can also be used on their own to design a different header in Plasmic.
export default function Header({ index = [], groups = [] }: { index?: SearchItem[]; groups?: NavItem[] }) {
  const menu = useSiteMenu(groups, index);
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
        <Link href="/" className="flex items-baseline gap-2 no-underline" aria-label={`${SITE.name} home`}>
          <span className="display text-3xl text-white">{SITE.name}</span>
          <span className="hidden text-sm text-p300 2xl:inline">Students&rsquo; Medical Society</span>
        </Link>
        <NavMenu groups={menu.groups} index={menu.index} />
        <div className="flex items-center gap-2">
          <SiteSearch groups={menu.groups} index={menu.index} />
          <a href={APPLY.href} target="_blank" rel="noopener" className="press hidden h-10 items-center gap-1.5 rounded-full bg-pink px-5 text-sm font-bold text-p900 no-underline hover:bg-white lg:flex">{APPLY.label}<ArrowUpRight aria-hidden className="h-4 w-4" /></a>
          <MobileMenu groups={menu.groups} index={menu.index} onOpenChange={setMenuOpen} />
        </div>
      </div>
    </header>
  );
}
