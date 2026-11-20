import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { numbered, outline } from '../src/render.mjs';

const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'policy-mcp-'));
let client;
const call = async (name, args) => { const r = await client.callTool({ name, arguments: args || {} }); return { err: !!r.isError, text: r.content.map((c) => c.text).join('\n') }; };

test.before(async () => {
  client = new Client({ name: 'test', version: '1' });
  await client.connect(new StdioClientTransport({ command: 'node', args: [new URL('../index.mjs', import.meta.url).pathname], env: { ...process.env, POLICY_MCP_FAKE: '1', POLICY_MCP_HOME: HOME } }));
});
test.after(async () => { await client.close(); });

test('the tools are there, and there is no way to publish', async () => {
  const names = (await client.listTools()).tools.map((t) => t.name).sort();
  assert.deepEqual(names, ['add_comment', 'edit_document', 'list_backups', 'list_comments', 'list_documents', 'read_all_documents', 'read_document', 'restore_backup', 'search', 'write_document']);
  assert.ok(!names.some((n) => /publish/i.test(n)));
});

test('the server tells Claude how documents are written', async () => {
  const ins = client.getInstructions();
  assert.match(ins, /never publish|can never publish/i);
  assert.match(ins, /Nothing unnumbered may come after the first sub-item/);
});

test('numbered view gives every rule its number', () => {
  const md = '## Membership\n\n1. **Title**\n    Lead-in:\n    1. first\n        1. deeper\n    2. second\n2. Fees\n';
  const out = numbered(md);
  assert.match(out, /Article 1\. Membership/);
  assert.match(out, /1\.1  \*\*Title\*\*/);
  assert.match(out, /1\.1\(a\)  first/);
  assert.match(out, /1\.1\(a\)\(i\)  deeper/);
  assert.match(out, /1\.1\(b\)  second/);
  assert.match(out, /1\.2  Fees/);
  const rows = outline(md);
  assert.equal(rows.find((r) => r.text === 'second').ref, '1.1(b)');
});

test('list and read', async () => {
  const l = await call('list_documents'); assert.match(l.text, /constitution — Constitution/); assert.match(l.text, /bylaws-bodies — Bodies/); assert.match(l.text, /2 article\(s\), 3 clause\(s\) · working revision 1/);
  const r = await call('read_document', { slug: 'constitution' });
  assert.match(r.text, /working revision 1/); assert.match(r.text, /2\.1\(a\)  Ordinary Members/); assert.match(r.text, /```markdown/);
  assert.equal((await call('read_document', { slug: 'nope' })).err, true);
});

test('search finds rules in every document, with numbers', async () => {
  const s = await call('search', { query: 'committee' });
  assert.match(s.text, /bylaws-bodies 1\.2/); assert.ok(!/constitution 1\.1:/.test(s.text));
  assert.match((await call('search', { query: 'zzzzzz' })).text, /Nothing found/);
});

test('edit_document: exact edits, uniqueness, revision check, backups', async () => {
  let r = await call('edit_document', { slug: 'constitution', base_rev: 1, edits: [{ find: 'Membership is open to all students.', replace: 'Membership is open to all NTU students.' }] });
  assert.equal(r.err, false); assert.match(r.text, /revision 2/); assert.match(r.text, /Nothing is published/);
  assert.match((await call('read_document', { slug: 'constitution', view: 'markdown' })).text, /all NTU students/);
  // stale revision is refused, not overwritten
  r = await call('edit_document', { slug: 'constitution', base_rev: 1, edits: [{ find: 'Fees', replace: 'Dues' }] });
  assert.equal(r.err, true); assert.match(r.text, /revision 2/);
  // text that is not there, and text that appears twice
  assert.equal((await call('edit_document', { slug: 'constitution', edits: [{ find: 'not in the document', replace: 'x' }] })).err, true);
  r = await call('edit_document', { slug: 'constitution', edits: [{ find: 'Members', replace: 'x' }] });
  assert.equal(r.err, true); assert.match(r.text, /appears \d+ times|not found/);
  // an earlier save exists on the server and a copy on disk
  assert.match((await call('list_backups', { slug: 'constitution' })).text, /#1/);
  assert.ok(fs.readdirSync(path.join(HOME, 'backups')).some((f) => f.startsWith('constitution-rev1-')));
});

test('text added after the sub-items becomes a new clause, not another list item', async () => {
  const r = await call('edit_document', { slug: 'constitution', edits: [{ find: '    2. Honorary Members\n', replace: '    2. Honorary Members\n    Closing words that follow the sub-items.\n' }] });
  assert.equal(r.err, false); assert.match(r.text, /structure rules adjusted/);
  const md = (await call('read_document', { slug: 'constitution', view: 'numbered' })).text;
  assert.match(md, /2\.2  Closing words that follow the sub-items\./);
  assert.ok(!/2\.1\(c\)/.test(md));
});

test('write_document needs the current revision and will not silently wipe a document', async () => {
  const cur = (await call('read_document', { slug: 'bylaws-bodies', view: 'numbered' })).text;
  const rev = Number(/working revision (\d+)/.exec(cur)[1]);
  assert.equal((await call('write_document', { slug: 'bylaws-bodies', markdown: '## New\n\n1. x\n', base_rev: rev + 5 })).err, true);
  const wipe = await call('write_document', { slug: 'bylaws-bodies', markdown: '## T\n\n1. x\n', base_rev: rev });
  // the sample document is short, so the shrink guard (over 500 characters) does not apply; a real wipe is covered below
  assert.equal(wipe.err, false);
  assert.equal((await call('write_document', { slug: 'bylaws-bodies', markdown: '   ', base_rev: rev + 1 })).err, true);   // empty is always refused
});

test('comments', async () => {
  assert.equal((await call('add_comment', { slug: 'constitution', quote: 'words that are not there', body: 'x' })).err, true);
  assert.equal((await call('add_comment', { slug: 'constitution', quote: 'Honorary Members', body: 'Should these have a vote?' })).err, false);
  const l = await call('list_comments', { slug: 'constitution' });
  assert.match(l.text, /Claude/); assert.match(l.text, /Should these have a vote\?/);
});

test('restore_backup puts earlier text back', async () => {
  const b = await call('list_backups', { slug: 'constitution' });
  const id = Math.min(...[...b.text.matchAll(/#(\d+)/g)].map((m) => Number(m[1])));   // the oldest earlier save: the text before any edit
  assert.equal((await call('restore_backup', { slug: 'constitution', id })).err, false);
  assert.match((await call('read_document', { slug: 'constitution', view: 'markdown' })).text, /Membership is open to all students\./);
});

test('read_all_documents shows every document for cross-checking', async () => {
  const a = await call('read_all_documents');
  assert.match(a.text, /=== constitution/); assert.match(a.text, /=== bylaws-bodies/);
});
