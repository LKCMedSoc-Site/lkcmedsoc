#!/usr/bin/env node
// LKCMedSoc Policy connector. Commands:
//   node index.mjs login    sign in once, as yourself (ExCo)
//   node index.mjs check    test the sign-in and show what the connector can see
//   node index.mjs logout   forget the saved sign-in
//   node index.mjs          run as a connector (this is what Claude starts)
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { login, forgetSession } from './src/session.mjs';

const cmd = process.argv[2];
if (cmd === 'login') { await login(); process.exit(0); }
if (cmd === 'logout') { forgetSession(); console.log('Signed out: the saved sign-in was removed.'); process.exit(0); }
if (cmd === 'check') {
  const { createStore } = await import('./src/store.mjs');
  const { loadStructure } = await import('./src/structure.mjs');
  try {
    const store = await createStore(), docs = await store.rpc('policy_all');
    console.log(`Signed in as ${store.who}. ${docs.length} documents:`);
    docs.forEach((d) => console.log(`  ${d.slug} — ${d.title} (${d.status === 'in_force' ? 'in force' : 'draft'})`));
    const st = loadStructure(); console.log(st.ok ? 'Structure rules: loaded from policy-site/policy.js.' : `Structure rules NOT loaded (${st.why}); writes will be saved as written.`);
    process.exit(0);
  } catch (e) { console.error(String(e.message || e)); process.exit(1); }
}
const { buildServer } = await import('./src/server.mjs');
const server = await buildServer();
await server.connect(new StdioServerTransport());
console.error('LKCMedSoc Policy connector ready.');
