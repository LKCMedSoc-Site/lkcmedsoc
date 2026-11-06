import Link from 'next/link';
import type { Post } from '@/lib/posts';
import { postDate } from '@/lib/dates';

export default function PostCard({ post }: { post: Post }) {
  return (
    <Link href={`/news/${post.slug}`} className="group block overflow-hidden rounded-xl border border-line bg-white no-underline transition hover:border-p500">
      {post.cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.cover} alt="" loading="lazy" className="aspect-[16/9] w-full object-cover" />
      ) : (
        <div className="aspect-[16/9] w-full bg-p100" aria-hidden />
      )}
      <div className="p-4">
        <div className="text-xs font-medium uppercase tracking-wide text-p500">{post.category} · {postDate(post.published_at)}</div>
        {post.bodyName ? <div className="mt-0.5 text-xs text-muted">{post.bodyName}</div> : null}
        <h3 className="mt-1 text-lg font-bold leading-snug text-p900 group-hover:underline">{post.title}</h3>
        {post.summary ? <p className="mt-2 line-clamp-3 text-sm text-muted">{post.summary}</p> : null}
      </div>
    </Link>
  );
}
