'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { browserClient, friendly } from '@/lib/supabase';
import { Button } from '@/components/ui/button';

// "Change password" from the account menu. The session is shared by every LKCMedSoc site, so this changes it for all of them.
const input = 'w-full rounded-lg border border-p300 bg-white px-3 py-2.5';
export default function ChangePasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  useEffect(() => {
    if (!open) return;
    setPw(''); setPw2(''); setMsg(null);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    panel.current?.querySelector<HTMLInputElement>('input')?.focus();
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [open, onClose]);
  if (!open || typeof document === 'undefined') return null;
  async function save() {
    if (pw.length < 8) return setMsg({ text: 'Use at least 8 characters', ok: false });
    if (pw !== pw2) return setMsg({ text: 'The two passwords differ', ok: false });
    setBusy(true); setMsg(null);
    try {
      const { error } = await browserClient().auth.updateUser({ password: pw });
      if (error) throw error;
      setMsg({ text: 'Password changed. It works on every LKCMedSoc site.', ok: true }); setPw(''); setPw2('');
    } catch (err) { setMsg({ text: friendly(err), ok: false }); }
    setBusy(false);
  }
  return createPortal(
    <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-p950/70 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={panel} role="dialog" aria-modal="true" aria-label="Change password" className="relative w-full max-w-md rounded-2xl bg-white p-5 text-p900 shadow-2xl">
        <button type="button" onClick={onClose} aria-label="Close" className="press absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-p50 text-p900"><X className="h-4 w-4" /></button>
        <form onSubmit={(ev) => { ev.preventDefault(); void save(); }} className="space-y-3 pr-1">
          <h3 className="pr-10 text-lg font-bold">Change password</h3>
          {msg ? <p role="status" className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? 'bg-green-100 text-ok' : 'bg-red-100 text-bad'}`}>{msg.text}</p> : null}
          <input className={input} type="password" placeholder="New password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} aria-label="New password" />
          <input className={input} type="password" placeholder="Repeat new password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} aria-label="Repeat new password" />
          <div className="flex gap-2"><Button type="submit" disabled={busy}>Save password</Button><Button type="button" variant="outline" onClick={onClose}>{msg?.ok ? 'Close' : 'Cancel'}</Button></div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
