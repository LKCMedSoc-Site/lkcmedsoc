'use client';
import { useSelector } from '@plasmicapp/loader-nextjs';
import GroupIcon from './GroupIcon';
import type { GroupPageData } from '@/lib/group-page';

// Small pieces for a page built inside the Group page hub. They read the page's group ($ctx.groupPage), so they need no settings.

/** The group's write-up with every block (columns, toggles, callouts, photos, buttons, quotes, video) styled. */
export function GroupAbout({ className = '' }: { className?: string }) {
  const g = useSelector('groupPage') as GroupPageData | undefined;
  if (!g?.aboutHtml) return null;
  return <div className={`prose-lkc group-prose ${className}`} style={{ ['--g' as string]: g.color }} dangerouslySetInnerHTML={{ __html: g.aboutHtml }} />;
}

/** One social icon. Inside a repeat of $ctx.groupPage.links leave "Which icon" empty to use the current link's kind. */
export function GroupSocialIcon({ kind = '', size = 22, className = '' }: { kind?: string; size?: number; className?: string }) {
  return <GroupIcon kind={kind || 'website'} size={size} className={className} />;
}
