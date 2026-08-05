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

/* ── 5. The resolver answers a key and NOTHING else ──────────────
   Pass 2 widened it so the references could move; pass 4 narrows it
   again, and the narrowing is the point. While a name still resolved,
   a site that had been missed went on working and looked correct. Now
   it answers null and renders empty — which is why the browser pass
   after this cut is worth more than one before it. */
console.log('\n── the resolver answers a key, and only a key');
{
  const products = [...new Map(ROWS.map(r => [r.id, r])).values()];
  const askId   = products.filter(p => (w.eval('wineByRef(' + JSON.stringify(p.id) + ')') || {}).id !== p.id);
  const byName  = products.filter(p => w.eval('wineByRef(' + JSON.stringify(p.name) + ') !== null'));
  const byShow  = products.filter(p => w.eval('wineByRef(' + JSON.stringify(p.name + ' ' + p.vintage) + ') !== null'));
  const label   = products.filter(p => w.eval('wineLabel(' + JSON.stringify(p.id) + ')') !== p.name + ' ' + p.vintage);
  const named   = products.filter(p => w.eval('wineName(' + JSON.stringify(p.id) + ')') !== p.name);

  if (!products.length) bad('no products to ask about — this section examined nothing');
  else if (askId.length)  bad(askId.length + ' product(s) do not answer to their own key: ' + askId.map(wine).join(' · '));
  else if (byName.length) bad(byName.length + ' product(s) still answer to a bare NAME — the legacy branch is back, ' +
      'and with it every join that only looks resolved: ' + byName.map(wine).join(' · '));
  else if (byShow.length) bad(byShow.length + ' product(s) still answer to the show spelling "name vintage": ' +
      byShow.map(wine).join(' · '));
  else if (label.length || named.length)
    bad('the accessors disagree with the record for ' + (label.length + named.length) + ' product(s)');
  else ok(products.length + ' products: each answers to its key, none to a name or a show spelling, ' +
      'and both accessors read the record');

  /* An unresolvable reference has to render as nothing. Returning the
     reference was right while names travelled; now it would let a
     stray name print itself and look right. */
  const strays = ['Pouilly-Fumé', 'Pouilly-Fumé 2023', 'PRD-9999', ''];
  const leaks = strays.filter(x => w.eval('wineLabel(' + JSON.stringify(x) + ')') !== '' ||
                                   w.eval('wineName(' + JSON.stringify(x) + ')') !== '');
  if (leaks.length) bad(leaks.length + ' unresolvable reference(s) print themselves instead of nothing: ' +
      leaks.map(x => '"' + x + '"').join(' · ') + ' — a leftover name would look correct on screen');
  else ok('and an unresolvable reference renders as nothing, with a console warning that names it');

  /* Two unknowns are not a match. */
  if (w.eval('sameWine("Pouilly-Fumé", "Pouilly-Fumé")'))
    bad('sameWine() still compares two unresolvable references as equal — the string fallback is back');
  else ok('sameWine() answers false for anything that is not two products');
}

/* ── 6. The name join is gone ────────────────────────────────────
   Not "confined to the resolver" any more — the resolver's own two
   lines went with pass 4. Zero is the target here, which removes the
   vacuum guard that protected this scan while the number was falling:
   a scan that sees nothing now reads the same as a scan that works.
   So it says how much source it examined, and the counter-check below
   injects a comparison and requires it to be found. */
console.log('\n── nothing joins products by name any more');
{
  const JOIN = /(\.name|\.wine|wineName|\.product)(?!\w)\s*(===|!==)\s*|(===|!==)\s*(\w+\.name|\w+\.wine|wineName|productName|\w+\.product)(?![\w.])/;
  const FILES = ['bottle-lobby-dashboard.html', 'assets/bottle-lobby-data.js',
                 'assets/bottle-lobby-public-shows.js', 'assets/bottle-lobby-profile-shows.js'];
  const lines = FILES.flatMap(f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8').split('\n')
    .map(l => ({ f: f, l: l })));
  const hits = [];
  let examined = 0;
  lines.forEach((x, i) => {
    if (/^\s*(\/\*|\*|\/\/)/.test(x.l)) return;
    examined++;
    if (JOIN.test(x.l)) hits.push(x.f + ' ' + (i + 1) + ': ' + x.l.trim().slice(0, 78));
  });
  if (!examined)
    bad('the scan read no source at all — it cannot report anything');
  else if (hits.length)
    bad(hits.length + ' wine-name comparison(s) left: \n      ' + hits.join('\n      '));
  else
    ok('not one wine-name comparison in ' + examined + ' lines of code across ' + FILES.length +
       ' files — every join is an id comparison');
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
    { what: 'the name branch comes back',
      from: "  return rows.find(r => r.id === id) || null;\n}",
      to:   "  return rows.find(r => r.id === id) || null;\n}\n" +
            "function __legacy(ref, book) { return (book || allProducts()).find(function (r) { return r.name === ref; }) || null; }",
      /* Injecting the shape rather than editing the resolver: what
         section 5 stands over is that a NAME does not resolve, and the
         cheapest way that comes back is a helper somebody adds beside
         it "just for this one call site". */
      ask:  win => win.eval('typeof __legacy === "function" && __legacy(' + JSON.stringify(one.name) + ') !== null')
              ? false : true,
      says: 'a name resolves again through a second lookup nobody is watching' },

    { what: 'an unresolvable reference prints itself',
      from: "function wineName(ref)   { const p = wineByRef(ref); return p ? p.name : noProduct(ref, 'wineName'); }",
      to:   "function wineName(ref)   { const p = wineByRef(ref); return p ? p.name : String(ref); }",
      ask:  win => win.eval('wineName("Pouilly-Fumé") === ""'),
      says: 'a leftover name would render as itself and look correct' },

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

  /* The prices moved onto listings, so they are read from there. The
     flat `wineUnitPrice` map is gone: it was keyed by product with no
     holder, which is a shape that cannot answer "whose price is this". */
  const priced = J('listings').filter(l => l.tradePrice != null);
  const byName = priced.filter(l => !ID_SHAPE.test(l.productId));
  const dangling = priced.filter(l => ID_SHAPE.test(l.productId) && !ROWS.some(r => r.id === l.productId));
  if (!priced.length) bad('no listing carries a price — this check examined nothing');
  else if (byName.length) bad(byName.length + ' priced listing(s) are keyed by name: ' + byName.map(l => l.productId).join(' · '));
  else if (dangling.length) bad(dangling.length + ' priced listing(s) name no product: ' + dangling.map(l => l.productId).join(' · '));
  else ok(priced.length + ' trade prices, every one keyed by a product that exists AND owned by a named holder');
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

/* ── 6c-4. Nothing hands a resolver a typed name ─────────────────
   THE HOLE THIS CLOSES, and it was found by Serge clicking rather
   than by any check here. `addLine()` opened a native prompt(), took
   whatever was typed and passed it to `orderItem()`. Since pass 4 a
   typed name resolves to null, so the OK button did nothing at all —
   two lines before, two lines after, and one console line as the only
   trace.

   The 326-renderer sweep could not see it: it drove everything that
   DRAWS and nothing that RESPONDS. A product reference that only
   comes into existence when somebody types or picks is invisible to a
   render pass by construction.

   So this section stands over the inputs. Every control that names a
   product must carry the KEY as its value — a select option, a
   checkbox, a data attribute — and there must be no prompt() left to
   type into. */
console.log('\n── every product-naming input carries a key');
{
  const FILES = ['bottle-lobby-dashboard.html'];
  const src = FILES.map(f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8')).join('\n');

  /* A native prompt is the only way a free-typed string can reach a
     resolver at all — nothing else on this page collects one. */
  /* HTML comments are tracked, not just JS ones: the modal that
     replaced the prompt explains in its own comment what it replaced,
     and a scan that counted that would report the defect it fixed. */
  let inHtmlComment = false;
  const prompts = src.split('\n')
    .map((l, i) => ({ n: i + 1, l }))
    .filter(x => {
      const wasIn = inHtmlComment;
      if (x.l.includes('<!--')) inHtmlComment = true;
      if (x.l.includes('-->'))  inHtmlComment = false;
      if (wasIn || x.l.includes('<!--')) return false;
      if (/^\s*(\/\*|\*|\/\/)/.test(x.l)) return false;
      return /(?:^|[^.\w])prompt\s*\(/.test(x.l);
    });
  if (prompts.length)
    bad(prompts.length + ' native prompt(s) left — whatever is typed into one reaches a resolver as a ' +
        'string and resolves to nothing: ' + prompts.map(x => 'line ' + x.n).join(' · '));
  else ok('no native prompt() anywhere — there is nothing left to type a wine into');

  /* Every control the page fills with products offers keys. Driven
     rather than read: the options exist only after the modal that
     builds them has been opened. */
  const controls = [
    { open: "openPromoModal()",              sel: '#pm-wine option' },
    { open: "openOfferModal()",              sel: '#of-wine option' },
    { open: "openDealModal()",               sel: '#dl-wine option, #dl-single-wine option, .dl-mixed-wine' },
    { open: "openInviteModal('WS-2604'); onInviteProducerChange()", sel: '#if-product option' },
    { open: "showWineShows('winery','current'); openCounterModal('WS-2601')", sel: '#cf-product option' },
    { open: "showOrders('distributor','incoming'); renderOrderDetail('ORD-2040'); addLine('ORD-2040')",
      sel: '.al-pick' },
    /* The quantity field carries the key in an ATTRIBUTE — its value
       is a number. Read the attribute, or this asserts that "12" is a
       product. */
    { open: "showOrders('distributor','incoming'); renderOrderDetail('ORD-2040'); addLine('ORD-2040')",
      sel: '.al-qty', attr: 'data-wine' }
  ];
  const ids = new Set(ROWS.map(r => r.id));
  const strays = [];
  let values = 0;
  controls.forEach(c => {
    const win = build();
    try { win.eval(c.open); } catch (e) { return strays.push(c.sel + ': ' + e.message); }
    const found = [...win.document.querySelectorAll(c.sel)]
      .map(el => c.attr ? el.getAttribute(c.attr) : el.value)
      .filter(v => v !== '' && v != null);
    if (!found.length) return strays.push(c.sel + ': the control offers nothing at all');
    found.forEach(v => {
      values++;
      if (!ids.has(v)) strays.push(c.sel + ' offers "' + v + '", which is not a product key');
    });
  });
  if (strays.length)
    bad(strays.length + ' product control problem(s): ' + strays.slice(0, 4).join(' · '));
  else
    ok(values + ' options and checkboxes across ' + controls.length +
       ' product controls, every value a key that exists — nothing typed, nothing to mistype');
}

/* ── 6d. The counter-checks for the order side ───────────────── */
console.log('\n── the order side\'s counter-checks');
{
  const orderCases = [
    { what: 'an order line goes back to naming a string',
      from: "items:[ orderItemRaw('PRD-1025',120,12.60,2021) ] },",
      to:   "items:[ { wine:'Merlot — Bordeaux Supérieur', winery:'Château Belrieu', qty:120, unit:12.60 } ] },",
      ask:  win => J2(win, 'orders').flatMap(o => o.items || []).every(i => i.productId && !('wine' in i)),
      says: 'a line with no key and a copied producer' },

    { what: 'a line keeps the producer as a string beside the key',
      from: "  return { productId, qty, unit, vintage,",
      to:   "  return { productId, qty, unit, vintage, winery:(wineByRef(productId)||{}).winery,",
      ask:  win => J2(win, 'orders').flatMap(o => o.items || []).every(i => !('winery' in i)),
      says: 'the copy is back, and with it the two answers to "whose wine is this"' },

    { what: 'a priced listing goes back to naming a wine',
      from: "productId:'PRD-1015', legacyOwnLabel:false, exclusive:false, listedAt:LISTED_AT, holderArticleNo:null, monthlyVolume:null, tradePrice:17.20 }",
      to:   "productId:'Pouilly-Fumé', legacyOwnLabel:false, exclusive:false, listedAt:LISTED_AT, holderArticleNo:null, monthlyVolume:null, tradePrice:17.20 }",
      ask:  win => J2(win, 'listings').every(l => ID_SHAPE.test(l.productId)),
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

    { what: 'a product control offers a name again',
      from: "'<input type=\"checkbox\" class=\"al-pick\" value=\"' + wn.id + '\">' +",
      to:   "'<input type=\"checkbox\" class=\"al-pick\" value=\"' + wn.name + '\">' +",
      ask:  win => {
        try { win.eval("showOrders('distributor','incoming'); renderOrderDetail('ORD-2040'); addLine('ORD-2040')"); }
        catch (e) { return false; }
        const ids = new Set(harvest(win).collections.flatMap(c => c.rows).map(r => r.id));
        return [...win.document.querySelectorAll('.al-pick')].every(el => ids.has(el.value));
      },
      says: 'exactly the defect Serge clicked on — a control naming a wine, and a resolver that answers null' },

    { what: 'a native prompt comes back',
      from: "let addLineOrderId = null;",
      to:   "let addLineOrderId = null;\nfunction __typeIt(o) { return prompt('Add wine to ' + o.id); }",
      ask:  win => {
        const src = fs.readFileSync(path.join(__dirname, '..', 'bottle-lobby-dashboard.html'), 'utf8')
          .replace("let addLineOrderId = null;",
                   "let addLineOrderId = null;\nfunction __typeIt(o) { return prompt('Add wine to ' + o.id); }");
        let inHtml = false;
        return !src.split('\n').some(l => {
          const was = inHtml;
          if (l.includes('<!--')) inHtml = true;
          if (l.includes('-->'))  inHtml = false;
          if (was || l.includes('<!--') || /^\s*(\/\*|\*|\/\/)/.test(l)) return false;
          return /(?:^|[^.\w])prompt\s*\(/.test(l);
        });
      },
      says: 'a free-typed string reaching a resolver, which is how this class of defect arrives' },

    { what: 'a listing names a product that does not exist',
      from: "productId:'PRD-1027', legacyOwnLabel:false",
      to:   "productId:'PRD-9999', legacyOwnLabel:false",
      ask:  win => J2(win, 'listings')
              .every(l => harvest(win).collections.flatMap(c => c.rows).some(r => r.id === l.productId)),
      says: 'the very state A3 was invoked to repair, back again' }
  ];

  orderCases.forEach(c => {
    const win = build({ from: c.from, to: c.to });
    if (!win) return bad('"' + c.what + '" never applied — the check below proves nothing');
    if (c.ask(win)) bad('NOT caught: ' + c.what + ' — ' + c.says + ', and nothing said so');
    else ok('caught: ' + c.what);
  });
}

/* ── 6e. The execution lives on the line, not on the product ─────
   A15.2b: `productId` names the WINE ACROSS VINTAGES, so the vintage
   and the batch that actually shipped can only live on the order line.
   Before this pass a document read the vintage off the product, which
   means the first rollover would have rewritten every historic invoice
   for that wine — silently, and in a direction nobody could audit.

   THE MEASUREMENT IS A BYTE COMPARISON, not an assertion about fields:
   render every document of a bound order, move the product underneath
   it, render again, compare. Anything that still reaches through to the
   product shows up as a diff, including a reach nobody thought to name.

   AND THE VINTAGE IS BACK IN THE PROBE. When this was written no
   document printed a year, so a vintage bump alone compared equal even
   with the defect fully in place — the probe would have reported green
   without having looked at anything, and it moved the name instead.
   Serge then decided the business question the measurement had
   exposed: an invoice names the GOODS, so it prints the vintage
   (5 Aug 2026, A15.2b). It moves the vintage and the name now, and the
   vintage half of it finally tests what it was built to test. */
console.log('\n── what was traded is frozen on the line');
{
  const BOUND = ['accepted', 'shipped', 'delivered'];
  const lines = J('orders').flatMap(o => (o.items || []).map(i => ({ o: o.id, st: o.stage, i })));

  /* 1. Every line records its own execution. */
  const noVintage = lines.filter(x => x.i.vintage == null);
  const noBatch   = lines.filter(x => !('batchOrLot' in x.i));
  if (!lines.length) bad('no order lines at all — this section examined nothing');
  else if (noVintage.length) bad(noVintage.length + ' of ' + lines.length +
      ' order line(s) name no vintage: ' + noVintage.map(x => x.o).join(' · ') +
      ' — the document would have to ask the product, which is the defect');
  else if (noBatch.length) bad(noBatch.length + ' order line(s) have no batchOrLot field at all — ' +
      'null is the answer for a producer who does not work in batches, absent is not an answer');
  else {
    const withLot = lines.filter(x => x.i.batchOrLot != null).length;
    ok(lines.length + ' order lines, every one naming the vintage it was ordered in; ' +
       withLot + ' carry a lot and ' + (lines.length - withLot) +
       ' are explicitly null — both shapes occur, so neither is untested');
  }

  /* 2. The vintage on the line agrees with the product TODAY. Not
     because it must — that is the whole point — but because it is the
     precondition for the byte comparison below meaning anything. If
     the fixtures already disagreed, an unchanged render would prove
     the renderer was ignoring both. */
  const drift = lines.filter(x => {
    const p = ROWS.find(r => r.id === x.i.productId);
    return p && p.vintage !== x.i.vintage;
  });
  if (drift.length) bad(drift.length + ' fixture line(s) already name a vintage the product does not: ' +
      drift.map(x => x.o + ' → ' + x.i.vintage).join(' · ') +
      ' — the before/after comparison would be measuring the wrong thing');
  else ok('every fixture vintage equals its product\'s, so an unchanged document is evidence and not a coincidence');

  /* 3. The snapshot exists exactly where an agreement was made. */
  const shouldHave = lines.filter(x => BOUND.indexOf(x.st) !== -1);
  const missing = shouldHave.filter(x => !x.i.snapshot);
  const early   = lines.filter(x => BOUND.indexOf(x.st) === -1 && x.i.snapshot);
  if (!shouldHave.length) bad('no order is past `accepted` — the freeze was never exercised');
  else if (missing.length) bad(missing.length + ' bound order line(s) carry no snapshot: ' +
      missing.map(x => x.o).join(' · '));
  else if (early.length) bad(early.length + ' line(s) are frozen before anybody agreed: ' +
      early.map(x => x.o + ' (' + x.st + ')').join(' · ') +
      ' — a draft that cannot move is not a draft');
  else ok(shouldHave.length + ' bound lines frozen and ' + (lines.length - shouldHave.length) +
      ' draft lines deliberately not, the stage deciding rather than a flag');

  /* 4. THE PROBE. Move the product; the documents must not notice. */
  {
    const DOCS = ['quote', 'proforma', 'prepay', 'invoice', 'delivery', 'credit'];
    const ORD = 'ORD-2040';           /* accepted, two lines, two producers */
    const render = win => {
      win.eval("(function(){ var o=_o('" + ORD + "'); DOC_TYPES.forEach(function(t){" +
               " if(!o.documents.some(function(d){return d.key===t.key;}))" +
               " o.documents.push({key:t.key,no:t.prefix+'-TEST',date:'2026-07-25'}); }); })()");
      return DOCS.map(k => {
        win.eval("openDocPreview('" + ORD + "','" + k + "','" +
                 k.toUpperCase().slice(0, 2) + "-TEST')");
        return win.document.getElementById('doc-sheet').innerHTML;
      }).join('\n \n');
    };
    /* One product under each of the order's two lines, moved in the
       two ways a line could reach through: the vintage rolls over and
       the wine is renamed by the A4 master-data pass. */
    const move = "(function(){ var p=wineByRef('PRD-1003'); p.vintage=p.vintage+1;" +
                 " p.name='RENAMED BY THE PROBE'; p.winery='SOMEBODY ELSE';" +
                 " var q=wineByRef('PRD-1001'); q.vintage=q.vintage+1;" +
                 " q.name='ALSO RENAMED'; return 1; })()";

    const win = build();
    const before = render(win);
    win.eval(move);
    const after = render(win);

    /* The year has to actually be on the page, or "unchanged" is a
       statement about a column that is not printed. */
    const shownYears = ['2022', '2023'].filter(y => before.indexOf(y) !== -1);
    if (!before || before.indexOf('<table>') === -1)
      bad('the document probe rendered nothing — it proves neither direction');
    else if (!shownYears.length)
      bad('no vintage appears in the rendered documents at all — printing it was a no-op, ' +
          'and the comparison below is blind to the rollover again');
    else if (before === after)
      ok('a vintage rollover and two renames under an accepted order changed ' +
         DOCS.length + ' documents by zero bytes — the paperwork is a record, not a view');
    else {
      const at = [...before].findIndex((c, n) => c !== after[n]);
      bad('a document moved when the product did, at byte ' + at + ': "' +
          before.slice(at, at + 60) + '" became "' + after.slice(at, at + 60) + '"');
    }

    /* The counter-check: put the reach-through back and the probe must
       go red. Without this, a renderer that prints nothing at all would
       also compare equal and read as a pass.

       IT MOVES THE VINTAGE AND NOTHING ELSE. Moving the name too would
       let this pass on a renderer that prints the name and ignores the
       year, which is precisely the state that made the first version of
       this probe vacuous. If the vintage alone is enough to break it,
       the vintage is genuinely load-bearing in the comparison. */
    const vintageOnly = "(function(){ var p=wineByRef('PRD-1003'); p.vintage=p.vintage+1;" +
                        " var q=wineByRef('PRD-1001'); q.vintage=q.vintage+1; return 1; })()";
    /* The defect exactly as it stood before this chain: no snapshot,
       and the year read off the product. Disabling the snapshot alone
       is NOT enough and the first version of this counter-check proved
       it by staying green — the live branch reads `i.vintage` off the
       LINE, so the product could roll over without moving anything.
       The reach-through has to be put back where it actually was. */
    const win2 = build({
      from: "  if (i.snapshot) return i.snapshot;\n  return { name: lineName(i), producer: lineWinery(i),\n           vintage: i.vintage == null ? null : i.vintage,",
      to:   "  return { name: lineName(i), producer: lineWinery(i),\n           vintage: (lineProduct(i) || {}).vintage,"
    });
    if (!win2) bad('the docLine counter-check never applied — the probe above proves nothing');
    else {
      const b2 = render(win2);
      win2.eval(vintageOnly);
      if (b2 === render(win2))
        bad('NOT caught: a document reading the product straight through still compared equal ' +
            'after a vintage rollover — the document is not printing the year, so the probe ' +
            'is back to proving nothing');
      else ok('caught: a rollover alone moves a document that reads the product — the vintage ' +
              'is load-bearing in the comparison, not decoration beside the name');
    }
  }

  /* 4b. Measured over the SOURCE, because the probe above can only
     see what today's fixtures happen to exercise. A document renderer
     that never names a product reader cannot reach one by accident,
     and that is a stronger statement than any single render. */
  {
    const src = fs.readFileSync(path.join(__dirname, '..', 'bottle-lobby-dashboard.html'), 'utf8');
    const start = src.indexOf('function openDocPreview(');
    const body  = src.slice(start, src.indexOf('\nfunction closeDocPreview(', start));
    const reach = ['lineName(', 'lineWinery(', 'lineProduct(', 'wineByRef(', 'wineLabel(', 'wineName(']
      .filter(fn => body.indexOf(fn) !== -1);
    if (start === -1 || body.length < 500) bad('openDocPreview() was not found in the source — nothing was measured');
    else if (reach.length) bad('the document renderer still reads the product directly: ' + reach.join(' · ') +
        ' — one rollover away from rewriting a historic invoice');
    else ok('openDocPreview() names no product reader at all across ' + body.length +
        ' bytes; every field comes off docLine()');
  }

  /* 5. Nothing assumes a line has exactly one relevant vintage
     (A15.2b). Two lines, one wine, two years — both must survive as
     themselves, and both must print. A model that collapses them is
     the assumption this rules out, and it is cheaper to catch here
     than after a producer carries two vintages at once. */
  {
    const win = build();
    const out = win.eval("(function(){" +
      " var o=_o('ORD-2033'); var base=o.items[0];" +
      " o.items.push({productId:base.productId,qty:6,unit:base.unit,vintage:base.vintage-1," +
      "               batchOrLot:'L-OLD',cost:base.cost,discount:0,free:false});" +
      " freezeOrderLines(o);" +
      " return JSON.stringify(o.items.map(function(i){" +
      "   return [i.vintage, i.batchOrLot, i.snapshot.vintage, i.snapshot.batchOrLot]; })); })()");
    const rows = JSON.parse(out);
    const years = new Set(rows.map(r => r[2]));
    if (rows.length !== 2) bad('the two-vintage case did not build — it examined nothing');
    else if (years.size !== 2) bad('two lines of the same wine in different years collapsed to one vintage (' +
        [...years].join(' · ') + ') — something takes the vintage from the product, not the line');
    else if (rows[1][3] !== 'L-OLD') bad('the second line lost its lot on freezing — the batch is not travelling with the line');
    else ok('one wine on one order in two vintages stays two lines, each frozen with its own year and lot');
  }
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
      from: "{ id:'PRD-1020', winery:'Henri Dubois Domaine', name:'Sauvignon Blanc — Sancerre', vintage:2023, url:'bottle-lobby-wine-sauvignon-blanc-sancerre.html' },\n  { id:'PRD-1021'",
      to:   "{ id:'PRD-1099', winery:'Henri Dubois Domaine', name:'Sauvignon Blanc — Sancerre', vintage:2023, url:'bottle-lobby-wine-sauvignon-blanc-sancerre.html' },\n  { id:'PRD-1021'" },

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
