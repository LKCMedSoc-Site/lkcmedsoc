import type { Metadata } from 'next';
import SafeImage from '@/components/SafeImage';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { categoryBySlug, getCategories, getPost, getPostAy } from '@/lib/posts';
import { ayToSlug, exco } from '@/lib/ay';
import { renderMarkdown } from '@/lib/markdown';
import { postDate } from '@/lib/dates';
import Listing, { type ListingSP } from '@/components/gazette/Listing';

export const revalidate = 60;
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<ListingSP> };

// /gazette/impact (a category) and /gazette/<post-slug> (a post) share this one address pattern. A post slug always ends in a short id, so it can never equal a category name.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = (await params).slug, cat = categoryBySlug(await getCategories(), slug);
  if (cat) return { title: cat.name };
  const post = await getPost(slug).catch(() => null);
  return post ? { title: post.title, description: post.summary || undefined, openGraph: post.cover ? { images: [post.cover] } : undefined } : { title: 'Gazette' };
}

export default async function GazetteSlugPage({ params, searchParams }: Props) {
  const slug = (await params).slug, cat = categoryBySlug(await getCategories(), slug);
  if (cat) return <Listing sp={await searchParams} basePath={`/gazette/${slug}`} fixedCategory={cat.name} />;
  const post = await getPost(slug).catch(() => null);
  if (!post) notFound();
  const html = renderMarkdown(post.body);
  const ay = post.ay || (await getPostAy(post.slug));
  // Photos placed inside the text are not repeated as a cover or in the gallery underneath
  const inText = (url: string) => !!url && post.body.includes(url.split('/').pop() as string);
  const showCover = post.cover && !inText(post.cover);
  const galleryPhotos = post.photos.filter((p) => !inText(p.url));
  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <div className="text-sm font-medium uppercase tracking-wide text-p500">
        <Link href="/gazette" className="no-underline">Gazette</Link> · <Link href={`/gazette/${post.categorySlug || 'all'}`} className="no-underline">{post.category}</Link>{post.subcategory ? <> · <Link href={`/gazette/${post.categorySlug}/${post.subcategorySlug}`} className="no-underline">{post.subcategory}</Link></> : null} · {postDate(post.published_at)}
      </div>
      <h1 className="display mt-1 text-5xl">{post.title}</h1>
      {post.bodyName || post.author ? <p className="mt-2 text-muted">{[post.bodyName, post.author && `by ${post.author}`].filter(Boolean).join(' · ')}</p> : null}
      {showCover ? <SafeImage src={post.cover} alt="" ratio="16/9" sizes="(min-width: 768px) 768px, 100vw" className="mt-6 rounded-2xl" onMissing="hide" /> : null}
      <div className="prose-lkc mt-6" dangerouslySetInnerHTML={{ __html: html }} />
      {galleryPhotos.length ? (
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {galleryPhotos.map((p, i) => (
            <figure key={i}>
              <SafeImage src={p.url} alt={p.caption} ratio="1/1" sizes="(min-width: 640px) 256px, 50vw" className="zoom rounded-xl" onMissing="hide" />
              {p.caption ? <figcaption className="mt-1 text-xs text-muted">{p.caption}</figcaption> : null}
            </figure>
          ))}
        </div>
      ) : null}
      {post.tags.length ? <p className="mt-8 flex flex-wrap gap-2 text-sm">{post.tags.map((t) => <span key={t} className="rounded-full bg-mist px-3 py-1 font-bold text-p900">{t}</span>)}</p> : null}
      {post.event ? <p className="mt-8 text-sm">Event: <Link className="underline" href={`/events/${post.event.id}`}>{post.event.title}</Link></p> : null}
      {ay ? <p className="mt-4 text-sm">From the <Link className="underline" href={`/about/honour-roll/${ayToSlug(ay)}`}>{exco(ay)} ({ay})</Link></p> : null}
      <p className="mt-8"><Link className="underline" href="/gazette">← Back to the Gazette</Link></p>
    </article>
  );
}
