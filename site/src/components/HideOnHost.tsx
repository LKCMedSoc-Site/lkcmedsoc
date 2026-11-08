'use client';
import { usePathname } from 'next/navigation';

// Studio shows /plasmic-host as its canvas. Hide the site's own header and footer there so the canvas is just the piece being designed.
export default function HideOnHost({ children }: { children: React.ReactNode }) {
  return usePathname()?.startsWith('/plasmic-host') ? null : <>{children}</>;
}
