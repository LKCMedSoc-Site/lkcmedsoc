'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserClient } from '@/lib/supabase';
import { wordDiff } from '@/lib/diff';
import { refreshPolicy } from '@/app/policy/actions';

// Editing a policy document where it is read, like a word processor.
//   Viewing   : what everyone sees.
//   Editing   : a document that is still a draft. Click a provision and change it; Save writes it straight in.
//   Suggesting: a document in force. A change is a proposal that ExCo votes on; the text only changes when it is approved and brought into force.
// Only ExCo ever see the controls. The database checks who is asking on every call, so hiding the buttons is a courtesy, not the protection.

type Mode = 'view' | 'edit' | 'suggest';
type WClause = { id: string; ref: string; heading: string; body_md: string; repealed: boolean };
type Working = { doc: { id: string; slug: string; status: 'draft' | 'in_force'; version: number; title: string }; clauses: WClause[] };
type Change = { ref: string; action: 'edit' | 'add' | 'repeal'; old_heading: string | null; old_body_md: string | null; new_heading: string | null; new_body_md: string | null };
type Detail = {
  amendment: { id: string; number: number; title: string; reason: string; kind: 'change' | 'adopt'; status: 'proposed' | 'approved'; proposed_by_name: string | null; proposed_at: string; decided_at: string | null; publish_by: string | null };
  doc: { tier: string }; changes: Change[]; votes: { voter: string; name: string | null; vote: string; comment: string | null }[];
  me: string | null; seats: number; needed: number | null;
};
type Ctx = {
  exco: boolean; mode: Mode; setMode: (m: Mode) => void; modes: Mode[]; working: Working | null; open: Detail[]; me: string | null;
  slug: string; draft: boolean; call: <T = unknown>(fn: string, args?: Record<string, unknown>) => Promise<T>; reload: () => Promise<void>; name: string;
};
const C = createContext<Ctx | null>(null);
const usePE = () => useContext(C);
const aNo = (n: number) => `A-${String(n).padStart(3, '0')}`;
const db = () => browserClient().schema('activities');
// The editor writes bullets as "* " where the stored text uses "- ": normalise so an unchanged list is not reported as a change.
const normaliseMd = (m: string) => m.replace(/^(\s*)\* /gm, '$1- ').replace(/\n{3,}/g, '\n\n').trim();
// For showing a comparison: read as text, without the markdown marks.
const plain = (m: string | null) => String(m ?? '').replace(/\*\*|\*|`/g, '').replace(/^(\s*)- /gm, '$1• ');
const TOAST_CSS = 'https://cdn.jsdelivr.net/npm/@toast-ui/editor@3.2.2/dist/toastui-editor.css';

export function PolicyEditProvider({ slug, draft, past, children }: { slug: string; draft: boolean; past: boolean; children: React.ReactNode }) {
  const router = useRouter();
  const [exco, setExco] = useState(false), [mode, setMode] = useState<Mode>('view'), [working, setWorking] = useState<Working | null>(null);
  const [open, setOpen] = useState<Detail[]>([]), [me, setMe] = useState<string | null>(null), [name, setName] = useState('');

  const call = useCallback(async <T,>(fn: string, args: Record<string, unknown> = {}) => {
    const { data, error } = await db().rpc(fn, args); if (error) throw error; return data as T;
  }, []);

  const load = useCallback(async () => {
    const w = await call<Working | null>('policy_working', { p_slug: slug }); setWorking(w);
    const list = await call<{ id: string; doc_slug: string; status: string }[]>('policy_amendments');
    const mine = list.filter((a) => a.doc_slug === slug && (a.status === 'proposed' || a.status === 'approved'));
    const details = await Promise.all(mine.map((a) => call<Detail>('policy_amendment', { p_id: a.id })));
    setOpen(details); setMe(details[0]?.me ?? null);
  }, [call, slug]);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const ok = await call<boolean>('is_exco'); if (!live || ok !== true) return;
        setExco(true);
        try { const who = await browserClient().schema('records').rpc('whoami'); const d = who.data as { name?: string; email?: string } | null; if (live) setName(d?.name || d?.email || ''); } catch { /* the database falls back to the sign-in email */ }
        await load();
      } catch { /* signed out, or the policy tables are not installed: the page stays read-only */ }
    })();
    return () => { live = false; };
  }, [call, load]);

  const modes: Mode[] = past ? ['view'] : draft ? ['view', 'edit'] : ['view', 'suggest'];
  const reload = useCallback(async () => { await load(); await refreshPolicy(); router.refresh(); }, [load, router]);
  const value: Ctx = { exco, mode, setMode, modes, working, open, me, slug, draft, call, reload, name };
  return <C.Provider value={value}>{children}</C.Provider>;
}

/** Viewing / Editing (or Suggesting): ExCo only. */
export function ModeSwitch() {
  const c = usePE(); if (!c || !c.exco || c.modes.length < 2) return null;
  const label: Record<Mode, string> = { view: 'Viewing', edit: 'Editing', suggest: 'Suggesting' };
  return (
    <span className="pe-modes" role="group" aria-label="Mode">
      {c.modes.map((m) => <button key={m} type="button" aria-pressed={c.mode === m} className={c.mode === m ? 'on' : ''} onClick={() => c.setMode(m)}>{label[m]}</button>)}
    </span>
  );
}

// ---------- the rich-text editor, loaded only when someone starts editing ----------
type Ed = { getMarkdown: () => string; destroy: () => void };
function useEditor(initial: string, height = '300px') {
  const box = useRef<HTMLDivElement>(null), ed = useRef<Ed | null>(null), [ready, setReady] = useState(false);
  useEffect(() => {
    let dead = false;
    if (!document.querySelector(`link[href="${TOAST_CSS}"]`)) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = TOAST_CSS; document.head.appendChild(l); }
    import('@toast-ui/editor').then((m) => {
      if (dead || !box.current) return;
      const Editor = (m as unknown as { default?: new (o: object) => Ed; Editor?: new (o: object) => Ed }).default ?? (m as unknown as { Editor: new (o: object) => Ed }).Editor;
      ed.current = new Editor({ el: box.current, height, initialEditType: 'wysiwyg', hideModeSwitch: true, usageStatistics: false, initialValue: initial,
        toolbarItems: [['heading', 'bold', 'italic'], ['ul', 'ol', 'table'], ['hr', 'quote'], ['link']] });
      setReady(true);
    });
    return () => { dead = true; ed.current?.destroy(); ed.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { box, markdown: () => normaliseMd(ed.current?.getMarkdown() ?? initial), ready };
}

function useAct() {
  const [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setErr('');
    try { await fn(); return true; }
    catch (e) { const m = (e as { message?: string })?.message ?? String(e); setErr(/row-level|permission/i.test(m) ? "You don't have permission for that." : m); return false; }
    finally { setBusy(false); }
  };
  return { busy, err, run };
}

// ---------- one provision ----------
export function ClauseView({ refId, heading, html, notes }: { refId: string; heading: string; html: string; notes: string[] }) {
  const c = usePE(); const [editing, setEditing] = useState(false);
  const w = c?.working?.clauses.find((x) => x.ref === refId);
  const here = (c?.open ?? []).filter((d) => d.amendment.kind === 'change' && d.changes.some((x) => x.ref === refId));
  const canEdit = !!c && c.exco && c.mode !== 'view' && !!w;
  return (
    <section id={refId} className="doc-clause">
      <a className="doc-ref" href={`#${refId}`} title="Link to this provision">{refId}</a>
      <div>
        {editing && w && c ? <ClauseEditor clause={w} onDone={() => setEditing(false)} /> : (
          <>
            <h2 className="doc-head">{heading}</h2>
            <div className="doc-body prose-lkc" dangerouslySetInnerHTML={{ __html: html }} />
            {notes.map((n) => <p key={n} className="doc-note">[{n}]</p>)}
            {canEdit ? <p className="pe-row"><button type="button" className="pe-btn" onClick={() => setEditing(true)}>{c!.mode === 'edit' ? 'Edit' : 'Suggest a change'}</button></p> : null}
          </>
        )}
        {c && c.exco ? here.map((d) => <Proposal key={d.amendment.id} d={d} refId={refId} />) : null}
      </div>
    </section>
  );
}

function ClauseEditor({ clause, onDone }: { clause: WClause; onDone: () => void }) {
  const c = usePE()!; const { busy, err, run } = useAct();
  const [h, setH] = useState(clause.heading), [reason, setReason] = useState(''), [repeal, setRepeal] = useState(false);
  const { box, markdown, ready } = useEditor(clause.body_md);
  const suggest = c.mode === 'suggest';
  const save = () => run(async () => {
    if (!suggest) { await c.call('policy_draft_save', { p_clause: clause.id, p_heading: h, p_body: markdown() }); }
    else {
      await c.call('policy_propose', { p_doc: c.working!.doc.id, p_kind: 'change', p_title: `${repeal ? 'Repeal' : 'Amend'} ${clause.ref} ${clause.heading}`.slice(0, 140), p_reason: reason,
        p_changes: [repeal ? { ref: clause.ref, action: 'repeal' } : { ref: clause.ref, action: 'edit', heading: h, body_md: markdown() }], p_name: c.name });
    }
    await c.reload(); onDone();
  });
  return (
    <div className="pe-editor">
      <p className="pe-label">{suggest ? `Suggest a change to ${clause.ref}` : `Editing ${clause.ref}`}</p>
      {!repeal ? <><label className="pe-label" htmlFor={`h-${clause.ref}`}>Heading</label><input id={`h-${clause.ref}`} className="pe-input" value={h} onChange={(e) => setH(e.target.value)} />
        <label className="pe-label">Text</label></> : <p className="pe-note">This provision will be removed. Its number is kept and never reused.</p>}
      <div ref={box} hidden={repeal} />
      {suggest ? <><label className="pe-label" htmlFor={`r-${clause.ref}`}>Why is this needed? (shown in the public changelog)</label>
        <textarea id={`r-${clause.ref}`} className="pe-input" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        <label className="pe-check"><input type="checkbox" checked={repeal} onChange={(e) => setRepeal(e.target.checked)} /> Repeal this provision instead</label></> : null}
      {err ? <p className="pe-err">{err}</p> : null}
      <p className="pe-row">
        <button type="button" className="pe-btn solid" disabled={busy || !ready} onClick={save}>{suggest ? 'Send for a vote' : 'Save'}</button>
        <button type="button" className="pe-btn" disabled={busy} onClick={onDone}>Cancel</button>
      </p>
    </div>
  );
}

// ---------- a proposal, shown on the provision it changes ----------
function Proposal({ d, refId }: { d: Detail; refId?: string }) {
  const c = usePE()!; const { busy, err, run } = useAct(); const a = d.amendment;
  const [note, setNote] = useState(''), [eff, setEff] = useState(() => new Date(Date.now() + 8 * 36e5).toISOString().slice(0, 10));
  const yes = d.votes.filter((v) => v.vote === 'for').length, no = d.votes.filter((v) => v.vote === 'against').length, mine = d.votes.find((v) => v.voter === c.me)?.vote;
  const need = d.needed;
  const ch = refId ? d.changes.find((x) => x.ref === refId) : null;
  const vote = (v: string) => run(async () => { await c.call('policy_vote', { p_id: a.id, p_vote: v, p_comment: note, p_name: c.name }); await c.reload(); });
  return (
    <aside className="pe-prop" aria-label={`Proposal ${aNo(a.number)}`}>
      <p className="pe-prop-head"><strong>{aNo(a.number)}</strong> · {a.kind === 'adopt' ? 'Proposal to adopt this document' : a.status === 'approved' ? 'Approved, not yet in force' : 'Proposed change, voting open'}</p>
      <p className="pe-prop-title">{a.title}</p>
      <p className="pe-note">By {a.proposed_by_name || 'an ExCo member'}. {a.reason}</p>
      {ch && ch.action === 'edit' ? <div className="pe-diff"><Diff a={`${ch.old_heading}\n\n${plain(ch.old_body_md)}`} b={`${ch.new_heading}\n\n${plain(ch.new_body_md)}`} /></div> : null}
      {ch && ch.action === 'repeal' ? <div className="pe-diff"><del>This provision is repealed.</del></div> : null}
      {a.status === 'proposed' && need ? (
        <>
          <p className="pe-tally"><strong>{yes} for</strong>, {no} against. Needs {need} for{d.doc.tier === 'bylaw' ? ` (a majority of ${d.seats} seats)` : ''}.</p>
          <input className="pe-input" placeholder="Optional: a line with your vote" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Comment on your vote" />
          <p className="pe-row">
            {([['for', 'For'], ['against', 'Against'], ['abstain', 'Abstain'], ['recused', 'I step out']] as const).map(([v, l]) => <button key={v} type="button" disabled={busy} className={`pe-btn${mine === v ? ' solid' : ''}`} onClick={() => vote(v)}>{l}</button>)}
          </p>
          {d.votes.length ? <ul className="pe-votes">{d.votes.map((v) => <li key={v.voter}><strong>{v.name || 'ExCo member'}</strong> {v.vote === 'recused' ? 'stepped out' : v.vote}{v.comment ? `: ${v.comment}` : ''}</li>)}</ul> : null}
          <p className="pe-row">
            <button type="button" className="pe-btn solid" disabled={busy} onClick={() => run(async () => { await c.call('policy_close_vote', { p_id: a.id }); await c.reload(); })}>Close the vote</button>
            <button type="button" className="pe-btn" disabled={busy} onClick={() => { if (confirm('Withdraw this proposal?')) run(async () => { await c.call('policy_withdraw', { p_id: a.id }); await c.reload(); }); }}>Withdraw</button>
          </p>
        </>
      ) : null}
      {a.status === 'approved' ? (
        <p className="pe-row">
          <label className="pe-label" style={{ margin: 0 }}>Takes effect on <input type="date" className="pe-input" style={{ width: 'auto', display: 'inline-block' }} value={eff} onChange={(e) => setEff(e.target.value)} /></label>
          <button type="button" className="pe-btn solid" disabled={busy} onClick={() => run(async () => { await c.call('policy_publish', { p_id: a.id, p_effective: eff }); await c.reload(); })}>Bring into force</button>
          {a.publish_by ? <span className="pe-note">Bylaws are published by {a.publish_by}.</span> : null}
        </p>
      ) : null}
      {err ? <p className="pe-err">{err}</p> : null}
    </aside>
  );
}

function Diff({ a, b }: { a: string; b: string }) {
  return <>{wordDiff(a, b).map((p, i) => (p.t === 'same' ? <span key={i}>{p.s}</span> : p.t === 'ins' ? <ins key={i}>{p.s}</ins> : <del key={i}>{p.s}</del>))}</>;
}

/** At the top of the document: proposals that are about the whole document or a new provision, and the adopt button for a draft. */
export function DocProposals() {
  const c = usePE(); const [adopting, setAdopting] = useState(false);
  if (!c || !c.exco || !c.working) return null;
  const refs = new Set(c.working.clauses.map((x) => x.ref));
  const top = c.open.filter((d) => d.amendment.kind === 'adopt' || d.changes.some((x) => !refs.has(x.ref)));
  const inline = c.open.filter((d) => !top.includes(d));
  const hasAdopt = c.open.some((d) => d.amendment.kind === 'adopt');
  return (
    <div className="pe-top">
      {inline.length ? <p className="doc-notice"><strong>{inline.length} proposal{inline.length > 1 ? 's' : ''} awaiting a decision:</strong> {inline.map((d, i) => <span key={d.amendment.id}>{i ? ', ' : ' '}<a href={`#${d.changes[0]?.ref}`}>{aNo(d.amendment.number)} ({d.changes[0]?.ref})</a></span>)}</p> : null}
      {top.map((d) => <Proposal key={d.amendment.id} d={d} />)}
      {c.draft && c.mode === 'edit' && !hasAdopt ? (adopting ? <AdoptForm onDone={() => setAdopting(false)} /> : <p className="pe-row"><button type="button" className="pe-btn solid" onClick={() => setAdopting(true)}>Propose adopting this document</button><span className="pe-note">It is still a draft. Adopting it brings it into force exactly as it reads, after a vote.</span></p>) : null}
    </div>
  );
}

function AdoptForm({ onDone }: { onDone: () => void }) {
  const c = usePE()!; const { busy, err, run } = useAct(); const [reason, setReason] = useState('');
  return (
    <div className="pe-editor">
      <label className="pe-label" htmlFor="adopt-reason">Why should this document be adopted now?</label>
      <textarea id="adopt-reason" className="pe-input" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
      {err ? <p className="pe-err">{err}</p> : null}
      <p className="pe-row">
        <button type="button" className="pe-btn solid" disabled={busy} onClick={() => run(async () => { await c.call('policy_propose', { p_doc: c.working!.doc.id, p_kind: 'adopt', p_title: `Adopt ${c.working!.doc.title}`.slice(0, 140), p_reason: reason, p_changes: [], p_name: c.name }); await c.reload(); onDone(); })}>Send for a vote</button>
        <button type="button" className="pe-btn" onClick={onDone}>Cancel</button>
      </p>
    </div>
  );
}

/** After the last provision: add a new one (a draft takes it at once; a document in force needs a vote). */
export function AddProvision() {
  const c = usePE(); const [on, setOn] = useState(false);
  if (!c || !c.exco || c.mode === 'view' || !c.working) return null;
  return on ? <AddForm onDone={() => setOn(false)} /> : <p className="pe-row" style={{ marginTop: '1.5rem' }}><button type="button" className="pe-btn" onClick={() => setOn(true)}>Add a provision</button></p>;
}
function AddForm({ onDone }: { onDone: () => void }) {
  const c = usePE()!; const { busy, err, run } = useAct(); const suggest = c.mode === 'suggest';
  const [ref, setRef] = useState(''), [h, setH] = useState(''), [reason, setReason] = useState(''); const { box, markdown, ready } = useEditor('', '220px');
  return (
    <div className="pe-editor">
      <p className="pe-label">New provision. The number is permanent and never reused: use the form B-9.6 (letter, dash, section, dot, number).</p>
      <input className="pe-input" placeholder="B-9.6" aria-label="Number" style={{ width: '8rem' }} value={ref} onChange={(e) => setRef(e.target.value)} />
      <input className="pe-input" placeholder="Heading" aria-label="Heading" value={h} onChange={(e) => setH(e.target.value)} />
      <div ref={box} />
      {suggest ? <textarea className="pe-input" rows={2} placeholder="Why is this needed?" value={reason} onChange={(e) => setReason(e.target.value)} /> : null}
      {err ? <p className="pe-err">{err}</p> : null}
      <p className="pe-row">
        <button type="button" className="pe-btn solid" disabled={busy || !ready} onClick={() => run(async () => {
          if (!suggest) await c.call('policy_draft_add', { p_doc: c.working!.doc.id, p_ref: ref, p_heading: h, p_body: markdown() });
          else await c.call('policy_propose', { p_doc: c.working!.doc.id, p_kind: 'change', p_title: `Add ${ref.toUpperCase()} ${h}`.slice(0, 140), p_reason: reason, p_changes: [{ ref: ref.trim().toUpperCase(), action: 'add', heading: h, body_md: markdown() }], p_name: c.name });
          await c.reload(); onDone();
        })}>{suggest ? 'Send for a vote' : 'Add provision'}</button>
        <button type="button" className="pe-btn" onClick={onDone}>Cancel</button>
      </p>
    </div>
  );
}
