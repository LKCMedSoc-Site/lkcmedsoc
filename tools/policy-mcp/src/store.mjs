// The one place that talks to the database: the same functions the Policy page uses. A stand-in (POLICY_MCP_FAKE=1) keeps documents in memory for tests.
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from './config.mjs';
import { readSession, writeSession } from './session.mjs';

export async function createStore() {
  if (process.env.POLICY_MCP_FAKE) return createFakeStore();
  const s = readSession();
  if (!s) throw new Error('Not signed in. Run "node index.mjs login" in the tools/policy-mcp folder first.');
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: true } });
  const { data, error } = await sb.auth.setSession({ access_token: s.access_token, refresh_token: s.refresh_token });
  if (error || !data.session) throw new Error('The saved sign-in no longer works (' + (error ? error.message : 'no session') + '). Run "node index.mjs login" again.');
  // keep the newest tokens: a refresh makes the old refresh token useless
  sb.auth.onAuthStateChange((event, session) => {
    if (session && (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN')) writeSession({ email: s.email, access_token: session.access_token, refresh_token: session.refresh_token, expires_at: session.expires_at });
  });
  const act = sb.schema('activities');
  return {
    who: s.email,
    async rpc(name, args) {
      const { data: d, error: e } = await act.rpc(name, args || {});
      if (e) throw new Error(e.message);
      return d;
    }
  };
}

// ---------- a stand-in database for tests ----------
export function createFakeStore(seed) {
  const docs = seed || [
    { slug: 'constitution', title: 'Constitution', tier: 'constitution', status: 'draft', version: 0,
      md: '## Name\n\n1. This Student Organisation shall be known as the "LKCMedSoc".\n\n## Membership\n\n1. Membership is open to all students.\n    Members are of two kinds:\n    1. Ordinary Members\n    2. Honorary Members\n2. Fees\n    No fee is payable.\n' },
    { slug: 'bylaws-bodies', title: 'Bodies', tier: 'bylaw', status: 'draft', version: 0,
      md: '## Committees\n\n1. **Committee or CCA?**\n    Two guards stop committees growing:\n    1. MedSoc does not take over work a CCA delivers.\n    2. Decisions are made at the annual review.\n2. **How committees work**\n    A committee is part of MedSoc.\n' }
  ];
  docs.forEach((d) => { d.rev = d.rev ?? 1; d.by = d.by ?? null; d.backups = d.backups ?? []; d.notes = d.notes ?? []; d.published_md = d.published_md ?? ''; });
  const find = (slug) => { const d = docs.find((x) => x.slug === slug); if (!d) throw new Error('Document not found'); return d; };
  const impl = {
    policy_all: () => docs.map((d) => ({ slug: d.slug, title: d.title, tier: d.tier, status: d.status, version: d.version, published: d.status === 'in_force', clauses: (d.md.match(/^\d+\./gm) || []).length, open_amendments: 0 })),
    policy_work: ({ p_slug }) => { const d = find(p_slug); return { doc: { slug: d.slug, title: d.title, tier: d.tier, status: d.status, version: d.version }, working_md: d.md, published_md: d.published_md, rev: d.rev, by: d.by, versions: [] }; },
    policy_text: ({ p_slug }) => { const d = find(p_slug); return { doc: { slug: d.slug, title: d.title, version: d.version }, body_md: d.published_md, versions: [] }; },
    policy_text_save: ({ p_slug, p_body, p_base_rev, p_name }) => {
      const d = find(p_slug);
      if (d.rev !== p_base_rev) throw new Error('CONFLICT: ' + (d.by || 'Someone') + ' saved a newer copy');
      d.backups.push({ id: d.backups.length + 1, body_md: d.md, saved_at: new Date().toISOString(), by: d.by });
      d.md = p_body; d.rev += 1; d.by = p_name; return d.rev;
    },
    policy_backups: ({ p_slug }) => find(p_slug).backups.map((b) => ({ id: b.id, saved_at: b.saved_at, by: b.by, chars: b.body_md.length, preview: b.body_md.slice(0, 80) })).reverse(),
    policy_restore_backup: ({ p_slug, p_id, p_name }) => { const d = find(p_slug), b = d.backups.find((x) => x.id === p_id); if (!b) throw new Error('That earlier save no longer exists'); d.backups.push({ id: d.backups.length + 1, body_md: d.md, saved_at: new Date().toISOString(), by: d.by }); d.md = b.body_md; d.rev += 1; d.by = p_name; return d.rev; },
    policy_note_list: ({ p_slug }) => find(p_slug).notes,
    policy_note_add: ({ p_slug, p_quote, p_body, p_name }) => { const d = find(p_slug); const id = 'n' + (d.notes.length + 1); d.notes.push({ id, quote: p_quote, body: p_body, author_name: p_name, parent_id: null, resolved: false, created_at: new Date().toISOString() }); return id; }
  };
  return { who: 'test@example.com', docs, async rpc(name, args) { if (!impl[name]) throw new Error('No such function: ' + name); return impl[name](args || {}); } };
}
