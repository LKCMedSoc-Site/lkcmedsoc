'use client';
import type { ReactNode } from 'react';
import PinnedBar from './PinnedBar';

// A bar pinned to the top of the page. It slides away when scrolling down and comes straight back on any scroll up. Design what is inside in Studio.
// It stays put while a drop-down menu is open.
export default function StickyHeader({ children, hideOnScrollDown = true, pinned = 'fixed', className = '' }: { children?: ReactNode; hideOnScrollDown?: boolean; pinned?: 'fixed' | 'sticky'; className?: string }) {
  return <PinnedBar pinned={pinned} hideOnScrollDown={hideOnScrollDown} className={className}>{children}</PinnedBar>;
}
