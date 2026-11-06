'use client';
import { useEffect, useRef, useState } from 'react';

// A number that counts up when it scrolls into view. "800+" counts to 800 and keeps the "+".
export default function Counter({ value, className = '' }: { value: string; className?: string }) {
  const m = /^(\D*)(\d[\d,]*)(.*)$/.exec(value);
  const target = m ? Number(m[2].replace(/,/g, '')) : NaN;
  const [shown, setShown] = useState(m ? m[2] : value);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !m || Number.isNaN(target)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now(), dur = 1400;
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / dur), eased = 1 - Math.pow(1 - p, 3);
        setShown(Math.round(target * eased).toLocaleString('en-US'));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return <span ref={ref} className={className}>{m?.[1]}{shown}{m?.[3]}</span>;
}
