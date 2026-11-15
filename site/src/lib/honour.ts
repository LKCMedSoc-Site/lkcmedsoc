import { getExcoTeams, sortLeaders } from './records';
import { listPosts } from './posts';
import { getPageRendered } from './content';
import { ayNumber, ayToSlug, exco, slugToAy } from './ay';
import { postDate } from './dates';

/** The honour roll in the shape Studio binds to ($ctx.honourHub). Built on the server (page seed and /api/honour). */
type Person = { name: string; title: string; initials: string; photo: string; hasPhoto: boolean };
export type HonourTerm = { ay: string; slug: string; link: string; exco: string; number: number; isCurrent: boolean; president: Person | null; hasPresident: boolean; count: number; countText: string };
export type HonourPost = { slug: string; title: string; summary: string; category: string; dateText: string; cover: string; hasCover: boolean; link: string };
export type HonourDetail = HonourTerm & {
  team: Person[]; hasTeam: boolean; writeupHtml: string; hasWriteup: boolean;
  posts: HonourPost[]; hasPosts: boolean; postCount: number; postsLink: string;
  prev: { ay: string; exco: string; link: string } | null; next: { ay: string; exco: string; link: string } | null;
};
export type HonourData = { terms: HonourTerm[]; termCount: number; term: HonourDetail | null; hasTerm: boolean; notFound: boolean };

const initialsOf = (n: string) => n.split(/[\s(]+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
const person = (l: { name: string; title: string; photo?: string | null }): Person => ({ name: l.name, title: l.title, initials: initialsOf(l.name), photo: l.photo || '', hasPhoto: !!l.photo });

/** Every term, newest first, and the detail of one term (the newest when no slug is given). */
export async function getHonour(termSlug = ''): Promise<HonourData> {
  const teams = await getExcoTeams();
  const years = [...teams.keys()].sort().reverse();
  const terms: HonourTerm[] = years.map((ay, i) => {
    const team = sortLeaders(teams.get(ay) ?? []);
    const lead = team.find((l) => /^president/i.test(l.title));
    return {
      ay, slug: ayToSlug(ay), link: `/about/honour-roll/${ayToSlug(ay)}`, exco: ayNumber(ay) > 0 ? exco(ay) : ay, number: ayNumber(ay), isCurrent: i === 0,
      president: lead ? person(lead) : null, hasPresident: !!lead, count: team.length, countText: `${team.length} member${team.length === 1 ? '' : 's'}`,
    };
  });
  const ay = termSlug ? slugToAy(termSlug) : terms[0]?.ay ?? null;
  const base = ay ? terms.find((t) => t.ay === ay) : undefined;
  if (!base) return { terms, termCount: terms.length, term: null, hasTerm: false, notFound: !!termSlug };
  const [posts, writeup] = await Promise.all([listPosts({ ay: base.ay, limit: 6 }).catch(() => null), getPageRendered(`exco/${base.slug}`).catch(() => null)]);
  const i = terms.indexOf(base);
  const nav = (t?: HonourTerm) => (t ? { ay: t.ay, exco: t.exco, link: t.link } : null);
  const team = sortLeaders(teams.get(base.ay) ?? []).map(person);
  const items: HonourPost[] = (posts?.items ?? []).map((p) => ({ slug: p.slug, title: p.title, summary: p.summary, category: p.category, dateText: postDate(p.published_at), cover: p.cover, hasCover: !!p.cover, link: `/gazette/${p.slug}` }));
  const html = writeup?.html?.trim() ?? '';
  return {
    terms, termCount: terms.length, hasTerm: true, notFound: false,
    term: {
      ...base, team, hasTeam: team.length > 0, writeupHtml: html, hasWriteup: !!html,
      posts: items, hasPosts: items.length > 0, postCount: posts?.total ?? 0, postsLink: `/gazette/all?ay=${encodeURIComponent(base.ay)}`,
      prev: nav(terms[i + 1]), next: nav(terms[i - 1]),
    },
  };
}
