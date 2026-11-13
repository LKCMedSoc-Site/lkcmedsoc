// Local stand-in for the policy_* database functions in sql/policy.sql (same names, same answers), for testing the site and the Policy app without the live database.
// The text comes from policy-seed.json (not in Git). Nothing here is saved: restart the mock to start again.
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';

const seed = JSON.parse(fs.readFileSync(new URL('./policy-seed.json', import.meta.url), 'utf8'));
const ME = '00000000-0000-4000-8000-000000000001';
const SEATS = 8, WITHIN = 7;
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

const docs = seed.docs.map((d, i) => ({ id: randomUUID(), summary: '', owner: 'ExCo', effective_on: null, source_url: null, last_checked: null, ...d, clauses: undefined }));
const clauses = []; // {id, doc_id, ref, ord, heading, body_md, repealed}
seed.docs.forEach((d, i) => d.clauses.forEach((c, k) => clauses.push({ id: randomUUID(), doc_id: docs[i].id, ref: c.ref, ord: (k + 1) * 10, heading: c.heading, body_md: c.body_md, repealed: false })));
const versions = []; // {clause_id, doc_version, heading, body_md, repealed, amendment_id}
const amendments = []; const changes = []; const votes = []; const comments = [];
let counter = 0;

// One demo proposal waiting for a vote, so the whole flow (vote, approve, publish, changelog, PDF) can be tried: four other "members" have voted for it already.
const money = docs.find((d) => d.slug === 'bylaws-money');
const demoId = randomUUID();
amendments.push({ id: demoId, number: ++counter, doc_id: money.id, kind: 'adopt', title: 'Adopt the Money bylaws', reason: 'Bring the money, fundraising and law bylaws into force so that spending rules have one agreed text.',
  status: 'proposed', proposed_by: 'x', proposed_by_name: 'Demo proposer', proposed_at: new Date(Date.now() - 2 * 864e5).toISOString(), decided_at: null, publish_by: null, published_at: null, effective_on: null, version_after: null, meeting_date: null, meeting_for: null, meeting_against: null, sao_confirmed: null });
for (let n = 1; n <= 4; n++) votes.push({ amendment_id: demoId, voter: 'demo-' + n, voter_name: 'Demo ExCo member ' + n, vote: 'for', comment: n === 1 ? 'Reads clearly. Fine to adopt.' : null, voted_at: new Date(Date.now() - n * 36e5).toISOString() });
comments.push({ amendment_id: demoId, name: 'Demo ExCo member 2', body: 'Please fill in the approval limits (S$X and S$Y) soon after adoption.', at: new Date(Date.now() - 5 * 36e5).toISOString() });

const docOf = (id) => docs.find((d) => d.id === id);
const need = (tier) => (tier === 'bylaw' ? Math.floor(SEATS / 2) + 1 : tier === 'guide' ? 1 : null);
const fail = (m) => { throw new Error(m); };
const liveClauses = (d, v) => {
  const mine = clauses.filter((c) => c.doc_id === d.id).sort((a, b) => a.ord - b.ord);
  if (v === 0) return mine.filter((c) => !c.repealed).map((c) => ({ ref: c.ref, heading: c.heading, body_md: c.body_md }));
  return mine.flatMap((c) => {
    const cv = versions.filter((x) => x.clause_id === c.id && x.doc_version <= v).sort((a, b) => b.doc_version - a.doc_version)[0];
    return cv && !cv.repealed ? [{ ref: c.ref, heading: cv.heading, body_md: cv.body_md }] : [];
  });
};
const tierOrd = { constitution: 1, bylaw: 2, guide: 3, external: 4 };
const tally = (id) => { const v = votes.filter((x) => x.amendment_id === id); const c = (k) => v.filter((x) => x.vote === k).length; return { for: c('for'), against: c('against'), abstain: c('abstain'), recused: c('recused') }; };

export const policyRpc = {
  is_exco: () => true,
  is_approver: () => false,
  whoami: () => ({ name: 'Demo ExCo (you)', email: 'demo@e.ntu.edu.sg' }),

  policy_index: () => docs.filter((d) => d.published).map((d) => ({ slug: d.slug, title: d.title, tier: d.tier, summary: d.summary, owner: d.owner, status: d.status, version: d.version, effective_on: d.effective_on, source_url: d.source_url, last_checked: d.last_checked, ord: d.ord, tier_ord: tierOrd[d.tier], clauses: clauses.filter((c) => c.doc_id === d.id && !c.repealed).length }))
    .sort((a, b) => a.tier_ord - b.tier_ord || a.ord - b.ord),

  policy_doc: ({ p_slug, p_version = null }) => {
    const d = docs.find((x) => x.slug === p_slug); if (!d) return null;
    const v = p_version ?? d.version; if (v > d.version) return null;
    return { doc: { slug: d.slug, title: d.title, tier: d.tier, summary: d.summary, owner: d.owner, status: d.status, version: d.version, shown_version: v, effective_on: d.effective_on, source_url: d.source_url, last_checked: d.last_checked },
      clauses: liveClauses(d, v),
      versions: amendments.filter((a) => a.doc_id === d.id && a.status === 'in_force').map((a) => ({ version: a.version_after, effective_on: a.effective_on, title: a.title, number: a.number })).sort((a, b) => b.version - a.version) };
  },

  policy_changelog: ({ p_slug = null } = {}) => amendments.filter((a) => a.status === 'in_force' && (!p_slug || docOf(a.doc_id).slug === p_slug)).map((a) => {
    const d = docOf(a.doc_id);
    return { number: a.number, title: a.title, reason: a.reason, kind: a.kind, effective_on: a.effective_on, decided_at: a.decided_at, version: a.version_after, meeting_date: a.meeting_date, meeting_for: a.meeting_for, meeting_against: a.meeting_against, sao_confirmed: a.sao_confirmed,
      doc_slug: d.slug, doc_title: d.title, tier: d.tier, votes: tally(a.id),
      changes: changes.filter((c) => c.amendment_id === a.id).map((c) => ({ ref: c.ref, action: c.action, old_heading: c.old_heading, old_body_md: c.old_body_md, new_heading: c.new_heading, new_body_md: c.new_body_md })) };
  }).sort((a, b) => String(b.effective_on).localeCompare(String(a.effective_on)) || b.number - a.number),

  policy_search: ({ p_q }) => {
    const q = String(p_q || '').trim().toLowerCase(); if (q.length < 2) return [];
    return clauses.filter((c) => docOf(c.doc_id).published && !c.repealed && (c.heading.toLowerCase().includes(q) || c.body_md.toLowerCase().includes(q) || c.ref.toLowerCase() === q)).slice(0, 30)
      .map((c) => ({ doc_slug: docOf(c.doc_id).slug, doc_title: docOf(c.doc_id).title, ref: c.ref, heading: c.heading, snippet: c.body_md.slice(0, 220) }));
  },

  policy_all: () => docs.map((d) => ({ ...d, clauses: clauses.filter((c) => c.doc_id === d.id && !c.repealed).length, open_amendments: amendments.filter((a) => a.doc_id === d.id && ['proposed', 'approved'].includes(a.status)).length })).sort((a, b) => a.ord - b.ord),

  policy_working: ({ p_slug }) => { const d = docs.find((x) => x.slug === p_slug); return d ? { doc: d, clauses: clauses.filter((c) => c.doc_id === d.id).sort((a, b) => a.ord - b.ord) } : null; },

  policy_amendments: ({ p_status = null } = {}) => amendments.filter((a) => !p_status || a.status === p_status).map((a) => {
    const d = docOf(a.doc_id); const t = tally(a.id);
    return { id: a.id, number: a.number, title: a.title, kind: a.kind, status: a.status, proposed_by_name: a.proposed_by_name, proposed_at: a.proposed_at, decided_at: a.decided_at, publish_by: a.publish_by, effective_on: a.effective_on, doc_slug: d.slug, doc_title: d.title, tier: d.tier, changes: changes.filter((c) => c.amendment_id === a.id).length, votes_for: t.for, votes_against: t.against };
  }).sort((a, b) => b.proposed_at.localeCompare(a.proposed_at)),

  policy_amendment: ({ p_id }) => {
    const a = amendments.find((x) => x.id === p_id); if (!a) return null; const d = docOf(a.doc_id);
    return { amendment: a, doc: { slug: d.slug, title: d.title, tier: d.tier, owner: d.owner, status: d.status, version: d.version },
      changes: changes.filter((c) => c.amendment_id === a.id), votes: votes.filter((v) => v.amendment_id === a.id).map((v) => ({ voter: v.voter, name: v.voter_name, vote: v.vote, comment: v.comment, at: v.voted_at })),
      comments: comments.filter((c) => c.amendment_id === a.id), me: ME, seats: SEATS, needed: need(d.tier) };
  },

  policy_draft_save: ({ p_clause, p_heading, p_body }) => { const c = clauses.find((x) => x.id === p_clause) ?? fail('Clause not found'); if (docOf(c.doc_id).status !== 'draft') fail('This document is in force: propose an amendment instead'); c.heading = p_heading.trim(); c.body_md = p_body; return null; },
  policy_draft_add: ({ p_doc, p_ref, p_heading, p_body }) => { const d = docOf(p_doc) ?? fail('Document not found'); if (d.status !== 'draft') fail('This document is in force: propose an amendment instead'); const id = randomUUID(); clauses.push({ id, doc_id: p_doc, ref: p_ref.toUpperCase().trim(), ord: Math.max(0, ...clauses.filter((c) => c.doc_id === p_doc).map((c) => c.ord)) + 10, heading: p_heading.trim(), body_md: p_body, repealed: false }); return id; },
  policy_set_published: ({ p_slug, p_on }) => { const d = docs.find((x) => x.slug === p_slug); if (d) d.published = !!p_on; return null; },

  policy_propose: ({ p_doc, p_kind, p_title, p_reason, p_changes, p_name }) => {
    const d = docOf(p_doc) ?? fail('Document not found');
    if (d.tier === 'external') fail('NTU and School rules are not amended here');
    if (p_kind === 'adopt' && d.status !== 'draft') fail('This document is already in force');
    if (p_kind === 'change' && d.status !== 'in_force') fail('A draft is edited directly; propose its adoption instead');
    if (p_kind === 'change' && !(p_changes || []).length) fail('Name at least one clause to change');
    if (String(p_reason || '').trim().length < 5) fail('Say why the change is needed');
    const id = randomUUID();
    amendments.push({ id, number: ++counter, doc_id: p_doc, kind: p_kind, title: p_title.trim(), reason: p_reason.trim(), status: 'proposed', proposed_by: ME, proposed_by_name: p_name || 'Demo ExCo (you)', proposed_at: new Date().toISOString(), decided_at: null, publish_by: null, published_at: null, effective_on: null, version_after: null, meeting_date: null, meeting_for: null, meeting_against: null, sao_confirmed: null });
    let n = 0;
    for (const ch of p_changes || []) {
      n += 10; const c = clauses.find((x) => x.doc_id === p_doc && x.ref === ch.ref);
      if (ch.action === 'add') { if (c) fail(`Clause ${ch.ref} already exists`); changes.push({ id: randomUUID(), amendment_id: id, clause_id: null, ref: String(ch.ref).toUpperCase(), action: 'add', old_heading: null, old_body_md: null, new_heading: ch.heading, new_body_md: ch.body_md, ord: n }); }
      else { if (!c) fail(`Clause ${ch.ref} not found`); changes.push({ id: randomUUID(), amendment_id: id, clause_id: c.id, ref: c.ref, action: ch.action, old_heading: c.heading, old_body_md: c.body_md, new_heading: ch.action === 'edit' ? ch.heading : null, new_body_md: ch.action === 'edit' ? ch.body_md : null, ord: n }); }
    }
    return id;
  },

  policy_vote: ({ p_id, p_vote, p_comment, p_name }) => {
    const a = amendments.find((x) => x.id === p_id) ?? fail('Amendment not found'); if (a.status !== 'proposed') fail('Voting is closed on this amendment');
    if (docOf(a.doc_id).tier === 'constitution') fail('A Constitution change is decided at a General Meeting: record the result instead');
    const cur = votes.find((v) => v.amendment_id === p_id && v.voter === ME); const row = { amendment_id: p_id, voter: ME, voter_name: p_name || 'Demo ExCo (you)', vote: p_vote, comment: p_comment || null, voted_at: new Date().toISOString() };
    if (cur) Object.assign(cur, row); else votes.push(row); return null;
  },
  policy_comment: ({ p_id, p_body, p_name }) => { comments.push({ amendment_id: p_id, name: p_name || 'Demo ExCo (you)', body: p_body, at: new Date().toISOString() }); return null; },

  policy_close_vote: ({ p_id }) => {
    const a = amendments.find((x) => x.id === p_id); if (!a || a.status !== 'proposed') fail('Nothing to decide');
    const n = need(docOf(a.doc_id).tier); if (n === null) fail('A Constitution change is decided at a General Meeting: record the result instead');
    const t = tally(p_id); const wait = SEATS - votes.filter((v) => v.amendment_id === p_id && v.vote !== 'recused').length;
    if (t.for >= n) { Object.assign(a, { status: 'approved', decided_at: new Date().toISOString(), publish_by: addDays(WITHIN) }); return 'approved'; }
    if (t.for + Math.max(wait, 0) < n) { Object.assign(a, { status: 'rejected', decided_at: new Date().toISOString() }); return 'rejected'; }
    fail(`Not decided yet: ${t.for} for, ${t.against} against, ${n} needed`);
  },
  policy_record_meeting: ({ p_id, p_date, p_for, p_against, p_sao }) => {
    const a = amendments.find((x) => x.id === p_id); if (!a || a.status !== 'proposed') fail('Nothing to decide');
    const ok = p_for > 0 && p_for * 3 >= (p_for + p_against) * 2 && !!p_sao;
    Object.assign(a, { meeting_date: p_date, meeting_for: p_for, meeting_against: p_against, sao_confirmed: !!p_sao, status: ok ? 'approved' : 'rejected', decided_at: new Date().toISOString() }); return ok ? 'approved' : 'rejected';
  },
  policy_withdraw: ({ p_id }) => { const a = amendments.find((x) => x.id === p_id); if (a && a.status === 'proposed') Object.assign(a, { status: 'withdrawn', decided_at: new Date().toISOString() }); return null; },

  policy_publish: ({ p_id, p_effective }) => {
    const a = amendments.find((x) => x.id === p_id); if (!a || a.status !== 'approved') fail('Only an approved amendment can be published');
    const d = docOf(a.doc_id); const v = d.version + 1;
    for (const ch of changes.filter((c) => c.amendment_id === p_id)) {
      if (ch.action === 'add') clauses.push({ id: randomUUID(), doc_id: d.id, ref: ch.ref, ord: Math.max(0, ...clauses.filter((c) => c.doc_id === d.id).map((c) => c.ord)) + 10, heading: ch.new_heading, body_md: ch.new_body_md, repealed: false });
      else { const c = clauses.find((x) => x.id === ch.clause_id); if (ch.action === 'edit') { c.heading = ch.new_heading; c.body_md = ch.new_body_md; } else c.repealed = true; }
    }
    clauses.filter((c) => c.doc_id === d.id).forEach((c) => versions.push({ clause_id: c.id, doc_version: v, heading: c.heading, body_md: c.body_md, repealed: c.repealed, amendment_id: p_id }));
    Object.assign(d, { status: 'in_force', version: v, effective_on: p_effective || today() });
    Object.assign(a, { status: 'in_force', published_at: new Date().toISOString(), effective_on: p_effective || today(), version_after: v }); return v;
  },
};
