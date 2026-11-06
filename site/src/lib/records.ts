import { serverClient } from './supabase';

// Reads the public views in the records schema (public_bodies, public_leadership). No emails are used here.
export type Body = { name: string; level: string; status: string; parent: string; description: string | null; logo: string | null; instagram: string | null; website: string | null; recruitment: string | null };
export type Leader = { ay: string; level: string; body: string; parent: string; title: string; name: string };

const clean = (v: unknown): string | null => (v == null || v === '' || v === 'null' || v === 'N/A' ? null : String(v));

/** "SOON KUAN KIAT RYAN (SUN KUANJIE)" -> "Soon Kuan Kiat Ryan (Sun Kuanjie)" */
export function nameCase(s: string) {
  return s.toLowerCase().replace(/(^|[\s(\-'])(\p{L})/gu, (_m, a: string, b: string) => a + b.toUpperCase());
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function getBodies(): Promise<Body[]> {
  const { data, error } = await serverClient(300).schema('records').from('public_bodies').select('*');
  if (error) throw error;
  return (data as any[]).map((r) => ({
    name: r.name, level: r.level ?? '', status: r.status ?? 'Active', parent: clean(r.parent_committee) ?? '',
    description: clean(r.description), logo: clean(r.logo_url), instagram: clean(r.instagram), website: clean(r.website), recruitment: clean(r.recruitment_url),
  })).filter((b) => b.name);
}

/** Leaders for the latest academic year in the view. */
export async function getLeaders(): Promise<{ ay: string; leaders: Leader[] }> {
  const { data, error } = await serverClient(300).schema('records').from('public_leadership').select('*');
  if (error) throw error;
  const rows = data as any[];
  const ay = rows.map((r) => String(r.ay)).sort().pop() ?? '';
  const leaders = rows.filter((r) => String(r.ay) === ay).map((r) => ({
    ay, level: r.level ?? '', body: r.body ?? '', parent: clean(r.parent_committee) ?? '', title: r.title ?? '', name: nameCase(String(r.full_name ?? '')),
  }));
  return { ay, leaders };
}

const RANK = ['President', 'Vice-President', 'Honorary General Secretary', 'Honorary Treasurer', 'Head', 'Chair', 'Director', 'Deputy'];
export function sortLeaders(l: Leader[]) {
  const rank = (t: string) => { const i = RANK.findIndex((r) => t.toLowerCase().startsWith(r.toLowerCase())); return i < 0 ? 99 : i; };
  return [...l].sort((a, b) => rank(a.title) - rank(b.title) || a.title.localeCompare(b.title) || a.name.localeCompare(b.name));
}

// Student Life pages: one per committee that has CCAs. Nice addresses for the four that exist today;
// any other committee that gains CCAs later gets a page automatically.
const NAMED: { slug: string; title: string; committee: string }[] = [
  { slug: 'local-cips', title: 'Local CIPs', committee: 'Local Community Involvement Committee' },
  { slug: 'overseas-cips', title: 'Overseas CIPs', committee: 'Overseas Community Involvement Committee' },
  { slug: 'societies', title: 'Societies & SIGs', committee: 'Careers Committee' },
  { slug: 'arts-and-culture', title: 'Arts & Culture', committee: 'Arts and Culture Committee' },
];
export type Group = { slug: string; title: string; committee: string; ccas: Body[] };
const slugify = (s: string) => s.toLowerCase().replace(/ committee$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function groupsOf(bodies: Body[]): Group[] {
  const ccas = bodies.filter((b) => b.level === 'CCA/Project' && b.status === 'Active');
  const byCommittee = new Map<string, Body[]>();
  ccas.forEach((c) => byCommittee.set(c.parent, [...(byCommittee.get(c.parent) ?? []), c]));
  const sort = (l: Body[]) => l.sort((a, b) => a.name.localeCompare(b.name));
  const out: Group[] = NAMED.map((n) => ({ ...n, ccas: sort(byCommittee.get(n.committee) ?? []) }));
  byCommittee.forEach((list, committee) => {
    if (committee && !NAMED.some((n) => n.committee === committee)) out.push({ slug: slugify(committee), title: committee.replace(/ Committee$/, ''), committee, ccas: sort(list) });
  });
  return out.filter((g) => g.ccas.length);
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
