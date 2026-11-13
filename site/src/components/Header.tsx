'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { APPLY, type Highlight, type NavItem } from '@/lib/nav';
import { SITE } from '@/lib/site';
import { useSiteMenu } from '@/lib/useSiteMenu';
import type { SearchItem } from '@/components/SearchOverlay';
import NavMenu from '@/components/nav/NavMenu';
import MobileMenu from '@/components/nav/MobileMenu';
import SiteSearch from '@/components/SiteSearch';
import PinnedBar from '@/components/blocks/PinnedBar';
import AccountButton from '@/components/nav/AccountButton';

// The ready-made site header: logo, the menu, search, Apply and the phone menu. It slides away on scroll down and returns on scroll up.
// It is made of NavMenu, SiteSearch and MobileMenu, which can also be used on their own to design a different header in Plasmic.
export type HeaderProps = {
  index?: SearchItem[]; groups?: NavItem[];
  /** Everything below is optional; leave it out for the site's usual header. They are what the Plasmic block (SiteHeaderBlock) edits. */
  logoText?: string; tagline?: string; menuItems?: NavItem[]; highlights?: Highlight[]; ctaText?: string; ctaUrl?: string; previewOpen?: string;
  /** The sign-in button: shown by default; the label can be changed. */
  showSignIn?: boolean; signInText?: string;
  /** 'sticky' (the site layout) or 'fixed' (pinned to the window; used in Plasmic pages). */
  pinned?: 'fixed' | 'sticky'; hideOnScrollDown?: boolean;
  /** Given by Plasmic Studio so its size and position controls work on this block. */
  className?: string;
};
export default function Header({ index = [], groups = [], logoText, tagline, menuItems, highlights, ctaText, ctaUrl, previewOpen, showSignIn = true, signInText, pinned = 'sticky', hideOnScrollDown = true, className = '' }: HeaderProps) {
  const menu = useSiteMenu(groups, index, menuItems);
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <PinnedBar pinned={pinned} hideOnScrollDown={hideOnScrollDown} keepVisible={() => menuOpen} base="w-full bg-p950 text-p50" className={className}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-baseline gap-2 no-underline" aria-label={`${logoText || SITE.name} home`}>
          <span className="display text-3xl text-white">{logoText || SITE.name}</span>
          <span className="hidden text-sm text-p300 2xl:inline">{tagline ?? 'Students\u2019 Medical Society'}</span>
        </Link>
        <NavMenu groups={menu.groups} index={menu.index} items={menuItems} highlights={highlights} previewOpen={previewOpen} />
        <div className="flex items-center gap-2">
          <SiteSearch groups={menu.groups} index={menu.index} />
          {showSignIn ? <AccountButton label={signInText || 'Sign in'} className="hidden lg:block" /> : null}
          <a href={ctaUrl || APPLY.href} target="_blank" rel="noopener" className="press hidden h-10 items-center gap-1.5 rounded-full bg-pink px-5 text-sm font-bold text-p900 no-underline hover:bg-white lg:flex">{ctaText || APPLY.label}<ArrowUpRight aria-hidden className="h-4 w-4" /></a>
          <MobileMenu groups={menu.groups} index={menu.index} menuItems={menuItems} ctaText={ctaText} ctaUrl={ctaUrl} logoText={logoText} showSignIn={showSignIn} signInText={signInText} onOpenChange={setMenuOpen} />
        </div>
      </div>
    </PinnedBar>
  );
}
