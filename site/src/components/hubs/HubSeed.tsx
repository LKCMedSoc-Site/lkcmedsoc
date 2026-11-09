'use client';
import { createContext, useContext, type ReactNode } from 'react';
import type { HubSeed } from '@/lib/hub-seed';

// Carries the server-fetched data (see lib/hub-seed.ts) to the hubs inside a page designed in Plasmic.
const Ctx = createContext<HubSeed | null>(null);
export function HubSeedProvider({ seed, children }: { seed: HubSeed | null; children?: ReactNode }) {
  return <Ctx.Provider value={seed}>{children}</Ctx.Provider>;
}
export const useHubSeed = () => useContext(Ctx);
