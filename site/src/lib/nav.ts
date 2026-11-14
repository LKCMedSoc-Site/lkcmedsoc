import { TILE_GROUPS } from './students-corner';
import menu from '../../public/menu.json';

export type NavItem = { label: string; href: string; note?: string; external?: boolean; children?: NavItem[] };

const tiles = TILE_GROUPS.flatMap((g) => g.tiles);
const tile = (label: string): NavItem => { const t = tiles.find((x) => x.label === label)!; return { label: t.label, href: t.href, note: t.note, external: /^https?:/.test(t.href) }; };

// The main menu lives in public/menu.json, which the app bar on records, activities and feedback reads too (public/suite-nav.js).
// Edit it there. `note` is the one-line description shown in the drop-down panels.
// Student Groups' children are replaced with the parent committees that have groups, from the database (see app/layout.tsx).
export const NAV: NavItem[] = menu.items as unknown as NavItem[];

export const RESOURCES = { label: 'Resources', href: '/resources' };
export const APPLY = { label: 'Apply', href: 'https://www.ntu.edu.sg/medicine/education/bachelor-of-medicine-and-bachelor-of-surgery-%28mbbs%29', external: true };

/** Shortcuts shown in the mobile menu. */
export const QUICK = [tile('Plan an event'), tile('Book a venue'), tile('Send feedback'), tile('My events')];

/** A card shown beside one menu's drop-down (a promo or highlight). `menu` is the menu's name in lower case with dashes: student-groups, about, resources. */
export type Highlight = { menu: string; eyebrow?: string; title?: string; body?: string; linkText?: string; url?: string };
const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
/** Does this top-level item answer to the given menu name? "about" matches "About Us". */
export const isMenu = (item: { label: string }, key?: string) => { const k = slug(key ?? ''); const l = slug(item.label); return !!k && (l === k || l.startsWith(k + '-')); };
