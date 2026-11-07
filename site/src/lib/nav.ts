import { TILE_GROUPS } from './students-corner';

export type NavItem = { label: string; href: string; note?: string; external?: boolean; children?: NavItem[] };

const tiles = TILE_GROUPS.flatMap((g) => g.tiles);
const tile = (label: string): NavItem => { const t = tiles.find((x) => x.label === label)!; return { label: t.label, href: t.href, note: t.note, external: /^https?:/.test(t.href) }; };

// Main menu. `note` is the one-line description shown in the drop-down panels.
// Student Groups' children are the parent committees, filled in from the database (see app/layout.tsx).
export const NAV: NavItem[] = [
  { label: 'Events', href: '/events' },
  {
    label: 'Student Groups', href: '/student-groups', note: 'Every CCA, run by students, grouped by the committee it belongs to.', children: [
      { label: 'Local Community Involvement Committee', href: '/student-groups/local-community-involvement' },
      { label: 'Overseas Community Involvement Committee', href: '/student-groups/overseas-community-involvement' },
      { label: 'Careers Committee', href: '/student-groups/careers' },
      { label: 'Arts and Culture Committee', href: '/student-groups/arts-and-culture' },
    ],
  },
  {
    label: 'About Us', href: '/about/meet-the-team', note: 'Who we are and how to join us.', children: [
      { label: 'Meet the Team', href: '/about/meet-the-team', note: 'ExCo, committees, year and stream reps' },
      { label: 'House System', href: '/about/houses', note: 'The houses and their representatives' },
      { label: 'Work With Us', href: '/about/work-with-us', note: 'Join a committee or CCA' },
      { label: 'Honour Roll', href: '/about/honour-roll', note: 'Past leaders, year by year' },
      { label: 'Alumni Association', href: '/about/alumni', note: 'Staying connected after graduation' },
    ],
  },
  {
    label: 'Resources', href: '/resources', note: 'Tools and documents for students and CCAs.', children: [
      tile('Plan an event'), tile('Book a venue'), tile('Check the inventory'), tile('Send feedback'), tile('My events'), tile('MedSoc policy'),
    ],
  },
  { label: 'News', href: '/news' },
];

export const RESOURCES = { label: 'Resources', href: '/resources' };
export const APPLY = { label: 'Apply', href: 'https://www.ntu.edu.sg/medicine/education/bachelor-of-medicine-and-bachelor-of-surgery-%28mbbs%29', external: true };

/** Shortcuts shown in the mobile menu. */
export const QUICK = [tile('Plan an event'), tile('Book a venue'), tile('Send feedback'), tile('My events')];
