export type NavItem = { label: string; href: string; external?: boolean; children?: NavItem[] };

export const NAV: NavItem[] = [
  { label: 'Home', href: '/' },
  { label: 'Events', href: '/events' },
  {
    label: 'Student Life', href: '/student-life', children: [
      { label: 'Local CIPs', href: '/student-life/local-cips' },
      { label: 'Overseas CIPs', href: '/student-life/overseas-cips' },
      { label: 'Societies & SIGs', href: '/student-life/societies' },
      { label: 'Arts & Culture', href: '/student-life/arts-and-culture' },
      { label: 'House System', href: '/student-life/houses' },
      { label: "Students' Corner", href: '/students-corner' },
    ],
  },
  {
    label: 'About Us', href: '/about', children: [
      { label: 'ExCo & Committees', href: '/about' },
      { label: 'Work With Us', href: '/about/work-with-us' },
      { label: 'Honour Roll', href: '/about/honour-roll' },
      { label: 'Alumni Association', href: '/about/alumni' },
      { label: 'Policy', href: '/policy' },
    ],
  },
  { label: 'News', href: '/news' },
  { label: 'Apply', href: 'https://www.ntu.edu.sg/medicine/education/bachelor-of-medicine-and-bachelor-of-surgery-%28mbbs%29', external: true },
];
