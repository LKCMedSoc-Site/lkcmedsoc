'use client';
import { useEffect, useState, type ReactNode } from 'react';

// A bar that stays at the top of the page, slides away when scrolling down and returns when scrolling up. Design what is inside in Studio.
// It stays put while a drop-down menu is open.
export default function StickyHeader({ children, hideOnScrollDown = true, className = '' }: { children?: ReactNode; hideOnScrollDown?: boolean; className?: string }) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (!hideOnScrollDown) { setHidden(false); return; }
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY; const dy = y - last;
      if (Math.abs(dy) <= 4) return; // a scroll event with no real movement changes nothing
      const menuOpen = !!document.querySelector('.hm[data-open="true"]');
      setHidden(dy > 0 && y > 120 && !menuOpen);
      last = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [hideOnScrollDown]);
  return <header className={`sticky-bar ${className}`} data-hidden={hidden}>{children}</header>;
}
