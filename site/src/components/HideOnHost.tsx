'use client';
import { usePathname } from 'next/navigation';

// Hides what it wraps on certain paths.
// - Studio shows /plasmic-host as its canvas, so the site's own header and footer are hidden there (the default).
export default function HideOnHost({ children, prefixes = ['/plasmic-host'] }: { children: React.ReactNode; prefixes?: string[] }) {
  const path = usePathname() ?? '';
  return prefixes.some((p) => path.startsWith(p)) ? null : <>{children}</>;
}
