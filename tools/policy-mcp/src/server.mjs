import fs from 'node:fs';
import path from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { HOME } from './session.mjs';
import { createStore } from './store.mjs';
import { numbered, outline, plain } from './render.mjs';
import { loadStructure } from './structure.mjs';

const WRITER = 'Claude';   // what the page shows as "last saved by"

const INSTRUCTIONS = `You are connected to the LKCMedSoc Policy: the Constitution, Bylaws, Guides and school rules of the medical students' society.
You act as the signed-in ExCo member. You can read every document (drafts too), search across all of them, comment on passages and edit the WORKING copy of a document.
You can never publish: the President publishes, in the Policy page. Members only see published text.

How the documents are written (the editor enforces this, so write it this way):
- A document is markdown. An article is a line "## Title". Under it, every provision is a numbered clause: a line "1. text" at the left edge (the editor numbers them 1.1, 1.2... itself; always write "1." and never type numbers into the text).
- A clause is its first line (often a bold title like "**Committee or CCA?**"), then lead-in text and tables indented 4 spaces, then numbered sub-items, indented 4 spaces and written "1. text" (shown as (a), (b)...), and nested once more for (i), (ii)...
- Nothing unnumbered may come after the first sub-item of a clause. A paragraph or table written there becomes a new clause of its own (a table's clause starts with the placeholder line "Add a line here to introduce this table."), never another item in the list. If it really is one more item of the list, write it as a sub-item.
- Cite rules by number from the numbered view, e.g. "Bodies 3.2(a)" (document, clause, sub-item). In the text, write rules in plain, short sentences; avoid unnumbered bullet lists (use sub-items).
- No bold, italic or links in article titles.

Always read a document (read_document) before editing it; edits are checked against the revision you read, so a clash with someone else's edit is refused instead of overwritten. Prefer edit_document (small, exact replacements) over write_document (replace everything).
Before drafting or changing a rule, search the other documents (search, or read_all_documents) for rules it touches, and say which ones.
Every write first keeps a copy of the previous text; list_backups and restore_backup undo it.`;

function line(s, n = 140) { s = String(s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

function diffSummary(oldMd, newMd) {
  const count = (arr) => arr.reduce((m, l) => m.set(l, (m.get(l) || 0) + 1), new Map());
  const a = String(oldMd).split('\n'), b = String(newMd).split('\n'), ca = count(a), cb = count(b);
  const removed = [], added = [];
  for (const l of a) { if (!l.trim()) continue; const n = cb.get(l) || 0; if (n > 0) cb.set(l, n - 1); else removed.push(l); }
  for (const l of b) { if (!l.trim()) continue; const n = ca.get(l) || 0; if (n > 0) ca.set(l, n - 1); else added.push(l); }
  const show = (arr, mark) => arr.slice(0, 12).map((l) => `  ${mark} ${line(l)}`).join('\n') + (arr.length > 12 ? `\n  … and ${arr.length - 12} more` : '');
  return `${removed.length} line(s) removed, ${added.length} line(s) added.` + (removed.length ? '\nRemoved:\n' + show(removed, '-') : '') + (added.length ? '\nAdded:\n' + show(added, '+') : '');
}

function keepLocalCopy(slug, rev, md) {
  try {
    const dir = path.join(HOME, 'backups'); fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    fs.writeFileSync(path.join(dir, `${slug}-rev${rev}-${new Date().toISOString().replace(/[:.]/g, '-')}.md`), md, { mode: 0o600 });
  } catch { /* the server-side copy still exists */ }
}

export async function buildServer(store) {
  store = store || await createStore();
  const server = new McpServer({ name: 'lkcmedsoc-policy', version: '0.1.0' }, { instructions: INSTRUCTIONS });
  const text = (t) => ({ content: [{ type: 'text', text: t }] });
  const fail = (e) => ({ isError: true, content: [{ type: 'text', text: String(e && e.message ? e.message : e) }] });
  const safe = (fn) => async (args) => { try { return await fn(args || {}); } catch (e) { return fail(e); } };
  const tool = (name, description, shape, fn) => server.registerTool(name, { description, inputSchema: shape }, safe(fn));

  const work = (slug) => store.rpc('policy_work', { p_slug: slug });
  async function allDocs() {
    const list = await store.rpc('policy_all');
    return Promise.all(list.map(async (d) => { const w = await work(d.slug); return { ...d, md: w.working_md || '', rev: w.rev, by: w.by, unpublished: (w.working_md || '').trim() !== (w.published_md || '').trim() }; }));
  }
  const header = (d) => `${d.doc ? d.doc.slug : d.slug} — ${d.doc ? d.doc.title : d.title} (${d.doc ? d.doc.tier : d.tier}, ${d.doc ? d.doc.status : d.status}) · working revision ${d.rev}${d.by ? ' · last saved by ' + d.by : ''}`;

  tool('list_documents', 'List every policy document: slug, title, type, whether it is published, how many articles and clauses it has (counted from the text), its working revision and whether it has unpublished changes.', {}, async () => {
    const docs = await allDocs();
    return text(docs.map((d) => {
      const rows = outline(d.md), articles = rows.filter((r) => r.kind === 'article').length, clauses = rows.filter((r) => r.kind === 'item' && r.depth === 0).length;
      return `${d.slug} — ${d.title} [${d.tier}] ${d.status === 'in_force' ? `in force, version ${d.version}` : 'draft (ExCo only)'} · ${articles} article(s), ${clauses} clause(s) · working revision ${d.rev}${d.unpublished && d.status === 'in_force' ? ' · unpublished changes' : ''}`;
    }).join('\n') || 'No documents.');
  });

  tool('read_document', 'Read one document: the numbered view (to cite rules by number) and the markdown (to edit). Reads the working copy, which is what ExCo see; pass version to read a published version instead.', {
    slug: z.string().describe('The document slug, e.g. "bylaws-bodies" (see list_documents)'),
    version: z.number().int().optional().describe('Read this published version instead of the working copy'),
    view: z.enum(['both', 'numbered', 'markdown']).optional().describe('Default both')
  }, async ({ slug, version, view }) => {
    let md, head;
    if (version) { const t = await store.rpc('policy_text', { p_slug: slug, p_version: version }); if (!t) throw new Error('No such published version'); md = t.body_md; head = `${t.doc.slug} — ${t.doc.title} · published version ${version} (read only)`; }
    else { const w = await work(slug); md = w.working_md || ''; head = header(w) + ((w.working_md || '').trim() !== (w.published_md || '').trim() ? ' · has unpublished changes' : ''); }
    const v = view || 'both', out = [head];
    if (v !== 'markdown') out.push('\nNUMBERED VIEW (cite by these numbers; do not type them into the text):\n' + numbered(md));
    if (v !== 'numbered') out.push('\nMARKDOWN (exact text; edit_document finds text in this):\n```markdown\n' + md + '\n```');
    return text(out.join('\n'));
  });

  tool('read_all_documents', 'Read every document at once (numbered view, working copies) so a new rule can be checked against all the others.', {}, async () => {
    const docs = await allDocs();
    return text(docs.map((d) => `=== ${header(d)}${d.unpublished ? ' · unpublished changes' : ''} ===\n${numbered(d.md)}`).join('\n\n'));
  });

  tool('search', 'Find where a word or phrase is used across all documents (working copies). Every word must appear in the same line. Returns the number of each match.', {
    query: z.string().describe('Words to look for, e.g. "tie President"'),
    limit: z.number().int().min(1).max(100).optional()
  }, async ({ query, limit }) => {
    const words = String(query).toLowerCase().split(/\s+/).filter(Boolean); if (!words.length) throw new Error('Give at least one word.');
    const hits = [];
    for (const d of await allDocs()) for (const r of outline(d.md)) { const t = plain(r.text || r.raw).toLowerCase(); if (words.every((w) => t.includes(w))) hits.push(`${d.slug} ${r.kind === 'article' ? 'Article ' + r.ref : r.ref}: ${line(plain(r.text || r.raw), 200)}`); }
    return text(hits.length ? hits.slice(0, limit || 30).join('\n') + (hits.length > (limit || 30) ? `\n… ${hits.length - (limit || 30)} more` : '') : `Nothing found for "${query}".`);
  });

  async function save(slug, md, rev, previous) {
    const st = loadStructure(), fixed = st.enforceStructure(md);
    if (!fixed.trim()) throw new Error('Refusing to save an empty document.');
    keepLocalCopy(slug, rev, previous);
    const newRev = await store.rpc('policy_text_save', { p_slug: slug, p_body: fixed, p_base_rev: rev, p_name: WRITER });
    return { newRev, fixed, tidied: fixed !== md, rulesLoaded: st.ok };
  }
  const report = (slug, previous, r) => text(`Saved ${slug} (working copy, revision ${r.newRev}). The previous text was kept; list_backups shows it. Nothing is published.\n${diffSummary(previous, r.fixed)}` +
    (r.tidied ? '\nThe structure rules adjusted the text a little (articles, numbering or text after sub-items); read the document again to see the result.' : '') +
    (r.rulesLoaded ? '' : '\nNote: the structure rules could not be loaded, so the text was saved as written; the editor will tidy it when someone opens it.'));

  tool('edit_document', 'Change a document with exact text replacements. Each "find" must appear exactly once in the markdown (include enough surrounding text). All edits are applied together or not at all. Writes the working copy only.', {
    slug: z.string(),
    edits: z.array(z.object({ find: z.string().describe('Exact markdown to replace; must be unique'), replace: z.string().describe('Replacement markdown; may be empty to delete') })).min(1),
    base_rev: z.number().int().optional().describe('The revision you read; the edit is refused if the document has changed since')
  }, async ({ slug, edits, base_rev }) => {
    const w = await work(slug);
    if (base_rev !== undefined && base_rev !== w.rev) throw new Error(`${slug} is now at revision ${w.rev} (you read ${base_rev})${w.by ? '; last saved by ' + w.by : ''}. Read it again before editing.`);
    let cur = w.working_md || '';
    edits.forEach((e, i) => {
      if (!e.find) throw new Error(`Edit ${i + 1}: "find" is empty.`);
      const n = cur.split(e.find).length - 1;
      if (n === 0) throw new Error(`Edit ${i + 1}: that text was not found. Copy it exactly from the markdown (marks like ** and indentation count).`);
      if (n > 1) throw new Error(`Edit ${i + 1}: that text appears ${n} times; add more surrounding text so it is unique.`);
      cur = cur.replace(e.find, () => e.replace);
    });
    const r = await save(slug, cur, w.rev, w.working_md || '');
    return report(slug, w.working_md || '', r);
  });

  tool('write_document', 'Replace the whole working copy of a document with new markdown. For writing a document from scratch or a large rewrite. Needs the revision you read. Refuses to delete most of an existing document unless allow_large_deletion is true.', {
    slug: z.string(), markdown: z.string(), base_rev: z.number().int().describe('The revision you read'),
    allow_large_deletion: z.boolean().optional()
  }, async ({ slug, markdown, base_rev, allow_large_deletion }) => {
    const w = await work(slug);
    if (base_rev !== w.rev) throw new Error(`${slug} is now at revision ${w.rev} (you read ${base_rev})${w.by ? '; last saved by ' + w.by : ''}. Read it again first.`);
    const old = w.working_md || '';
    if (!allow_large_deletion && old.length > 500 && markdown.length < old.length * 0.5) throw new Error(`The new text is less than half the length of the current text (${markdown.length} vs ${old.length} characters). If that is intended, set allow_large_deletion to true.`);
    const r = await save(slug, markdown, w.rev, old);
    return report(slug, old, r);
  });

  tool('list_comments', 'List the comments on a document (members and ExCo comment on passages in the Policy page).', { slug: z.string() }, async ({ slug }) => {
    const notes = await store.rpc('policy_note_list', { p_slug: slug });
    if (!notes.length) return text('No comments.');
    return text(notes.map((n) => `${n.parent_id ? '  ↳ ' : ''}${n.author_name}${n.resolved ? ' [resolved]' : ''}${n.quote ? ` on “${line(n.quote, 80)}”` : ''}: ${line(n.body, 300)}`).join('\n'));
  });

  tool('add_comment', 'Comment on a passage of a document. The quote must be words from the text as the page shows them (without markdown marks), up to 400 characters.', {
    slug: z.string(), quote: z.string().max(400), body: z.string().min(1).max(2000)
  }, async ({ slug, quote, body }) => {
    const w = await work(slug), all = plain(w.working_md || ''), q = plain(quote), i = all.indexOf(q);
    if (!q || i < 0) throw new Error('That quote was not found in the document text. Use words exactly as the page shows them.');
    await store.rpc('policy_note_add', { p_slug: slug, p_ref: '', p_quote: q, p_prefix: all.slice(Math.max(0, i - 40), i), p_body: body, p_parent: null, p_name: WRITER });
    return text('Comment added.');
  });

  tool('list_backups', 'List the earlier saves of a document (newest first). Every write by this connector is among them.', { slug: z.string() }, async ({ slug }) => {
    const b = await store.rpc('policy_backups', { p_slug: slug });
    return text(b.length ? b.map((x) => `#${x.id} · ${x.saved_at} · ${x.by || '?'} · ${x.chars} characters · ${line(x.preview || '', 70)}`).join('\n') : 'No earlier saves yet.');
  });

  tool('restore_backup', 'Put an earlier save back as the working copy (the text it replaces is kept too).', { slug: z.string(), id: z.number().int().describe('The # from list_backups') }, async ({ slug, id }) => {
    const rev = await store.rpc('policy_restore_backup', { p_slug: slug, p_id: id, p_name: WRITER });
    return text(`Restored earlier save #${id} into ${slug}; it is now revision ${rev}.`);
  });

  return server;
}
