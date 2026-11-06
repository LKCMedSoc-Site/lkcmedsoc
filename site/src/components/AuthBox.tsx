'use client';
import { useState } from 'react';
import { browserClient, friendly } from '@/lib/supabase';
import { Button } from '@/components/ui/button';

type Mode = 'signin' | 'signup' | 'forgot';
const input = 'w-full rounded-lg border border-p300 bg-white px-3 py-2.5';

/**
 * NTU email + password, right on the page. Sessions are per website address, so this has to live on
 * lkcmedsoc.com itself. After signing in the page just refreshes its own data: nobody is sent elsewhere.
 * Email links (confirm / reset) bring the student back to this exact page.
 */
export default function AuthBox({ onSignedIn }: { onSignedIn: () => void }) {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const sb = browserClient();
  const back = typeof window !== 'undefined' ? window.location.href.split('#')[0] : undefined;

  async function go() {
    const e = email.trim().toLowerCase();
    if (!e.includes('@')) return setMsg({ text: 'Enter your email', ok: false });
    setBusy(true); setMsg(null);
    try {
      if (mode === 'signin') {
        const { error } = await sb.auth.signInWithPassword({ email: e, password: pw });
        if (error) throw error;
        onSignedIn();
      } else if (mode === 'signup') {
        if (pw.length < 8) throw new Error('Use at least 8 characters');
        if (pw !== pw2) throw new Error('The two passwords differ');
        const { data, error } = await sb.auth.signUp({ email: e, password: pw, options: { emailRedirectTo: back } });
        if (error) throw error;
        if (data.session) onSignedIn();
        else { setMode('signin'); setMsg({ text: 'Check your email for a confirmation link. Open it, then sign in here.', ok: true }); }
      } else {
        const { error } = await sb.auth.resetPasswordForEmail(e, { redirectTo: back });
        if (error) throw error;
        setMode('signin'); setMsg({ text: 'If that email has an account, a reset link is on its way.', ok: true });
      }
    } catch (err) { setMsg({ text: friendly(err), ok: false }); }
    setBusy(false);
  }

  return (
    <form onSubmit={(ev) => { ev.preventDefault(); void go(); }} className="space-y-3 rounded-xl border border-line bg-p50 p-4">
      <h3 className="text-lg font-bold">{mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Reset password' : 'Sign in with your NTU email'}</h3>
      {mode === 'signup' ? <p className="text-sm text-muted">Use your NTU email. We send a link to confirm it is yours. Same account as the records site and the portal.</p> : null}
      {msg ? <p role="status" className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? 'bg-green-100 text-ok' : 'bg-red-100 text-bad'}`}>{msg.text}</p> : null}
      <input className={input} type="email" placeholder="you@e.ntu.edu.sg" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" />
      {mode !== 'forgot' ? <input className={input} type="password" placeholder="Password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={pw} onChange={(e) => setPw(e.target.value)} aria-label="Password" /> : null}
      {mode === 'signup' ? <input className={input} type="password" placeholder="Repeat password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} aria-label="Repeat password" /> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>{mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Email me a reset link' : 'Sign in'}</Button>
        {mode !== 'signin' ? <Button type="button" variant="outline" onClick={() => { setMode('signin'); setMsg(null); }}>Back to sign in</Button> : null}
        {mode === 'signin' ? <Button type="button" variant="outline" onClick={() => { setMode('signup'); setMsg(null); }}>Create account</Button> : null}
        {mode === 'signin' ? <Button type="button" variant="outline" onClick={() => { setMode('forgot'); setMsg(null); }}>Forgot password</Button> : null}
      </div>
    </form>
  );
}
