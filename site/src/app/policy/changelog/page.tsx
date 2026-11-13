import type { Metadata } from 'next';
import Link from 'next/link';
import ZoomControl from '@/components/policy/ZoomControl';
import { policyChangelog, tierLabel, longDate, type ChangeEntry } from '@/lib/policy';

export const metadata: Metadata = { title: 'Policy changelog', description: 'Every change to the Constitution, Bylaws and Guides, with who decided it and when.' };
export const revalidate = 60;

const verb = { edit: 'Changed', add: 'Added', repeal: 'Repealed' } as const;

function decision(e: ChangeEntry) {
  if (e.tier === 'constitution' && e.meeting_date) return `General Meeting, ${longDate(e.meeting_date)}: ${e.meeting_for} for, ${e.meeting_against} against${e.sao_confirmed ? '; confirmed by SAO' : ''}`;
  if (e.votes) return `ExCo vote: ${e.votes.for} for, ${e.votes.against} against${e.votes.abstain ? `, ${e.votes.abstain} abstained` : ''}${e.votes.recused ? `, ${e.votes.recused} stepped out` : ''}`;
  return 'Approved';
}

export default async function ChangelogPage() {
  let log: ChangeEntry[] = []; let failed = false;
  try { log = await policyChangelog(); } catch { failed = true; }
  return (
    <div className="doc-canvas">
      <div className="doc-bar"><p><Link href="/policy">Policy</Link><span className="sep">/</span>Changelog</p><p className="doc-tools"><ZoomControl /></p></div>
      <div className="doc-wrap single">
        <article className="doc-sheet wide">
          <h1 className="doc-title">Changelog</h1>
          <p className="doc-lead">Every change that has come into force, newest first: what changed, why, and how it was decided.</p>
          {failed ? <p className="doc-notice">The changelog could not be loaded right now. Please try again in a minute.</p> : null}
          {!failed && !log.length ? <p className="doc-notice">Nothing has come into force yet. Once a document is adopted, or a change to one is approved, it is listed here.</p> : null}
          {log.map((e) => (
            <section key={e.number} id={`A-${String(e.number).padStart(3, '0')}`} className="doc-clause">
              <a className="doc-ref" href={`#A-${String(e.number).padStart(3, '0')}`}>A-{String(e.number).padStart(3, '0')}</a>
              <div>
                <h2 className="doc-head">{e.title}</h2>
                <p className="text-[.9em] text-muted">{longDate(e.effective_on)} · {tierLabel(e.tier)} · <Link className="underline" href={`/policy/${e.doc_slug}?v=${e.version}`}>{e.doc_title}, version {e.version}</Link></p>
                {e.reason ? <p className="mt-2">{e.reason}</p> : null}
                {e.changes.length ? (
                  <ul className="mt-2 space-y-1 text-[.95em]">
                    {e.changes.map((c) => <li key={c.ref}><span className="font-bold">{verb[c.action]}</span> <Link className="underline" href={`/policy/${e.doc_slug}#${c.ref}`}>{c.ref}</Link>{c.new_heading || c.old_heading ? ` ${c.new_heading || c.old_heading}` : ''}</li>)}
                  </ul>
                ) : e.kind === 'adopt' ? <p className="mt-2 text-[.95em] text-muted">The whole document came into force.</p> : null}
                <p className="mt-2 text-[.9em] text-muted">{decision(e)}</p>
              </div>
            </section>
          ))}
        </article>
      </div>
    </div>
  );
}
