import Link from 'next/link';
import { SITE } from '@/lib/site';

export default function Footer() {
  return (
    <footer className="mt-16 bg-p900 text-p100">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-3">
        <div>
          <div className="display text-3xl text-white">{SITE.name}</div>
          <p className="mt-2 text-sm text-p300">{SITE.fullName}</p>
        </div>
        <div className="text-sm">
          <p>{SITE.address}</p>
          <p className="mt-2"><a className="underline" href={`mailto:${SITE.email}`}>{SITE.email}</a></p>
        </div>
        <div className="text-sm">
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {SITE.socials.map((s) => (
              <li key={s.label}><a className="underline" href={s.href} target="_blank" rel="noopener">{s.label}</a></li>
            ))}
          </ul>
          <p className="mt-4"><Link className="underline" href="/policy">Policy</Link> · <Link className="underline" href="/news">News</Link> · <Link className="underline" href="/events">Events</Link></p>
        </div>
      </div>
      <div className="border-t border-p700 py-4 text-center text-xs text-p300">© {new Date().getFullYear()} {SITE.name}</div>
    </footer>
  );
}
