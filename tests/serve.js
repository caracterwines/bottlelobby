/* ═══════════════════════════════════════════════════════════════════
   THE LOCAL SERVER FOR BROWSER ACCEPTANCE

     node tests/serve.js          → http://localhost:8765
     node tests/serve.js 9000     → another port

   Why this exists rather than `python3 -m http.server`.

   Python's SimpleHTTPRequestHandler sends Last-Modified and NO
   Cache-Control at all. A response with no freshness information may
   be cached HEURISTICALLY (RFC 9111 §4.2.2) — browsers commonly use
   10% of the time since Last-Modified — and a heuristically fresh
   response is served WITHOUT ASKING THE SERVER. Edit an asset, reload
   inside that window, and the browser hands back the old file having
   made no request at all.

   That produced three wrong measurements in one day, and the shape of
   the failure is the dangerous part: `bottle-lobby-dashboard.html` is
   660 KB and falls out of the heuristic window quickly, while
   `assets/bottle-lobby-data.js` is 17 KB and does not. So the page
   came back NEW and its data came back OLD — a combination no amount
   of reading the source can explain, and one that looks exactly like
   a regression in the code you just wrote.

   Reloading the HTML does not help, and neither does a query string on
   it: `?v=abc` changes the address of the PAGE, while the script tag
   inside it still says `assets/bottle-lobby-data.js`, unchanged, and
   that is the URL the cache is keyed on.

   Netlify does not have this problem — measured, not assumed:

     cache-control: public,max-age=0,must-revalidate

   on every file including the assets. `max-age=0` makes a response
   stale immediately and `must-revalidate` forbids serving it without
   asking, so a deploy is picked up on the next load. The live site
   needs no version stamps; the local server was the whole hazard.

   This server therefore sends `no-store`, which is STRICTER than
   Netlify on purpose. Local acceptance should never be the reason a
   finding is wrong, and being stricter than production can only cost
   a re-read of a file on disk.
═══════════════════════════════════════════════════════════════════ */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.argv[2]) || 8765;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon'
};

http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel === '/') rel = '/index.html';

  /* Stay inside the repo: resolve first, then check the result is
     still under ROOT. Checking the raw string for ".." is the version
     that misses encodings. */
  const file = path.resolve(ROOT, '.' + rel);
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) {
    res.writeHead(403); return res.end('outside the repo');
  }

  /* `tests/` is blocked on the deployed site (netlify.toml) and is
     blocked here too, so local and live disagree about as little as
     possible — including about what is reachable. */
  if (file.startsWith(path.join(ROOT, 'tests') + path.sep)) {
    res.writeHead(404); return res.end('tests/ is not served');
  }

  fs.readFile(file, (err, body) => {
    if (err) { res.writeHead(404); return res.end('not found: ' + rel); }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      /* The whole point of this file. No stored copy, no revalidation
         shortcut, no heuristic freshness — every load reads disk. */
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end(body);
  });
}).listen(PORT, () => {
  console.log('Bottle Lobby — local acceptance server');
  console.log('  http://localhost:' + PORT + '/bottle-lobby-dashboard.html');
  console.log('  Cache-Control: no-store on every response (see the note in this file)');
  console.log('  Ctrl-C to stop');
});
