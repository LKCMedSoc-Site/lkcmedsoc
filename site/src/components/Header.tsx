import Link from 'next/link';
import { NAV } from '@/lib/nav';
import { SITE } from '@/lib/site';

export default function Header() {
  return (
    <header className="bg-p900 text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="display text-2xl font-normal text-white no-underline">
          {SITE.name} <span className="text-p300">Students&rsquo; Medical Society</span>
        </Link>
        {/* No JavaScript needed: <details> gives a tap-to-open menu on phones, hover menus on desktop. */}
        <nav aria-label="Main" className="flex flex-wrap items-center gap-1 text-sm font-medium">
          {NAV.map((item) =>
            item.children ? (
              <details key={item.label} className="group relative">
                <summary className="flex cursor-pointer list-none items-center gap-1 rounded-md px-3 py-2 hover:bg-p700">
                  {item.label} <span aria-hidden className="text-p300">▾</span>
                </summary>
                <ul className="absolute right-0 z-20 mt-1 min-w-52 rounded-lg border border-line bg-white p-1 text-ink shadow-lg md:left-0 md:right-auto">
                  <li><Link className="block rounded-md px-3 py-2 hover:bg-p100" href={item.href}>{item.label}</Link></li>
                  {item.children.map((c) => (
                    <li key={c.href + c.label}><Link className="block rounded-md px-3 py-2 hover:bg-p100" href={c.href}>{c.label}</Link></li>
                  ))}
                </ul>
              </details>
            ) : item.external ? (
              <a key={item.label} href={item.href} className="rounded-md bg-white px-3 py-2 font-bold text-p900 hover:bg-p100" target="_blank" rel="noopener">{item.label}</a>
            ) : (
              <Link key={item.label} href={item.href} className="rounded-md px-3 py-2 hover:bg-p700">{item.label}</Link>
            ),
          )}
        </nav>
      </div>
    </header>
  );
}
