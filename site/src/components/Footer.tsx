import Link from 'next/link';
import { NAV } from '@/lib/nav';
import { SITE } from '@/lib/site';

export default function Footer() {
  return (
    <footer className="relative mt-24 overflow-hidden bg-p950 text-mist">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-10 pt-16 md:grid-cols-4">
        <div className="md:col-span-2">
          <p className="display text-4xl text-white">Students&rsquo; Medical Society</p>
          <p className="mt-2 max-w-sm text-sm text-p300">{SITE.fullName}</p>
          <p className="mt-6 max-w-sm text-sm">{SITE.address}</p>
          <p className="mt-2"><a className="text-white underline" href={`mailto:${SITE.email}`}>{SITE.email}</a></p>
        </div>
        <div>
          <p className="eyebrow eyebrow-light">Explore</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link className="text-mist no-underline hover:text-white" href="/">Home</Link></li>
            {NAV.map((n) => <li key={n.label}><Link className="text-mist no-underline hover:text-white" href={n.href}>{n.label}</Link></li>)}
            
            <li><Link className="text-mist no-underline hover:text-white" href="/policy">Policy</Link></li>
          </ul>
        </div>
        <div>
          <p className="eyebrow eyebrow-light">Follow</p>
          <ul className="mt-3 space-y-2 text-sm">
            {SITE.socials.map((s) => <li key={s.label}><a className="text-mist no-underline hover:text-white" href={s.href} target="_blank" rel="noopener">{s.label} ↗</a></li>)}
          </ul>
        </div>
      </div>
      <div aria-hidden className="display select-none whitespace-nowrap px-4 text-center text-[19vw] leading-[.8] text-p900/70">{SITE.name}</div>
      <div className="border-t border-p900 py-4 text-center text-xs text-p300">© {new Date().getFullYear()} {SITE.name}</div>
    </footer>
  );
}
