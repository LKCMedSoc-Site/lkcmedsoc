'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowRight, ArrowUpRight, ChevronDown, BookOpen, Menu, Search, X } from 'lucide-react';
import { NAV, RESOURCES, APPLY, QUICK, type NavItem } from '@/lib/nav';
import { SITE } from '@/lib/site';
import SearchOverlay, { type SearchItem } from '@/components/SearchOverlay';

// Sticky bar: slides away on scroll down, returns on scroll up. Menu content lives in src/lib/nav.ts.
// Desktop: drop-down panels with a line about each page. Mobile: full-screen menu with the two things
// students use most (Students' Corner, Apply) pinned at the bottom.
function ChildLink({ c, className, children }: { c: NavItem; className: string; children: React.ReactNode }) {
  return c.external ? <a href={c.href} target="_blank" rel="noopener" className={className}>{children}</a> : <Link href={c.href} className={className}>{children}</Link>;
}

export default function Header({ index = [], groups = [] }: { index?: SearchItem[]; groups?: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [find, setFind] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const path = usePathname();

  useEffect(() => { setOpen(false); setFind(false); }, [path]);
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => { const y = window.scrollY; setHidden(y > 120 && y > last + 4); if (Math.abs(y - last) > 4) last = y; };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /input|textarea|select/i.test((e.target as HTMLElement)?.tagName ?? '') || (e.target as HTMLElement)?.isContentEditable;
      if ((e.key === '/' && !typing) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) { e.preventDefault(); setFind(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const nav = NAV.map((n) => (n.label === 'Student Groups' && groups.length ? { ...n, children: groups } : n));
  const items: SearchItem[] = [
    ...nav.flatMap((n) => [{ label: n.label, href: n.href, kind: 'Page', hint: n.note }, ...(n.children ?? []).map((c) => ({ label: c.label, href: c.href, kind: 'Page', hint: c.note }))]),
    ...index,
  ].filter((v, i, a) => a.findIndex((x) => x.href === v.href && x.label === v.label) === i);
  const here = (href: string) => (href === '/' ? path === '/' : path === href || path.startsWith(href + '/'));

  return (
    <>
      <header className={`sticky top-0 z-50 bg-p950 text-p50 transition-transform duration-300 ${hidden && !open ? '-translate-y-full' : ''}`}>
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link href="/" className="flex items-baseline gap-2 no-underline" aria-label={`${SITE.name} home`}>
            <span className="display text-3xl text-white">{SITE.name}</span>
            <span className="hidden text-sm text-p300 xl:inline">Students&rsquo; Medical Society</span>
          </Link>

          <nav aria-label="Main" className="hidden h-full items-center lg:flex">
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

          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setFind(true)} aria-label="Search the site" className="press flex h-10 items-center gap-2 rounded-full border border-p500 px-3 text-sm text-mist hover:bg-p900 lg:px-4">
              <Search aria-hidden className="h-4 w-4" /><span className="hidden lg:inline">Search</span><kbd className="hidden rounded border border-p500 px-1.5 text-xs text-p300 xl:inline">/</kbd>
            </button>
            <a href={APPLY.href} target="_blank" rel="noopener" className="press hidden h-10 items-center gap-1.5 rounded-full bg-pink px-5 text-sm font-bold text-p900 no-underline hover:bg-white lg:flex">{APPLY.label}<ArrowUpRight aria-hidden className="h-4 w-4" /></a>
            <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open} className="press grid h-10 w-10 place-items-center rounded-full bg-p900 text-white lg:hidden"><Menu className="h-5 w-5" /></button>
          </div>
        </div>
      </header>

      {open ? (
        <div className="fixed inset-0 z-[60] flex flex-col bg-p950 text-white lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="flex h-16 shrink-0 items-center justify-between px-4">
            <span className="display text-3xl">{SITE.name}</span>
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
            <a href={APPLY.href} target="_blank" rel="noopener" className="press flex h-12 items-center justify-center gap-1.5 rounded-full bg-pink font-bold text-p900 no-underline">{APPLY.label}<ArrowUpRight aria-hidden className="h-4 w-4" /></a>
          </div>
        </div>
      ) : null}

      <SearchOverlay open={find} onClose={() => setFind(false)} items={items} />
    </>
  );
}
