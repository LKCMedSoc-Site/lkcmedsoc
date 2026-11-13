import { policyDoc } from '@/lib/policy';
import { policyPdf } from '@/lib/policy-pdf';

export const runtime = 'nodejs';
export const revalidate = 300;

// /policy/<document>/latest.pdf is the version in force (or the working draft, marked DRAFT, if it has never been adopted).
// /policy/<document>/latest.pdf?v=2 is version 2, exactly as it was, for "the text as at" questions.
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug;
  const v = new URL(req.url).searchParams.get('v');
  const view = await policyDoc(slug, v && /^\d{1,4}$/.test(v) ? parseInt(v, 10) : null).catch(() => null);
  if (!view) return new Response('Not found', { status: 404 });
  const pdf = await policyPdf(view);
  const name = `LKCMedSoc-${slug}${view.doc.status === 'draft' ? '-DRAFT' : `-v${view.doc.shown_version}`}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${name}"`, 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  });
}
