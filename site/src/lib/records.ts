import { serverClient } from './supabase';

// Reads the public views in the records schema (public_bodies, public_leadership). No emails are used here.
export type Body = { name: string; level: string; status: string; parent: string; description: string | null; logo: string | null; instagram: string | null; website: string | null; recruitment: string | null; header: string | null; about: string | null };
export type Leader = { ay: string; level: string; body: string; parent: string; title: string; name: string };

const clean = (v: unknown): string | null => (v == null || v === '' || v === 'null' || v === 'N/A' ? null : String(v));

/** "SOON KUAN KIAT RYAN (SUN KUANJIE)" -> "Soon Kuan Kiat Ryan (Sun Kuanjie)" */
export function nameCase(s: string) {
  return s.toLowerCase().replace(/(^|[\s(\-'])(\p{L})/gu, (_m, a: string, b: string) => a + b.toUpperCase());
}

/* eslint-disable @typescript-eslint/no-explicit-any */
// The row-to-object conversions are shared with lib/records-client.ts, so blocks inside Plasmic pages can load the same data in the browser.
export function toBodies(data: any[]): Body[] {
  return data.map((r) => ({
    name: r.name, level: r.level ?? '', status: r.status ?? 'Active', parent: clean(r.parent_committee) ?? '',
    description: clean(r.description), logo: clean(r.logo_url), instagram: clean(r.instagram), website: clean(r.website), recruitment: clean(r.recruitment_url), header: clean(r.header_url), about: clean(r.about_md),
  })).filter((b) => b.name);
}
export function toLeaders(rows: any[]): { ay: string; leaders: Leader[] } {
  const ay = rows.map((r) => String(r.ay)).sort().pop() ?? '';
  const leaders = rows.filter((r) => String(r.ay) === ay).map((r) => ({
    ay, level: r.level ?? '', body: r.body ?? '', parent: clean(r.parent_committee) ?? '', title: r.title ?? '', name: nameCase(String(r.full_name ?? '')),
  }));
  return { ay, leaders };
}

export async function getBodies(): Promise<Body[]> {
  const { data, error } = await serverClient(300).schema('records').from('public_bodies').select('*');
  if (error) throw error;
  return toBodies(data as any[]);
}

/** Leaders for the latest academic year in the view. */
export async function getLeaders(): Promise<{ ay: string; leaders: Leader[] }> {
  const { data, error } = await serverClient(300).schema('records').from('public_leadership').select('*');
  if (error) throw error;
  return toLeaders(data as any[]);
}

const RANK = ['President', 'Vice-President', 'Honorary General Secretary', 'Honorary Treasurer', 'Head', 'Chair', 'Director', 'Deputy'];
export function sortLeaders(l: Leader[]) {
  const rank = (t: string) => { const i = RANK.findIndex((r) => t.toLowerCase().startsWith(r.toLowerCase())); return i < 0 ? 99 : i; };
  return [...l].sort((a, b) => rank(a.title) - rank(b.title) || a.title.localeCompare(b.title) || a.name.localeCompare(b.name));
}

// Student Groups: one page per parent committee that has CCAs, headed with the committee's own name.
export type Group = { slug: string; title: string; committee: string; ccas: Body[] };
/** "Local Community Involvement Committee" -> "local-community-involvement" */
export const slugify = (s: string) => s.toLowerCase().replace(/ committee$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function groupsOf(bodies: Body[]): Group[] {
  const ccas = bodies.filter((b) => b.level === 'CCA/Project' && b.status === 'Active');
  const byCommittee = new Map<string, Body[]>();
  ccas.forEach((c) => byCommittee.set(c.parent, [...(byCommittee.get(c.parent) ?? []), c]));
  const sort = (l: Body[]) => l.sort((a, b) => a.name.localeCompare(b.name));
  const out: Group[] = [];
  byCommittee.forEach((list, committee) => { if (committee) out.push({ slug: slugify(committee), title: committee, committee, ccas: sort(list) }); });
  return out.sort((a, b) => a.title.localeCompare(b.title));
}

/** Every committee, with or without CCAs (each gets a page). */
export function committeesOf(bodies: Body[]): (Body & { slug: string; ccas: Body[] })[] {
  return bodies.filter((b) => b.level === 'Committee' && b.status === 'Active')
    .map((c) => ({ ...c, slug: slugify(c.name), ccas: bodies.filter((x) => x.level === 'CCA/Project' && x.parent === c.name).sort((a, b) => a.name.localeCompare(b.name)) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** body name (a CCA) -> its parent committee, used to filter news and events by committee. */
export function committeeMap(bodies: Body[]): Record<string, string> {
  const m: Record<string, string> = {};
  bodies.forEach((b) => { if (b.level === 'CCA/Project' && b.parent) m[b.name] = b.parent; if (b.level === 'Committee') m[b.name] = b.name; });
  return m;
}

/** Every ExCo team in the public leadership view, keyed by academic year. */
export async function getExcoTeams(): Promise<Map<string, Leader[]>> {
  const { data, error } = await serverClient(300).schema('records').from('public_leadership').select('*').eq('level', 'ExCo');
  if (error) throw error;
  const out = new Map<string, Leader[]>();
  (data as any[]).forEach((r) => {
    const l: Leader = { ay: String(r.ay), level: 'ExCo', body: r.body ?? '', parent: '', title: r.title ?? '', name: nameCase(String(r.full_name ?? '')) };
    out.set(l.ay, [...(out.get(l.ay) ?? []), l]);
  });
  return out;
}
