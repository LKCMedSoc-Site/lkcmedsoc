import type { Body } from './records';

// The icon links on a group's page: its Instagram and website, plus the list it keeps in records.bodies.socials.
// Keep the kinds in step with PATHS in components/groups/GroupIcon.tsx, sql/body_socials.sql and records/pages.js.
export const SOCIAL_KINDS = ['instagram', 'telegram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'whatsapp', 'discord', 'x', 'email', 'website'] as const;
export const SOCIAL_LABEL: Record<string, string> = { instagram: 'Instagram', telegram: 'Telegram', tiktok: 'TikTok', youtube: 'YouTube', facebook: 'Facebook', linkedin: 'LinkedIn', whatsapp: 'WhatsApp', discord: 'Discord', x: 'X', email: 'Email', website: 'Website' };

export type GroupLinkItem = { kind: string; label: string; url: string };

/** "@lkc.psych" or a full link -> an https link. */
export const instagramUrl = (v: string) => (v.startsWith('http') ? v : `https://instagram.com/${v.replace(/^@/, '')}`);

/** Which kind a pasted web address belongs to ("t.me/…" is Telegram, and so on). */
export function guessKind(url: string): string {
  if (/^mailto:|^[^@\s]+@[^@\s]+\.[^@\s]+$/i.test(url)) return 'email';
  let host = '';
  try { host = new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch { return 'website'; }
  if (/(^|\.)instagram\.com$/.test(host)) return 'instagram';
  if (host === 't.me' || /(^|\.)telegram\.(me|org)$/.test(host)) return 'telegram';
  if (/(^|\.)tiktok\.com$/.test(host)) return 'tiktok';
  if (/(^|\.)youtube\.com$/.test(host) || host === 'youtu.be') return 'youtube';
  if (/(^|\.)facebook\.com$/.test(host) || host === 'fb.com') return 'facebook';
  if (/(^|\.)linkedin\.com$/.test(host)) return 'linkedin';
  if (host === 'wa.me' || /(^|\.)whatsapp\.com$/.test(host)) return 'whatsapp';
  if (/(^|\.)discord\.(gg|com)$/.test(host)) return 'discord';
  if (host === 'x.com' || host === 'twitter.com') return 'x';
  return 'website';
}

/** Every icon link for a group, in a sensible order, without repeats. Email addresses become mailto: links. */
export function linksOf(b: Pick<Body, 'instagram' | 'website' | 'socials'>): GroupLinkItem[] {
  const raw: { kind: string; url: string }[] = [];
  if (b.instagram) raw.push({ kind: 'instagram', url: instagramUrl(b.instagram) });
  (b.socials ?? []).forEach((s) => raw.push(s));
  if (b.website) raw.push({ kind: 'website', url: b.website });
  const seen = new Set<string>();
  return raw.filter((r) => { const k = r.url.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
    .map((r) => ({ kind: r.kind, label: SOCIAL_LABEL[r.kind] ?? 'Link', url: r.kind === 'email' && !r.url.startsWith('mailto:') ? `mailto:${r.url}` : r.url }));
}
