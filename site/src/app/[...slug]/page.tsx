import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPageRendered } from '@/lib/content';

type Props = { params: Promise<{ slug: string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await getPageRendered((await params).slug.join('/'));
  return { title: page?.title ?? 'Page' };
}

// Words for these pages live in /content/*.md (TinaCMS will edit those same files).
export default async function ContentPage({ params }: Props) {
  const page = await getPageRendered((await params).slug.join('/'));
  if (!page) notFound();
  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="display text-5xl">{page.title}</h1>
      <div className="prose-lkc mt-6" dangerouslySetInnerHTML={{ __html: page.html }} />
    </article>
  );
}
