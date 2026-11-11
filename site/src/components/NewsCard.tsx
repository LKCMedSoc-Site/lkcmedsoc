import Link from 'next/link';
import type { Post } from '@/lib/posts';
import { postDate } from '@/lib/dates';
import SafeImage from '@/components/SafeImage';

export const CATEGORY_STYLE: Record<string, string> = {
  Impact: 'bg-pink text-p950', Events: 'bg-lilac text-p950', Announcements: 'bg-acid text-p950', Stories: 'bg-mist text-p900',
};
export function CategoryPill({ category, className = '' }: { category: string; className?: string }) {
  return <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${CATEGORY_STYLE[category] ?? 'bg-p300 text-p950'} ${className}`}>{category}</span>;
}

/** One story. "feature" is the big lead card; "wide" and "card" fill the grid. */
export default function NewsCard({ post, size = 'card', priority = false }: { post: Post; size?: 'feature' | 'wide' | 'card'; priority?: boolean }) {
  const href = `/gazette/${post.slug}`;
  if (size === 'feature') {
    return (
      <Link href={href} className="row-link zoom group grid items-center gap-6 no-underline md:grid-cols-12 md:gap-10">
        <div className="slab md:col-span-7 md:order-2">
          <div className="slant"><SafeImage src={post.cover} alt="" priority={priority} sizes="(min-width: 768px) 55vw, 100vw" className="aspect-[16/10] w-full" /></div>
        </div>
        <div className="md:col-span-5 md:order-1">
          <div className="flex flex-wrap items-center gap-3 text-sm text-mist"><CategoryPill category={post.category} /><span>{postDate(post.published_at)}</span></div>
          <h2 className="display mt-4 text-5xl leading-[.9] text-white md:text-7xl"><span className="row-title">{post.title}</span></h2>
          {post.summary ? <p className="mt-4 line-clamp-4 max-w-md text-lg text-mist">{post.summary}</p> : null}
          <p className="mt-4 text-sm text-p300">{post.bodyName}</p>
          <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-pink px-6 py-3 font-bold text-p950 transition-colors group-hover:bg-white">Read the story <span aria-hidden className="row-arrow">→</span></span>
        </div>
      </Link>
    );
  }
  const wide = size === 'wide';
  return (
    <Link href={href} className="zoom group relative block h-full overflow-hidden rounded-2xl bg-white no-underline shadow-[0_1px_0_rgba(77,10,73,.08),0_14px_28px_-18px_rgba(42,6,40,.5)] transition-transform duration-300 hover:-translate-y-0.5">
      <div className="relative">
        <SafeImage src={post.cover} alt="" sizes={wide ? '(min-width: 768px) 50vw, 100vw' : '(min-width: 768px) 33vw, 100vw'} className={`w-full ${wide ? 'aspect-[16/10]' : 'aspect-[4/3]'}`} />
        <CategoryPill category={post.category} className="absolute left-3 top-3" />
      </div>
      <div className="p-5">
        <p className="text-sm text-muted">{postDate(post.published_at)}{post.bodyName ? ` · ${post.bodyName}` : ''}</p>
        <h3 className={`mt-1.5 font-bold leading-snug text-p900 group-hover:underline ${wide ? 'text-2xl md:text-3xl' : 'text-xl'}`}>{post.title}</h3>
        {post.summary ? <p className={`mt-2 text-muted ${wide ? 'line-clamp-3' : 'line-clamp-2'} text-sm`}>{post.summary}</p> : null}
      </div>
    </Link>
  );
}
