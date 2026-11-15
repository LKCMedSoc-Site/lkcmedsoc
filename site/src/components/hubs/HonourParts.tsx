'use client';
import { useSelector } from '@plasmicapp/loader-nextjs';
import type { HonourData } from '@/lib/honour';

/** The term's write-up (from content/exco/<term>.md or the site editor), styled like every other write-up. Put it inside the Honour roll hub. */
export function HonourWriteup({ className = '' }: { className?: string }) {
  const h = useSelector('honourHub') as Partial<HonourData> | undefined;
  const html = h?.term?.writeupHtml;
  if (!html) return null;
  return <div className={`prose-lkc ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** The write-up of the committee or house page it sits in, styled in that body's colour. Put it inside the Committee page hub or House page hub. */
export function BodyAbout({ source = 'committeePage', className = '' }: { source?: 'committeePage' | 'housePage'; className?: string }) {
  const d = useSelector(source) as { aboutHtml?: string; color?: string } | undefined;
  if (!d?.aboutHtml) return null;
  return <div className={`prose-lkc group-prose ${className}`} style={{ ['--g' as string]: d.color }} dangerouslySetInnerHTML={{ __html: d.aboutHtml }} />;
}
