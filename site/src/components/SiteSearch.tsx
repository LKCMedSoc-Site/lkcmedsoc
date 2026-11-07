'use client';
import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { usePathname } from 'next/navigation';
import type { NavItem } from '@/lib/nav';
import { useSiteMenu } from '@/lib/useSiteMenu';
import SearchOverlay, { type SearchItem } from '@/components/SearchOverlay';

// The search button. Opens the finder for pages and CCAs; "/" or Ctrl/Cmd+K opens it from anywhere.
export default function SiteSearch({ groups = [], index = [], label = 'Search', className = '' }: { groups?: NavItem[]; index?: SearchItem[]; label?: string; className?: string }) {
  const { items } = useSiteMenu(groups, index);
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /input|textarea|select/i.test((e.target as HTMLElement)?.tagName ?? '') || (e.target as HTMLElement)?.isContentEditable;
      if ((e.key === '/' && !typing) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) { e.preventDefault(); setOpen(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Search the site" className={`press flex h-10 items-center gap-2 rounded-full border border-p500 px-3 text-sm text-mist hover:bg-p900 lg:px-4 ${className}`}>
        <Search aria-hidden className="h-4 w-4" /><span className="hidden lg:inline">{label}</span><kbd className="hidden rounded border border-p500 px-1.5 text-xs text-p300 xl:inline">/</kbd>
      </button>
      <SearchOverlay open={open} onClose={() => setOpen(false)} items={items} />
    </>
  );
}
