import type { NextConfig } from 'next';

// Old Wix addresses -> new ones. Blog posts keep their slug (/post/x -> /news/x).
const redirects = [
  ['/post/:slug', '/news/:slug'],
  ['/blog', '/news'],
  ['/whats-up-at-lkcmedicine', '/news?category=Announcements'],
  ['/calendar', '/events'],
  ['/calendar-defunct', '/events'],
  ['/studentlife', '/student-life'],
  ['/student-ccas/lcips', '/student-life/local-cips'],
  ['/student-ccas/ocips', '/student-life/overseas-cips'],
  ['/student-ccas/societies', '/student-life/societies'],
  ['/student-ccas/clubs', '/student-life/arts-and-culture'],   // "Clubs" was the old name
  ['/student-ccas/:slug', '/student-life'],
  ['/housesystem', '/student-life/houses'],
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
