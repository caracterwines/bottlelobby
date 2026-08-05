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

/* ── 6. ONE READING OF OWN-LABEL STATUS, AND THE DEBT CLOSES ────── */
console.log('\n── own label has exactly one reading');
{
  /* 6a. Nothing reads the bridge field except the one function. */
  const reads = CODE
    .filter(x => /legacyOwnLabel/.test(x.line))
    /* The fixture rows and addListing()'s default are DATA, not
       readings. The bridge is three-valued since commit 3 — 'active',
       'pending' or false — because "My Labels" listed a wine as Pending
       for months and a boolean could only have called it licensed. */
    .filter(x => !/legacyOwnLabel:\s*('active'|'pending'|true|false|!!)/.test(x.line));
  const outside = reads.filter(x => !/const v = listing && listing\.legacyOwnLabel;/.test(x.line));
  if (outside.length) bad(outside.length + ' place(s) read `legacyOwnLabel` outside listingOwnLabelStatus(): ' +
    outside.map(x => 'line ' + x.n).join(' · ') + ' — the A17 pass has to change one function, not hunt for callers');
  else ok('`legacyOwnLabel` is read in exactly one function; every surface asks listingOwnLabelStatus()');

  /* 6b. No write path sets or changes it. */
  const writes = CODE.filter(x => /legacyOwnLabel\s*=[^=]/.test(x.line));
  if (writes.length) bad(writes.length + ' write(s) to `legacyOwnLabel`: ' +
    writes.map(x => 'line ' + x.n).join(' · ') + ' — the bridge carries the legacy fixtures and nothing else');
  else ok('nothing assigns `legacyOwnLabel`; the interface cannot create a fourth own label through it');

  /* 6c. And the derivation is what the interface offers. Ticking a box
     may not grant an own label (A17.12), so the control is read-only. */
  const box = w.document.getElementById('aw-ownlabel');
  if (!box) bad('the own-label control is gone entirely — that is not what read-only means');
  else if (!box.disabled) bad('the own-label checkbox still writes — an own label is derived from a ' +
    'project past gate 2 and a delivered first order, not from a tick');
  else ok('the own-label control shows the status and cannot set it');

  /* 6d. THE DEBT THAT CLOSES ITSELF. Green while there are no A17
     projects; red the first time one exists beside a live bridge. */
  const projects = w.eval('typeof ownLabelProjects === "undefined" ? null : ownLabelProjects');
  const bridged = L.filter(l => Object.prototype.hasOwnProperty.call(l, 'legacyOwnLabel') && l.legacyOwnLabel);
  if (projects && projects.length && bridged.length)
    bad('A17 projects exist AND ' + bridged.length + ' listing(s) still carry `legacyOwnLabel` — ' +
        'two roads to one answer. The bridge is due: listingOwnLabelStatus() is REPLACED by the ' +
        'derivation, not extended with it');
  else if (projects && projects.length)
    ok('A17 projects exist and no listing carries the bridge any more — the migration is done');
  else
    ok('1 open migration bridge: legacyOwnLabel — A17 pass (' + bridged.length +
       ' legacy row(s), no ownLabelProjects yet)');
}

/* ── 7. The books read listings, and the counter-checks ─────────── */
console.log('\n── the surfaces read the relation');
{
  /* The rendered badges have to follow the ROW, not a field on a book.
     Flip the row and the screen has to move; that is the whole claim. */
  const cases = [
    { what: 'the distributor own-label badge',
      render: 'renderWinePortfolioD',
      el: 'dportfolio-list',
      flip: "(function(){ listingOf('Hawesko GmbH','PRD-1020').legacyOwnLabel = false; })()",
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

/* ── 7b. "My Labels" is drawn from the data, not typed ──────────── */
console.log('\n── My Labels renders what the records say');
{
  const win = build();
  win.eval('renderOwnLabelsD()');
  const el = win.document.getElementById('dlabels-list');
  const count = win.document.getElementById('dlabels-count');
  const expected = JSON.parse(win.eval('JSON.stringify(ownLabelListingsOf("Hawesko GmbH"))'));

  if (!el) bad('the My Labels list has no container');
  else {
    const rendered = el.querySelectorAll('.wine-edit-entry').length;
    if (!rendered) bad('the section rendered no rows at all');
    else if (rendered !== expected.length)
      bad(rendered + ' rows rendered for ' + expected.length + ' own-label listings');
    else ok(rendered + ' rows, one per own-label listing');

    /* THE COUNTER IS COUNTED. It read "(6)" in the markup beside rows
       the data agreed with three of. */
    if (!count) bad('the counter has no element — it is still typed into the heading');
    else if (count.textContent !== '(' + expected.length + ')')
      bad('the counter says ' + JSON.stringify(count.textContent) + ' for ' + expected.length + ' rows');
    else ok('the counter is computed: ' + count.textContent + ', and moves with the rows');

    /* The stage has to survive. A boolean bridge would have had to call
       the Riesling licensed, and it is not. */
    const pending = expected.filter(l => l.legacyOwnLabel === 'pending');
    const html = el.innerHTML;
    if (!pending.length) bad('no listing is pending — the two-stage case is not demonstrated at all');
    else if (html.indexOf('Pending') === -1) bad('a pending own label is not shown as pending');
    else if (!win.eval('isOwnLabel("Hawesko GmbH",' + JSON.stringify(pending[0].productId) + ') === false'))
      bad('a pending own label is badged Own-Label in the portfolio — that claims a licence nobody signed');
    else ok(pending.length + ' pending own label(s) show as Pending here and as Standard in the portfolio');
  }

  /* No hand-typed wine name may be left in this section's markup. */
  const start = SRC.indexOf('id="dsection-labels"');
  const section = SRC.slice(start, SRC.indexOf('<!-- ACTIVE PARTNERSHIPS', start));
  const names = JSON.parse(win.eval('JSON.stringify(listings.map(l => wineName(l.productId)))'));
  const typed = [...new Set(names)].filter(n => n && section.indexOf(n) !== -1);
  if (start === -1 || section.length < 100) bad('the My Labels section was not found in the source');
  else if (typed.length) bad(typed.length + ' wine name(s) are still typed into the section markup: ' + typed.join(' · '));
  else ok('not one wine name appears in the section markup; every row comes from a record');

  /* And the renderer asks the one reader, never the bridge field. */
  const fnStart = SRC.indexOf('function renderOwnLabelsD(');
  const body = SRC.slice(fnStart, SRC.indexOf('\nrenderWinePortfolioD();', fnStart));
  if (fnStart === -1 || body.length < 200) bad('renderOwnLabelsD() was not found — nothing was measured');
  else if (/legacyOwnLabel/.test(body))
    bad('the renderer reads `legacyOwnLabel` directly — the A17 pass would have to change it too');
  else if (!/listingOwnLabelStatus\(/.test(body))
    bad('the renderer does not go through listingOwnLabelStatus()');
  else ok('renderOwnLabelsD() asks listingOwnLabelStatus() and never names the bridge field');
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
  else if (r.added.legacyOwnLabel !== false)
    bad('a newly created listing carries the migration bridge — it may only ever hold the legacy fixtures');
  else ok('one listing created, carrying the volume that was typed (250) and no bridge flag');
  if (!r.goneAgain || r.finalCount !== r.before)
    bad('removing the wine left its listing behind — a stale exclusivity and price for a wine nobody carries');
  else ok('removing the wine removes its listing; the count is back to ' + r.before);
}

/* ── 9. Counter-checks ──────────────────────────────────────────── */
console.log('\n── the counter-checks');
{
  const cases = [
    { what: 'a listing grows a copy of the wine name',
      from: "{ holder:'Bistro Laurent', productId:'PRD-1020', legacyOwnLabel:false, exclusive:true,",
      to:   "{ holder:'Bistro Laurent', productId:'PRD-1020', name:'Sauvignon Blanc — Sancerre', legacyOwnLabel:false, exclusive:true,",
      ask:  win => J2(win, 'listings').every(l => !('name' in l)),
      says: 'the copy invariant 2 forbids, back on the row that exists to replace it' },

    { what: 'two rows for one (holder, product)',
      from: "{ holder:'Bistro Laurent', productId:'PRD-1022', legacyOwnLabel:false, exclusive:true,",
      to:   "{ holder:'Bistro Laurent', productId:'PRD-1020', legacyOwnLabel:false, exclusive:false, listedAt:LISTED_AT, holderArticleNo:null, monthlyVolume:null, tradePrice:null },\n  { holder:'Bistro Laurent', productId:'PRD-1022', legacyOwnLabel:false, exclusive:true,",
      ask:  win => {
        const seen = new Set();
        return J2(win, 'listings').every(l => {
          const k = l.holder + '|' + l.productId;
          if (seen.has(k)) return false;
          seen.add(k); return true;
        });
      },
      says: 'two answers to one relation, and no way to say which is right' },

    { what: 'the own-label reading gains a second road',
      from: "  const v = listing && listing.legacyOwnLabel;",
      to:   "  const v = (listing && listing.legacyOwnLabel) || (listing && listing.ownLabelProjectId && 'active');",
      ask:  win => {
        const src = fs.readFileSync(path.join(__dirname, '..', 'bottle-lobby-dashboard.html'), 'utf8')
          .replace("  const v = listing && listing.legacyOwnLabel;",
                   "  const v = (listing && listing.legacyOwnLabel) || (listing && listing.ownLabelProjectId && 'active');");
        return !/ownLabelProjectId && 'active'/.test(src);
      },
      says: 'exactly the lasting fallback A17 forbids — a listing counting as own-label either way' },

    { what: 'the bridge survives beside an A17 project',
      from: "const LISTED_AT = '2026-06-01';",
      to:   "const LISTED_AT = '2026-06-01';\nlet ownLabelProjects = [{ id:'OLP-1', distributor:'Hawesko GmbH', producer:'Cantina Rossi', stage:'gate2_approved' }];",
      ask:  win => {
        const projects = win.eval('typeof ownLabelProjects === "undefined" ? null : ownLabelProjects');
        const bridged = J2(win, 'listings').filter(l => l.legacyOwnLabel);
        return !(projects && projects.length && bridged.length);
      },
      says: 'the debt coming due without anybody reading a comment — this is the point of section 6d' },

    /* The scan in 6a blanks out comments, and a scan that blanks too
       much would report "read in exactly one function" for a source
       full of reads. This puts a real one in, in code. */
    { what: 'a second place reads the bridge field directly',
      from: "function isOwnLabel(holder, ref) { return listingOwnLabelStatus(listingOf(holder, ref)) === 'active'; }",
      to:   "function isOwnLabel(holder, ref) { const l = listingOf(holder, ref); return (l && l.legacyOwnLabel) === 'active'; }",
      ask:  win => {
        const src = fs.readFileSync(path.join(__dirname, '..', 'bottle-lobby-dashboard.html'), 'utf8')
          .replace("function isOwnLabel(holder, ref) { return listingOwnLabelStatus(listingOf(holder, ref)) === 'active'; }",
                   "function isOwnLabel(holder, ref) { const l = listingOf(holder, ref); return (l && l.legacyOwnLabel) === 'active'; }");
        return codeLines(src)
          .filter(x => /legacyOwnLabel/.test(x.line))
          .filter(x => !/legacyOwnLabel:\s*('active'|'pending'|true|false|!!)/.test(x.line))
          .every(x => /const v = listing && listing\.legacyOwnLabel;/.test(x.line));
      },
      says: 'a caller the A17 pass would have to hunt for — and proof the comment-blanking scan still sees code' },

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
