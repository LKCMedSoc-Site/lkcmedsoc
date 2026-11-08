'use client';
import { PlasmicCanvasHost } from '@plasmicapp/loader-nextjs';
import '@/plasmic-init-client';

// Plasmic Studio opens this page inside its editor so it can show our real pieces. Not linked from the site.
export default function PlasmicHost() {
  // .plasmic-page is where the shared hover and press motion lives (see globals.css), so Studio's canvas and Preview show it too.
  return <div className="plasmic-page"><PlasmicCanvasHost /></div>;
}
