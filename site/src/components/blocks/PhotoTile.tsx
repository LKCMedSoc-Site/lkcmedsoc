import Link from 'next/link';
import SafeImage from '@/components/SafeImage';

// A tall photo card with a title and a line of text on top. Links somewhere.
export default function PhotoTile({ title = 'Title', text = '', image = '', href = '/', ratio = '3/4', className = '' }: { title?: string; text?: string; image?: string; href?: string; ratio?: string; className?: string }) {
  return (
    <Link href={href} className={`zoom group relative block overflow-hidden rounded-3xl bg-p900 no-underline ${className}`}>
      <SafeImage src={image} ratio={ratio} sizes="(min-width: 768px) 33vw, 100vw" className="w-full" />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-p900/95 via-p900/30 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-6 text-white md:p-7">
        <h3 className="display text-4xl text-white md:text-5xl">{title}</h3>
        {text ? <p className="mt-2 max-w-sm text-sm text-p100 md:text-base">{text}</p> : null}
        <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold">Find out more <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span></span>
      </div>
    </Link>
  );
}
