'use client';
import { useEffect, useState } from 'react';

// Text size for the policy pages, like zooming a document: 70% to 200%, remembered on this device.
const KEY = 'lkc-policy-zoom', STEPS = [0.7, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];
const apply = (z: number) => document.documentElement.style.setProperty('--doc-zoom', String(z));

export default function ZoomControl() {
  const [z, setZ] = useState(1);
  useEffect(() => {
    try { const v = parseFloat(localStorage.getItem(KEY) ?? ''); if (STEPS.includes(v)) { setZ(v); apply(v); } } catch { /* storage blocked: keep 100% */ }
  }, []);
  const set = (v: number) => { setZ(v); apply(v); try { localStorage.setItem(KEY, String(v)); } catch { /* ignore */ } };
  const i = STEPS.indexOf(z);
  return (
    <span className="doc-zoom" role="group" aria-label="Text size">
      <button type="button" onClick={() => set(STEPS[Math.max(0, i - 1)])} disabled={i <= 0} aria-label="Zoom out">−</button>
      <button type="button" onClick={() => set(1)} aria-label="Reset zoom" title="Reset to 100%" className="pct">{Math.round(z * 100)}%</button>
      <button type="button" onClick={() => set(STEPS[Math.min(STEPS.length - 1, i + 1)])} disabled={i >= STEPS.length - 1} aria-label="Zoom in">+</button>
    </span>
  );
}
