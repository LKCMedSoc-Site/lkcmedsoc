import Link from 'next/link';
import type { Category } from '@/lib/posts';

/** The section bar under the Gazette masthead: Home, one link per category (managed by ExCo), and the full archive. `current` is "home", "all" or a category name. */
export default function GazetteNav({ current, categories }: { current: string; categories: Category[] }) {
  const items: { key: string; label: string; href: string }[] = [
    { key: 'home', label: 'Home', href: '/gazette' },
    ...categories.map((c) => ({ key: c.name, label: c.name, href: `/gazette/${c.slug}` })),
    { key: 'all', label: 'Archive', href: '/gazette/all' },
  ];
  return (
    <nav aria-label="Gazette sections" className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <ul className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 [scrollbar-width:none]">
        {items.map((i) => (
          <li key={i.key}>
            <Link href={i.href} aria-current={i.key === current ? 'page' : undefined}
              className={`press block whitespace-nowrap border-b-[3px] px-3.5 py-3 text-sm font-bold no-underline ${i.key === current ? 'border-p500 text-p950' : 'border-transparent text-muted hover:text-p900'}`}>
              {i.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
