/* The one place that knows how to hand the dashboard to a harness.
   ------------------------------------------------------------------
   WHY THIS EXISTS

   jsdom does not fetch external resources unless you ask it to. With
   the options every harness here uses —

       new JSDOM(html, { runScripts: 'dangerously' })

   — a `<script src="…">` is parsed, kept in the DOM, and never
   executed. No warning, no jsdomError, nothing on the virtual console.
   The page simply runs with that file's globals missing.

   That failure mode is dangerous in exactly the wrong direction. On the
   day `wineShows` moved into assets/bottle-lobby-data.js, every harness
   would have gone on reporting PASS while testing a page whose show
   data did not exist — and the checks that are supposed to be the
   safety net would have been the thing that hid the break.

   So: read the page, resolve every `<script src>` against the file's
   own directory, and splice the contents in as an inline block at the
   position the tag occupied. Document order is preserved, which is the
   whole contract (bottle-lobby-data.js must run before the block that
   reads it). A missing or empty asset throws here rather than surfacing
   later as an unexplained `undefined`.

   This is not a workaround for a jsdom bug — it is a faithful stand-in
   for how a browser treats a classic, non-async, non-defer script. The
   alternative, `resources:'usable'`, loads asynchronously and would
   force all four harnesses to become async for no gain in fidelity.

   ANY future extraction out of the dashboard must go through here. */
const fs = require('fs');
const path = require('path');

const DASHBOARD = path.join(__dirname, '..', 'bottle-lobby-dashboard.html');

/* Returns { html, externals } — html with every external script
   inlined, and the list of files that were pulled in (so a caller can
   report and check them). Throws on a missing or empty asset. */
function loadDashboard(file) {
  const target = file ? path.resolve(file) : DASHBOARD;
  const dir = path.dirname(target);
  const raw = fs.readFileSync(target, 'utf8');
  const externals = [];

  const html = raw.replace(
    /<script\s+src="([^"]+)"\s*><\/script>/g,
    (tag, src) => {
      /* Only local assets are inlined. A CDN URL would be a separate
         decision — the prototype has none, and silently swallowing one
         would hide it. */
      if (/^[a-z]+:\/\//i.test(src) || src.startsWith('//')) return tag;

      const abs = path.resolve(dir, src);
      if (!fs.existsSync(abs))
        throw new Error('script src="' + src + '" does not exist at ' + abs +
          ' — the page references an asset that is not in the repo');

      const code = fs.readFileSync(abs, 'utf8');
      if (!code.trim())
        throw new Error('script src="' + src + '" is empty — the page would ' +
          'load with its globals missing and no error anywhere');

      externals.push({ src: src, abs: abs, code: code });
      /* A literal "</script>" inside the asset would close the block
         early. None today; cheap to keep honest. */
      return '<script>\n' + code.replace(/<\/script>/g, '<\\/script>') + '\n</script>';
    }
  );

  return { html: html, externals: externals, file: target, raw: raw };
}

module.exports = { loadDashboard: loadDashboard, DASHBOARD: DASHBOARD };
