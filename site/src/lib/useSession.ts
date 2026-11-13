'use client';
import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { browserClient } from './supabase';

/**
 * Who is signed in, in the browser. `undefined` while it is still being checked, `null` when signed out.
 * The session is the cookie shared by all LKCMedSoc sites (see sso.ts), so this stays right across them.
 */
export function useSession(): User | null | undefined {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => {
    const sb = browserClient();
    let off = false;
    sb.auth.getSession().then(({ data }) => { if (!off) setUser(data.session?.user ?? null); }).catch(() => { if (!off) setUser(null); });
    const { data } = sb.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => { off = true; data.subscription.unsubscribe(); };
  }, []);
  return user;
}

/** Where to send someone after signing in: this site's own pages or another LKCMedSoc address, never anywhere else. */
export function safeNext(raw: string | null | undefined): string {
  if (!raw) return '/';
  if (raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/\\')) return raw;
  try {
    const u = new URL(raw);
    if (u.protocol === 'https:' && /(^|\.)lkcmedsoc\.com$/.test(u.hostname)) return u.toString();
  } catch { /* not a URL */ }
  return '/';
}
