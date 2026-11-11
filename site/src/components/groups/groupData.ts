import type { GroupItem } from '@/components/GroupsBrowser';

export type GroupData = { name: string; committee: string; committeeShort: string; description: string; chair: string; logo: string; header: string; recruiting: boolean; link: string; committeeLink: string; color: string; onColor: string; tint: string; overlay: string; initials: string };
export const toGroupData = (g: GroupItem, tone: { bg: string; fg: string; tint: string; overlay: string }): GroupData => ({
  name: g.name, committee: g.committee, committeeShort: g.committee.replace(/ Committee$/, ''), description: g.description ?? '', chair: g.chair,
  logo: g.logo, header: g.header, recruiting: g.recruiting, link: g.href, committeeLink: g.committeeHref, color: tone.bg, onColor: tone.fg, tint: tone.tint, overlay: tone.overlay,
  initials: g.name.split(/[\s(]+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join(''),
});

