// Signing in. "login" asks for your email and password in the terminal (the password is typed hidden and never written down),
// signs in once, and keeps only the sign-in tokens in a private file in your home folder. The connector then acts as you.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from './config.mjs';

export const HOME = process.env.POLICY_MCP_HOME || path.join(os.homedir(), '.lkcmedsoc-policy-mcp');
const FILE = path.join(HOME, 'session.json');

export function readSession() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return null; }
}
export function writeSession(s) {
  fs.mkdirSync(HOME, { recursive: true, mode: 0o700 });
  fs.writeFileSync(FILE, JSON.stringify(s), { mode: 0o600 });
  try { fs.chmodSync(FILE, 0o600); } catch { /* not supported here */ }
}
export function forgetSession() { try { fs.unlinkSync(FILE); } catch { /* nothing to remove */ } }

function ask(question, hidden) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    if (!hidden || !stdin.isTTY) {
      stdin.setEncoding('utf8'); stdin.resume();
      let buf = '';
      const onData = (d) => { buf += d; const i = buf.indexOf('\n'); if (i >= 0) { stdin.pause(); stdin.off('data', onData); resolve(buf.slice(0, i).replace(/\r$/, '')); } };
      stdin.on('data', onData); return;
    }
    stdin.setRawMode(true); stdin.resume(); stdin.setEncoding('utf8');
    let pw = '';
    const onData = (ch) => {
      for (const c of ch) {
        if (c === '\r' || c === '\n') { stdin.setRawMode(false); stdin.pause(); stdin.off('data', onData); process.stdout.write('\n'); return resolve(pw); }
        if (c === '\u0003') { stdin.setRawMode(false); process.stdout.write('\n'); process.exit(130); }
        if (c === '\u007f' || c === '\b') pw = pw.slice(0, -1); else pw += c;
      }
    };
    stdin.on('data', onData);
  });
}

export async function login() {
  console.log('Sign in to the LKCMedSoc Policy as yourself. Your password is not stored; only a sign-in token is kept in', FILE);
  const email = (await ask('Email: ', false)).trim();
  const password = await ask('Password (hidden): ', true);
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !data.session) { console.error('Could not sign in:', error ? error.message : 'no session'); process.exit(1); }
  const probe = await sb.schema('activities').rpc('policy_all');
  if (probe.error) { console.error('Signed in, but this account cannot read the Policy (ExCo members only):', probe.error.message); process.exit(1); }
  writeSession({ email, access_token: data.session.access_token, refresh_token: data.session.refresh_token, expires_at: data.session.expires_at });
  console.log(`Signed in as ${email}. The connector can now read ${probe.data.length} documents. You can close this window.`);
}
