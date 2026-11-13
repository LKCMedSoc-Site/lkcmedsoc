import { TIERS, statusText, longDate, tierLabel, type ChangeEntry, type DocView, type Hit, type PolicyDoc } from './policy';

// The data the two policy hubs give Plasmic ($ctx.policyHub and $ctx.policyDoc). Built here, once, so the server pre-load and the browser agree.
// See plasmic-kit/DATA-CHEATSHEET.md for the field lists.
const aNo = (n: number) => `A-${String(n).padStart(3, '0')}`;

export function docItem(d: PolicyDoc) {
  return {
    slug: d.slug, title: d.title, summary: d.summary, hasSummary: !!d.summary, tier: d.tier, tierLabel: tierLabel(d.tier), owner: d.owner,
    isDraft: d.status === 'draft', isInForce: d.status === 'in_force', statusText: statusText(d), version: d.version,
    effectiveText: d.effective_on ? longDate(d.effective_on) : '', provisionCount: d.clauses, provisionsText: `${d.clauses} provision${d.clauses === 1 ? '' : 's'}`,
    link: `/policy/${d.slug}`,
  };
}

/** $ctx.policyHub: the documents grouped by tier, and the search results. */
export function buildIndexHub(docs: PolicyDoc[] | null, failed: boolean, query: string, hits: Hit[]) {
  const items = (docs ?? []).map(docItem);
  const tiers = TIERS.map((t) => {
    const list = items.filter((d) => d.tier === t.tier);
    return { key: t.tier, label: t.label, note: t.note, items: list, count: list.length, hasItems: list.length > 0 };
  });
  const results = hits.map((h) => ({ ref: h.ref, heading: h.heading, snippet: h.snippet.replace(/[|*#`-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160), docTitle: h.doc_title, docSlug: h.doc_slug, link: `/policy/${h.doc_slug}#${h.ref}` }));
  const q = query.trim();
  return {
    isLoading: !docs && !failed, hasError: failed, items, tiers, totalCount: items.length, anyDraft: items.some((d) => d.isDraft),
    activeSearch: query, isSearching: q.length >= 2, results, hasResults: results.length > 0,
    resultsText: q.length < 2 ? '' : results.length ? `${results.length} result${results.length === 1 ? '' : 's'} for “${q}”` : `Nothing found for “${q}”`,
    changelogLink: '/policy/changelog',
  };
}

export type DocBundle = { slug: string; view: DocView | null; log: ChangeEntry[]; index: PolicyDoc[] };

/** $ctx.policyDoc: one document. `render` turns a provision's text (Markdown) into safe HTML. */
export function buildDocHub(b: DocBundle | null, failed: boolean, render: (md: string) => string) {
  const view = b?.view ?? null;
  if (!view) return { isLoading: !b && !failed, notFound: !!b && !b.view, hasError: failed, provisions: [], versions: [], recentChanges: [], provisionCount: 0, hasVersions: false, hasChanges: false, hasPrev: false, hasNext: false, prev: null, next: null };
  const { doc, clauses, versions } = view; const log = b!.log, slug = doc.slug;
  const draft = doc.status === 'draft', old = doc.shown_version < doc.version && doc.shown_version > 0;
  const upTo = log.filter((e) => e.version <= doc.shown_version).sort((a, b2) => a.version - b2.version);
  const noteFor = (ref: string) => upTo.flatMap((e) => {
    if (e.kind === 'adopt') return [`Adopted ${aNo(e.number)}, in force ${longDate(e.effective_on)}`];
    const c = e.changes.find((x) => x.ref === ref);
    return c ? [`${{ edit: 'Amended', add: 'Added', repeal: 'Repealed' }[c.action]} ${aNo(e.number)}, in force ${longDate(e.effective_on)}`] : [];
  });
  const cur = upTo[upTo.length - 1];
  const at = b!.index.findIndex((d) => d.slug === slug);
  const side = (d?: PolicyDoc) => (d ? { title: d.title, link: `/policy/${d.slug}`, slug: d.slug } : null);
  const prev = side(at > 0 ? b!.index[at - 1] : undefined), next = side(at >= 0 ? b!.index[at + 1] : undefined);
  return {
    isLoading: false, notFound: false, hasError: false,
    title: doc.title, summary: doc.summary, hasSummary: !!doc.summary, tier: doc.tier, tierLabel: tierLabel(doc.tier), owner: doc.owner, slug,
    isDraft: draft, isInForce: !draft, isOldVersion: old,
    statusText: old ? `Version ${doc.shown_version} (superseded)` : statusText(doc), version: doc.version, shownVersion: doc.shown_version,
    effectiveText: !draft && doc.effective_on ? longDate(doc.effective_on) : '', hasEffective: !draft && !!doc.effective_on,
    currentThrough: cur ? `${aNo(cur.number)}, in force ${longDate(cur.effective_on)}` : '', hasCurrentThrough: !!cur && !draft,
    link: `/policy/${slug}`, pdfLink: `/policy/${slug}/latest.pdf${old ? `?v=${doc.shown_version}` : ''}`,
    pdfLabel: draft ? 'Download draft PDF' : old ? `Download version ${doc.shown_version} PDF` : 'Download latest PDF',
    provisions: clauses.map((c) => { const notes = noteFor(c.ref); return { ref: c.ref, heading: c.heading, html: render(c.body_md), notes, hasNotes: notes.length > 0, link: `#${c.ref}` }; }),
    provisionCount: clauses.length,
    versions: versions.map((x) => ({ version: x.version, dateText: longDate(x.effective_on), title: x.title, link: x.version === doc.version ? `/policy/${slug}` : `/policy/${slug}?v=${x.version}`, isCurrent: x.version === doc.version })),
    hasVersions: versions.length > 0,
    recentChanges: log.slice(0, 5).map((e) => ({ number: aNo(e.number), title: e.title, dateText: longDate(e.effective_on), link: `/policy/changelog#${aNo(e.number)}` })), hasChanges: log.length > 0,
    prev, next, hasPrev: !!prev, hasNext: !!next, changelogLink: '/policy/changelog',
  };
}
