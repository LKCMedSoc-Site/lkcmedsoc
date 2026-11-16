import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { renderMarkdown } from '@/lib/markdown';
import { policyDoc, policyChangelog, policyIndex, policyIsExco, tierLabel, statusText, longDate, type ChangeEntry } from '@/lib/policy';
import { sessionToken } from '@/lib/policy-auth';
import { plasmicData, PlasmicView } from '@/lib/plasmic-page';
import PrintButton from '@/components/policy/PrintButton';
import ZoomControl from '@/components/policy/ZoomControl';
import { PolicyEditProvider, ModeSwitch, ClauseView, DocProposals, AddProvision } from '@/components/policy/PolicyEdit';

export const revalidate = 60;
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ v?: string }> };
const ver = (v?: string) => (v && /^\d{1,4}$/.test(v) ? parseInt(v, 10) : null);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = await policyDoc((await params).slug).catch(() => null);
  return { title: d ? d.doc.title : 'Policy', description: d?.doc.summary || undefined };
}

// A policy document, laid out like one: a contents column, then a white sheet with numbered provisions.
export default async function PolicyDocPage({ params, searchParams }: Props) {
  const slug = (await params).slug, v = ver((await searchParams).v);
  const token = await sessionToken();
  // A page designed in Plasmic at /policy/[slug] replaces the coded one below. ExCo keep the coded page (with the editing controls) unless the design includes
  // the editing pieces ("Policy editing: wrap the document"), so a design that forgot them can never lock editors out. An older version (?v=) always uses the coded page.
  if (v === null) {
    const designed = await plasmicData(`/policy/${slug}`);
    if (designed && (JSON.stringify(designed).includes('PolicyEditRoot') || !(await policyIsExco(token)))) return <PlasmicView data={designed} />;
  }
  const view = await policyDoc(slug, v, token).catch(() => null);
  if (!view) notFound();
  const { doc, clauses, versions } = view;
  const full = await policyChangelog(slug).catch(() => [] as ChangeEntry[]);
  const log = full.slice(0, 5);
  const index = await policyIndex().catch(() => []);
  const at = index.findIndex((d) => d.slug === slug), prev = at > 0 ? index[at - 1] : null, next = at >= 0 && at < index.length - 1 ? index[at + 1] : null;
  // Source notes under each provision, as on Singapore Statutes Online: "[Adopted A-001, in force 13 November 2026]". Only changes up to the version being read.
  const upTo = full.filter((e) => e.version <= doc.shown_version).sort((a, b) => a.version - b.version);
  const noteFor = (ref: string) => upTo.flatMap((e) => {
    const no = `A-${String(e.number).padStart(3, '0')}`;
    if (e.kind === 'adopt') return [`Adopted ${no}, in force ${longDate(e.effective_on)}`];
    const c = e.changes.find((x) => x.ref === ref);
    return c ? [`${{ edit: 'Amended', add: 'Added', repeal: 'Repealed' }[c.action]} ${no}, in force ${longDate(e.effective_on)}`] : [];
  });
  const current = upTo.length ? upTo[upTo.length - 1] : null;
  const past = v !== null && v < doc.version;                 // reading an older version
  const draft = doc.status === 'draft';
  const pdf = `/policy/${slug}/latest.pdf${past ? `?v=${doc.shown_version}` : ''}`;

  return (
    <PolicyEditProvider slug={slug} draft={draft} past={past}>
    <div className="doc-canvas">
      <div className="doc-bar">
        <p><Link href="/policy">Policy</Link><span className="sep">/</span>{tierLabel(doc.tier)}</p>
        <p className="doc-tools">
          <ModeSwitch /><ZoomControl /><span className="sep">|</span>
          <a href={pdf}>{draft ? 'Download draft PDF' : past ? `Download version ${doc.shown_version} PDF` : 'Download latest PDF'}</a>
          <span className="sep">|</span><PrintButton />
        </p>
      </div>
      <div className="doc-wrap">
        <nav className="doc-aside" aria-label="Contents">
          <h2>Contents</h2>
          <ol>
            {clauses.map((c) => <li key={c.ref}><a href={`#${c.ref}`}><span className="ref">{c.ref}</span><span>{c.heading}</span></a></li>)}
          </ol>
        </nav>

        <details className="doc-toc-m">
          <summary>Contents</summary>
          <ol>
            {clauses.map((c) => <li key={c.ref}><a href={`#${c.ref}`}><span className="ref">{c.ref}</span><span>{c.heading}</span></a></li>)}
          </ol>
        </details>

        <article className="doc-sheet">
          <h1 className="doc-title">{doc.title}</h1>
          {doc.summary ? <p className="doc-lead">{doc.summary}</p> : null}
          <dl className="doc-meta">
            <dt>Status</dt><dd>{past ? `Version ${doc.shown_version} (superseded)` : statusText(doc)}{!draft && !past && doc.effective_on ? `, as at ${longDate(new Date(Date.now() + 8 * 36e5).toISOString().slice(0, 10))}` : ''}</dd>
            {current && !draft ? <><dt>Current through</dt><dd>A-{String(current.number).padStart(3, '0')}, in force {longDate(current.effective_on)}</dd></> : null}
            {!draft && doc.effective_on ? <><dt>In force from</dt><dd>{longDate(doc.effective_on)}</dd></> : null}
            <dt>Type</dt><dd>{tierLabel(doc.tier)}</dd>
            <dt>Changed by</dt><dd>{doc.owner}</dd>
          </dl>
          {draft ? <p className="doc-notice"><strong>Draft proposal.</strong> This has not been adopted, so it is not binding yet. The wording can still change.</p> : null}
          {past ? <p className="doc-notice">You are reading an older version. <Link className="underline" href={`/policy/${slug}`}>Go to the version in force (version {doc.version})</Link>.</p> : null}

          <DocProposals />

          {clauses.length ? clauses.map((c) => (
            <ClauseView key={c.ref} refId={c.ref} heading={c.heading} html={renderMarkdown(c.body_md)} notes={noteFor(c.ref)} />
          )) : <p className="mt-8 text-muted">This document has no provisions yet.</p>}
          <AddProvision />

          <h2 className="doc-h2">Versions</h2>
          {versions.length ? (
            <ul className="mt-3 space-y-1.5 text-[.95em]">
              {versions.map((x) => (
                <li key={x.version}><Link className="underline" href={x.version === doc.version ? `/policy/${slug}` : `/policy/${slug}?v=${x.version}`}>Version {x.version}</Link> <span className="text-muted">· from {longDate(x.effective_on)} · {x.title}</span></li>
              ))}
            </ul>
          ) : <p className="mt-3 text-[.95em] text-muted">No version has come into force yet.</p>}

          <h2 className="doc-h2">Recent changes</h2>
          {log.length ? (
            <ul className="mt-3 space-y-1.5 text-[.95em]">
              {log.map((e) => <li key={e.number}><span className="font-bold text-p950">A-{String(e.number).padStart(3, '0')}</span> {e.title} <span className="text-muted">· {longDate(e.effective_on)}</span></li>)}
            </ul>
          ) : <p className="mt-3 text-[.95em] text-muted">No changes recorded yet.</p>}
          <p className="mt-3 text-[.95em]"><Link className="underline" href="/policy/changelog">Full changelog</Link></p>

          <nav className="doc-pager" aria-label="Other documents">
            {prev ? <Link href={`/policy/${prev.slug}`}><small>Previous document</small>{prev.title}</Link> : <span />}
            {next ? <Link href={`/policy/${next.slug}`} style={{ textAlign: 'right' }}><small>Next document</small>{next.title}</Link> : <span />}
          </nav>
        </article>
      </div>
    </div>
    </PolicyEditProvider>
  );
}
