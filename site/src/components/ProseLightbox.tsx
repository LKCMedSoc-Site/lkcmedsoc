'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

// Click a picture in a group, house or committee write-up (anything inside .prose-lkc) to see it large. Pictures in a gallery open as a set you can
// step through; the picture's caption / alt text is shown under it. Mounted once in the layout and listening on the whole page, so the write-ups
// themselves stay plain HTML (they are saved Markdown rendered on the server, and Plasmic pages show them too).
type Item = { src: string; alt: string };
type View = { items: Item[]; i: number };

const FOCUSABLE = 'button:not([disabled])';
const contentImage = (el: Element | null): el is HTMLImageElement => el instanceof HTMLImageElement && !!el.closest('.prose-lkc') && !el.closest('a') && !!el.src;

export default function ProseLightbox() {
  const [view, setView] = useState<View | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const touchX = useRef<number | null>(null);

  const open = useCallback((img: HTMLImageElement) => {
    const gallery = img.closest('.blk-photos');
    const list = gallery ? Array.from(gallery.querySelectorAll('img')).filter(contentImage) : [img];
    opener.current = img;
    setView({ items: list.map((x) => ({ src: x.currentSrc || x.src, alt: x.alt || '' })), i: Math.max(0, list.indexOf(img)) });
  }, []);
  const close = useCallback(() => { setView(null); opener.current?.focus({ preventScroll: true }); }, []);
  const step = useCallback((d: number) => setView((v) => (v && v.items.length > 1 ? { ...v, i: (v.i + d + v.items.length) % v.items.length } : v)), []);

  // Open on click or Enter/Space. The pictures are made keyboard-reachable on the server (lightboxable in lib/markdown.ts), so nothing here changes the page.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const t = e.target as Element | null;
      if (contentImage(t)) { e.preventDefault(); open(t); }
    };
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as Element | null;
      if ((e.key === 'Enter' || e.key === ' ') && contentImage(t) && t.dataset.lb) { e.preventDefault(); open(t); }
    };
    document.addEventListener('click', onClick); document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('click', onClick); document.removeEventListener('keydown', onKey); };
  }, [open]);

  // While open: Esc closes, arrows step, Tab stays inside, the page behind does not scroll, and the next picture is fetched ahead.
  useEffect(() => {
    if (!view) return;
    const prevOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    box.current?.querySelector<HTMLElement>('[data-close]')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
      else if (e.key === 'Tab' && box.current) {
        const f = Array.from(box.current.querySelectorAll<HTMLElement>(FOCUSABLE)); if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; };
  }, [view !== null, close, step]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!view || view.items.length < 2) return;
    [1, -1].forEach((d) => { const n = view.items[(view.i + d + view.items.length) % view.items.length]; if (n) new Image().src = n.src; });
  }, [view]);

  if (!view) return null;
  const cur = view.items[view.i], many = view.items.length > 1;
  return (
    <div
      ref={box} role="dialog" aria-modal="true" aria-label="Photo viewer"
      className="lb-in fixed inset-0 z-[1000] flex flex-col items-center justify-center bg-black/90 p-4"
      onClick={(e) => { if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.backdrop) close(); }}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => { const x0 = touchX.current; touchX.current = null; if (x0 == null || !many) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1); }}
    >
      <button type="button" data-close onClick={close} aria-label="Close photo viewer" className="absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
        <X className="h-6 w-6" aria-hidden />
      </button>
      {many ? (
        <>
          <button type="button" onClick={() => step(-1)} aria-label="Previous photo" className="absolute left-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white sm:left-4">
            <ChevronLeft className="h-6 w-6" aria-hidden />
          </button>
          <button type="button" onClick={() => step(1)} aria-label="Next photo" className="absolute right-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white sm:right-4">
            <ChevronRight className="h-6 w-6" aria-hidden />
          </button>
        </>
      ) : null}
      <figure className="flex max-h-full max-w-full flex-col items-center gap-3" data-backdrop="1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={cur.src} src={cur.src} alt={cur.alt} className="lb-img max-h-[80vh] max-w-[92vw] object-contain" />
        {cur.alt || many ? (
          <figcaption className="max-w-[70ch] text-center text-sm text-white/90">
            {cur.alt ? <span className="block">{cur.alt}</span> : null}
            {many ? <span className="mt-1 block text-xs text-white/60" aria-live="polite">{view.i + 1} of {view.items.length}</span> : null}
          </figcaption>
        ) : null}
      </figure>
    </div>
  );
}
