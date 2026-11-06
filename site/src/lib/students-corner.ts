// The tiles on the Students' Corner page. To change one, edit the words or the address between the quotes.
// To add a tile, copy a line. To hide one, delete its line. Save, and the site updates after the next deploy.

export type Tile = { label: string; note: string; href: string };
export type TileGroup = { title: string; tiles: Tile[] };

const PORTAL = 'https://portal.lkcmedsoc.com';

export const TILE_GROUPS: TileGroup[] = [
  {
    title: 'Organise an event',
    tiles: [
      { label: 'Plan an event', note: 'Start a new activity and send it for approval.', href: `${PORTAL}/#/new` },
      { label: 'Book a venue', note: 'Reserve rooms and spaces.', href: 'https://booking.lkcmedsoc.com' },
      { label: 'Check the inventory', note: 'See what equipment is available and reserve it.', href: 'https://inventory.lkcmedsoc.com' },
    ],
  },
  {
    title: 'Run your CCA or committee',
    tiles: [
      { label: 'Our activities', note: 'Track every event, its approvals and paperwork.', href: `${PORTAL}/#/activities` },
      { label: 'Write-ups', note: 'Write up a past event, with photos, for the News page.', href: `${PORTAL}/#/posts` },
      { label: 'Leadership records', note: 'Check and update who leads and takes part.', href: 'https://records.lkcmedsoc.com' },
    ],
  },
  {
    title: 'Have your say',
    tiles: [
      { label: 'Suggestion box', note: 'Tell ExCo what to improve. You can stay anonymous.', href: `${PORTAL}/#/suggest` },
      { label: 'You said, we did', note: 'What ExCo has changed because of your suggestions.', href: `${PORTAL}/#/said` },
      { label: 'My events', note: 'Events you have signed up for.', href: `${PORTAL}/#/mine` },
    ],
  },
  {
    title: 'Policies and guides',
    tiles: [
      { label: 'MedSoc policy', note: 'How MedSoc and its CCAs operate.', href: '/policy' },
      { label: 'Work with us', note: 'Join a committee or CCA.', href: '/about/work-with-us' },
      { label: 'Honour roll', note: 'Past ExCo teams, year by year.', href: '/about/honour-roll' },
    ],
  },
];
