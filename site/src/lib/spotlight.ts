import { groupsOf, sortLeaders, type Body, type Group, type Leader } from './records';

/** One CCA is featured each week, picked from those that already have named leaders. */
export function pickSpotlight(bodies: Body[], leaders: Leader[], now = Date.now()) {
  const groups = groupsOf(bodies);
  const ccaCount = groups.reduce((n, g) => n + g.ccas.length, 0);
  const all = groups.flatMap((g) => g.ccas.map((c) => ({ c, g })));
  const led = all.filter(({ c }) => leaders.some((l) => l.level === 'CCA/Project' && l.body === c.name));
  const pool = led.length ? led : all;
  const spot: { c: Body; g: Group } | undefined = pool.length ? pool[Math.floor(now / (7 * 864e5)) % pool.length] : undefined;
  const spotLeaders = spot ? sortLeaders(leaders.filter((l) => l.level === 'CCA/Project' && l.body === spot.c.name)) : [];
  return { groups, ccaCount, spot, spotLeaders };
}
