import { groupsOf, slugify, sortLeaders, type Body, type Leader } from './records';
import { storageUrl } from './supabase';
import type { GroupItem } from '@/components/GroupsBrowser';

// Logos and headers can be full links or file names inside the "body-images" storage bucket.
const img = (v: string | null) => (v ? storageUrl('body-images', v) : '');

/** Everything the Student Groups card grid needs, built from bodies and leaders. Used by the page and by the Plasmic block. */
export function groupItems(bodies: Body[], leaders: Leader[]) {
  const groups = groupsOf(bodies);
  const items: GroupItem[] = groups.flatMap((g) => g.ccas.map((c) => ({
    name: c.name, href: `/student-groups/${g.slug}/${slugify(c.name)}`, committee: g.title, committeeHref: `/student-groups/${g.slug}`,
    chair: sortLeaders(leaders.filter((l) => l.level === 'CCA/Project' && l.body === c.name))[0]?.name ?? '',
    description: c.description, logo: img(c.logo), header: img(c.header), recruiting: !!c.recruitment, color: c.color, committeeColor: g.color,
  })));
  return { groups, items, committees: groups.map((g) => ({ name: g.title, href: `/student-groups/${g.slug}`, color: g.color })) };
}
