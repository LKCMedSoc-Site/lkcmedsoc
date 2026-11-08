'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePlasmicCanvasContext } from '@plasmicapp/loader-nextjs';
import { useScrollHidden } from '@/lib/useScrollHidden';

// The top bar behind both the ready-made header and the Sticky header bar: pinned to the top, slides away when scrolling down and straight back on any scroll up.
// "fixed" is pinned to the window itself, so it works wherever it sits in a Plasmic page; a spacer of the same height keeps the content from sliding under it.
// "sticky" stays in the page flow, but only works while its parent box is as tall as the page (fine for the site's own layout).
export default function PinnedBar({ children, className = '', base = '', pinned = 'sticky', hideOnScrollDown = true, keepVisible }: {
  children?: ReactNode; className?: string; base?: string; pinned?: 'fixed' | 'sticky'; hideOnScrollDown?: boolean; keepVisible?: () => boolean;
}) {
  const inStudio = !!usePlasmicCanvasContext(); // never hide while designing
  const hidden = useScrollHidden({ disabled: !hideOnScrollDown || inStudio, keepVisible: () => !!keepVisible?.() || !!document.querySelector('.hm[data-open="true"]') });
  const ref = useRef<HTMLElement>(null);
  const [height, setHeight] = useState(64);
  useEffect(() => {
    if (pinned !== 'fixed' || !ref.current) return;
    const el = ref.current;
    const measure = () => setHeight(el.offsetHeight || 64);
    measure();
    const ro = new ResizeObserver(measure); ro.observe(el);
    return () => ro.disconnect();
  }, [pinned]);
  const place = pinned === 'fixed' ? 'fixed inset-x-0 top-0' : 'sticky top-0';
  return (
    <>
      {pinned === 'fixed' ? <div aria-hidden style={{ height }} /> : null}
      <header ref={ref} data-hidden={hidden} className={`${place} z-50 transition-transform duration-300 ease-in-out ${hidden ? '-translate-y-full' : 'translate-y-0'} ${base} ${className}`}>{children}</header>
    </>
  );
}
