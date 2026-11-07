import Link from 'next/link';
import type { NavItem } from '@/lib/nav';

export default function ChildLink({ c, className, children }: { c: NavItem; className: string; children: React.ReactNode }) {
  return c.external ? <a href={c.href} target="_blank" rel="noopener" className={className}>{children}</a> : <Link href={c.href} className={className}>{children}</Link>;
}
