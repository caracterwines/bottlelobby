/* ═══════════════════════════════════════════════════════════════════
   A LISTING IS A RELATION, NOT A WINE (A1, A3, A15.2b, A17.8)

   WHY THIS FILE EXISTS. Three wine lists in this prototype each carried
   four fields of copied wine content — winery, name, vintage, url —
   beside the one or two facts that actually belonged to the house
   holding them. Invariant 2 forbids the copy outright, and the copy is
   what made three surfaces able to disagree about the same bottle.

   What is left once the wine content goes back to the catalogue is a
   RELATION: one row per (holder, wine line), saying what this party
   holds true about that line and nothing else. The key is
   (holder, productId) — never a name, never a vintage, because an
   exclusivity and an own label follow a LINE across harvests (A15.2b)
   and a key with a year in it would have to be re-made every autumn.

   THE PRICE IS THE PROOF THAT THE ROW WAS NEEDED. `wineUnitPrice` was a
   flat map from key to number with no owner. A trade price is never a
   property of a wine — it is what ONE PARTY charges for it. Hawesko
   buys Primitivo at 6.40 and sells it at 11.20; both numbers are
   written into the order fixtures, and the map could hold at most one
   of them. Section 4 below asserts that both are now reachable at once,
   because that is the capability the old shape made impossible.

   AND IT CARRIES ONE PIECE OF DEBT THAT CLOSES ITSELF. `legacyOwnLabel`
   is a migration bridge, not the domain field: A17 derives own-label
   status from a project past gate 2, a product the winery created and a
   first commercial order delivered. None of that exists yet. Section 6
   is a check that is GREEN TODAY and goes red the moment the first
   A17 project record appears without the bridge being torn out — a
   comment gets skimmed and a debt list does not get read, so the debt
   is written as an assertion instead.
═══════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { loadDashboard } = require('./load-dashboard');

let fail = 0;
const bad = m => { console.log('  ✗ ' + m); fail++; };
const ok  = m => console.log('  ✓ ' + m);

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
  win.scrollTo = () => {}; win.confirm = () => true; win.showToast = () => {};
  if (errs.length) { console.log('SCRIPT ERRORS:\n' + errs.join('\n')); process.exit(1); }
  return win;
}

const w = build();
const J2 = (win, name) => JSON.parse(win.eval('JSON.stringify(' + name + ')'));
const J = name => J2(w, name);
const SRC = fs.readFileSync(path.join(__dirname, '..', 'bottle-lobby-dashboard.html'), 'utf8');

/* Source lines with the COMMENTS BLANKED OUT, line numbers preserved.

   The first version of the two scans below matched on raw lines and
   reported four "reads" of `legacyOwnLabel` that were all prose inside
   the block comment explaining the bridge. A scan that cannot tell code
   from the paragraph describing it will be switched off by whoever
   trips over it next, which is worse than not having it.

   `//` is only honoured at the start of a trimmed line, so a `https://`
   inside a string cannot swallow the rest of it. */
function codeLines(src) {
  const out = [];
  let inBlock = false;
  src.split('\n').forEach((raw, i) => {
    let line = '', j = 0;
    if (!inBlock && raw.trim().indexOf('//') === 0) { out.push({ line: '', n: i + 1 }); return; }
    while (j < raw.length) {
      const two = raw.substr(j, 2);
      if (!inBlock && two === '/*') { inBlock = true; j += 2; continue; }
      if (inBlock && two === '*/') { inBlock = false; j += 2; continue; }
      if (!inBlock) line += raw[j];
      j++;
    }
    out.push({ line: line, n: i + 1 });
  });
  return out;
}
const CODE = codeLines(SRC);
const ID_SHAPE = /^PRD-\d{4}$/;
const L = J('listings');

/* ── 1. The row exists, is keyed, and is unique ─────────────────── */
console.log('\n── one row per holder and wine line');
{
  if (!L.length) bad('there are no listings at all — every section below would examine nothing');
  else {
    const noHolder = L.filter(l => typeof l.holder !== 'string' || !l.holder);
    const noKey = L.filter(l => !ID_SHAPE.test(l.productId));
    const seen = new Map();
    const dupes = [];
    L.forEach(l => {
      const k = l.holder + ' | ' + l.productId;
      if (seen.has(k)) dupes.push(k); else seen.set(k, l);
    });
    if (noHolder.length) bad(noHolder.length + ' listing(s) name no holder');
    else if (noKey.length) bad(noKey.length + ' listing(s) do not name a product key: ' +
      noKey.map(l => JSON.stringify(l.productId)).join(' · '));
    else if (dupes.length) bad(dupes.length + ' duplicate (holder, product) key(s): ' + dupes.join(' · ') +
      ' — two rows for one relation is two answers to one question');
    else {
      const holders = [...new Set(L.map(l => l.holder))];
      ok(L.length + ' listings across ' + holders.length + ' holders (' + holders.join(', ') +
         '), every one keyed by (holder, product) and no key twice');
    }
  }
}

/* ── 2. No wine content on the row ──────────────────────────────── */
console.log('\n── a listing carries no wine');
{
  /* Deliberately the four fields the three books each carried, plus
     `ownLabel` — the stored flag A17.12 replaces with a derivation. A
     listing that grows any of them is a copy, and a copy drifts. */
  const FORBIDDEN = ['name', 'winery', 'vintage', 'url', 'type', 'origin', 'ownLabel'];
  const offenders = [];
  L.forEach(l => FORBIDDEN.forEach(f => {
    if (Object.prototype.hasOwnProperty.call(l, f)) offenders.push(l.holder + '/' + l.productId + '.' + f);
  }));
  if (offenders.length) bad(offenders.length + ' listing field(s) copy wine content: ' +
    offenders.slice(0, 6).join(' · ') + ' — invariant 2, and the drift comes back with it');
  else ok('none of the ' + L.length + ' rows carries any of ' + FORBIDDEN.join('/') +
    '; the wine is read from the catalogue every time');

  /* Every listing has to point at a product that exists, or it is a
     relation to nothing. */
  const dangling = L.filter(l => !w.eval('!!wineByRef(' + JSON.stringify(l.productId) + ')'));
  if (dangling.length) bad(dangling.length + ' listing(s) name a product no book carries: ' +
    dangling.map(l => l.holder + '/' + l.productId).join(' · '));
  else ok('every listing resolves to a product record');
}

/* ── 3. The ownerless price map is gone ─────────────────────────── */
console.log('\n── every price has an owner');
{
  const stillThere = w.eval('typeof wineUnitPrice !== "undefined"');
  if (stillThere) bad('`wineUnitPrice` still exists — a price with no holder can only answer ' +
    'one of the two numbers a wine really has');
  else ok('`wineUnitPrice` is gone; there is no way left to ask a price without saying whose');

  const priced = L.filter(l => l.tradePrice != null);
  const negative = priced.filter(l => typeof l.tradePrice !== 'number' || l.tradePrice <= 0);
  if (!priced.length) bad('no listing carries a price — this section examined nothing');
  else if (negative.length) bad(negative.length + ' listing price(s) are not a positive number');
  else ok(priced.length + ' of ' + L.length + ' listings quote a price; the other ' +
    (L.length - priced.length) + ' quote none, which is an answer and not a zero');
}

/* ── 4. THE CAPABILITY THE FLAT MAP COULD NOT HAVE ──────────────── */
console.log('\n── one wine, two prices, two owners');
{
  const both = [];
  [...new Set(L.map(l => l.productId))].forEach(id => {
    const rows = L.filter(l => l.productId === id && l.tradePrice != null);
    if (rows.length > 1) both.push({ id, rows });
  });
  if (!both.length)
    bad('no wine is priced by two different holders — the one thing the old map made ' +
        'impossible is not demonstrated anywhere, so nothing here proves the row was needed');
  else {
    const ex = both[0];
    const name = w.eval('wineName(' + JSON.stringify(ex.id) + ')');
    const quotes = ex.rows.map(r => r.holder + ' ' + r.tradePrice.toFixed(2));
    /* Reachable through the reader, not only present in the data —
       a fact nothing can ask for is not a capability. */
    const reads = ex.rows.map(r => w.eval('listingPrice(' + JSON.stringify(r.holder) + ',' +
      JSON.stringify(ex.id) + ')'));
    if (reads.some((v, i) => v !== ex.rows[i].tradePrice))
      bad('listingPrice() does not return what the rows hold for ' + name);
    else if (new Set(reads).size < 2)
      bad(name + ' is priced twice at the same number — that shape fits in the old map too');
    else ok(both.length + ' wine(s) carry more than one price at once, e.g. ' + name + ': ' +
      quotes.join(' vs ') + ', both reachable through listingPrice()');
  }
}

/* ── 4b. And the two directions are asked of the right party ────── */
console.log('\n── a purchase costs what the producer charges');
{
  /* The visible consequence of giving the price an owner. This read
     `wineUnitPrice` — Hawesko's own SELL price — to price Hawesko's
     PURCHASE order to Cantina Rossi, so a purchase order was costed at
     what the buyer charges its own customers. With no holder on the
     number there was no way to notice; with one, the question answers
     itself. */
  const cases = [
    { producer: 'Cantina Rossi', id: 'PRD-1022', expect: 6.40, wrong: 11.20 },
    { producer: 'Cantina Rossi', id: 'PRD-1003', expect: 5.90, wrong: 9.80 }
  ];
  const faults = [];
  cases.forEach(c => {
    const got = w.eval('purchasePriceFor(' + JSON.stringify(c.producer) + ',' + JSON.stringify(c.id) + ')');
    if (got === c.wrong) faults.push(c.id + ' still costs ' + got + ', the distributor\'s own sell price');
    else if (got !== c.expect) faults.push(c.id + ' costs ' + got + ', expected the producer\'s ' + c.expect);
  });
  if (faults.length) bad(faults.join(' · '));
  else ok('a purchase order is priced from the producer\'s listing (' +
    cases.map(c => c.id + ' ' + c.expect.toFixed(2) + ' not ' + c.wrong.toFixed(2)).join(', ') + ')');

  /* And an unagreed price stays unagreed rather than borrowing one. */
  const unpriced = w.eval("purchasePriceFor('Cantina Rossi','PRD-1001')");
  if (unpriced !== 0) bad('a wine the two of them have not priced came back as ' + unpriced +
    ' — A1: left for the host to fill in, never invented');
  else ok('a wine with no agreed supply price costs 0 and waits for the host, rather than borrowing a number');
}

/* ── 5. The article number is a note, and nothing joins on it ───── */
console.log('\n── holderArticleNo is a note, never a key');
{
  const withNo = L.filter(l => l.holderArticleNo != null);
  const byProduct = {};
  withNo.forEach(l => { (byProduct[l.productId] = byProduct[l.productId] || []).push(l.holderArticleNo); });
  const shared = Object.keys(byProduct).filter(k => byProduct[k].length > 1);
  if (!withNo.length) bad('no listing carries an article number — this section examined nothing');
  else if (!shared.length)
    bad('no wine carries more than one article number, so nothing here shows that it is not a key');
  else {
    const k = shared[0];
    ok(w.eval('wineName(' + JSON.stringify(k) + ')') + ' carries ' + byProduct[k].length +
       ' different article numbers (' + byProduct[k].join(', ') + ') — three houses, three notes, one wine');
  }

  /* MEASURED OVER THE SOURCE. A note becomes a key the moment one
     lookup compares it, and by then three surfaces depend on it. */
  const joins = CODE
    .filter(x => /holderArticleNo/.test(x.line))
    /* `== null` / `!= null` is a presence test on the field itself, not
       a comparison of one house's note against another's. */
    .map(x => ({ n: x.n, line: x.line.replace(/[!=]=+\s*null/g, '') }))
    .filter(x => /===|==|indexOf|includes|find\(|filter\(|\.some\(|match/.test(x.line));
  if (joins.length) bad(joins.length + ' source line(s) compare holderArticleNo: ' +
    joins.map(x => 'line ' + x.n).join(' · ') + ' — it is a freely typed note, so a join on it is a guess');
  else ok('no line in the source compares an article number; it is only ever displayed or written');
}

/* ── 6. ONE READING OF OWN-LABEL STATUS, AND THE DEBT IS CLOSED ── */
console.log('\n── own label has exactly one reading, and it is a derivation');
{
  /* 6a. THE BRIDGE IS GONE FROM THE SOURCE, not merely unread. It stood
     from 5 to 6 Aug 2026, three-valued, describing six wines that turned
     out not to be own labels at all (D41). "Unread but present" is the
     state this section used to guard against on the way in; on the way
     out the only acceptable count is zero. */
  const bridge = CODE.filter(x => /legacyOwnLabel|listingOwnLabelStatus/.test(x.line));
  if (bridge.length) bad(bridge.length + ' place(s) still carry the migration bridge: ' +
    bridge.map(x => 'line ' + x.n).join(' · ') +
    ' — OL-15 says it is REPLACED by the derivation, not extended toward it');
  else ok('neither `legacyOwnLabel` nor listingOwnLabelStatus() appears anywhere in the page');

  /* 6b. And no listing row carries the field either — the source could
     be clean while a fixture still held the data. */
  const carriers = L.filter(l => Object.prototype.hasOwnProperty.call(l, 'legacyOwnLabel'));
  if (carriers.length) bad(carriers.length + ' listing row(s) still carry `legacyOwnLabel`');
  else ok('no listing row carries an own-label field; the answer lives in the project');

  /* 6c. The interface still cannot set it (A17.12). There is nothing
     left to set, which is the strongest form of that: the control shows
     the derivation and is disabled. */
  const box = w.document.getElementById('aw-ownlabel');
  if (!box) bad('the own-label control is gone entirely — that is not what read-only means');
  else if (!box.disabled) bad('the own-label checkbox still writes — an own label is derived from a ' +
    'project past gate 2 and a delivered first order, not from a tick');
  else ok('the own-label control shows the status and cannot set it');

  /* 6d. THE DEBT THAT CLOSED ITSELF. It was green while no A17 project
     existed and red the first time one stood beside a live bridge. Both
     halves have to be true now: projects exist AND nothing carries the
     bridge. */
  const projects = w.eval('typeof ownLabelProjects === "undefined" ? null : ownLabelProjects');
  if (!projects) bad('`ownLabelProjects` does not exist — the derivation has nothing to read');
  else if (!projects.length) bad('no A17 project exists, so no listing can derive own-label status — ' +
    'the panel would render nothing and the migration would be a deletion rather than a replacement');
  else if (carriers.length || bridge.length) bad('the migration is half done');
  else ok('migration complete: ' + projects.length + ' A17 project(s), no bridge anywhere, ' +
    'own-label status derived from OL-15\'s two conditions');

  /* 6e. AND THE DERIVATION IS ACTUALLY ASKED — both conditions, and
     neither alone. This is OL-15 measured over the page's own rows
     rather than over a fixture. */
  const derived = J(`listings.filter(ownLabelListingDerived).map(function (l) {
    var pr = ownLabelProjectOf(l.productId);
    return { holder: l.holder, productId: l.productId,
             primary: pr ? pr.distributor : null,
             delivered: firstCommercialDeliveryOf(l.productId) ? true : false };
  })`);
  const wrongHolder = derived.filter(d => d.primary !== d.holder);
  const noDelivery  = derived.filter(d => !d.delivered);
  if (wrongHolder.length) bad(wrongHolder.length + ' listing(s) derive own label for a holder who is ' +
    'not the project\'s primary distributor — the second OL-15 condition is not being asked (A17.9b)');
  else if (noDelivery.length) bad(noDelivery.length + ' listing(s) derive own label with no delivered ' +
    'first commercial order behind them');
  else ok(derived.length + ' listing(s) derive own label, every one the primary distributor\'s ' +
    'and every one behind a confirmed first delivery');
}

/* ── 7. The books read listings, and the counter-checks ─────────── */
console.log('\n── the surfaces read the relation');
{
  /* The rendered badges have to follow the ROW, not a field on a book.
     Flip the row and the screen has to move; that is the whole claim. */
  const cases = [
    /* THE BADGE FOLLOWS THE PROJECT NOW, NOT A FIELD ON THE ROW, so
       the flip moves the thing the derivation actually reads: the
       project's primary distributor. Change that and Hawesko's listing
       stops being the primary own-label listing — which is OL-15's
       second condition, and A17.9b's whole point. */
    /* THE BADGE FOLLOWS THE PROJECT NOW, NOT A FIELD ON THE ROW, and
       both halves of OL-15 have to be standing before it can be flipped.
       `seed` builds them rather than assuming a fixture supplies them —
       an own-label product in the book, a delivered first order from its
       producing winery, and the primary distributor holding the listing.
       Written this way the check is true in the commit that introduces
       the derivation and in every commit after it, including the ones
       where the page's own chains arrive. */
    { what: 'the distributor own-label badge',
      render: 'renderWinePortfolioD',
      el: 'dportfolio-list',
      seed: `(function () {
        var pr = ownLabelProjects.filter(function (p) { return p.productId; })[0];
        var prod = wineByRef(pr.productId);
        if (!wineByRef(pr.productId, currentWinePortfolio))
          currentWinePortfolio.push({ id: prod.id, winery: prod.winery, name: prod.name,
            vintage: prod.vintage, type: prod.type, origin: prod.origin, url: prod.url });
        addListing(pr.distributor, pr.productId, { tradePrice: 7.90 });
        if (!firstCommercialDeliveryOf(pr.productId))
          orders.push({ id:'ORD-8001', placed:'2026-06-15', buyer:pr.distributor,
            buyerType:'distributor', seller:pr.producer, sellerType:'winery',
            stage:'delivered', items:[{ productId:pr.productId, qty:1200, unit:5.25,
            vintage:prod.vintage, batchOrLot:null }] });
      })()`,
      /* The flip moves the second OL-15 condition: hand the project to
         another distributor and Hawesko's listing stops being the
         PRIMARY own-label listing, which is A17.9b's whole point. */
      flip: "(function(){ ownLabelProjects.forEach(function (p) { p.distributor = 'Hamberger'; }); })()",
      was: 'Own-Label' },
    { what: "the restaurant's exclusivity",
      render: 'renderWineListR',
      el: 'rwinelist-list',
      flip: "(function(){ listingOf('Bistro Laurent','PRD-1020').exclusive = false; })()",
      was: 'Exclusive' },
    { what: "the retailer's exclusivity",
      render: 'renderWineSelectionT',
      el: 'tselection-list',
      flip: "(function(){ listingOf('Weinhaus M\\u00fcller','PRD-1020').exclusive = false; })()",
      was: 'Exclusive' }
  ];
  cases.forEach(c => {
    const win = build();
    if (c.seed) win.eval(c.seed);
    win.eval(c.render + '()');
    const before = win.document.getElementById(c.el).innerHTML;
    if (before.indexOf(c.was) === -1) return bad(c.what + ': "' + c.was + '" is not on the screen to begin with');
    win.eval(c.flip);
    win.eval(c.render + '()');
    const after = win.document.getElementById(c.el).innerHTML;
    if (before === after) bad(c.what + ' did not move when its listing did — the surface is reading ' +
      'something else, and the row is decoration');
    else ok(c.what + ' follows its listing row');
  });
}

/* ── 7b. "My Labels" is drawn from the PROJECTS, not typed ─────── */
console.log('\n── My Labels renders what the records say');
{
  const win = build();
  win.eval('renderOwnLabelsD()');
  const el = win.document.getElementById('dlabels-list');
  const count = win.document.getElementById('dlabels-count');
  const expected = JSON.parse(win.eval('JSON.stringify(ownLabelProjectsOf("Hawesko GmbH"))'));

  if (!el) bad('the My Labels list has no container');
  else {
    const rendered = el.querySelectorAll('.wine-edit-entry').length;
    if (!expected.length) bad('Hawesko has no own-label projects at all — the panel has nothing to draw ' +
      'and every check below examines nothing');
    else if (rendered !== expected.length)
      bad(rendered + ' rows rendered for ' + expected.length + ' own-label projects');
    else ok(rendered + ' rows, one per own-label project');

    /* THE COUNTER IS COUNTED. It read "(6)" in the markup beside rows
       the data agreed with three of. */
    if (!count) bad('the counter has no element — it is still typed into the heading');
    else if (count.textContent !== '(' + expected.length + ')')
      bad('the counter says ' + JSON.stringify(count.textContent) + ' for ' + expected.length + ' rows');
    else ok('the counter is computed: ' + count.textContent + ', and moves with the rows');

    /* THE PIPELINE HAS TO BE VISIBLE, AND FROM THE PROJECT STAGE.
       The bridge's `'pending'` value is gone and OL-15 is a boolean, so
       a project short of its first delivery shows a PHASE here — and the
       same wine must read Standard in the portfolio, because a project
       in flight is not a licence anybody signed. */
    const phases = JSON.parse(win.eval('JSON.stringify(ownLabelProjectsOf("Hawesko GmbH")' +
      '.map(function (p) { return ownLabelProjectPhase(p); }))'));
    const pending = expected.filter((p, i) => phases[i] !== 'active');
    const html = el.innerHTML;
    if (!pending.length) bad('every project is already active — the pipeline A17.14 asks for is not ' +
      'demonstrated at all');
    else {
      const labels = JSON.parse(win.eval('JSON.stringify(ownLabelProjectsOf("Hawesko GmbH")' +
        '.map(function (p) { return ownLabelProjectDetail(p); }))'));
      const missing = pending.filter((p, i) => html.indexOf(labels[expected.indexOf(p)]) === -1);
      if (missing.length) bad(missing.length + ' project(s) short of their first delivery do not show ' +
        'their stage on screen');
      else if (pending.some(p => p.productId &&
               win.eval('isOwnLabel("Hawesko GmbH",' + JSON.stringify(p.productId) + ')')))
        bad('a project short of its first delivery is badged Own-Label in the portfolio — ' +
          'that claims a licence nobody signed');
      else ok(pending.length + ' project(s) in the pipeline, each showing its own stage here and ' +
        'none of them badged in the portfolio');
    }

    /* AND THE STAGE COMES FROM THE PROJECT, NOT FROM THE LISTING. Move
       the stored stage and the line under the name has to move with it —
       otherwise the panel is drawing a label it made up. */
    {
      const w2 = build();
      w2.eval('renderOwnLabelsD()');
      const before = w2.document.getElementById('dlabels-list').innerHTML;
      const target = JSON.parse(w2.eval('JSON.stringify(ownLabelProjectsOf("Hawesko GmbH")' +
        '.filter(function (p) { return !p.productId && projectActive(p.id); })[0] || null)'));
      if (!target) ok('no in-conversation project to move — the stage check waits for one');
      else {
        /* Move it to a stage it is NOT already in, or the check passes
           on a no-op — which is how a mutation stops proving anything. */
        const to = target.stage === 'sample_received' ? 'sample_prepared' : 'sample_received';
        /* Neither of those two labels carries an ampersand, and that is
           deliberate: 'Design & brand' comes back out of innerHTML as
           'Design &amp; brand', and a check comparing the raw string
           would fail on a panel that is perfectly correct. */
        const label = w2.eval('OWN_LABEL_STAGE_LABELS[' + JSON.stringify(to) + ']');
        w2.eval('ownLabelProjectById(' + JSON.stringify(target.id) + ').stage = ' + JSON.stringify(to));
        w2.eval('renderOwnLabelsD()');
        const after = w2.document.getElementById('dlabels-list').innerHTML;
        if (before === after) bad('the panel did not move when a project stage did — it is reading ' +
          'something else, and the stage is decoration');
        else if (after.indexOf(label) === -1)
          bad('the stage moved to "' + to + '" and the panel drew something other than ' + JSON.stringify(label));
        else ok('the stage under the name follows the project row (→ ' + label + ')');
      }
    }
  }

  /* No hand-typed wine name may be left in this section's markup. */
  const start = SRC.indexOf('id="dsection-labels"');
  const section = SRC.slice(start, SRC.indexOf('<!-- ACTIVE PARTNERSHIPS', start));
  const names = JSON.parse(win.eval('JSON.stringify(allProducts().map(function (p) { return p.name; }))'));
  const typed = [...new Set(names)].filter(n => n && section.indexOf(n) !== -1);
  if (start === -1 || section.length < 100) bad('the My Labels section was not found in the source');
  else if (typed.length) bad(typed.length + ' wine name(s) are still typed into the section markup: ' + typed.join(' · '));
  else ok('not one wine name appears in the section markup; every row comes from a record');

  /* And the renderer asks the readings, never a field on a row. */
  const fnStart = SRC.indexOf('function renderOwnLabelsD(');
  const body = SRC.slice(fnStart, SRC.indexOf('\n}', SRC.indexOf('}).join', fnStart)));
  if (fnStart === -1 || body.length < 200) bad('renderOwnLabelsD() was not found — nothing was measured');
  else if (!/ownLabelProjectPhase\(/.test(body))
    bad('the renderer does not go through ownLabelProjectPhase() — the phase is being decided twice');
  else if (!/ownLabelProjectsOf\(/.test(body))
    bad('the renderer does not read the projects');
  else ok('renderOwnLabelsD() asks ownLabelProjectsOf() and ownLabelProjectPhase(), and names no field');
}

/* ── 8. Taking a wine on and off carries the row with it ────────── */
console.log('\n── the relation is created and removed with the wine');
{
  const win = build();
  const out = win.eval(`(function(){
    var before = listings.length;
    selectWineForAdd('PRD-1004');
    document.getElementById('aw-volume').value = '250';
    confirmAddWine();
    var added = listingOf('Hawesko GmbH', 'PRD-1004');
    var row = currentWinePortfolio[currentWinePortfolio.length - 1];
    var afterAdd = listings.length;
    deletePortfolioWine(currentWinePortfolio.length - 1);
    return JSON.stringify({
      grew: afterAdd === before + 1,
      added: added,
      addedIsOwnLabel: isOwnLabel('Hawesko GmbH', 'PRD-1004'),
      keyOnBook: row && row.id,
      goneAgain: !listingOf('Hawesko GmbH', 'PRD-1004'),
      finalCount: listings.length, before: before });
  })()`);
  const r = JSON.parse(out);
  if (!r.keyOnBook) bad('a wine pulled into the portfolio carries no product key — nothing can list it');
  else ok('a wine pulled in carries its key (' + r.keyOnBook + ')');
  if (!r.grew || !r.added) bad('pulling a wine in created no listing');
  else if (r.added.monthlyVolume !== 250)
    bad('the monthly volume the distributor typed did not reach the row: ' + r.added.monthlyVolume +
        ' — it was being read off the form and dropped before this pass');
  else if (Object.prototype.hasOwnProperty.call(r.added, 'legacyOwnLabel') ||
           Object.prototype.hasOwnProperty.call(r.added, 'ownLabel'))
    bad('a newly created listing carries an own-label field — nothing an interface does may create one (OL-15)');
  else if (r.addedIsOwnLabel)
    bad('a wine pulled into the book reads as an own label — pulling a wine in is not a project past ' +
        'gate 2 and not a delivered first order');
  else ok('one listing created, carrying the volume that was typed (250), no own-label field and no ' +
     'own-label status');
  if (!r.goneAgain || r.finalCount !== r.before)
    bad('removing the wine left its listing behind — a stale exclusivity and price for a wine nobody carries');
  else ok('removing the wine removes its listing; the count is back to ' + r.before);
}

/* ── 8b. A buyer's exclusivity is not an own label ────────────────
   A CLASS OF DEFECT, not one wrong number. Four typed aggregates on the
   two buyer profiles described the same three rows and disagreed with
   each other AND with the domain: Bistro Laurent's profile fact said
   "3 own-label" while its KPI card said 6, Weinhaus Müller's said 18 in
   both places, and every one of the four named own label where the
   marking is an exclusivity.

   WHY IT IS AN IMPOSSIBLE CLAIM AND NOT MERELY A WRONG ONE: OL-15's
   second condition is `holder === project.distributor`, so no buyer can
   ever hold a primary own-label listing. That is what section 8b
   asserts structurally — every buyer's own-label count must be zero
   BY DERIVATION, not because today's fixtures happen to say so.

   The visible-text half is deliberately a plain-text sweep over the
   rendered profiles rather than a check of the four ids: an id that
   stops being filled would still pass a "does the derivation work"
   test while the surface silently showed nothing, and a FIFTH typed
   aggregate could be added tomorrow with no id at all. */
console.log('\n── a buyer holds exclusivities, never own labels');
{
  const win = build();
  const BUYERS = [
    { holder: 'Bistro Laurent',  p: 'r', word: 'list' },
    { holder: 'Weinhaus Müller', p: 't', word: 'selection' }
  ];

  BUYERS.forEach(b => {
    /* DOUBLE ENTRY, and the mutation run is why. Asking
       exclusiveListingsOf() for the expected number and then asking
       whether the screen agrees only proves the two are consistent —
       break the derivation and both move together, silently. `raw` is
       counted off the rows themselves, so the derivation and the
       surface are each checked against the data instead of each other. */
    const out = win.eval(`(function(){
      var who = ${JSON.stringify(b.holder)};
      return JSON.stringify({
        rows:      listings.filter(function (l) { return l.holder === who; }).length,
        raw:       listings.filter(function (l) { return l.holder === who && l.exclusive === true; }).length,
        excl:      exclusiveListingsOf(who).length,
        ownLabels: ownLabelListingsOf(who).length,
        value:     (document.getElementById('${b.p}stat-excl-value')  || {}).textContent,
        delta:     (document.getElementById('${b.p}stat-excl-delta')  || {}).textContent,
        fact:      (document.getElementById('${b.p}fact-excl')        || {}).textContent
      });
    })()`);
    const r = JSON.parse(out);

    if (r.excl !== r.raw)
      bad('exclusiveListingsOf(' + b.holder + ') answers ' + r.excl + ' where ' + r.raw +
          ' of ' + r.rows + ' rows carry exclusive:true — the derivation is not reading the marking');
    else ok('exclusiveListingsOf(' + b.holder + ') matches the rows themselves (' + r.raw + ')');

    /* OL-15 structurally: a buyer can never be a project's distributor. */
    if (r.ownLabels !== 0)
      bad(b.holder + ' holds ' + r.ownLabels + ' own-label listing(s) — OL-15 says a buyer never can');
    else ok(b.holder + ' holds no own label, by derivation (OL-15)');

    if (!r.rows) bad(b.holder + ' has no listing rows at all — the count below would prove nothing');
    else if (r.value !== String(r.raw))
      bad(b.holder + "'s KPI card reads '" + r.value + "' against " + r.raw +
          ' exclusive row(s) — a typed number beside the rows it claims to count');
    else ok(b.holder + "'s KPI card is the counted number (" + r.raw + ' of ' + r.rows + ')');

    if (r.fact !== r.raw + ' of ' + r.rows + ' marked exclusive')
      bad(b.holder + "'s profile fact reads '" + r.fact + "' — expected the counted " +
          r.raw + ' of ' + r.rows);
    else ok(b.holder + "'s profile fact and KPI card give the SAME derived answer");

    if (!/own[- ]label/i.test(r.fact + ' ' + r.delta + ' ' + r.value)) ok('neither surface says own-label');
    else bad(b.holder + "'s exclusivity surfaces still claim own-label: '" + r.fact + "' / '" + r.delta + "'");
  });

  /* GROUNDED OVER EVERY HOLDER, and the mutation run is why this is not
     just the two buyers. All three of each buyer's rows carry
     `exclusive:true`, so "count the marked rows" and "count all rows"
     give the SAME answer for them — a derivation that had stopped
     reading the marking would have passed both buyer checks above. The
     holders that catch it are the ones with unmarked rows, and Hawesko
     alone has sixteen. */
  const perHolder = win.eval(`(function(){
    var out = {};
    listings.forEach(function (l) {
      out[l.holder] = out[l.holder] || { rows: 0, raw: 0 };
      out[l.holder].rows++;
      if (l.exclusive === true) out[l.holder].raw++;
    });
    Object.keys(out).forEach(function (h) { out[h].derived = exclusiveListingsOf(h).length; });
    return JSON.stringify(out);
  })()`);
  const per = JSON.parse(perHolder);
  const wrong = Object.keys(per).filter(h => per[h].derived !== per[h].raw);
  const mixed = Object.keys(per).filter(h => per[h].raw !== per[h].rows);
  if (!mixed.length)
    bad('every holder has all rows marked the same way — this check could not tell "marked" from "any"');
  else if (wrong.length)
    bad('the derivation disagrees with the rows for ' + wrong.map(h =>
      h + ' (' + per[h].derived + ' vs ' + per[h].raw + ' of ' + per[h].rows + ')').join(', '));
  else ok('the derivation matches the marked rows for all ' + Object.keys(per).length +
     ' holders, ' + mixed.length + ' of them carrying unmarked rows');

  /* The named empty case, reached by taking the markings off rather
     than by asserting what today's fixtures happen to be (C7). */
  const empty = win.eval(`(function(){
    var saved = listings.map(function (l) { return l.exclusive; });
    listings.forEach(function (l) { if (l.holder === 'Bistro Laurent') l.exclusive = false; });
    renderWineListR();
    var fact  = document.getElementById('rfact-excl').textContent;
    var delta = document.getElementById('rstat-excl-delta').textContent;
    var value = document.getElementById('rstat-excl-value').textContent;
    listings.forEach(function (l, i) { l.exclusive = saved[i]; });
    renderWineListR();
    return JSON.stringify({ fact: fact, delta: delta, value: value,
                            restored: document.getElementById('rfact-excl').textContent });
  })()`);
  const e = JSON.parse(empty);
  if (e.value !== '0' || !/None marked exclusive/.test(e.fact) || !/None marked exclusive/.test(e.delta))
    bad('a buyer with a list and no markings does not read as an empty case: ' +
        JSON.stringify([e.value, e.fact, e.delta]));
  else ok('no markings reads "None marked exclusive" on both surfaces, not a bare 0');
  if (e.restored === e.fact) bad('the fixtures did not come back — the check above changed the file state');
  else ok('markings restored (' + e.restored + ')');

  /* No FIFTH one. The whole rendered text of both buyer profiles must
     not put an own-label word next to a number. */
  const sweep = win.eval(`(function(){
    var hits = [];
    ['rbasics-view', 'tbasics-view', 'restaurant-view-dashboard', 'retail-view-dashboard']
      .forEach(function (id) {
        var el = document.getElementById(id);
        if (!el) { hits.push('MISSING:' + id); return; }
        el.textContent.split('\\n').forEach(function (line) {
          if (/own[- ]label/i.test(line) && /\\d/.test(line)) hits.push(id + ': ' + line.trim());
        });
      });
    return JSON.stringify(hits);
  })()`);
  const h = JSON.parse(sweep);
  if (h.length) bad('a buyer surface still pairs a number with an own-label claim: ' + h.join(' | '));
  else ok('no number on either buyer profile or dashboard is called own-label');
}

/* ── 9. Counter-checks ──────────────────────────────────────────── */
console.log('\n── the counter-checks');
{
  const cases = [
    { what: 'a listing grows a copy of the wine name',
      from: "{ holder:'Bistro Laurent', productId:'PRD-1020', exclusive:true,",
      to:   "{ holder:'Bistro Laurent', productId:'PRD-1020', name:'Sauvignon Blanc — Sancerre', exclusive:true,",
      ask:  win => J2(win, 'listings').every(l => !('name' in l)),
      says: 'the copy invariant 2 forbids, back on the row that exists to replace it' },

    { what: 'two rows for one (holder, product)',
      from: "{ holder:'Bistro Laurent', productId:'PRD-1022', exclusive:true,",
      to:   "{ holder:'Bistro Laurent', productId:'PRD-1020', exclusive:false, listedAt:LISTED_AT, holderArticleNo:null, monthlyVolume:null, tradePrice:null },\n  { holder:'Bistro Laurent', productId:'PRD-1022', exclusive:true,",
      ask:  win => {
        const seen = new Set();
        return J2(win, 'listings').every(l => {
          const k = l.holder + '|' + l.productId;
          if (seen.has(k)) return false;
          seen.add(k); return true;
        });
      },
      says: 'two answers to one relation, and no way to say which is right' },

    /* THE FALLBACK THIS MODEL FORBIDS, re-aimed at the derivation now
       that there is no bridge left to fall back FROM. OL-15 gives two
       conditions and no others; dropping the holder test is the
       cheapest way to get a third road, and it is the one A17.9b says
       would mark a downstream distributor's own first delivery as an own
       label. Section 6e is what has to catch it. */
    { what: 'the own-label derivation drops its second condition',
      from: "  if (listing.holder !== project.distributor) return false;",
      to:   "  if (listing.holder !== project.distributor && !listing.tradePrice) return false;",
      ask:  win => {
        win.eval(`(function () {
          var pr = ownLabelProjects.filter(function (p) { return p.productId; })[0];
          var prod = wineByRef(pr.productId);
          orders.push({ id:'ORD-8002', placed:'2026-06-15', buyer:pr.distributor,
            buyerType:'distributor', seller:pr.producer, sellerType:'winery', stage:'delivered',
            items:[{ productId:pr.productId, qty:1200, unit:5.25, vintage:prod.vintage, batchOrLot:null }] });
          addListing('Hamberger', pr.productId, { tradePrice: 9.10 });
        })()`);
        /* A downstream holder now derives own label. If nothing says so,
           the guard is gone and nobody noticed. */
        return !win.eval("ownLabelListingDerived(listingOf('Hamberger', " +
          "ownLabelProjects.filter(function (p) { return p.productId; })[0].productId))");
      },
      says: 'a downstream holder badging himself the primary own-label holder (A17.9b, OL-15)' },

    /* The debt of section 6d closed on 6 Aug 2026. What replaces the
       old "bridge beside a project" mutation is its mirror image: a
       STORED own-label field coming back onto a listing row. 6a scans
       the source and 6b scans the rows, and between them nothing of the
       kind may pass — including under a different name. */
    { what: 'a stored own-label flag comes back onto a listing row',
      from: "{ holder:'Hawesko GmbH', productId:'PRD-1020', exclusive:false,",
      to:   "{ holder:'Hawesko GmbH', productId:'PRD-1020', ownLabel:true, exclusive:false,",
      ask:  win => J2(win, 'listings').every(l =>
        !Object.prototype.hasOwnProperty.call(l, 'ownLabel') &&
        !Object.prototype.hasOwnProperty.call(l, 'legacyOwnLabel')),
      says: 'OL-6 broken on the row it was broken on before — no derived state is stored' },

    /* The scan in 6a blanks out comments, and a scan that blanks too
       much would report a clean source for one full of reads. This puts
       a real read in, in code, under the name the bridge used to have. */
    { what: 'the comment-blanking scan stops seeing code',
      from: "function isOwnLabel(holder, ref) { return ownLabelListingDerived(listingOf(holder, ref)); }",
      to:   "function isOwnLabel(holder, ref) { const l = listingOf(holder, ref); return (l && l.legacyOwnLabel) === 'active'; }",
      ask:  win => {
        const src = fs.readFileSync(path.join(__dirname, '..', 'bottle-lobby-dashboard.html'), 'utf8')
          .replace("function isOwnLabel(holder, ref) { return ownLabelListingDerived(listingOf(holder, ref)); }",
                   "function isOwnLabel(holder, ref) { const l = listingOf(holder, ref); return (l && l.legacyOwnLabel) === 'active'; }");
        return !codeLines(src).some(x => /legacyOwnLabel/.test(x.line));
      },
      says: 'a bridge read in live code that section 6a reported as absent' },

    /* A FIFTH typed aggregate, with no id for anything to overwrite —
       which is how the four originals got there. Aiming this at
       `#tfact-excl` proved nothing: the renderer paints over that node,
       so the mutation was a no-op and the "NOT caught" it produced was
       the mutation run doing its job. */
    { what: 'a fresh own-label aggregate is typed onto a buyer profile',
      from: '<div class="fact"><div class="fact-label">Avg. Margin</div><div class="fact-value">62%</div></div>',
      to:   '<div class="fact"><div class="fact-label">Avg. Margin</div><div class="fact-value">62% since own-label</div></div>',
      ask:  win => {
        const el = win.document.getElementById('tbasics-view');
        return !el.textContent.split('\n').some(l => /own[- ]label/i.test(l) && /\d/.test(l));
      },
      says: 'the exact shape of the four this section removed, added again where no renderer runs' },

    { what: 'exclusive stops meaning the marking and starts meaning the row',
      from: '  return listingsOf(holder).filter(l => !!l.exclusive);',
      to:   '  return listingsOf(holder);',
      ask:  win => win.eval(`(function(){
        /* Asked the way section 8b asks it — derivation against the raw
           rows, over every holder. Asking the two buyers alone returned
           "not caught": all three of each buyer's rows are marked, so
           "marked" and "any" are the same number there. */
        var raw = {}, bad = 0;
        listings.forEach(function (l) {
          raw[l.holder] = raw[l.holder] || 0;
          if (l.exclusive === true) raw[l.holder]++;
        });
        Object.keys(raw).forEach(function (h) {
          if (exclusiveListingsOf(h).length !== raw[h]) bad++;
        });
        return bad === 0;
      })()`),
      says: 'every row counted as exclusive — the number the old typed 6 and 18 were, one layer down' },

    { what: 'a price goes back to having no owner',
      from: "function listingPrice(holder, ref) {\n  const l = listingOf(holder, ref);",
      to:   "function listingPrice(holder, ref) {\n  const l = listings.find(x => x.productId === ((ref && typeof ref === 'object') ? ref.id : ref) && x.tradePrice != null);",
      ask:  win => {
        const a = win.eval("listingPrice('Cantina Rossi','PRD-1022')");
        const b = win.eval("listingPrice('Hawesko GmbH','PRD-1022')");
        return a !== b;
      },
      says: 'the flat map in a new coat: one wine, one number, and the other price unreachable' }
  ];

  cases.forEach(c => {
    const win = build({ from: c.from, to: c.to });
    if (!win) return bad('"' + c.what + '" never applied — the check below proves nothing');
    if (c.ask(win)) bad('NOT caught: ' + c.what + ' — ' + c.says + ', and nothing said so');
    else ok('caught: ' + c.what);
  });
}

console.log(fail ? '\n' + fail + ' check(s) failed' : '\nlistings: all checks passed');
process.exit(fail ? 1 : 0);
