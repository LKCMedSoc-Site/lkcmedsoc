// Copies the logo and header image of each student CCA from the old Wix site into the Supabase "body-images" bucket
// and fills records.bodies.logo_url / header_url (only where they are still empty).
//
//   Preview (downloads and shrinks the images into ./.cca-images-preview, uploads nothing; no key needed):
//     node tools/import-cca-images.mjs --dry-run
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
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!dry && !key) { console.error('Set SUPABASE_SERVICE_ROLE_KEY, or pass --dry-run.'); process.exit(1); }
const sb = dry ? null : createClient(URL_, key, { db: { schema: 'records' }, auth: { persistSession: false } });
const manifest = JSON.parse(readFileSync(new URL('./cca-images.json', import.meta.url)));
const outDir = new URL('../.cca-images-preview/', import.meta.url);
if (dry) mkdirSync(outDir, { recursive: true });

async function fetchImage(id, maxW) {
  const r = await fetch('https://static.wixstatic.com/media/' + id);
  if (!r.ok) throw new Error('download ' + r.status);
  const input = Buffer.from(await r.arrayBuffer());
  const buf = await sharp(input).rotate().resize({ width: maxW, withoutEnlargement: true }).webp({ quality: 86 }).toBuffer();
  return { buf, from: input.length };
}

let ok = 0, skipped = 0, failed = 0;
for (const [name, imgs] of Object.entries(manifest)) {
  let row = null;
  if (!dry) {
    const { data, error } = await sb.from('bodies').select('id,logo_url,header_url').eq('name', name).eq('level', 'CCA/Project').single();
    if (error) { console.log('!! ' + name + ': ' + error.message); failed++; continue; }
    row = data;
  }
  const patch = {};
  for (const [kind, maxW] of [['logo', 400], ['header', 1800]]) {
    const id = imgs[kind];
    if (!id) continue;
    if (row && row[kind + '_url'] && !replace.has(name)) { skipped++; continue; }
    try {
      const { buf, from } = await fetchImage(id, maxW);
      const tag = createHash('sha1').update(id).digest('hex').slice(0, 10);
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
  if (!dry && Object.keys(patch).length) {
    const { error } = await sb.from('bodies').update(patch).eq('id', row.id);
    if (error) { console.log('!! ' + name + ' save: ' + error.message); failed++; }
  }
}
console.log(`\nDone: ${ok} images ${dry ? 'prepared' : 'uploaded'}, ${skipped} skipped (already set), ${failed} problems.`);
