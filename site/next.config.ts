import type { NextConfig } from 'next';

// Old Wix addresses -> new ones. Blog posts keep their slug (/post/x -> /gazette/x). /news became /gazette in 2026.
const redirects = [
  // Policy moved into the sign-in-only Policy app
  ['/policy', 'https://policy.lkcmedsoc.com/'],
  ['/policy/changelog', 'https://policy.lkcmedsoc.com/#/log'],
  ['/policy/:slug/latest.pdf', 'https://policy.lkcmedsoc.com/#/d/:slug'],
  ['/policy/:slug', 'https://policy.lkcmedsoc.com/#/d/:slug'],
  ['/post/:slug', '/gazette/:slug'],
  ['/blog', '/gazette/all'],
  ['/whats-up-at-lkcmedicine', '/gazette/announcements'],
  // the News pages moved to the Gazette (query strings such as ?category= and ?ay= carry over)
  ['/gazette/impact', '/gazette/activities'],   // categories were renamed: Impact and Events became Activities, Stories became Creative
  ['/gazette/events', '/gazette/activities'],
  ['/gazette/stories', '/gazette/creative'],
  ['/news', '/gazette/all'],
  ['/news/:slug', '/gazette/:slug'],
  ['/calendar', '/events'],
  ['/calendar-defunct', '/events'],
  ['/studentlife', '/student-groups'],
  ['/student-ccas/lcips', '/about/committee/local-community-involvement'],
  ['/student-ccas/ocips', '/about/committee/overseas-community-involvement'],
  ['/student-ccas/societies', '/about/committee/careers'],
  ['/student-ccas/clubs', '/about/committee/arts-and-culture'],   // "Clubs" was the old name
  ['/student-ccas/:slug', '/student-groups'],
  ['/housesystem', '/about/house-system'],
  // renamed in the 2026 redesign
  ['/student-life', '/student-groups'],
  ['/student-life/houses', '/about/house-system'],
  ['/student-life/local-cips', '/about/committee/local-community-involvement'],
  ['/student-life/overseas-cips', '/about/committee/overseas-community-involvement'],
  ['/student-life/societies', '/about/committee/careers'],
  ['/student-life/arts-and-culture', '/about/committee/arts-and-culture'],
  ['/student-life/:slug', '/student-groups'],
  // the 2026 About structure: Leadership replaces Meet the Team, committees live under About, /about is its own page
  ['/about/meet-the-team', '/about/leadership'],
  ['/about/houses', '/about/house-system'],
  ['/student-groups/:committee', '/about/committee/:committee'],
  ['/exco/ay26-27', '/about/honour-roll/ay26-27'],
  ['/students-corner', '/resources'],
  ['/workwiithus', '/about/work-with-us'],
  ['/honourroll', '/about/honour-roll'],
  ['/alumni-association', '/about/alumni'],
  ['/signaturegenerator', '/'],
  ['/blank-2', '/'],
  ['/blank-10', '/'],
] as const;

const config: NextConfig = {
  // the PDF route reads the Arimo font files from disk: make sure they are shipped with it
  // Photos live in our Supabase storage. Next shrinks them to the size each place on the page needs.
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' }],
  },
  // The framed header (/embed/header) may only be shown by LKCMedSoc's own sites (and by localhost while developing).
  async headers() {
    const dev = process.env.NODE_ENV !== 'production';
    const ancestors = ["'self'", 'https://lkcmedsoc.com', 'https://*.lkcmedsoc.com', ...(dev ? ['http://localhost:*', 'http://127.0.0.1:*'] : [])].join(' ');
    return [{ source: '/embed/:path*', headers: [{ key: 'Content-Security-Policy', value: `frame-ancestors ${ancestors}` }] }];
  },
  async redirects() {
    return redirects.map(([source, destination]) => ({ source, destination, permanent: true }));
  },
};
export default config;
