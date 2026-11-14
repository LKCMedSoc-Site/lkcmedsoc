import type { CSSProperties } from 'react';

// Social and contact icons, drawn in one simple outline style so they sit well together and take any colour (currentColor).
// Keep the kinds in step with SOCIAL_KINDS in lib/group-links.ts, sql/body_socials.sql and records/pages.js.
const PATHS: Record<string, React.ReactNode> = {
  instagram: <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></>,
  telegram: <path d="M21 3 3 10.5l6.5 2.5L12 20l2.8-5.2L19 18z M9.5 13 21 3" />,
  tiktok: <path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5 M14 3c.4 2.6 2 4.2 5 4.5" />,
  youtube: <><rect x="2" y="5.5" width="20" height="13" rx="4" /><path d="M10 9.5v5l4.5-2.5z" fill="currentColor" /></>,
  facebook: <path d="M15 3h-2.5A3.5 3.5 0 0 0 9 6.5V9H6.5v3.5H9V21h3.5v-8.5H15L15.5 9h-3V6.8c0-.5.3-.8.8-.8H15z" />,
  linkedin: <><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M8 10v6 M8 7.5v.01 M12 16v-6 M12 12.5a2.5 2.5 0 0 1 5 0V16" /></>,
  whatsapp: <><path d="M3 21l1.6-4.8A8.5 8.5 0 1 1 8 19.5z" /><path d="M9 9c.5 2.5 2.5 4.5 5.500 5.500l1-1.500-2-1-1 .8c-.8-.4-1.600-1.200-2-2l.8-1-1-2z" fill="currentColor" stroke="none" /></>,
  discord: <><path d="M5 7c2-1.200 4-1.800 5-2l.6 1.200c.9-.1 1.900-.1 2.800 0L14 5c1 .2 3 .8 5 2 1.500 3 2 6 1.800 9-1.500 1.200-3 1.800-4.300 2.200l-1-1.600c-1.600.5-3.400.5-5 0l-1 1.600C5.200 17.800 3.700 17.200 2.200 16 2 13 2.500 10 4 7" /><circle cx="9" cy="12.5" r="1.200" fill="currentColor" stroke="none" /><circle cx="15" cy="12.5" r="1.200" fill="currentColor" stroke="none" /></>,
  x: <path d="M4 4l16 16 M20 4 4 20" />,
  email: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M3.500 7.500 12 13l8.500-5.500" /></>,
  website: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18 M12 3c2.500 2.500 3.500 5.500 3.500 9S14.500 18.500 12 21c-2.500-2.500-3.500-5.500-3.500-9S9.500 5.500 12 3z" /></>,
  join: <path d="M5 12h14 M13 6l6 6-6 6" />,
};

/** One icon by kind ("instagram", "telegram", "email", "website", …). Unknown kinds show the website globe. */
export default function GroupIcon({ kind = 'website', size = 22, className = '', style }: { kind?: string; size?: number; className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} style={style}>
      {PATHS[kind] ?? PATHS.website}
    </svg>
  );
}
