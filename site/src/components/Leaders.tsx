import type { Leader } from '@/lib/records';
import { sortLeaders } from '@/lib/records';

export default function Leaders({ list, className = '' }: { list: Leader[]; className?: string }) {
  if (!list.length) return null;
  return (
    <ul className={`space-y-0.5 text-sm ${className}`}>
      {sortLeaders(list).map((l, i) => (
        <li key={i}><span className="text-muted">{l.title}:</span> <span className="font-medium">{l.name}</span></li>
      ))}
    </ul>
  );
}
