// Where the database is. The key below is the public "publishable" key, the same one the Policy page itself ships with:
// what a person may see or change is decided by the database rules and by who is signed in, not by hiding this key.
import fs from 'node:fs';

const FALLBACK = { url: 'https://brwdgbitxisadwbuwbdi.supabase.co', key: 'sb_publishable_iVGn5p_HufuRZYEiAP_IyA_qxizqqfM' };

function fromPolicySite() {
  try {
    const txt = fs.readFileSync(new URL('../../../policy-site/config.js', import.meta.url), 'utf8');
    const url = /SUPABASE_URL:\s*'([^']+)'/.exec(txt), key = /SUPABASE_ANON_KEY:\s*'([^']+)'/.exec(txt);
    if (url && key) return { url: url[1], key: key[1] };
  } catch { /* not inside the repo: use the built-in copy */ }
  return null;
}

export const { url: SUPABASE_URL, key: SUPABASE_KEY } = fromPolicySite() || FALLBACK;
