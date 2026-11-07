'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, ChevronDown } from 'lucide-react';
import type { NavItem } from '@/lib/nav';
import type { SearchItem } from '@/components/SearchOverlay';
import { useSiteMenu } from '@/lib/useSiteMenu';
import ChildLink from './ChildLink';

// The desktop menu: top-level links with a drop-down panel (a line about each page) under the ones that have children.
// The panels stretch across the nearest positioned ancestor, so put this inside a bar with "position: relative" (the site header is one).
export default function NavMenu({ groups = [], index = [], className = '' }: { groups?: NavItem[]; index?: SearchItem[]; className?: string }) {
  const { nav } = useSiteMenu(groups, index);
  const path = usePathname();
  const here = (href: string) => (href === '/' ? path === '/' : path === href || path.startsWith(href + '/'));
  return (
    <nav aria-label="Main" className={`hidden h-full items-center lg:flex ${className}`}>
      {nav.map((item) => item.children ? (
        <div key={item.label} className="group flex h-full items-center">
          <Link href={item.href} aria-current={here(item.href) ? 'page' : undefined} className="nav-link flex items-center gap-1">
            {item.label}<ChevronDown aria-hidden className="h-4 w-4 text-p300 transition-transform group-hover:rotate-180 group-focus-within:rotate-180" />
          </Link>
          <div className="invisible absolute inset-x-0 top-full translate-y-1 border-t border-p900 bg-p950 opacity-0 shadow-2xl transition duration-200 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
            <div className="mx-auto grid max-w-6xl grid-cols-12 gap-8 px-4 py-8">
              <div className="col-span-4">
                <p className="display text-5xl text-white">{item.label}</p>
                {item.note ? <p className="mt-3 max-w-xs text-mist">{item.note}</p> : null}
                <Link href={item.href} className="link-arrow mt-5 inline-block !text-pink !decoration-p500">See all {item.label.toLowerCase()}</Link>
              </div>
              <ul className="col-span-8 grid grid-cols-2 gap-x-6 gap-y-1">
                {item.children.map((c) => (
                  <li key={c.href + c.label}>
                    <ChildLink c={c} className="group/link flex items-start justify-between gap-3 rounded-xl px-3 py-3 text-white no-underline hover:bg-p900">
                      <span><span className="block font-bold">{c.label}</span>{c.note ? <span className="block text-sm text-mist">{c.note}</span> : null}</span>
                      <ArrowRight aria-hidden className="mt-1 h-4 w-4 shrink-0 -translate-x-1 text-pink opacity-0 transition group-hover/link:translate-x-0 group-hover/link:opacity-100" />
                    </ChildLink>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <Link key={item.label} href={item.href} aria-current={here(item.href) ? 'page' : undefined} className="nav-link">{item.label}</Link>
      ))}
    </nav>
  );
}
