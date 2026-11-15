import { NextResponse } from 'next/server';
import { getHonour } from '@/lib/honour';

// The honour roll as JSON, for the Honour roll hub when a page is opened in Plasmic Studio or the server could not seed it. Public data.
export const revalidate = 300;

export async function GET(req: Request) {
  const term = new URL(req.url).searchParams.get('term') ?? '';
  try {
    return NextResponse.json(await getHonour(/^[a-z0-9-]{0,12}$/.test(term) ? term : ''), { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } });
  } catch {
    return NextResponse.json({ error: 'unavailable' }, { status: 502 });
  }
}
