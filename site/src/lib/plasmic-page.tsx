import { PLASMIC } from '@/plasmic-init';
import PlasmicLazy from './plasmic-lazy';
import { getHubSeed } from './hub-seed';

// Pages and layout pieces can be designed in Plasmic Studio. Each place checks for one and falls back to the coded version, so nothing
// breaks while pages are moved over one at a time, and nothing breaks if Plasmic cannot be reached.

/** Look up something designed in Plasmic: a page by its path ("/events") or a component by its name ("Header"). null when there is none. */
export async function plasmicData(lookup: string) {
  if (!process.env.PLASMIC_PROJECT_ID) return null;
  try { return await PLASMIC.maybeFetchComponentData(lookup); } catch { return null; }
}

// The Plasmic runtime is large, so it is loaded lazily (see plasmic-lazy.tsx): visitors to coded pages never download it.
// A page designed in Plasmic carries a marker in its HTML. While the marker is there, the layout's own header and footer are hidden (see .site-chrome in
// globals.css), so a header and footer placed inside the Plasmic page are the only ones. Layout pieces (the Header and Footer components) pass piece.
// Pages also get the live data their hubs need (see lib/hub-seed.ts), so they render with content on the first load.
export async function PlasmicView({ data, piece = false }: { data: NonNullable<Awaited<ReturnType<typeof plasmicData>>>; piece?: boolean }) {
  const seed = piece ? null : await getHubSeed(JSON.stringify(data));
  return <>{piece ? null : <div hidden data-plasmic-route="" />}<PlasmicLazy data={data} seed={seed} /></>;
}

/** The Plasmic version when one is published, otherwise the children. */
export async function PlasmicOr({ lookup, children }: { lookup: string; children: React.ReactNode }) {
  const data = await plasmicData(lookup);
  return data ? <PlasmicView data={data} piece /> : <>{children}</>;
}
