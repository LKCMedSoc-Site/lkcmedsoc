// Compare two texts word by word: [{ t: 'same' | 'del' | 'ins', s }], runs merged. Used to show a proposed change against the text in force.
export type Part = { t: 'same' | 'del' | 'ins'; s: string };
export function wordDiff(a: string | null | undefined, b: string | null | undefined): Part[] {
  const x = String(a ?? '').split(/(\s+)/).filter(Boolean), y = String(b ?? '').split(/(\s+)/).filter(Boolean);
  const n = x.length, m = y.length;
  if (n * m > 4_000_000) return [{ t: 'del', s: String(a ?? '') }, { t: 'ins', s: String(b ?? '') }];   // very long text: show it as replaced
  const L: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = x[i] === y[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out: Part[] = [];
  const push = (t: Part['t'], s: string) => { const l = out[out.length - 1]; if (l && l.t === t) l.s += s; else out.push({ t, s }); };
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (x[i] === y[j]) { push('same', x[i]); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) { push('del', x[i]); i++; }
    else { push('ins', y[j]); j++; }
  }
  while (i < n) push('del', x[i++]);
  while (j < m) push('ins', y[j++]);
  return out;
}
