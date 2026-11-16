import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><body></body>', { pretendToBeVisual: true });
for (const k of ['window', 'document', 'navigator', 'Node', 'HTMLElement', 'Element', 'MutationObserver', 'getComputedStyle', 'DOMParser', 'Range', 'Selection', 'Event', 'KeyboardEvent', 'MouseEvent', 'requestAnimationFrame', 'cancelAnimationFrame', 'Option', 'HTMLInputElement', 'HTMLTextAreaElement']) {
  try { globalThis[k] = dom.window[k]; } catch (e) { Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true }); }
}
document.createRange = document.createRange || (() => ({ setStart() {}, setEnd() {}, getBoundingClientRect: () => ({}), getClientRects: () => [] }));
const { marked } = await import('marked');
const ve = await import('./ve.mjs');
const norm = (t) => String(t).replace(/\r/g, '').split('\n').map((l) => l.replace(/\s+$/, '')).filter((l) => l.trim() !== '').join('\n');
const cases = JSON.parse((await import('node:fs')).readFileSync(new URL('./cases.json', import.meta.url)));
let bad = 0;
for (const [name, md] of Object.entries(cases)) {
  const inst = ve.create({ markdown: md, marked, render: (m) => marked.parse(m), upload: async () => '', videoEmbed: () => null });
  // What would be saved after any edit: the whole page written back from the editor.
  inst.editor.commands.insertContentAt(inst.editor.state.doc.content.size, ' ', { updateSelection: false });
  const saved = inst.get();
  const out = norm(saved).replace(/ $/, '');
  const canon = (t) => String(marked.parse(norm(t))).replace(/\s+/g, ' ').trim();
  const same = out === norm(md) || canon(out) === canon(md); // identical text, or text that renders identically (e.g. * vs -)
  if (!same) bad++;
  console.log((same ? 'PASS ' : 'DIFF ') + name);
  if (!same) console.log('  in : ' + JSON.stringify(norm(md)).slice(0, 300) + '\n  out: ' + JSON.stringify(out).slice(0, 300));
  inst.destroy();
}
console.log(bad ? `\n${bad} case(s) changed` : '\nAll cases come back unchanged');
