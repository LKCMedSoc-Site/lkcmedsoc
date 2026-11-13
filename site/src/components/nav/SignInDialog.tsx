'use client';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import AuthBox from '@/components/AuthBox';

// The sign-in lightbox: the same form as everywhere else (AuthBox), in a centred panel over the page.
// Signing in closes it and refreshes the page's own data; nobody is sent anywhere.
export default function SignInDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    panel.current?.querySelector<HTMLInputElement>('input')?.focus();
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [open, onClose]);
  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-p950/70 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={panel} role="dialog" aria-modal="true" aria-label="Sign in" className="relative w-full max-w-md rounded-2xl bg-white p-5 text-p900 shadow-2xl">
        <button type="button" onClick={onClose} aria-label="Close" className="press absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-p50 text-p900"><X className="h-4 w-4" /></button>
        <p className="mb-3 pr-10 text-sm text-muted">One sign-in works on every LKCMedSoc site.</p>
        <AuthBox onSignedIn={() => { onClose(); router.refresh(); }} />
      </div>
    </div>,
    document.body,
  );
}
