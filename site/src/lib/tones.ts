// MedSoc's committee and group colours, in one place.
//
// A body (committee or CCA) stores either a colour *name* from the list below or any #rrggbb hex in records.bodies.color. Names can be
// tuned here without touching the database; a hex is darkened by readable() so nobody can pick an unreadable colour. Every fill takes white text (all pass 4.5:1 contrast),
// so chips, badges and cards read as one family. None of them are purple: purple is the site's own colour, so committees stand
// out against it.
//
// records/pages.js shows the same swatches in the colour picker; keep the two lists in step.

export const TONE_SLOTS = {
  blue: '#1d4ed8',
  cyan: '#0e7490',
  teal: '#0f766e',
  green: '#15803d',
  amber: '#b45309',
  orange: '#c2410c',
  red: '#b91c1c',
  slate: '#475569',
} as const;

export type ToneSlot = keyof typeof TONE_SLOTS;
export type Tone = { bg: string; fg: string; tint: string; overlay: string };

const SLOT_NAMES = Object.keys(TONE_SLOTS) as ToneSlot[];
const FG = '#ffffff';

// A colour as a see-through wash: tint (about 12%) is the light resting state of a chip or pill; overlay (about 55%) is the wash over a photo.
export const withAlpha = (hex: string, a: number) => hex + Math.round(a * 255).toString(16).padStart(2, '0');
const makeHex = (hex: string): Tone => ({ bg: hex, fg: FG, tint: withAlpha(hex, 0.12), overlay: withAlpha(hex, 0.55) });
const make = (slot: ToneSlot): Tone => makeHex(TONE_SLOTS[slot]);
const fromStored = (c: unknown): Tone | null => (isToneSlot(c) ? make(c) : isHexColor(c) ? makeHex(readable(c.toLowerCase())) : null);

const HEX = /^#[0-9a-fA-F]{6}$/;
export const isHexColor = (v: unknown): v is string => typeof v === 'string' && HEX.test(v);

const channel = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const luminance = (rgb: number[]) => 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);

/** Any picked colour, darkened only as far as needed for white text to reach 4.5:1. Keep in step with readable() in records/pages.js. */
export function readable(hex: string): string {
  let rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  for (let n = 0; n < 40 && 1.05 / (luminance(rgb) + 0.05) < 4.5; n++) rgb = rgb.map((v) => Math.round(v * 0.95));
  return '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');
}

export const isToneSlot = (v: unknown): v is ToneSlot => typeof v === 'string' && v in TONE_SLOTS;

/** A stable pick from a name, so a body with no colour set still gets one that doesn't change between visits or when the list changes. */
function fallbackSlot(name: string): ToneSlot {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (Math.imul(h, 31) + name.charCodeAt(i)) >>> 0;
  return SLOT_NAMES[h % SLOT_NAMES.length];
}

/**
 * The colour for a body. Pass the body's own stored colour first, then the parent committee's, then its name for the fallback:
 * toneFor(cca.color, committee.color, cca.name).
 */
export function toneFor(...candidates: (string | null | undefined)[]): Tone {
  const name = String(candidates[candidates.length - 1] ?? '');
  for (const c of candidates.slice(0, -1)) { const t = fromStored(c); if (t) return t; }
  return make(fallbackSlot(name));
}

/**
 * Colours for a set of bodies that sit side by side (every committee on the Student Groups page). Chosen colours are kept; the rest
 * take their name-based pick, moved along to the next free colour when two would match, so no two committees share one while
 * there are colours to spare. Names are handled in alphabetical order, so the result doesn't depend on how the list is ordered.
 */
export function assignTones(entries: { name: string; color?: string | null }[]): Map<string, Tone> {
  const out = new Map<string, Tone>();
  const used = new Set<ToneSlot>();
  for (const e of entries) { const t = fromStored(e.color); if (!t) continue; out.set(e.name, t); if (isToneSlot(e.color)) used.add(e.color); }
  for (const e of [...entries].sort((a, b) => a.name.localeCompare(b.name))) {
    if (out.has(e.name)) continue;
    let i = SLOT_NAMES.indexOf(fallbackSlot(e.name));
    for (let n = 0; n < SLOT_NAMES.length && used.has(SLOT_NAMES[i]) && used.size < SLOT_NAMES.length; n++) i = (i + 1) % SLOT_NAMES.length;
    used.add(SLOT_NAMES[i]);
    out.set(e.name, make(SLOT_NAMES[i]));
  }
  return out;
}
