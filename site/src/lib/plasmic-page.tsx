import { PLASMIC } from '@/plasmic-init';
import PlasmicLazy from './plasmic-lazy';

// Pages and layout pieces can be designed in Plasmic Studio. Each place checks for one and falls back to the coded version, so nothing
// breaks while pages are moved over one at a time, and nothing breaks if Plasmic cannot be reached.

/** Look up something designed in Plasmic: a page by its path ("/events") or a component by its name ("Header"). null when there is none. */
export async function plasmicData(lookup: string) {
  if (!process.env.PLASMIC_PROJECT_ID) return null;
  try { return await PLASMIC.maybeFetchComponentData(lookup); } catch { return null; }
}

// The Plasmic runtime is large, so it is loaded lazily (see plasmic-lazy.tsx): visitors to coded pages never download it.
export function PlasmicView({ data }: { data: NonNullable<Awaited<ReturnType<typeof plasmicData>>> }) {
  return <PlasmicLazy data={data} />;
}

/** The Plasmic version when one is published, otherwise the children. */
export async function PlasmicOr({ lookup, children }: { lookup: string; children: React.ReactNode }) {
  const data = await plasmicData(lookup);
  return data ? <PlasmicView data={data} /> : <>{children}</>;
}
