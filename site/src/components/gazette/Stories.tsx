import Link from 'next/link';
import type { Post } from '@/lib/posts';
import { CATEGORY_LABEL } from '@/lib/posts';
import { postDate } from '@/lib/dates';
import SafeImage from '@/components/SafeImage';
import { CategoryPill } from '@/components/NewsCard';

const href = (p: Post) => `/gazette/${p.slug}`;

/** The top story: a large picture with the headline and summary beneath it. */
export function LeadStory({ post }: { post: Post }) {
  return (
    <Link href={href(post)} className="zoom group block no-underline">
      <SafeImage src={post.cover} alt="" priority ratio="16/10" sizes="(min-width: 1024px) 760px, 100vw" className="rounded-xl" />
      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted"><CategoryPill category={post.category} /><span>{postDate(post.published_at)}</span>{post.bodyName ? <span>· {post.bodyName}</span> : null}</div>
      <h2 className="display mt-3 text-5xl leading-[.92] !text-p950 group-hover:!text-p500 md:text-7xl">{post.title}</h2>
      {post.summary ? <p className="mt-3 line-clamp-3 max-w-2xl text-lg text-muted">{post.summary}</p> : null}
    </Link>
  );
}

/** A headline with a small picture, for the right-hand column and compact lists. */
export function SideStory({ post, showCategory = true }: { post: Post; showCategory?: boolean }) {
  return (
    <Link href={href(post)} className="zoom group flex gap-4 py-4 no-underline first:pt-0">
      <div className="min-w-0 flex-1">
        <div className="text-xs font-bold uppercase tracking-wider text-p500">{showCategory ? CATEGORY_LABEL[post.category] ?? post.category : postDate(post.published_at)}{showCategory ? <span className="ml-2 font-medium normal-case tracking-normal text-muted">{postDate(post.published_at)}</span> : null}</div>
        <h3 className="mt-1 text-lg font-bold leading-snug text-p950 group-hover:underline">{post.title}</h3>
        {post.bodyName ? <div className="mt-1 text-xs text-muted">{post.bodyName}</div> : null}
      </div>
      <SafeImage src={post.cover} alt="" ratio="1/1" sizes="96px" className="h-24 w-24 shrink-0 rounded-lg" />
    </Link>
  );
}

/** A picture-over-headline card for a category row (no category tag: the section already says it). */
export function StoryCard({ post }: { post: Post }) {
  return (
    <Link href={href(post)} className="zoom group block no-underline">
      <SafeImage src={post.cover} alt="" ratio="4/3" sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw" className="rounded-lg" />
      <p className="mt-3 text-xs text-muted">{postDate(post.published_at)}{post.bodyName ? ` · ${post.bodyName}` : ''}</p>
      <h3 className="mt-1 text-lg font-bold leading-snug text-p950 group-hover:underline">{post.title}</h3>
      {post.summary ? <p className="mt-1.5 line-clamp-2 text-sm text-muted">{post.summary}</p> : null}
    </Link>
  );
}
