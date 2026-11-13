import { cookies } from 'next/headers';
import { SUPABASE_URL } from './supabase';

/** The signed-in person's access token, read from the sign-in cookie shared by the LKCMedSoc sites (see sso.ts). null when signed out. */
export async function sessionToken(): Promise<string | null> {
  try {
    const jar = await cookies();
    const key = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
    const n = Number(jar.get(`${key}.n`)?.value ?? 0);
    if (!n) return null;
    let raw = '';
    for (let i = 0; i < n; i++) { const part = jar.get(`${key}.${i}`)?.value; if (part == null) return null; raw += part; }
    let json: { access_token?: string };
    try { json = JSON.parse(raw); } catch { json = JSON.parse(decodeURIComponent(raw)); }
    return json.access_token ?? null;
  } catch { return null; }
}
