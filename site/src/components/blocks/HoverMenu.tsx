'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePlasmicCanvasContext } from '@plasmicapp/loader-nextjs';

// A menu item with a drop-down panel. What goes in the trigger and in the panel is yours to design in Studio; this block only supplies the
// behaviour: it opens on hover, on keyboard focus, and on tap, closes on Escape, and animates (see .hm in globals.css).
export default function HoverMenu({ trigger, panel, align = 'left', panelMinWidth = 260, fullWidth = false, openInStudio = true, className = '' }: {
  trigger?: ReactNode; panel?: ReactNode; align?: 'left' | 'right' | 'center'; panelMinWidth?: number; fullWidth?: boolean; openInStudio?: boolean; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inStudio = !!usePlasmicCanvasContext();
  const shown = open || (inStudio && openInStudio);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);
  return (
    <div
      ref={ref} className={`hm ${className}`} data-open={shown} data-align={align} data-full={fullWidth}
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') setOpen(true); }}
      onPointerLeave={(e) => { if (e.pointerType === 'mouse') setOpen(false); }}
      onFocus={() => setOpen(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false); }}
      onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
    >
      <div className="hm-trigger" onClick={() => setOpen((o) => !o)}>{trigger}</div>
      <div className="hm-panel" style={fullWidth ? undefined : { minWidth: panelMinWidth }}>{panel}</div>
    </div>
  );
}

// A small chevron that turns upside down while its menu is open. Put it in the trigger.
export function MenuChevron({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg aria-hidden className={`hm-chevron ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
