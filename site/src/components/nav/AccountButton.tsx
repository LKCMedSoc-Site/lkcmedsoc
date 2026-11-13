'use client';
import { useEffect, useRef, useState } from 'react';
import { LogOut } from 'lucide-react';
import { browserClient } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';
import SignInDialog from './SignInDialog';

// The header's account control. Signed out: a "Sign in" button that opens the lightbox. Signed in: the person's initials, with a small menu to sign out.
// Used in the site header (desktop). The phone menu has its own row (MobileMenu) that opens the same lightbox.
export default function AccountButton({ label = 'Sign in', className = '' }: { label?: string; className?: string }) {
  const user = useSession();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setMenu(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false); };
    document.addEventListener('mousedown', away); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [menu]);
  if (user === undefined) return <span aria-hidden className={`h-10 w-16 ${className}`} />; // keeps the bar from jumping while the session is checked
  if (!user) {
    return (
      <>
        <button type="button" onClick={() => setOpen(true)} className={`press h-10 whitespace-nowrap rounded-full px-3 text-sm font-bold text-mist hover:bg-p900 hover:text-white ${className}`}>{label}</button>
        <SignInDialog open={open} onClose={() => setOpen(false)} />
      </>
    );
  }
  const email = user.email ?? '';
  return (
    <div ref={box} className={`relative ${className}`}>
      <button type="button" onClick={() => setMenu((v) => !v)} aria-haspopup="menu" aria-expanded={menu} aria-label={`Account: ${email}`} className="press grid h-10 w-10 place-items-center rounded-full bg-p900 text-sm font-bold uppercase text-white">{email.slice(0, 1) || '?'}</button>
      {menu ? (
        <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-p900 bg-p950 p-2 text-white shadow-2xl">
          <p className="truncate px-3 py-2 text-sm text-mist">{email}</p>
          <button type="button" role="menuitem" onClick={async () => { await browserClient().auth.signOut(); setMenu(false); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left font-bold hover:bg-p900"><LogOut aria-hidden className="h-4 w-4" />Sign out</button>
        </div>
      ) : null}
    </div>
  );
}
