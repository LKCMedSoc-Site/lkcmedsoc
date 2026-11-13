import type { Metadata } from 'next';
import Link from 'next/link';
import ZoomControl from '@/components/policy/ZoomControl';
import { TIERS, policyIndex, policySearch, statusText, type PolicyDoc, type Hit } from '@/lib/policy';

export const metadata: Metadata = { title: 'Policy', description: 'How LKCMedSoc is run: the Constitution, Bylaws and Guides, with the NTU and School rules that sit above them.' };
export const revalidate = 60;

// Quick ways in, by what someone wants to do. Each goes to one provision.
const GOALS: { label: string; href: string }[] = [
  { label: 'Run an event', href: '/policy/bylaws-events#B-11.2' },
  { label: 'Start or register a CCA', href: '/policy/bylaws-bodies#B-3.2' },
  { label: 'Raise or hold money', href: '/policy/bylaws-money#B-9.4' },
  { label: 'Take a place on a trip', href: '/policy/bylaws-people#B-6.2' },
  { label: 'Book or look after a space', href: '/policy/bylaws-spaces-records#B-8.1' },
  { label: 'See how roles are recorded', href: '/policy/bylaws-people#B-5.1' },
];

export default async function PolicyPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? '').trim();
  let docs: PolicyDoc[] = []; let hits: Hit[] = []; let failed = false;
  try { docs = await policyIndex(); } catch { failed = true; }
  if (q.length >= 2) { try { hits = await policySearch(q); } catch { /* the list below still shows */ } }
  const anyDraft = docs.some((d) => d.status === 'draft');

  return (
    <div className="doc-canvas">
      <div className="doc-bar"><p>Policy</p><p className="doc-tools"><ZoomControl /><span className="sep">|</span><Link href="/policy/changelog">Changelog</Link></p></div>
      <div className="doc-wrap single">
        <article className="doc-sheet wide">
          <h1 className="doc-title">LKCMedSoc policy</h1>
          <p className="doc-lead">How MedSoc is run, in one place. Every provision has a number you can quote, and every change is recorded in the changelog.</p>
          {anyDraft ? <p className="doc-notice"><strong>Draft proposal.</strong> Documents marked “Draft proposal” have not been adopted yet, so they are not binding. If an NTU or School rule conflicts with a MedSoc rule, the NTU or School rule applies.</p>
            : <p className="doc-notice">If an NTU or School rule conflicts with a MedSoc rule, the NTU or School rule applies.</p>}

          <form action="/policy" method="get" role="search" className="mt-6 flex gap-2">
            <input name="q" defaultValue={q} placeholder="Search the policy, or type a number like B-9.4" aria-label="Search the policy" className="min-w-0 flex-1 rounded border border-line bg-white px-3 py-2 outline-none focus:border-p950" />
            <button className="rounded bg-p950 px-4 py-2 text-sm font-bold text-white hover:opacity-90">Search</button>
          </form>

          {failed ? <p className="mt-6 rounded bg-red-100 px-3 py-2 text-bad">The policy could not be loaded right now. Please try again in a minute.</p> : null}

          {q.length >= 2 ? (
            <>
              <h2 className="doc-h2">{hits.length ? `${hits.length} result${hits.length === 1 ? '' : 's'} for “${q}”` : `Nothing found for “${q}”`}</h2>
              <ul className="doc-list">
                {hits.map((h) => (
                  <li key={h.ref}>
                    <Link href={`/policy/${h.doc_slug}#${h.ref}`}>
                      <span className="t"><span className="text-p950">{h.ref}</span>  {h.heading}</span>
                      <span className="st">{h.doc_title}</span>
                      <span className="s">{h.snippet.replace(/[|*#`-]+/g, ' ').replace(/\s+/g, ' ').slice(0, 150)}…</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <h2 className="doc-h2">I want to…</h2>
              <ul className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                {GOALS.map((g) => <li key={g.label}><Link href={g.href} className="underline">{g.label}</Link></li>)}
              </ul>
            </>
          )}

          {TIERS.map((t) => {
            const list = docs.filter((d) => d.tier === t.tier);
            return (
              <section key={t.tier}>
                <h2 className="doc-h2">{t.label}</h2>
                <p className="mt-2 text-[.95em] text-muted">{t.note}</p>
                {list.length ? (
                  <ul className="doc-list mt-2">
                    {list.map((d) => (
                      <li key={d.slug}>
                        <Link href={`/policy/${d.slug}`}>
                          <span className="t">{d.title}</span>
                          <span className="st">{statusText(d)}</span>
                          <span className="s">{d.summary}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : <p className="mt-3 text-[.95em] text-muted">{t.tier === 'external' ? 'None listed yet.' : t.tier === 'guide' ? 'No Guides published yet.' : 'Nothing published yet.'}</p>}
              </section>
            );
          })}
        </article>
      </div>
    </div>
  );
}
