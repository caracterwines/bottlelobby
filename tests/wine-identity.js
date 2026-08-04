/* ═══════════════════════════════════════════════════════════════════
   EVERY PRODUCT IS THE SAME RECORD EVERYWHERE (invariant 4, A14.4)

   WHY THIS FILE EXISTS. 91 wine references live across eleven sources
   in this prototype, and 52 of them joined by NAME. That works until
   two surfaces spell the same bottle differently — and ten of them
   already do, because the show floor appends the vintage:

       "Pouilly-Fumé"        in the book
       "Pouilly-Fumé 2023"   on the show

   A join that strips a trailing four-digit year to bridge that is a
   guess with good odds. It has already failed twice here for less
   (A14.4, the em dash in "Riesling Spätlese — Mosel"), and the failure
   mode is the dangerous one: nothing throws, the lookup simply finds
   nothing, and a surface renders empty.

   THE KEY IS OPAQUE ON PURPOSE. `url` already carries a slug, and it
   is complete and unique — but it is an ADDRESS. Renaming is not
   hypothetical: the appellation master-data pass (A4) is on the list
   and several wine names carry their appellation. A slug key leaves
   only bad options when a name changes: stay and lie, or follow and
   prove it was never an identifier.

   And a slug is not even reproducible. Two reasonable slugifiers —
   one folding diacritics via NFD, one treating them as separators —
   agree on 25 of these 26 wines and disagree on exactly one:
   "Nero d'Avola Sicilia DOC", where the apostrophe is either dropped
   or turned into a separator. One wine out of 26, and the symptom is
   a silent 404. That is the argument this file enforces: a key is
   STORED, never computed.

   WHAT THIS FILE DOES NOT YET CHECK. This is pass 1 of 5. Only the
   product records themselves carry the key so far; the 52 name-only
   references still name names. Passes 3a–3c move them, and the
   sections that forbid a name join outright arrive with pass 4. Until
   then this file guards the key itself — that it exists, that it is
   one per product, and that nobody can compute it.

   IT REPORTS ITS OWN REACH AND FAILS ON ZERO. A discovery that found
   no collection, or a collection with no products, is a broken check
   reporting success — the same reasoning as assertISO and the asset
   stamps.

   FINDINGS NAME THE WINE, NEVER THE BARE ID. An opaque key buys
   stability at the cost of legibility, and the place that cost comes
   due is a failure message at three in the morning. So every ✗ below
   resolves its id back to "Nero d'Avola Sicilia DOC 2022".
═══════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { loadDashboard } = require('./load-dashboard');

let fail = 0;
const bad = m => { console.log('  ✗ ' + m); fail++; };
const ok  = m => console.log('  ✓ ' + m);

/* Returns null if a patch never applied, so a mutation that missed its
   target cannot read as "the check held". */
function build(patch) {
  let html = loadDashboard().html;
  if (patch) {
    const before = html;
    html = html.replace(patch.from, patch.to);
    if (html === before) return null;
  }
  const errs = [];
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true,
    virtualConsole: new VirtualConsole().on('jsdomError', e => errs.push(e.message))
  });
  const win = dom.window;
  win.scrollTo = () => {}; win.confirm = () => true;
  if (errs.length) { console.log('SCRIPT ERRORS:\n' + errs.join('\n')); process.exit(1); }
  return win;
}

const ID_SHAPE = /^PRD-\d{4}$/;

/* ── DISCOVERY ───────────────────────────────────────────────────
   The collections are harvested from the SOURCE, not listed here.
   The failure this guards against is not a wrong list — it is a
   list that quietly stops covering everything, which is how
   `wineShows` sat outside the ISO conversion unnoticed.

   A collection bears products if its rows carry a producer, a name
   and a vintage. Deliberately NOT "has a wine url": a fifth book
   added without one has to be found too, and that is exactly the
   book most likely to be wrong. */
function harvest(win) {
  const FILES = ['bottle-lobby-dashboard.html', 'assets/bottle-lobby-data.js'];
  const names = [];
  FILES.forEach(f => {
    const src = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    [...src.matchAll(/^\s{0,2}(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\[/gm)]
      .forEach(m => { if (names.indexOf(m[1]) === -1) names.push(m[1]); });
  });
  const found = win.eval(`(function (names) {
    var out = { declared: names.length, collections: [] };
    names.forEach(function (name) {
      var v;
      try { v = eval(name); } catch (e) { return; }
      if (!Array.isArray(v) || !v.length) return;
      var rows = v.filter(function (r) {
        return r && typeof r === 'object' &&
               typeof r.winery === 'string' && typeof r.name === 'string' &&
               typeof r.vintage === 'number';
      });
      if (!rows.length) return;
      out.collections.push({ name: name, total: v.length, rows: JSON.parse(JSON.stringify(rows)) });
    });
    return out;
  })(${JSON.stringify(names)})`);
  return found;
}

const w = build();
const scan = harvest(w);
const ROWS = scan.collections.flatMap(c => c.rows.map(r => ({ ...r, from: c.name })));

/* ── THE CHECKS THEMSELVES, as functions over a set of rows ───────
   The live run and the counter-checks call exactly these. A mutation
   that only proved "the defect is present in the data" would be
   testing its own patch; what has to be shown is that THIS FILE'S
   sections go red, in the wording they would really print. */
const wine = r => r.name + ' ' + r.vintage + ' (' + r.winery + ')';
const CHECKS = {
  'no id': rows => rows.filter(r => typeof r.id !== 'string' || !r.id)
    .map(r => wine(r) + ' carries no id'),
  'not opaque': rows => rows.filter(r => typeof r.id === 'string' && r.id && !ID_SHAPE.test(r.id))
    .map(r => wine(r) + ' carries "' + r.id + '", which is not a key of the form PRD-nnnn'),
  'derivable': rows => rows.filter(r => {
    if (typeof r.id !== 'string') return false;
    const tail = r.id.replace(/^PRD-/, '').toLowerCase();
    return /[a-z]/.test(tail) || r.name.toLowerCase().includes(tail);
  }).map(r => wine(r) + ' carries "' + r.id + '", which a slugifier could produce from its name'),
  'two ids for one product': rows => {
    const m = new Map();
    rows.forEach(r => { const k = r.winery + ' | ' + r.name;
      if (!m.has(k)) m.set(k, new Set()); m.get(k).add(r.id); });
    return [...m.entries()].filter(([, s]) => s.size > 1)
      .map(([k, s]) => k + ' → ' + [...s].join(' / '));
  },
  'one id for two products': rows => {
    const m = new Map();
    rows.forEach(r => { if (!m.has(r.id)) m.set(r.id, new Set());
      m.get(r.id).add(r.winery + ' | ' + r.name); });
    return [...m.entries()].filter(([, s]) => s.size > 1)
      .map(([id, s]) => id + ' → ' + [...s].join(' / '));
  },
  'key used as address': rows => rows.filter(r => r.id && r.url && r.id === r.url)
    .map(r => wine(r) + ' uses one string as key and as address'),
  'address with no page': rows => {
    const files = new Set(fs.readdirSync(path.join(__dirname, '..')).filter(f => f.endsWith('.html')));
    return rows.filter(r => r.url && !files.has(r.url)).map(r => wine(r) + ' → ' + r.url);
  }
};
const complaints = rows => Object.entries(CHECKS)
  .flatMap(([name, fn]) => fn(rows).map(d => name + ': ' + d));

/* ── 1. The scan reaches something ──────────────────────────────── */
console.log('── the product collections are discovered, not listed');
if (!scan.declared)
  bad('no top-level array declarations harvested from the source — discovery is broken, not the data');
else if (!scan.collections.length)
  bad('walked ' + scan.declared + ' declared arrays and found no product collection at all — ' +
      'either the books are gone or the discovery rule no longer matches them');
else if (!ROWS.length)
  bad('found ' + scan.collections.length + ' product collections and not one product row — ' +
      'a check that examined nothing cannot be green');
else
  ok(scan.declared + ' declared arrays harvested, ' + scan.collections.length +
     ' bear products, ' + ROWS.length + ' product rows found\n      ' +
     scan.collections.map(c => c.name + ':' + c.rows.length +
       (c.rows.length === c.total ? '' : ' of ' + c.total)).join(' · '));

/* ── 2. Every product row carries the key, and it is opaque ─────── */
console.log('\n── every product row carries an id, and it is opaque');
{
  const say = k => CHECKS[k](ROWS);
  const noId = say('no id'), shape = say('not opaque'), leak = say('derivable');
  if (noId.length)      bad(noId.length + ' product row(s) carry no id — ' + noId.join(' · '));
  else if (shape.length) bad(shape.length + ' id(s) are not opaque keys — ' + shape.join(' · '));
  else                  ok(ROWS.length + ' product rows, every one carrying an id of the form PRD-nnnn');

  if (leak.length) bad(leak.length + ' id(s) carry something a slugifier could produce: ' + leak.join(' · '));
  else             ok('no id contains anything derivable from a name');
}

/* ── 3. One product, one id — in both directions ────────────────── */
console.log('\n── one product, one id, and one id, one product');
{
  const split = CHECKS['two ids for one product'](ROWS);
  const shared = CHECKS['one id for two products'](ROWS);
  const products = new Set(ROWS.map(r => r.winery + ' | ' + r.name)).size;
  const ids = new Set(ROWS.map(r => r.id)).size;

  if (split.length)
    bad(split.length + ' product(s) carry more than one id — the same bottle would not match itself: ' +
        split.join(' · '));
  else
    ok(products + ' distinct products across ' + scan.collections.length +
       ' collections, each with exactly one id');

  if (shared.length)
    bad(shared.length + ' id(s) name more than one product — a reference to one is ambiguous: ' +
        shared.join(' · '));
  else
    ok(ids + ' distinct ids, none of them naming two products');

  if (!split.length && !shared.length && products !== ids)
    bad('products and ids do not correspond one to one: ' + products + ' products, ' + ids + ' ids');
}

/* ── 4. The id is not the url, and never becomes it ─────────────── */
console.log('\n── an id is a key, a url is an address');
{
  const both = ROWS.filter(r => r.url);
  const same = CHECKS['key used as address'](ROWS);
  const dead = CHECKS['address with no page'](ROWS);
  if (!both.length)
    bad('not one product row carries a url — this section examined nothing');
  else if (same.length)
    bad(same.length + ' row(s) use one string as key and as address: ' + same.join(' · '));
  else
    ok(both.length + ' rows carry both an id and a url, and no row confuses the two');

  /* The two jobs only stay apart while the addresses still resolve.
     A key pointing at a missing page is a name again. */
  if (dead.length)
    bad(dead.length + ' url(s) have no page behind them: ' + dead.join(' · '));
  else
    ok(new Set(both.map(r => r.url)).size + ' distinct article pages, every one present in the repo');
}

/* ── 5. Counter-checks ──────────────────────────────────────────
   Each defect goes back in the shape it would actually arrive in.
   A mutation that misses its target returns null and fails here
   rather than reading as a check that held. */
console.log('\n── the counter-checks');
{
  const cases = [
    { what: 'two products share an id', by: 'one id for two products',
      from: "id:'PRD-1003', winery:'Cantina Rossi', name:\"Nero d'Avola Sicilia DOC\"",
      to:   "id:'PRD-1001', winery:'Cantina Rossi', name:\"Nero d'Avola Sicilia DOC\"" },

    /* The buyers' copy of one wine drifts to a second id — the shape
       the real defect takes: two surfaces, one bottle, and every
       cross-feature match between them quietly finding nothing. */
    { what: 'one product carries two ids', by: 'two ids for one product',
      from: "{ id:'PRD-1020', winery:'Henri Dubois Domaine', name:'Sauvignon Blanc — Sancerre', vintage:2023, exclusive:true",
      to:   "{ id:'PRD-1099', winery:'Henri Dubois Domaine', name:'Sauvignon Blanc — Sancerre', vintage:2023, exclusive:true" },

    { what: 'a product row loses its id', by: 'no id',
      from: "{ id:'PRD-1008', winery:'Cantina Rossi', name:'Baglio Rosso'",
      to:   "{ winery:'Cantina Rossi', name:'Baglio Rosso'" },

    { what: 'the id is replaced by the slug it was chosen not to be', by: 'not opaque',
      from: "id:'PRD-1018', winery:'Weingut Schmitt', name:'Müller-Thurgau — Mosel'",
      to:   "id:'muller-thurgau-mosel', winery:'Weingut Schmitt', name:'Müller-Thurgau — Mosel'" },

    { what: 'the id becomes the address', by: 'key used as address',
      from: "id:'PRD-1015', winery:'Henri Dubois Domaine', name:'Pouilly-Fumé'",
      to:   "id:'bottle-lobby-wine-pouilly-fume.html', winery:'Henri Dubois Domaine', name:'Pouilly-Fumé'" },

    { what: 'a url points at a page that is not in the repo', by: 'address with no page',
      from: "url:'bottle-lobby-wine-pouilly-fume.html', at:'2025-12-08'",
      to:   "url:'bottle-lobby-wine-pouilly-fume-2023.html', at:'2025-12-08'" }
  ];

  cases.forEach(c => {
    const win = build({ from: c.from, to: c.to });
    if (!win) return bad('"' + c.what + '" never applied — the check below proves nothing');
    const rows = harvest(win).collections.flatMap(x => x.rows);
    if (!rows.length) return bad('"' + c.what + '" left no product rows to examine');

    /* Named section, not "something went red": a mutation caught by
       the wrong check is a check that happens to overlap, and it
       would stop catching this the day the overlap goes. */
    const hits = CHECKS[c.by](rows);
    if (!hits.length)
      bad('NOT caught: ' + c.what + ' — "' + c.by + '" stayed silent, so the defect survives this file');
    else
      ok('caught by "' + c.by + '": ' + c.what + ' → ' + hits[0]);
  });

  /* The live data has to be clean by exactly the same reading. */
  const live = complaints(ROWS);
  if (live.length) bad('the unmutated data raises: ' + live.join(' · '));
  else ok('and the unmutated data raises none of the ' + Object.keys(CHECKS).length + ' complaints');
}

/* ── 6. The discovery itself has to keep finding things ─────────── */
console.log('\n── discovery does not quietly shrink');
{
  /* If the rule stops matching, every section above passes on an
     empty set. This is the same guard as the vacuum check in
     tests/stakeholders.js and it is the reason zero is a failure. */
  const win = build({
    from: /vintage:2023, type:'White', note:'Organic'/,
    to: "type:'White', note:'Organic'"
  });
  if (!win) bad('the discovery counter-check never applied');
  else {
    const after = harvest(win).collections.flatMap(x => x.rows).length;
    if (after < ROWS.length) ok('caught: a row losing the fields discovery matches on drops out of the scan (' +
      ROWS.length + ' → ' + after + '), and the count is stated rather than assumed');
    else bad('a row stripped of its vintage was still counted — discovery is matching on something else');
  }
}

console.log(fail ? '\n' + fail + ' check(s) failed' : '\nwine-identity: all checks passed');
process.exit(fail ? 1 : 0);
