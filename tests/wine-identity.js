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
/* Read a global out of a window, whichever window. Top-level `let` and
   `const` are not window properties in a classic script, so this is
   eval and not property access. */
const J2 = (win, name) => JSON.parse(win.eval('JSON.stringify(' + name + ')'));
const J = name => J2(w, name);
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

/* ── 5. One resolver, and it answers both spellings ──────────────
   Pass 2. The readers are widened before any reference moves, so the
   resolver has to answer a key AND every name shape the sites it
   replaced accepted. If it stopped answering names, passes 3a–3c
   would each empty a surface rather than fail. */
console.log('\n── the resolver answers a key and, still, a name');
{
  const products = [...new Map(ROWS.map(r => [r.id, r])).values()];
  const askId    = products.filter(p => (w.eval('wineByRef(' + JSON.stringify(p.id) + ')') || {}).id !== p.id);
  const askName  = products.filter(p => (w.eval('wineByRef(' + JSON.stringify(p.name) + ')') || {}).id !== p.id);
  const askShow  = products.filter(p =>
    (w.eval('wineByRef(' + JSON.stringify(p.name + ' ' + p.vintage) + ')') || {}).id !== p.id);
  const label    = products.filter(p =>
    w.eval('wineLabel(' + JSON.stringify(p.id) + ')') !== p.name + ' ' + p.vintage);

  if (!products.length) bad('no products to ask about — this section examined nothing');
  else if (askId.length)   bad(askId.length + ' product(s) do not answer to their own key: ' + askId.map(wine).join(' · '));
  else if (askName.length) bad(askName.length + ' product(s) no longer answer to their bare name — ' +
      'the readers were narrowed before the references moved: ' + askName.map(wine).join(' · '));
  else if (askShow.length) bad(askShow.length + ' product(s) do not answer to the show spelling "name vintage": ' +
      askShow.map(wine).join(' · '));
  else if (label.length)   bad(label.length + ' label(s) do not read "name vintage": ' + label.map(wine).join(' · '));
  else ok(products.length + ' products, each answering to its key, its bare name and its show spelling, ' +
          'and each labelling as "name vintage"');

  /* The vintage still has to bind. Dropping it would let a 2019
     reference find a 2022 bottle, which is the one thing the
     string comparisons this replaced got right for free. */
  const wrongVintage = products.filter(p =>
    w.eval('wineByRef(' + JSON.stringify(p.name + ' ' + (p.vintage + 1)) + ') !== null'));
  if (wrongVintage.length)
    bad(wrongVintage.length + ' product(s) answer to a vintage they do not carry: ' + wrongVintage.map(wine).join(' · '));
  else
    ok('and none of them answers to a vintage it does not carry');
}

/* ── 6. How much of the name join is left ────────────────────────
   Not a pass/fail about the number — it is 3a–3c that brings it
   down. What must not happen is the number growing, or this scan
   losing sight of the sites, so the reach is spoken and zero found
   is a failure. The two inside wineByRef are the legacy branch
   itself and are named rather than excluded by a rule that could
   quietly swallow a third. */
console.log('\n── the name join is confined to the resolver');
{
  /* Both files: the resolver moved into the shared asset in 3b, and a
     scan that still looked only at the dashboard would report zero
     comparisons and call it progress. */
  const lines = ['bottle-lobby-dashboard.html', 'assets/bottle-lobby-data.js',
                 'assets/bottle-lobby-public-shows.js', 'assets/bottle-lobby-profile-shows.js']
    .flatMap(f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8').split('\n')
      .map(l => ({ f: f, l: l })));
  /* The trailing (?!\.) matters: `w.product.indicativePrice` is a
     price comparison, not a name one, and counting it would make the
     scan cry wolf until somebody stopped reading it. */
  const JOIN = /(\.name|\.wine|wineName|\.product)(?!\w)\s*(===|!==)\s*|(===|!==)\s*(\w+\.name|\w+\.wine|wineName|productName|\w+\.product)(?![\w.])/;
  const hits = [];
  lines.forEach((x, i) => {
    if (/^\s*(\/\*|\*|\/\/)/.test(x.l)) return;
    if (JOIN.test(x.l)) hits.push(x.f + ' ' + (i + 1) + ': ' + x.l.trim().slice(0, 78));
  });
  const inResolver = hits.filter(h => /rows\.find/.test(h));
  if (!hits.length)
    bad('the scan found no wine-name comparison at all — either the resolver is gone or this ' +
        'pattern stopped matching, and a scan that sees nothing cannot report progress');
  else if (hits.length !== inResolver.length)
    bad((hits.length - inResolver.length) + ' name comparison(s) still sit outside wineByRef():\n      ' +
        hits.filter(h => !/rows\.find/.test(h)).join('\n      '));
  else
    ok(hits.length + ' wine-name comparison(s) in the whole page, and both are the legacy branch ' +
       'inside wineByRef() — every other join asks the resolver');
}

/* ── 6b. The counter-checks for the resolver ─────────────────────
   Section 5 is three positive claims, and a positive claim about a
   function is worth what its failure mode is worth. Each defect goes
   back in the shape it would really arrive in: someone tidying away
   a branch that "looks like dead code", someone simplifying a match,
   and someone writing one more direct comparison. */
console.log('\n── the resolver\'s counter-checks');
{
  const one = ROWS[0];
  const resolverCases = [
    { what: 'the legacy name branch is tidied away as dead code',
      from: "  const m = /^(.*?)\\s+((?:19|20)\\d\\d)$/.exec(ref);",
      to:   "  if (true) return null;\n  const m = /^(.*?)\\s+((?:19|20)\\d\\d)$/.exec(ref);",
      ask:  win => (win.eval('wineByRef(' + JSON.stringify(one.name) + ')') || {}).id === one.id,
      says: 'a name still resolves — the readers would have been narrowed before the references moved' },

    { what: 'the vintage stops binding',
      from: "return rows.find(r => r.name === name && (vintage === null || r.vintage === vintage)) || null;",
      to:   "return rows.find(r => r.name === name) || null;",
      /* `ask` always states what SECTION 5 claims, so a true answer
         means the section still passes and the defect got through. */
      ask:  win => win.eval('wineByRef(' + JSON.stringify(one.name + ' ' + (one.vintage + 1)) + ') === null'),
      says: 'a reference to a vintage nobody carries still resolves to nothing' },

    { what: 'a join site goes back to comparing names',
      from: "const taken = !!wineByRef(w, currentWinePortfolio);",
      to:   "const taken = currentWinePortfolio.some(cw => cw.winery === w.winery && cw.name === w.name);",
      ask:  null,   /* source-level: checked by re-running the scan below */
      says: 'a direct name comparison outside the resolver' }
  ];

  resolverCases.forEach(c => {
    const win = build({ from: c.from, to: c.to });
    if (!win) return bad('"' + c.what + '" never applied — the check below proves nothing');
    if (c.ask === null) {
      /* Section 6 reads the file, so this one is proved against the
         patched TEXT rather than the patched window. */
      const patched = loadDashboard().html.replace(c.from, c.to);
      const JOIN = /(\.name|\.wine|wineName|\.product)(?!\w)\s*(===|!==)\s*|(===|!==)\s*(\w+\.name|\w+\.wine|wineName|productName|\w+\.product)(?![\w.])/;
      const outside = patched.split('\n')
        .filter(l => !/^\s*(\/\*|\*|\/\/)/.test(l) && JOIN.test(l) && !/rows\.find/.test(l));
      if (outside.length) ok('caught: ' + c.what + ' → ' + outside.length + ' comparison(s) outside wineByRef()');
      else bad('NOT caught: ' + c.what + ' — the scan in section 6 does not see it');
      return;
    }
    if (c.ask(win)) bad('NOT caught: ' + c.what + ' — ' + c.says + ', and nothing said so');
    else ok('caught: ' + c.what);
  });
}

/* ── 6c. The order side names keys (pass 3a) ─────────────────────
   `order_items.product_id` is a reference and never a copy
   (invariant 2). Until this pass a line carried `wine` and `winery`
   as strings, which is how an order came to credit a producer the
   seller's book disagreed with — the break that started this chain.
   With a key there is one answer, so the contradiction cannot be
   written down at all. */
console.log('\n── order lines and prices name products, not strings');
{
  const lines = J('orders').flatMap(o => (o.items || []).map(i => ({ o: o.id, i })));
  const noKey  = lines.filter(x => !x.i.productId);
  const unres  = lines.filter(x => x.i.productId && !ROWS.some(r => r.id === x.i.productId));
  const copies = lines.filter(x => 'wine' in x.i || 'winery' in x.i);

  if (!lines.length) bad('no order lines at all — this section examined nothing');
  else if (noKey.length) bad(noKey.length + ' of ' + lines.length + ' order line(s) name no product: ' +
      noKey.map(x => x.o).join(' · '));
  else if (unres.length) bad(unres.length + ' order line(s) name a key no book carries: ' +
      unres.map(x => x.o + ' → ' + x.i.productId).join(' · '));
  else if (copies.length) bad(copies.length + ' order line(s) copy product content back onto the line: ' +
      copies.map(x => x.o).join(' · ') + ' — invariant 2, and the producer drift comes back with it');
  else ok(lines.length + ' order lines across ' + J('orders').length +
      ' orders, every one naming a product that exists and none carrying a copy of it');

  const prices = J('wineUnitPrice');
  const keys = Object.keys(prices);
  const byName = keys.filter(k => !ID_SHAPE.test(k));
  const dangling = keys.filter(k => ID_SHAPE.test(k) && !ROWS.some(r => r.id === k));
  if (!keys.length) bad('the price table is empty — this check examined nothing');
  else if (byName.length) bad(byName.length + ' price entr(ies) are still keyed by name: ' + byName.join(' · '));
  else if (dangling.length) bad(dangling.length + ' price key(s) name no product: ' + dangling.join(' · '));
  else ok(keys.length + ' trade prices, every one keyed by a product that exists');
}

/* ── 6c-2. The show surface names keys (pass 3b) ─────────────────
   A16.9 always said a show product and an interest are REFERENCES
   into a producer's range. They stored that reference as
   "<name> <vintage>", which is the second spelling every join had to
   bridge. What made it impossible to leave alone is that SEVENTEEN
   public pages render those references and none of them loads the
   dashboard, where the catalogue lived — so the catalogue and the
   resolver moved into the shared asset with this pass. A name renders
   without being resolved; a key does not. */
console.log('\n── show products and interests name products');
{
  const shows = J('wineShows');
  const prods = shows.flatMap(s => (s.exhibitors || []).flatMap(x =>
    (x.products || []).map(p => ({ s: s.id, who: x.producer, p }))));
  const ints  = shows.flatMap(s => (s.interests || []).map(i => ({ s: s.id, i })));
  const known = new Set(ROWS.map(r => r.id));

  const pNoKey = prods.filter(x => !x.p.productId);
  const pDead  = prods.filter(x => x.p.productId && !known.has(x.p.productId));
  const pCopy  = prods.filter(x => 'name' in x.p);
  const iNoKey = ints.filter(x => !x.i.productId);
  const iDead  = ints.filter(x => x.i.productId && !known.has(x.i.productId));
  const iCopy  = ints.filter(x => 'product' in x.i);

  if (!prods.length || !ints.length)
    bad('no show products or no interests — this section examined nothing');
  else if (pNoKey.length || iNoKey.length)
    bad((pNoKey.length + iNoKey.length) + ' show reference(s) name no product: ' +
        pNoKey.concat(iNoKey).map(x => x.s).join(' · '));
  else if (pDead.length || iDead.length)
    bad((pDead.length + iDead.length) + ' show reference(s) name a key no book carries: ' +
        pDead.map(x => x.s + ' → ' + x.p.productId).concat(iDead.map(x => x.s + ' → ' + x.i.productId)).join(' · '));
  else if (pCopy.length || iCopy.length)
    bad((pCopy.length + iCopy.length) + ' show reference(s) keep a copy of the product name beside the key: ' +
        pCopy.concat(iCopy).map(x => x.s).join(' · ') + ' — A16.9, and the second spelling comes back with it');
  else
    ok(prods.length + ' show products and ' + ints.length + ' interests across ' + shows.length +
       ' shows, every one naming a product that exists and none carrying a copy of its name');

  /* THE LABEL IS THE RECORD'S. Not a frozen list of expected strings —
     that would pass while a surface quietly built its own. Every
     rendered show label has to BE wineLabel() of the product it
     refers to, so a second composition anywhere disagrees here. */
  const wrong = prods.filter(x =>
    w.eval('showProductLabel(' + JSON.stringify(x.p) + ')') !== w.eval('wineLabel(' + JSON.stringify(x.p.productId) + ')'));
  if (wrong.length) bad(wrong.length + ' show product(s) label differently from their record');
  else ok('and every show label is the product record\'s own, composed in one place');
}

/* ── 6c-3. The commercial records name products (pass 3c) ────────
   Promos, offers and deals were the last holders of a wine name, and
   the resolver had been bridging it — `dealFreeGoodsFor()` matched a
   deal's `wineName` against an order line's key and still answered
   correctly, which is exactly the kind of quiet success that survives
   until the bridge is removed in pass 4.

   `winery` is gone from offers and deals with the same reasoning as
   on an order line: it was a copy of the producer, and the buyer's
   row derives it now. */
console.log('\n── promos, offers and deals name products');
{
  const known = new Set(ROWS.map(r => r.id));
  const rec = [];
  J('promoMaterials').forEach(m => rec.push(['promo #' + m.id, m.productId, m]));
  J('exclusiveOffers').forEach(o => rec.push(['offer #' + o.id, o.productId, o]));
  J('exclusiveDeals').forEach(d => (d.productIds || [undefined]).forEach(x => rec.push(['deal #' + d.id, x, d])));

  const noKey = rec.filter(r => !r[1] && !('condType' in r[2] && r[2].condType === 'ordervalue'));
  const dead  = rec.filter(r => r[1] && !known.has(r[1]));
  const copy  = rec.filter(r => 'wineName' in r[2] || 'wineNames' in r[2] || 'winery' in r[2]);

  if (!rec.length) bad('no commercial records at all — this section examined nothing');
  else if (noKey.length) bad(noKey.length + ' commercial record(s) name no product: ' + noKey.map(r => r[0]).join(' · '));
  else if (dead.length) bad(dead.length + ' commercial record(s) name a key no book carries: ' +
      dead.map(r => r[0] + ' → ' + r[1]).join(' · '));
  else if (copy.length) bad(copy.length + ' commercial record(s) still carry a wine name or a producer: ' +
      copy.map(r => r[0]).join(' · ') + ' — invariant 2, and the drift comes back with it');
  else ok(rec.length + ' commercial references across ' + J('promoMaterials').length + ' promos, ' +
      J('exclusiveOffers').length + ' offers and ' + J('exclusiveDeals').length +
      ' deals, every one naming a product that exists and none carrying a copy of it');

  /* THE TWO DETECTIONS, held by name because that is how Serge reads
     them on screen. Not a frozen string list — computed from the
     records, so it keeps holding as fixtures change. */
  const merlot = J("orders.find(function (o) { return o.id === 'ORD-2037'; })");
  const flag = w.eval("JSON.stringify(dealFreeGoodsFor(orders.find(function (o) { return o.id === 'ORD-2037'; }))" +
    ".map(function (f) { return f.deal.id + ':' + f.discount + ':' + f.basis; }))");
  if (!merlot) bad('ORD-2037 is gone — the threshold check examined nothing');
  else if (JSON.parse(flag).join() !== '1:25:120')
    bad('the 25% threshold on ORD-2037 no longer fires: ' + flag +
        ' — the deal and the order line must resolve to the same product');
  else ok('ORD-2037 still reports deal 1 at 25% on a basis of 120 bottles');

  /* The five tiles, re-derived HERE from the promo condition and the
     buyer's own list and progress — not asked of isPromoUnlocked(),
     which is the function under test, and not frozen as a string,
     which would only record today's fixtures. The two buyers
     legitimately differ on the order-value tile (1450 against 2150),
     and a check that expected them to agree would be asserting a
     coincidence. */
  const promos = J('promoMaterials');
  const sides = [
    { role: 'restaurant', list: J('rCurrentWineList'), prog: J('rPromoProgress') },
    { role: 'retail',     list: J('tCurrentWineSelection'), prog: J('tPromoProgress') }
  ];
  const wrongState = [];
  sides.forEach(side => {
    const onList = id => side.list.some(x => x.id === id);
    promos.forEach(m => {
      let mine;
      if (m.condType === 'ordervalue') mine = side.prog.orderValue >= m.orderValue;
      else if (m.condType === 'newlisting') mine = onList(m.productId);
      else if (m.orderMode === 'single') mine = !!side.prog.singleOrdered[m.id];
      else mine = onList(m.productId) && (side.prog.bottleCounts[m.productId] || 0) >= m.bottlesRequired;
      const theirs = w.eval('isPromoUnlocked(promoMaterials.find(function (x) { return x.id === ' + m.id + '; }), ' +
        (side.role === 'restaurant' ? 'rCurrentWineList, rPromoProgress' : 'tCurrentWineSelection, tPromoProgress') + ')');
      if (mine !== theirs)
        wrongState.push(side.role + '/' + m.name + ': the page says ' + (theirs ? 'unlocked' : 'locked') +
          ', the condition says ' + (mine ? 'unlocked' : 'locked'));
    });
  });
  if (!promos.length) bad('no promo materials — the tile check examined nothing');
  else if (wrongState.length) bad(wrongState.length + ' promo tile(s) disagree with their own condition: ' +
      wrongState.join(' · ') + ' — a key that stopped matching shows up here first');
  else ok((promos.length * 2) + ' promo tiles across both buyers, every one agreeing with its condition ' +
      're-derived from the list and the progress');
}

/* ── 6d. The counter-checks for the order side ───────────────── */
console.log('\n── the order side\'s counter-checks');
{
  const orderCases = [
    { what: 'an order line goes back to naming a string',
      from: "items:[ orderItemRaw('PRD-1025',120,12.60) ] },",
      to:   "items:[ { wine:'Merlot — Bordeaux Supérieur', winery:'Château Belrieu', qty:120, unit:12.60 } ] },",
      ask:  win => J2(win, 'orders').flatMap(o => o.items || []).every(i => i.productId && !('wine' in i)),
      says: 'a line with no key and a copied producer' },

    { what: 'a line keeps the producer as a string beside the key',
      from: "function orderItemRaw(productId, qty, unit) { return { productId, qty, unit }; }",
      to:   "function orderItemRaw(productId, qty, unit) { return { productId, qty, unit, winery:(wineByRef(productId)||{}).winery }; }",
      ask:  win => J2(win, 'orders').flatMap(o => o.items || []).every(i => !('winery' in i)),
      says: 'the copy is back, and with it the two answers to "whose wine is this"' },

    { what: 'a price key goes back to a name',
      from: "'PRD-1015': 17.20,   /* Pouilly-Fumé */",
      to:   "'Pouilly-Fumé': 17.20,",
      ask:  win => Object.keys(J2(win, 'wineUnitPrice')).every(k => ID_SHAPE.test(k)),
      says: 'a price nobody can reach from a line that names a key' },

    { what: 'a show product keeps the name beside the key',
      from: "{ productId:'PRD-1014', proposedBy:'host', status:'confirmed',",
      to:   "{ productId:'PRD-1014', name:'Sancerre Rouge 2022', proposedBy:'host', status:'confirmed',",
      ask:  win => J2(win, 'wineShows').flatMap(s => (s.exhibitors || []).flatMap(x => x.products || []))
              .every(p => !('name' in p)),
      says: 'the second spelling is back on the show surface' },

    { what: 'an interest names a product no book carries',
      from: "{ attendee:'Vinoteca Alster', productId:'PRD-1014',",
      to:   "{ attendee:'Vinoteca Alster', productId:'PRD-9999',",
      ask:  win => {
        const ids = new Set(harvest(win).collections.flatMap(c => c.rows).map(r => r.id));
        return J2(win, 'wineShows').flatMap(s => s.interests || []).every(i => ids.has(i.productId));
      },
      says: 'a line on the order list that resolves to nothing, rendering blank' },

    { what: 'a deal goes back to naming a wine',
      from: "{ id:1, dealType:'discount', productIds:['PRD-1025'], minQty:120, discountPct:25 },",
      to:   "{ id:1, dealType:'discount', wineName:'Merlot — Bordeaux Supérieur', winery:'Château Belrieu', minQty:120, discountPct:25 },",
      ask:  win => J2(win, 'exclusiveDeals').every(d => d.productIds && !('wineName' in d) && !('winery' in d)),
      says: 'the bridge pass 4 removes is being leaned on again' },

    { what: 'a promo names a product outside the distributor\'s book',
      from: "condType:'volume', orderMode:'cumulative', productId:'PRD-1020', bottlesRequired:60 },",
      to:   "condType:'volume', orderMode:'cumulative', productId:'PRD-1017', bottlesRequired:60 },",
      /* Section 6c-3 only asks whether the key exists; this is the
         chain question, and supply-chain.js is where it is answered.
         Asked here as well because the promo modals were the way such
         a record could be created through the interface. */
      ask:  win => {
        const book = new Set(JSON.parse(win.eval("JSON.stringify((portfolioOf('Hawesko GmbH') || []).map(function (x) { return x.id; }))")));
        return J2(win, 'promoMaterials').every(m => !m.productId || book.has(m.productId));
      },
      says: 'a promo condition over a wine the distributor does not carry' },

    { what: 'a price key names a product that does not exist',
      from: "'PRD-1027': 12.10    /* Terra Rossa — the entry that had no record until A3 */",
      to:   "'PRD-9999': 12.10",
      ask:  win => Object.keys(J2(win, 'wineUnitPrice'))
              .every(k => harvest(win).collections.flatMap(c => c.rows).some(r => r.id === k)),
      says: 'the very state A3 was invoked to repair, back again' }
  ];

  orderCases.forEach(c => {
    const win = build({ from: c.from, to: c.to });
    if (!win) return bad('"' + c.what + '" never applied — the check below proves nothing');
    if (c.ask(win)) bad('NOT caught: ' + c.what + ' — ' + c.says + ', and nothing said so');
    else ok('caught: ' + c.what);
  });
}

/* ── 7. Counter-checks ──────────────────────────────────────────
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
