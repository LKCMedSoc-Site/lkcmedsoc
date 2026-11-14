'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { browserClient, friendly } from '@/lib/supabase';
import { whenText } from '@/lib/dates';
import { eventICS, googleCalUrl } from '@/lib/calendar';
import type { PublicEvent } from '@/lib/events';
import AuthBox from './AuthBox';
import { SpotsPill } from './EventCard';
import { Button } from './ui/button';

const NOTICE = 'We use your name and email only to run this event: registration, attendance and safety. Guest details are deleted after the event. By ticking this box you agree.';
const input = 'w-full rounded-lg border border-p300 bg-white px-3 py-2.5';

type Guest = { status: string; name: string; code: string };

export default function EventView({ id, initial, bare = false }: { id: string; initial: PublicEvent | null; bare?: boolean }) {
  const sb = browserClient();
  const [ev, setEv] = useState<PublicEvent | null>(initial);
  const [signedIn, setSignedIn] = useState(false);
  const [guest, setGuest] = useState<Guest | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [name, setName] = useState('');
  const [needName, setNeedName] = useState(false);
  const [g, setG] = useState({ name: '', email: '', consent: false });
  const [loaded, setLoaded] = useState(false);

  // Reload with the student's session so we see members-only events and "my RSVP".
  const load = useCallback(async () => {
    const { data: s } = await sb.auth.getSession();
    setSignedIn(!!s.session);
    const act = sb.schema('activities');
    const r = await act.rpc('public_event', { aid: id });
    if (!r.error) setEv((r.data as PublicEvent | null) ?? null);
    const saved = !s.session ? safeGet('guest_' + id) : null;
    if (saved && !(r.data as PublicEvent | null)?.my_rsvp) {
      const gs = await act.rpc('guest_rsvp_status', { aid: id, p_code: saved });
      const d = gs.data as { status: string; name: string } | null;
      if (d && d.status !== 'Cancelled') setGuest({ status: d.status, name: d.name, code: saved });
      else { safeDel('guest_' + id); setGuest(null); }
    } else setGuest(null);
    setLoaded(true);
  }, [id, sb]);

  useEffect(() => {
    void load();
    const { data } = sb.auth.onAuthStateChange(() => { void load(); });
    return () => data.subscription.unsubscribe();
  }, [load, sb]);

  async function run<T>(fn: () => Promise<T>, ok?: string): Promise<T | undefined> {
    setBusy(true); setMsg(null);
    try { const r = await fn(); if (ok) setMsg({ text: ok, ok: true }); setBusy(false); return r; }
    catch (e) { setMsg({ text: friendly(e), ok: false }); setBusy(false); return undefined; }
  }
  const must = <T,>(res: { data: T; error: unknown }) => { if (res.error) throw res.error; return res.data; };

  async function rsvp() {
    const r = await run(async () => must(await sb.schema('activities').rpc('rsvp', { aid: id, p_name: name.trim() || null })) as { status?: string } | null);
    if (r?.status) { setNeedName(false); await load(); setMsg({ text: r.status === 'Going' ? 'You are going' : 'Added to the waitlist', ok: true }); }
    else setNeedName(true); // like the portal: if it failed, ask for a name in case that is what was missing
  }
  async function cancelMine() {
    if (!confirm('Cancel your place?')) return;
    if (await run(async () => must(await sb.schema('activities').rpc('cancel_rsvp', { aid: id })), 'Cancelled') !== undefined) await load();
  }
  async function guestRsvp() {
    const r = await run(async () => must(await sb.schema('activities').rpc('guest_rsvp', { aid: id, p_name: g.name, p_email: g.email, p_consent: g.consent })) as { code?: string } | null);
    if (r?.code) { safeSet('guest_' + id, r.code); await load(); }
  }
  async function cancelGuest() {
    if (!guest || !confirm('Cancel your registration?')) return;
    if (await run(async () => must(await sb.schema('activities').rpc('guest_cancel_rsvp', { aid: id, p_code: guest.code })), 'Cancelled') !== undefined) { safeDel('guest_' + id); await load(); }
  }

  if (!ev) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-12">
        <h1 className="display text-4xl">{loaded ? 'Event not found' : 'Loading…'}</h1>
        {loaded ? <p className="text-muted">{signedIn ? 'This event is not open, or the link is wrong.' : 'This event may be for NTU students only. Sign in with your NTU email to see it.'}</p> : null}
        {loaded && !signedIn ? <AuthBox onSignedIn={load} /> : null}
        <p><Link className="underline" href="/events">All events</Link></p>
      </div>
    );
  }

  const url = typeof window !== 'undefined' ? window.location.origin + '/events/' + ev.id : '';
  const done = ev.status === 'Completed';
  const ticketFor = guest ?? (ev.my_rsvp ? { status: ev.my_rsvp.status, code: ev.my_rsvp.code, name: '' } : null);

  function downloadIcs() {
    const blob = new Blob([eventICS(ev!, url)], { type: 'text/calendar' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = ev!.title.replace(/[^\w]+/g, '-').toLowerCase() + '.ics'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  return (
    <article>
      {bare ? null : <div className="bg-p900 text-white">
        <div className="mx-auto max-w-3xl px-4 py-10">
          <div className="text-sm text-p300">{ev.body}</div>
          <h1 className="display mt-1 text-5xl text-white">{ev.title}</h1>
          <div className="mt-3 text-lg">{whenText(ev)}</div>
          {ev.venue ? <div className="text-p300">{ev.venue}</div> : null}
          {ev.visibility === 'Members' ? <span className="mt-3 inline-block rounded-full bg-mist px-2 py-0.5 text-xs text-p900">Students only</span> : null}
        </div>
      </div>}
      <div className={bare ? 'space-y-5' : 'mx-auto max-w-3xl space-y-5 px-4 py-8'}>
        {ev.summary && !bare ? <p className="whitespace-pre-wrap">{ev.summary}</p> : null}

        {!done && ev.start_date ? (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><a href={googleCalUrl(ev, url)} target="_blank" rel="noopener">Google Calendar</a></Button>
            <Button variant="outline" onClick={downloadIcs}>Apple / Outlook (.ics)</Button>
            <Button variant="outline" onClick={() => void navigator.clipboard?.writeText(url)}>Copy link</Button>
          </div>
        ) : null}

        {msg ? <p role="status" className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? 'bg-green-100 text-ok' : 'bg-red-100 text-bad'}`}>{msg.text}</p> : null}

        {ticketFor ? (
          <div className="space-y-3 rounded-xl border border-line bg-p50 p-4" data-testid="ticket">
            <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${ticketFor.status === 'Waitlist' ? 'bg-amber-100 text-amber-800' : 'bg-p900 text-white'}`}>{ticketFor.status === 'Waitlist' ? 'On the waitlist' : 'You are going'}</span>
            {ticketFor.name ? <div>{ticketFor.name}</div> : null}
            <p className="text-sm text-muted">{ticketFor.status === 'Waitlist' ? 'We will move you up automatically if a place opens, and you can still check in on the day.' : 'Show this code at the door, or scan the event screen when you arrive.'}</p>
            <div className="inline-block rounded-xl border border-line bg-white p-2"><QRCodeSVG value={ticketFor.code} size={200} /></div>
            <div className="text-sm text-muted">Your code: {ticketFor.code}</div>
            <Button variant="danger" onClick={guest ? cancelGuest : cancelMine} disabled={busy}>Cancel my place</Button>
          </div>
        ) : !ev.rsvp_open ? (
          <div className="rounded-xl border border-line bg-p50 p-4">{done ? 'This event has finished.' : 'RSVP is closed for this event.'}</div>
        ) : signedIn ? (
          <div className="space-y-3 rounded-xl border border-line bg-p50 p-4">
            <SpotsPill ev={ev} />
            {needName ? <input className={input} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} aria-label="Your name" /> : null}
            <div><Button onClick={() => void rsvp()} disabled={busy}>{ev.spots_left === 0 ? 'Join the waitlist' : 'RSVP'}</Button></div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-3 rounded-xl border border-line bg-p50 p-4">
              <SpotsPill ev={ev} />
              <div>NTU student or staff? Sign in to RSVP in one tap.</div>
              {!showAuth ? <Button onClick={() => setShowAuth(true)}>Sign in to RSVP</Button> : null}
            </div>
            {showAuth ? <AuthBox onSignedIn={load} /> : null}
            {ev.guest_rsvp_open ? (
              <form className="space-y-3 rounded-xl border border-line bg-p50 p-4" onSubmit={(e) => { e.preventDefault(); void guestRsvp(); }}>
                <h3 className="text-lg font-bold">Not from NTU? Register as a guest</h3>
                <input className={input} placeholder="Full name" autoComplete="name" value={g.name} onChange={(e) => setG({ ...g, name: e.target.value })} aria-label="Full name" />
                <input className={input} type="email" placeholder="Email" autoComplete="email" value={g.email} onChange={(e) => setG({ ...g, email: e.target.value })} aria-label="Email" />
                <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 size-4 accent-p900" checked={g.consent} onChange={(e) => setG({ ...g, consent: e.target.checked })} /><span>{NOTICE} Questions: lkcmedsoc@gmail.com.</span></label>
                <Button type="submit" disabled={busy}>Register as a guest</Button>
              </form>
            ) : null}
          </div>
        )}

        {signedIn ? <p><Button variant="outline" size="sm" onClick={() => void sb.auth.signOut()}>Sign out</Button></p> : null}
        {bare ? null : <p><Link className="underline" href="/events">All events</Link></p>}
        <p className="text-xs text-muted">Checking in on the day is done at the portal (scan the organisers&rsquo; QR code).</p>
      </div>
    </article>
  );
}

function safeGet(k: string) { try { return localStorage.getItem('site_' + k); } catch { return null; } }
function safeSet(k: string, v: string) { try { localStorage.setItem('site_' + k, v); } catch { /* private window */ } }
function safeDel(k: string) { try { localStorage.removeItem('site_' + k); } catch { /* ignore */ } }
