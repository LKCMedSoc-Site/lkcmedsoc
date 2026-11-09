'use client';
import { PlasmicComponent } from '@plasmicapp/loader-nextjs';
import { ClientPlasmicRootProvider } from '@/plasmic-init-client';
import type { plasmicData } from './plasmic-page';
import type { HubSeed } from './hub-seed';
import { HubSeedProvider } from '@/components/hubs/HubSeed';

// The browser half of a page or layout piece designed in Plasmic. Only loaded when there is one (see PlasmicView).
export default function PlasmicClientView({ data, seed = null }: { data: NonNullable<Awaited<ReturnType<typeof plasmicData>>>; seed?: HubSeed | null }) {
  const meta = data.entryCompMetas[0];
  return (
    <ClientPlasmicRootProvider prefetchedData={data} pageRoute={meta.path} pageParams={meta.params}>
      <HubSeedProvider seed={seed}><div className="plasmic-page"><PlasmicComponent component={meta.displayName} /></div></HubSeedProvider>
    </ClientPlasmicRootProvider>
  );
}
