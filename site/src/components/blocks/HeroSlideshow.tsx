'use client';
import { useEffect, useState } from 'react';
import SafeImage from '@/components/SafeImage';

export type Slide = { image?: string; alt?: string };

// A photo background for a hero that slowly cross-fades through a set of photos.
// In Plasmic: put it as the FIRST item inside the hero box (the hero box must be position relative, which our hero is), then add or change photos
// under "Photos". It fills the box behind everything else. A plum wash sits over the photos so white text stays readable.
// With reduced motion, or a single photo, it shows the first photo and does not change.
export default function HeroSlideshow({ slides = [], seconds = 6, wash = 62, className = '' }: { slides?: Slide[]; seconds?: number; wash?: number; className?: string }) {
  const list = (slides ?? []).filter((s) => s && s.image);
  const [i, setI] = useState(0);
  useEffect(() => {
    if (list.length < 2) return;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ms = Math.max(3, seconds || 6) * 1000;
    const t = setInterval(() => { if (document.visibilityState === 'visible') setI((n) => (n + 1) % list.length); }, ms);
    return () => clearInterval(t);
  }, [list.length, seconds]);
  const active = list.length ? i % list.length : 0;
  const alpha = Math.min(100, Math.max(0, wash)) / 100;
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 z-0 overflow-hidden bg-p950 ${className}`}>
      {list.map((s, k) => (
        <div key={k} className="absolute inset-0 transition-opacity duration-[1600ms] ease-in-out motion-reduce:transition-none" style={{ opacity: k === active ? 1 : 0 }}>
          <SafeImage src={s.image} alt="" priority={k === 0} sizes="100vw" className="h-full w-full" />
        </div>
      ))}
      <div className="absolute inset-0" style={{ backgroundColor: `rgba(29, 15, 27, ${alpha})` }} />
    </div>
  );
}
