import type { SupabaseClient } from '@supabase/supabase-js';
import { ordinal } from './ay';
import { ymd } from './dates';

/**
 * The House Cup as the database gives it (activities.house_cup, see sql/house_cup.sql). Raw points are never in here: each cell is a house's
 * SHARE of the points all houses earned for one reason, and `weighted` is that share times the reason's weight (so the totals are out of 100).
 */
export type CupHouse = { id: string; name: string; color: string | null; total: number; rank: number };
export type CupReason = { id: string; name: string; weight: number; effective_weight: number; awarded_on: string; cells: { house_id: string; share: number; weighted: number }[] };
export type HouseCupYear = { ay: string; is_final: boolean; weights_total: number; houses: CupHouse[]; reasons: CupReason[] };

/** Every academic year that has at least one reason, newest first. A failure gives an empty list (the pages then show their empty state). */
export async function loadHouseCup(client: SupabaseClient): Promise<HouseCupYear[]> {
  const act = client.schema('activities');
  const ys = await act.rpc('house_cup_years');
  if (ys.error) return [];
  const years = ((ys.data ?? []) as string[]).slice().sort().reverse();
  const all = await Promise.all(years.map((ay) => act.rpc('house_cup', { p_ay: ay }).then((r) => (r.error ? null : (r.data as HouseCupYear)))));
  return all.filter((y): y is HouseCupYear => !!y && y.reasons.length > 0);
}

const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** 22.4 -> "22.4", 22 -> "22", 22.44 -> "22.44" (up to two decimals, no trailing zeros). */
export const pointsText = (n: number) => String(Math.round(n * 100) / 100);
export const rankLabel = (rank: number) => (rank > 0 ? ordinal(rank) : '');

/** The year to treat as "current": the given AY if it has results, otherwise nothing (when an AY is known), or the newest year (when none is). */
export function currentYear(cups: HouseCupYear[], ay: string): HouseCupYear | null {
  if (ay) return cups.find((y) => y.ay === ay) ?? null;
  return cups[0] ?? null;
}

/** "Updated 12 Nov" from the latest date a reason was recorded. */
export function updatedText(y: HouseCupYear): string {
  const last = y.reasons.map((r) => r.awarded_on).sort().pop();
  const d = ymd(last);
  return d ? `Updated ${d[2]} ${SHORT[d[1] - 1]}` : '';
}

/** One house's place in one year, in the shape Studio binds to. */
export function placingOf(y: HouseCupYear, houseName: string) {
  const h = y.houses.find((x) => x.name === houseName);
  if (!h) return null;
  return { ay: y.ay, rank: h.rank, rankLabel: rankLabel(h.rank), points: pointsText(h.total), isFinal: y.is_final, statusText: y.is_final ? 'Final' : 'So far' };
}
export type Placing = NonNullable<ReturnType<typeof placingOf>>;
export const EMPTY_PLACING: Placing = { ay: '', rank: 0, rankLabel: '', points: '', isFinal: false, statusText: '' };
