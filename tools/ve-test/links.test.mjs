import { JSDOM } from 'jsdom'; import fs from 'node:fs';
const dom = new JSDOM('<!doctype html><body></body>'); const { document } = dom.window; globalThis.document = document; globalThis.URL = dom.window.URL;
const src = fs.readFileSync(new URL('../../records/pages.js', import.meta.url), 'utf8');
const a = src.indexOf('  var SOCIALS ='), b = src.indexOf('  // The colours a body can choose');
const h = (tag, attrs, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs || {})) { if (k === 'onclick') e.addEventListener('click', v); else if (k === 'value') e.value = v; else e.setAttribute(k, v); } kids.flat().forEach((c) => c != null && e.append(c.nodeType ? c : document.createTextNode(c))); return e; };
const kit = { h, field: (l, inp) => h('label', {}, l, inp) };
const mod = new Function('kit', 'document', src.slice(a, b) + '; return { linksField, fixLink, guessKind };')(kit, document);
const join = h('input', { value: 'https://forms.gle/x' });
const t = (name, got, want) => console.log((JSON.stringify(got) === JSON.stringify(want) ? 'PASS ' : 'FAIL ') + name + (JSON.stringify(got) === JSON.stringify(want) ? '' : '\n   got ' + JSON.stringify(got) + '\n   want ' + JSON.stringify(want)));
// 1. old columns + extra socials open as one list, and save back out unchanged
let f = mod.linksField(kit, { instagram: '@activeageingadvocates', website: 'https://aaa.org', socials: [{ kind: 'telegram', url: 'https://t.me/aaa' }] }, join);
const rows = () => [...f.el.querySelectorAll('.socialrow')].map((r) => [r.querySelector('select').value, r.querySelector('input').value]);
t('opens as one list', rows(), [['instagram', '@activeageingadvocates'], ['website', 'https://aaa.org'], ['telegram', 'https://t.me/aaa']]);
t('saves split back', f.get(), { instagram: '@activeageingadvocates', website: 'https://aaa.org', socials: [{ kind: 'telegram', url: 'https://t.me/aaa' }] });
// 2. a group with nothing yet
f = mod.linksField(kit, { instagram: '', website: '', socials: [] }, join);
t('empty saves empty', f.get(), { instagram: '', website: '', socials: [] });
// 3. duplicate of the column in socials is not shown twice
f = mod.linksField(kit, { instagram: 'https://instagram.com/x', website: '', socials: [{ kind: 'instagram', url: 'https://instagram.com/x' }, { kind: 'email', url: 'a@b.com' }] }, join);
t('no duplicate row', rows().length, 2);
// 4. typing: a pasted link picks its type; bare addresses get https://
f = mod.linksField(kit, { instagram: '', website: '', socials: [] }, join);
f.el.querySelector('button.ghost').click();
let r = f.el.querySelector('.socialrow'); const inp = r.querySelector('input'), sel = r.querySelector('select');
const type = (v) => { inp.value = v; inp.dispatchEvent(new dom.window.Event('input')); };
type('https://t.me/lkc'); t('telegram guessed', sel.value, 'telegram');
type('@lkc.psych'); t('@handle is instagram', sel.value, 'instagram');
type('abc.com'); inp.dispatchEvent(new dom.window.Event('blur')); t('bare address gets https', [sel.value, inp.value], ['website', 'https://abc.com']);
type('lkc.psych'); sel.value = 'instagram'; t('instagram handle with dot untouched', f.get().instagram, 'lkc.psych');
type('someone@gmail.com'); t('email guessed', sel.value, 'email'); t('email untouched', f.get().socials[0].url, 'someone@gmail.com');
// 5. a second website goes to the list, the first to the column
f = mod.linksField(kit, { instagram: '', website: 'https://a.org', socials: [{ kind: 'website', url: 'https://b.org' }] }, join);
t('second website stays in list', f.get(), { instagram: '', website: 'https://a.org', socials: [{ kind: 'website', url: 'https://b.org' }] });
