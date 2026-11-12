import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { categoryBySlug, getCategories } from '@/lib/posts';
import Listing, { type ListingSP } from '@/components/gazette/Listing';

export const revalidate = 60;
type Props = { params: Promise<{ slug: string; sub: string }>; searchParams: Promise<ListingSP> };

// /gazette/<category>/<sub-category>, for example /gazette/creative/humans-of-med
async function find(slug: string, sub: string) {
  const cat = categoryBySlug(await getCategories(), slug);
  const child = cat?.children?.find((k) => k.slug === sub);
  return cat && child ? { cat, child } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, sub } = await params, hit = await find(slug, sub);
  return hit ? { title: `${hit.child.name} · ${hit.cat.name}`, description: hit.child.blurb || undefined } : { title: 'Gazette' };
}

export default async function SubCategoryPage({ params, searchParams }: Props) {
  const { slug, sub } = await params, hit = await find(slug, sub);
  if (!hit) notFound();
  return <Listing sp={await searchParams} basePath={`/gazette/${slug}/${sub}`} fixedCategory={hit.cat.name} fixedSub={hit.child.name} />;
}
