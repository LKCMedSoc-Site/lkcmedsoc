// An ExCo year is an academic year like "AY26/27". AY26/27 is the 14th ExCo (the 1st was AY13/14).
// Which term an activity or post belongs to is stored in the database (the ay column), never worked out from dates.
const FIRST_START = 13;   // AY13/14 = 1st ExCo

export const isAy = (s: string) => /^AY\d{2}\/\d{2}$/.test(s);
export const ayNumber = (ay: string) => parseInt(ay.slice(2, 4), 10) - FIRST_START + 1;
export function ordinal(n: number) {
  const v = n % 100;
  return n + (['th', 'st', 'nd', 'rd'][(v - 20) % 10] || ['th', 'st', 'nd', 'rd'][v] || 'th');
}
export const exco = (ay: string) => `${ordinal(ayNumber(ay))} ExCo`;
export const ayToSlug = (ay: string) => ay.toLowerCase().replace('/', '-');           // AY26/27 -> ay26-27
export const slugToAy = (slug: string) => { const m = /^ay(\d{2})-(\d{2})$/.exec(slug); return m ? `AY${m[1]}/${m[2]}` : null; };
