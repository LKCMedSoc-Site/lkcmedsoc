'use client';
import { PlasmicComponent } from '@plasmicapp/loader-nextjs';
import { ClientPlasmicRootProvider } from '@/plasmic-init-client';
import type { plasmicData } from './plasmic-page';

// The browser half of a page or layout piece designed in Plasmic. Only loaded when there is one (see PlasmicView).
export default function PlasmicClientView({ data }: { data: NonNullable<Awaited<ReturnType<typeof plasmicData>>> }) {
  const meta = data.entryCompMetas[0];
  return (
    <ClientPlasmicRootProvider prefetchedData={data} pageRoute={meta.path} pageParams={meta.params}>
      <PlasmicComponent component={meta.displayName} />
    </ClientPlasmicRootProvider>
  );
}
