// Keeps the files that several sites share identical. The master copies live in shared/. Run from the repo root:
//   node tools/sync-shared.mjs          copy them into every site
//   node tools/sync-shared.mjs --check  only report copies that differ (exit 1 if any do)
// shared/menu.json       the site menu      -> website (site/public) and the app menu bar
// shared/suite-nav.js    the app menu bar   -> records, activities-site, feedback-site
// shared/sso.js          one sign-in cookie -> records, activities-site, feedback-site
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const targets = {
  'shared/menu.json': ['site/public/menu.json', 'records/menu.json', 'activities-site/menu.json', 'feedback-site/menu.json', 'gazette-site/menu.json'],
  'shared/suite-nav.js': ['records/suite-nav.js', 'activities-site/suite-nav.js', 'feedback-site/suite-nav.js', 'gazette-site/suite-nav.js'],
  'shared/sso.js': ['records/sso.js', 'activities-site/sso.js', 'feedback-site/sso.js', 'gazette-site/sso.js'],
};
const check = process.argv.includes('--check');
let differing = 0;
for (const [src, copies] of Object.entries(targets)) {
  const master = readFileSync(src, 'utf8');
  for (const copy of copies) {
    const same = existsSync(copy) && readFileSync(copy, 'utf8') === master;
    if (same) continue;
    differing++;
    if (check) console.log(`differs: ${copy} (master: ${src})`);
    else { writeFileSync(copy, master); console.log(`updated: ${copy}`); }
  }
}
if (check) { console.log(differing ? `${differing} copies differ. Run: node tools/sync-shared.mjs` : 'All shared copies match.'); process.exit(differing ? 1 : 0); }
console.log(differing ? `Updated ${differing} copies.` : 'Everything was already in sync.');
