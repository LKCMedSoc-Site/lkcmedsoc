import Link from 'next/link';
import type { Post } from '@/lib/posts';
import { postDate } from '@/lib/dates';
import SafeImage from '@/components/SafeImage';

export default function PostCard({ post }: { post: Post }) {
  return (
    <Link href={`/news/${post.slug}`} className="zoom group block no-underline">
      <SafeImage src={post.cover} ratio="4/3" sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="rounded-md" />
      <div className="pt-4">
        <div className="text-sm"><span className="font-bold text-p500">{post.category}</span> <span className="ml-2 text-muted">{postDate(post.published_at)}</span></div>
        <h3 className="mt-1.5 text-xl font-bold leading-snug text-p900 group-hover:underline">{post.title}</h3>
        {post.bodyName ? <div className="mt-1 text-xs text-muted">{post.bodyName}</div> : null}
        {post.summary ? <p className="mt-2 line-clamp-3 text-sm text-muted">{post.summary}</p> : null}
      </div>
    </Link>
  );
}
