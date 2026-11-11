'use client';
import { useSelector } from '@plasmicapp/loader-nextjs';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { GroupData } from './GroupsList';

const SAMPLE: GroupData = { name: 'Sample Group', committee: 'Sample Committee', committeeShort: 'Sample', description: 'A short description of what this group does.', chair: 'Alex Tan', logo: '', header: '', recruiting: true, link: '', committeeLink: '', color: '#0f766e', onColor: '#ffffff', tint: '#0f766e1f', overlay: '#0f766e8c', initials: 'SG' };
// Inside a groups list these read the group being shown. Anywhere else they show a sample, so a card can still be designed.
const useGroup = (): GroupData => (useSelector('group') as GroupData | undefined) ?? SAMPLE;

export function GroupText({ field = 'name', prefix = '', clamp = 0, className = '' }: { field?: 'name' | 'committeeShort' | 'committee' | 'description' | 'chair'; prefix?: string; clamp?: number; className?: string }) {
  const g = useGroup(); const v = g[field];
  if (!v) return null;
  const style = clamp > 0 ? ({ display: '-webkit-box', WebkitLineClamp: clamp, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as const) : undefined;
  return <span className={className} style={style}>{prefix}{v}</span>;
}

// Logo or header picture, in the shape and proportions you choose. Tinted with the committee colour (and initials) when there is none.
export function GroupImage({ source = 'header', shape = 'rounded', ratio = '16/9', hideIfMissing = false, className = '' }: { source?: 'header' | 'logo'; shape?: 'square' | 'rounded' | 'round'; ratio?: '16/9' | '4/3' | '1/1' | '4/5'; hideIfMissing?: boolean; className?: string }) {
  const g = useGroup(); const src = source === 'logo' ? g.logo : g.header;
  if (!src && hideIfMissing) return null;
  const box = { aspectRatio: shape === 'round' ? '1 / 1' : ratio.replace('/', ' / '), borderRadius: shape === 'round' ? '9999px' : shape === 'rounded' ? '12px' : '0', width: '100%', overflow: 'hidden' } as const;
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt={source === 'logo' ? `${g.name} logo` : ''} loading="lazy" style={{ ...box, objectFit: 'cover' }} className={className} />
    : <span aria-hidden style={{ ...box, background: g.color, color: g.onColor }} className={`display grid place-items-center text-4xl ${className}`}>{g.initials}</span>;
}

// The committee name on its own colour, like a tag. “Dot” shows only the colour.
export function GroupBadge({ look = 'pill', className = '' }: { look?: 'pill' | 'bar' | 'dot'; className?: string }) {
  const g = useGroup();
  if (look === 'dot') return <span aria-hidden className={`inline-block h-3 w-3 rounded-full ${className}`} style={{ background: g.color }} />;
  return <span className={`inline-block text-xs font-bold uppercase tracking-wider ${look === 'pill' ? 'rounded-full px-3 py-1' : 'w-full px-4 py-2'} ${className}`} style={{ background: g.color, color: g.onColor }}>{g.committeeShort}</span>;
}

export function GroupRecruiting({ label = 'Recruiting', className = '' }: { label?: string; className?: string }) {
  const g = useGroup();
  return g.recruiting ? <span className={`inline-block rounded-full bg-pink px-2.5 py-0.5 text-xs font-bold text-p950 ${className}`}>{label}</span> : null;
}

// Wrap the whole card to link to the group's page.
export function GroupLink({ children, className = '' }: { children?: ReactNode; className?: string }) {
  const g = useGroup();
  return g.link ? <Link href={g.link} className={`block no-underline ${className}`}>{children}</Link> : <div className={className}>{children}</div>;
}
