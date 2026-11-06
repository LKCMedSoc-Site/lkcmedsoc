'use client';
import * as React from 'react';
import { PlasmicRootProvider } from '@plasmicapp/loader-nextjs';
import { PLASMIC } from './plasmic-init';
import LiveNews from '@/components/LiveNews';
import LiveEvents from '@/components/LiveEvents';

export function ClientPlasmicRootProvider(props: Omit<React.ComponentProps<typeof PlasmicRootProvider>, 'loader'>) {
  return <PlasmicRootProvider loader={PLASMIC} {...props} />;
}

// The pieces that appear in Plasmic's "Add" menu. They show real, live data.
PLASMIC.registerComponent(LiveNews, {
  name: 'LiveNews',
  displayName: 'News list (live)',
  description: 'Latest published news cards, from our database.',
  props: {
    category: { type: 'choice', options: ['All', 'Impact', 'Events', 'Announcements', 'Stories'], defaultValue: 'All' },
    count: { type: 'number', defaultValue: 6, displayName: 'How many' },
    columns: { type: 'choice', options: ['1', '2', '3'], defaultValue: '3' },
  },
  importPath: '@/components/LiveNews',
});

PLASMIC.registerComponent(LiveEvents, {
  name: 'LiveEvents',
  displayName: 'Events list (live)',
  description: 'Upcoming events open to the public, from our database.',
  props: {
    count: { type: 'number', defaultValue: 10, displayName: 'How many' },
  },
  importPath: '@/components/LiveEvents',
});
