// MedSoc's committee and group colours, in one place.
//
// A body (committee or CCA) stores a colour *name* in records.bodies.color, never a hex value, so the shades can be tuned here
// without touching the database and nobody can pick an unreadable colour. Every fill takes white text (all pass 4.5:1 contrast),
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
const withAlpha = (hex: string, a: number) => hex + Math.round(a * 255).toString(16).padStart(2, '0');
const make = (slot: ToneSlot): Tone => ({ bg: TONE_SLOTS[slot], fg: FG, tint: withAlpha(TONE_SLOTS[slot], 0.12), overlay: withAlpha(TONE_SLOTS[slot], 0.55) });

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
  for (const c of candidates.slice(0, -1)) if (isToneSlot(c)) return make(c);
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
  for (const e of entries) if (isToneSlot(e.color)) { out.set(e.name, make(e.color)); used.add(e.color); }
  for (const e of [...entries].sort((a, b) => a.name.localeCompare(b.name))) {
    if (out.has(e.name)) continue;
    let i = SLOT_NAMES.indexOf(fallbackSlot(e.name));
    for (let n = 0; n < SLOT_NAMES.length && used.has(SLOT_NAMES[i]) && used.size < SLOT_NAMES.length; n++) i = (i + 1) % SLOT_NAMES.length;
    used.add(SLOT_NAMES[i]);
    out.set(e.name, make(SLOT_NAMES[i]));
  }
  return out;
}
