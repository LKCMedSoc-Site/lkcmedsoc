'use client';
import { useEffect, useState } from 'react';
import { NAV, type NavItem } from './nav';
import { fetchBodies } from './records-client';
import { groupsOf, slugify } from './records';
import type { SearchItem } from '@/components/SearchOverlay';

/**
 * The site menu with Student Groups filled in from the database, plus the search index (pages and CCAs).
 * The layout passes `groups` and `index` from the server, so the header never flashes. When the menu pieces are used inside a
 * page designed in Plasmic nobody passes them, so they are loaded in the browser instead.
 */
export function useSiteMenu(groups: NavItem[] = [], index: SearchItem[] = []) {
  const [data, setData] = useState({ groups, index });
  useEffect(() => {
    if (groups.length) return;
    let off = false;
    fetchBodies().then((bodies) => {
      if (off) return;
      const gs = groupsOf(bodies);
      setData({
        groups: gs.map((g) => ({ label: g.title, href: `/student-groups/${g.slug}` })),
        index: gs.flatMap((g) => g.ccas.map((c) => ({ label: c.name, href: `/student-groups/${g.slug}/${slugify(c.name)}`, kind: 'CCA', hint: g.title }))),
      });
    }).catch(() => { /* the fallback list in menu.json stays */ });
    return () => { off = true; };
  }, [groups.length]);
  const nav = NAV.map((n) => (n.label === 'Student Groups' && data.groups.length ? { ...n, children: data.groups } : n));
  const items: SearchItem[] = [
    ...nav.flatMap((n) => [{ label: n.label, href: n.href, kind: 'Page', hint: n.note }, ...(n.children ?? []).map((c) => ({ label: c.label, href: c.href, kind: 'Page', hint: c.note }))]),
    ...data.index,
  ].filter((v, i, a) => a.findIndex((x) => x.href === v.href && x.label === v.label) === i);
  return { nav, items, groups: data.groups, index: data.index };
}
