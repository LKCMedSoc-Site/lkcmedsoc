'use client';
import { usePathname } from 'next/navigation';

// Hides what it wraps on certain paths.
// - Studio shows /plasmic-host as its canvas, so the site's own header and footer are hidden there (the default).
// - On /trial pages (designed in Plasmic) the coded fallback header and footer are hidden too, so a header and footer built in Studio are the only ones.
export default function HideOnHost({ children, prefixes = ['/plasmic-host'] }: { children: React.ReactNode; prefixes?: string[] }) {
  const path = usePathname() ?? '';
  return prefixes.some((p) => path.startsWith(p)) ? null : <>{children}</>;
}
