import Link from 'next/link';
import SafeImage from '@/components/SafeImage';

// A tall photo card with room for your own words on top of it. Put a heading and a line of text inside; they sit at the bottom of the photo.
export default function PhotoCardShell({ image = '', href = '', ratio = '3/4', children, className = '' }: { image?: string; href?: string; ratio?: string; children?: React.ReactNode; className?: string }) {
  const cls = `zoom press group relative block overflow-hidden rounded-lg bg-p900 no-underline ${className}`;
  const inner = (
    <>
      <SafeImage src={image} ratio={ratio} sizes="(min-width: 768px) 33vw, 100vw" className="w-full" />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-p950/95 via-p950/30 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-6 text-white md:p-7">{children}</div>
    </>
  );
  return href ? <Link href={href} className={cls}>{inner}</Link> : <div className={cls}>{inner}</div>;
}
