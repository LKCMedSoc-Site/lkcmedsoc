'use client';
import { PlasmicCanvasHost } from '@plasmicapp/loader-nextjs';
import '@/plasmic-init-client';

// Plasmic Studio opens this page inside its editor so it can show our real pieces. Not linked from the site.
export default function PlasmicHost() {
  return <PlasmicCanvasHost />;
}
