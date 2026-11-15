import type { Body, Leader } from './records';
import { committeesOf, slugify, sortLeaders } from './records';
import type { PublicEvent } from './events';
import type { Post } from './posts';
import { fmtTime, postDate, whenText, ymd } from './dates';
import { photoUrl, storageUrl } from './supabase';
import { toneFor, type Tone } from './tones';
import { linksOf, type GroupLinkItem } from './group-links';

const SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const img = (v: string | null) => (v ? storageUrl('body-images', v) : '');
const initialsOf = (n: string) => n.split(/[\s(]+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');

type EventItem = { id: string; title: string; venue: string; summary: string; whenText: string; startTime: string; day: string; monthShort: string; cover: string; hasCover: boolean; link: string };
type PostItem = { slug: string; title: string; summary: string; category: string; dateText: string; cover: string; hasCover: boolean; link: string };
type Sibling = { name: string; link: string; color: string; onColor: string; tint: string; logo: string };
export type GroupPageData = {
  isLoading: boolean; notFound: boolean;
  name: string; description: string; initials: string;
  committee: string; committeeShort: string; committeeLink: string; link: string;
  logo: string; hasLogo: boolean; header: string; hasHeader: boolean;
  color: string; onColor: string; tint: string; overlay: string;
  aboutHtml: string; hasAbout: boolean;
  join: { label: string; url: string } | null; hasJoin: boolean; links: GroupLinkItem[]; hasLinks: boolean;
  ay: string; leaders: { name: string; title: string; photo: string; hasPhoto: boolean; initials: string }[]; hasLeaders: boolean;
  events: EventItem[]; hasEvents: boolean; posts: PostItem[]; hasPosts: boolean; siblings: Sibling[]; hasSiblings: boolean;
};
const DEFAULT_TONE = toneFor(null, 'LKCMedSoc');
const EMPTY: GroupPageData = {
  isLoading: false, notFound: false, name: '', description: '', initials: '', committee: '', committeeShort: '', committeeLink: '/student-groups', link: '',
  logo: '', hasLogo: false, header: '', hasHeader: false, color: DEFAULT_TONE.bg, onColor: DEFAULT_TONE.fg, tint: DEFAULT_TONE.tint, overlay: DEFAULT_TONE.overlay,
  aboutHtml: '', hasAbout: false, join: null, hasJoin: false, links: [], hasLinks: false, ay: '', leaders: [], hasLeaders: false,
  events: [], hasEvents: false, posts: [], hasPosts: false, siblings: [], hasSiblings: false,
};

/**
 * Everything one group's page shows, in the shape Studio binds to ($ctx.groupPage) and the coded page also uses.
 * The page colour is the group's own colour, else its committee's, else one picked from its name (see lib/tones.ts).
 */
export function buildGroupPage(o: { bodies: Body[]; leaders: Leader[]; ay: string; events: PublicEvent[]; posts: Post[]; committee: string; body: string; renderAbout: (md: string) => string; loading?: boolean }): GroupPageData {
  const committee = committeesOf(o.bodies).find((c) => c.slug === o.committee);
  const b = committee?.ccas.find((x) => slugify(x.name) === o.body);
  if (!committee || !b) return { ...EMPTY, isLoading: !!o.loading, notFound: !o.loading };
  const tone: Tone = b.color ? toneFor(b.color, b.name) : toneFor(committee.color, b.name);
  const people = sortLeaders(o.leaders.filter((l) => l.level === 'CCA/Project' && l.body === b.name));
  const links: GroupLinkItem[] = linksOf(b);
  const events = o.events.filter((e) => e.body === b.name).slice(0, 6).map((e) => {
    const d = ymd(e.start_date);
    return { id: e.id, title: e.title, venue: e.venue ?? '', summary: e.summary ?? '', whenText: whenText(e), startTime: fmtTime(e.start_time), day: d ? String(d[2]) : '', monthShort: d ? SHORT[d[1] - 1] : 'TBC', cover: e.cover_url ? photoUrl(e.cover_url) : '', hasCover: !!e.cover_url, link: `/events/${e.id}` };
  });
  const posts = o.posts.filter((p) => p.bodyName === b.name).slice(0, 6).map((p) => ({ slug: p.slug, title: p.title, summary: p.summary, category: p.category, dateText: postDate(p.published_at), cover: p.cover, hasCover: !!p.cover, link: `/gazette/${p.slug}` }));
  const siblings = committee.ccas.filter((x) => x.name !== b.name).map((x) => {
    const t = x.color ? toneFor(x.color, x.name) : toneFor(committee.color, x.name);
    return { name: x.name, link: `/student-groups/${committee.slug}/${slugify(x.name)}`, color: t.bg, onColor: t.fg, tint: t.tint, logo: img(x.logo) };
  });
  const aboutHtml = b.about ? o.renderAbout(b.about) : '';
  const join = b.recruitment ? { label: 'Join us', url: b.recruitment } : null;
  return {
    ...EMPTY,
    name: b.name, description: b.description ?? '', initials: initialsOf(b.name),
    committee: committee.name, committeeShort: committee.name.replace(/ Committee$/, ''), committeeLink: `/about/committee/${committee.slug}`, link: `/student-groups/${committee.slug}/${slugify(b.name)}`,
    logo: img(b.logo), hasLogo: !!b.logo, header: img(b.header), hasHeader: !!b.header,
    color: tone.bg, onColor: tone.fg, tint: tone.tint, overlay: tone.overlay,
    aboutHtml, hasAbout: !!aboutHtml,
    join, hasJoin: !!join, links, hasLinks: links.length > 0,
    ay: o.ay, leaders: people.map((l) => ({ name: l.name, title: l.title, photo: l.photo ? storageUrl('body-images', l.photo) : '', hasPhoto: !!l.photo, initials: initialsOf(l.name) })), hasLeaders: people.length > 0,
    events, hasEvents: events.length > 0, posts, hasPosts: posts.length > 0,
    siblings, hasSiblings: siblings.length > 0,
  };
}
