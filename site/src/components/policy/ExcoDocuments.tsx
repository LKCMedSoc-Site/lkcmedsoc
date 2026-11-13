'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { browserClient } from '@/lib/supabase';
import { refreshPolicy } from '@/app/policy/actions';

// For ExCo only: every document, published or not, with a switch for "shown on the website". Opening one gives the editing controls.
type Row = { slug: string; title: string; tier: string; status: 'draft' | 'in_force'; version: number; published: boolean; clauses: number; open_amendments: number };
const db = () => browserClient().schema('activities');

export default function ExcoDocuments() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null), [err, setErr] = useState('');
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const ok = await db().rpc('is_exco'); if (!live || ok.data !== true) return;
        const r = await db().rpc('policy_all'); if (r.error) throw r.error; if (live) setRows(r.data as Row[]);
      } catch { /* signed out, or not ExCo: show nothing */ }
    })();
    return () => { live = false; };
  }, []);
  if (!rows) return null;
  const toggle = async (slug: string, on: boolean) => {
    setErr('');
    const r = await db().rpc('policy_set_published', { p_slug: slug, p_on: on });
    if (r.error) { setErr(r.error.message); return; }
    setRows((rs) => rs && rs.map((x) => (x.slug === slug ? { ...x, published: on } : x)));
    await refreshPolicy(); router.refresh();
  };
  return (
    <section className="pe-exco" aria-label="For ExCo">
      <h2 className="doc-h2">For ExCo: all documents</h2>
      <p className="mt-2 text-[.95em] text-muted">Only you see this. Open a document to edit it, suggest a change, or vote. Tick “Shown on the website” when a document is ready for everyone.</p>
      <ul className="doc-list mt-2">
        {rows.map((d) => (
          <li key={d.slug} className="pe-exco-row">
            <Link href={`/policy/${d.slug}`}>
              <span className="t">{d.title}</span>
              <span className="st">{d.status === 'in_force' ? `In force · version ${d.version}` : 'Draft proposal'}{d.open_amendments ? ` · ${d.open_amendments} open proposal${d.open_amendments > 1 ? 's' : ''}` : ''}</span>
              <span className="s">{d.clauses} provisions</span>
            </Link>
            <label className="pe-check"><input type="checkbox" checked={d.published} onChange={(e) => toggle(d.slug, e.target.checked)} /> Shown on the website</label>
          </li>
        ))}
      </ul>
      {err ? <p className="pe-err">{err}</p> : null}
    </section>
  );
}
