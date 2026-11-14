import { NextResponse } from 'next/server';
import menu from '../../../../public/menu.json';

// The site menu as JSON, for the apps' top bar (records, activities, feedback, inventory, booking).
// It is the same menu as public/menu.json. Menus edited inside the Plasmic header block are not part of this.
export const dynamic = 'force-dynamic'; // the CORS answer depends on who asks; the CDN cache below does the real caching

const ALLOWED = ['activities', 'feedback', 'records', 'inventory', 'booking'].map((s) => `https://${s}.lkcmedsoc.com`).concat('https://lkcmedsoc.com');
const allowOrigin = (origin: string | null) => {
  if (!origin) return null;
  if (ALLOWED.includes(origin)) return origin;
  if (process.env.NODE_ENV !== 'production' && /^http:\/\/localhost:\d+$/.test(origin)) return origin; // development only
  return null;
};
const headers = (origin: string | null) => {
  const h: Record<string, string> = { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300', Vary: 'Origin' };
  const ok = allowOrigin(origin);
  if (ok) { h['Access-Control-Allow-Origin'] = ok; h['Access-Control-Allow-Methods'] = 'GET, OPTIONS'; }
  return h;
};

export async function GET(req: Request) {
  const h = headers(req.headers.get('origin'));
  try {
    return NextResponse.json({ ...menu, source: 'live' }, { headers: h });
  } catch {
    return NextResponse.json({ ...menu, source: 'fallback' }, { headers: h });
  }
}

export function OPTIONS(req: Request) {
  const h = headers(req.headers.get('origin'));
  h['Access-Control-Max-Age'] = '86400';
  return new NextResponse(null, { status: 204, headers: h });
}
