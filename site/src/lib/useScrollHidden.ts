'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * True while a bar should be tucked away: the visitor is scrolling DOWN and is past `hideAfter` pixels.
 * Any upward scroll of at least `delta` pixels brings it straight back, wherever they are on the page, and it is always shown near the top.
 * Scroll events with no real movement change nothing (they used to count as "scrolling up" and make the bar flicker).
 */
export function useScrollHidden({ hideAfter = 80, delta = 8, disabled = false, keepVisible }: { hideAfter?: number; delta?: number; disabled?: boolean; keepVisible?: () => boolean } = {}) {
  const [hidden, setHidden] = useState(false);
  const keep = useRef(keepVisible); keep.current = keepVisible;
  useEffect(() => {
    if (disabled) { setHidden(false); return; }
    let last = window.scrollY; let frame = 0;
    const update = () => {
      frame = 0;
      const y = window.scrollY;
      if (y <= 10) { setHidden(false); last = y; return; }
      const dy = y - last;
      if (Math.abs(dy) < delta) return;
      setHidden(dy > 0 && y > hideAfter && !keep.current?.());
      last = y;
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); if (frame) cancelAnimationFrame(frame); };
  }, [disabled, hideAfter, delta]);
  return hidden;
}
