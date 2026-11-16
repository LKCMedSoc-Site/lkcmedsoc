import type { Body, Leader } from './records';
import { committeesOf, slugify, sortLeaders } from './records';
import type { PublicEvent } from './events';
import type { Post } from './posts';
import { fmtTime, postDate, whenText, ymd } from './dates';
import { photoUrl, storageUrl } from './supabase';
import { assignTones, toneFor, type Tone } from './tones';
import { breakdownOf, currentYear, EMPTY_PLACING, gapTextOf, placingOf, pointsText, rankLabel, updatedText, type HouseCupYear, type Placing } from './house-cup';
import { clip } from './text';

const SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const img = (v: string | null) => (v ? storageUrl('body-images', v) : '');
const initialsOf = (n: string) => n.split(/[\s(]+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
const colours = (t: Tone) => ({ color: t.bg, onColor: t.fg, tint: t.tint, overlay: t.overlay });
const personOf = (l: Leader) => ({ name: l.name, title: l.title, photo: l.photo ? storageUrl('body-images', l.photo) : '', hasPhoto: !!l.photo, initials: initialsOf(l.name) });
const eventItem = (e: PublicEvent) => {
  const d = ymd(e.start_date);
  return { id: e.id, title: e.title, venue: e.venue ?? '', summary: e.summary ?? '', whenText: whenText(e), startTime: fmtTime(e.start_time), day: d ? String(d[2]) : '', monthShort: d ? SHORT[d[1] - 1] : 'TBC', cover: e.cover_url ? photoUrl(e.cover_url) : '', hasCover: !!e.cover_url, link: `/events/${e.id}` };
};
const postItem = (p: Post) => ({ slug: p.slug, title: p.title, summary: p.summary, category: p.category, dateText: postDate(p.published_at), cover: p.cover, hasCover: !!p.cover, link: `/gazette/${p.slug}` });

type Person = ReturnType<typeof personOf>;
type EventItem = ReturnType<typeof eventItem>;
type PostItem = ReturnType<typeof postItem>;
type GroupItem = { name: string; description: string; initials: string; link: string; logo: string; hasLogo: boolean; header: string; hasHeader: boolean; color: string; onColor: string; tint: string; overlay: string };
type Colours = { color: string; onColor: string; tint: string; overlay: string };

// Colour of the round disc behind a crest. White, so a crest reads whatever the house colour or photo; a white crest needs the house colour instead.
const LIGHT_CRESTS = new Set(['Joseph Lister']);
const logoBgOf = (name: string, color: string) => (LIGHT_CRESTS.has(name) ? color : '#ffffff');

const DEFAULT = toneFor(null, 'LKCMedSoc');
const BASE_EMPTY = { isLoading: false, notFound: false, name: '', short: '', description: '', initials: '', link: '', logo: '', hasLogo: false, logoBg: '#ffffff', header: '', hasHeader: false, ...colours(DEFAULT), aboutHtml: '', hasAbout: false, ay: '', leaders: [] as Person[], hasLeaders: false, groups: [] as GroupItem[], hasGroups: false, events: [] as EventItem[], hasEvents: false, posts: [] as PostItem[], hasPosts: false,
  // House pages only (empty on committee pages): the house's place in the House Cup. See house-cup.ts and plasmic-kit/ABOUT-PAGES.md.
  currentPlacing: EMPTY_PLACING as Placing, hasCurrentPlacing: false, placings: [] as Placing[], hasPlacings: false, hasPastPlacings: false, breakdown: [] as { name: string; weightText: string; scoreText: string; maxText: string }[], hasBreakdown: false, gapText: '' };
export type BodyPageData = typeof BASE_EMPTY;

type Src = { bodies: Body[]; leaders: Leader[]; ay: string; events: PublicEvent[]; posts: Post[]; cups?: HouseCupYear[]; renderAbout: (md: string) => string; loading?: boolean };

/** One committee ($ctx.committeePage) or one house ($ctx.housePage). A committee's events and news include those of its groups. */
export function buildBodyPage(o: Src & { kind: 'committee' | 'house'; slug: string }): BodyPageData {
  const committees = committeesOf(o.bodies);
  const houses = o.bodies.filter((b) => b.level === 'House' && b.status === 'Active').sort((a, b) => a.name.localeCompare(b.name));
  const c = o.kind === 'committee' ? committees.find((x) => x.slug === o.slug) : undefined;
  const h = o.kind === 'house' ? houses.find((x) => slugify(x.name) === o.slug) : undefined;
  const b: Body | undefined = c ?? h;
  if (!b) return { ...BASE_EMPTY, isLoading: !!o.loading, notFound: !o.loading };
  const tone = o.kind === 'committee' ? assignTones(committees).get(b.name)! : assignTones(houses).get(b.name)!;
  const names = new Set([b.name, ...(c ? c.ccas.map((x) => x.name) : [])]);
  const people = sortLeaders(o.leaders.filter((l) => l.level === (o.kind === 'committee' ? 'Committee' : 'House') && l.body === b.name));
  const groups: GroupItem[] = (c?.ccas ?? []).map((x) => {
    const t = x.color ? toneFor(x.color, x.name) : tone;
    return { name: x.name, description: clip(x.description ?? ''), initials: initialsOf(x.name), link: `/student-groups/${c!.slug}/${slugify(x.name)}`, logo: img(x.logo), hasLogo: !!x.logo, header: img(x.header), hasHeader: !!x.header, ...colours(t) };
  });
  const events = o.events.filter((e) => names.has(e.body ?? '')).slice(0, 6).map(eventItem);
  const posts = o.posts.filter((p) => names.has(p.bodyName)).slice(0, 6).map(postItem);
  const aboutHtml = b.about ? o.renderAbout(b.about) : '';
  // House Cup: this year's place (only if this year has results) and the places in earlier years, newest first.
  const cups = o.kind === 'house' ? o.cups ?? [] : [];
  const cur = currentYear(cups, o.ay);
  const currentPlacing = cur ? placingOf(cur, b.name) : null;
  const placings = cups.filter((y) => y !== cur).map((y) => placingOf(y, b.name)).filter((p): p is Placing => !!p);
  return {
    ...BASE_EMPTY,
    name: b.name, short: b.name.replace(/ Committee$/, ''), description: b.description ?? '', initials: initialsOf(b.name),
    link: o.kind === 'committee' ? `/about/committee/${o.slug}` : `/about/house-system/${o.slug}`,
    logo: img(b.logo), hasLogo: !!b.logo, logoBg: logoBgOf(b.name, colours(tone).color), header: img(b.header), hasHeader: !!b.header, ...colours(tone),
    aboutHtml, hasAbout: !!aboutHtml, ay: o.ay, leaders: people.map(personOf), hasLeaders: people.length > 0,
    groups, hasGroups: groups.length > 0, events, hasEvents: events.length > 0, posts, hasPosts: posts.length > 0,
    currentPlacing: currentPlacing ?? EMPTY_PLACING, hasCurrentPlacing: !!currentPlacing, placings, hasPlacings: !!currentPlacing || placings.length > 0, hasPastPlacings: placings.length > 0,
    breakdown: cur ? breakdownOf(cur, b.name) : [], hasBreakdown: !!cur && cur.reasons.length > 0 && cur.houses.some((x) => x.name === b.name), gapText: cur ? gapTextOf(cur, b.name) : '',
  };
}

export const HOUSES_INTRO = 'Every student belongs to a house, so you have a home across years, streams and groups.';
export const HOUSES_HOW = 'Houses bring students from every cohort together through games, mentoring and traditions.';

/** The house system overview ($ctx.housesHub): every house, plus the activities of all houses together. */
export function buildHousesHub(o: Src & { intro?: string; howItWorks?: string }) {
  const houses = o.bodies.filter((b) => b.level === 'House' && b.status === 'Active').sort((a, b) => a.name.localeCompare(b.name));
  const tones = assignTones(houses);
  const names = new Set(houses.map((x) => x.name));
  const items = houses.map((x) => {
    const reps = sortLeaders(o.leaders.filter((l) => l.level === 'House' && l.body === x.name)).map(personOf);
    return { name: x.name, slug: slugify(x.name), link: `/about/house-system/${slugify(x.name)}`, description: clip(x.description ?? ''), initials: initialsOf(x.name), logo: img(x.logo), hasLogo: !!x.logo, logoBg: logoBgOf(x.name, colours(tones.get(x.name)!).color), header: img(x.header), hasHeader: !!x.header, ...colours(tones.get(x.name)!), reps, hasReps: reps.length > 0 };
  });
  const events = o.events.filter((e) => names.has(e.body ?? '')).slice(0, 6).map(eventItem);
  const posts = o.posts.filter((p) => names.has(p.bodyName)).slice(0, 6).map(postItem);
  // House Cup table for the current year: houses in rank order, and the reasons with their weights.
  const cup = currentYear(o.cups ?? [], o.ay);
  const linkOf = (name: string) => items.find((i) => i.name === name)?.link ?? '';
  const itemOf = (name: string) => items.find((i) => i.name === name);
  const cupData = {
    ay: cup?.ay ?? '', isFinal: !!cup?.is_final, statusText: cup ? (cup.is_final ? 'Final results' : 'Results so far') : '', updatedText: cup ? updatedText(cup) : '',
    rows: (cup?.houses ?? []).map((h) => ({ rank: h.rank, rankLabel: rankLabel(h.rank), name: h.name, link: linkOf(h.name), points: pointsText(h.total), color: itemOf(h.name)?.color ?? '', onColor: itemOf(h.name)?.onColor ?? '', tint: itemOf(h.name)?.tint ?? '', initials: itemOf(h.name)?.initials ?? '' })),
    reasons: (cup?.reasons ?? []).map((r) => ({ name: r.name, weight: r.weight, weightText: `${pointsText(r.effective_weight)}%` })),
  };
  return {
    isLoading: !!o.loading, hasError: false, intro: o.intro || HOUSES_INTRO, howItWorks: o.howItWorks || HOUSES_HOW, ay: o.ay,
    items, count: items.length, countText: `${items.length} house${items.length === 1 ? '' : 's'}`,
    events, hasEvents: events.length > 0, posts, hasPosts: posts.length > 0,
    cup: cupData, hasCup: cupData.rows.length > 0,
  };
}
