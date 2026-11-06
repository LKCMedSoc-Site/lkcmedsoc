import Link from 'next/link';
import SafeImage from '@/components/SafeImage';

// A tall photo card with a title and a line of text on top. The whole card is the link.
export default function PhotoTile({ title = 'Title', text = '', image = '', href = '/', ratio = '3/4', className = '' }: { title?: string; text?: string; image?: string; href?: string; ratio?: string; className?: string }) {
  return (
    <Link href={href} className={`zoom press group relative block overflow-hidden rounded-lg bg-p900 no-underline ${className}`}>
      <SafeImage src={image} ratio={ratio} sizes="(min-width: 768px) 33vw, 100vw" className="w-full" />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-p900/95 via-p900/30 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-6 text-white md:p-7">
        <h3 className="display text-4xl text-white underline-offset-8 decoration-2 decoration-p300 group-hover:underline md:text-5xl">{title}</h3>
        {text ? <p className="mt-3 max-w-sm text-sm text-mist md:text-base">{text}</p> : null}
      </div>
    </Link>
  );
}
