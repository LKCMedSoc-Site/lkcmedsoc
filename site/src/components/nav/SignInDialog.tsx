'use client';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { browserClient, friendly } from '@/lib/supabase';

// The sign-in lightbox is one shared file (shared/signin.js, copied to public/signin.js) used by this site and by every LKCMedSoc app,
// so it looks and behaves the same everywhere. This component only loads it and opens it. Change its design in shared/signin.js,
// then run `node tools/sync-shared.mjs`. Signing in closes it and refreshes the page's own data; nobody is sent anywhere.
type Lightbox = { open: (o: Record<string, unknown>) => void; close: () => void };
declare global { interface Window { LKCSignIn?: Lightbox } }

let loading: Promise<Lightbox> | null = null;
function loadLightbox(): Promise<Lightbox> {
  if (window.LKCSignIn) return Promise.resolve(window.LKCSignIn);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = '/signin.js';
      s.onload = () => (window.LKCSignIn ? resolve(window.LKCSignIn) : reject(new Error('signin.js did not load')));
      s.onerror = () => { loading = null; reject(new Error('signin.js did not load')); };
      document.head.appendChild(s);
    });
  }
  return loading;
}

export default function SignInDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const closeRef = useRef(onClose);   // callers pass a new function every render; the lightbox must not reopen because of that
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // inside the framed header (/embed/header) email links go to the sign-in page, not back into the little frame
    const redirect = window.location.pathname.startsWith('/embed') ? `${window.location.origin}/sign-in` : window.location.href.split('#')[0];
    loadLightbox().then((lb) => {
      if (cancelled) return;
      lb.open({ sb: browserClient(), redirect, friendly, onClose: () => closeRef.current(), onSignedIn: () => { closeRef.current(); router.refresh(); } });
    }).catch(() => closeRef.current());
    return () => { cancelled = true; window.LKCSignIn?.close(); };
  }, [open, router]);
  return null;
}
