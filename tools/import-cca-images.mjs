// Copies the logo and header image of each student CCA from the old Wix site into the Supabase "body-images" bucket
// and fills records.bodies.logo_url / header_url (only where they are still empty).
//
//   Preview (downloads and shrinks the images into ./.cca-images-preview, uploads nothing; no key needed):
//     node tools/import-cca-images.mjs --dry-run
//   Houses: add  --level House --manifest house-images.json  (crest = logo, a group photo = header).
//   A manifest entry may also have "gallery": [ids]; those go into the About text as ONE :::photos gallery. An item may be {"id": ..., "caption": ...}: the caption becomes the picture's alt text (shown as its caption on the site).
//   Only the gallery of CCAs (not logo/header): add  --only gallery  (and  --name "Project Aasha"  to limit to one or a few; repeatable).
//   Re-do only the logos (e.g. after changing how crests are fitted): add  --only logo  with --replace "Name" for each house.
//   To overwrite a CCA that already has images: add  --replace "Active Ageing Advocates"
//   For real (needs the project's service-role key, from Supabase > Project Settings > API; keep it out of the repo):
//     SUPABASE_SERVICE_ROLE_KEY=... node tools/import-cca-images.mjs
//
// tools/cca-images.json lists the Wix image ids per CCA. Logo = the square image on the page, header = the card photo.
// Logos are shrunk to 400px wide and headers to 1800px, as the Records upload does. Safe to run again: filled fields are skipped.
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const require = createRequire(new URL('../site/package.json', import.meta.url));
const sharp = require('sharp');
const { createClient } = require('@supabase/supabase-js');

const URL_ = process.env.SUPABASE_URL || 'https://brwdgbitxisadwbuwbdi.supabase.co';
const dry = process.argv.includes('--dry-run');
// --replace "Name" (repeatable) overwrites that CCA's existing logo and header instead of skipping them.
const replace = new Set(process.argv.flatMap((a, i, all) => (a === '--replace' ? [all[i + 1]] : [])));
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const LEVEL = arg('--level', 'CCA/Project');
const ONLY = arg('--only', ''); // --only logo: skip the header and gallery; --only gallery: only the gallery
const NAMES = new Set(process.argv.flatMap((a, i, all) => (a === '--name' ? [all[i + 1]] : [])));
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!dry && !key) { console.error('Set SUPABASE_SERVICE_ROLE_KEY, or pass --dry-run.'); process.exit(1); }
const sb = dry ? null : createClient(URL_, key, { db: { schema: 'records' }, auth: { persistSession: false } });
const manifest = JSON.parse(readFileSync(new URL('./' + arg('--manifest', 'cca-images.json'), import.meta.url)));
const outDir = new URL('../.cca-images-preview/', import.meta.url);
if (dry) mkdirSync(outDir, { recursive: true });

async function fetchImage(id, maxW, kind) {
  const r = await fetch('https://static.wixstatic.com/media/' + id);
  if (!r.ok) throw new Error('download ' + r.status);
  const input = Buffer.from(await r.arrayBuffer());
  const meta = await sharp(input).metadata();
  // A transparent logo (a crest) is wider than tall and gets cut off in the round frames, so trim it and centre it on a square with a margin.
  if (kind === 'logo' && meta.hasAlpha) {
    // Find the crest's real bounds from the alpha channel (faint near-invisible pixels defeat sharp's trim()).
    const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1;
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * info.channels + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const crest = await sharp(input).extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 }).png().toBuffer();
    const { width: w, height: h } = await sharp(crest).metadata();
    const side = Math.round(Math.max(w, h) * 1.12), padX = Math.floor((side - w) / 2), padY = Math.floor((side - h) / 2);
    // Two steps on purpose: sharp always resizes before it pads, so padding and shrinking in one pipeline gives a tall, cropped strip.
    const squared = await sharp(crest).extend({ top: padY, bottom: side - h - padY, left: padX, right: side - w - padX, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    const buf = await sharp(squared).resize({ width: maxW, height: maxW, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 90 }).toBuffer();
    return { buf, from: input.length, squared: true };
  }
  const buf = await sharp(input).rotate().resize({ width: maxW, withoutEnlargement: true }).webp({ quality: 86 }).toBuffer();
  return { buf, from: input.length };
}

let ok = 0, skipped = 0, failed = 0;
for (const [name, imgs] of Object.entries(manifest)) {
  if (name.startsWith('_') || (NAMES.size && !NAMES.has(name))) continue;
  let row = null;
  if (!dry) {
    const { data, error } = await sb.from('bodies').select('id,logo_url,header_url,about_md').eq('name', name).eq('level', LEVEL).single();
    if (error) { console.log('!! ' + name + ': ' + error.message); failed++; continue; }
    row = data;
  }
  const patch = {};
  for (const [kind, maxW] of [['logo', 400], ['header', 1800]]) {
    const id = imgs[kind];
    if (!id || (ONLY && ONLY !== kind)) continue;  // (ONLY = gallery skips both)
    if (row && row[kind + '_url'] && !replace.has(name)) { skipped++; continue; }
    try {
      const { buf, from, squared } = await fetchImage(id, maxW, kind);
      const tag = createHash('sha1').update(id).digest('hex').slice(0, 10) + (squared ? 'q' : '');
      if (dry) { writeFileSync(new URL(`${name.replace(/[^a-z0-9]+/gi, '_')}.${kind}.webp`, outDir), buf); }
      else {
        const path = `${row.id}/wix-${kind}-${tag}.webp`;
        const up = await sb.storage.from('body-images').upload(path, buf, { contentType: 'image/webp', cacheControl: '31536000', upsert: true });
        if (up.error) throw up.error;
        patch[kind + '_url'] = sb.storage.from('body-images').getPublicUrl(path).data.publicUrl;
      }
      console.log(`${name} ${kind}: ${(from / 1024) | 0} KB -> ${(buf.length / 1024) | 0} KB`);
      ok++;
    } catch (e) { console.log(`!! ${name} ${kind}: ${e.message || e}`); failed++; }
  }
  // Gallery: upload each photo at 1600px and append them to the About text as one :::photos block. Skipped if the text already has a gallery (unless --replace).
  if ((!ONLY || ONLY === 'gallery') && imgs.gallery?.length && (dry || !(row.about_md || '').includes(':::photos') || replace.has(name))) {
    const urls = [];
    for (const item of imgs.gallery) {
      const id = typeof item === 'string' ? item : item.id, caption = typeof item === 'string' ? '' : (item.caption || '').replace(/[\[\]\n]/g, ' ').trim();
      try {
        const { buf, from } = await fetchImage(id, 1600);
        const tag = createHash('sha1').update(id).digest('hex').slice(0, 10);
        if (dry) writeFileSync(new URL(`${name.replace(/[^a-z0-9]+/gi, '_')}.gallery-${tag}.webp`, outDir), buf);
        else {
          const path = `${row.id}/wix-gallery-${tag}.webp`;
          const up = await sb.storage.from('body-images').upload(path, buf, { contentType: 'image/webp', cacheControl: '31536000', upsert: true });
          if (up.error) throw up.error;
          urls.push({ url: sb.storage.from('body-images').getPublicUrl(path).data.publicUrl, caption });
        }
        console.log(`${name} gallery: ${(from / 1024) | 0} KB -> ${(buf.length / 1024) | 0} KB`);
        ok++;
      } catch (e) { console.log(`!! ${name} gallery: ${e.message || e}`); failed++; }
    }
    if (!dry && urls.length) {
      // One gallery block holding every picture (separate blocks of three would each be a separate masonry with gaps between them).
      const block = ':::photos\n' + urls.map((u) => `![${u.caption}](${u.url})`).join('\n') + '\n:::';
      const base = replace.has(name) ? (row.about_md || '').split(/\n*:::photos[\s\S]*$/)[0] : (row.about_md || '');
      patch.about_md = (base ? base + '\n\n' : '') + block;
    }
  }
  if (!dry && Object.keys(patch).length) {
    const { error } = await sb.from('bodies').update(patch).eq('id', row.id);
    if (error) { console.log('!! ' + name + ' save: ' + error.message); failed++; }
  }
}
console.log(`\nDone: ${ok} images ${dry ? 'prepared' : 'uploaded'}, ${skipped} skipped (already set), ${failed} problems.`);
