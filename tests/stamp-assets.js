/* ═══════════════════════════════════════════════════════════════════
   CACHE-BUSTING STAMPS ON THE ASSET REFERENCES

     node tests/stamp-assets.js          → rewrite the stamps
     node tests/stamp-assets.js --check  → report only, exit 1 if stale

   Every `assets/x.js` reference in the HTML becomes `assets/x.js?v=<8>`,
   where <8> is the first eight hex characters of a SHA-256 over THE
   FILE'S CONTENT.

   Content, not the commit hash, and the difference matters. A commit
   hash changes on every commit, so every visitor would re-download
   every asset after every push even when nothing in them moved. A
   content hash changes exactly when the file changes — which is the
   only moment a cache should be invalidated. (Serge's call, and it is
   the right one.)

   WHY A STALE STAMP IS WORSE THAN NO STAMP. Without a stamp a browser
   may serve a heuristically-fresh old copy for a while. With a stamp
   that was not regenerated after an edit, the URL still names the old
   version and the old copy is correct FOREVER — the bug stops being a
   timing window and becomes permanent. So this is not a "did somebody
   remember to add ?v=" check anywhere: tests/check-static.js
   recomputes the hash and compares. A stamp that does not match its
   file fails the suite.

   Only `src="…"` and `href="…"` attributes are touched. The same paths
   appear inside comments and prose all over these files, and a stamp
   in a sentence would be noise that the checker would then have to
   learn to ignore.
═══════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const CHECK_ONLY = process.argv.includes('--check');

/* `src="assets/x.js"` or `href="assets/x.css"`, with or without a stamp
   already on it, so running this twice is the same as running it once. */
const REF = /(\b(?:src|href)=")(assets\/[A-Za-z0-9._-]+)(\?v=[0-9a-f]+)?(")/g;

const hashes = {};
function stampFor(rel) {
  if (hashes[rel] === undefined) {
    const abs = path.join(ROOT, rel);
    hashes[rel] = fs.existsSync(abs)
      ? crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex').slice(0, 8)
      : null;
  }
  return hashes[rel];
}

const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html')).sort();
let refs = 0, changed = 0, stale = 0, missingFile = [];
const touched = [];

files.forEach(name => {
  const abs = path.join(ROOT, name);
  const before = fs.readFileSync(abs, 'utf8');
  const after = before.replace(REF, (m, pre, rel, old, post) => {
    refs++;
    const want = stampFor(rel);
    if (want === null) { missingFile.push(name + ' → ' + rel); return m; }
    const now = '?v=' + want;
    if (old !== now) { stale++; return pre + rel + now + post; }
    return m;
  });
  if (after !== before) { changed++; touched.push(name); if (!CHECK_ONLY) fs.writeFileSync(abs, after); }
});

console.log('stamp-assets: ' + refs + ' asset reference(s) across ' + files.length +
            ' HTML file(s), ' + Object.keys(hashes).length + ' distinct asset(s)');
Object.keys(hashes).sort().forEach(r => console.log('  ' + (hashes[r] || '????????') + '  ' + r));

if (missingFile.length) {
  console.log('\n✗ referenced asset(s) not in the repo: ' + missingFile.join(', '));
  process.exit(1);
}
if (!refs) {
  /* Same reasoning as assertISO and the markers: a run that found
     nothing to do is indistinguishable from a broken one unless it
     says so. Zero references means the references moved, not that
     everything is stamped. */
  console.log('\n✗ found NO asset references at all — the pattern or the markup changed, ' +
              'not "nothing to stamp"');
  process.exit(1);
}
if (CHECK_ONLY) {
  if (stale) { console.log('\n✗ ' + stale + ' stamp(s) out of date in: ' + touched.join(', ') +
                           '\n  run: node tests/stamp-assets.js'); process.exit(1); }
  console.log('\n✓ every stamp matches its file');
} else {
  console.log(changed ? '\n✓ updated ' + stale + ' stamp(s) in ' + changed + ' file(s): ' + touched.join(', ')
                      : '\n✓ every stamp already matched its file — nothing rewritten');
}
