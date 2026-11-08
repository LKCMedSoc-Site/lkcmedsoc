'use client';
import { usePlasmicCanvasContext } from '@plasmicapp/loader-nextjs';
import Header from '@/components/Header';
import type { Highlight, NavItem } from '@/lib/nav';

export type SiteHeaderBlockProps = {
  logoText?: string; tagline?: string; menuItems?: NavItem[]; highlights?: Highlight[]; ctaText?: string; ctaUrl?: string;
  previewOpenMenu?: 'none' | 'student-groups' | 'about' | 'resources' | 'apps';
  pinned?: 'fixed' | 'sticky'; hideOnScrollDown?: boolean; className?: string;
};

// The site's own header, for Plasmic: same look and behaviour, with its words, links, highlight cards and button editable in Studio.
// previewOpenMenu only does anything inside Studio, so a drop-down can be opened on the canvas without hovering.
export default function SiteHeaderBlock({ previewOpenMenu = 'none', pinned = 'fixed', ...rest }: SiteHeaderBlockProps) {
  const inStudio = !!usePlasmicCanvasContext();
  return <Header {...rest} pinned={pinned} previewOpen={inStudio ? previewOpenMenu : 'none'} />;
}
