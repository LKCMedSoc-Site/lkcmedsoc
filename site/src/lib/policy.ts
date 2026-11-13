import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from './supabase';

// The policy documents (Constitution, Bylaws, Guides, NTU and School rules). The text lives in the database (sql/policy.sql); changes only come in through approved amendments.
export type Tier = 'constitution' | 'bylaw' | 'guide' | 'external';
export const TIERS: { tier: Tier; label: string; one: string; note: string }[] = [
  { tier: 'constitution', label: 'Constitution', one: 'Constitution', note: 'Changed only by two-thirds of a General Meeting, then SAO.' },
  { tier: 'bylaw', label: 'Bylaws', one: 'Bylaw', note: 'Binding. Made by ExCo, published within 7 days, and a General Meeting can annul them.' },
  { tier: 'guide', label: 'Guides', one: 'Guide', note: 'Advice on doing things well. Changed by the officer who owns them.' },
  { tier: 'external', label: 'NTU and School rules', one: 'NTU or School rule', note: 'Set by NTU, SAO or the School. We link to the official text and say what it means for you.' },
];
export const tierLabel = (t: string) => TIERS.find((x) => x.tier === t)?.one ?? t;

export type PolicyDoc = { slug: string; title: string; tier: Tier; summary: string; owner: string; status: 'draft' | 'in_force'; version: number; effective_on: string | null; source_url: string | null; last_checked: string | null; ord: number; clauses: number };
export type Clause = { ref: string; heading: string; body_md: string };
export type DocView = {
  doc: Omit<PolicyDoc, 'ord' | 'clauses'> & { shown_version: number };
  clauses: Clause[];
  versions: { version: number; effective_on: string; title: string; number: number }[];
};
export type ChangeEntry = {
  number: number; title: string; reason: string; kind: 'change' | 'adopt'; effective_on: string; decided_at: string; version: number;
  meeting_date: string | null; meeting_for: number | null; meeting_against: number | null; sao_confirmed: boolean | null;
  doc_slug: string; doc_title: string; tier: Tier; votes: { for: number; against: number; abstain: number; recused: number } | null;
  changes: { ref: string; action: 'edit' | 'add' | 'repeal'; old_heading: string | null; old_body_md: string | null; new_heading: string | null; new_body_md: string | null }[];
};
export type Hit = { doc_slug: string; doc_title: string; ref: string; heading: string; snippet: string };

// Cached for a minute, and tagged so an edit made on the page can refresh it at once (see app/policy/actions.ts).
// With a token (ExCo signed in) the call runs as that person and is not cached, so unpublished documents and fresh edits show.
const act = (token?: string | null) => createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: token
    ? { headers: { Authorization: `Bearer ${token}` }, fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) }
    : { fetch: (input, init) => fetch(input, { ...init, next: { revalidate: 60, tags: ['policy'] } }) },
}).schema('activities');

export async function policyIndex(): Promise<PolicyDoc[]> {
  const { data, error } = await act().rpc('policy_index'); if (error) throw error;
  return (data ?? []) as PolicyDoc[];
}
export async function policyDoc(slug: string, version?: number | null, token?: string | null): Promise<DocView | null> {
  if (token) {   // signed in: an ExCo member can read a document that is not published yet. If the token has expired, fall back to the public view.
    const r = await act(token).rpc('policy_doc', { p_slug: slug, p_version: version ?? null });
    if (!r.error && r.data) return r.data as DocView;
  }
  const { data, error } = await act().rpc('policy_doc', { p_slug: slug, p_version: version ?? null }); if (error) throw error;
  return (data ?? null) as DocView | null;
}
export async function policyChangelog(slug?: string): Promise<ChangeEntry[]> {
  const { data, error } = await act().rpc('policy_changelog', { p_slug: slug ?? null }); if (error) throw error;
  return (data ?? []) as ChangeEntry[];
}
export async function policySearch(q: string): Promise<Hit[]> {
  const { data, error } = await act().rpc('policy_search', { p_q: q }); if (error) throw error;
  return (data ?? []) as Hit[];
}

/** "Draft proposal", or "In force · version 3". */
export const statusText = (d: { status: string; version: number }) => (d.status === 'in_force' ? `In force · version ${d.version}` : 'Draft proposal');
export const longDate = (s: string | null) => {
  if (!s) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); if (!m) return s;
  return `${+m[3]} ${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][+m[2] - 1]} ${m[1]}`;
};

/** Where the Policy editor app lives (it only opens for ExCo). Set NEXT_PUBLIC_POLICY_APP_URL to point elsewhere, e.g. the local editor. */
export const POLICY_APP = process.env.NEXT_PUBLIC_POLICY_APP_URL ?? 'https://policy.lkcmedsoc.com/';
export const editUrl = (slug: string, ref?: string) => `${POLICY_APP}#/d/${slug}${ref ? `?edit=${encodeURIComponent(ref)}` : ''}`;

/** Is this signed-in person ExCo? (Signed out, or an expired token, counts as no.) */
export async function policyIsExco(token: string | null): Promise<boolean> {
  if (!token) return false;
  try { const r = await act(token).rpc('is_exco'); return r.data === true; } catch { return false; }
}
