import { clip } from '@/lib/text';
import type { GroupItem } from '@/components/GroupsBrowser';

export type GroupData = { name: string; committee: string; committeeShort: string; description: string; chair: string; logo: string; header: string; recruiting: boolean; link: string; committeeLink: string; color: string; onColor: string; tint: string; overlay: string; committeeColor: string; committeeOnColor: string; committeeTint: string; committeeOverlay: string; initials: string };
type ToneLike = { bg: string; fg: string; tint: string; overlay: string };
/** `tone` is the group's own colour (or its committee's if it chose none); `committeeTone` is always the committee's, for the committee tag on a card. */
export const toGroupData = (g: GroupItem, tone: ToneLike, committeeTone: ToneLike = tone): GroupData => ({
  name: g.name, committee: g.committee, committeeShort: g.committee.replace(/ Committee$/, ''), description: clip(g.description) ?? '', chair: g.chair,
  logo: g.logo, header: g.header, recruiting: g.recruiting, link: g.href, committeeLink: g.committeeHref, color: tone.bg, onColor: tone.fg, tint: tone.tint, overlay: tone.overlay,
  committeeColor: committeeTone.bg, committeeOnColor: committeeTone.fg, committeeTint: committeeTone.tint, committeeOverlay: committeeTone.overlay,
  initials: g.name.split(/[\s(]+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join(''),
});

