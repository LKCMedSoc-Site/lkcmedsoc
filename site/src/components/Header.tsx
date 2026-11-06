'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { NAV } from '@/lib/nav';
import { SITE } from '@/lib/site';

// Sticks to the top, slides away when you scroll down and returns when you scroll up.
// The menu itself comes from src/lib/nav.ts.
export default function Header() {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const path = usePathname();
  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => { const y = window.scrollY; setHidden(y > 120 && y > last + 4); if (Math.abs(y - last) > 4) last = y; };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`sticky top-0 z-50 bg-p900/90 text-white backdrop-blur-md transition-transform duration-300 ${hidden && !open ? '-translate-y-full' : ''}`}>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-3">
        <Link href="/" className="display text-2xl text-white no-underline">
          {SITE.name} <span className="hidden text-p300 sm:inline">Students&rsquo; Medical Society</span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 text-sm font-medium lg:flex">
          {NAV.map((item) =>
            item.children ? (
              <div key={item.label} className="group relative">
                <Link href={item.href} className="flex items-center gap-1 rounded-full px-4 py-2 text-white no-underline hover:bg-white/10">
                  {item.label} <span aria-hidden className="text-[10px] text-p300">▾</span>
                </Link>
                <ul className="invisible absolute left-0 top-full min-w-56 translate-y-1 rounded-2xl border border-line bg-white p-2 text-ink opacity-0 shadow-xl transition group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                  {item.children.map((c) => (
                    <li key={c.href + c.label}><Link className="block rounded-xl px-3 py-2 text-ink no-underline hover:bg-p100" href={c.href}>{c.label}</Link></li>
                  ))}
                </ul>
              </div>
            ) : item.external ? (
              <a key={item.label} href={item.href} className="ml-2 rounded-full bg-white px-5 py-2 font-bold text-p900 no-underline hover:bg-p100" target="_blank" rel="noopener">{item.label}</a>
            ) : (
              <Link key={item.label} href={item.href} className="rounded-full px-4 py-2 text-white no-underline hover:bg-white/10">{item.label}</Link>
            ),
          )}
        </nav>

        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Menu" className="grid h-10 w-10 place-items-center rounded-full border border-white/30 lg:hidden">
          <span aria-hidden className="text-xl leading-none">{open ? '✕' : '☰'}</span>
        </button>
      </div>

      {open ? (
        <nav aria-label="Mobile" className="max-h-[80svh] overflow-y-auto border-t border-white/10 px-4 pb-6 pt-2 lg:hidden">
          {NAV.map((item) => (
            <div key={item.label} className="border-b border-white/10 py-3">
              {item.external ? (
                <a href={item.href} target="_blank" rel="noopener" className="inline-block rounded-full bg-white px-5 py-2 font-bold text-p900 no-underline">{item.label}</a>
              ) : (
                <Link href={item.href} className="display text-3xl text-white no-underline">{item.label}</Link>
              )}
              {item.children ? (
                <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                  {item.children.map((c) => <li key={c.href + c.label}><Link href={c.href} className="block py-1 text-sm text-p100 no-underline">{c.label}</Link></li>)}
                </ul>
              ) : null}
            </div>
          ))}
        </nav>
      ) : null}
    </header>
  );
}
