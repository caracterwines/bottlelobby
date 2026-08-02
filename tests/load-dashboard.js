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

/* ── AND: persistence is switched off here, for every harness ──────
   The page persists its demo state to localStorage (spec C8). In a
   harness that would be the worst possible side effect: one harness
   writing state that the next one reads back, so the checks that are
   meant to be the safety net become the thing that lies.

   jsdom already makes that unlikely — the harnesses build their DOM
   without a `url`, the origin is therefore opaque, and `localStorage`
   is not even defined in the page (measured 2 Aug 2026). But that is
   an accident of how the harnesses happen to be written: the day
   someone passes `url: 'http://localhost'` to get cookies or a
   sensible `location`, persistence would come back on silently and
   every harness after it would be suspect.

   So the switch is set here, explicitly, in the one file all of them
   go through — rather than eleven times, where it can be forgotten.
   `{ persist: true }` opts back in; only tests/persistence.js does. */
const KILL_SWITCH = '<script>window.BL_NO_PERSIST = true;</script>';

/* Returns { html, externals, styles } — html with every external
   script inlined, the list of script files that were pulled in, and
   the list of stylesheets. Throws on a missing or empty asset.

   Stylesheets get the same treatment for the same reason: check-static
   cross-checks class names against the page's CSS, and a rule that
   moved into assets/ would otherwise look like a missing rule. */
function loadDashboard(file, opts) {
  const persist = !!(opts && opts.persist);
  const target = file ? path.resolve(file) : DASHBOARD;
  const dir = path.dirname(target);
  const raw = fs.readFileSync(target, 'utf8');
  const externals = [];
  const styles = [];

  const readAsset = (src, kind) => {
    const abs = path.resolve(dir, src);
    if (!fs.existsSync(abs))
      throw new Error(kind + ' "' + src + '" does not exist at ' + abs +
        ' — the page references an asset that is not in the repo');
    const code = fs.readFileSync(abs, 'utf8');
    if (!code.trim())
      throw new Error(kind + ' "' + src + '" is empty — the page would ' +
        'load with its ' + (kind === 'link href' ? 'rules' : 'globals') +
        ' missing and no error anywhere');
    return { src: src, abs: abs, code: code };
  };
  const isRemote = src => /^[a-z]+:\/\//i.test(src) || src.startsWith('//');

  let html = raw.replace(
    /<script\s+src="([^"]+)"\s*><\/script>/g,
    (tag, src) => {
      /* Only local assets are inlined. A CDN URL would be a separate
         decision — the prototype has none, and silently swallowing one
         would hide it. */
      if (isRemote(src)) return tag;
      const asset = readAsset(src, 'script src');
      externals.push(asset);
      /* A literal "</script>" inside the asset would close the block
         early. None today; cheap to keep honest. */
      return '<script>\n' + asset.code.replace(/<\/script>/g, '<\\/script>') + '\n</script>';
    }
  );

  html = html.replace(
    /<link\s+rel="stylesheet"\s+href="([^"]+)"\s*\/?>/g,
    (tag, href) => {
      if (isRemote(href)) return tag;
      const asset = readAsset(href, 'link href');
      styles.push(asset);
      return '<style>\n' + asset.code + '\n</style>';
    }
  );

  /* Straight after <head>, so it is set before the store script is
     even parsed. A page without a <head> gets it prepended — being
     first in document order is the whole requirement. */
  if (!persist) {
    html = /<head[^>]*>/i.test(html)
      ? html.replace(/<head[^>]*>/i, m => m + '\n' + KILL_SWITCH)
      : KILL_SWITCH + '\n' + html;
  }

  return { html: html, externals: externals, styles: styles, file: target, raw: raw };
}

module.exports = { loadDashboard: loadDashboard, DASHBOARD: DASHBOARD, KILL_SWITCH: KILL_SWITCH };
