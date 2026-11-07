import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { sharedSession } from './sso';

// The publishable key is meant to be public: the database rules decide what anyone can do.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://brwdgbitxisadwbuwbdi.supabase.co';
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'sb_publishable_iVGn5p_HufuRZYEiAP_IyA_qxizqqfM';

/** For server components: no sign-in, public data only, cached for a minute. */
export function serverClient(revalidate = 60): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, next: { revalidate } }) },
  });
}

let browser: SupabaseClient | null = null;
/** For client components: the student's session is shared with the other LKCMedSoc sites (see sso.ts). */
export function browserClient(): SupabaseClient {
  if (!browser) browser = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { storage: sharedSession } });
  return browser;
}

export function photoUrl(path?: string | null) {
  if (!path) return '';
  if (/^https?:\/\//.test(path)) return path;
  return `${SUPABASE_URL}/storage/v1/object/public/post-photos/${path.replace(/^\/+/, '')}`;
}

export function storageUrl(bucket: string, path?: string | null) {
  if (!path) return '';
  return /^https?:\/\//.test(path) ? path : `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path.replace(/^\/+/, '')}`;
}

export function friendly(err: unknown): string {
  const m = (err as { message?: string })?.message ?? String(err);
  if (/row-level security|permission denied/i.test(m)) return "You don't have permission for that, or it is locked at this stage.";
  if (/Invalid login credentials/i.test(m)) return 'Wrong email or password.';
  if (/Email not confirmed/i.test(m)) return 'Confirm your email first: open the link we sent you.';
  if (/already registered/i.test(m)) return 'That email already has an account. Sign in, or use Forgot password.';
  if (/Database error saving new user|sign-in list/i.test(m)) return "That email isn't on the sign-in list. Use your NTU email, or ask an admin to add yours.";
  if (/JWT|not authenticated/i.test(m)) return 'Please sign in again.';
  return m;
}
