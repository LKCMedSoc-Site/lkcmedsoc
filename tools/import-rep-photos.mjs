// Copies the house rep headshots from the old Wix site into the Supabase "leader-photos" bucket. It only uploads: the service-role key
// has no access to records.students, so photo_url is set afterwards by sql/house_rep_photos.sql (the file names are predictable).
// It NEVER turns on show_photo: a photo stays private until its owner ticks "show my photo on the website" (see sql/leader_photos.sql).
//
//   Preview (downloads and crops the photos into ./.rep-photos-preview, uploads nothing; no key needed):
//     node tools/import-rep-photos.mjs --dry-run
//   For real (needs the project's service-role key, from Supabase > Project Settings > API; keep it out of the repo):
//     SUPABASE_SERVICE_ROLE_KEY=... node tools/import-rep-photos.mjs
//
// tools/house-rep-photos.json maps each student's matric to the Wix image id. Photos are cropped to a centred-on-the-face
// square (600px, webp) like the Records upload. Safe to run again (it just overwrites the same files).
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const require = createRequire(new URL('../site/package.json', import.meta.url));
const sharp = require('sharp');
const { createClient } = require('@supabase/supabase-js');

const URL_ = process.env.SUPABASE_URL || 'https://brwdgbitxisadwbuwbdi.supabase.co';
const dry = process.argv.includes('--dry-run');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!dry && !key) { console.error('Set SUPABASE_SERVICE_ROLE_KEY, or pass --dry-run.'); process.exit(1); }
const sb = dry ? null : createClient(URL_, key, { auth: { persistSession: false } });
const manifest = JSON.parse(readFileSync(new URL('./house-rep-photos.json', import.meta.url)));
const outDir = new URL('../.rep-photos-preview/', import.meta.url);
if (dry) mkdirSync(outDir, { recursive: true });

let ok = 0, failed = 0;
for (const [matric, p] of Object.entries(manifest)) {
  try {
    const r = await fetch('https://static.wixstatic.com/media/' + p.id);
    if (!r.ok) throw new Error('download ' + r.status);
    const input = Buffer.from(await r.arrayBuffer());
    const buf = await sharp(input).rotate().resize(600, 600, { fit: 'cover', position: sharp.strategy.attention, withoutEnlargement: false }).webp({ quality: 88 }).toBuffer();
    if (dry) writeFileSync(new URL(`${matric}_${p.name.replace(/[^a-z0-9]+/gi, '_')}.webp`, outDir), buf);
    else {
      const path = `${matric}/wix-${createHash('sha1').update(p.id).digest('hex').slice(0, 10)}.webp`;
      const up = await sb.storage.from('leader-photos').upload(path, buf, { contentType: 'image/webp', cacheControl: '31536000', upsert: true });
      if (up.error) throw up.error;
    }
    console.log(`${p.house} ${p.role} ${p.name}: ${(input.length / 1024) | 0} KB -> ${(buf.length / 1024) | 0} KB`);
    ok++;
  } catch (e) { console.log(`!! ${p.name}: ${e.message || e}`); failed++; }
}
console.log(`\nDone: ${ok} photos ${dry ? 'prepared' : 'uploaded'}, ${failed} problems. photo_url and show_photo were not changed (run sql/house_rep_photos.sql for photo_url).`);
