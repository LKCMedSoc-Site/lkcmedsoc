'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, CornerDownLeft, Search, X } from 'lucide-react';

export type SearchItem = { label: string; href: string; kind: string; hint?: string; external?: boolean };

// Quick finder for pages and CCAs. Opens with the search button, "/" or Ctrl/Cmd+K.
export default function SearchOverlay({ open, onClose, items }: { open: boolean; onClose: () => void; items: SearchItem[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return items.filter((i) => i.kind === 'Page').slice(0, 7);
    return items
      .map((i) => {
        const hay = `${i.label} ${i.hint ?? ''}`.toLowerCase();
        const at = hay.indexOf(t);
        return { i, score: at < 0 ? -1 : (i.label.toLowerCase().startsWith(t) ? 0 : at === 0 ? 1 : 2) };
      })
      .filter((r) => r.score >= 0)
      .sort((a, b) => a.score - b.score)
      .slice(0, 9)
      .map((r) => r.i);
  }, [q, items]);

  useEffect(() => { setActive(0); }, [q]);
  useEffect(() => {
    if (!open) { setQ(''); return; }
    const t = setTimeout(() => input.current?.focus(), 30);
    document.body.style.overflow = 'hidden';
    return () => { clearTimeout(t); document.body.style.overflow = ''; };
  }, [open]);

  function go(i?: SearchItem) {
    if (!i) return;
    onClose();
    if (i.external) window.open(i.href, '_blank', 'noopener'); else router.push(i.href);
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-p950/80 px-3 pt-[8svh] backdrop-blur-sm md:pt-[12svh]" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} role="dialog" aria-modal="true" aria-label="Search the site">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search aria-hidden className="h-5 w-5 shrink-0 text-p500" />
          <input
            ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search pages and CCAs"
            aria-label="Search" autoComplete="off" spellCheck={false}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
              else if (e.key === 'Enter') go(results[active]);
            }}
            className="min-w-0 flex-1 bg-transparent py-4 text-lg text-p900 outline-none placeholder:text-muted"
          />
          <button type="button" onClick={onClose} aria-label="Close search" className="grid h-9 w-9 place-items-center rounded-full text-p900 hover:bg-mist"><X className="h-5 w-5" /></button>
        </div>
        <ul className="max-h-[60svh] overflow-y-auto p-2" role="listbox">
          {results.length ? results.map((r, idx) => (
            <li key={r.href + r.label} role="option" aria-selected={idx === active}>
              <button type="button" onClick={() => go(r)} onMouseEnter={() => setActive(idx)} className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left ${idx === active ? 'bg-p900 text-white' : 'text-p900'}`}>
                <span className="min-w-0"><span className="block truncate font-bold">{r.label}</span>{r.hint ? <span className={`block truncate text-sm ${idx === active ? 'text-mist' : 'text-muted'}`}>{r.hint}</span> : null}</span>
                <span className={`flex shrink-0 items-center gap-2 text-xs font-bold uppercase tracking-wider ${idx === active ? 'text-mist' : 'text-p500'}`}>{r.kind}{r.external ? <ArrowUpRight className="h-4 w-4" aria-hidden /> : idx === active ? <CornerDownLeft className="h-4 w-4" aria-hidden /> : null}</span>
              </button>
            </li>
          )) : <li className="px-3 py-8 text-center text-muted">Nothing matches &ldquo;{q}&rdquo;. Try a CCA name or a page like &ldquo;events&rdquo;.</li>}
        </ul>
        <div className="hidden items-center gap-4 border-t border-line bg-p50 px-4 py-2 text-xs text-muted md:flex"><span><kbd className="font-bold">↑↓</kbd> to move</span><span><kbd className="font-bold">Enter</kbd> to open</span><span><kbd className="font-bold">Esc</kbd> to close</span></div>
      </div>
    </div>
  );
}
