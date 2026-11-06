import type { NextConfig } from 'next';

// Old Wix addresses -> new ones. Blog posts keep their slug (/post/x -> /news/x).
const redirects = [
  ['/post/:slug', '/news/:slug'],
  ['/blog', '/news'],
  ['/whats-up-at-lkcmedicine', '/news?category=Announcements'],
  ['/calendar', '/events'],
  ['/calendar-defunct', '/events'],
  ['/studentlife', '/student-groups'],
  ['/student-ccas/lcips', '/student-groups/local-community-involvement'],
  ['/student-ccas/ocips', '/student-groups/overseas-community-involvement'],
  ['/student-ccas/societies', '/student-groups/careers'],
  ['/student-ccas/clubs', '/student-groups/arts-and-culture'],   // "Clubs" was the old name
  ['/student-ccas/:slug', '/student-groups'],
  ['/housesystem', '/about/houses'],
  // renamed in the 2026 redesign
  ['/student-life', '/student-groups'],
  ['/student-life/houses', '/about/houses'],
  ['/student-life/local-cips', '/student-groups/local-community-involvement'],
  ['/student-life/overseas-cips', '/student-groups/overseas-community-involvement'],
  ['/student-life/societies', '/student-groups/careers'],
  ['/student-life/arts-and-culture', '/student-groups/arts-and-culture'],
  ['/student-life/:slug', '/student-groups'],
  ['/about', '/about/meet-the-team'],
  ['/students-corner', '/resources'],
  ['/workwiithus', '/about/work-with-us'],
  ['/honourroll', '/about/honour-roll'],
  ['/alumni-association', '/about/alumni'],
  ['/signaturegenerator', '/'],
  ['/blank-2', '/'],
  ['/blank-10', '/'],
] as const;

const config: NextConfig = {
  // Photos live in our Supabase storage. Next shrinks them to the size each place on the page needs.
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' }],
  },
  async redirects() {
    return redirects.map(([source, destination]) => ({ source, destination, permanent: true }));
  },
};
export default config;
