import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PlasmicComponent } from '@plasmicapp/loader-nextjs';
import { PLASMIC } from '@/plasmic-init';
import { ClientPlasmicRootProvider } from '@/plasmic-init-client';
import { getHubSeed } from '@/lib/hub-seed';
import { HubSeedProvider } from '@/components/hubs/HubSeed';

// Trial area: pages designed in Plasmic whose path starts with /trial (e.g. /trial/news). Real pages are untouched.
export const revalidate = 60;
type Props = { params: Promise<{ catchall?: string[] }> };
const toPath = (parts?: string[]) => '/trial' + (parts?.length ? '/' + parts.join('/') : '');

export const metadata: Metadata = { robots: { index: false } };

export default async function TrialPage({ params }: Props) {
  const plasmicPath = toPath((await params).catchall);
  const data = await PLASMIC.maybeFetchComponentData(plasmicPath);
  if (!data) notFound();
  const meta = data.entryCompMetas[0];
  const seed = await getHubSeed(JSON.stringify(data));
  return (
    <>
      <div hidden data-plasmic-route="" />
      <ClientPlasmicRootProvider prefetchedData={data} pageRoute={meta.path} pageParams={meta.params}>
        <HubSeedProvider seed={seed}><div className="plasmic-page"><PlasmicComponent component={meta.displayName} /></div></HubSeedProvider>
      </ClientPlasmicRootProvider>
    </>
  );
}

export async function generateStaticParams() {
  try {
    const pages = await PLASMIC.fetchPages();
    return pages.filter((p) => p.path === '/trial' || p.path.startsWith('/trial/'))
      .map((p) => ({ catchall: p.path.split('/').slice(2) }));
  } catch { return []; }
}
