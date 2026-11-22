import Link from 'next/link';
import type { NavItem } from '@/lib/nav';

// here: this link is the page (or app) you are on. It then opens in the same tab, since you are already in it.
export default function ChildLink({ c, className, children, here = false }: { c: NavItem; className: string; children: React.ReactNode; here?: boolean }) {
  const current = here ? 'page' : undefined;
  if (c.external && !here) return <a href={c.href} target="_blank" rel="noopener" className={className}>{children}</a>;
  return c.external ? <a href={c.href} aria-current={current} className={className}>{children}</a> : <Link href={c.href} aria-current={current} className={className}>{children}</Link>;
}
