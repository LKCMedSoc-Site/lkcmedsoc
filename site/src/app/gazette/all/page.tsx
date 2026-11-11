import type { Metadata } from 'next';
import Listing, { type ListingSP } from '@/components/gazette/Listing';

export const metadata: Metadata = { title: 'Gazette archive' };
export const revalidate = 60;

export default async function ArchivePage({ searchParams }: { searchParams: Promise<ListingSP> }) {
  return <Listing sp={await searchParams} basePath="/gazette/all" />;
}
