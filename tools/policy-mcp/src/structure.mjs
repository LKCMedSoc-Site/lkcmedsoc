// The editor's own structure rules (articles, numbered clauses, nothing unnumbered after sub-items), so what the connector writes is already
// in the shape the Policy page wants. They are read straight out of policy-site/policy.js so the two can never drift apart.
import fs from 'node:fs';
import vm from 'node:vm';

let cached = null;
export function loadStructure() {
  if (cached) return cached;
  try {
    const src = fs.readFileSync(new URL('../../../policy-site/policy.js', import.meta.url), 'utf8');
    const a = src.indexOf('  function plainTitle(line) {'), b = src.indexOf('  async function docPage(p, q) {');
    if (a < 0 || b < 0 || b < a) throw new Error('markers not found');
    const ctx = vm.createContext({});
    vm.runInContext(src.slice(a, b) + '\nthis.enforceStructure = enforceStructure; this.numberAfterSubitems = numberAfterSubitems;', ctx);
    cached = { enforceStructure: ctx.enforceStructure, numberAfterSubitems: ctx.numberAfterSubitems, ok: true };
  } catch (e) {
    cached = { enforceStructure: (md) => md, numberAfterSubitems: (md) => md, ok: false, why: String(e.message || e) };
  }
  return cached;
}
