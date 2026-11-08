'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUpRight, BookOpen, ChevronDown, Menu, Search, X } from 'lucide-react';
import { RESOURCES, APPLY, QUICK, type NavItem } from '@/lib/nav';
import { SITE } from '@/lib/site';
import { useSiteMenu } from '@/lib/useSiteMenu';
import SearchOverlay, { type SearchItem } from '@/components/SearchOverlay';
import ChildLink from './ChildLink';

// The phone menu: a round button that opens a full-screen sheet with the whole menu, the quick links, and Resources and Apply pinned at the bottom.
export default function MobileMenu({ groups = [], index = [], menuItems, ctaText, ctaUrl, logoText, className = '', onOpenChange }: { groups?: NavItem[]; index?: SearchItem[]; menuItems?: NavItem[]; ctaText?: string; ctaUrl?: string; logoText?: string; className?: string; onOpenChange?: (open: boolean) => void }) {
  const { nav, items } = useSiteMenu(groups, index, menuItems);
  const [open, setOpenState] = useState(false);
  const [find, setFind] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const path = usePathname();
  const setOpen = (v: boolean) => { setOpenState(v); onOpenChange?.(v); };
  useEffect(() => { setOpen(false); setFind(false); }, [path]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open} className={`press grid h-10 w-10 place-items-center rounded-full bg-p900 text-white lg:hidden ${className}`}><Menu className="h-5 w-5" /></button>
      {open ? createPortal(
        <div className="fixed inset-0 z-[60] flex flex-col bg-p950 text-white lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="flex h-16 shrink-0 items-center justify-between px-4">
            <span className="display text-3xl">{logoText || SITE.name}</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="press grid h-10 w-10 place-items-center rounded-full bg-p900"><X className="h-5 w-5" /></button>
          </div>
          <nav aria-label="Mobile" className="flex-1 overflow-y-auto px-4 pb-4">
            <button type="button" onClick={() => { setOpen(false); setFind(true); }} className="flex w-full items-center gap-3 rounded-xl bg-p900 px-4 py-3 text-left text-mist"><Search aria-hidden className="h-5 w-5" />Search pages and CCAs</button>
            <ul className="mt-2">
              {nav.map((item) => (
                <li key={item.label} className="border-b border-p900">
                  {item.children ? (
                    <>
                      <button type="button" aria-expanded={expanded === item.label} onClick={() => setExpanded(expanded === item.label ? null : item.label)} className="flex w-full items-center justify-between py-3">
                        <span className="display text-5xl">{item.label}</span><ChevronDown aria-hidden className={`h-6 w-6 text-pink transition-transform ${expanded === item.label ? 'rotate-180' : ''}`} />
                      </button>
                      {expanded === item.label ? (
                        <ul className="pb-4">
                          {item.children.map((c) => <li key={c.href + c.label}><ChildLink c={c} className="block py-2 text-lg text-mist no-underline">{c.label}{c.note ? <span className="block text-sm text-p300">{c.note}</span> : null}</ChildLink></li>)}
                        </ul>
                      ) : null}
                    </>
                  ) : <Link href={item.href} className="display block py-3 text-5xl text-white no-underline">{item.label}</Link>}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm font-bold text-p300">Quick links for students</p>
            <ul className="mt-2 grid grid-cols-2 gap-2">
              {QUICK.map((q) => <li key={q.label}><a href={q.href} target="_blank" rel="noopener" className="press flex min-h-14 items-center justify-between gap-2 rounded-xl bg-p900 px-3 py-2 text-sm font-bold text-white no-underline">{q.label}<ArrowUpRight aria-hidden className="h-4 w-4 shrink-0 text-pink" /></a></li>)}
            </ul>
          </nav>
          <div className="grid shrink-0 grid-cols-2 gap-3 border-t border-p900 bg-p950 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Link href={RESOURCES.href} className="press flex h-12 items-center justify-center gap-2 rounded-full border border-p300/60 font-bold text-white no-underline"><BookOpen aria-hidden className="h-4 w-4" />Resources</Link>
            <a href={ctaUrl || APPLY.href} target="_blank" rel="noopener" className="press flex h-12 items-center justify-center gap-1.5 rounded-full bg-pink font-bold text-p900 no-underline">{ctaText || APPLY.label}<ArrowUpRight aria-hidden className="h-4 w-4" /></a>
          </div>
        </div>,
        document.body,
      ) : null}
      <SearchOverlay open={find} onClose={() => setFind(false)} items={items} />
    </>
  );
}
