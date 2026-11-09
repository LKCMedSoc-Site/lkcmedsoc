'use client';
import dynamic from 'next/dynamic';
import type { plasmicData } from './plasmic-page';
import type { HubSeed } from './hub-seed';

// A tiny client wrapper that loads the large Plasmic runtime only when this actually renders (when a Plasmic design exists).
const PlasmicClientView = dynamic(() => import('./plasmic-client-view'));

export default function PlasmicLazy({ data, seed = null }: { data: NonNullable<Awaited<ReturnType<typeof plasmicData>>>; seed?: HubSeed | null }) {
  return <PlasmicClientView data={data} seed={seed} />;
}
